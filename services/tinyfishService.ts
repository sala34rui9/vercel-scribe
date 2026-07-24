/**
 * TinyFish API Service
 * Provides search functionality for AI-powered research
 */

const TINYFISH_API_BASE = 'https://api.search.tinyfish.ai';
const LOCAL_STORAGE_KEY = 'user_tinyfish_api_key';
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryable = (status: number) => [429, 500, 503].includes(status);

import { fetchWebPages, getTinyFishFetchApiKey, FetchedDocument } from './tinyfishFetchService';

export interface SearchWebParams {
  query: string;
  location?: string;
  language?: string;
  domain_type?: string;
  after_date?: string;
  before_date?: string;
  recency_minutes?: number;
  page?: number;
  include_thumbnail?: boolean;
  purpose?: string;
}

export interface ListSearchUsageParams {
  start_after?: string;
  end_before?: string;
  status?: string;
  limit?: number;
  page?: number;
}

export interface SearchResult {
  position: number;
  title: string;
  snippet: string;
  site_name: string;
  url: string;
}

export interface SearchWebResponse {
  query: string;
  results: SearchResult[];
  total_results: number;
  page: number;
}

export interface SearchUsageResponse {
  items: any[];
  total: number;
  limit: number;
  page: number;
  total_pages: number;
  has_more: boolean;
}

export const getTinyFishApiKey = (): string => {
  const key = localStorage.getItem(LOCAL_STORAGE_KEY);
  return key?.trim() || '';
};

const handleHttpError = (status: number, body: any) => {
  let msg = body?.error || body?.message || body?.detail || '';
  if (typeof msg === 'object') {
    try {
      msg = JSON.stringify(msg);
    } catch {
      msg = '[object Object]';
    }
  }
  switch (status) {
    case 400: throw new Error(`TinyFish Bad Request: ${msg}`);
    case 401: throw new Error('TinyFish API Key is invalid. Check your API key.');
    case 403: throw new Error('TinyFish API Key lacks permission for this operation.');
    case 404: throw new Error('TinyFish API endpoint not found.');
    case 422: throw new Error(`TinyFish Validation Error: ${msg}`);
    case 429: throw new Error('TinyFish API rate limit exceeded. Try again later.');
    case 500: throw new Error(`TinyFish server error: ${msg}`);
    case 503: throw new Error('TinyFish service unavailable. Try again later.');
    default: throw new Error(`TinyFish API Error (${status}): ${msg}`);
  }
};

async function tinyfishRequest<T>(
  endpoint: string,
  apiKey: string,
  params?: Record<string, any>,
  timeout: number = DEFAULT_TIMEOUT
): Promise<T> {
  const url = new URL(`${TINYFISH_API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (isRetryable(response.status) && attempt < MAX_RETRIES) {
          const delay = 1000 * Math.pow(2, attempt);
          console.warn(`[TinyFish] Retryable error ${response.status}, attempt ${attempt + 1}/${MAX_RETRIES + 1}. Waiting ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        handleHttpError(response.status, body);
      }

      return await response.json() as T;
    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;
      if (error.name === 'AbortError') {
        throw new Error(`TinyFish request timed out after ${timeout}ms`);
      }
      if (attempt < MAX_RETRIES && error.message?.includes('rate limit')) {
        const delay = 1000 * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export const searchWeb = async (
  query: string,
  options: Omit<SearchWebParams, 'query'> = {},
  timeout?: number
): Promise<SearchWebResponse> => {
  if (!query?.trim()) {
    throw new Error('TinyFish searchWeb: "query" parameter is required');
  }

  const apiKey = getTinyFishApiKey();
  if (!apiKey) {
    throw new Error('TinyFish API key is missing. Please add your API key in Settings.');
  }

  console.log(`[TinyFish] Searching: "${query.substring(0, 60)}..."`);

  const params: SearchWebParams = { query, ...options };
  return tinyfishRequest<SearchWebResponse>('/', apiKey, params, timeout);
};

export const listSearchUsage = async (
  options: ListSearchUsageParams = {},
  timeout?: number
): Promise<SearchUsageResponse> => {
  const apiKey = getTinyFishApiKey();
  if (!apiKey) {
    throw new Error('TinyFish API key is missing. Please add your API key in Settings.');
  }

  return tinyfishRequest<SearchUsageResponse>('/usage', apiKey, options, timeout);
};

// Helpers for filtering and fetching
const filterUrlsForFetch = (urls: string[]): string[] => {
  const ignorePatterns = [/search/i, /category/i, /login/i, /ad/i, /track/i, /\/tag\//i, /\/author\//i];
  return urls.filter(url => !ignorePatterns.some(p => p.test(url)));
};

const formatFetchedDocsToContext = (topic: string, docs: FetchedDocument[]): string => {
  let context = `# Research Context: ${topic}\n\n`;
  const successfulDocs = docs.filter(d => d.status === 'success' && d.markdown);
  
  if (successfulDocs.length === 0) {
    return context + "No detailed content could be fetched.";
  }

  successfulDocs.forEach(doc => {
    context += `## Source: ${doc.title || doc.url}\n`;
    context += `**URL:** ${doc.url}\n`;
    if (doc.author) context += `**Author:** ${doc.author}\n`;
    if (doc.published_date) context += `**Published:** ${doc.published_date}\n`;
    context += `\n${doc.markdown?.substring(0, 4000) || ''}\n\n---\n\n`;
  });
  return context;
};

export const fetchRealTimeDataTinyFish = async (topic: string): Promise<{ content: string; sources: string[] }> => {
  const result = await searchWeb(topic);
  const allUrls = result.results.map(r => r.url).filter(Boolean);
  const sources = allUrls;

  if (getTinyFishFetchApiKey()) {
    console.log('[TinyFish] Fetch API key found, extracting full content...');
    const filteredUrls = filterUrlsForFetch(allUrls).slice(0, 3);
    try {
      const fetchResponse = await fetchWebPages(filteredUrls, { purpose: `Extract factual information about ${topic}` });
      const content = formatFetchedDocsToContext(topic, fetchResponse.results);
      return { content, sources };
    } catch (e) {
      console.warn('[TinyFish] Fetch failed, falling back to snippets', e);
    }
  }

  // Fallback to snippets
  const content = result.results.map(r => `- **${r.title}**: ${r.snippet}`).join('\n');
  return { content, sources };
};

export const scanForExternalLinksTinyFish = async (
  topic: string,
  excludeDomain?: string
): Promise<Array<{ title: string; url: string; snippet?: string }>> => {
  const result = await searchWeb(`${topic} authoritative sources research`, {
    domain_type: excludeDomain ? 'exclude' : undefined
  });
  return result.results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet?.substring(0, 150) || 'External source'
  })).slice(0, 15);
};

