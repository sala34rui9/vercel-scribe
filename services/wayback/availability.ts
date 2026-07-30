/**
 * Wayback Machine Availability API Service
 * Checks whether a URL has archived snapshots available.
 *
 * API Docs: https://archive.org/wayback_api.php
 * Endpoint: GET https://archive.org/wayback/available?url=<url>
 *
 * Uses CORS proxy fallback chain for browser compatibility.
 */

import type { WaybackAvailabilityResponse, WaybackSnapshot } from '../../types';

const WAYBACK_AVAILABILITY_API = 'https://archive.org/wayback/available';
const DEFAULT_TIMEOUT = 15000;

// CORS proxy options for browser compatibility
const CORS_PROXIES = [
  "https://corsproxy.io/?url={url}",
  "https://api.allorigins.win/raw?url={url}",
];

/**
 * Gets the CORS proxy URL for the given proxy index.
 * Users can set localStorage 'wayback_cors_proxy' to:
 *   - 'disabled' to call API directly (will fail in browser due to CORS)
 *   - a custom URL pattern with {url} placeholder
 *   - or leave unset to use the built-in fallback chain
 */
const getProxyUrl = (proxyIndex: number, targetUrl: string): string => {
  const customProxy = localStorage.getItem('wayback_cors_proxy');

  // User disabled proxy - return direct URL
  if (customProxy === 'disabled') {
    return targetUrl;
  }

  // User provided custom proxy pattern
  if (customProxy && customProxy !== 'disabled') {
    return customProxy.replace('{url}', encodeURIComponent(targetUrl));
  }

  // Use built-in proxy chain
  if (proxyIndex < CORS_PROXIES.length) {
    return CORS_PROXIES[proxyIndex].replace('{url}', encodeURIComponent(targetUrl));
  }

  // Fallback to direct URL
  return targetUrl;
};

/**
 * Validates and normalizes a URL string.
 * Returns null if the URL is invalid.
 */
const normalizeUrl = (url: string): string | null => {
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
 * Converts a Wayback timestamp (YYYYMMDDHHMMSS) to ISO 8601 format.
 */
const waybackTimestampToIso = (timestamp: string): string => {
  if (timestamp.length < 14) return new Date().toISOString();
  const year = timestamp.substring(0, 4);
  const month = timestamp.substring(4, 6);
  const day = timestamp.substring(6, 8);
  const hour = timestamp.substring(8, 10);
  const minute = timestamp.substring(10, 12);
  const second = timestamp.substring(12, 14);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
};

/**
 * Builds the direct Wayback Machine snapshot URL from a timestamp.
 */
export const buildSnapshotUrl = (originalUrl: string, timestamp: string): string => {
  return `https://web.archive.org/web/${timestamp}/${originalUrl}`;
};

/**
 * Fetches the raw availability response from the Wayback Machine.
 * Tries direct request first, then falls back to CORS proxies.
 * Returns the unprocessed API response for custom handling.
 */
export const fetchAvailabilityRaw = async (
  url: string,
  timeout: number = DEFAULT_TIMEOUT,
  proxyIndex: number = 0
): Promise<WaybackAvailabilityResponse> => {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    throw new Error('Wayback Availability: Invalid URL provided');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const directUrl = `${WAYBACK_AVAILABILITY_API}?url=${encodeURIComponent(normalizedUrl)}`;
    const fetchUrl = getProxyUrl(proxyIndex, directUrl);
    const isUsingProxy = fetchUrl !== directUrl;

    if (isUsingProxy) {
      console.log(`[Wayback] Using CORS proxy ${proxyIndex} for availability check`);
    } else {
      console.log(`[Wayback] Checking availability: ${normalizedUrl}`);
    }

    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // If we get a CORS error (status 0) or network error, try next proxy
      if (response.status === 0 || proxyIndex < CORS_PROXIES.length) {
        if (proxyIndex < CORS_PROXIES.length) {
          console.warn(`[Wayback] Proxy ${proxyIndex} failed (status ${response.status}), trying next...`);
          return fetchAvailabilityRaw(url, timeout, proxyIndex + 1);
        }
      }
      throw new Error(`Wayback API error (${response.status}): Service unavailable`);
    }

    const data = await response.json() as WaybackAvailabilityResponse;
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Wayback Availability request timed out after ${timeout}ms`);
    }

    // Network error - try next CORS proxy
    if (error instanceof TypeError && proxyIndex < CORS_PROXIES.length) {
      console.warn(`[Wayback] Network error with proxy ${proxyIndex}, trying CORS proxy...`);
      return fetchAvailabilityRaw(url, timeout, proxyIndex + 1);
    }

    throw error;
  }
};

/**
 * Checks whether a URL has an archived snapshot available.
 * Returns a simplified result with the closest snapshot if available.
 *
 * @param url - The URL to check
 * @param timeout - Request timeout in milliseconds
 * @returns Object with availability status and snapshot info
 *
 * @example
 * const result = await checkAvailability('https://example.com');
 * if (result.isAvailable) {
 *   console.log(`Snapshot available at: ${result.snapshot?.snapshotUrl}`);
 * }
 */
export const checkAvailability = async (
  url: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<{
  url: string;
  isAvailable: boolean;
  snapshot: WaybackSnapshot | null;
}> => {
  try {
    const data = await fetchAvailabilityRaw(url, timeout);
    const closest = data.archived_snapshots?.closest;

    if (closest?.available && closest.timestamp) {
      const normalizedUrl = normalizeUrl(url) || url;
      const snapshot: WaybackSnapshot = {
        url: normalizedUrl,
        snapshotUrl: closest.url || buildSnapshotUrl(normalizedUrl, closest.timestamp),
        timestamp: waybackTimestampToIso(closest.timestamp),
        date: new Date(waybackTimestampToIso(closest.timestamp)),
        statusCode: parseInt(closest.status, 10) || 200,
        mimeType: 'text/html',
        length: 0,
        isAvailable: true,
      };

      return { url: data.url || normalizedUrl, isAvailable: true, snapshot };
    }

    return { url: data.url || url, isAvailable: false, snapshot: null };
  } catch (error: any) {
    console.error('[Wayback] Availability check failed:', error.message);
    throw error;
  }
};

/**
 * Quick availability check that returns only a boolean.
 * Useful for conditional logic without handling full snapshot data.
 *
 * @param url - The URL to check
 * @returns True if an archived snapshot exists
 */
export const isAvailable = async (url: string): Promise<boolean> => {
  try {
    const result = await checkAvailability(url);
    return result.isAvailable;
  } catch {
    return false;
  }
};
