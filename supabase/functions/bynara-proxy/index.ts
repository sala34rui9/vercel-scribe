// Supabase Edge Function: ByNara CORS Proxy
// Proxies requests to the ByNara API to avoid CORS issues in the browser.
// No authentication required - users provide their own API key in the request.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const BYNARA_API_URL = 'https://router.bynara.id/v1/chat/completions';

// CORS headers - allow all origins (this is a proxy, not a protected resource)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    // Validate required fields
    if (!body.apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: apiKey' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.payload) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ByNara Proxy] Forwarding request to ${BYNARA_API_URL}, model: ${body.payload.model}`);

    // Forward the request to ByNara API
    const response = await fetch(BYNARA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${body.apiKey}`,
      },
      body: JSON.stringify(body.payload),
    });

    // Get the response data
    const data = await response.json();

    // Return the response with CORS headers
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
    console.error('[ByNara Proxy] Error:', error.message);
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
