/**
 * Research Provider Utilities
 * Handles Auto fallback logic and provider resolution for research operations.
 */

import { SearchProvider } from '../types';

/**
 * Resolves the "Auto" provider to the best available concrete provider
 * by checking which API keys are present.
 * Priority: TinyFish > Tavily (since TinyFish is the newer addition).
 */
export const resolveAutoProvider = (
  selected: SearchProvider | undefined
): SearchProvider => {
  if (selected && selected !== SearchProvider.AUTO) {
    return selected;
  }

  // Auto mode: pick whichever provider has a key available
  const tinyfishKey = localStorage.getItem('user_tinyfish_api_key')?.trim();
  const tavilyKey = localStorage.getItem('user_tavily_api_key')?.trim();

  if (tinyfishKey) return SearchProvider.TINYFISH;
  if (tavilyKey) return SearchProvider.TAVILY;

  // Last resort — return Tavily so the downstream code can show a missing-key error
  return SearchProvider.TAVILY;
};

/**
 * Checks whether a provider is one of the web-scanning providers
 * (Tavily or TinyFish) that can be used with DeepSeek.
 */
export const isWebScanProvider = (provider: SearchProvider | undefined): boolean => {
  return provider === SearchProvider.TAVILY ||
         provider === SearchProvider.TINYFISH ||
         provider === SearchProvider.AUTO;
};

export interface FallbackResult<T> {
  data: T;
  provider: SearchProvider;
  usedFallback: boolean;
}

/**
 * Executes a research operation with Auto-fallback.
 *
 * Behaviour:
 * - If the user explicitly selected a provider → use only that provider. On failure, throw.
 * - If the user selected "Auto" → try the primary resolved provider.
 *   If it fails, retry once. If still failing, try the other provider.
 *   Logs fallback events.
 */
export async function withAutoFallback<T>(
  selectedProvider: SearchProvider | undefined,
  tavilyFn: () => Promise<T>,
  tinyfishFn: () => Promise<T>,
  operationLabel: string
): Promise<FallbackResult<T>> {
  const isAuto = selectedProvider === SearchProvider.AUTO;
  const resolved = resolveAutoProvider(selectedProvider);

  const primaryFn = resolved === SearchProvider.TINYFISH ? tinyfishFn : tavilyFn;
  const fallbackFn = resolved === SearchProvider.TINYFISH ? tavilyFn : tinyfishFn;
  const fallbackProvider = resolved === SearchProvider.TINYFISH
    ? SearchProvider.TAVILY
    : SearchProvider.TINYFISH;

  try {
    const data = await primaryFn();
    console.log(`[ResearchProvider] ${operationLabel} succeeded with ${resolved}`);
    return { data, provider: resolved, usedFallback: false };
  } catch (primaryError: any) {
    console.warn(`[ResearchProvider] ${operationLabel} failed with ${resolved}:`, primaryError.message);

    if (!isAuto) {
      // Explicit selection — retry once, then throw
      console.log(`[ResearchProvider] ${operationLabel}: Retrying ${resolved} once...`);
      try {
        const data = await primaryFn();
        return { data, provider: resolved, usedFallback: false };
      } catch (retryError: any) {
        console.error(`[ResearchProvider] ${operationLabel}: Retry with ${resolved} also failed`, retryError.message);
        throw retryError;
      }
    }

    // Auto mode — retry once with primary, then fall back to the other provider
    console.log(`[ResearchProvider] ${operationLabel}: Auto mode — retrying ${resolved} once...`);
    try {
      const data = await primaryFn();
      return { data, provider: resolved, usedFallback: false };
    } catch (retryError: any) {
      console.warn(`[ResearchProvider] ${operationLabel}: Auto retry failed, falling back to ${fallbackProvider}`);
      try {
        const data = await fallbackFn();
        console.log(`[ResearchProvider] ${operationLabel}: Fallback to ${fallbackProvider} succeeded`);
        return { data, provider: fallbackProvider, usedFallback: true };
      } catch (fallbackError: any) {
        console.error(`[ResearchProvider] ${operationLabel}: Fallback to ${fallbackProvider} also failed`, fallbackError.message);
        throw fallbackError;
      }
    }
  }
}
