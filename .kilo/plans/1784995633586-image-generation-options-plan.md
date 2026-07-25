# Image Generation Options Plan

## Goal

Give users full control over image style, aspect ratio, and generation model within the existing Cloudflare Workers AI integration — using only free Cloudflare-hosted models, with no advanced controls exposed.

## Decisions Locked

| Decision | Choice |
|----------|--------|
| Models available | Free only: SDXL base 1.0, Dreamshaper 8 LCM, SDXL Lightning |
| Default model | SDXL base 1.0 |
| Style approach | Preset dropdown (10 curated styles with prompt modifiers) |
| Aspect ratios | 5: 1:1, 16:9, 9:16, 3:2, 2:3 |
| Persistence | All selections saved to localStorage |
| Layout | 2×2 grid: [Model, Count], [Style, Ratio] |
| Advanced controls | None (no steps, no negative prompt field, no seed) |

## Affected Files

| File | Change |
|------|--------|
| `types.ts` | Update `ArticleConfig` — add `imageModel`, widen `imageStyle`/`imageRatio` types |
| `services/imagePresets.ts` | **New** — style presets, ratio presets, model presets |
| `services/cloudflareImageService.ts` | Rewrite — use model presets for URL/dimensions, style presets for prompt modifiers |
| `components/ArticleForm.tsx` | Replace 3 dropdowns with 4 dropdowns in 2×2 grid, wire new localStorage keys |
| `App.tsx` | Update `injectImages` to pass `imageModel` through to service |

---

## Step 1: New file — `services/imagePresets.ts`

Central registry of all selectable options. No logic, just data.

```ts
// services/imagePresets.ts

export type ImageModel = 'sdxl' | 'dreamshaper' | 'sdxl-lightning';

export interface ModelPreset {
  id: ImageModel;
  label: string;
  description: string;
  modelId: string;        // Cloudflare @cf/ identifier
  maxSteps: number;       // for internal reference
  bestFor: string;        // short tagline for UI tooltip
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'sdxl',
    label: 'Stable Diffusion XL',
    description: 'Versatile, high-quality, handles all styles',
    modelId: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    maxSteps: 20,
    bestFor: 'All-around'
  },
  {
    id: 'dreamshaper',
    label: 'Dreamshaper 8',
    description: 'Fine-tuned for photorealism',
    modelId: '@cf/lykon/dreamshaper-8-lcm',
    maxSteps: 20,
    bestFor: 'Photorealism'
  },
  {
    id: 'sdxl-lightning',
    label: 'SDXL Lightning',
    description: 'Fast generation in few steps',
    modelId: '@cf/bytedance/stable-diffusion-xl-lightning',
    maxSteps: 20,
    bestFor: 'Speed'
  }
];

export const DEFAULT_MODEL: ImageModel = 'sdxl';

export type ImageStyle =
  | 'photorealistic'
  | 'cinematic'
  | 'anime'
  | 'oil-painting'
  | 'watercolor'
  | '3d-render'
  | 'pixel-art'
  | 'fantasy'
  | 'minimalist'
  | 'cartoon';

export interface StylePreset {
  id: ImageStyle;
  label: string;
  promptModifiers: string;
  negativePromptAdditions: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    promptModifiers: 'photorealistic, hyperdetailed, natural lighting, 85mm lens, raw photograph, DSLR quality, sharp focus, subsurface scattering',
    negativePromptAdditions: 'painting, drawing, illustration, cartoon, anime, 3d render, cgi, plastic, artificial'
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    promptModifiers: 'cinematic composition, dramatic lighting, volumetric fog, shallow depth of field, film grain, anamorphic lens, color graded, movie still, bokeh',
    negativePromptAdditions: 'amateur, snapshot, flat lighting, no depth'
  },
  {
    id: 'anime',
    label: 'Anime / Manga',
    promptModifiers: 'anime style, sharp linework, cel shading, vibrant colors, detailed eyes, dynamic pose, manga illustration, high contrast',
    negativePromptAdditions: 'western cartoon, 3d, photorealistic, blurry, bad anatomy, deformed face'
  },
  {
    id: 'oil-painting',
    label: 'Oil Painting',
    promptModifiers: 'oil painting on canvas, visible brushstrokes, impasto texture, rich pigments, classical art, renaissance influence, gallery quality, dramatic chiaroscuro lighting',
    negativePromptAdditions: 'digital art, 3d render, photograph, flat colors, modern style'
  },
  {
    id: 'watercolor',
    label: 'Watercolor',
    promptModifiers: 'watercolor painting, wet-on-wet technique, color blooms, soft edges, paper texture, delicate washes, translucent layers, artist-grade pigments',
    negativePromptAdditions: 'sharp lines, digital art, 3d, photorealistic, heavy contrast'
  },
  {
    id: '3d-render',
    label: '3D Render',
    promptModifiers: '3d render, octane render, unreal engine 5, ray tracing, subsurface scattering, studio lighting, pbr materials, caustics, volumetric light',
    negativePromptAdditions: '2d, drawing, painting, flat, low poly, pixelated'
  },
  {
    id: 'pixel-art',
    label: 'Pixel Art',
    promptModifiers: 'pixel art style, 16-bit retro aesthetic, limited color palette, crisp pixels, dithering, sprite art, sharp edges, no anti-aliasing',
    negativePromptAdditions: 'smooth, blurry, high resolution, realistic, 3d, gradients'
  },
  {
    id: 'fantasy',
    label: 'Fantasy / Concept Art',
    promptModifiers: 'fantasy concept art, epic scale, magical atmosphere, ethereal lighting, intricate detail, matte painting, god rays, floating particles',
    negativePromptAdditions: 'modern, photorealistic, plain background, dull colors, simple'
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    promptModifiers: 'minimalist design, clean composition, negative space, simple geometry, monochrome palette, flat design, single focal point, elegant simplicity',
    negativePromptAdditions: 'busy, cluttered, complex, detailed, ornate, colorful, chaotic'
  },
  {
    id: 'cartoon',
    label: 'Cartoon / Illustration',
    promptModifiers: 'cartoon style, bold outlines, vibrant colors, cel shaded, stylized illustration, flat color regions, vector art aesthetic, clean shapes',
    negativePromptAdditions: 'realistic, photorealistic, photograph, grainy, messy lines'
  }
];

export const DEFAULT_STYLE: ImageStyle = 'photorealistic';

export type ImageRatio = '1:1' | '16:9' | '9:16' | '3:2' | '2:3';

export interface RatioPreset {
  id: ImageRatio;
  label: string;
  width: number;
  height: number;
}

export const RATIO_PRESETS: RatioPreset[] = [
  { id: '1:1',   label: 'Square (1:1)',        width: 1024, height: 1024 },
  { id: '16:9',  label: 'Landscape (16:9)',    width: 1024, height: 576  },
  { id: '9:16',  label: 'Portrait (9:16)',     width: 576,  height: 1024 },
  { id: '3:2',   label: 'Photo (3:2)',         width: 960,  height: 640  },
  { id: '2:3',   label: 'Photo Portrait (2:3)', width: 640,  height: 960  }
];

export const DEFAULT_RATIO: ImageRatio = '16:9';

// Base negative prompt applied to ALL generations
export const BASE_NEGATIVE_PROMPT = 'blurry, distorted, low quality, bad anatomy, deformed, disfigured, watermark, text, ugly, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, bad proportions, cloned face, missing arms, missing legs, extra arms, extra legs, fused fingers, long neck, jpeg artifacts, signature, error, cropped';

// Base quality boosters appended to every prompt
export const BASE_QUALITY_TERMS = 'masterpiece, best quality, ultra detailed, sharp focus';

// Lookup helpers
export const getModelPreset = (id: ImageModel): ModelPreset =>
  MODEL_PRESETS.find(m => m.id === id) ?? MODEL_PRESETS[0];

export const getStylePreset = (id: ImageStyle): StylePreset =>
  STYLE_PRESETS.find(s => s.id === id) ?? STYLE_PRESETS[0];

export const getRatioPreset = (id: ImageRatio): RatioPreset =>
  RATIO_PRESETS.find(r => r.id === id) ?? RATIO_PRESETS[0];
```

