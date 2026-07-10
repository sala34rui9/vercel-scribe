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

function getCacheKey(action: string, targetDomain: string, searchRegion: string, keyword?: string): string {
  return `${action}:${targetDomain}:${searchRegion}:${keyword || 'none'}`;
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

function mapCountryToRegion(targetCountry?: string): string {
  const mapping: Record<string, string> = {
    'United States': 'us',
    'United Kingdom': 'uk',
    'Canada': 'ca',
    'Australia': 'au',
    'India': 'in',
    'Germany (English)': 'de',
    'France (English)': 'fr',
    'Global (International English)': 'us',
  };
  return mapping[targetCountry || ''] || 'us';
}

function sanitizeDomain(input: string): string {
  try {
    let clean = input.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      const url = new URL(clean);
      clean = url.hostname;
    }
    if (clean.startsWith('www.')) {
      clean = clean.substring(4);
    }
    clean = clean.split('/')[0];
    return clean;
  } catch {
    return input.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let { action, targetDomain, searchRegion, competitorDomain, targetCountry, seRankingKey, keyword } = await req.json();

    if (!targetDomain && !keyword) {
      return new Response(
        JSON.stringify({ error: 'targetDomain or keyword is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetDomain) targetDomain = sanitizeDomain(targetDomain);
    if (competitorDomain) competitorDomain = sanitizeDomain(competitorDomain);

    const region = searchRegion || mapCountryToRegion(targetCountry);
    const resolvedAction = action || 'orchestrate';
    const cacheKey = getCacheKey(resolvedAction, targetDomain || '', region, keyword);
    const cachedResult = getCachedData(cacheKey);

    if (cachedResult) {
      console.log(`[SE Ranking] Cache HIT for ${cacheKey}`);
      return new Response(JSON.stringify(cachedResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const seRankingApiKey = seRankingKey || Deno.env.get('SE_RANKING_API_KEY');
    if (!seRankingApiKey) {
      throw new Error('API key not configured in Supabase secrets');
    }

    const fetchWithTimeout = async (url: string, label: string): Promise<any> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(url, {
          headers: { 'Authorization': `Token ${seRankingApiKey}`, 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) return null;
        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        return null;
      }
    };

    let responseData: any = {};

    if (resolvedAction === 'domain_overview') {
      const url = `${SE_RANKING_API_BASE}/v1/domain/overview/worldwide?domain=${encodeURIComponent(targetDomain)}&currency=USD`;
      const result = await fetchWithTimeout(url, 'Domain Overview');
      if (result) {
        responseData = {
          totalKeywords: result.total_keywords || 0,
          organicTraffic: result.organic_traffic || 0,
          paidTraffic: result.paid_traffic || 0,
          trafficValue: result.traffic_value || 0,
          currency: 'USD'
        };
      }
    } else if (resolvedAction === 'top_competitors') {
      const url = `${SE_RANKING_API_BASE}/v1/domain/competitors?domain=${encodeURIComponent(targetDomain)}&type=organic&source=${region}`;
      const result = await fetchWithTimeout(url, 'Top Competitors');
      
      let items: any[] = [];
      if (Array.isArray(result)) items = result;
      else if (result?.data) items = result.data;
      else if (result?.rows) items = result.rows;

      responseData = {
        competitors: items.slice(0, 10).map((c: any) => ({
          domain: c.domain || c.name || '',
          overlappingKeywords: c.common_keywords || 0
        })).filter((c: any) => c.domain)
      };
    } else if (resolvedAction === 'similar_keywords') {
      const url = `${SE_RANKING_API_BASE}/v1/keywords/similar?source=${region}&keyword=${encodeURIComponent(keyword)}&limit=10`;
      const result = await fetchWithTimeout(url, 'Similar Keywords');
      
      let items: any[] = [];
      if (Array.isArray(result)) items = result;
      else if (result?.data) items = result.data;
      else if (result?.rows) items = result.rows;

      responseData = { keywords: items.map((k: any) => k.keyword || k.name).filter(Boolean) };
    } else if (resolvedAction === 'related_keywords') {
      const url = `${SE_RANKING_API_BASE}/v1/keywords/related?source=${region}&keyword=${encodeURIComponent(keyword)}&limit=10`;
      const result = await fetchWithTimeout(url, 'Related Keywords');
      
      let items: any[] = [];
      if (Array.isArray(result)) items = result;
      else if (result?.data) items = result.data;
      else if (result?.rows) items = result.rows;

      responseData = { keywords: items.map((k: any) => k.keyword || k.name).filter(Boolean) };
    } else {
      // Legacy orchestration (orchestrate)
      const channelAUrl = `${SE_RANKING_API_BASE}/v1/domain/keywords?source=${region}&domain=${encodeURIComponent(targetDomain)}&type=organic&pos_change=lost&order_field=volume&order_type=desc`;
      const channelBUrl = competitorDomain
        ? `${SE_RANKING_API_BASE}/v1/domain/keywords/comparison?source=${region}&domain=${encodeURIComponent(competitorDomain)}&compare=${encodeURIComponent(targetDomain)}&type=organic&diff=1&order_type=desc&order_field=volume&cols=keyword%2Cvolume`
        : null;
      const channelCUrl = `${SE_RANKING_API_BASE}/v1/ai-search/prompts-by-target?target=${encodeURIComponent(targetDomain)}&scope=domain&source=${region}&engine=ai-overview&limit=10`;

      const channelPromises = [
        fetchWithTimeout(channelAUrl, 'Channel A (Lost Keywords)'),
        channelBUrl ? fetchWithTimeout(channelBUrl, 'Channel B (Competitor Gaps)') : Promise.resolve(null),
        fetchWithTimeout(channelCUrl, 'Channel C (AI Overview)'),
      ];

      const [channelAResult, channelBResult, channelCResult] = await Promise.allSettled(channelPromises);

      const extractKeywords = (result: PromiseSettledResult<any>, keyField: string = 'keyword', limit: number): string[] => {
        if (result.status !== 'fulfilled' || !result.value) return [];
        const data = result.value;
        let items: any[] = [];
        if (Array.isArray(data)) items = data;
        else if (data.data) items = data.data;
        else if (data.rows) items = data.rows;
        else if (data.keywords) items = data.keywords;

        const keywords = items
          .sort((a: any, b: any) => (b.search_volume || 0) - (a.search_volume || 0))
          .slice(0, limit)
          .map((item: any) => typeof item === 'string' ? item : item[keyField] || item.keyword || item.name || '')
          .filter(Boolean);

        return [...new Set(keywords)];
      };

      responseData = {
        lostKeywords: extractKeywords(channelAResult, 'keyword', 15),
        competitorGaps: extractKeywords(channelBResult, 'keyword', 15),
        aiOverviewKeywords: extractKeywords(channelCResult, 'keyword', 10),
        dataFetchedAt: new Date().toISOString()
      };
    }

    setCachedData(cacheKey, responseData);

    return new Response(JSON.stringify(responseData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[SE Ranking] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
