import React, { useState, useCallback, useRef } from 'react';
import {
  FlaskConical,
  Check,
  X,
  Clock,
  SkipForward,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Play,
  Loader2,
  Terminal,
  Send,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { getGeminiApiKey } from '../services/geminiService';
import { getTavilyApiKey } from '../services/tavilyService';
import { getTinyFishApiKey } from '../services/tinyfishService';
import { getTinyFishFetchApiKey } from '../services/tinyfishFetchService';

type TestStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped';

interface TestError {
  message: string;
  statusCode: number | null;
  responseBody: string | null;
  requestDetails: {
    url: string;
    method: string;
    body: string;
  };
  possibleCauses: string[];
}

interface TestResult {
  id: string;
  name: string;
  category: string;
  status: TestStatus;
  duration: number | null;
  error: TestError | null;
  timestamp: number | null;
}

interface TestDefinition {
  id: string;
  name: string;
  category: string;
  requiredKeys: string[];
  runInBatch: boolean;
  test: () => Promise<void>;
}

const TIMEOUT_MS = 15000;

const hasKey = (key: string): boolean => !!localStorage.getItem(key)?.trim();

const getKeyValue = (key: string): string => localStorage.getItem(key)?.trim() || '';

const getPossibleCauses = (statusCode: number | null, message: string): string[] => {
  const causes: string[] = [];

  if (statusCode === 401) {
    causes.push('API key is missing, invalid, or expired');
    causes.push('Verify the key in Admin > API Keys tab');
    causes.push('Check if the key has been revoked by the provider');
  } else if (statusCode === 403) {
    causes.push('Access forbidden — key may lack required permissions');
    causes.push('The API key may be restricted to specific IP addresses or regions');
    causes.push('Check if the key has the required plan/subscription level');
  } else if (statusCode === 402) {
    causes.push('Payment required — account may have insufficient credits');
    causes.push('Check your billing status with the API provider');
  } else if (statusCode === 429) {
    causes.push('Rate limit exceeded — too many requests in a short period');
    causes.push('Wait 60 seconds before retrying');
    causes.push('Consider upgrading your API plan for higher limits');
  } else if (statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
    causes.push('The upstream API server is experiencing issues');
    causes.push('This is typically a temporary problem — try again later');
    causes.push('Check the provider\'s status page for outage reports');
  } else if (statusCode === 404) {
    causes.push('The API endpoint was not found');
    causes.push('The URL may have changed — check provider documentation');
  } else if (message.includes('timeout') || message.includes('Timeout') || message.includes('aborted')) {
    causes.push('The request timed out — the API may be slow or unreachable');
    causes.push('Check your internet connection');
    causes.push('The server may be experiencing high traffic');
  } else if (message.includes('Network') || message.includes('network') || message.includes('Failed to fetch') || message.includes('fetch')) {
    causes.push('Network error — cannot reach the API');
    causes.push('Check your internet connection');
    causes.push('A CORS policy may be blocking the request (for direct browser calls)');
    causes.push('A firewall or VPN may be interfering');
  } else if (message.includes('JSON') || message.includes('parse')) {
    causes.push('The API returned an unexpected response format');
    causes.push('The endpoint may be down or returning HTML error pages');
    causes.push('A proxy or firewall may be intercepting the request');
  }

  if (causes.length === 0) {
    causes.push('An unexpected error occurred');
    causes.push('Check the response body below for more details');
    causes.push('Verify the API endpoint and parameters are correct');
  }

  return causes;
};

export const ApiTestPanel: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'AI Providers': true,
    'Search & SEO': true,
    'Backend Functions (Supabase)': true,
  });
  const [expandedDebug, setExpandedDebug] = useState<Record<string, boolean>>({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const abortRef = useRef(false);

  const createTestResult = (def: TestDefinition): TestResult => ({
    id: def.id,
    name: def.name,
    category: def.category,
    status: 'idle',
    duration: null,
    error: null,
    timestamp: null,
  });

  const getTestDefinitions = useCallback((): TestDefinition[] => {
    return [
      {
        id: 'gemini',
        name: 'Google Gemini',
        category: 'AI Providers',
        requiredKeys: ['user_gemini_api_key'],
        runInBatch: true,
        test: async () => {
          const apiKey = getGeminiApiKey();
          if (!apiKey) throw Object.assign(new Error('No API key configured'), { statusCode: null });
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Say hello' }] }] }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (!res.ok) {
            const body = await res.text();
            throw Object.assign(new Error(`Gemini API returned ${res.status}: ${body.slice(0, 200)}`), { statusCode: res.status, responseBody: body });
          }
        },
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        category: 'AI Providers',
        requiredKeys: ['user_deepseek_api_key'],
        runInBatch: true,
        test: async () => {
          const apiKey = getKeyValue('user_deepseek_api_key');
          if (!apiKey) throw Object.assign(new Error('No API key configured'), { statusCode: null });
          const url = 'https://deepseek-proxy.ubantuplx.workers.dev/v1/chat/completions';
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'Say hello' }], max_tokens: 10 }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (!res.ok) {
            const body = await res.text();
            throw Object.assign(new Error(`DeepSeek API returned ${res.status}: ${body.slice(0, 200)}`), { statusCode: res.status, responseBody: body });
          }
        },
      },
      {
        id: 'bynara',
        name: 'Bynara',
        category: 'AI Providers',
        requiredKeys: ['user_bynara_api_key'],
        runInBatch: true,
        test: async () => {
          const apiKey = getKeyValue('user_bynara_api_key');
          if (!apiKey) throw Object.assign(new Error('No API key configured'), { statusCode: null });
          const { data, error } = await supabase.functions.invoke('bynara-proxy', {
            body: { apiKey, payload: { model: 'mistral-large', messages: [{ role: 'user', content: 'Say hello' }], max_tokens: 10 } },
          });
          if (error) {
            const msg = error.message || 'Bynara proxy error';
            throw Object.assign(new Error(msg), { statusCode: 500 });
          }
          if (data && (data as any).error) {
            throw Object.assign(new Error((data as any).error.message || 'Bynara returned error'), { statusCode: 500 });
          }
        },
      },
      {
        id: 'cloudflare',
        name: 'Cloudflare Images',
        category: 'AI Providers',
        requiredKeys: ['user_cloudflare_api_url', 'user_cloudflare_api_token'],
        runInBatch: true,
        test: async () => {
          const accountId = getKeyValue('user_cloudflare_api_url');
          const token = getKeyValue('user_cloudflare_api_token');
          if (!accountId || !token) throw Object.assign(new Error('Cloudflare Account ID or API Token missing'), { statusCode: null });
          let cleanAccountId = accountId;
          const match = accountId.match(/\/accounts\/([^/]+)/);
          if (match) cleanAccountId = match[1];
          const { data, error } = await supabase.functions.invoke('generate-image', {
            body: { accountId: cleanAccountId, apiToken: token, modelId: '@cf/black-forest-labs/flux-1-schnell', requestBody: { prompt: 'A simple test image', num_steps: 4 } },
          });
          if (error) {
            throw Object.assign(new Error(error.message || 'Cloudflare image generation failed'), { statusCode: 500 });
          }
          if (data && (data as any).error) {
            const errStr = typeof (data as any).error === 'string' ? (data as any).error : (data as any).error.message;
            throw Object.assign(new Error(errStr || 'Cloudflare returned error'), { statusCode: 500, responseBody: JSON.stringify(data) });
          }
        },
      },
      {
        id: 'tavily',
        name: 'Tavily Search',
        category: 'Search & SEO',
        requiredKeys: ['user_tavily_api_key'],
        runInBatch: true,
        test: async () => {
          const apiKey = getTavilyApiKey();
          if (!apiKey) throw Object.assign(new Error('No API key configured'), { statusCode: null });
          const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ query: 'test', max_results: 1, search_depth: 'basic' }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (!res.ok) {
            const body = await res.text();
            throw Object.assign(new Error(`Tavily API returned ${res.status}: ${body.slice(0, 200)}`), { statusCode: res.status, responseBody: body });
          }
        },
      },
      {
        id: 'tinyfish-search',
        name: 'TinyFish Search',
        category: 'Search & SEO',
        requiredKeys: ['user_tinyfish_api_key'],
        runInBatch: true,
        test: async () => {
          const apiKey = getTinyFishApiKey();
          if (!apiKey) throw Object.assign(new Error('No API key configured'), { statusCode: null });
          const res = await fetch('https://api.search.tinyfish.ai/v1/search?query=test&limit=1', {
            method: 'GET',
            headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (!res.ok) {
            const body = await res.text();
            throw Object.assign(new Error(`TinyFish Search returned ${res.status}: ${body.slice(0, 200)}`), { statusCode: res.status, responseBody: body });
          }
        },
      },
      {
        id: 'tinyfish-fetch',
        name: 'TinyFish Fetch',
        category: 'Search & SEO',
        requiredKeys: ['user_tinyfish_fetch_api_key'],
        runInBatch: true,
        test: async () => {
          const apiKey = getTinyFishFetchApiKey();
          if (!apiKey) throw Object.assign(new Error('No API key configured'), { statusCode: null });
          const res = await fetch('https://api.fetch.tinyfish.ai/v1/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
            body: JSON.stringify({ urls: ['https://example.com'], format: 'markdown' }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (!res.ok) {
            const body = await res.text();
            throw Object.assign(new Error(`TinyFish Fetch returned ${res.status}: ${body.slice(0, 200)}`), { statusCode: res.status, responseBody: body });
          }
        },
      },
      {
        id: 'se-ranking',
        name: 'SE Ranking',
        category: 'Search & SEO',
        requiredKeys: ['user_se_ranking_api_key'],
        runInBatch: true,
        test: async () => {
          const seRankingKey = getKeyValue('user_se_ranking_api_key');
          if (!seRankingKey) throw Object.assign(new Error('No API key configured'), { statusCode: null });
          const { data, error } = await supabase.functions.invoke('fetch-seo-data', {
            body: { targetDomain: 'example.com', seRankingKey },
          });
          if (error) {
            throw Object.assign(new Error(error.message || 'SE Ranking fetch failed'), { statusCode: 500 });
          }
          if (data && (data as any).error) {
            throw Object.assign(new Error((data as any).error.message || 'SE Ranking returned error'), { statusCode: 500 });
          }
        },
      },
      {
        id: 'extract-keywords',
        name: 'extract-keywords',
        category: 'Backend Functions (Supabase)',
        requiredKeys: [],
        runInBatch: true,
        test: async () => {
          const { data, error } = await supabase.functions.invoke('extract-keywords', {
            body: { topic: 'test topic', aiProvider: 'gemini', keywordType: 'primary' },
          });
          if (error) {
            throw Object.assign(new Error(error.message || 'Edge function error'), { statusCode: 500 });
          }
          if (data && (data as any).error) {
            throw Object.assign(new Error((data as any).error || 'Function returned error'), { statusCode: 500 });
          }
        },
      },
      {
        id: 'scan-links',
        name: 'scan-links',
        category: 'Backend Functions (Supabase)',
        requiredKeys: [],
        runInBatch: true,
        test: async () => {
          const { data, error } = await supabase.functions.invoke('scan-links', {
            body: { scanType: 'internal', websiteUrl: 'https://example.com', topic: 'test' },
          });
          if (error) {
            throw Object.assign(new Error(error.message || 'Edge function error'), { statusCode: 500 });
          }
          if (data && (data as any).error) {
            throw Object.assign(new Error((data as any).error || 'Function returned error'), { statusCode: 500 });
          }
        },
      },
      {
        id: 'generate-article',
        name: 'generate-article',
        category: 'Backend Functions (Supabase)',
        requiredKeys: [],
        runInBatch: false,
        test: async () => {
          const { data, error } = await supabase.functions.invoke('generate-article', {
            body: { mode: 'single', topic: 'Test article', type: 'Blog Post', tone: 'Professional', wordCount: 100, provider: 'gemini', autoOptimize: false, imageCount: 0 },
          });
          if (error) {
            throw Object.assign(new Error(error.message || 'Edge function error'), { statusCode: 500 });
          }
          if (data && (data as any).error) {
            throw Object.assign(new Error((data as any).error || 'Function returned error'), { statusCode: 500 });
          }
        },
      },
      {
        id: 'fetch-seo-data',
        name: 'fetch-seo-data',
        category: 'Backend Functions (Supabase)',
        requiredKeys: [],
        runInBatch: true,
        test: async () => {
          const { data, error } = await supabase.functions.invoke('fetch-seo-data', {
            body: { targetDomain: 'example.com' },
          });
          if (error) {
            throw Object.assign(new Error(error.message || 'Edge function error'), { statusCode: 500 });
          }
          if (data && (data as any).error) {
            throw Object.assign(new Error((data as any).error || 'Function returned error'), { statusCode: 500 });
          }
        },
      },
      {
        id: 'bynara-proxy',
        name: 'bynara-proxy',
        category: 'Backend Functions (Supabase)',
        requiredKeys: [],
        runInBatch: false,
        test: async () => {
          const apiKey = getKeyValue('user_bynara_api_key');
          if (!apiKey) throw Object.assign(new Error('No Bynara API key configured — add it in Admin > API Keys'), { statusCode: null });
          const { data, error } = await supabase.functions.invoke('bynara-proxy', {
            body: { apiKey, payload: { model: 'mistral-large', messages: [{ role: 'user', content: 'Say hello' }], max_tokens: 10 } },
          });
          if (error) {
            throw Object.assign(new Error(error.message || 'Edge function error'), { statusCode: 500 });
          }
          if (data && (data as any).error) {
            throw Object.assign(new Error((data as any).error.message || 'Bynara returned error'), { statusCode: 500 });
          }
        },
      },
      {
        id: 'generate-image',
        name: 'generate-image',
        category: 'Backend Functions (Supabase)',
        requiredKeys: [],
        runInBatch: false,
        test: async () => {
          const accountId = getKeyValue('user_cloudflare_api_url');
          const token = getKeyValue('user_cloudflare_api_token');
          if (!accountId || !token) throw Object.assign(new Error('Cloudflare credentials not configured — add them in Admin > API Keys'), { statusCode: null });
          let cleanAccountId = accountId;
          const match = accountId.match(/\/accounts\/([^/]+)/);
          if (match) cleanAccountId = match[1];
          const { data, error } = await supabase.functions.invoke('generate-image', {
            body: { accountId: cleanAccountId, apiToken: token, modelId: '@cf/black-forest-labs/flux-1-schnell', requestBody: { prompt: 'A simple test', num_steps: 4 } },
          });
          if (error) {
            throw Object.assign(new Error(error.message || 'Edge function error'), { statusCode: 500 });
          }
          if (data && (data as any).error) {
            throw Object.assign(new Error((data as any).error.message || 'Cloudflare returned error'), { statusCode: 500 });
          }
        },
      },
      {
        id: 'wayback-proxy',
        name: 'wayback-proxy',
        category: 'Backend Functions (Supabase)',
        requiredKeys: [],
        runInBatch: true,
        test: async () => {
          const { data, error } = await supabase.functions.invoke('wayback-proxy', {
            body: { url: 'https://example.com' },
          });
          if (error) {
            throw Object.assign(new Error(error.message || 'Edge function error'), { statusCode: 500 });
          }
          if (data && (data as any).error) {
            throw Object.assign(new Error((data as any).error || 'Function returned error'), { statusCode: 500 });
          }
        },
      },
    ];
  }, []);

  const runSingleTest = useCallback(async (def: TestDefinition, currentResults: TestResult[]): Promise<TestResult> => {
    const existing = currentResults.find(r => r.id === def.id);
    const base = existing || createTestResult(def);

    if (def.requiredKeys.length > 0 && !def.requiredKeys.every(hasKey)) {
      const missingKeys = def.requiredKeys.filter(k => !hasKey(k));
      return {
        ...base,
        status: 'skipped',
        duration: null,
        timestamp: Date.now(),
        error: {
          message: `No API key configured — add it in Admin > API Keys`,
          statusCode: null,
          responseBody: null,
          requestDetails: { url: '', method: '', body: JSON.stringify({ missingKeys }) },
          possibleCauses: [`Missing required key(s): ${missingKeys.map(k => k.replace('user_', '').replace('_api_key', '')).join(', ')}`, 'Go to Admin > API Keys tab to add the required credentials'],
        },
      };
    }

    const startTime = performance.now();
    try {
      await def.test();
      const duration = performance.now() - startTime;
      return {
        ...base,
        status: 'passed',
        duration,
        timestamp: Date.now(),
        error: null,
      };
    } catch (err: any) {
      const duration = performance.now() - startTime;
      const statusCode = err.statusCode || null;
      const responseBody = err.responseBody || null;
      const message = err.message || 'Unknown error';

      let requestUrl = '';
      let requestMethod = 'POST';
      let requestBody = '';

      if (def.id === 'gemini') { requestUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'; }
      else if (def.id === 'deepseek') requestUrl = 'https://deepseek-proxy.ubantuplx.workers.dev/v1/chat/completions';
      else if (def.id === 'tavily') requestUrl = 'https://api.tavily.com/search';
      else if (def.id === 'tinyfish-search') { requestUrl = 'https://api.search.tinyfish.ai/v1/search?query=test&limit=1'; requestMethod = 'GET'; }
      else if (def.id === 'tinyfish-fetch') requestUrl = 'https://api.fetch.tinyfish.ai/v1/fetch';
      else requestUrl = `supabase.functions.invoke('${def.id}')`;

      try {
        requestBody = JSON.stringify(JSON.parse(err.responseBody || '{}'), null, 2);
      } catch {
        requestBody = err.responseBody || JSON.stringify({ error: message });
      }

      return {
        ...base,
        status: 'failed',
        duration,
        timestamp: Date.now(),
        error: {
          message,
          statusCode,
          responseBody,
          requestDetails: { url: requestUrl, method: requestMethod, body: requestBody },
          possibleCauses: getPossibleCauses(statusCode, message),
        },
      };
    }
  }, []);

  const runTest = useCallback(async (testId: string) => {
    const defs = getTestDefinitions();
    const def = defs.find(d => d.id === testId);
    if (!def) return;

    setResults(prev => {
      const existing = prev.find(r => r.id === testId);
      if (existing) {
        return prev.map(r => r.id === testId ? { ...r, status: 'running' as TestStatus, error: null } : r);
      }
      return [...prev, { ...createTestResult(def), status: 'running' as TestStatus }];
    });

    const result = await runSingleTest(def, results);
    setResults(prev => prev.map(r => r.id === testId ? result : r));
  }, [getTestDefinitions, runSingleTest, results]);

  const runAllTests = useCallback(async () => {
    const defs = getTestDefinitions();
    const batchDefs = defs.filter(d => d.runInBatch);
    setIsRunningAll(true);
    abortRef.current = false;

    const initialResults: TestResult[] = defs.map(d => createTestResult(d));
    setResults(initialResults);

    for (const def of batchDefs) {
      if (abortRef.current) break;

      setResults(prev => prev.map(r => r.id === def.id ? { ...r, status: 'running' as TestStatus } : r));

      const result = await runSingleTest(def, []);
      setResults(prev => prev.map(r => r.id === def.id ? result : r));

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setIsRunningAll(false);
  }, [getTestDefinitions, runSingleTest]);

  const resetTests = useCallback(() => {
    setResults([]);
    setExpandedDebug({});
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleDebug = (testId: string) => {
    setExpandedDebug(prev => ({ ...prev, [testId]: !prev[testId] }));
  };

  const getTestStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'passed': return <Check className="w-4 h-4 text-green-600" />;
      case 'failed': return <X className="w-4 h-4 text-red-600" />;
      case 'skipped': return <SkipForward className="w-4 h-4 text-slate-400" />;
      case 'running': return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-slate-300" />;
    }
  };

  const getTestStatusBadge = (status: TestStatus) => {
    switch (status) {
      case 'passed': return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Passed</span>;
      case 'failed': return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Failed</span>;
      case 'skipped': return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">Skipped</span>;
      case 'running': return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Running...</span>;
      default: return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-200">Not tested</span>;
    }
  };

  const formatDuration = (ms: number | null): string => {
    if (ms === null) return '';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const categories = [...new Set(getTestDefinitions().map(d => d.category))];
  const currentDefs = getTestDefinitions();

  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;
  const hasResults = results.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            <FlaskConical className="w-6 h-6 mr-2 text-blue-600" />
            API Endpoint Testing
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Test all API endpoints to verify connectivity and diagnose issues
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetTests}
            disabled={isRunningAll || !hasResults}
            className="flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </button>
          <button
            onClick={runAllTests}
            disabled={isRunningAll}
            className={`flex items-center px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isRunningAll
                ? 'bg-blue-100 text-blue-600 cursor-wait'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {isRunningAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run All Tests
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      {hasResults && (
        <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-4 text-sm">
          <span className="font-medium text-slate-700">Summary:</span>
          {passedCount > 0 && (
            <span className="flex items-center text-green-700">
              <Check className="w-3.5 h-3.5 mr-1" />
              {passedCount} passed
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center text-red-700">
              <X className="w-3.5 h-3.5 mr-1" />
              {failedCount} failed
            </span>
          )}
          {skippedCount > 0 && (
            <span className="flex items-center text-slate-500">
              <SkipForward className="w-3.5 h-3.5 mr-1" />
              {skippedCount} skipped
            </span>
          )}
          {failedCount === 0 && passedCount > 0 && skippedCount === 0 && (
            <span className="text-green-600 font-medium ml-2">All tests passed!</span>
          )}
        </div>
      )}

      {/* Test Categories */}
      <div className="flex-1 overflow-auto space-y-4">
        {categories.map(category => {
          const defs = currentDefs.filter(d => d.category === category);
          const isExpanded = expandedSections[category] !== false;

          return (
            <div key={category} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(category)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500 mr-2" /> : <ChevronRight className="w-4 h-4 text-slate-500 mr-2" />}
                  <span className="text-sm font-semibold text-slate-800">{category}</span>
                  <span className="ml-2 text-xs text-slate-400">({defs.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  {results.filter(r => r.category === category && r.status === 'passed').length > 0 && (
                    <span className="text-xs text-green-600 font-medium">
                      {results.filter(r => r.category === category && r.status === 'passed').length}/{defs.length}
                    </span>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-slate-100">
                  {defs.map(def => {
                    const result = results.find(r => r.id === def.id);
                    const status = result?.status || 'idle';
                    const isDebugExpanded = expandedDebug[def.id] || false;

                    return (
                      <div key={def.id} className="bg-white">
                        {/* Test Row */}
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-3">
                            {getTestStatusIcon(status)}
                            <div>
                              <span className="text-sm font-medium text-slate-800">{def.name}</span>
                              {result?.duration !== null && result?.duration !== undefined && (
                                <span className="ml-2 text-xs text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(result.duration)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getTestStatusBadge(status)}
                            <button
                              onClick={() => runTest(def.id)}
                              disabled={isRunningAll || status === 'running'}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Run test"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            {status === 'failed' && result?.error && (
                              <button
                                onClick={() => toggleDebug(def.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Show debug info"
                              >
                                <Terminal className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Debug Panel (shown when test fails) */}
                        {status === 'failed' && result?.error && isDebugExpanded && (
                          <div className="mx-4 mb-3 bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                            <div className="px-4 py-3 border-b border-red-100">
                              <div className="flex items-center mb-2">
                                <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                                <span className="text-sm font-semibold text-red-800">Debug Information</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-start">
                                  <span className="font-medium text-red-700 w-24 shrink-0">Status:</span>
                                  <span className="text-red-800 font-mono">
                                    {result.error.statusCode ? `${result.error.statusCode} ${getStatusText(result.error.statusCode)}` : 'N/A'}
                                  </span>
                                </div>
                                <div className="flex items-start">
                                  <span className="font-medium text-red-700 w-24 shrink-0">Error:</span>
                                  <span className="text-red-800 break-all">{result.error.message}</span>
                                </div>
                              </div>
                            </div>

                            {/* Possible Causes */}
                            <div className="px-4 py-3 border-b border-red-100">
                              <span className="text-sm font-semibold text-red-800 block mb-2">Possible Causes:</span>
                              <ul className="space-y-1">
                                {result.error.possibleCauses.map((cause, i) => (
                                  <li key={i} className="text-sm text-red-700 flex items-start">
                                    <span className="mr-2 text-red-400">•</span>
                                    {cause}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Request Details */}
                            {result.error.requestDetails.url && (
                              <div className="px-4 py-3 border-b border-red-100">
                                <span className="text-sm font-semibold text-red-800 block mb-2">Request:</span>
                                <div className="bg-white/60 rounded border border-red-100 p-2 text-xs font-mono text-red-800 space-y-1">
                                  <div><span className="text-red-500">POST</span> {result.error.requestDetails.url}</div>
                                </div>
                              </div>
                            )}

                            {/* Response Body */}
                            {result.error.responseBody && (
                              <div className="px-4 py-3">
                                <span className="text-sm font-semibold text-red-800 block mb-2">Response:</span>
                                <pre className="bg-white/60 rounded border border-red-100 p-2 text-xs font-mono text-red-800 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
                                  {(() => {
                                    try {
                                      return JSON.stringify(JSON.parse(result.error.responseBody), null, 2);
                                    } catch {
                                      return result.error.responseBody;
                                    }
                                  })()}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function getStatusText(code: number): string {
  const texts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return texts[code] || 'Error';
}