---

## Step 2: Update `types.ts` — `ArticleConfig`

Add `imageModel` field. Widen existing fields to accept the new preset IDs.

```ts
// types.ts — ArticleConfig changes

export interface ArticleConfig {
  // ... existing fields ...
  imageCount: number;
  imageModel: ImageModel;      // NEW — 'sdxl' | 'dreamshaper' | 'sdxl-lightning'
  imageStyle: ImageStyle;      // CHANGED — was string, now typed preset ID
  imageRatio: ImageRatio;      // CHANGED — was string, now typed preset ID
  imagePrompt?: string;
  // ... existing fields ...
}
```

Also export the types so other files can import them:

```ts
export type { ImageModel, ImageStyle, ImageRatio } from './services/imagePresets';
```

---

## Step 3: Rewrite `services/cloudflareImageService.ts`

Replace the current implementation. The function signature changes to accept structured options instead of raw strings.

```ts
// services/cloudflareImageService.ts

import {
  getModelPreset,
  getStylePreset,
  getRatioPreset,
  BASE_NEGATIVE_PROMPT,
  BASE_QUALITY_TERMS,
  type ImageModel,
  type ImageStyle,
  type ImageRatio
} from './imagePresets';

interface GenerateOptions {
  model: ImageModel;
  style: ImageStyle;
  ratio: ImageRatio;
  steps?: number;
}

export const generateCloudflareImage = async (
  prompt: string,
  options: GenerateOptions
): Promise<string> => {
  const url = localStorage.getItem('user_cloudflare_api_url');
  const token = localStorage.getItem('user_cloudflare_api_token');

  if (!url || !token) {
    throw new Error('Cloudflare Image API is not configured.');
  }

  const modelPreset = getModelPreset(options.model);
  const stylePreset = getStylePreset(options.style);
  const ratioPreset = getRatioPreset(options.ratio);

  // Compose enhanced prompt: user prompt + style modifiers + quality boosters
  const enhancedPrompt = [
    prompt,
    stylePreset.promptModifiers,
    BASE_QUALITY_TERMS
  ].join(', ');

  // Compose negative prompt: base negatives + style-specific additions
  const negativePrompt = [
    BASE_NEGATIVE_PROMPT,
    stylePreset.negativePromptAdditions
  ].join(', ');

  // Build request body with all quality parameters
  const requestBody: Record<string, unknown> = {
    prompt: enhancedPrompt,
    negative_prompt: negativePrompt,
    width: ratioPreset.width,
    height: ratioPreset.height,
    num_steps: options.steps ?? 28,
    guidance: 7.5
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudflare API Error (${response.status}): ${text}`);
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
```

---

## Step 4: Update `components/ArticleForm.tsx`

### State additions

Add `imageModel` state alongside existing `imageStyle` and `imageRatio`:

```tsx
const [imageModel, setImageModel] = useState<ImageModel>(() => {
  return (localStorage.getItem('seo_scribe_image_model') as ImageModel) || 'sdxl';
});
```

### Persistence

Add one new effect:

```tsx
useEffect(() => {
  localStorage.setItem('seo_scribe_image_model', imageModel);
}, [imageModel]);
```

### UI — Replace the image generation section

Change from 3 dropdowns to a 2×2 grid of 4 dropdowns:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

  {/* Row 1: Model + Count */}
  <div>
    <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
      Model
    </label>
    <select
      value={imageModel}
      onChange={(e) => setImageModel(e.target.value as ImageModel)}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm bg-white"
    >
      {MODEL_PRESETS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label} — {m.bestFor}
        </option>
      ))}
    </select>
  </div>

  <div>
    <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
      Number of Images
    </label>
    <select
      value={imageCount}
      onChange={(e) => setImageCount(Number(e.target.value))}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm bg-white"
    >
      <option value={0}>None</option>
      <option value={1}>1 Featured Image</option>
      <option value={2}>2 Images</option>
      <option value={3}>3 Images</option>
      <option value={4}>4 Images</option>
      <option value={5}>5 Images</option>
    </select>
  </div>

  {/* Row 2: Style + Ratio (only when count > 0) */}
  {imageCount > 0 && (
    <>
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
          Style
        </label>
        <select
          value={imageStyle}
          onChange={(e) => setImageStyle(e.target.value as ImageStyle)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm bg-white"
        >
          {STYLE_PRESETS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
          Aspect Ratio
        </label>
        <select
          value={imageRatio}
          onChange={(e) => setImageRatio(e.target.value as ImageRatio)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm bg-white"
        >
          {RATIO_PRESETS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} ({r.width}×{r.height})
            </option>
          ))}
        </select>
      </div>
    </>
  )}
</div>
```

