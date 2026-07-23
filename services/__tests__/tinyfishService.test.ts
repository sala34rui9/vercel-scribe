import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem(key: string) { return this.store[key] || null; },
  setItem(key: string, value: string) { this.store[key] = value; },
  removeItem(key: string) { delete this.store[key]; },
  clear() { this.store = {}; },
};
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

vi.mock('localStorage', () => mockLocalStorage);

import {
  searchWeb,
  listSearchUsage,
  getTinyFishApiKey,
  fetchRealTimeDataTinyFish,
  scanForExternalLinksTinyFish,
  scanForInternalLinksTinyFish,
  analyzeBrandWebsiteTinyFish,
  extractManualReferencesTinyFish,
} from '../tinyfishService';

describe('getTinyFishApiKey', () => {
  beforeEach(() => mockLocalStorage.clear());

  it('returns key from localStorage', () => {
    mockLocalStorage.setItem('user_tinyfish_api_key', 'tfk-test123');
    expect(getTinyFishApiKey()).toBe('tfk-test123');
  });

  it('returns empty string when no key', () => {
    expect(getTinyFishApiKey()).toBe('');
  });

  it('trims whitespace', () => {
    mockLocalStorage.setItem('user_tinyfish_api_key', '  tfk-test  ');
    expect(getTinyFishApiKey()).toBe('tfk-test');
  });
});

describe('searchWeb', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.setItem('user_tinyfish_api_key', 'tfk-test123');
    mockFetch.mockReset();
  });

  afterEach(() => {
    mockFetch.mockReset();
    vi.useRealTimers();
  });

  it('successful request with query only', async () => {
    const mockResponse = {
      query: 'test query',
      results: [{ position: 1, title: 'Test', snippet: 'Snippet', site_name: 'example.com', url: 'https://example.com' }],
      total_results: 1,
      page: 1,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await searchWeb('test query');
    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain('https://api.search.tinyfish.ai/?query=test+query');
    expect(callArgs[1].headers['X-API-Key']).toBe('tfk-test123');
  });

  it('successful request with all optional parameters', async () => {
    const mockResponse = { query: 'test', results: [], total_results: 0, page: 1 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await searchWeb('test', {
      purpose: 'research',
      location: 'US',
      language: 'en',
      domain_type: 'include',
      after_date: '2024-01-01',
      before_date: '2024-12-31',
      recency_minutes: 60,
      page: 2,
      include_thumbnail: true,
      fetch: false,
    });

    expect(result).toEqual(mockResponse);
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('purpose=research');
    expect(url).toContain('location=US');
    expect(url).toContain('language=en');
    expect(url).toContain('domain_type=include');
    expect(url).toContain('after_date=2024-01-01');
    expect(url).toContain('before_date=2024-12-31');
    expect(url).toContain('recency_minutes=60');
    expect(url).toContain('page=2');
    expect(url).toContain('include_thumbnail=true');
    expect(url).toContain('fetch=false');
  });

  it('missing query throws error', async () => {
    await expect(searchWeb('')).rejects.toThrow('"query" parameter is required');
    await expect(searchWeb('   ')).rejects.toThrow('"query" parameter is required');
  });

  it('missing API key throws error', async () => {
    mockLocalStorage.clear();
    await expect(searchWeb('test')).rejects.toThrow('TinyFish API key is missing');
  });

  it('401 authentication failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    await expect(searchWeb('test')).rejects.toThrow('TinyFish API Key is invalid');
  });

  it('429 rate limit with retry', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limited' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ query: 'test', results: [], total_results: 0, page: 1 }),
      });

    const result = await searchWeb('test');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toBeDefined();
  });

  it('500 server error with retry', async () => {
    vi.useFakeTimers();
    const errorResponse = {
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal error' }),
    };
    mockFetch.mockReturnValue(errorResponse as any);

    const promise = searchWeb('test');
    await vi.advanceTimersByTimeAsync(10000);
    await expect(promise).rejects.toThrow('TinyFish server error');
    expect(mockFetch).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  }, 10000);

  it('timeout handling', async () => {
    mockFetch.mockImplementation((_url: any, options: any) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    await expect(searchWeb('test', {}, 50)).rejects.toThrow('timed out after 50ms');
  }, 10000);

  it('optional parameter serialization excludes undefined', async () => {
    const mockResponse = { query: 'test', results: [], total_results: 0, page: 1 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    await searchWeb('test', { purpose: 'research', location: undefined });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('purpose=research');
    expect(url).not.toContain('location');
  });
});