export const scanForInternalLinksTinyFish = async (
  websiteUrl: string,
  topic: string
): Promise<{ links: { title: string; url: string; snippet?: string }[]; opportunities: { topic: string; reason: string }[] }> => {
  let domain = websiteUrl;
  try {
    const urlToParse = websiteUrl.match(/^https?:\/\//) ? websiteUrl : `https://${websiteUrl}`;
    domain = new URL(urlToParse).hostname;
  } catch (e) {
    console.warn('[TinyFish] Invalid URL for internal link scan, using as-is:', websiteUrl);
  }

  const result = await searchWeb(`site:${domain} ${topic}`);
  const cleanDomain = domain.replace(/^www\./, '');
  const links = result.results
    .filter(r => r.url.includes(cleanDomain))
    .map(r => ({ title: r.title, url: r.url, snippet: r.snippet?.substring(0, 150) }));

  return { links, opportunities: [] };
};

export const analyzeBrandWebsiteTinyFish = async (
  websiteUrl: string
): Promise<{ brandVoice: string; siteArchitecture: string[]; content: string }> => {
  const result = await searchWeb(websiteUrl);

  if (!result.results.length) {
    return { brandVoice: '', siteArchitecture: [], content: '' };
  }

  const siteArchitecture = result.results.map(r => r.url);
  const brandVoice = `Based on site analysis of ${websiteUrl}`;

  if (getTinyFishFetchApiKey()) {
    console.log('[TinyFish] Fetch API key found, extracting brand website content...');
    const urlsToFetch = siteArchitecture.slice(0, 5);
    try {
      const fetchResponse = await fetchWebPages(urlsToFetch, { purpose: `Analyze brand voice and content for ${websiteUrl}` });
      const content = formatFetchedDocsToContext(websiteUrl, fetchResponse.results);
      return { brandVoice, siteArchitecture, content };
    } catch (e) {
      console.warn('[TinyFish] Fetch failed, falling back to snippets', e);
    }
  }

  const content = result.results.map(r => `## ${r.title}\n${r.snippet}`).join('\n\n');
  return { brandVoice, siteArchitecture, content };
};

export const extractManualReferencesTinyFish = async (
  query: string
): Promise<{ content: string; sources: string[] }> => {
  // If it's a direct URL being passed as query
  let urlsToFetch = [query];
  let sources = [query];
  let isDirectUrl = false;
  let normalizedQuery = query.trim();

  if (!normalizedQuery.startsWith('http://') && !normalizedQuery.startsWith('https://')) {
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/.*)?$/.test(normalizedQuery)) {
      normalizedQuery = `https://${normalizedQuery}`;
    }
  }

  try {
    new URL(normalizedQuery);
    isDirectUrl = true;
    urlsToFetch = [normalizedQuery];
    sources = [normalizedQuery];
  } catch (e) {}

  if (!isDirectUrl) {
    const result = await searchWeb(query, { purpose: 'research' });
    urlsToFetch = result.results.map(r => r.url);
    sources = urlsToFetch;
  }

  if (getTinyFishFetchApiKey() && urlsToFetch.length > 0) {
    console.log('[TinyFish] Fetch API key found, extracting manual references...');
    try {
      const fetchResponse = await fetchWebPages(urlsToFetch.slice(0, 3), { purpose: `Extract reference content for ${query}` });
      const content = formatFetchedDocsToContext(query, fetchResponse.results);
      return { content, sources };
    } catch (e) {
      console.warn('[TinyFish] Fetch failed, falling back to snippets if available', e);
    }
  }

  if (isDirectUrl) {
    return { content: `Could not fetch content for ${query}`, sources };
  }

  const result = await searchWeb(query);
  const content = result.results.map(r =>
    `### Reference: ${r.url}\n${r.snippet?.substring(0, 1000) || 'Content not available'}...`
  ).join('\n\n');
  
  return { content, sources: result.results.map(r => r.url) };
};
