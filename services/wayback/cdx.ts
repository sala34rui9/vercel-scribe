/**
 * Wayback Machine CDX API Service
 * Retrieves historical capture records for URLs.
 *
 * API Docs: https://github.com/internetarchive/wayback/tree/master/wayback-cdx-server
 * Endpoint: GET https://web.archive.org/cdx/search/cdx?url=<url>&output=json
 *
 * The CDX API returns all captures (snapshots) of a URL over time.
 * Each row represents one archived capture with metadata.
 */

import type {
  WaybackCdxOptions,
  WaybackCdxRecord,
  WaybackSnapshot,
} from '../../types';
import {
  parseCdxJsonResponse,
  parseCdxTextResponse,
  cdxRecordToSnapshot,
  cdxRecordsToSnapshots,
  filterSuccessfulRecords,
  filterHtmlSnapshots,
  deduplicateByDigest,
  normalizeUrl,
} from './parser';

const WAYBACK_CDX_API = 'https://web.archive.org/cdx/search/cdx';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 150000;

/**
 * Builds the CDX API URL with query parameters.
 */
const buildCdxUrl = (url: string, options: WaybackCdxOptions = {}): string => {
  const params = new URLSearchParams();
  params.set('url', url);
  params.set('output', 'json');
  params.set('fl', 'urlkey,timestamp,original,mimetype,statuscode,digest,length');

  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  if (options.limit) params.set('limit', String(Math.min(options.limit, MAX_LIMIT)));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.filterStatus) params.set('statuscode', String(options.filterStatus));
  if (options.filterMimeType) params.set('mimetype', options.filterMimeType);
  if (options.collapse) params.set('collapse', options.collapse);

  return `${WAYBACK_CDX_API}?${params.toString()}`;
};

/**
 * Fetches raw CDX records from the Wayback Machine.
 * Returns unparsed CDX records for custom processing.
 *
 * @param url - The URL pattern to search (supports wildcards like *.example.com)
 * @param options - Query options for filtering results
 * @param timeout - Request timeout in milliseconds
 * @returns Array of CDX records
 */
export const fetchCdxRecords = async (
  url: string,
  options: WaybackCdxOptions = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<WaybackCdxRecord[]> => {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    throw new Error('Wayback CDX: Invalid URL provided');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const apiUrl = buildCdxUrl(normalizedUrl, options);
    console.log(`[Wayback CDX] Fetching captures for: ${normalizedUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Wayback CDX: Rate limit exceeded. Try again later.');
      }
      throw new Error(`Wayback CDX API error (${response.status}): Service unavailable`);
    }

    const text = await response.text();

    // Try JSON parsing first, fall back to text parsing
    let records: WaybackCdxRecord[];
    try {
      const jsonData = JSON.parse(text);
      records = parseCdxJsonResponse(jsonData);
    } catch {
      records = parseCdxTextResponse(text);
    }

    console.log(`[Wayback CDX] Found ${records.length} captures`);
    return records;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Wayback CDX request timed out after ${timeout}ms`);
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Wayback CDX: Network error - check internet connection');
    }
    throw error;
  }
};

/**
 * Fetches all captures for a URL and returns them as WaybackSnapshot objects.
 * This is the primary function for getting historical snapshots.
 *
 * @param url - The URL to retrieve captures for
 * @param options - Query options (limit, date range, etc.)
 * @param timeout - Request timeout in milliseconds
 * @returns Array of WaybackSnapshot objects
 *
 * @example
 * const snapshots = await fetchSnapshots('https://example.com', { limit: 100 });
 * snapshots.forEach(s => console.log(s.timestamp, s.snapshotUrl));
 */
