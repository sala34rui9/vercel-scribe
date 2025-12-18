import { ArticleConfig, DeepSeekModel, OpeningStyle, ReadabilityLevel, TargetCountry, SearchProvider, InternalLink } from "../types";

const DEEPSEEK_API_URL = "https://deepseek-proxy.ubantuplx.workers.dev";
const LOCAL_STORAGE_KEY_KEY = 'user_deepseek_api_key';

const getApiKey = (): string => {
  const customKey = localStorage.getItem(LOCAL_STORAGE_KEY_KEY);
  if (customKey && customKey.trim().length > 0) {
    return customKey.trim();
  }
  return '';
};

/**
 * Helper to log and diagnose API request issues
 */
const logApiDiagnostics = (label: string, apiKey: string, error?: Error) => {
  const keyPreview = apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}` : 'MISSING';
  console.log(`[DeepSeek ${label}] API Key: ${keyPreview}, URL: ${DEEPSEEK_API_URL}`);
  if (error) {
    console.error(`[DeepSeek ${label}] Error:`, error.message, error);
  }
};

/**
 * Helper to clean up DeepSeek's output which often includes Markdown code blocks
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

export const generatePrimaryKeywordsDeepSeek = async (topic: string): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[DeepSeek] No API key found for generatePrimaryKeywords');
    throw new Error("DeepSeek API Key is missing. Please add your API key in Settings.");
  }

  const payload = {
    model: "deepseek-chat",
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

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logApiDiagnostics('generatePrimaryKeywords (HTTP Error)', apiKey);
      console.error(`[DeepSeek] HTTP ${response.status}:`, errorData);
      throw new Error(`DeepSeek API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const cleanedContent = cleanJsonOutput(content);
      const json = JSON.parse(cleanedContent);
      return Array.isArray(json.keywords) ? json.keywords : [];
    } catch (e) {
      console.warn("DeepSeek keyword parse failed", e, "Content:", content);
      return [];
    }
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      logApiDiagnostics('generatePrimaryKeywords (Network Error)', apiKey, error);
      console.error('[DeepSeek] Network error:', error);
      throw new Error(`DeepSeek connection failed: Check internet & API key`);
    }
    console.error("DeepSeek keyword generation error:", error);
    throw error;
  }
};

export const generateNLPKeywordsDeepSeek = async (topic: string): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[DeepSeek] No API key found for generateNLPKeywords');
    throw new Error("DeepSeek API Key is missing. Please add your API key in Settings.");
  }

  const payload = {
    model: "deepseek-chat",
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

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logApiDiagnostics('generateNLPKeywords (HTTP Error)', apiKey);
      console.error(`[DeepSeek] HTTP ${response.status}:`, errorData);
      throw new Error(`DeepSeek API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const cleanedContent = cleanJsonOutput(content);
      const json = JSON.parse(cleanedContent);
      return Array.isArray(json.keywords) ? json.keywords : [];
    } catch (e) {
      console.warn("DeepSeek NLP parse failed", e, "Content:", content);
      return [];
    }
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      logApiDiagnostics('generateNLPKeywords (Network Error)', apiKey, error);
      console.error('[DeepSeek] Network error:', error);
      throw new Error(`DeepSeek connection failed: Check internet & API key`);
    }
    console.error("DeepSeek NLP keyword generation error:", error);
    throw error;
  }
};

export const generateFullSEOStrategyDeepSeek = async (topic: string): Promise<{ primaryKeywords: string[], nlpKeywords: string[] }> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[DeepSeek] No API key found for generateFullSEOStrategy');
    throw new Error("DeepSeek API Key is missing. Please add your API key in Settings.");
  }

  const payload = {
    model: "deepseek-chat",
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

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`DeepSeek API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
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
      console.warn("DeepSeek Full Strategy parse failed", parseError, "Content:", content);

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
    console.error("DeepSeek Full Strategy error:", error);
    throw error;
  }
};

