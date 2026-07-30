import { describe, it, expect } from 'vitest';
import {
  parseWaybackTimestamp,
  waybackTimestampToIso,
  formatWaybackDate,
  formatWaybackDateTime,
  buildSnapshotUrl,
  buildRawSnapshotUrl,
  parseCdxJsonRow,
  parseCdxJsonResponse,
  parseCdxTextResponse,
  cdxRecordToSnapshot,
  cdxRecordsToSnapshots,
  parseAvailabilityResponse,
  normalizeUrl,
  extractDomain,
  createFailedExtraction,
  createSuccessfulExtraction,
  filterHtmlSnapshots,
  deduplicateByDigest,
  filterSuccessfulRecords,
} from '../wayback/parser';
import type { WaybackCdxRecord, WaybackSnapshot, WaybackAvailabilityResponse } from '../../types';

describe('parseWaybackTimestamp', () => {
  it('parses valid timestamp to Date', () => {
    const date = parseWaybackTimestamp('20240115123045');
    expect(date.getUTCFullYear()).toBe(2024);
    expect(date.getUTCMonth()).toBe(0); // January = 0
    expect(date.getUTCDate()).toBe(15);
    expect(date.getUTCHours()).toBe(12);
    expect(date.getUTCMinutes()).toBe(30);
    expect(date.getUTCSeconds()).toBe(45);
  });

  it('returns current date for empty timestamp', () => {
    const before = new Date();
    const date = parseWaybackTimestamp('');
    const after = new Date();
    expect(date.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(date.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('returns current date for malformed timestamp', () => {
    const before = new Date();
    const date = parseWaybackTimestamp('abc');
    const after = new Date();
    expect(date.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(date.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('returns current date for short timestamp', () => {
    const before = new Date();
    const date = parseWaybackTimestamp('202401');
    const after = new Date();
    expect(date.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(date.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('waybackTimestampToIso', () => {
  it('converts timestamp to ISO format', () => {
    const iso = waybackTimestampToIso('20240115123045');
    expect(iso).toBe('2024-01-15T12:30:45.000Z');
  });
});

describe('formatWaybackDate', () => {
  it('formats timestamp to readable date', () => {
    const formatted = formatWaybackDate('20240115123045');
    expect(formatted).toContain('2024');
    expect(formatted).toContain('Jan');
  });
});

describe('formatWaybackDateTime', () => {
  it('formats timestamp to readable date and time', () => {
    const formatted = formatWaybackDateTime('20240115123045');
    expect(formatted).toContain('2024');
    expect(formatted).toContain('Jan');
  });
});

describe('buildSnapshotUrl', () => {
  it('builds correct snapshot URL', () => {
    const url = buildSnapshotUrl('https://example.com', '20240115123045');
    expect(url).toBe('https://web.archive.org/web/20240115123045/https://example.com');
  });
});

describe('buildRawSnapshotUrl', () => {
  it('builds correct raw snapshot URL', () => {
    const url = buildRawSnapshotUrl('https://example.com', '20240115123045');
    expect(url).toBe('https://web.archive.org/web/20240115123045id_//https://example.com');
  });
});

describe('parseCdxJsonRow', () => {
  it('parses valid CDX JSON row', () => {
    const row = ['com,example)/', '20240115123045', 'https://example.com', 'text/html', '200', 'ABC123', '12345'];
    const record = parseCdxJsonRow(row);
    expect(record).not.toBeNull();
    expect(record?.urlKey).toBe('com,example)/');
    expect(record?.timestamp).toBe('20240115123045');
    expect(record?.original).toBe('https://example.com');
    expect(record?.mimeType).toBe('text/html');
    expect(record?.statusCode).toBe(200);
    expect(record?.digest).toBe('ABC123');
    expect(record?.length).toBe(12345);
  });

  it('returns null for row with insufficient columns', () => {
    const row = ['com,example)/', '20240115123045'];
    const record = parseCdxJsonRow(row);
    expect(record).toBeNull();
  });

  it('returns null for null/undefined row', () => {
    expect(parseCdxJsonRow(null as any)).toBeNull();
    expect(parseCdxJsonRow(undefined as any)).toBeNull();
  });

  it('handles optional fields', () => {
    const row = ['com,example)/', '20240115123045', 'https://example.com', 'text/html', '200', 'ABC123', '12345', 'https://redirect.com', 'X', '100', 'file.warc.gz'];
    const record = parseCdxJsonRow(row);
    expect(record?.redirectUrl).toBe('https://redirect.com');
    expect(record?.robotFlags).toBe('X');
    expect(record?.offset).toBe(100);
    expect(record?.filename).toBe('file.warc.gz');
  });
});

describe('parseCdxJsonResponse', () => {
  it('parses full CDX JSON response with header', () => {
    const data = [
      ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'],
      ['com,example)/', '20240115123045', 'https://example.com', 'text/html', '200', 'ABC123', '12345'],
      ['com,example)/page', '20240116123045', 'https://example.com/page', 'text/html', '200', 'DEF456', '67890'],
    ];
    const records = parseCdxJsonResponse(data);
    expect(records).toHaveLength(2);
    expect(records[0].original).toBe('https://example.com');
    expect(records[1].original).toBe('https://example.com/page');
  });

  it('returns empty array for response with only header', () => {
    const data = [['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length']];
    const records = parseCdxJsonResponse(data);
    expect(records).toEqual([]);
  });

  it('returns empty array for empty response', () => {
    expect(parseCdxJsonResponse([])).toEqual([]);
    expect(parseCdxJsonResponse(null as any)).toEqual([]);
  });
});

describe('parseCdxTextResponse', () => {
  it('parses pipe-delimited CDX text response', () => {
    const text = `com,example)/ 20240115123045 https://example.com text/html 200 ABC123 12345
com,example)/page 20240116123045 https://example.com/page text/html 200 DEF456 67890`;
    const records = parseCdxTextResponse(text);
    expect(records).toHaveLength(2);
    expect(records[0].original).toBe('https://example.com');
    expect(records[1].original).toBe('https://example.com/page');
  });

  it('skips comment lines', () => {
    const text = `# This is a comment
com,example)/ 20240115123045 https://example.com text/html 200 ABC123 12345`;
    const records = parseCdxTextResponse(text);
    expect(records).toHaveLength(1);
  });

  it('skips lines with insufficient fields', () => {
    const text = `com,example)/ 20240115123045 https://example.com
com,example)/ 20240115123045 https://example.com text/html 200 ABC123 12345`;
    const records = parseCdxTextResponse(text);
    expect(records).toHaveLength(1);
  });

  it('returns empty array for empty text', () => {
    expect(parseCdxTextResponse('')).toEqual([]);
    expect(parseCdxTextResponse('   ')).toEqual([]);
  });
});

describe('cdxRecordToSnapshot', () => {
  it('converts CDX record to WaybackSnapshot', () => {
    const record: WaybackCdxRecord = {
      urlKey: 'com,example)/',
      timestamp: '20240115123045',
      original: 'https://example.com',
      mimeType: 'text/html',
      statusCode: 200,
      digest: 'ABC123',
      length: 12345,
    };
    const snapshot = cdxRecordToSnapshot(record);
    expect(snapshot.url).toBe('https://example.com');
    expect(snapshot.statusCode).toBe(200);
    expect(snapshot.mimeType).toBe('text/html');
    expect(snapshot.length).toBe(12345);
    expect(snapshot.isAvailable).toBe(true);
    expect(snapshot.snapshotUrl).toContain('web.archive.org');
  });

  it('marks 404 snapshots as unavailable', () => {
    const record: WaybackCdxRecord = {
      urlKey: 'com,example)/',
      timestamp: '20240115123045',
      original: 'https://example.com',
      mimeType: 'text/html',
      statusCode: 404,
      digest: 'ABC123',
      length: 0,
    };
    const snapshot = cdxRecordToSnapshot(record);
    expect(snapshot.isAvailable).toBe(false);
  });
});

describe('cdxRecordsToSnapshots', () => {
  it('converts multiple records', () => {
    const records: WaybackCdxRecord[] = [
      {
        urlKey: 'com,example)/',
        timestamp: '20240115123045',
        original: 'https://example.com',
        mimeType: 'text/html',
        statusCode: 200,
        digest: 'ABC123',
        length: 12345,
      },
      {
        urlKey: 'com,example)/page',
        timestamp: '20240116123045',
        original: 'https://example.com/page',
        mimeType: 'text/html',
        statusCode: 200,
        digest: 'DEF456',
        length: 67890,
      },
    ];
    const snapshots = cdxRecordsToSnapshots(records);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].url).toBe('https://example.com');
    expect(snapshots[1].url).toBe('https://example.com/page');
  });
});

describe('parseAvailabilityResponse', () => {
  it('parses response with available snapshot', () => {
    const response: WaybackAvailabilityResponse = {
      url: 'https://example.com',
      archived_snapshots: {
        closest: {
          status: '200',
          available: true,
          url: 'https://web.archive.org/web/20240115123045/https://example.com',
          timestamp: '20240115123045',
        },
      },
    };
    const snapshot = parseAvailabilityResponse(response);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.url).toBe('https://example.com');
    expect(snapshot?.isAvailable).toBe(true);
    expect(snapshot?.statusCode).toBe(200);
  });

  it('returns null when no snapshot available', () => {
    const response: WaybackAvailabilityResponse = {
      url: 'https://example.com',
      archived_snapshots: {},
    };
    const snapshot = parseAvailabilityResponse(response);
    expect(snapshot).toBeNull();
  });

  it('returns null when closest is not available', () => {
    const response: WaybackAvailabilityResponse = {
      url: 'https://example.com',
      archived_snapshots: {
        closest: {
          status: '404',
          available: false,
          url: '',
          timestamp: '',
        },
      },
    };
    const snapshot = parseAvailabilityResponse(response);
    expect(snapshot).toBeNull();
  });
});

describe('normalizeUrl', () => {
  it('adds https protocol if missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
  });

  it('keeps existing https protocol', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('keeps existing http protocol', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('returns null for empty string', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
  });

  it('returns null for invalid URL', () => {
    expect(normalizeUrl('not a url')).toBeNull();
  });
});

describe('extractDomain', () => {
  it('extracts domain from URL', () => {
    expect(extractDomain('https://example.com/path')).toBe('example.com');
  });

  it('handles URL without protocol', () => {
    expect(extractDomain('example.com')).toBe('example.com');
  });

  it('handles subdomain', () => {
    expect(extractDomain('https://www.example.com')).toBe('www.example.com');
  });

  it('returns empty string for invalid URL', () => {
    expect(extractDomain('not a url')).toBe('');
  });
});

describe('createFailedExtraction', () => {
  it('creates failed extraction object', () => {
    const result = createFailedExtraction(
      'https://example.com',
      'https://web.archive.org/web/20240115/https://example.com',
      '2024-01-15T12:30:45Z',
      'Network error'
    );
    expect(result.fetchStatus).toBe('failed');
    expect(result.errorMessage).toBe('Network error');
    expect(result.content).toBe('');
    expect(result.url).toBe('https://example.com');
  });
});

describe('createSuccessfulExtraction', () => {
  it('creates successful extraction object', () => {
    const result = createSuccessfulExtraction(
      'https://example.com',
      'https://web.archive.org/web/20240115/https://example.com',
      '2024-01-15T12:30:45Z',
      'Extracted content here',
      'text/html',
      200,
      'Page Title',
      150
    );
    expect(result.fetchStatus).toBe('success');
    expect(result.content).toBe('Extracted content here');
    expect(result.title).toBe('Page Title');
    expect(result.statusCode).toBe(200);
    expect(result.latencyMs).toBe(150);
  });
});

describe('filterHtmlSnapshots', () => {
  it('filters to only HTML snapshots', () => {
    const snapshots: WaybackSnapshot[] = [
      { url: 'https://a.com', snapshotUrl: '', timestamp: '', date: new Date(), statusCode: 200, mimeType: 'text/html', length: 0, isAvailable: true },
      { url: 'https://b.com', snapshotUrl: '', timestamp: '', date: new Date(), statusCode: 200, mimeType: 'application/pdf', length: 0, isAvailable: true },
      { url: 'https://c.com', snapshotUrl: '', timestamp: '', date: new Date(), statusCode: 200, mimeType: 'text/html', length: 0, isAvailable: true },
    ];
    const filtered = filterHtmlSnapshots(snapshots);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(s => s.mimeType.includes('text/html'))).toBe(true);
  });

  it('filters out unavailable snapshots', () => {
    const snapshots: WaybackSnapshot[] = [
      { url: 'https://a.com', snapshotUrl: '', timestamp: '', date: new Date(), statusCode: 200, mimeType: 'text/html', length: 0, isAvailable: true },
      { url: 'https://b.com', snapshotUrl: '', timestamp: '', date: new Date(), statusCode: 404, mimeType: 'text/html', length: 0, isAvailable: false },
    ];
    const filtered = filterHtmlSnapshots(snapshots);
    expect(filtered).toHaveLength(1);
  });
});

describe('deduplicateByDigest', () => {
  it('removes duplicate digests', () => {
    const records: WaybackCdxRecord[] = [
      { urlKey: 'a', timestamp: '20240101', original: 'https://a.com', mimeType: 'text/html', statusCode: 200, digest: 'ABC', length: 100 },
      { urlKey: 'a', timestamp: '20240102', original: 'https://a.com', mimeType: 'text/html', statusCode: 200, digest: 'ABC', length: 100 },
      { urlKey: 'a', timestamp: '20240103', original: 'https://a.com', mimeType: 'text/html', statusCode: 200, digest: 'DEF', length: 200 },
    ];
    const deduped = deduplicateByDigest(records);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].timestamp).toBe('20240101');
    expect(deduped[1].timestamp).toBe('20240103');
  });
});

describe('filterSuccessfulRecords', () => {
  it('filters to only 2xx and 3xx status codes', () => {
    const records: WaybackCdxRecord[] = [
      { urlKey: 'a', timestamp: '20240101', original: 'https://a.com', mimeType: 'text/html', statusCode: 200, digest: 'A', length: 100 },
      { urlKey: 'b', timestamp: '20240102', original: 'https://b.com', mimeType: 'text/html', statusCode: 301, digest: 'B', length: 100 },
      { urlKey: 'c', timestamp: '20240103', original: 'https://c.com', mimeType: 'text/html', statusCode: 404, digest: 'C', length: 100 },
      { urlKey: 'd', timestamp: '20240104', original: 'https://d.com', mimeType: 'text/html', statusCode: 500, digest: 'D', length: 100 },
    ];
    const filtered = filterSuccessfulRecords(records);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].statusCode).toBe(200);
    expect(filtered[1].statusCode).toBe(301);
  });
});
