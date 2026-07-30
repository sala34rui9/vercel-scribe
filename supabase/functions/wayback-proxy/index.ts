// Supabase Edge Function: Wayback Machine CORS Proxy
// Proxies requests to the Internet Archive Wayback Machine APIs to avoid CORS issues.
// No authentication required - Wayback Machine APIs are public.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const WAYBACK_AVAILABILITY_API = 'https://archive.org/wayback/available';
const WAYBACK_CDX_API = 'https://web.archive.org/cdx/search/cdx';

// CORS headers - allow all origins
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse the request body
    const body = await req.json();
    const { endpoint, url, options = {} } = body;

    // Validate required fields
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: endpoint (availability or cdx)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Wayback Proxy] Endpoint: ${endpoint}, URL: ${url}`);

    let apiUrl: string;

    if (endpoint === 'availability') {
      // Build availability API URL
      apiUrl = `${WAYBACK_AVAILABILITY_API}?url=${encodeURIComponent(url)}`;
      if (options.timestamp) apiUrl += `&timestamp=${options.timestamp}`;
    } else if (endpoint === 'cdx') {
      // Build CDX API URL
      const params = new URLSearchParams();
      params.set('url', url);
      params.set('output', 'json');
      params.set('fl', 'urlkey,timestamp,original,mimetype,statuscode,digest,length');

      if (options.from) params.set('from', options.from);
      if (options.to) params.set('to', options.to);
      if (options.limit) params.set('limit', String(Math.min(options.limit, 150000)));
      if (options.offset) params.set('offset', String(options.offset));
      if (options.filterStatus) params.set('statuscode', String(options.filterStatus));
      if (options.filterMimeType) params.set('mimetype', options.filterMimeType);
      if (options.collapse) params.set('collapse', options.collapse);

      apiUrl = `${WAYBACK_CDX_API}?${params.toString()}`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint. Use "availability" or "cdx".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward the request to Wayback Machine
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Wayback API error: ${response.status}`);
    }

    // For CDX API, return as JSON array
    if (endpoint === 'cdx') {
      const text = await response.text();
      // Parse and return as JSON
      try {
        const jsonData = JSON.parse(text);
        return new Response(
          JSON.stringify(jsonData),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch {
        // Return raw text if not valid JSON
        return new Response(
          JSON.stringify({ raw: text }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // For availability API, return the JSON response
    const data = await response.json();
    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('[Wayback Proxy] Error:', error.message);
    return new Response(
      JSON.stringify({
        error: 'Proxy error',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