export const generateArticleDeepSeek = async (config: ArticleConfig, signal?: AbortSignal): Promise<{ content: string; sources: string[] }> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("DeepSeek API Key is missing. Please add your API Key in the settings.");
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
    deepSeekModel,
    includeItalics,
    includeBold,
    includeBulletPoints,
    includeTables,
    personalResources
  } = config;

  // --- PURE DEEPSEEK EXECUTION ---
  // We do NOT call Gemini for research here to avoid mixed-provider errors.
  // Instead, we instruct DeepSeek to use its internal knowledge.

  const sources: string[] = []; // DeepSeek does not provide external source citations natively

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

  // Adapted instructions for DeepSeek-only execution
  let deepResearchInstruction = "";
  let deepResearchContext = "";
  if (deepResearch && websiteUrl) {
    // CHECK FOR CACHED BRAND RESEARCH FIRST (Bulk Mode Optimization)
    if (config.cachedBrandResearch && config.cachedBrandResearch.content) {
      console.log('[DeepSeek] Using CACHED brand research (no API call)');
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
    // Only use Tavily if specified as the Research Provider (or if default) AND no cache
    else if (config.researchProvider === SearchProvider.TAVILY || !config.researchProvider) {
      try {
        const { analyzeBrandWebsite, getTavilyApiKey } = await import('./tavilyService');
        if (getTavilyApiKey()) {
          console.log('[DeepSeek] Using Tavily Crawl for deep brand research');
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
      } catch (e) {
        console.warn('[DeepSeek] Tavily Crawl failed, using fallback', e);
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
    // Fetch real-time data using selected search provider
    if (config.searchProvider === SearchProvider.TAVILY) {
      // Use Tavily for real-time search (recommended for DeepSeek)
      try {
        const { fetchRealTimeDataTavily, getTavilyApiKey } = await import('./tavilyService');
        if (getTavilyApiKey()) {
          console.log('[DeepSeek] Using Tavily Search for real-time data');
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
        console.warn('[DeepSeek] Tavily Search failed', e);
      }
    } else if (config.searchProvider === SearchProvider.SERPSTACK) {
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

    // Fallback: use DeepSeek's internal knowledge (no external search)
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
    try {
      const { extractManualReferences, getTavilyApiKey } = await import('./tavilyService');
      if (getTavilyApiKey()) {
        console.log('[DeepSeek] Extracting manual reference URLs via Tavily');
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
    } catch (e) {
      console.warn('[DeepSeek] Manual reference extraction failed', e);
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
      
      ${formattingInstruction}
      
      CONTENT REQUIREMENTS:
      ${internalLinkingInstructions}
      ${externalLinkingInstructions}
      ${sectionOrderInstruction}
      
      Output in pure Markdown.
    `;

  // --- MODEL MAPPING ---
  let apiModel = "deepseek-chat";
  let systemPrompt = "You are an expert SEO Content Writer.";

  if (deepSeekModel === DeepSeekModel.V3_THINKING) {
    apiModel = "deepseek-reasoner";
  } else if (deepSeekModel === DeepSeekModel.V3_SPECIALE) {
    apiModel = "deepseek-reasoner";
    systemPrompt = "You are DeepSeek-V3.2-Speciale, an advanced reasoning engine specialized for high-end creative and technical writing. You prioritize depth, nuance, and structural perfection.";
  } else {
    // V3_NON_THINKING
    apiModel = "deepseek-chat";
    systemPrompt = "You are DeepSeek-V3.2, a high-speed, efficient AI writing assistant.";
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

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: signal
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errorMessage = err.error?.message || response.statusText;

      logApiDiagnostics('generateArticle (HTTP Error)', apiKey);
      console.error(`[DeepSeek] HTTP ${response.status}: ${errorMessage}`);
      console.error(`[DeepSeek] Full error response:`, err);

      if (errorMessage.includes("balance") || errorMessage.includes("payment")) {
        throw new Error(`DeepSeek API Payment Error: ${errorMessage}. Please check your balance at deepseek.com.`);
      }

      if (response.status === 401 || errorMessage.includes("unauthorized") || errorMessage.includes("invalid")) {
        throw new Error(`DeepSeek API Authentication Failed: Your API key may be invalid. Visit https://platform.deepseek.com/api/keys to verify.`);
      }

      throw new Error(`DeepSeek API Error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Merge with real-time sources if available
    const sources = [...realTimeSources];

    return { content, sources };
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      logApiDiagnostics('generateArticle (Network Error)', apiKey, error);
      console.error('[DeepSeek] Full network error:', error);
      throw new Error(`DeepSeek API connection failed: ${error.message}\n\nTroubleshooting:\n1. Check your internet connection\n2. Verify API key at https://platform.deepseek.com/api/keys\n3. Ensure your account has sufficient balance\n4. Try again in a few seconds`);
    }
    logApiDiagnostics('generateArticle (Unexpected Error)', apiKey, error);
    throw error;
  }
};

/**
 * Uses DeepSeek to intelligently select the most relevant internal links for a given topic
 * from a provided list of potential links.
 */
export const selectBestInternalLinksDeepSeek = async (topic: string, links: InternalLink[]): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey || links.length === 0) return [];

  const candidates = links.map(l => `- Title: "${l.title}", URL: ${l.url}`).join('\n');

  const payload = {
    model: "deepseek-chat",
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

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const cleanedContent = cleanJsonOutput(content);
    const json = JSON.parse(cleanedContent);
    return Array.isArray(json.selectedUrls) ? json.selectedUrls : [];

  } catch (error) {
    console.error("DeepSeek link selection error:", error);
    // Fallback
    return links.slice(0, 5).map(l => l.url);
  }
};