/**
 * Wayback Machine Content Extractor
 * Fetches and extracts content from archived snapshots.
 *
 * Provides functions to:
 * - Fetch raw HTML from archived snapshots
 * - Extract text content from HTML
 * - Parse page titles and metadata
 * - Handle extraction errors gracefully
 *
 * Uses CORS proxy fallback chain for browser compatibility.
 */

import type {
  WaybackSnapshot,
  WaybackExtractedContent,
  WaybackExtractOptions,
} from '../../types';
import {
  buildSnapshotUrl,
  buildRawSnapshotUrl,
  createFailedExtraction,
  createSuccessfulExtraction,
  waybackTimestampToIso,
} from './parser';

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_CONTENT_LENGTH = 50000; // 50KB limit for extracted content

// CORS proxy options for browser compatibility
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
 * Strips HTML tags and returns plain text.
 * Simple extraction for content analysis.
 */
const stripHtml = (html: string): string => {
  if (!html) return '';

  // Remove script and style elements
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Replace block-level elements with newlines for readability
  text = text
    .replace(/<\/?(p|div|h[1-6]|li|tr|br|blockquote|pre)[^>]*>/gi, '\n')
    .replace(/<\/?(ul|ol|table|section|article|header|footer|nav|aside)[^>]*>/gi, '\n\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');

  // Clean up whitespace
  text = text
    .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
    .replace(/[ \t]+/g, ' ')      // Collapse horizontal whitespace
    .trim();

  return text;
};

/**
 * Extracts the page title from HTML content.
 */
const extractTitle = (html: string): string => {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    return stripHtml(titleMatch[1]).trim();
  }

  // Fallback: try h1
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    return stripHtml(h1Match[1]).trim();
  }

  return '';
};

/**
 * Extracts meta description from HTML content.
 */
const extractMetaDescription = (html: string): string => {
  const metaMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
  ) || html.match(
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i
  );

  return metaMatch ? metaMatch[1].trim() : '';
};

/**
 * Fetches raw HTML content from a Wayback Machine snapshot URL.
 * Tries direct request first, then falls back to CORS proxies.
 */
