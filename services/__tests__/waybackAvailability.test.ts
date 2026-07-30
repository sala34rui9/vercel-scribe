import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  checkAvailability,
  isAvailable,
  fetchAvailabilityRaw,
  buildSnapshotUrl,
} from '../wayback/availability';

describe('buildSnapshotUrl', () => {
  it('builds correct snapshot URL', () => {
    const url = buildSnapshotUrl('https://example.com', '20240115123045');
    expect(url).toBe('https://web.archive.org/web/20240115123045/https://example.com');
  });
});

describe('fetchAvailabilityRaw', () => {
  beforeEach(() => mockFetch.mockReset());

  afterEach(() => mockFetch.mockReset());

  it('fetches and returns availability response', async () => {
    const mockResponse = {
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await fetchAvailabilityRaw('https://example.com');
    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toContain('archive.org/wayback/available');
    expect(callUrl).toContain('url=https%3A%2F%2Fexample.com');
  });

  it('throws on invalid URL', async () => {
    await expect(fetchAvailabilityRaw('')).rejects.toThrow('Invalid URL');
    await expect(fetchAvailabilityRaw('not a url')).rejects.toThrow('Invalid URL');
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchAvailabilityRaw('https://example.com')).rejects.toThrow('Service unavailable');
  });

  it('throws on timeout', async () => {
    mockFetch.mockImplementationOnce((_url: any, options: any) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    await expect(fetchAvailabilityRaw('https://example.com', 50)).rejects.toThrow('timed out after 50ms');
  }, 10000);

  it('throws on network error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(fetchAvailabilityRaw('https://example.com')).rejects.toThrow('Network error');
  });
});

describe('checkAvailability', () => {
  beforeEach(() => mockFetch.mockReset());

  afterEach(() => mockFetch.mockReset());

  it('returns available status with snapshot', async () => {
    const mockResponse = {
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await checkAvailability('https://example.com');
    expect(result.isAvailable).toBe(true);
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot?.url).toBe('https://example.com');
    expect(result.snapshot?.isAvailable).toBe(true);
    expect(result.snapshot?.statusCode).toBe(200);
  });

  it('returns unavailable when no snapshot exists', async () => {
    const mockResponse = {
      url: 'https://example.com',
      archived_snapshots: {},
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await checkAvailability('https://example.com');
    expect(result.isAvailable).toBe(false);
    expect(result.snapshot).toBeNull();
  });

  it('returns unavailable when closest is not available', async () => {
    const mockResponse = {
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await checkAvailability('https://example.com');
    expect(result.isAvailable).toBe(false);
    expect(result.snapshot).toBeNull();
  });

  it('normalizes URL without protocol', async () => {
    const mockResponse = {
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await checkAvailability('example.com');
    expect(result.isAvailable).toBe(true);
    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toContain('url=https%3A%2F%2Fexample.com');
  });
});

describe('isAvailable', () => {
  beforeEach(() => mockFetch.mockReset());

  afterEach(() => mockFetch.mockReset());

  it('returns true when snapshot exists', async () => {
    const mockResponse = {
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await isAvailable('https://example.com');
    expect(result).toBe(true);
  });

  it('returns false when no snapshot exists', async () => {
    const mockResponse = {
      url: 'https://example.com',
      archived_snapshots: {},
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await isAvailable('https://example.com');
    expect(result).toBe(false);
  });

  it('returns false on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await isAvailable('https://example.com');
    expect(result).toBe(false);
  });
});
