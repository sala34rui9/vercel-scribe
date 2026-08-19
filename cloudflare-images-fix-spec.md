# Cloudflare Free Image Generation — Bug Fix Spec

## Problem Statement

Free Cloudflare image generation is **completely broken** in both the API Test Panel and during article generation. The client-side code sends request parameters that do **not match** the deployed Cloudflare Worker's expected format, causing a 400 error:

```
AiError: Bad input: Error: Additional or unevaluated properties '/num_steps' at '/' not allowed
```

---

## Root Cause Analysis

### What the deployed Worker expects (source code confirmed)

The worker at `https://free-image-generation.salaxaert.workers.dev` has this contract:

| Aspect | Worker Behavior |
|---|---|
| **Model** | Hardcoded to `@cf/black-forest-labs/flux-1-schnell` — does NOT accept a `model` parameter |
| **Prompt** | Accepts `prompt` in query string or JSON body |
| **Dimensions** | Accepts `size` as a string like `"1024x1024"` — does NOT accept `width`/`height` separately |
| **Steps** | Hardcoded to `steps: 4` — does NOT accept `num_steps` or `steps` from client |
| **Guidance** | NOT accepted — the Worker does not pass it to the AI model |
| **Response format** | Returns **raw image bytes** (`image/png`), NOT a JSON `{ image: "data:..." }` object |

### What the client currently sends (cloudflareImageService.ts)

```json
{
  "prompt": "...",
  "model": "@cf/stabilityai/stable-diffusion-xl-base-1.0",  // ❌ Worker ignores this
  "width": 1024,                                             // ❌ Worker expects `size: "1024x1024"`
  "height": 576,                                             // ❌ Worker expects `size: "1024x576"`
  "num_steps": 20,                                           // ❌ Causes the 400 error
  "guidance": 8.5                                            // ❌ Worker doesn't use this
}
```

### What the client expects in response

The client expects:
```json
{ "image": "data:image/png;base64,..." }
```

But the Worker returns **raw PNG bytes** directly (not JSON at all).

---

## Mismatch Summary

| # | Field | Client sends | Worker expects | Impact |
|---|---|---|---|---|
| 1 | `num_steps` | `"num_steps": 20` | Not accepted at all (hardcoded `steps: 4`) | **400 error** — this is the immediate crash |
| 2 | `model` | `"model": "@cf/stabilityai/..."` | Not accepted (hardcoded to flux-1-schnell) | Extra unknown property — likely rejected |
| 3 | `width`/`height` | `"width": 1024, "height": 576` | `"size": "1024x576"` | Wrong format — Worker defaults to 1024x1024 |
| 4 | `guidance` | `"guidance": 8.5` | Not accepted | Extra unknown property — likely rejected |
| 5 | Response parsing | Expects `{ image: "data:..." }` | Returns raw PNG bytes | Client will fail to parse response |

---

## Affected Files

| File | Role | Change Needed |
|---|---|---|
| `services/cloudflareImageService.ts` | Main image generation service | **Major rewrite** — request body, response parsing, model/ratio handling |
| `components/ApiTestPanel.tsx` | Cloudflare test under "AI Providers" | Fix test request body to match Worker format, fix response parsing |
| `components/ApiTestPanel.tsx` | `generate-image` test under "Backend Functions" | Still references old Supabase Edge Function — needs review |
| `services/imagePresets.ts` | Model/style/ratio presets | No changes to presets themselves, but usage needs to adapt |
| `components/ApiKeysManagement.tsx` | Key management UI | Labels may need updating to reflect current behavior |
| `App.tsx` | Article generation flow | No changes needed — calls `generateCloudflareImage` which handles it |

---

## Detailed Fix Plan

### Fix 0: Deploy improved Worker (new source code)

Deploy an updated Worker at `free-image-generation.salaxaert.workers.dev` with this contract:

```js
// New Worker contract:
// Accepts: { prompt, size, model, steps }
// - prompt: string (required)
// - size: "WxH" string (default: "1024x1024")
// - model: Cloudflare AI model ID (default: "@cf/black-forest-labs/flux-1-schnell")
// - steps: number (default: 4, max: 8 for flux)
// - Returns: JSON { image: "data:image/png;base64,..." }
// - On error: JSON { error: "message" }
```

**Key differences from current Worker:**
1. Accepts `model` param — maps client model IDs to actual Cloudflare AI model IDs
2. Accepts `steps` param — allows user control
3. Returns JSON `{ image: "data:..." }` instead of raw bytes — matches what the client expects
4. Still accepts `size` as `"WxH"` string

### Fix 1: Request format (cloudflareImageService.ts)

**Before (broken):**
```ts
const requestBody = {
  prompt: enhancedPrompt,
  model: modelPreset.modelId,      // ❌ Worker rejects this
  width: ratioPreset.width,         // ❌ Worker expects size string
  height: ratioPreset.height,       // ❌ Worker expects size string
  num_steps: Math.min(options.steps ?? 20, modelPreset.maxSteps),  // ❌ Causes 400
  guidance: 8.5                     // ❌ Worker rejects this
};
```

