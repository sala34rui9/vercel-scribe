# TinyFish Search API Integration

## Goal

Add TinyFish as a Research/Scanning Provider option alongside Tavily when DeepSeek is selected. Implement full pipeline integration: raw API client (`searchWeb` + `listSearchUsage`), high-level wrappers, UI changes, and unit tests.

## Architecture Decisions

- **API key storage**: Follow existing pattern — `localStorage` key `user_tinyfish_api_key` (consistent with `user_tavily_api_key`, `user_deepseek_api_key`)
- **HTTP client**: Native `fetch()` (consistent with all other services)
- **Retry logic**: Exponential backoff for 429/500/503 (matching Gemini service pattern)
- **Test framework**: Vitest (natural fit for Vite project, zero-config)
- **Default behavior**: When DeepSeek is selected, Tavily remains default; TinyFish is an additional selectable option

## Files to Create

1. `services/tinyfishService.ts` — API client + high-level wrappers
2. `services/__tests__/tinyfishService.test.ts` — Unit tests
3. `vitest.config.ts` — Test runner config

## Files to Modify

1. `types.ts` — Add `TINYFISH` to `SearchProvider` enum
2. `components/ArticleForm.tsx` — Add TinyFish option in DeepSeek Research/Scanning Provider UI; update forcing logic
3. `components/Layout.tsx` — Add TinyFish API key input in settings modal
4. `App.tsx` — Add TinyFish routing in bulk optimization pipeline (internal/external links, brand research, real-time data)

## Implementation Steps

### Step 1: Add TINYFISH to SearchProvider enum

In `types.ts`, add to the `SearchProvider` enum:
```typescript
TINYFISH = "TinyFish"
```

### Step 2: Create `services/tinyfishService.ts`

#### Types & Interfaces

```typescript
// Request types
interface SearchWebParams {
  query: string;
  purpose?: string;
  location?: string;
  language?: string;
  domain_type?: string;
  after_date?: string;
  before_date?: string;
  recency_minutes?: number;
  page?: number;
  include_thumbnail?: boolean;
  fetch?: boolean;
}

interface ListSearchUsageParams {
  start_after?: string;
  end_before?: string;
  status?: string;
  limit?: number;
  page?: number;
}

// Response types
interface SearchResult {
  position: number;
  title: string;
  snippet: string;
  site_name: string;
  url: string;
}

interface SearchWebResponse {
  query: string;
  results: SearchResult[];
  total_results: number;
  page: number;
}

interface SearchUsageResponse {
  items: any[];
  total: number;
  limit: number;
  page: number;
  total_pages: number;
  has_more: boolean;
}
```

#### API Key Management

```typescript
const LOCAL_STORAGE_KEY = 'user_tinyfish_api_key';

export const getTinyFishApiKey = (): string => {
  const key = localStorage.getItem(LOCAL_STORAGE_KEY);
  return key?.trim() || '';
};
```

#### HTTP Client with Retry

```typescript
const TINYFISH_API_BASE = 'https://api.search.tinyfish.ai';
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryable = (status: number) => [429, 500, 503].includes(status);

const handleHttpError = (status: number, body: any) => {
  const msg = body?.error || body?.message || '';
  switch (status) {
    case 400: throw new Error(`TinyFish Bad Request: ${msg}`);
    case 401: throw new Error('TinyFish API Key is invalid. Check your API key.');
    case 403: throw new Error('TinyFish API Key lacks permission for this operation.');
    case 404: throw new Error('TinyFish API endpoint not found.');
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
```

#### `searchWeb()` Function

```typescript
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
```

#### `listSearchUsage()` Function

```typescript
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
```

#### High-Level Wrappers (matching Tavily interface)

```typescript
// Real-time data (matches fetchRealTimeDataTavily signature)
export const fetchRealTimeDataTinyFish = async (topic: string): Promise<{ content: string; sources: string[] }> => {
  const result = await searchWeb(topic, { purpose: 'research' });
  const content = result.results.map(r => `- **${r.title}**: ${r.snippet}`).join('\n');
  const sources = result.results.map(r => r.url).filter(Boolean);
  return { content, sources };
};

// External link scanning (matches scanForExternalLinksTavily signature)
export const scanForExternalLinksTinyFish = async (
  topic: string,
  excludeDomain?: string
): Promise<Array<{ title: string; url: string; snippet?: string }>> => {
  const result = await searchWeb(`${topic} authoritative sources research`, {
    purpose: 'research',
    domain_type: excludeDomain ? 'exclude' : undefined
  });
  return result.results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet?.substring(0, 150) || 'External source'
  })).slice(0, 15);
};

// Internal link scanning (matches scanForInternalLinksTavily signature)
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

  const result = await searchWeb(`site:${domain} ${topic}`, { purpose: 'research' });
  const cleanDomain = domain.replace(/^www\./, '');
  const links = result.results
    .filter(r => r.url.includes(cleanDomain))
    .map(r => ({ title: r.title, url: r.url, snippet: r.snippet?.substring(0, 150) }));

  return { links, opportunities: [] };
};

// Brand website analysis (matches analyzeBrandWebsite signature)
export const analyzeBrandWebsiteTinyFish = async (
  websiteUrl: string
): Promise<{ brandVoice: string; siteArchitecture: string[]; content: string }> => {
  const result = await searchWeb(websiteUrl, {
    purpose: 'brand_analysis',
    fetch: true
  });

  if (!result.results.length) {
    return { brandVoice: '', siteArchitecture: [], content: '' };
  }

  const siteArchitecture = result.results.map(r => r.url);
  const content = result.results.map(r => `## ${r.title}\n${r.snippet}`).join('\n\n');
  const brandVoice = `Based on site analysis of ${websiteUrl}`;

  return { brandVoice, siteArchitecture, content };
};

