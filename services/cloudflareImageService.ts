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
  const storedUrl = localStorage.getItem('user_cloudflare_api_url');
  const token = localStorage.getItem('user_cloudflare_api_token');

  if (!storedUrl || !token) {
    throw new Error('Cloudflare Image API is not configured.');
  }

  const modelPreset = getModelPreset(options.model);
  const stylePreset = getStylePreset(options.style);
  const ratioPreset = getRatioPreset(options.ratio);

  const accountMatch = storedUrl.match(/\/accounts\/([^/]+)/);
  const accountId = accountMatch ? accountMatch[1] : '';
  const isDirectApi = !!accountId;
  const url = isDirectApi
    ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelPreset.modelId}`
    : storedUrl;

  const enhancedPrompt = [
    prompt,
    stylePreset.promptModifiers,
    BASE_QUALITY_TERMS
  ].join(', ');

  const requestBody: Record<string, unknown> = { prompt: enhancedPrompt };

  if (isDirectApi) {
    const negativePrompt = [
      BASE_NEGATIVE_PROMPT,
      stylePreset.negativePromptAdditions
    ].join(', ');
    requestBody.negative_prompt = negativePrompt;
    requestBody.width = ratioPreset.width;
    requestBody.height = ratioPreset.height;
    requestBody.num_steps = Math.min(options.steps ?? 8, modelPreset.maxSteps);
    requestBody.guidance = 7.5;
  }

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

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const json = await response.json();
    const base64 = json?.result?.image || json?.image;
    if (base64) {
      return `data:image/png;base64,${base64}`;
    }
    throw new Error('Cloudflare API returned JSON without image data.');
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