**After (fixed, matching new Worker):**
```ts
const requestBody = {
  prompt: enhancedPrompt,
  model: modelPreset.modelId,      // ✅ New Worker accepts model ID
  size: `${ratioPreset.width}x${ratioPreset.height}`,  // ✅ "WxH" string
  steps: Math.min(options.steps ?? 20, modelPreset.maxSteps),  // ✅ New Worker accepts steps
};
// guidance removed — not supported by Cloudflare AI models
```

### Fix 2: Response parsing (cloudflareImageService.ts)

The new Worker will return JSON `{ image: "data:image/png;base64,..." }` just like the old Supabase Edge Function. This means the existing response parsing logic is actually fine — just needs minor cleanup:

```ts
const data = await response.json();
if (data.error) throw new Error(`Cloudflare API Error: ${data.error}`);
if (!data.image) throw new Error('No image data returned from Worker.');
return data.image;  // Already a base64 data URL
```

No change needed here — the new Worker matches this format. ✅

### Fix 3: Model selection (design decision needed)

The Worker hardcodes `@cf/black-forest-labs/flux-1-schnell`. The client offers 3 models (SDXL, Dreamshaper, SDXL Lightning) via `imagePresets.ts`. Options:

**Option A — Keep Worker as-is (recommended for now):**
- Flux-1-schnell is actually a good free model (fast, decent quality)
- Remove model selection from the image settings UI when using the free Worker
- Document that custom Workers can support other models

**Option B — Update Worker to accept model param:**
- Worker would need to map client model IDs to actual Cloudflare AI model IDs
- More complex Worker code, requires testing each model
- Better long-term solution but requires Worker redeployment

### Fix 4: API Test Panel — "Cloudflare Images" test

The test under "AI Providers" currently sends:
```ts
{ prompt: 'A simple test image', num_steps: 4 }
```

**Fix:** Update to match new Worker contract:
```ts
{ prompt: 'A simple test image', size: '1024x1024' }
```
Response parsing stays the same (expects JSON `{ image: ... }`) since the new Worker returns JSON.

### Fix 5: API Test Panel — "generate-image" Backend Function test

This test under "Backend Functions" still calls the **old Supabase Edge Function**:
```ts
supabase.functions.invoke('generate-image', {
  body: { accountId, apiToken, modelId, requestBody }
});
```

The Edge Function (`supabase/functions/generate-image/index.ts`) expects `accountId` + `apiToken` + `modelId` + `requestBody`. This is a completely separate code path from the free Worker. Options:
- **Remove this test** if the Supabase Edge Function is no longer used
- **Keep it** as a fallback for users who have their own Cloudflare account
- The labels in `ApiKeysManagement.tsx` already mark these as "Optional"

### Fix 6: Steps/quality (resolved with new Worker)

The new Worker accepts a `steps` parameter, so the existing UI steps slider will work correctly. Max steps vary by model:
- Flux-1-schnell: max 4 steps (fast, decent quality)
- SDXL Lightning: max 8 steps (fast)
- SDXL / Dreamshaper: max 20 steps (high quality, slower)

No UI changes needed — the steps slider works as intended with the new Worker.

---

## Edge Cases to Handle

1. **Worker is down/unreachable:** The fetch will throw a network error. Current error handling wraps it in `Image Generation Failed: ...` — this is acceptable.

2. **Worker returns non-image content:** If the Worker returns JSON (error response), the current code tries to parse it as JSON. After the fix, we should check `response.headers.get('content-type')` to decide if it's an image or error JSON.

3. **Large image data:** `btoa(String.fromCharCode(...bytes))` can fail for very large images due to call stack limits. Use a chunked approach:
   ```ts
   let binary = '';
   for (let i = 0; i < bytes.length; i++) {
     binary += String.fromCharCode(bytes[i]);
   }
   const base64 = btoa(binary);
   ```

4. **Mixed content types:** The Worker always returns `image/png` on success, but on error it returns JSON with `application/json`. The response parser must handle both.

5. **Custom Worker URL:** Users can provide their own Worker URL that may have a different contract. The code should be flexible or document the expected contract.

---

## Design Decisions ✅ CONFIRMED

- [x] **Model selector: Keep as-is** — Show all models in UI always. The improved Worker will accept a `model` param so users can actually pick different models.
- [x] **Steps slider: Keep as-is** — Show the slider always. The improved Worker will accept `steps` so users can control quality.
- [x] **Old Edge Function test: Keep as fallback** — The `generate-image` Backend Function test stays. Users who have their own Cloudflare account can use the old Edge Function path. Mark it as "Advanced / requires own Cloudflare account".
- [x] **Update Worker + client** — Deploy an improved Worker that accepts `model`, `steps`, and returns JSON `{ image: "data:..." }`, then fix the client to match.

---

## New Worker Source Code (DEPLOYED ✅)

**Worker:** `free-image-generation` at `https://free-image-generation.salaxaert.workers.dev`
**Version:** ff9637d7-7734-497d-a82d-234c5be8027c
**Source:** `worker/worker.js`

```js
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
```

---

## Expected Outcome After Fix

1. ✅ Cloudflare Images test passes in the API Test Panel
2. ✅ Article generation with `imageCount > 0` successfully generates and embeds images
3. ✅ Images are valid PNG base64 data URLs that render in markdown
4. ✅ Custom Worker URL + token still works for users who have their own setup
5. ✅ Error messages are clear when the Worker is down or misconfigured
