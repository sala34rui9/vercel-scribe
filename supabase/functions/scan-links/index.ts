// Supabase Edge Function: Scan Links
// PROTECTED: Your link scanning and research strategies

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. AUTHENTICATION
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
    const { 
      scanType, // 'internal' or 'external'
      websiteUrl, 
      topic, 
      keywords,
      deepResearch,
      searchProvider 
    } = await req.json();

    const tavilyApiKey = Deno.env.get('TAVILY_API_KEY');

    // 3. YOUR SECRET LINK SCANNING LOGIC
    let result;
    if (scanType === 'internal') {
      result = await scanInternalLinks(websiteUrl, topic, keywords, deepResearch, tavilyApiKey);
    } else if (scanType === 'external') {
      result = await scanExternalLinks(topic, websiteUrl, tavilyApiKey);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid scan type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Link scanning error:', error);
    return new Response(
      JSON.stringify({ error: 'Link scanning failed', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// YOUR SECRET INTERNAL LINK SCANNING LOGIC (PROTECTED)
// ============================================================================
async function scanInternalLinks(
  websiteUrl: string, 
  topic: string, 
  keywords: string[], 
  deepResearch: boolean,
  tavilyApiKey?: string
) {
  if (!tavilyApiKey) {
    return { links: [], opportunities: [] };
  }

  // Extract domain
  let domain = websiteUrl;
  try {
    const urlToParse = websiteUrl.match(/^https?:\/\//) ? websiteUrl : `https://${websiteUrl}`;
    const urlObj = new URL(urlToParse);
    domain = urlObj.hostname;
  } catch (e) {
    console.warn('Invalid URL format:', websiteUrl);
  }

  // YOUR SECRET SEARCH STRATEGY
  const searchQuery = `site:${domain} ${topic} ${keywords.slice(0, 3).join(' ')}`;

  // Call Tavily Search API
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyApiKey,
      query: searchQuery,
      max_results: deepResearch ? 20 : 10,
      search_depth: deepResearch ? 'advanced' : 'basic',
      include_domains: [domain]
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status}`);
  }

  const data = await response.json();
  const results = data.results || [];

  // Filter and format links
  const cleanDomain = domain.replace(/^www\./, '');
  const links = results
    .filter((r: any) => r.url.includes(cleanDomain))
    .map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.content?.substring(0, 150) || 'Internal link'
    }));

  // Content gap analysis (simplified - you can enhance this)
  const opportunities = [];
  if (deepResearch && links.length < 5) {
    opportunities.push({
      topic: `More content about ${topic}`,
      reason: 'Limited existing content found on this topic'
    });
  }

  return { links, opportunities };
}

// ============================================================================
// YOUR SECRET EXTERNAL LINK SCANNING LOGIC (PROTECTED)
// ============================================================================
async function scanExternalLinks(
  topic: string, 
  excludeDomain: string,
  tavilyApiKey?: string
) {
  if (!tavilyApiKey) {
    return { links: [] };
  }

  // YOUR SECRET SEARCH STRATEGY FOR AUTHORITATIVE SOURCES
  const searchQuery = `${topic} authoritative sources research statistics`;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyApiKey,
      query: searchQuery,
      max_results: 15,
      search_depth: 'advanced',
      exclude_domains: excludeDomain ? [excludeDomain] : []
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status}`);
  }

  const data = await response.json();
  const results = data.results || [];

  const links = results.map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.content?.substring(0, 150) || 'External source'
  }));

  return { links };
}
