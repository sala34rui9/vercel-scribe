export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Model mapping: client-friendly IDs → Cloudflare AI model IDs
    const MODEL_MAP = {
      'sdxl': '@cf/stabilityai/stable-diffusion-xl-base-1.0',
      'dreamshaper': '@cf/lykon/dreamshaper-8-lcm',
      'sdxl-lightning': '@cf/bytedance/stable-diffusion-xl-lightning',
      // Direct Cloudflare model IDs also accepted
      '@cf/stabilityai/stable-diffusion-xl-base-1.0': '@cf/stabilityai/stable-diffusion-xl-base-1.0',
      '@cf/lykon/dreamshaper-8-lcm': '@cf/lykon/dreamshaper-8-lcm',
      '@cf/bytedance/stable-diffusion-xl-lightning': '@cf/bytedance/stable-diffusion-xl-lightning',
      '@cf/black-forest-labs/flux-1-schnell': '@cf/black-forest-labs/flux-1-schnell',
    };

    // Max steps per model
    const MAX_STEPS = {
      '@cf/black-forest-labs/flux-1-schnell': 4,
      '@cf/bytedance/stable-diffusion-xl-lightning': 8,
      '@cf/stabilityai/stable-diffusion-xl-base-1.0': 20,
      '@cf/lykon/dreamshaper-8-lcm': 20,
    };

    let prompt = url.searchParams.get('prompt');
    let size = url.searchParams.get('size') || '1024x1024';
    let modelKey = url.searchParams.get('model') || 'sdxl';
    let steps = parseInt(url.searchParams.get('steps') || '20', 10);

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        prompt = prompt || body.prompt;
        size = body.size || size;
        modelKey = body.model || modelKey;
        steps = body.steps || steps;
      } catch (e) {}
    }

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing "prompt" parameter.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const modelId = MODEL_MAP[modelKey] || modelKey;
    const maxSteps = MAX_STEPS[modelId] || 4;
    steps = Math.min(Math.max(steps, 1), maxSteps);

    const [width, height] = size.split('x').map(Number);

    try {
      const result = await env.AI.run(modelId, {
        prompt,
        width: width || 1024,
        height: height || 1024,
        steps,
      });

      // Convert raw image to base64 data URL
      // AI.run() may return Response, ArrayBuffer, or Uint8Array depending on model/version
      let bytes;
      if (result instanceof Response) {
        bytes = new Uint8Array(await result.arrayBuffer());
      } else if (result instanceof ArrayBuffer) {
        bytes = new Uint8Array(result);
      } else if (result instanceof Uint8Array) {
        bytes = result;
      } else {
        // Fallback: wrap in Response to extract ArrayBuffer
        bytes = new Uint8Array(await new Response(result).arrayBuffer());
      }
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const dataUrl = `data:image/png;base64,${base64}`;

      return new Response(
        JSON.stringify({ image: dataUrl }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  },
};
