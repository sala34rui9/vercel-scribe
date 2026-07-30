/**
 * Wayback Machine Response Parser
 * Transforms raw API responses into typed, normalized data structures.
 *
 * This module handles parsing for:
 * - Availability API responses
 * - CDX API responses (JSON and raw text formats)
 * - Timestamp normalization
 * - URL validation and normalization
 */

import type {
  WaybackCdxRecord,
  WaybackSnapshot,
  WaybackAvailabilityResponse,
  WaybackExtractedContent,
} from '../../types';

/**
 * Converts a Wayback timestamp (YYYYMMDDHHMMSS) to a JavaScript Date object.
 * Returns current date if timestamp is malformed.
 */
export const parseWaybackTimestamp = (timestamp: string): Date => {
  if (!timestamp || timestamp.length < 14) return new Date();

  const year = parseInt(timestamp.substring(0, 4), 10);
  const month = parseInt(timestamp.substring(4, 6), 10) - 1; // 0-indexed
  const day = parseInt(timestamp.substring(6, 8), 10);
  const hour = parseInt(timestamp.substring(8, 10), 10);
  const minute = parseInt(timestamp.substring(10, 12), 10);
  const second = parseInt(timestamp.substring(12, 14), 10);

  const date = new Date(Date.UTC(year, month, day, hour, minute, second));

  // Validate the date is reasonable (not NaN)
  if (isNaN(date.getTime())) return new Date();
  return date;
};

/**
 * Converts a Wayback timestamp to ISO 8601 format.
 */
export const waybackTimestampToIso = (timestamp: string): string => {
  const date = parseWaybackTimestamp(timestamp);
  return date.toISOString();
};

/**
 * Formats a Wayback timestamp to a human-readable date string.
 */
