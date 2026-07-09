// Supabase Edge Function: Fetch SEO Data
// PROTECTED: Orchestrates SE Ranking API calls for keyword intelligence
// Fetches lost keywords, competitor gaps, and AI Overview keywords

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// SE Ranking API base URL
const SE_RANKING_API_BASE = 'https://api.seranking.com';

// Cache duration in milliseconds (24 hours)
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// In-memory cache (persists within Edge Function cold start window)
const cache: Map<string, { data: any; timestamp: number }> = new Map();

function getCacheKey(targetDomain: string, searchRegion: string, competitorDomain?: string): string {
  return `${targetDomain}:${searchRegion}:${competitorDomain || 'none'}`;
}

function getCachedData(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_DURATION_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Map TargetCountry enum values to SE Ranking region codes.
 * SE Ranking uses ISO-style region identifiers.
 */
function mapCountryToRegion(targetCountry?: string): string {
  const mapping: Record<string, string> = {
    'United States': 'us',
    'United Kingdom': 'uk',
    'Canada': 'ca',
    'Australia': 'au',
    'India': 'in',
    'Germany (English)': 'de',
    'France (English)': 'fr',
    'Global (International English)': 'us', // Default to US for global
  };
  return mapping[targetCountry || ''] || 'us';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. AUTHENTICATION CHECK
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. PARSE REQUEST
    const { targetDomain, searchRegion, competitorDomain, targetCountry } = await req.json();

    if (!targetDomain) {
      return new Response(
        JSON.stringify({ error: 'targetDomain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve region: prefer explicit searchRegion, fallback to mapping targetCountry
    const region = searchRegion || mapCountryToRegion(targetCountry);

    // 3. CHECK CACHE
    const cacheKey = getCacheKey(targetDomain, region, competitorDomain);
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      console.log(`[SE Ranking] Cache HIT for ${cacheKey}`);
      return new Response(
        JSON.stringify(cachedResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SE Ranking] Cache MISS for ${cacheKey} — fetching from API`);

    // 4. GET SE RANKING API KEY
    const seRankingApiKey = Deno.env.get('SE_RANKING_API_KEY');
    if (!seRankingApiKey) {
      console.warn('[SE Ranking] API key not configured in Supabase secrets');
      // Graceful degradation: return empty data
      return new Response(
        JSON.stringify({
          lostKeywords: [],
          competitorGaps: [],
          aiOverviewKeywords: [],
          dataFetchedAt: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. FETCH DATA FROM SE RANKING (Concurrent with allSettled)
    const CHANNEL_TIMEOUT_MS = 8000;

    const fetchWithTimeout = async (url: string, label: string): Promise<any> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CHANNEL_TIMEOUT_MS);

      try {
        console.log(`[SE Ranking] ${label}: Fetching ${url}`);
        const response = await fetch(url, {
          headers: {
            'Authorization': `Token ${seRankingApiKey}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          console.error(`[SE Ranking] ${label}: HTTP ${response.status} — ${errorBody}`);
          return null;
        }

        const data = await response.json();
        console.log(`[SE Ranking] ${label}: Success — ${Array.isArray(data) ? data.length : 'object'} results`);
        return data;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn(`[SE Ranking] ${label}: Timed out after ${CHANNEL_TIMEOUT_MS}ms`);
        } else {
          console.error(`[SE Ranking] ${label}: Error —`, error.message);
        }
        return null;
      }
    };

    // Channel A: Lost Keywords
    const channelAUrl = `${SE_RANKING_API_BASE}/v3/ranking/lost-keywords?domain=${encodeURIComponent(targetDomain)}&region=${region}&limit=20&sort=search_volume`;

    // Channel B: Competitor Overlap (only if competitor provided)
    const channelBUrl = competitorDomain
      ? `${SE_RANKING_API_BASE}/v3/ranking/competitor-overlap?domain=${encodeURIComponent(targetDomain)}&competitor=${encodeURIComponent(competitorDomain)}&region=${region}&limit=20`
      : null;

    // Channel C: AI Overview Keywords
    const channelCUrl = `${SE_RANKING_API_BASE}/v3/ranking/ai-overview?domain=${encodeURIComponent(targetDomain)}&region=${region}&limit=10`;

    // Execute all channels concurrently
    const channelPromises = [
      fetchWithTimeout(channelAUrl, 'Channel A (Lost Keywords)'),
      channelBUrl ? fetchWithTimeout(channelBUrl, 'Channel B (Competitor Gaps)') : Promise.resolve(null),
      fetchWithTimeout(channelCUrl, 'Channel C (AI Overview)'),
    ];

    const [channelAResult, channelBResult, channelCResult] = await Promise.allSettled(channelPromises);

    // 6. NORMALIZE & CAP RESULTS
    const extractKeywords = (result: PromiseSettledResult<any>, keyField: string = 'keyword', limit: number): string[] => {
      if (result.status !== 'fulfilled' || !result.value) return [];

      const data = result.value;

      // Handle different response shapes from SE Ranking API
      let items: any[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data.data && Array.isArray(data.data)) {
        items = data.data;
      } else if (data.rows && Array.isArray(data.rows)) {
        items = data.rows;
      } else if (data.keywords && Array.isArray(data.keywords)) {
        items = data.keywords;
      }

      // Extract keyword strings, sort by search_volume if available, and cap
      const keywords = items
        .sort((a: any, b: any) => (b.search_volume || 0) - (a.search_volume || 0))
        .slice(0, limit)
        .map((item: any) => {
          if (typeof item === 'string') return item;
          return item[keyField] || item.keyword || item.name || '';
        })
        .filter((k: string) => k.length > 0);

      return [...new Set(keywords)]; // Deduplicate
    };

    const lostKeywords = extractKeywords(channelAResult, 'keyword', 15);
    const competitorGaps = extractKeywords(channelBResult, 'keyword', 15);
    const aiOverviewKeywords = extractKeywords(channelCResult, 'keyword', 10);

    console.log(`[SE Ranking] Results — Lost: ${lostKeywords.length}, Gaps: ${competitorGaps.length}, AIO: ${aiOverviewKeywords.length}`);

    const responseData = {
      lostKeywords,
      competitorGaps,
      aiOverviewKeywords,
      dataFetchedAt: new Date().toISOString()
    };

    // 7. CACHE RESULTS
    setCachedData(cacheKey, responseData);

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SE Ranking] Orchestration error:', error);
    // Graceful degradation — return empty data instead of error
    return new Response(
      JSON.stringify({
        lostKeywords: [],
        competitorGaps: [],
        aiOverviewKeywords: [],
        dataFetchedAt: new Date().toISOString(),
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
