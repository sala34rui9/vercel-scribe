/**
 * Wayback Machine CDX API Service
 * Retrieves historical capture records for URLs.
 *
 * API Docs: https://github.com/internetarchive/wayback/tree/master/wayback-cdx-server
 * Endpoint: GET https://web.archive.org/cdx/search/cdx?url=<url>&output=json
 *
 * Uses Supabase Edge Function as primary method (no CORS),
 * with CORS proxy fallback for browser compatibility.
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

// CORS proxy options for browser compatibility (fallback only)
const CORS_PROXIES = [
  "https://corsproxy.io/?url={url}",
  "https://api.allorigins.win/raw?url={url}",
];

/**
 * Gets the CORS proxy URL for the given proxy index.
 */
const getProxyUrl = (proxyIndex: number, targetUrl: string): string => {
  const customProxy = localStorage.getItem('wayback_cors_proxy');

  if (customProxy === 'disabled') {
    return targetUrl;
  }

  if (customProxy && customProxy !== 'disabled') {
    return customProxy.replace('{url}', encodeURIComponent(targetUrl));
  }

  if (proxyIndex < CORS_PROXIES.length) {
    return CORS_PROXIES[proxyIndex].replace('{url}', encodeURIComponent(targetUrl));
  }

  return targetUrl;
};

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
 * Fetches CDX records via Supabase Edge Function (primary method).
 */
const fetchViaEdgeFunction = async (url: string, options: WaybackCdxOptions = {}): Promise<WaybackCdxRecord[] | null> => {
  try {
    const { supabase } = await import('../../services/supabaseClient');
    const { data, error } = await supabase.functions.invoke('wayback-proxy', {
      body: { endpoint: 'cdx', url, options },
    });

    if (error) {
      console.warn('[Wayback CDX] Edge function error:', error.message);
      return null;
    }

    // Edge function returns parsed JSON array
    if (Array.isArray(data)) {
      return parseCdxJsonResponse(data);
    }

    // Handle raw text response
    if (data && data.raw) {
      return parseCdxTextResponse(data.raw);
    }

    return null;
  } catch (error: any) {
    console.warn('[Wayback CDX] Edge function failed:', error.message);
    return null;
  }
};

/**
 * Fetches raw CDX records from the Wayback Machine.
 * Tries edge function first, then direct, then CORS proxies.
 */
export const fetchCdxRecords = async (
  url: string,
  options: WaybackCdxOptions = {},
  timeout: number = DEFAULT_TIMEOUT,
  proxyIndex: number = 0
): Promise<WaybackCdxRecord[]> => {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    throw new Error('Wayback CDX: Invalid URL provided');
  }

  // Method 1: Try Supabase Edge Function (most reliable, no CORS)
  console.log(`[Wayback CDX] Trying edge function for: ${normalizedUrl}`);
  const edgeResult = await fetchViaEdgeFunction(normalizedUrl, options);
  if (edgeResult && edgeResult.length > 0) {
    console.log(`[Wayback CDX] Edge function returned ${edgeResult.length} records`);
    return edgeResult;
  }

  // Method 2: Try direct request or CORS proxy
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const directUrl = buildCdxUrl(normalizedUrl, options);
    const fetchUrl = getProxyUrl(proxyIndex, directUrl);
    const isUsingProxy = fetchUrl !== directUrl;

    if (isUsingProxy) {
      console.log(`[Wayback CDX] Using CORS proxy ${proxyIndex}`);
    } else {
      console.log(`[Wayback CDX] Trying direct request for: ${normalizedUrl}`);
    }

    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 0 || proxyIndex < CORS_PROXIES.length) {
        if (proxyIndex < CORS_PROXIES.length) {
          console.warn(`[Wayback CDX] Proxy ${proxyIndex} failed (status ${response.status}), trying next...`);
          return fetchCdxRecords(url, options, timeout, proxyIndex + 1);
        }
      }
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

    // Network error - try next CORS proxy
    if (error instanceof TypeError && proxyIndex < CORS_PROXIES.length) {
      console.warn(`[Wayback CDX] Network error with proxy ${proxyIndex}, trying CORS proxy...`);
      return fetchCdxRecords(url, options, timeout, proxyIndex + 1);
    }

    throw error;
  }
};

/**
 * Fetches all captures for a URL and returns them as WaybackSnapshot objects.
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

  const successfulRecords = filterSuccessfulRecords(records);
  const snapshots = cdxRecordsToSnapshots(successfulRecords);
  return filterHtmlSnapshots(snapshots);
};

/**
 * Fetches captures deduplicated by content hash.
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
 */
export const fetchRecentSnapshots = async (
  url: string,
  count: number = 10,
  timeout: number = DEFAULT_TIMEOUT
): Promise<WaybackSnapshot[]> => {
  const snapshots = await fetchSnapshots(url, { limit: count * 2 }, timeout);
  return snapshots
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, count);
};

/**
 * Fetches the first (oldest) snapshot for a URL.
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
 * Fetches the total number of captures for a URL.
 */
export const countCaptures = async (
  url: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<number> => {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    throw new Error('Wayback CDX: Invalid URL provided');
  }

  // Try edge function first
  const edgeResult = await fetchViaEdgeFunction(normalizedUrl, { collapse: 'digest', limit: MAX_LIMIT });
  if (edgeResult !== null) {
    return edgeResult.length;
  }

  // Fallback to direct request
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const directUrl = `${WAYBACK_CDX_API}?url=${encodeURIComponent(normalizedUrl)}&output=json&collapse=digest&limit=${MAX_LIMIT}`;
    const fetchUrl = getProxyUrl(0, directUrl);

    const response = await fetch(fetchUrl, {
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
