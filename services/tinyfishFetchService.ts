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
  // Extract error message from various possible formats
  let msg = '';
  if (typeof body === 'string') {
    msg = body;
  } else if (body?.error) {
    msg = typeof body.error === 'object' ? JSON.stringify(body.error) : String(body.error);
  } else if (body?.message) {
    msg = typeof body.message === 'object' ? JSON.stringify(body.message) : String(body.message);
  } else if (body?.detail) {
    msg = typeof body.detail === 'object' ? JSON.stringify(body.detail) : String(body.detail);
  } else if (body?.errors) {
    msg = JSON.stringify(body.errors);
  } else {
    try { msg = JSON.stringify(body); } catch { msg = '[unparseable error]'; }
  }
  switch (status) {
    case 400: throw new Error(`TinyFish Fetch Bad Request (400): ${msg}`);
    case 401: throw new Error('TinyFish Fetch API Key is invalid (401).');
    case 403: throw new Error('TinyFish Fetch API Key lacks permission (403).');
    case 422: throw new Error(`TinyFish Fetch Validation Error (422): ${msg}`);
    case 429: throw new Error('TinyFish Fetch API rate limit exceeded (429).');
    case 500: throw new Error(`TinyFish Fetch server error (500): ${msg}`);
    case 502: throw new Error(`TinyFish Fetch bad gateway (502): ${msg}`);
    case 503: throw new Error('TinyFish Fetch service unavailable (503).');
    case 504: throw new Error('TinyFish Fetch gateway timeout (504).');
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

  const payload: Record<string, any> = {
    urls: targetUrls,
  };

  if (options.purpose) payload.purpose = options.purpose;
  if (options.format) payload.format = options.format;
  if (options.ttl !== undefined) payload.ttl = options.ttl;
  if (options.include_selectors) payload.include_selectors = options.include_selectors;
  if (options.exclude_selectors) payload.exclude_selectors = options.exclude_selectors;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const apiUrl = TINYFISH_FETCH_API_BASE + '/';
      console.log(`[TinyFish Fetch] Attempt ${attempt + 1}/${MAX_RETRIES + 1} - POST ${apiUrl}`);
      console.log(`[TinyFish Fetch] URLs: ${targetUrls.join(', ')}`);

      const response = await fetch(apiUrl, {
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

      console.log(`[TinyFish Fetch] Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const body = await response.json().catch(async () => {
          const text = await response.text().catch(() => '');
          return { rawText: text };
        });
        console.error(`[TinyFish Fetch] Error body:`, JSON.stringify(body));
        if (isRetryable(response.status) && attempt < MAX_RETRIES) {
          const delay = 1000 * Math.pow(2, attempt);
          console.warn(`[TinyFish Fetch] Retryable error, waiting ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        handleHttpError(response.status, body);
      }

      const data = await response.json();
      console.log(`[TinyFish Fetch] Response keys:`, Object.keys(data));
      console.log(`[TinyFish Fetch] results: ${data.results?.length || 0}, errors: ${data.errors?.length || 0}`);

      // Handle case where API returns results directly as array (not wrapped in object)
      if (Array.isArray(data)) {
        console.log('[TinyFish Fetch] Response is direct array, wrapping...');
        const results: FetchedDocument[] = data.map((item: any) => ({
          url: item.url || '',
          final_url: item.final_url,
          title: item.title,
          description: item.description,
          language: item.language,
          author: item.author,
          published_date: item.published_date,
          text: item.text || item.markdown || item.html,
          status: item.error ? 'error' : 'success',
          error: item.error,
        }));
        const total_success = results.filter(r => r.status === 'success').length;
        return { results, total_success, total_failed: results.length - total_success };
      }

      // Transform response to match FetchedDocument interface
      // Note: API does NOT return a 'status' field — we determine success by content presence
      const results: FetchedDocument[] = (data.results || []).map((item: any) => ({
        url: item.url || '',
        final_url: item.final_url,
        title: item.title,
        description: item.description,
        language: item.language,
        author: item.author,
        published_date: item.published_date,
        // API returns content in 'text' field regardless of format requested
        text: item.text || item.markdown || item.html,
        html: item.html,
        markdown: item.markdown,
        // Success = has content and no error
        status: item.error ? 'error' : (item.text || item.markdown || item.html) ? 'success' : 'error',
        error: item.error,
        latency_ms: item.latency_ms,
      }));

      // Handle per-URL failures from errors[] (per official docs)
      if (data.errors && Array.isArray(data.errors)) {
        for (const err of data.errors) {
          results.push({
            url: err.url || '',
            title: 'Fetch failed',
            status: 'error',
            error: typeof err.error === 'object' ? JSON.stringify(err.error) : String(err.error || 'Unknown error'),
          } as FetchedDocument);
        }
      }

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

/**
 * Debug: Get raw API response for inspection
 * Useful for troubleshooting response structure issues
 */
export const debugFetchRaw = async (url: string): Promise<any> => {
  const apiKey = getTinyFishFetchApiKey();
  if (!apiKey) {
    return { error: 'API key missing' };
  }

  const payload = { urls: [url], format: 'markdown' };

  const response = await fetch(TINYFISH_FETCH_API_BASE + '/', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log('[TinyFish Debug] Raw API Response:', JSON.stringify(data, null, 2));
  console.log('[TinyFish Debug] Top-level keys:', Object.keys(data));
  console.log('[TinyFish Debug] results type:', Array.isArray(data.results) ? 'array' : typeof data.results);
  console.log('[TinyFish Debug] results length:', data.results?.length);
  console.log('[TinyFish Debug] errors:', data.errors);
  console.log('[TinyFish Debug] First result keys:', data.results?.[0] ? Object.keys(data.results[0]) : 'no results');
  return data;
};

/**
 * Test the TinyFish Fetch API connection
 * Returns diagnostic information about the API status
 */
export const testFetchConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  const apiKey = getTinyFishFetchApiKey();
  if (!apiKey) {
    return { success: false, message: 'API key is missing. Add it in Settings.' };
  }

  try {
    // Try fetching a simple test URL
    const response = await fetchWebPages(
      ['https://example.com'],
      { purpose: 'research', format: 'markdown' },
      30000,
    );
    if (response.total_success > 0) {
      return { success: true, message: `Connection successful! Got ${response.total_success} result(s).`, details: response };
    } else if (response.total_failed > 0) {
      return {
        success: false,
        message: `API connected but ${response.total_failed} URL(s) failed. Check console for details.`,
        details: response,
      };
    } else {
      return {
        success: false,
        message: 'API returned empty response (no results, no errors). Response may have different structure.',
        details: response,
      };
    }
  } catch (err: any) {
    return { success: false, message: err.message, details: err };
  }
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
