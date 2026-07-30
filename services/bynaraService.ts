import { ArticleConfig, BynaraModel, OpeningStyle, ReadabilityLevel, TargetCountry, SearchProvider, InternalLink } from "../types";
import { resolveAutoProvider } from './researchProviderUtils';
import { supabase } from './supabaseClient';

const BYNARA_API_URL = "https://router.bynara.id/v1/chat/completions";
const LOCAL_STORAGE_KEY_KEY = 'user_bynara_api_key';
const REQUEST_TIMEOUT_MS = 120000; // 120 seconds (LLM calls can be slow)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000; // 3 seconds between retries

// Connection method - set localStorage 'bynara_connection' to:
//   - 'edge_function' (default): Routes through Supabase Edge Function (no CORS, most reliable)
//   - 'direct': Calls API directly (will fail in browser due to CORS)
const getConnectionMethod = (): string => {
  return localStorage.getItem('bynara_connection') || 'edge_function';
};

const getApiKey = (): string => {
  const customKey = localStorage.getItem(LOCAL_STORAGE_KEY_KEY);
  if (customKey && customKey.trim().length > 0) {
    return customKey.trim();
  }
  return '';
};

/**
 * Calls the ByNara API through the Supabase Edge Function (no CORS issues).
 * This is the most reliable method as it routes server-side.
 */
