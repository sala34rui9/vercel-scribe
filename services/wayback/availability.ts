/**
 * Wayback Machine Availability API Service
 * Checks whether a URL has archived snapshots available.
 *
 * API Docs: https://archive.org/help/wayback_api.php
 * Endpoint: GET https://archive.org/wayback/available?url=<url>
 */

import type { WaybackAvailabilityResponse, WaybackSnapshot } from '../../types';

const WAYBACK_AVAILABILITY_API = 'https://archive.org/wayback/available';
const DEFAULT_TIMEOUT = 15000;

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
 * Returns the unprocessed API response for custom handling.
 */
export const fetchAvailabilityRaw = async (
  url: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<WaybackAvailabilityResponse> => {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    throw new Error('Wayback Availability: Invalid URL provided');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const apiUrl = `${WAYBACK_AVAILABILITY_API}?url=${encodeURIComponent(normalizedUrl)}`;
    console.log(`[Wayback] Checking availability: ${normalizedUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Wayback API error (${response.status}): Service unavailable`);
    }

    const data = await response.json() as WaybackAvailabilityResponse;
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Wayback Availability request timed out after ${timeout}ms`);
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Wayback Availability: Network error - check internet connection');
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