// Manual reference extraction (matches extractManualReferences signature)
export const extractManualReferencesTinyFish = async (
  query: string
): Promise<{ content: string; sources: string[] }> => {
  const result = await searchWeb(query, { purpose: 'research' });
  const content = result.results.map(r =>
    `### Reference: ${r.url}\n${r.snippet?.substring(0, 1000) || 'Content not available'}...`
  ).join('\n\n');
  const sources = result.results.map(r => r.url);
  return { content, sources };
};
```

### Step 3: Update `components/ArticleForm.tsx`

#### Add TinyFish to Research/Scanning Provider UI (DeepSeek section)

Replace the disabled Tavily-only button (lines 746-761) with a grid showing both Tavily and TinyFish:

```tsx
<div className="mt-3 pt-3 border-t border-indigo-200">
  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Research/Scanning Provider</label>
  <div className="grid grid-cols-2 gap-2">
    <button
      type="button"
      onClick={() => setResearchProvider(SearchProvider.TAVILY)}
      className={`text-xs py-2 px-2 rounded border flex items-center justify-center ${
        researchProvider === SearchProvider.TAVILY
          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Search className="w-3 h-3 mr-1.5" />
      Tavily
    </button>
    <button
      type="button"
      onClick={() => setResearchProvider(SearchProvider.TINYFISH)}
      className={`text-xs py-2 px-2 rounded border flex items-center justify-center ${
        researchProvider === SearchProvider.TINYFISH
          ? 'bg-cyan-50 border-cyan-300 text-cyan-700 font-bold'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Fish className="w-3 h-3 mr-1.5" />
      TinyFish
    </button>
  </div>
  <p className="text-[10px] text-slate-400 mt-1">
    *DeepSeek requires a web scanning provider. Choose Tavily or TinyFish.
  </p>
</div>
```

#### Update forcing logic (lines 164-169)

Change from forcing Tavily to allowing either Tavily or TinyFish:

```typescript
useEffect(() => {
  if (provider === AIProvider.DEEPSEEK &&
      researchProvider !== SearchProvider.TAVILY &&
      researchProvider !== SearchProvider.TINYFISH) {
    setResearchProvider(SearchProvider.TAVILY);
  }
}, [provider, researchProvider]);
```

#### Add Fish icon import

Add `Fish` to the lucide-react import.

### Step 4: Update `components/Layout.tsx`

Add TinyFish API key section in the settings modal (after Tavily section, before the save button):

```tsx
{/* TinyFish Section */}
<div className="space-y-2 pt-2 border-t border-slate-100">
  <label className="flex items-center text-sm font-semibold text-slate-700">
    <Fish className="w-4 h-4 mr-1.5 text-cyan-500" />
    TinyFish API Key
  </label>
  <div className="flex gap-2">
    <input
      type="password"
      value={tinyfishKey}
      onChange={(e) => setTinyfishKey(e.target.value)}
      placeholder="tfk-..."
      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm font-mono"
    />
    {hasTinyfishKey && (
      <button onClick={clearTinyfish} className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200">Clear</button>
    )}
  </div>
  <p className="text-xs text-slate-400">Required for TinyFish web research provider</p>
</div>
```

Add state and handlers for `tinyfishKey`, `hasTinyfishKey`, `setTinyfishKey`, `clearTinyfish`.

Add `Fish` to lucide-react import.

### Step 5: Update `App.tsx`

Add TinyFish routing alongside existing Tavily/Gemini logic in the bulk optimization pipeline:

```typescript
// Internal links
if (config.provider === AIProvider.DEEPSEEK && config.researchProvider === SearchProvider.TAVILY) {
  // existing Tavily path
} else if (config.provider === AIProvider.DEEPSEEK && config.researchProvider === SearchProvider.TINYFISH) {
  const tinyfishResult = await scanForInternalLinksTinyFish(config.websiteUrl, config.queueTopics?.[0] || 'general');
  cachedInternalLinks = tinyfishResult.links;
}

// External links — add TinyFish branch
// Brand research — add TinyFish branch
// Real-time data — add TinyFish branch
```

Import the new TinyFish wrapper functions.

### Step 6: Create `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [nodePolyfills()],
  test: {
    environment: 'node',
    include: ['services/__tests__/**/*.test.ts'],
  },
});
```

### Step 7: Add test script to `package.json`

```json
"test": "vitest"
```

### Step 8: Create `services/__tests__/tinyfishService.test.ts`

Test cases:
- `searchWeb` successful request with query only
- `searchWeb` with all optional parameters
- `searchWeb` missing query throws error
- `searchWeb` missing API key throws error
- `searchWeb` 401 authentication failure
- `searchWeb` 429 rate limit with retry
- `searchWeb` 500 server error with retry
- `searchWeb` timeout handling
- `listSearchUsage` successful request
- `listSearchUsage` with pagination params
- `listSearchUsage` missing API key throws error
- Optional parameter serialization (only provided params included)
- Pagination response parsing

## Validation

1. `npm run dev` — App loads without errors
2. Select DeepSeek → Research/Scanning Provider shows Tavily + TinyFish buttons
3. Select TinyFish → persists to localStorage as `seo_scribe_research_provider`
4. API key modal shows TinyFish input → saves to `user_tinyfish_api_key`
5. `npm test` — All unit tests pass
6. `npm run build` — Production build succeeds

## Risks

- TinyFish API may have rate limits or response format differences from spec — wrapper functions should handle gracefully with fallbacks
- The `fetch` parameter in `searchWeb` may trigger full page fetching — document this for users
- `vite-plugin-node-polyfills` already configured, so `AbortController`, `URL`, etc. should work in tests