const fetchRawContent = async (
  snapshotUrl: string,
  timeout: number,
  proxyIndex: number = 0
): Promise<{ html: string; statusCode: number; mimeType: string }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchUrl = getProxyUrl(proxyIndex, snapshotUrl);
    const isUsingProxy = fetchUrl !== snapshotUrl;

    if (isUsingProxy) {
      console.log(`[Wayback] Using CORS proxy ${proxyIndex} for content extraction`);
    } else {
      console.log(`[Wayback] Extracting content from: ${snapshotUrl}`);
    }

    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // If we get a CORS error (status 0) or network error, try next proxy
      if (response.status === 0 || proxyIndex < CORS_PROXIES.length) {
        if (proxyIndex < CORS_PROXIES.length) {
          console.warn(`[Wayback] Proxy ${proxyIndex} failed (status ${response.status}), trying next...`);
          return fetchRawContent(snapshotUrl, timeout, proxyIndex + 1);
        }
      }
      throw new Error(`Failed to fetch snapshot content (${response.status})`);
    }

    const html = await response.text();
    const mimeType = response.headers.get('content-type') || 'text/html';
    const statusCode = response.status;

    return { html, statusCode, mimeType };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Content fetch timed out after ${timeout}ms`);
    }

    // Network error - try next CORS proxy
    if (error instanceof TypeError && proxyIndex < CORS_PROXIES.length) {
      console.warn(`[Wayback] Network error with proxy ${proxyIndex}, trying CORS proxy...`);
      return fetchRawContent(snapshotUrl, timeout, proxyIndex + 1);
    }

    throw error;
  }
};

/**
 * Extracts content from a specific Wayback Machine snapshot.
 * Fetches the raw archived page and extracts text content.
 *
 * @param snapshot - The WaybackSnapshot to extract content from
 * @param options - Extraction options (timeout, max length)
 * @returns WaybackExtractedContent with extracted text
 *
 * @example
 * const content = await extractContent(snapshot, { maxContentLength: 10000 });
 * if (content.fetchStatus === 'success') {
 *   console.log(content.title, content.content.substring(0, 200));
 * }
 */
export const extractContent = async (
  snapshot: WaybackSnapshot,
  options: WaybackExtractOptions = {}
): Promise<WaybackExtractedContent> => {
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const maxLength = options.maxContentLength || DEFAULT_MAX_CONTENT_LENGTH;
  const startTime = Date.now();

  try {
    // Use raw URL to get unmodified content without Wayback toolbar
    const rawUrl = buildRawSnapshotUrl(
      snapshot.url,
      snapshot.timestamp.replace(/[-T:Z]/g, '').substring(0, 14)
    );

    const { html, statusCode, mimeType } = await fetchRawContent(rawUrl, timeout);
    const latencyMs = Date.now() - startTime;

    if (!html || html.length < 100) {
      return createFailedExtraction(
        snapshot.url,
        snapshot.snapshotUrl,
        snapshot.timestamp,
        'Retrieved content is too small or empty'
      );
    }

    const title = extractTitle(html);
    let content = stripHtml(html);

    // Truncate if exceeds max length
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '\n\n[Content truncated...]';
    }

    return createSuccessfulExtraction(
      snapshot.url,
      snapshot.snapshotUrl,
      snapshot.timestamp,
      content,
      mimeType,
      statusCode,
      title,
      latencyMs
    );
  } catch (error: any) {
    console.error(`[Wayback] Content extraction failed: ${error.message}`);
    return createFailedExtraction(
      snapshot.url,
      snapshot.snapshotUrl,
      snapshot.timestamp,
      error.message || 'Unknown extraction error'
    );
  }
};

/**
 * Extracts content from multiple snapshots in sequence.
 * Useful for batch processing or comparison workflows.
 *
 * @param snapshots - Array of WaybackSnapshot objects
 * @param options - Extraction options
 * @returns Array of WaybackExtractedContent results
 */
export const extractMultipleContents = async (
  snapshots: WaybackSnapshot[],
  options: WaybackExtractOptions = {}
): Promise<WaybackExtractedContent[]> => {
  const results: WaybackExtractedContent[] = [];

  for (const snapshot of snapshots) {
    try {
      const content = await extractContent(snapshot, options);
      results.push(content);
    } catch (error: any) {
      results.push(createFailedExtraction(
        snapshot.url,
        snapshot.snapshotUrl,
        snapshot.timestamp,
        error.message || 'Extraction failed'
      ));
    }
  }

  return results;
};

/**
 * Extracts content from a snapshot URL directly.
 * Convenience function when you have a URL but not a WaybackSnapshot object.
 *
 * @param originalUrl - The original URL that was archived
 * @param timestamp - Wayback timestamp (YYYYMMDDHHMMSS format)
 * @param options - Extraction options
 * @returns WaybackExtractedContent with extracted text
 */
export const extractFromTimestamp = async (
  originalUrl: string,
  timestamp: string,
  options: WaybackExtractOptions = {}
): Promise<WaybackExtractedContent> => {
  const snapshot: WaybackSnapshot = {
    url: originalUrl,
    snapshotUrl: buildSnapshotUrl(originalUrl, timestamp),
    timestamp: waybackTimestampToIso(timestamp),
    date: new Date(waybackTimestampToIso(timestamp)),
    statusCode: 200,
    mimeType: 'text/html',
    length: 0,
    isAvailable: true,
  };

  return extractContent(snapshot, options);
};

/**
 * Fetches content from the Wayback Machine using the availability API.
 * Combines availability check and content extraction in one call.
 *
 * @param url - The URL to fetch archived content for
 * @param options - Extraction options
 * @returns WaybackExtractedContent or null if no archive exists
 */
export const fetchArchivedContent = async (
  url: string,
  options: WaybackExtractOptions = {}
): Promise<WaybackExtractedContent | null> => {
  const { checkAvailability } = await import('./availability');

  const availability = await checkAvailability(url);
  if (!availability.isAvailable || !availability.snapshot) {
    return null;
  }

  return extractContent(availability.snapshot, options);
};
