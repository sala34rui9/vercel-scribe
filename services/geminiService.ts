
import { GoogleGenAI, Type } from "@google/genai";
import { ArticleConfig, InternalLink, ExternalLink, OpeningStyle, ReadabilityLevel, ContentOpportunity, TargetCountry, AIProvider, SearchProvider } from "../types";

const LOCAL_STORAGE_KEY_KEY = 'user_gemini_api_key';

/**
 * Helper to get the most appropriate API Key.
 * Prioritizes User Custom Key -> System Env Key.
 */
export const getGeminiApiKey = (): string => {
  const customKey = localStorage.getItem(LOCAL_STORAGE_KEY_KEY);
  if (customKey && customKey.trim().length > 0) {
    return customKey.trim();
  }
  return process.env.API_KEY || '';
};

const getApiKey = getGeminiApiKey;

/**
 * Prevent accidental Gemini calls when user has selected DeepSeek as the active provider.
 * This reads the persisted provider from localStorage and ensures Gemini-only functions
 * do nothing if the provider is not set to Gemini. This is a safety guard to avoid
 * unexpected quota usage when DeepSeek is intended.
 */
const isGeminiSelected = (): boolean => {
  try {
    const p = localStorage.getItem('seo_scribe_provider');
    return p === AIProvider.GEMINI;
  } catch (e) {
    return false;
  }
};

/**
 * Creates a dynamic GenAI client instance.
 * Must be called inside functions to ensure it uses the latest key if changed.
 */
const getGenAI = (): GoogleGenAI => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("No Gemini API Key found. Please add your key in the API Settings (key icon in header).");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Helper to execute a generation request with retry logic for 429/503 errors.
 */
const generateContentWithRetry = async (model: string, params: any, retries = 3): Promise<any> => {
  const ai = getGenAI();
  let lastError;

  for (let i = 0; i <= retries; i++) {
    try {
      return await ai.models.generateContent({ model, ...params });
    } catch (error: any) {
      lastError = error;
      const isQuotaOrServer = error.status === 429 || error.status === 503 ||
        (error.toString && (error.toString().includes('429') || error.toString().includes('503') || error.toString().includes('RESOURCE_EXHAUSTED')));

      if (isQuotaOrServer && i < retries) {
        const delay = 1000 * Math.pow(2, i); // 1s, 2s, 4s
        console.warn(`Gemini API busy/quota (Attempt ${i + 1}/${retries + 1}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

/**
 * Generates Primary SEO keywords based on the main topic.
 * Identifies both single and multiple word keywords (short-tail and long-tail).
 */
export const generatePrimaryKeywords = async (topic: string): Promise<string[]> => {
  // Always use Gemini for keyword research (hybrid strategy)
  try {
    const response = await generateContentWithRetry("gemini-2.5-flash", {
      contents: `Act as a senior SEO Specialist. Analyze the article topic/heading: "${topic}". 
      Identify 5-7 high-potential Primary SEO Keywords that this article should target.
      
      Requirements:
      1. Include a mix of "head terms" (single keywords) and "long-tail keywords" (multiple words).
      2. Focus on terms with high relevance and search intent match.
      3. Return ONLY the keywords in a list.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of primary SEO keywords (single or multiple words)"
            }
          },
          required: ["keywords"]
        }
      }
    });

    const text = response.text;
    if (!text) return [];

    const data = JSON.parse(text);
    return data.keywords || [];
  } catch (error) {
    console.error("Error generating Primary keywords (Gemini):", error);
    // Graceful fallback: return empty array so we don't block the UI if quota fails
    return [];
  }
};

/**
 * Generates NLP/LSI keywords based on the main topic.
 * Uses a faster model (Flash) for quick suggestions.
 */
