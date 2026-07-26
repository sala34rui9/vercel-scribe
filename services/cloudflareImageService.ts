import { supabase } from './supabaseClient';
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
  const accountId = localStorage.getItem('user_cloudflare_api_url') || '';
  const token = localStorage.getItem('user_cloudflare_api_token');

  // We still check for credentials, though the URL might now just be the account ID
  if (!accountId || !token) {
    throw new Error('Cloudflare API Token or Account ID is not configured.');
  }

  // Handle both raw Account ID or the legacy full URL logic (extracting account ID)
  let cleanAccountId = accountId;
  const accountMatch = accountId.match(/\/accounts\/([^/]+)/);
  if (accountMatch) {
    cleanAccountId = accountMatch[1];
  } else {
    // Basic cleanup in case they pasted spaces
    cleanAccountId = cleanAccountId.trim();
  }

  const modelPreset = getModelPreset(options.model);
  const stylePreset = getStylePreset(options.style);
  const ratioPreset = getRatioPreset(options.ratio);

  const enhancedPrompt = [
    prompt,
    stylePreset.promptModifiers,
    BASE_QUALITY_TERMS
  ].join(', ');

  const negativePrompt = [
    BASE_NEGATIVE_PROMPT,
    stylePreset.negativePromptAdditions
  ].join(', ');

  const requestBody: Record<string, unknown> = {
    prompt: enhancedPrompt,
    negative_prompt: negativePrompt,
    width: ratioPreset.width,
    height: ratioPreset.height,
    num_steps: Math.min(options.steps ?? 20, modelPreset.maxSteps),
    guidance: 7.5
  };

  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: {
      accountId: cleanAccountId,
      apiToken: token,
      modelId: modelPreset.modelId,
      requestBody
    }
  });

  if (error) {
    throw new Error(`Edge Function Error: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(`Cloudflare API Error: ${data.error}`);
  }

  if (!data?.image) {
    throw new Error('No image data returned from Edge Function.');
  }

  return data.image;
};
