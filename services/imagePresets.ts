export type ImageModel = 'sdxl' | 'dreamshaper' | 'sdxl-lightning';

export interface ModelPreset {
  id: ImageModel;
  label: string;
  description: string;
  modelId: string;
  maxSteps: number;
  bestFor: string;
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'sdxl',
    label: 'Stable Diffusion XL',
    description: 'Versatile, high-quality, handles all styles',
    modelId: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    maxSteps: 40,
    bestFor: 'All-around'
  },
  {
    id: 'dreamshaper',
    label: 'Dreamshaper 8',
    description: 'Fine-tuned for photorealism',
    modelId: '@cf/lykon/dreamshaper-8-lcm',
    maxSteps: 30,
    bestFor: 'Photorealism'
  },
  {
    id: 'sdxl-lightning',
    label: 'SDXL Lightning',
    description: 'Fast generation in few steps',
    modelId: '@cf/bytedance/stable-diffusion-xl-lightning',
    maxSteps: 8,
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

export const BASE_NEGATIVE_PROMPT = 'blurry, distorted, low quality, bad anatomy, deformed, disfigured, watermark, text, ugly, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, bad proportions, cloned face, missing arms, missing legs, extra arms, extra legs, fused fingers, long neck, jpeg artifacts, signature, error, cropped';

export const BASE_QUALITY_TERMS = 'masterpiece, best quality, ultra detailed, sharp focus';

export const getModelPreset = (id: ImageModel): ModelPreset =>
  MODEL_PRESETS.find(m => m.id === id) ?? MODEL_PRESETS[0];

export const getStylePreset = (id: ImageStyle): StylePreset =>
  STYLE_PRESETS.find(s => s.id === id) ?? STYLE_PRESETS[0];

export const getRatioPreset = (id: ImageRatio): RatioPreset =>
  RATIO_PRESETS.find(r => r.id === id) ?? RATIO_PRESETS[0];
