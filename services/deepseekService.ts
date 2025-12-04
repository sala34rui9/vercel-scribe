import { ArticleConfig, DeepSeekModel, OpeningStyle, ReadabilityLevel, TargetCountry } from "../types";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const LOCAL_STORAGE_KEY_KEY = 'user_deepseek_api_key';

const getApiKey = (): string => {
  const customKey = localStorage.getItem(LOCAL_STORAGE_KEY_KEY);
  if (customKey && customKey.trim().length > 0) {
    return customKey.trim();
  }
  return '';
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
  if (!apiKey) throw new Error("DeepSeek API Key is missing.");

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
    return Array.isArray(json.keywords) ? json.keywords : [];
  } catch (e) {
    console.warn("DeepSeek keyword parse failed", e, "Content:", content);
    // Fallback: if parsing fails, return empty array to prevent app crash
    return [];
  }
};

export const generateNLPKeywordsDeepSeek = async (topic: string): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("DeepSeek API Key is missing.");

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
    return Array.isArray(json.keywords) ? json.keywords : [];
  } catch (e) {
    console.warn("DeepSeek NLP parse failed", e, "Content:", content);
    return [];
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
      deepSeekModel
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
      "HUMANIZE CONTENT" MODE ENABLED:
      You MUST write in a natural, human-like manner. 
      STRICTLY AVOID AI clichés like "delve", "ever-evolving", "tapestry", "realm", "symphony".
      Use conversational flow, active voice, and sentence variety.
      `;
    }
    
    // Adapted instructions for DeepSeek-only execution
    let deepResearchInstruction = "";
    if (deepResearch && websiteUrl) {
      deepResearchInstruction = `
      BRAND ANALYSIS INSTRUCTION:
      The user has provided a Brand Website: ${websiteUrl}.
      Please analyze this URL (based on your internal training data/knowledge) to infer the brand's likely voice, industry, and structure.
      Adapt your writing tone to align with this brand presence.
      `;
    }
    
    let realTimeDataInstruction = "";
    if (realTimeData) {
      realTimeDataInstruction = `
      DATA FRESHNESS INSTRUCTION:
      The user requested Real-Time Data. 
      Please use your most recent internal knowledge to provide up-to-date statistics, news, or trends relevant to the topic.
      `;
    }
    
    let countryInstruction = "";
    if (targetCountry && targetCountry !== TargetCountry.GLOBAL) {
        countryInstruction = `
        TARGET AUDIENCE LOCALIZATION:
        Target Country: ${targetCountry}
        Use appropriate spelling (e.g., Color vs Colour), currency, and cultural references for this location.
        `;
    }

    let sectionOrderInstruction = `
      STRICT SECTION ORDERING:
      1. Introduction
      2. Body Paragraphs
      ${includeConclusion ? "3. Conclusion / Key Takeaways (Header: ## Conclusion)" : ""}
      ${includeFaq ? "4. FAQ Section (Header: ## Frequently Asked Questions)" : ""}
      
      CRITICAL: FAQ section MUST appear AFTER the Conclusion.
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
      ${countryInstruction}
      ${openingInstruction}
      ${readabilityInstruction}
      ${humanizeInstruction}
      
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
      
      if (errorMessage.includes("balance") || errorMessage.includes("payment")) {
         throw new Error(`DeepSeek API Payment Error: ${errorMessage}. Please check your balance at deepseek.com.`);
      }
      
      throw new Error(`DeepSeek API Error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return { content, sources };
};