export const fetchSnapshots = async (
  url: string,
  options: WaybackCdxOptions = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<WaybackSnapshot[]> => {
  const records = await fetchCdxRecords(url, {
    limit: options.limit || DEFAULT_LIMIT,
    from: options.from,
    to: options.to,
  }, timeout);

  // Filter to successful HTML captures only
  const successfulRecords = filterSuccessfulRecords(records);
  const snapshots = cdxRecordsToSnapshots(successfulRecords);
  return filterHtmlSnapshots(snapshots);
};

/**
 * Fetches captures deduplicated by content hash.
 * Useful for getting unique versions of a page (ignoring identical captures).
 *
 * @param url - The URL to retrieve unique captures for
 * @param options - Query options
 * @param timeout - Request timeout in milliseconds
 * @returns Array of unique WaybackSnapshot objects
 */
export const fetchUniqueSnapshots = async (
  url: string,
  options: WaybackCdxOptions = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<WaybackSnapshot[]> => {
  const records = await fetchCdxRecords(url, {
    ...options,
    limit: options.limit || DEFAULT_LIMIT,
  }, timeout);

  const successfulRecords = filterSuccessfulRecords(records);
  const uniqueRecords = deduplicateByDigest(successfulRecords);
  const snapshots = cdxRecordsToSnapshots(uniqueRecords);
  return filterHtmlSnapshots(snapshots);
};

/**
 * Fetches the most recent N snapshots for a URL.
 *
 * @param url - The URL to retrieve snapshots for
 * @param count - Number of recent snapshots to return (default: 10)
 * @param timeout - Request timeout in milliseconds
 * @returns Array of the most recent WaybackSnapshot objects
 */
export const fetchRecentSnapshots = async (
  url: string,
  count: number = 10,
  timeout: number = DEFAULT_TIMEOUT
): Promise<WaybackSnapshot[]> => {
  const snapshots = await fetchSnapshots(url, { limit: count * 2 }, timeout);
  // Sort by date descending and take the first N
  return snapshots
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, count);
};

/**
 * Fetches the first (oldest) snapshot for a URL.
 *
 * @param url - The URL to find the oldest capture for
 * @param timeout - Request timeout in milliseconds
 * @returns The oldest WaybackSnapshot or null if none found
 */
export const fetchFirstSnapshot = async (
  url: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<WaybackSnapshot | null> => {
  const records = await fetchCdxRecords(url, { limit: 1 }, timeout);
  if (records.length === 0) return null;

  const snapshots = cdxRecordsToSnapshots(filterSuccessfulRecords(records));
  const htmlSnapshots = filterHtmlSnapshots(snapshots);
  return htmlSnapshots[0] || null;
};

/**
 * Fetches the latest (most recent) snapshot for a URL.
 *
 * @param url - The URL to find the latest capture for
 * @param timeout - Request timeout in milliseconds
 * @returns The latest WaybackSnapshot or null if none found
 */
export const fetchLatestSnapshot = async (
  url: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<WaybackSnapshot | null> => {
  const snapshots = await fetchSnapshots(url, { limit: 10 }, timeout);
  if (snapshots.length === 0) return null;

  return snapshots.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
};

/**
 * Fetches the total number of captures for a URL without retrieving all records.
 * Uses a small limit to check availability and get count from headers if available.
 *
 * @param url - The URL to count captures for
 * @param timeout - Request timeout in milliseconds
 * @returns Total number of captures (approximate)
 */
export const countCaptures = async (
  url: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<number> => {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    throw new Error('Wayback CDX: Invalid URL provided');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Use collapse=digest to count unique captures
    const apiUrl = `${WAYBACK_CDX_API}?url=${encodeURIComponent(normalUrl)}&output=json&collapse=digest&limit=${MAX_LIMIT}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Wayback CDX API error (${response.status})`);
    }

    const text = await response.text();
    let records: WaybackCdxRecord[];

    try {
      const jsonData = JSON.parse(text);
      records = parseCdxJsonResponse(jsonData);
    } catch {
      records = parseCdxTextResponse(text);
    }

    return records.length;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Wayback CDX count request timed out after ${timeout}ms`);
    }
    throw error;
  }
};
