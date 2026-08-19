import {
  getModelPreset,
  getStylePreset,
  getRatioPreset,
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
  const customUrl = localStorage.getItem('user_cloudflare_api_url');
  const token = localStorage.getItem('user_cloudflare_api_token');
  const WORKER_URL = (customUrl && customUrl.trim().length > 0 && customUrl.startsWith('http')) 
    ? customUrl.trim() 
    : 'https://free-image-generation.salaxaert.workers.dev';

  const modelPreset = getModelPreset(options.model);
  const stylePreset = getStylePreset(options.style);
  const ratioPreset = getRatioPreset(options.ratio);

  const enhancedPrompt = [
    prompt,
    stylePreset.promptModifiers,
    BASE_QUALITY_TERMS
  ].join(', ');

  const requestBody: Record<string, unknown> = {
    prompt: enhancedPrompt,
    model: modelPreset.modelId,
    size: `${ratioPreset.width}x${ratioPreset.height}`,
    steps: Math.min(options.steps ?? 20, modelPreset.maxSteps),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Support secured custom workers by passing the token in the Authorization header
  if (token && token.trim().length > 0) {
    headers['Authorization'] = token.trim();
  }

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare Worker Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (data.error) {
       throw new Error(`Cloudflare API Error: ${data.error}`);
    }
    
    if (!data.image) {
       throw new Error('No image data returned from Worker.');
    }

    return data.image;
  } catch (err: any) {
    throw new Error(`Image Generation Failed: ${err.message}`);
  }
};