describe('listSearchUsage', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.setItem('user_tinyfish_api_key', 'tfk-test123');
    mockFetch.mockReset();
  });

  it('successful request', async () => {
    const mockResponse = { items: [], total: 0, limit: 10, page: 1, total_pages: 0, has_more: false };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await listSearchUsage();
    expect(result).toEqual(mockResponse);
    expect(mockFetch.mock.calls[0][0]).toContain('/usage');
  });

  it('with pagination params', async () => {
    const mockResponse = { items: [{ id: '1' }], total: 1, limit: 5, page: 2, total_pages: 1, has_more: false };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await listSearchUsage({ limit: 5, page: 2 });
    expect(result).toEqual(mockResponse);
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('limit=5');
    expect(url).toContain('page=2');
  });

  it('missing API key throws error', async () => {
    mockLocalStorage.clear();
    await expect(listSearchUsage()).rejects.toThrow('TinyFish API key is missing');
  });

  it('pagination response parsing', async () => {
    const mockResponse = {
      items: [{ id: '1' }, { id: '2' }],
      total: 25,
      limit: 10,
      page: 3,
      total_pages: 3,
      has_more: false,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await listSearchUsage({ limit: 10, page: 3 });
    expect(result.has_more).toBe(false);
    expect(result.total_pages).toBe(3);
    expect(result.items).toHaveLength(2);
  });
});

describe('fetchRealTimeDataTinyFish', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.setItem('user_tinyfish_api_key', 'tfk-test123');
    mockFetch.mockReset();
  });

  it('returns formatted content and sources', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        query: 'AI news',
        results: [
          { position: 1, title: 'AI Breakthrough', snippet: 'New AI model released', site_name: 'tech.com', url: 'https://tech.com/ai' },
        ],
        total_results: 1,
        page: 1,
      }),
    });

    const result = await fetchRealTimeDataTinyFish('AI news');
    expect(result.content).toContain('AI Breakthrough');
    expect(result.sources).toEqual(['https://tech.com/ai']);
  });
});

describe('scanForExternalLinksTinyFish', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.setItem('user_tinyfish_api_key', 'tfk-test123');
    mockFetch.mockReset();
  });

  it('returns external links with snippets', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        query: 'test authoritative sources research',
        results: Array.from({ length: 20 }, (_, i) => ({
          position: i + 1,
          title: `Result ${i + 1}`,
          snippet: `Snippet ${i + 1}`,
          site_name: 'example.com',
          url: `https://example.com/${i + 1}`,
        })),
        total_results: 20,
        page: 1,
      }),
    });

    const result = await scanForExternalLinksTinyFish('test');
    expect(result).toHaveLength(15);
    expect(result[0]).toHaveProperty('title');
    expect(result[0]).toHaveProperty('url');
    expect(result[0]).toHaveProperty('snippet');
  });
});

describe('scanForInternalLinksTinyFish', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.setItem('user_tinyfish_api_key', 'tfk-test123');
    mockFetch.mockReset();
  });

  it('filters results by domain', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        query: 'site:example.com test topic',
        results: [
          { position: 1, title: 'Internal Page', snippet: 'Content', site_name: 'example.com', url: 'https://example.com/page1' },
          { position: 2, title: 'External Page', snippet: 'Content', site_name: 'other.com', url: 'https://other.com/page' },
        ],
        total_results: 2,
        page: 1,
      }),
    });

    const result = await scanForInternalLinksTinyFish('https://example.com', 'test topic');
    expect(result.links).toHaveLength(1);
    expect(result.links[0].url).toBe('https://example.com/page1');
    expect(result.opportunities).toEqual([]);
  });

  it('handles invalid URL gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        query: 'site:notaurl test',
        results: [],
        total_results: 0,
        page: 1,
      }),
    });

    const result = await scanForInternalLinksTinyFish('notaurl', 'test');
    expect(result.links).toEqual([]);
  });
});

describe('analyzeBrandWebsiteTinyFish', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.setItem('user_tinyfish_api_key', 'tfk-test123');
    mockFetch.mockReset();
  });

  it('returns brand analysis', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        query: 'https://brand.com',
        results: [
          { position: 1, title: 'Home', snippet: 'Welcome to brand', site_name: 'brand.com', url: 'https://brand.com/' },
          { position: 2, title: 'About', snippet: 'About us', site_name: 'brand.com', url: 'https://brand.com/about' },
        ],
        total_results: 2,
        page: 1,
      }),
    });

    const result = await analyzeBrandWebsiteTinyFish('https://brand.com');
    expect(result.brandVoice).toContain('brand.com');
    expect(result.siteArchitecture).toEqual(['https://brand.com/', 'https://brand.com/about']);
    expect(result.content).toContain('Home');
  });

  it('returns empty for no results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ query: 'https://empty.com', results: [], total_results: 0, page: 1 }),
    });

    const result = await analyzeBrandWebsiteTinyFish('https://empty.com');
    expect(result).toEqual({ brandVoice: '', siteArchitecture: [], content: '' });
  });
});

describe('extractManualReferencesTinyFish', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.setItem('user_tinyfish_api_key', 'tfk-test123');
    mockFetch.mockReset();
  });

  it('returns formatted references', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        query: 'reference query',
        results: [
          { position: 1, title: 'Ref', snippet: 'Reference content here', site_name: 'ref.com', url: 'https://ref.com/article' },
        ],
        total_results: 1,
        page: 1,
      }),
    });

    const result = await extractManualReferencesTinyFish('reference query');
    expect(result.content).toContain('https://ref.com/article');
    expect(result.content).toContain('Reference content');
    expect(result.sources).toEqual(['https://ref.com/article']);
  });
});
