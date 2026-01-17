// Supabase Edge Function: Generate Article
// This function contains your PROTECTED AI prompts and business logic
// Runs on Supabase servers - completely hidden from users

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. AUTHENTICATION CHECK
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. PARSE REQUEST
    const config = await req.json();
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
      aiProvider,
      personalResources
    } = config;

    // 3. YOUR SECRET AI LOGIC STARTS HERE
    // This code is PROTECTED - competitors cannot see it

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
    const tavilyApiKey = Deno.env.get('TAVILY_API_KEY');

    if (!geminiApiKey && !deepseekApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route to appropriate AI service based on provider
    let result;
    if (aiProvider === 'gemini' && geminiApiKey) {
      result = await generateWithGemini(config, geminiApiKey, tavilyApiKey);
    } else if (aiProvider === 'deepseek' && deepseekApiKey) {
      result = await generateWithDeepSeek(config, deepseekApiKey, tavilyApiKey);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid AI provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. RETURN ONLY THE RESULT (not the prompts or logic)
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Article generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Article generation failed', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// YOUR SECRET GEMINI LOGIC (PROTECTED)
// ============================================================================
async function generateWithGemini(config: any, apiKey: string, tavilyKey?: string) {
  // YOUR PROPRIETARY GEMINI PROMPTS AND STRATEGIES GO HERE
  // This is where your competitive advantage lives
  
  const {
    topic,
    wordCount,
    type,
    tone,
    primaryKeywords,
    nlpKeywords,
    includeFaq,
    includeConclusion,
    internalLinks,
    externalLinks,
    openingStyle,
    readability,
    humanizeContent,
    targetCountry,
    personalResources
  } = config;

  // Build your secret prompt (competitors can't see this)
  let internalLinkingInstructions = "";
  if (internalLinks && internalLinks.length > 0) {
    internalLinkingInstructions = `
      MANDATORY INTERNAL LINKS (CRITICAL):
      You MUST include the following internal links in the article body.
      
      INSTRUCTIONS:
      1. For each link below, find a relevant sentence in the content to place it.
      2. Use natural anchor text (do not use "click here").
      3. YOU MUST USE MARKDOWN SYNTAX: [Anchor Text](URL)
      4. Do not list them at the end. They must be woven into the paragraphs.
      
      LINKS TO INSERT:
      ${internalLinks.map((link: any) => `- Context/Topic: "${link.title}" -> Link: ${link.url}`).join("\n")}
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
      ${externalLinks.map((link: any) => `- Source: "${link.title}" (${link.url})`).join("\n")}
    `;
  }

  let humanizeInstruction = "";
  if (humanizeContent) {
    humanizeInstruction = `
      "HUMANIZE CONTENT" MODE ENABLED (ANTI-ROBOTIC WRITING):
      You MUST write in a natural, human-like manner.
      
      STRICT RULES:
      1. BANNED AI PHRASES: Do NOT use: "Delve", "Dive deep", "In the ever-evolving landscape", 
         "Game-changer", "Unleash", "Unlock", "Elevate", "Realm", "Tapestry", "Symphony"
      2. SENTENCE VARIETY: Mix very short, punchy sentences with longer, flowing ones.
      3. CONVERSATIONAL FLOW: Write as if speaking to a colleague or friend.
    `;
  }

  const prompt = `
    You are an expert SEO Content Writer with decades of experience.
    
    TASK: Write a comprehensive ${type} about "${topic}".
    
    CONFIGURATION:
    - Target Word Count: Approximately ${wordCount} words.
    - Tone/Brand Voice: ${tone}.
    - Primary Keywords: ${primaryKeywords.join(", ")}.
    - NLP/LSI Keywords: ${nlpKeywords.join(", ")}.
    
    ${humanizeInstruction}
    ${internalLinkingInstructions}
    ${externalLinkingInstructions}
    
    ${personalResources ? `PERSONAL RESOURCES:\n${personalResources}` : ''}
    
    STRUCTURE:
    1. Introduction
    2. Body Paragraphs
    ${includeConclusion ? '3. Conclusion' : ''}
    ${includeFaq ? '4. FAQ Section' : ''}
    
    Output in pure Markdown format.
  `;

  // Call Gemini API (your secret implementation)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    content,
    sources: [],
    provider: 'gemini'
  };
}

// ============================================================================
// YOUR SECRET DEEPSEEK LOGIC (PROTECTED)
// ============================================================================
async function generateWithDeepSeek(config: any, apiKey: string, tavilyKey?: string) {
  // YOUR PROPRIETARY DEEPSEEK PROMPTS AND STRATEGIES GO HERE
  
  const {
    topic,
    wordCount,
    type,
    tone,
    primaryKeywords,
    nlpKeywords,
    includeFaq,
    includeConclusion,
    humanizeContent,
    personalResources
  } = config;

  let humanizeInstruction = "";
  if (humanizeContent) {
    humanizeInstruction = `
    "HUMANIZE CONTENT" MODE ENABLED:
    STRICTLY BANNED WORDS: "Delve", "Dive deep", "Game-changer", "Unleash", "Unlock", 
    "Elevate", "Realm", "Tapestry", "Symphony", "Leverage", "Harness", "Seamlessly"
    
    HUMAN WRITING GUIDELINES:
    - Use short, punchy sentences. Fragment sentences are okay.
    - Use contractions everywhere (don't, won't, can't, it's).
    - Write like talking to a friend over coffee.
    `;
  }

  const prompt = `
    TASK: Write a comprehensive ${type} about "${topic}".
    
    CONFIGURATION:
    - Target Word Count: ${wordCount} words.
    - Tone: ${tone}.
    - Primary Keywords: ${primaryKeywords.join(", ")}.
    
    ${humanizeInstruction}
    ${personalResources ? `PERSONAL RESOURCES:\n${personalResources}` : ''}
    
    Output in pure Markdown.
  `;

  // Call DeepSeek API (your secret implementation)
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are an expert SEO Content Writer.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return {
    content,
    sources: [],
    provider: 'deepseek'
  };
}