export const formatWaybackDate = (timestamp: string): string => {
  const date = parseWaybackTimestamp(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Formats a Wayback timestamp to include time.
 */
export const formatWaybackDateTime = (timestamp: string): string => {
  const date = parseWaybackTimestamp(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Builds the direct Wayback Machine snapshot URL from a timestamp and original URL.
 */
export const buildSnapshotUrl = (originalUrl: string, timestamp: string): string => {
  return `https://web.archive.org/web/${timestamp}/${originalUrl}`;
};

/**
 * Builds a raw/direct content URL from a timestamp.
 * Returns the unmodified archived content without Wayback Machine toolbar.
 */
export const buildRawSnapshotUrl = (originalUrl: string, timestamp: string): string => {
  return `https://web.archive.org/web/${timestamp}id_/${originalUrl}`;
};

/**
 * Parses a single CDX JSON row into a typed record.
 * CDX JSON format: [urlKey, timestamp, original, mimeType, statusCode, digest, length, ...]
 */
export const parseCdxJsonRow = (row: string[]): WaybackCdxRecord | null => {
  if (!row || row.length < 6) return null;

  return {
    urlKey: row[0] || '',
    timestamp: row[1] || '',
    original: row[2] || '',
    mimeType: row[3] || 'text/html',
    statusCode: parseInt(row[4], 10) || 0,
    digest: row[5] || '',
    length: parseInt(row[6], 10) || 0,
    redirectUrl: row[7] || undefined,
    robotFlags: row[8] || undefined,
    offset: row[9] ? parseInt(row[9], 10) : undefined,
    filename: row[10] || undefined,
  };
};

/**
 * Parses the full CDX JSON response into an array of typed records.
 * The first row is typically the header: ["urlkey","timestamp","original","mimetype","statuscode","digest","length"]
 */
export const parseCdxJsonResponse = (data: string[][]): WaybackCdxRecord[] => {
  if (!data || data.length <= 1) return [];

  // Skip header row (index 0)
  const records: WaybackCdxRecord[] = [];
  for (let i = 1; i < data.length; i++) {
    const record = parseCdxJsonRow(data[i]);
    if (record) records.push(record);
  }
  return records;
};

/**
 * Parses CDX raw text response (pipe-delimited format).
 * Format: urlkey timestamp original mimetype statuscode digest length [redirect] [robotflags] [offset] [filename]
 */
export const parseCdxTextResponse = (text: string): WaybackCdxRecord[] => {
  if (!text?.trim()) return [];

  const lines = text.trim().split('\n');
  const records: WaybackCdxRecord[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue; // Skip comments

    const parts = trimmed.split(' ');
    if (parts.length < 6) continue;

    records.push({
      urlKey: parts[0],
      timestamp: parts[1],
      original: parts[2],
      mimeType: parts[3],
      statusCode: parseInt(parts[4], 10) || 0,
      digest: parts[5],
      length: parts[6] ? parseInt(parts[6], 10) : 0,
      redirectUrl: parts[7] || undefined,
      robotFlags: parts[8] || undefined,
    });
  }

  return records;
};

/**
 * Converts a CDX record to a normalized WaybackSnapshot.
 */
export const cdxRecordToSnapshot = (record: WaybackCdxRecord): WaybackSnapshot => {
  return {
    url: record.original,
    snapshotUrl: buildSnapshotUrl(record.original, record.timestamp),
    timestamp: waybackTimestampToIso(record.timestamp),
    date: parseWaybackTimestamp(record.timestamp),
    statusCode: record.statusCode,
    mimeType: record.mimeType,
    length: record.length,
    isAvailable: record.statusCode >= 200 && record.statusCode < 400,
  };
};

/**
 * Converts an array of CDX records to WaybackSnapshot array.
 */
export const cdxRecordsToSnapshots = (records: WaybackCdxRecord[]): WaybackSnapshot[] => {
  return records.map(cdxRecordToSnapshot);
};

/**
 * Parses the Availability API response into a WaybackSnapshot.
 */
export const parseAvailabilityResponse = (
  response: WaybackAvailabilityResponse
): WaybackSnapshot | null => {
  const closest = response.archived_snapshots?.closest;
  if (!closest?.available || !closest.timestamp) return null;

  const timestamp = closest.timestamp;
  return {
    url: response.url,
    snapshotUrl: closest.url || buildSnapshotUrl(response.url, timestamp),
    timestamp: waybackTimestampToIso(timestamp),
    date: parseWaybackTimestamp(timestamp),
    statusCode: parseInt(closest.status, 10) || 200,
    mimeType: 'text/html',
    length: 0,
    isAvailable: true,
  };
};

/**
 * Validates and normalizes a URL string.
 * Returns null if the URL is invalid.
 */
export const normalizeUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
    new URL(withProtocol);
    return withProtocol;
  } catch {
    return null;
  }
};

/**
 * Extracts the domain from a URL string.
 */
export const extractDomain = (url: string): string => {
  try {
    const withProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`;
    return new URL(withProtocol).hostname;
  } catch {
    return '';
  }
};

/**
 * Creates a WaybackExtractedContent object for a failed fetch.
 */
export const createFailedExtraction = (
  url: string,
  snapshotUrl: string,
  timestamp: string,
  errorMessage: string
): WaybackExtractedContent => {
  return {
    url,
    snapshotUrl,
    timestamp,
    title: '',
    content: '',
    mimeType: '',
    statusCode: 0,
    fetchStatus: 'failed',
    errorMessage,
  };
};

/**
 * Creates a WaybackExtractedContent object from successful fetch data.
 */
export const createSuccessfulExtraction = (
  url: string,
  snapshotUrl: string,
  timestamp: string,
  content: string,
  mimeType: string,
  statusCode: number,
  title: string = '',
  latencyMs?: number
): WaybackExtractedContent => {
  return {
    url,
    snapshotUrl,
    timestamp,
    title,
    content,
    mimeType,
    statusCode,
    fetchStatus: 'success',
    latencyMs,
  };
};

/**
 * Filters snapshots to only include successful HTML captures.
 */
export const filterHtmlSnapshots = (snapshots: WaybackSnapshot[]): WaybackSnapshot[] => {
  return snapshots.filter(
    s => s.isAvailable && s.mimeType?.includes('text/html')
  );
};

/**
 * Deduplicates snapshots by digest hash (same content = same digest).
 */
export const deduplicateByDigest = (records: WaybackCdxRecord[]): WaybackCdxRecord[] => {
  const seen = new Set<string>();
  return records.filter(record => {
    if (seen.has(record.digest)) return false;
    seen.add(record.digest);
    return true;
  });
};

/**
 * Filters records to only include successful HTTP responses (2xx, 3xx).
 */
export const filterSuccessfulRecords = (records: WaybackCdxRecord[]): WaybackCdxRecord[] => {
  return records.filter(r => r.statusCode >= 200 && r.statusCode < 400);
};