export const generateNLPKeywords = async (topic: string): Promise<string[]> => {
  // Always use Gemini for NLP keyword research (hybrid strategy)
  try {
    const response = await generateContentWithRetry("gemini-2.5-flash", {
      contents: `Generate a list of 10-15 high-value NLP (Natural Language Processing) and LSI (Latent Semantic Indexing) keywords related to the topic: "${topic}". These should be semantically related terms that help search engines understand the context.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of semantically related keywords"
            }
          },
          required: ["keywords"]
        }
      }
    });

    const text = response.text;
    if (!text) return [];

    const data = JSON.parse(text);
    return data.keywords || [];
  } catch (error) {
    console.error("Error generating NLP keywords (Gemini):", error);
    // Graceful fallback
    return [];
  }
};

/**
 * Fetches a broad list of verified URLs from a domain to build a "Site Architecture".
 * Used for deep research to prevent hallucinations.
 */
export const fetchSiteArchitecture = async (domain: string): Promise<string[]> => {
  // Always use Gemini for site architecture scan (hybrid strategy)
  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Perform a deep structural scan of the website: "${domain}".
      
      GOAL: Return a list of valid, existing URLs from this domain that can serve as an architectural reference for internal linking.
      
      EXECUTE THESE SEARCHES (Internal Tools):
      1. "site:${domain}" (Home/Top level)
      2. "site:${domain} blog" (Blog posts)
      3. "site:${domain} services" (Service pages)
      4. "site:${domain} category" (Categories)
      
      Output is ignored, I only need the grounding metadata.
      `,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    // STRICT SOURCE OF TRUTH: Grounding Metadata
    // We do NOT rely on generated text for URLs as it may hallucinate.
    let urls: string[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      urls = response.candidates[0].groundingMetadata.groundingChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter((uri: string) => !!uri);
    }

    // Strict Domain Filter
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const filteredUrls = urls.filter(url => url.includes(cleanDomain));

    // Deduplicate
    return [...new Set(filteredUrls)];
  } catch (error) {
    console.error("Error fetching site architecture:", error);
    return [];
  }
};

/**
 * Scans a specific website for internal linking opportunities related to the topic.
 * Returns strictly verified existing links and a list of content gaps (opportunities).
 * Supports deep research mode for broader scanning.
 */
export const scanForInternalLinks = async (websiteUrl: string, topic: string, keywords: string[] = [], deepResearch = false): Promise<{ links: InternalLink[], opportunities: ContentOpportunity[] }> => {
  // Always use Gemini for internal link scanning (hybrid strategy)
  const apiKey = getApiKey();
  if (!apiKey) return { links: [], opportunities: [] };

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Robustly extract domain for site: search
    let domain = websiteUrl;
    try {
      const urlToParse = websiteUrl.match(/^https?:\/\//) ? websiteUrl : `https://${websiteUrl}`;
      const urlObj = new URL(urlToParse);
      domain = urlObj.hostname;
    } catch (e) {
      console.warn("Invalid URL format, using as is:", websiteUrl);
    }

    // Construct queries based on Deep Research mode
    const searchQueries = deepResearch
      ? [
        `"site:${domain} ${topic}"`,
        `"site:${domain} ${keywords.slice(0, 3).join(' ')}"`,
        `"site:${domain} blog"`,
        `"site:${domain} resources"`
      ]
      : [
        `"site:${domain} ${topic}"`,
        `"site:${domain} ${keywords.slice(0, 2).join(' ')}"`
      ];

    const promptInstructions = deepResearch
      ? `You are a SITE ARCHITECT. Perform a COMPREHENSIVE scan.`
      : `You are an expert SEO Auditor. Find specific relevant pages for linking.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${promptInstructions}
      
      Your task is to analyze search results for the domain "${domain}" to find content gaps.

      1. EXECUTE SEARCHES using "site:${domain}":
         ${searchQueries.map((q, i) => `- Query ${i + 1}: ${q}`).join('\n')}

      2. IDENTIFY CONTENT GAPS:
         - Identify relevant sub-topics or pages that *should* exist for an authoritative site on this topic, but were NOT found in the search results.

      3. RETURN JSON:
      {
        "contentGaps": [
          { "topic": "Missing Topic Name", "reason": "Why this content is needed for SEO completeness" }
        ]
      }
      
      IMPORTANT: Return ONLY the raw JSON string. Do not use markdown code blocks.
      NOTE: Existing links will be extracted directly from the search tool metadata, not your text output.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    // 1. EXTRACT REAL LINKS FROM GROUNDING METADATA (Source of Truth)
    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let validLinks: InternalLink[] = [];
    const cleanDomain = domain.replace(/^www\./, '');

    for (const chunk of rawChunks) {
      if (chunk.web?.uri && chunk.web?.title) {
        const uri = chunk.web.uri;
        const title = chunk.web.title;

        // Strict Domain Check
        let isMatch = false;
        try {
          const chunkUrl = new URL(uri);
          isMatch = chunkUrl.hostname.includes(cleanDomain);
        } catch {
          // If URL parsing fails, skip it to be safe
          continue;
        }

        if (isMatch) {
          validLinks.push({
            title: title,
            url: uri,
            snippet: "Verified via Google Search" // We don't get snippets easily in chunks, but we know it exists
          });
        }
      }
    }

    // Remove duplicates
    const uniqueLinks: InternalLink[] = [];
    const seenUrls = new Set();
    for (const link of validLinks) {
      const normalizedUrl = link.url.replace(/\/$/, "");
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        uniqueLinks.push(link);
      }
    }

    // 2. PARSE CONTENT GAPS FROM TEXT
    let opportunities: ContentOpportunity[] = [];
    const text = response.text;
    if (text) {
      const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
      try {
        const data = JSON.parse(cleanText);
        opportunities = data.contentGaps || [];
      } catch (e) {
        console.warn("JSON parse failed for content gaps", e);
      }
    }

    return { links: uniqueLinks, opportunities };

  } catch (error) {
    console.error("Error scanning for internal links:", error);
    return { links: [], opportunities: [] };
  }
};

/**
 * Scans the web for external linking opportunities related to the topic.
 * Uses gemini-2.5-flash for speed.
 */
export const scanForExternalLinks = async (topic: string, excludeDomain?: string): Promise<ExternalLink[]> => {
  // Always use Gemini for external link scanning (hybrid strategy)
  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Using Flash for faster scanning
      contents: `Research authoritative, high-quality external resources (articles, reports, statistics, news) related to the topic: "${topic}".
      
      Requirements:
      1. Find reputable sources (e.g., industry leaders, educational institutions, news outlets).
      2. Exclude generic homepages; find specific articles or resources.
      ${excludeDomain ? `3. EXCLUDE any results from the domain: "${excludeDomain}".` : ""}
      
      Output is ignored, I only need the grounding metadata.
      `,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    // STRICT SOURCE OF TRUTH: Grounding Metadata
    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let validLinks: ExternalLink[] = [];

    for (const chunk of rawChunks) {
      if (chunk.web?.uri && chunk.web?.title) {
        const uri = chunk.web.uri;
        const title = chunk.web.title;

        // Exclude Domain Check
        if (excludeDomain && uri.includes(excludeDomain)) {
          continue;
        }

        validLinks.push({
          title: title,
          url: uri,
          snippet: "Verified External Source"
        });
      }
    }

    // Slice to top 15 and remove duplicates
    const uniqueLinks: ExternalLink[] = [];
    const seenUrls = new Set();
    for (const link of validLinks) {
      if (!seenUrls.has(link.url)) {
        seenUrls.add(link.url);
        uniqueLinks.push(link);
      }
    }

    return uniqueLinks.slice(0, 15);
  } catch (error) {
    console.error("Error scanning for external links:", error);
    return [];
  }
};

/**
 * Fetches real-time data and news using gemini-2.5-flash with Google Search grounding.
 */
export const fetchRealTimeData = async (topic: string): Promise<{ content: string; sources: string[] }> => {
  // Always use Gemini for real-time data fetching (hybrid strategy)
  const apiKey = getApiKey();
  if (!apiKey) return { content: "", sources: [] };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find the latest real-time data, news, statistics, and trends regarding: "${topic}".
      
      Requirements:
      1. Use Google Search to find very recent and up-to-date information (current year/month).
      2. Provide a summary of key facts, new developments, and relevant statistics.
      3. This information will be used to write an up-to-date SEO article.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const content = response.text || "";
    let sources: string[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      sources = response.candidates[0].groundingMetadata.groundingChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter((uri: string) => !!uri);
    }

    return { content, sources };
  } catch (error) {
    console.error("Error fetching real-time data:", error);
    return { content: "", sources: [] };
  }
};

/**
 * Generates the full SEO article.
 * Uses the Pro model (if available/configured) for better reasoning and writing quality.
 * Accepts an AbortSignal to allow cancellation.
 */
export const generateArticle = async (config: ArticleConfig, signal?: AbortSignal): Promise<{ content: string; sources: string[] }> => {
  // Initial abort check
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  try {
    if (!isGeminiSelected()) {
      throw new Error("Google Gemini is not selected as your AI provider. Please select Gemini in settings or use DeepSeek.");
    }
    const ai = getGenAI();
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
      targetCountry
    } = config;

    // --- REAL-TIME DATA FETCHING STEP ---
    // If enabled, we first fetch latest data using selected search provider
    let realTimeContext = "";
    let realTimeSources: string[] = [];

    if (realTimeData) {
      let data: { content: string; sources: string[] };

      // Use selected search provider
      if (config.searchProvider === SearchProvider.TAVILY) {
        // Use Tavily for real-time search
        try {
          const { fetchRealTimeDataTavily, getTavilyApiKey } = await import('./tavilyService');
          if (getTavilyApiKey()) {
            console.log('[Gemini] Using Tavily Search for real-time data');
            data = await fetchRealTimeDataTavily(topic);
          } else {
            // Fallback to Gemini grounding if no Tavily key
            data = await fetchRealTimeData(topic);
          }
        } catch (e) {
          console.warn('[Gemini] Tavily Search failed, falling back to Gemini grounding', e);
          data = await fetchRealTimeData(topic);
        }
      } else if (config.searchProvider === SearchProvider.SERPSTACK) {
        // Use SERPStack for real-time search
        const { fetchRealTimeDataSERPStack } = await import('./serpstackService');
        data = await fetchRealTimeDataSERPStack(topic);
      } else {
        // Default to Gemini (with grounding)
        data = await fetchRealTimeData(topic);
      }

      realTimeContext = data.content;
      realTimeSources = data.sources;
    }

    // Check abort again after async fetch
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // --- DEEP RESEARCH (SITE ARCHITECTURE) STEP ---
    let verifiedSiteArchitecture: string[] = [];
    if (deepResearch && websiteUrl) {
      let domain = websiteUrl;
      try {
        const urlObj = new URL(websiteUrl.match(/^https?:\/\//) ? websiteUrl : `https://${websiteUrl}`);
        domain = urlObj.hostname;
        verifiedSiteArchitecture = await fetchSiteArchitecture(domain);
      } catch (e) {
        console.warn("Failed to parse website URL for deep research", e);
      }
    }

    // --- PROMPT CONSTRUCTION ---

    // Construct the internal links string if they exist
    // Placed in a high-priority "REQUIREMENTS" block
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

    // Construct External Links Instructions
    let externalLinkingInstructions = "";
    if (externalLinks && externalLinks.length > 0) {
      externalLinkingInstructions = `
      MANDATORY EXTERNAL LINKS (CITATIONS):
      You MUST include the following external links in the article to add credibility and authority.
      
      INSTRUCTIONS:
      1. Cite these sources naturally where they support a fact, statistic, or definition.
      2. Use descriptive anchor text representing the source or the data.
      3. YOU MUST USE MARKDOWN SYNTAX: [Anchor Text](URL)
      
      EXTERNAL SOURCES TO CITE:
      ${externalLinks.map(link => `- Source: "${link.title}" (${link.url})`).join("\n")}
      `;
    }

    // Construct Opening Style Instructions
    let openingInstruction = "";
    if (openingStyle && openingStyle !== OpeningStyle.NONE) {
      openingInstruction = `
      OPENING/INTRODUCTION STYLE REQUIREMENT:
      You MUST start the article with a "${openingStyle}" style introduction.
      
      Follow these specific rules for the selected opening:
      ${openingStyle === OpeningStyle.FACT_STATISTIC ? "- Start with a compelling, relevant (real or plausible placeholder) statistic or fact that grabs attention immediately." : ""}
      ${openingStyle === OpeningStyle.PROBLEM_SOLUTION ? "- Start by clearly agitating a specific pain point or problem the reader faces, then hint at the solution." : ""}
      ${openingStyle === OpeningStyle.ANECDOTE ? "- Begin with a short, relatable business story or anecdote that illustrates the topic." : ""}
      ${openingStyle === OpeningStyle.QUESTION ? "- Open with a provocative or thought-provoking question that challenges the reader's assumptions." : ""}
      ${openingStyle === OpeningStyle.SCENARIO ? "- Use a 'Imagine if...' or 'Picture this...' scenario to place the reader in a specific hypothetical situation." : ""}
      `;
    }

    // Construct Readability Instructions
    let readabilityInstruction = "";
    if (readability && readability !== ReadabilityLevel.NONE) {
      readabilityInstruction = `
      READABILITY LEVEL REQUIREMENT:
      Target Reading Level: ${readability}
      
      Writing Guidelines for this level:
      ${readability === ReadabilityLevel.GRADE_5 ? "- Use very simple words, short sentences, and active voice. Avoid complex jargon. Explain concepts as if to an 11-year-old." : ""}
      ${readability === ReadabilityLevel.GRADE_6 ? "- Use conversational, easy-to-follow language. Keep paragraphs short and accessible." : ""}
      ${readability === ReadabilityLevel.GRADE_7 ? "- Balance simplicity with some descriptive detail. Fairly easy to read for the general public." : ""}
      ${readability === ReadabilityLevel.GRADE_8 ? "- Standard/Recommended reading level. Use clear, direct language but allow for some industry terms if explained." : ""}
      ${readability === ReadabilityLevel.GRADE_10 ? "- Professional and sophisticated. Complex sentence structures and industry-specific vocabulary are acceptable." : ""}
      `;
    }

    // Construct Humanize/Anti-Bot Instructions
    let humanizeInstruction = "";
    if (humanizeContent) {
      humanizeInstruction = `
      "HUMANIZE CONTENT" MODE ENABLED (ANTI-ROBOTIC WRITING):
      You MUST write in a natural, human-like manner. The user explicitly wants to avoid "AI-sounding" text.
      
      STRICT RULES:
      1. BANNED AI PHRASES: Do NOT use the following words/phrases or their variations:
         - "Delve", "Dive deep", "In the ever-evolving landscape", "Game-changer"
         - "Unleash", "Unlock", "Elevate", "Realm", "Tapestry", "Symphony"
         - "In conclusion", "It is important to note"
      
      2. SENTENCE VARIETY: 
         - Mix very short, punchy sentences with longer, flowing ones.
         - Avoid repetitive sentence structures (e.g., starting every paragraph with "Additionally").
      
      3. CONVERSATIONAL FLOW:
         - Write as if speaking to a colleague or friend (depending on tone).
         - Use contractions (e.g., "it's" instead of "it is") unless the tone is strictly academic.
         - Use rhetorical questions sparingly but effectively.
         - Focus on "showing" rather than "telling".
      `;
    }

    // Construct Site Architect Instructions (for Hallucination Prevention)
    // We add the verified URLs from the architecture scan to the prompt.
    let siteArchitectInstruction = "";
    if (deepResearch && verifiedSiteArchitecture.length > 0) {
      siteArchitectInstruction = `
      SITE ARCHITECT & HALLUCINATION PREVENTION (STRICT):
      You are acting as the Site Architect for this brand. 
      We have performed a deep scan and verified the following URL structure exists on the site.
      
      VERIFIED SITE ARCHITECTURE (VALID URLs):
      ${verifiedSiteArchitecture.slice(0, 50).join("\n")}
      
      RULES FOR LINKS:
      1. MANDATORY: You MUST include the specific links listed in "MANDATORY INTERNAL LINKS" above.
      2. OPTIONAL: You MAY suggest *other* internal links if highly relevant, BUT ONLY IF they appear in the "VERIFIED SITE ARCHITECTURE" list above.
      3. PROHIBITED: DO NOT invent, guess, or construct any new URLs (e.g. do not make up /blog/topic-name). If a URL is not in the Verified List or Mandatory List, DO NOT use it.
      `;
    }

    // Construct Target Country / Localization Instructions
    let countryInstruction = "";
    if (targetCountry && targetCountry !== TargetCountry.GLOBAL) {
      countryInstruction = `
        TARGET AUDIENCE LOCALIZATION:
        Target Country: ${targetCountry}
        
        You MUST adapt the content for this specific location:
        1. SPELLING: Use correct spelling conventions (e.g., "Color" for US, "Colour" for UK/Australia/Canada).
        2. CURRENCY: Use the correct currency symbol if prices are mentioned (e.g., $, £, €).
        3. MEASUREMENTS: Use the system standard for that country (Imperial for US, Metric for most others).
        4. CULTURAL REFERENCES: Use examples, idioms, or analogies relevant to ${targetCountry} audiences.
        `;
    }

    // Determine the section ordering dynamically
    let sectionOrderInstruction = `
      STRICT SECTION ORDERING (YOU MUST FOLLOW THIS EXACT SEQUENCE):
      1. Introduction (Following the specified OPENING STYLE)`;

    let step = 2;
    sectionOrderInstruction += `\n      ${step++}. Body Paragraphs (Comprehensive coverage)`;

    if (includeConclusion) {
      sectionOrderInstruction += `\n      ${step++}. Conclusion / Key Takeaways (Use header: ## Conclusion)`;
    }

    if (includeFaq) {
      sectionOrderInstruction += `\n      ${step++}. FAQ Section (Use header: ## Frequently Asked Questions)`;
    }

    sectionOrderInstruction += `\n\n      CRITICAL: The FAQ section (if requested) MUST appear AFTER the Conclusion. Do not end the article with the Conclusion if FAQs are required.`;

    const prompt = `
      You are an expert SEO Content Writer with decades of experience in creating high-ranking content.
      
      TASK: Write a comprehensive ${type} about "${topic}".
      
      CONFIGURATION:
      - Target Word Count: Approximately ${wordCount} words.
      - Tone/Brand Voice: ${tone}.
      ${websiteUrl ? `- Brand Website: ${websiteUrl}` : ""}
      - Primary Keywords (Must be naturally integrated): ${primaryKeywords.join(", ")}.
      - NLP/LSI Keywords (Contextual support): ${nlpKeywords.join(", ")}.
      
      ${deepResearch ? `
      DEEP RESEARCH & ANALYSIS ENABLED:
      1. Use Google Search to analyze the provided Brand Website (if any) and the topic thoroughly.
      2. Identify the brand's specific "voice", audience terminologies, and industry positioning.
      3. Adopt this persona to ensure the article sounds like it was written by the brand's own experts.
      4. Use specific industry terms found during research to relate deeply to the brand's audience.
      ` : ""}

      ${realTimeContext ? `
      REAL-TIME DATA & NEWS CONTEXT (CRITICAL):
      The following up-to-date information was gathered from real-time search. 
      YOU MUST INTEGRATE this information into the article to ensure it is current and relevant.
      
      --- RESEARCH NOTES START ---
      ${realTimeContext}
      --- RESEARCH NOTES END ---
      ` : ""}
      
      ${siteArchitectInstruction}
      
      ${countryInstruction}
      
      ${openingInstruction}

      ${readabilityInstruction}

      ${humanizeInstruction}
      
      STRICT STRUCTURE & FORMATTING RULES:
      1. MAIN TITLE: Start with a clear H1 (#) title.
      2. SUBHEADINGS: Use H2 (##) for main sections and H3 (###) for detailed subsections. Ensure logical hierarchy.
      3. BOLDING: Use **bold text** for key takeaways, important terms, and primary keywords to improve skimmability.
      4. CONTENT BLOCKS: Use short paragraphs, bullet points, and numbered lists to break up text.
      
      CONTENT INTEGRATION REQUIREMENTS (CRITICAL):
      ${internalLinkingInstructions}

      ${externalLinkingInstructions}
      
      ${sectionOrderInstruction}
      
      Output the article content in pure Markdown format. Do not include any JSON or other wrapping.
    `;

    // Strategy: Try the robust Pro model first. If it hits limits (429) or is overloaded, fallback to Flash.
    const executeGeneration = async (modelName: string) => {
      const generationPromise = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          // If deep research is enabled, we enable tools to allow the model to verify facts if needed.
          // gemini-2.5-flash handles tools well too.
          tools: deepResearch ? [{ googleSearch: {} }] : [],
        }
      });

      return await Promise.race([
        generationPromise,
        new Promise<any>((_, reject) => {
          if (signal) {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }
        })
      ]);
    };

    let response;
    try {
      response = await executeGeneration('gemini-3-pro-preview');
    } catch (error: any) {
      if (signal?.aborted) throw error;

      const isQuotaError = error.status === 429 ||
        error.status === 503 ||
        error.toString().includes('429') ||
        error.toString().includes('quota') ||
        error.toString().includes('RESOURCE_EXHAUSTED');

      if (isQuotaError) {
        console.warn("Primary model (Pro) quota exceeded. Falling back to gemini-2.5-flash.");
        response = await executeGeneration('gemini-2.5-flash');
      } else {
        throw error;
      }
    }

    const content = response.text || "";

    // Extract sources if grounding was used in the main call
    let sources: string[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      sources = response.candidates[0].groundingMetadata.groundingChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter((uri: string) => !!uri);
    }

    // Merge with real-time sources
    sources = [...sources, ...realTimeSources];

    // Deduplicate
    sources = [...new Set(sources)];

    return { content, sources };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    console.error("Error generating article:", error);
    throw new Error("Failed to generate article. Please try again or check your API Key.");
  }
};
