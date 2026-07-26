import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { accountId, apiToken, modelId, requestBody } = body;

    if (!accountId || !apiToken || !modelId || !requestBody) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const text = await response.text();
      let parsedError = text;
      try {
        const jsonErr = JSON.parse(text);
        if (jsonErr.errors && Array.isArray(jsonErr.errors)) {
          parsedError = jsonErr.errors.map((e: any) => e.message || JSON.stringify(e)).join('; ');
        }
      } catch (_) {
        // Not JSON
      }
      return new Response(
        JSON.stringify({ error: `Cloudflare API Error (${response.status}): ${parsedError}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64String = encode(new Uint8Array(arrayBuffer));
    
    // Determine content type (default to png, but Cloudflare might return jpeg)
    const contentType = response.headers.get('content-type') || 'image/png';
    const dataUrl = `data:${contentType};base64,${base64String}`;

    return new Response(
      JSON.stringify({ image: dataUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error generating image:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