const callBynaraEdgeFunction = async (
  apiKey: string,
  payload: any,
  signal?: AbortSignal
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Merge external signal with timeout controller
  const abortHandler = () => controller.abort();
  if (signal) {
    signal.addEventListener('abort', abortHandler);
  }

  try {
    console.log(`[Bynara] Calling via Supabase Edge Function, model: ${payload.model}`);

    // Use Supabase functions.invoke to call the edge function
    const { data, error } = await supabase.functions.invoke('bynara-proxy', {
      body: {
        apiKey: apiKey,
        payload: payload
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', abortHandler);

    if (error) {
      if (error.context instanceof Response) {
        return error.context;
      } else if (error.context && typeof error.context.text === 'function') {
        const body = await error.context.text();
        return new Response(body, {
          status: error.context.status || 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(
        JSON.stringify({ error: { message: error.message || 'Edge function error' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', abortHandler);

    if (error.name === 'AbortError') {
      throw error;
    }

    throw error;
  }
};

/**
 * Unified ByNara API call - tries edge function first, then falls back to direct call (if specified).
 * This is the main entry point for all ByNara API calls.
 */
export const callBynaraApi = async (
  apiKey: string,
  payload: any,
  signal?: AbortSignal
): Promise<Response> => {
  const connectionMethod = getConnectionMethod();

  // Direct call (will fail in browser due to CORS, but works in Node.js)
  if (connectionMethod === 'direct') {
    console.log('[Bynara] Trying direct API call...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const abortHandler = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', abortHandler);
    }

    try {
      const response = await fetch(BYNARA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', abortHandler);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', abortHandler);
      throw error;
    }
  }

  // Method 1: Supabase Edge Function (most reliable, no CORS)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      'Supabase not configured. Please set VITE_SUPABASE_URL in your environment.'
    );
  }

  return await callBynaraEdgeFunction(apiKey, payload, signal);
};

/**
 * Helper to log and diagnose API request issues
 */
const logApiDiagnostics = (label: string, apiKey: string, error?: Error) => {
  const keyPreview = apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}` : 'MISSING';
  console.log(`[Bynara ${label}] API Key: ${keyPreview}, URL: ${BYNARA_API_URL}`);
  if (error) {
    console.error(`[Bynara ${label}] Error:`, error.message, error);
  }
};

/**
 * Helper to clean up Bynara's output which often includes Markdown code blocks
 * or conversational text around the JSON.
 */
const cleanJsonOutput = (text: string): string => {
  let clean = text.trim();

  // 1. Strip Markdown code block syntax specifically
  clean = clean.replace(/```json/gi, '').replace(/```/g, '');

  // 2. Find the first valid JSON object brace structure
  // This helps if there is text before or after the JSON
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }

  return clean.trim();
};

export const generatePrimaryKeywordsBynara = async (topic: string): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[Bynara] No API key found for generatePrimaryKeywords');
    throw new Error("Bynara API Key is missing. Please add your API key in Settings.");
  }

  const payload = {
    model: BynaraModel.MISTRAL_LARGE,
    messages: [
      {
        role: "system",
        content: "You are an expert SEO Specialist."
      },
      {
        role: "user",
        content: `Analyze the topic: "${topic}". Identify 5-7 high-potential Primary SEO Keywords.
        Return ONLY a raw JSON object with a 'keywords' array of strings. No markdown formatting.`
      }
    ],
    response_format: { type: "json_object" }
  };

  try {
    logApiDiagnostics('generatePrimaryKeywords', apiKey);

    const response = await callBynaraApi(apiKey, payload);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logApiDiagnostics('generatePrimaryKeywords (HTTP Error)', apiKey);
      console.error(`[Bynara] HTTP ${response.status}:`, errorData);
      throw new Error(`Bynara API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const cleanedContent = cleanJsonOutput(content);
      const json = JSON.parse(cleanedContent);
      return Array.isArray(json.keywords) ? json.keywords : [];
    } catch (e) {
      console.warn("Bynara keyword parse failed", e, "Content:", content);
      return [];
    }
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      logApiDiagnostics('generatePrimaryKeywords (Network Error)', apiKey, error);
      console.error('[Bynara] Network error:', error);
      throw new Error(`Bynara connection failed: Check internet & API key. If in browser, CORS may be blocking the request.`);
    }
    if (error.name === 'AbortError') {
      throw new Error('Bynara request timed out. Please try again.');
    }
    console.error("Bynara keyword generation error:", error);
    throw error;
  }
};

export const generateNLPKeywordsBynara = async (topic: string): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[Bynara] No API key found for generateNLPKeywords');
    throw new Error("Bynara API Key is missing. Please add your API key in Settings.");
  }

  const payload = {
    model: BynaraModel.MISTRAL_LARGE,
    messages: [
      {
        role: "system",
        content: "You are an expert SEO Specialist."
      },
      {
        role: "user",
        content: `Generate 10-15 high-value NLP and LSI keywords related to: "${topic}".
        Return ONLY a raw JSON object with a 'keywords' array of strings. No markdown formatting.`
      }
    ],
    response_format: { type: "json_object" }
  };

  try {
    logApiDiagnostics('generateNLPKeywords', apiKey);

    const response = await callBynaraApi(apiKey, payload);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logApiDiagnostics('generateNLPKeywords (HTTP Error)', apiKey);
      console.error(`[Bynara] HTTP ${response.status}:`, errorData);
      throw new Error(`Bynara API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const cleanedContent = cleanJsonOutput(content);
      const json = JSON.parse(cleanedContent);
      return Array.isArray(json.keywords) ? json.keywords : [];
    } catch (e) {
      console.warn("Bynara NLP parse failed", e, "Content:", content);
      return [];
    }
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      logApiDiagnostics('generateNLPKeywords (Network Error)', apiKey, error);
      console.error('[Bynara] Network error:', error);
      throw new Error(`Bynara connection failed: Check internet & API key. If in browser, CORS may be blocking the request.`);
    }
    if (error.name === 'AbortError') {
      throw new Error('Bynara request timed out. Please try again.');
    }
    console.error("Bynara NLP keyword generation error:", error);
    throw error;
  }
};

export const generateFullSEOStrategyBynara = async (topic: string): Promise<{ primaryKeywords: string[], nlpKeywords: string[] }> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[Bynara] No API key found for generateFullSEOStrategy');
    throw new Error("Bynara API Key is missing. Please add your API key in Settings.");
  }

  const payload = {
    model: BynaraModel.MISTRAL_LARGE,
    messages: [
      {
        role: "system",
        content: "You are an expert SEO Specialist."
      },
      {
        role: "user",
        content: `Analyze the topic: "${topic}".
        Generate a complete SEO strategy:
        1. 5-7 Primary Keywords (Head & Long-tail).
        2. 10-15 NLP/LSI Keywords (Contextual).

        Return ONLY a raw JSON object with keys 'primaryKeywords' and 'nlpKeywords'. No markdown.`
      }
    ],
    response_format: { type: "json_object" }
  };

  try {
    logApiDiagnostics('generateFullSEOStrategy', apiKey);

    const response = await callBynaraApi(apiKey, payload);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Bynara API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const cleanedContent = cleanJsonOutput(content);
      const json = JSON.parse(cleanedContent);
      return {
        primaryKeywords: Array.isArray(json.primaryKeywords) ? json.primaryKeywords : [],
        nlpKeywords: Array.isArray(json.nlpKeywords) ? json.nlpKeywords : []
      };
    } catch (parseError) {
      console.warn("Bynara Full Strategy parse failed", parseError, "Content:", content);

      // Fallback: try reasonable defaults if keys are missing but content exists
      try {
        const fallbackJson = JSON.parse(cleanJsonOutput(content));
        return {
          primaryKeywords: fallbackJson.primaryKeywords || fallbackJson.primary || fallbackJson.keywords || [],
          nlpKeywords: fallbackJson.nlpKeywords || fallbackJson.nlp || fallbackJson.lsi || []
        };
      } catch {
        return { primaryKeywords: [], nlpKeywords: [] };
      }
    }
  } catch (error: any) {
    console.error("Bynara Full Strategy error:", error);
    throw error;
  }
};

export const generateArticleBynara = async (config: ArticleConfig, signal?: AbortSignal): Promise<{ content: string; sources: string[] }> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Bynara API Key is missing. Please add your API Key in the settings.");
  }

  const {
    topic,
    wordCount,
    type,
    tone,
    primaryKeywords,
    nlpKeywords,
    includeFaq,
    includeConclusion,
    websiteUrl,
    deepResearch,
    realTimeData,
    internalLinks,
    externalLinks,
    openingStyle,
    readability,
    humanizeContent,
    targetCountry,
    bynaraModel,
    includeItalics,
    includeBold,
    includeBulletPoints,
    includeTables,
    personalResources
  } = config;

  // --- PURE DEEPSEEK EXECUTION ---
  // We do NOT call Gemini for research here to avoid mixed-provider errors.
  // Instead, we instruct Bynara to use its internal knowledge.

  // --- PROMPT CONSTRUCTION ---

  let internalLinkingInstructions = "";
  if (internalLinks && internalLinks.length > 0) {
    internalLinkingInstructions = `
      MANDATORY INTERNAL LINKS (CRITICAL):
      You MUST include the following internal links in the article body.
      This is a strict requirement. Do not ignore it.
      
      INSTRUCTIONS:
      1. For each link below, find a relevant sentence in the content to place it.
      2. Use natural anchor text (do not use "click here").
      3. YOU MUST USE MARKDOWN SYNTAX: [Anchor Text](URL)
      4. Do not list them at the end. They must be woven into the paragraphs.
      
      LINKS TO INSERT:
      ${internalLinks.map(link => `- Context/Topic: "${link.title}" -> Link: ${link.url}`).join("\n")}
      `;
  }

  let externalLinkingInstructions = "";
  if (externalLinks && externalLinks.length > 0) {
    externalLinkingInstructions = `
      MANDATORY EXTERNAL LINKS (CITATIONS):
      You MUST include the following external links in the article.
      
      INSTRUCTIONS:
      1. Cite these sources naturally where they support a fact, statistic, or definition.
      2. Use descriptive anchor text representing the source or the data.
      3. YOU MUST USE MARKDOWN SYNTAX: [Anchor Text](URL)
      
      EXTERNAL SOURCES TO CITE:
      ${externalLinks.map(link => `- Source: "${link.title}" (${link.url})`).join("\n")}
      `;
  }

  let openingInstruction = "";
  if (openingStyle && openingStyle !== OpeningStyle.NONE) {
    openingInstruction = `
      OPENING/INTRODUCTION STYLE REQUIREMENT:
      You MUST start the article with a "${openingStyle}" style introduction.
      `;
  }

  let readabilityInstruction = "";
  if (readability && readability !== ReadabilityLevel.NONE) {
    readabilityInstruction = `
      READABILITY LEVEL REQUIREMENT:
      Target Reading Level: ${readability}
      `;
  }

  let humanizeInstruction = "";
  if (humanizeContent) {
    humanizeInstruction = `
    "HUMANIZE CONTENT" MODE ENABLED (ANTI-ROBOTIC WRITING):
    You MUST write in a natural, human-like manner. The user explicitly wants to avoid "AI-sounding" text.
    
    STRICTLY BANNED WORDS/PHRASES (NEVER USE THESE - INSTANT PENALTY):
    - "Delve", "Dive deep", "In the ever-evolving landscape", "Game-changer", "Unleash", "Unlock"
    - "Elevate", "Realm", "Tapestry", "Symphony", "In conclusion", "It is important to note"
    - "In today's world", "Cutting-edge", "Revolutionize", "Leverage", "Harness the power"
    - "First and foremost", "Furthermore", "Moreover", "Additionally", "Navigate the complexities"
    - "At the end of the day", "Moving forward", "In essence", "Ultimately", "As such", "Thus", "Therefore"
    - "A myriad of", "Plethora", "Multitude", "Vast array", "Seamlessly", "Effortlessly", "Robust"
    - "Streamline", "Empower", "Synergy", "Holistic", "Paradigm shift", "It goes without saying"
    - "Needless to say", "It's worth noting", "Not only...but also", "Whether you're...or..."
    - "From X to Y", "Journey", "Landscape", "Crucial", "Pivotal", "Comprehensive", "Beacon"
    - "Testament", "Nestled", "Bustling", "Hidden gem", "Architect", "Masterpiece", "Underscore"
    
    HUMAN WRITING GUIDELINES:
    - Use short, punchy sentences. Fragment sentences are okay for effect.
    - Start sentences with conjunctions (And, But, So, Or).
    - REQUIRED: Use contractions everywhere (don't, won't, can't, it's, you'll).
    - Use First and Second person (I, We, You) to build a connection.
    - Ask rhetorical questions to engage the reader.
    - Use simple, Anglo-Saxon words over Latinate complex ones.
    - write like you are talking to a friend over a coffee. Casual but informative.
    - ALLOW quirks and personal opinions.
    `;
  }

  // Construct Formatting Instructions
  let formattingInstruction = `
    FORMATTING GUIDELINES (STRICT):
    1. Use H2 (##) and H3 (###) for clear hierarchy.
  `;

  if (includeBulletPoints) {
    formattingInstruction += `\n    2. USE BULLET POINTS: Break down complex lists or features into bullet points for readability.`;
  } else {
    formattingInstruction += `\n    2. DO NOT use bullet points. Use full paragraphs only.`;
  }

  if (includeTables) {
    formattingInstruction += `
    3. USE TABLES: For comparisons, data, or pros/cons, use proper Markdown tables.
       CRITICAL: Tables MUST have:
       - A header row with column names separated by |
       - A separator row with dashes (e.g., | --- | --- |)
       - Data rows with values separated by |
       - EACH ROW ON A NEW LINE (not inline)
       
       CORRECT Markdown Table Example:
       | Feature | Description | Rating |
       | --- | --- | --- |
       | Speed | Very fast | 9/10 |
       | Price | Affordable | 8/10 |
       
       WRONG (do NOT do this): | Feature | Description | | --- | --- | | Speed | Very fast |
    `;
  } else {
    formattingInstruction += `\n    3. DO NOT use Markdown tables. Present all data in paragraph or list format.`;
  }

  if (includeBold) {
    formattingInstruction += `\n    4. USE BOLD TEXT (**text**): Highlight *specific* key terms, important stats, or "aha!" moments. DO NOT bold entire sentences.`;
  } else {
    formattingInstruction += `\n    4. DO NOT use bold text (**text**). Keep all text weight uniform.`;
  }

  if (includeItalics) {
    formattingInstruction += `\n    5. USE ITALICS (*text*): Use for emphasis on spoken-word stress or foreign terms. Use sparingly.`;
  } else {
    formattingInstruction += `\n    5. DO NOT use italics (*text*). Keep all text style uniform.`;
  }

  // Adapted instructions for Bynara-only execution
  let deepResearchInstruction = "";
  let deepResearchContext = "";
  if (deepResearch && websiteUrl) {
    // CHECK FOR CACHED BRAND RESEARCH FIRST (Bulk Mode Optimization)
    if (config.cachedBrandResearch && config.cachedBrandResearch.content) {
      console.log('[Bynara] Using CACHED brand research (no API call)');
      deepResearchContext = config.cachedBrandResearch.content;
      deepResearchInstruction = `
      BRAND ANALYSIS (Cached - Pre-fetched):
      The following brand/site analysis was gathered:
      ${deepResearchContext.substring(0, 3000)}
      
      Site Architecture discovered:
      ${config.cachedBrandResearch.siteArchitecture.slice(0, 10).join('\n')}
      
      Please adapt your writing tone to align with this brand presence.
          `;
    }
    // Use the configured research provider (or resolve Auto) for brand analysis
    else {
      const resolvedProvider = resolveAutoProvider(config.researchProvider);
      try {
        if (resolvedProvider === SearchProvider.TINYFISH) {
          const { analyzeBrandWebsiteTinyFish, getTinyFishApiKey } = await import('./tinyfishService');
          if (getTinyFishApiKey()) {
            console.log('[Bynara] Using TinyFish for deep brand research');
            const brandAnalysis = await analyzeBrandWebsiteTinyFish(websiteUrl);
            if (brandAnalysis.content) {
              deepResearchContext = brandAnalysis.content;
              deepResearchInstruction = `
      BRAND ANALYSIS (via TinyFish):
      The following brand/site analysis was gathered:
      ${deepResearchContext.substring(0, 12000)}
      
      Site Architecture discovered:
      ${brandAnalysis.siteArchitecture.slice(0, 10).join('\n')}
      
      Please adapt your writing tone to align with this brand presence.
          `;
            }
          }
        } else {
          // Default: Tavily
          const { analyzeBrandWebsite, getTavilyApiKey } = await import('./tavilyService');
          if (getTavilyApiKey()) {
            console.log('[Bynara] Using Tavily Crawl for deep brand research');
            const brandAnalysis = await analyzeBrandWebsite(websiteUrl);
            if (brandAnalysis.content) {
              deepResearchContext = brandAnalysis.content;
              deepResearchInstruction = `
      BRAND ANALYSIS (via Tavily Crawl):
      The following brand/site analysis was gathered:
      ${deepResearchContext.substring(0, 3000)}
      
      Site Architecture discovered:
      ${brandAnalysis.siteArchitecture.slice(0, 10).join('\n')}
      
      Please adapt your writing tone to align with this brand presence.
          `;
            }
          }
        }
      } catch (e) {
        console.warn('[Bynara] Brand research failed, using fallback', e);
      }
    }

    // Fallback if Tavily not available
    if (!deepResearchInstruction) {
      deepResearchInstruction = `
      BRAND ANALYSIS INSTRUCTION:
      The user has provided a Brand Website: ${websiteUrl}.
      Please analyze this URL (based on your internal training data/knowledge) to infer the brand's likely voice, industry, and structure.
      Adapt your writing tone to align with this brand presence.
      `;
    }
  }

  let realTimeDataInstruction = "";
  let realTimeContext = "";
  let realTimeSources: string[] = [];

  if (realTimeData) {
    // Resolve Auto provider for real-time search
    const resolvedSearchProvider = config.searchProvider === SearchProvider.AUTO
      ? resolveAutoProvider(config.searchProvider)
      : config.searchProvider;

    // Fetch real-time data using selected search provider
    if (resolvedSearchProvider === SearchProvider.TAVILY) {
      // Use Tavily for real-time search
      try {
        const { fetchRealTimeDataTavily, getTavilyApiKey } = await import('./tavilyService');
        if (getTavilyApiKey()) {
          console.log('[Bynara] Using Tavily Search for real-time data');
          const data = await fetchRealTimeDataTavily(config.topic);
          realTimeContext = data.content;
          realTimeSources = data.sources;
          realTimeDataInstruction = `
      DATA FRESHNESS INSTRUCTION:
      The following real-time search data was retrieved via Tavily:
      ${realTimeContext}
      
      Please incorporate this information into your article to ensure it's current and relevant.
          `;
        }
      } catch (e) {
        console.warn('[Bynara] Tavily Search failed', e);
      }
    } else if (resolvedSearchProvider === SearchProvider.TINYFISH) {
      // Use TinyFish for real-time search
      try {
        const { fetchRealTimeDataTinyFish, getTinyFishApiKey } = await import('./tinyfishService');
        if (getTinyFishApiKey()) {
          console.log('[Bynara] Using TinyFish for real-time data');
          const data = await fetchRealTimeDataTinyFish(config.topic);
          realTimeContext = data.content;
          realTimeSources = data.sources;
          realTimeDataInstruction = `
      DATA FRESHNESS INSTRUCTION:
      The following real-time search data was retrieved via TinyFish:
      ${realTimeContext}
      
      Please incorporate this information into your article to ensure it's current and relevant.
          `;
        }
      } catch (e) {
        console.warn('[Bynara] TinyFish Search failed', e);
      }
    } else if (resolvedSearchProvider === SearchProvider.SERPSTACK) {
      // Use SERPStack for real-time search
      const { fetchRealTimeDataSERPStack } = await import('./serpstackService');
      const data = await fetchRealTimeDataSERPStack(config.topic);
      realTimeContext = data.content;
      realTimeSources = data.sources;
      realTimeDataInstruction = `
      DATA FRESHNESS INSTRUCTION:
      The following real-time search data was retrieved:
      ${realTimeContext}
      
      Please incorporate this information into your article to ensure it's current and relevant.
      `;
    }

    // Fallback: use Bynara's internal knowledge (no external search)
    if (!realTimeDataInstruction) {
      realTimeDataInstruction = `
      DATA FRESHNESS INSTRUCTION:
      The user requested Real-Time Data. 
      Please use your most recent internal knowledge to provide up-to-date statistics, news, or trends relevant to the topic.
      `;
    }
  }

  // Process manual reference URLs if provided
  let manualReferencesInstruction = "";
  if (config.manualReferenceUrls && config.manualReferenceUrls.length > 0) {
    const resolvedRefProvider = resolveAutoProvider(config.researchProvider);
    try {
      if (resolvedRefProvider === SearchProvider.TINYFISH) {
        const { extractManualReferencesTinyFish, getTinyFishApiKey } = await import('./tinyfishService');
        if (getTinyFishApiKey()) {
          console.log('[Bynara] Extracting manual references via TinyFish');
          // TinyFish uses query-based search; search for each URL
          for (const refUrl of config.manualReferenceUrls.slice(0, 5)) {
            const extracted = await extractManualReferencesTinyFish(refUrl);
            if (extracted.content) {
              realTimeSources = [...realTimeSources, ...extracted.sources];
              manualReferencesInstruction += `\n${extracted.content.substring(0, 3000)}`;
            }
          }
          if (manualReferencesInstruction) {
            manualReferencesInstruction = `
      MANUAL REFERENCE MATERIALS:
      The user provided the following URLs for reference. Use this information:
      ${manualReferencesInstruction.substring(0, 12000)}
            `;
          }
        }
      } else {
        // Default: Tavily extract
        const { extractManualReferences, getTavilyApiKey } = await import('./tavilyService');
        if (getTavilyApiKey()) {
          console.log('[Bynara] Extracting manual reference URLs via Tavily');
          const extracted = await extractManualReferences(config.manualReferenceUrls);
          if (extracted.content) {
            realTimeSources = [...realTimeSources, ...extracted.sources];
            manualReferencesInstruction = `
      MANUAL REFERENCE MATERIALS:
      The user provided the following URLs for reference. Use this information:
      ${extracted.content.substring(0, 3000)}
            `;
          }
        }
      }
    } catch (e) {
      console.warn('[Bynara] Manual reference extraction failed', e);
    }
  }

  let countryInstruction = "";
  if (targetCountry && targetCountry !== TargetCountry.GLOBAL) {
    countryInstruction = `
        TARGET AUDIENCE LOCALIZATION:
        Target Country: ${targetCountry}
        Use appropriate spelling (e.g., Color vs Colour), currency, and cultural references for this location.
        `;
  }

  // Construct Personal Resources Instructions
  let personalResourcesInstruction = "";
  if (personalResources) {
    personalResourcesInstruction = `
      PERSONAL RESOURCES & SPECIFIC CONTEXT:
      The user has provided the following personal resources/context to be used for this article.
      YOU MUST prioritize facts, statistics, tone, or specific guidelines found in this text.
      
      --- PERSONAL RESOURCES START ---
      ${personalResources}
      --- PERSONAL RESOURCES END ---
      `;
  }

  // Construct SE Ranking Intelligence Instructions
  let seoRankingInstruction = "";
  if (config.seoRankingData) {
    const { lostKeywords, competitorGaps, aiOverviewKeywords } = config.seoRankingData;
    const parts: string[] = [];
    if (lostKeywords && lostKeywords.length > 0) {
      parts.push(`LOST KEYWORDS (Re-capture Opportunities):\nThese keywords previously ranked but were lost. Weave them naturally into the content:\n${lostKeywords.join(", ")}`);
    }
    if (competitorGaps && competitorGaps.length > 0) {
      parts.push(`COMPETITOR GAP KEYWORDS (Untapped Opportunities):\nThese keywords your competitors rank for but you don't. Target them strategically:\n${competitorGaps.join(", ")}`);
    }
    if (aiOverviewKeywords && aiOverviewKeywords.length > 0) {
      parts.push(`AI OVERVIEW KEYWORDS (Featured Snippet Targeting):\nThese keywords trigger AI Overviews. Structure sections with clear Q&A format for these:\n${aiOverviewKeywords.join(", ")}`);
    }
    if (parts.length > 0) {
      seoRankingInstruction = `
      SE RANKING INTELLIGENCE (DATA-DRIVEN OPTIMIZATION):
      The following keyword intelligence was gathered from live search engine ranking data.
      You MUST incorporate these strategically into the article.

      ${parts.join("\n\n      ")}
      `;
    }
  }

  let sectionOrderInstruction = `
      STRICT SECTION ORDERING:
      1. Introduction
      2. Body Paragraphs
      ${includeConclusion ? "3. Conclusion / Key Takeaways (Header: ## Conclusion)" : ""}
      ${includeFaq ? "4. FAQ Section (Header: ## Frequently Asked Questions)" : ""}
      
      CRITICAL: ${includeFaq ? "You MUST include a FAQ section AFTER the Conclusion." : "DO NOT include a FAQ section."}
    `;

  const userPrompt = `
      TASK: Write a comprehensive ${type} about "${topic}".
      
      CONFIGURATION:
      - Target Word Count: Approximately ${wordCount} words.
      - Tone/Brand Voice: ${tone}.
      ${websiteUrl ? `- Brand Website: ${websiteUrl}` : ""}
      - Primary Keywords: ${primaryKeywords.join(", ")}.
      - NLP Keywords: ${nlpKeywords.join(", ")}.
      
      ${deepResearchInstruction}
      ${realTimeDataInstruction}
      ${manualReferencesInstruction}
      ${countryInstruction}
      ${openingInstruction}
      ${readabilityInstruction}
      ${humanizeInstruction}
      
      ${personalResourcesInstruction}
      
      ${seoRankingInstruction}
      
      ${formattingInstruction}
      
      CONTENT REQUIREMENTS:
      ${internalLinkingInstructions}
      ${externalLinkingInstructions}
      ${sectionOrderInstruction}
      
      Output in pure Markdown.
    `;

  // --- MODEL MAPPING ---
  // Maps BynaraModel enum to actual API model IDs from ByNara's available models
  // See: https://router.bynara.id/v1/models
  let apiModel = BynaraModel.MISTRAL_LARGE; // Default to Mistral Large (free tier compatible)
  let systemPrompt = "You are an expert SEO Content Writer.";

  switch (bynaraModel) {
    case BynaraModel.MISTRAL_LARGE:
      apiModel = BynaraModel.MISTRAL_LARGE;
      systemPrompt = "You are an expert SEO Content Writer.";
      break;
    case BynaraModel.DEEPSEEK_V4_FLASH:
      apiModel = BynaraModel.DEEPSEEK_V4_FLASH;
      systemPrompt = "You are an expert SEO Content Writer.";
      break;
    case BynaraModel.DEEPSEEK_V4_PRO:
      apiModel = BynaraModel.DEEPSEEK_V4_PRO;
      systemPrompt = "You are an advanced reasoning engine specialized for high-end creative and technical writing. You prioritize depth, nuance, and structural perfection.";
      break;
    case BynaraModel.DEEPSEEK_V4_FLASH_ALIBABA:
      apiModel = BynaraModel.DEEPSEEK_V4_FLASH_ALIBABA;
      systemPrompt = "You are an expert SEO Content Writer.";
      break;
    case BynaraModel.DEEPSEEK_V4_PRO_ALIBABA:
      apiModel = BynaraModel.DEEPSEEK_V4_PRO_ALIBABA;
      systemPrompt = "You are an advanced reasoning engine specialized for high-end creative and technical writing. You prioritize depth, nuance, and structural perfection.";
      break;
    case BynaraModel.CLAUDE_SONNET_5:
      apiModel = BynaraModel.CLAUDE_SONNET_5;
      systemPrompt = "You are an expert SEO Content Writer.";
      break;
    case BynaraModel.CLAUDE_OPUS_4_7:
      apiModel = BynaraModel.CLAUDE_OPUS_4_7;
      systemPrompt = "You are an advanced reasoning engine specialized for high-end creative and technical writing. You prioritize depth, nuance, and structural perfection.";
      break;
    case BynaraModel.GPT_5_4:
      apiModel = BynaraModel.GPT_5_4;
      systemPrompt = "You are an expert SEO Content Writer.";
      break;
    case BynaraModel.GPT_5_5:
      apiModel = BynaraModel.GPT_5_5;
      systemPrompt = "You are an advanced reasoning engine specialized for high-end creative and technical writing. You prioritize depth, nuance, and structural perfection.";
      break;
    case BynaraModel.GROK_4_5:
      apiModel = BynaraModel.GROK_4_5;
      systemPrompt = "You are an expert SEO Content Writer.";
      break;
    case BynaraModel.KIMI_K3:
      apiModel = BynaraModel.KIMI_K3;
      systemPrompt = "You are an advanced reasoning engine specialized for high-end creative and technical writing. You prioritize depth, nuance, and structural perfection.";
      break;
    case BynaraModel.GLM_5_2:
      apiModel = BynaraModel.GLM_5_2;
      systemPrompt = "You are an expert SEO Content Writer.";
      break;
    case BynaraModel.QWEN3_7_MAX:
      apiModel = BynaraModel.QWEN3_7_MAX;
      systemPrompt = "You are an advanced reasoning engine specialized for high-end creative and technical writing. You prioritize depth, nuance, and structural perfection.";
      break;
    case BynaraModel.MIXTRAL_MEDIUM_3_5:
      apiModel = BynaraModel.MIXTRAL_MEDIUM_3_5;
      systemPrompt = "You are an expert SEO Content Writer.";
      break;
    case BynaraModel.MIMAX_M3:
      apiModel = BynaraModel.MIMAX_M3;
      systemPrompt = "You are an expert SEO Content Writer.";
      break;
    case BynaraModel.AGNES_2_5_FLASH:
      apiModel = BynaraModel.AGNES_2_5_FLASH;
      systemPrompt = "You are an expert SEO Content Writer.";
      break;
    default:
      // Fallback to Mistral Large for any unrecognized model
      apiModel = BynaraModel.MISTRAL_LARGE;
      systemPrompt = "You are an expert SEO Content Writer.";
      break;
  }

  const payload = {
    model: apiModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    stream: false
  };

  try {
    logApiDiagnostics('generateArticle', apiKey);
    console.log(`[Bynara] Using model: ${apiModel}, connection: ${getConnectionMethod()}`);

    const response = await callBynaraApi(apiKey, payload, signal);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errorMessage = err.error?.message || response.statusText;

      logApiDiagnostics('generateArticle (HTTP Error)', apiKey);
      console.error(`[Bynara] HTTP ${response.status}: ${errorMessage}`);
      console.error(`[Bynara] Full error response:`, err);

      if (errorMessage.includes("balance") || errorMessage.includes("payment")) {
        throw new Error(`Bynara API Payment Error: ${errorMessage}. Please check your balance at bynara.com.`);
      }

      if (response.status === 401 || errorMessage.includes("unauthorized") || errorMessage.includes("invalid")) {
        throw new Error(`Bynara API Authentication Failed: Your API key may be invalid. Visit https://bynara.id/api/keys to verify.`);
      }

      if (response.status === 404 || errorMessage.includes("model")) {
        throw new Error(`Bynara Model Error: Model "${apiModel}" not found. Please select a different model in settings. Available models include: mistral-large, deepseek-v4-flash, claude-sonnet-5, gpt-5.4, grok-4.5.`);
      }

      throw new Error(`Bynara API Error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Merge with real-time sources if available
    const sources = [...realTimeSources];

    return { content, sources };
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      logApiDiagnostics('generateArticle (Network Error)', apiKey, error);
      console.error('[Bynara] Full network error:', error);
      throw new Error(
        `Bynara API connection failed: ${error.message}\n\n` +
        `This is likely a CORS (Cross-Origin Resource Sharing) issue.\n` +
        `The browser is blocking the request to router.bynara.id.\n\n` +
        `Solutions:\n` +
        `1. Deploy the Supabase Edge Function: `npx supabase functions deploy bynara-proxy --no-verify-jwt`\n` +
        `3. Check internet connection and API key at https://bynara.id/api/keys\n` +
        `4. Verify your plan includes the selected model (${apiModel})\n` +
        `5. Try again in a few seconds`
      );
    }
    if (error.name === 'AbortError') {
      throw new Error('Bynara request timed out after 60 seconds. Please try again or select a faster model.');
    }
    logApiDiagnostics('generateArticle (Unexpected Error)', apiKey, error);
    throw error;
  }
};

/**
 * Uses Bynara to intelligently select the most relevant internal links for a given topic
 * from a provided list of potential links.
 */
export const selectBestInternalLinksBynara = async (topic: string, links: InternalLink[]): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey || links.length === 0) return [];

  const candidates = links.map(l => `- Title: "${l.title}", URL: ${l.url}`).join('\n');

  const payload = {
    model: BynaraModel.MISTRAL_LARGE,
    messages: [
      {
        role: "system",
        content: "You are an expert SEO Specialist."
      },
      {
        role: "user",
        content: `Analyze the topic: "${topic}".

        Evaluate these candidate internal links:
        ${candidates}

        Select the top 5-10 most relevant links that strictly compliment this topic.
        Return ONLY a raw JSON object with a "selectedUrls" array of strings. No markdown.`
      }
    ],
    response_format: { type: "json_object" }
  };

  try {
    logApiDiagnostics('selectBestInternalLinks', apiKey);

    const response = await callBynaraApi(apiKey, payload);

    if (!response.ok) {
      throw new Error(`Bynara API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const cleanedContent = cleanJsonOutput(content);
    const json = JSON.parse(cleanedContent);
    return Array.isArray(json.selectedUrls) ? json.selectedUrls : [];

  } catch (error) {
    console.error("Bynara link selection error:", error);
    // Fallback
    return links.slice(0, 5).map(l => l.url);
  }
};