### Imports

```tsx
import { MODEL_PRESETS, STYLE_PRESETS, RATIO_PRESETS } from '../services/imagePresets';
import type { ImageModel, ImageStyle, ImageRatio } from '../services/imagePresets';
```

---

## Step 5: Update `App.tsx` — `injectImages` function

The service call signature changes. Update from positional args to options object:

```tsx
// App.tsx — injectImages, inside the loop:

const result = await generateCloudflareImage(prompt, {
  model: config.imageModel ?? 'sdxl',
  style: config.imageStyle ?? 'photorealistic',
  ratio: config.imageRatio ?? '16:9'
});
```

This replaces the old call:
```tsx
// OLD — delete this:
const result = await generateCloudflareImage(prompt, config.imageStyle, config.imageRatio);
```

---

## localStorage Keys Summary

| Key | Values | Default |
|-----|--------|---------|
| `seo_scribe_image_model` | `'sdxl'` \| `'dreamshaper'` \| `'sdxl-lightning'` | `'sdxl'` |
| `seo_scribe_image_count` | `'0'`–`'5'` | `'0'` |
| `seo_scribe_image_style` | 10 style preset IDs | `'photorealistic'` |
| `seo_scribe_image_ratio` | 5 ratio preset IDs | `'16:9'` |

---

## Validation

After implementation:

1. Open the app — Image Generation section shows 4 dropdowns in a 2×2 grid
2. Select model=Dreamshaper, style=Photorealistic, ratio=1:1, count=1
3. Generate an article — verify the image is generated with correct dimensions (1024×1024)
4. Reload the page — verify all 4 selections are restored from localStorage
5. Select model=SDXL Lightning, style=Anime, ratio=9:16 — verify generation succeeds
6. Select count=0 — verify Style and Ratio dropdowns are hidden
7. Check browser DevTools Network tab — verify the API request body contains: `prompt` (with modifiers), `negative_prompt`, `width`, `height`, `num_steps`, `guidance`

---

## Out of Scope

- Paid partner models (FLUX, Leonardo)
- Inference steps slider
- Negative prompt user input
- Seed control
- Image-to-image
- Inpainting
- Custom free-text style input
- Visual style preview thumbnails
- Cost/Neuron usage display
