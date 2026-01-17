// Supabase Edge Function: Extract Keywords
// PROTECTED: Your keyword extraction strategies

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. AUTHENTICATION
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
    const { topic, aiProvider, keywordType } = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');

    // 3. YOUR SECRET KEYWORD EXTRACTION LOGIC
    let result;
    if (aiProvider === 'gemini' && geminiApiKey) {
      result = await extractKeywordsGemini(topic, keywordType, geminiApiKey);
    } else if (aiProvider === 'deepseek' && deepseekApiKey) {
      result = await extractKeywordsDeepSeek(topic, keywordType, deepseekApiKey);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid AI provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Keyword extraction error:', error);
    return new Response(
      JSON.stringify({ error: 'Keyword extraction failed', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// YOUR SECRET GEMINI KEYWORD LOGIC (PROTECTED)
// ============================================================================
async function extractKeywordsGemini(topic: string, keywordType: string, apiKey: string) {
  let prompt = '';
  
  if (keywordType === 'primary') {
    prompt = `Act as a senior SEO Specialist. Analyze the article topic/heading: "${topic}". 
    Identify 5-7 high-potential Primary SEO Keywords that this article should target.
    
    Requirements:
    1. Include a mix of "head terms" (single keywords) and "long-tail keywords" (multiple words).
    2. Focus on terms with high relevance and search intent match.
    3. Return ONLY the keywords in a JSON array format: {"keywords": ["keyword1", "keyword2"]}`;
  } else if (keywordType === 'nlp') {
    prompt = `Generate a list of 10-15 high-value NLP (Natural Language Processing) and LSI (Latent Semantic Indexing) keywords related to the topic: "${topic}". 
    These should be semantically related terms that help search engines understand the context.
    Return JSON format: {"keywords": ["keyword1", "keyword2"]}`;
  } else {
    // Full strategy
    prompt = `Analyze the topic: "${topic}". 
    Generate a complete SEO strategy:
    1. 5-7 Primary Keywords (Head & Long-tail).
    2. 10-15 NLP/LSI Keywords (Contextual).
    
    Return JSON format: {"primaryKeywords": ["..."], "nlpKeywords": ["..."]}`;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: 'application/json'
        }
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const keywords = JSON.parse(text);

  return keywords;
}

// ============================================================================
// YOUR SECRET DEEPSEEK KEYWORD LOGIC (PROTECTED)
// ============================================================================
async function extractKeywordsDeepSeek(topic: string, keywordType: string, apiKey: string) {
  let prompt = '';
  
  if (keywordType === 'primary') {
    prompt = `Analyze the topic: "${topic}". Identify 5-7 high-potential Primary SEO Keywords.
    Return ONLY a raw JSON object with a 'keywords' array of strings. No markdown formatting.`;
  } else if (keywordType === 'nlp') {
    prompt = `Generate 10-15 high-value NLP and LSI keywords related to: "${topic}".
    Return ONLY a raw JSON object with a 'keywords' array of strings. No markdown formatting.`;
  } else {
    prompt = `Analyze the topic: "${topic}". 
    Generate a complete SEO strategy:
    1. 5-7 Primary Keywords (Head & Long-tail).
    2. 10-15 NLP/LSI Keywords (Contextual).
    
    Return ONLY a raw JSON object with keys 'primaryKeywords' and 'nlpKeywords'. No markdown.`;
  }

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are an expert SEO Specialist.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  
  // Clean up markdown code blocks if present
  const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
  const keywords = JSON.parse(cleanContent);

  return keywords;
}
