export const TINYFISH_FETCH_API_BASE = 'https://api.fetch.tinyfish.ai';
export const LOCAL_STORAGE_FETCH_KEY = 'user_tinyfish_fetch_api_key';
const DEFAULT_TIMEOUT = 60000;
const MAX_RETRIES = 2;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryable = (status: number) => [429, 500, 502, 503, 504].includes(status);

export interface FetchOptions {
  purpose: string;
  format?: 'markdown' | 'html' | 'text';
  links?: boolean;
  image_links?: boolean;
  ttl?: number;
  per_url_timeout_ms?: number;
  include_selectors?: string[];
  exclude_selectors?: string[];
}

export interface FetchedDocument {
  url: string;
  final_url?: string;
  title?: string;
  description?: string;
  language?: string;
  author?: string;
  published_date?: string;
  markdown?: string;
  html?: string;
  text?: string;
  status: 'success' | 'error';
  error?: string;
  latency_ms?: number;
}

export interface FetchResponse {
  results: FetchedDocument[];
  total_success: number;
  total_failed: number;
}

export interface FetchUsageResponse {
  items: any[];
  total: number;
  limit: number;
  page: number;
  total_pages: number;
  has_more: boolean;
}

export const getTinyFishFetchApiKey = (): string => {
  const key = localStorage.getItem(LOCAL_STORAGE_FETCH_KEY);
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
    case 400: throw new Error(`TinyFish Fetch Bad Request: ${msg}`);
    case 401: throw new Error('TinyFish Fetch API Key is invalid.');
    case 403: throw new Error('TinyFish Fetch API Key lacks permission.');
    case 422: throw new Error(`TinyFish Fetch Validation Error: ${msg}`);
    case 429: throw new Error('TinyFish Fetch API rate limit exceeded.');
    case 500: throw new Error(`TinyFish Fetch server error: ${msg}`);
    case 503: throw new Error('TinyFish Fetch service unavailable.');
    default: throw new Error(`TinyFish Fetch API Error (${status}): ${msg}`);
  }
};

export const fetchWebPages = async (
  urls: string[],
  options: FetchOptions,
  timeout: number = DEFAULT_TIMEOUT
): Promise<FetchResponse> => {
  if (!urls || urls.length === 0) {
    return { results: [], total_success: 0, total_failed: 0 };
  }

  // Normalize URLs and limit to 10
  const targetUrls = urls
    .slice(0, 10)
    .map(url => {
      let trimmed = url.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return `https://${trimmed}`;
      }
      return trimmed;
    });

  const apiKey = getTinyFishFetchApiKey();
  
  if (!apiKey) {
    throw new Error('TinyFish Fetch API key is missing.');
  }

  const payload = {
    urls: targetUrls,
    purpose: options.purpose,
    format: options.format ?? 'markdown',
    links: options.links ?? false,
    image_links: options.image_links ?? false,
    ttl: options.ttl ?? 300,
    per_url_timeout_ms: options.per_url_timeout_ms ?? 45000,
    include_selectors: options.include_selectors,
    exclude_selectors: options.exclude_selectors ?? ['.comments', '.related-posts', '.newsletter', '.ads', '.sidebar', '.footer', '.navigation'],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(TINYFISH_FETCH_API_BASE + '/', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (isRetryable(response.status) && attempt < MAX_RETRIES) {
          const delay = 1000 * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
        handleHttpError(response.status, body);
      }

      const data = await response.json();
      
      // Transform response to match FetchedDocument interface
      const results: FetchedDocument[] = data.results || [];
      const total_success = results.filter(r => r.status === 'success' && !r.error).length;
      const total_failed = results.length - total_success;

      return { results, total_success, total_failed };
    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;
      if (error.name === 'AbortError') {
        throw new Error(`TinyFish Fetch request timed out after ${timeout}ms`);
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
};

export const listFetchUsage = async (
  page: number = 1,
  limit: number = 50
): Promise<FetchUsageResponse> => {
  const apiKey = getTinyFishFetchApiKey();
  if (!apiKey) {
    throw new Error('TinyFish Fetch API key is missing.');
  }

  const url = new URL(`${TINYFISH_FETCH_API_BASE}/usage`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    handleHttpError(response.status, body);
  }

  return response.json();
};
