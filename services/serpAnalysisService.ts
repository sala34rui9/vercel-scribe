/**
 * SERP Analysis Service
 * AI-powered analysis of fetched competitor content
 * Uses DeepSeek/Gemini for structured JSON analysis
 */

import {
  FetchedPage,
  ContentSimilarityResult,
  ContentGapResult,
  SeoStructureResult,
  HookAnalysisResult,
  WritingStyleResult,
  ReadabilityResult,
  ContentPatternResult,
  SearchIntentResult,
  TopicCoverageMap,
  FaqAnalysisResult,
  StatisticsAnalysisResult,
  ExpertAnalysisResult,
  OutlineRecommendation,
  SerpIntelligenceReport,
} from '../types';

const DEEPSEEK_API_URL = "https://deepseek-proxy.ubantuplx.workers.dev";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";

const getDeepSeekApiKey = (): string => {
  const key = localStorage.getItem('user_deepseek_api_key');
  return key?.trim() || '';
};

const cleanJsonOutput = (text: string): string => {
  let clean = text.trim();
  clean = clean.replace(/```json/gi, '').replace(/```/g, '');
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }
  return clean.trim();
};

export async function callDeepSeek(
  prompt: string,
  options?: { model?: 'deepseek-v4-pro' | 'deepseek-v4-flash' },
): Promise<any> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) {
    throw new Error('DeepSeek API key is missing. Please add your API key in Settings.');
  }

  const payload = {
    model: options?.model ?? 'deepseek-v4-pro',
    messages: [
      { role: "system", content: "You are an expert SEO analyst and content strategist. Always return valid JSON only, no markdown formatting." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  };

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`CRITICAL_API_ERROR: DeepSeek API Error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  return JSON.parse(cleanJsonOutput(content));
}

export function buildContentSummary(pages: FetchedPage[]): string {
  return pages
    .filter(p => p.fetchStatus === 'success')
    .map((p, i) => `--- PAGE ${i + 1} ---\nURL: ${p.url}\nTitle: ${p.title}\nDomain: ${p.domain}\nContent:\n${p.content.substring(0, 3000)}`)
    .join('\n\n');
}

export function buildTop5Summary(pages: FetchedPage[]): string {
  return pages
    .filter(p => p.fetchStatus === 'success')
    .slice(0, 5)
    .map((p, i) => `--- PAGE ${i + 1} ---\nURL: ${p.url}\nTitle: ${p.title}\nContent:\n${p.content.substring(0, 2000)}`)
    .join('\n\n');
}

export function buildAllPagesSummary(pages: FetchedPage[]): string {
  const successful = pages.filter(p => p.fetchStatus === 'success');
  let perPageLimit = 2000;
  const totalChars = successful.reduce((sum, p) => sum + p.content.length, 0);
  if (totalChars > 8000) {
    perPageLimit = 1500;
  }
  return successful
    .map((p, i) => `--- PAGE ${i + 1} ---\nURL: ${p.url}\nTitle: ${p.title}\nContent:\n${p.content.substring(0, perPageLimit)}`)
    .join('\n\n');
}

// ---- Caching ----

const analysisCache = new Map<string, { result: SerpIntelligenceReport; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCacheKey(pages: FetchedPage[]): string {
  return pages
    .filter(p => p.fetchStatus === 'success')
    .map(p => p.url)
    .sort()
    .join('|');
}

// ---- Response Validation & Repair ----

const validateAndRepairResponse = (raw: any): SerpIntelligenceReport => ({
  similarity: {
    commonTopics: raw.contentSimilarity?.commonTopics ?? [],
    commonQuestions: raw.contentSimilarity?.commonQuestions ?? [],
    repeatedAdvice: raw.contentSimilarity?.repeatedAdvice ?? [],
    repeatedStatistics: raw.contentSimilarity?.repeatedStatistics ?? [],
    commonH2s: raw.contentSimilarity?.commonH2s ?? [],
    commonH3s: raw.contentSimilarity?.commonH3s ?? [],
    commonExamples: raw.contentSimilarity?.commonExamples ?? [],
    frequentlyLinkedResources: raw.contentSimilarity?.frequentlyLinkedResources ?? [],
  },
  gaps: {
    missingTopics: raw.contentGaps?.missingTopics ?? [],
    missingSubtopics: raw.contentGaps?.missingSubtopics ?? [],
    missingFAQs: raw.contentGaps?.missingFAQs ?? [],
    missingComparisons: raw.contentGaps?.missingComparisons ?? [],
    missingExamples: raw.contentGaps?.missingExamples ?? [],
    missingCaseStudies: raw.contentGaps?.missingCaseStudies ?? [],
    missingStatistics: raw.contentGaps?.missingStatistics ?? [],
    missingExpertOpinions: raw.contentGaps?.missingExpertOpinions ?? [],
    contentOpportunities: (raw.contentGaps?.contentOpportunities || []).map((o: any) => ({
      topic: o.topic || '',
      reason: o.reason || '',
      enabled: true,
    })),
  },
  seoStructure: {
    averageH2s: raw.seoStructure?.averageH2s ?? 0,
    averageH3s: raw.seoStructure?.averageH3s ?? 0,
    averageParagraphLength: raw.seoStructure?.averageParagraphLength ?? 0,
    bulletUsagePercent: raw.seoStructure?.bulletUsagePercent ?? 0,
    tableUsagePercent: raw.seoStructure?.tableUsagePercent ?? 0,
    imageUsagePercent: raw.seoStructure?.imageUsagePercent ?? 0,
    faqUsagePercent: raw.seoStructure?.faqUsagePercent ?? 0,
    calloutUsagePercent: raw.seoStructure?.calloutUsagePercent ?? 0,
    listUsagePercent: raw.seoStructure?.listUsagePercent ?? 0,
    recommendations: raw.seoStructure?.recommendations ?? [],
  },
  hook: {
    topHookPattern: raw.hookAnalysis?.topHookPattern ?? 'N/A',
    averageIntroLength: raw.hookAnalysis?.averageIntroLength ?? 0,
    commonFirstSentenceStructure: raw.hookAnalysis?.commonFirstSentenceStructure ?? 'N/A',
    hookStyles: raw.hookAnalysis?.hookStyles ?? [],
    recommendation: raw.hookAnalysis?.recommendation ?? 'N/A',
  },
  writingStyle: {
    tone: raw.writingStyle?.tone ?? [],
    readingLevel: raw.writingStyle?.readingLevel ?? 'N/A',
    sentenceComplexity: raw.writingStyle?.sentenceComplexity ?? 'N/A',
    vocabulary: raw.writingStyle?.vocabulary ?? 'N/A',
    paragraphSize: raw.writingStyle?.paragraphSize ?? 'N/A',
    formality: raw.writingStyle?.formality ?? 'N/A',
    voice: raw.writingStyle?.voice ?? 'N/A',
    persuasiveness: raw.writingStyle?.persuasiveness ?? 'N/A',
    storytelling: raw.writingStyle?.storytelling ?? 'N/A',
    educationalDepth: raw.writingStyle?.educationalDepth ?? 'N/A',
    actionability: raw.writingStyle?.actionability ?? 'N/A',
  },
  readability: {
    fleschReadingEase: raw.readability?.fleschReadingEase ?? 0,
    gradeLevel: raw.readability?.gradeLevel ?? 'N/A',
    averageSentenceLength: raw.readability?.averageSentenceLength ?? 0,
    averageWordLength: raw.readability?.averageWordLength ?? 0,
    averageParagraphLength: raw.readability?.averageParagraphLength ?? 0,
    passiveVoicePercent: raw.readability?.passiveVoicePercent ?? 0,
    transitionWordPercent: raw.readability?.transitionWordPercent ?? 0,
    recommendedLevel: raw.readability?.recommendedLevel ?? 'N/A',
    reason: raw.readability?.reason ?? 'N/A',
  },
  contentPatterns: {
    averageArticleLength: raw.contentPatterns?.averageArticleLength ?? 0,
    averageImages: raw.contentPatterns?.averageImages ?? 0,
    averageTables: raw.contentPatterns?.averageTables ?? 0,
    averageBulletLists: raw.contentPatterns?.averageBulletLists ?? 0,
    averageFAQs: raw.contentPatterns?.averageFAQs ?? 0,
    averageLinks: raw.contentPatterns?.averageLinks ?? 0,
    averageCitations: raw.contentPatterns?.averageCitations ?? 0,
    averageExamples: raw.contentPatterns?.averageExamples ?? 0,
  },
  searchIntent: raw.searchIntent ?? { primaryIntent: 'informational', confidence: 0, explanation: 'N/A' },
  topicCoverage: {
    coreTopics: raw.topicCoverage?.coreTopics ?? [],
    supportingTopics: raw.topicCoverage?.supportingTopics ?? [],
    advancedTopics: raw.topicCoverage?.advancedTopics ?? [],
    missingTopics: raw.topicCoverage?.missingTopics ?? [],
    optionalTopics: raw.topicCoverage?.optionalTopics ?? [],
  },
  faqs: {
    questions: (raw.faqs?.questions || []).map((q: any) => ({
      question: q.question || '',
      frequency: q.frequency || 1,
      enabled: true,
    })),
  },
  statistics: {
    statistics: (raw.statistics?.statistics || []).map((s: any) => ({
      value: s.value || '',
      context: s.context || '',
      enabled: true,
    })),
  },
  experts: {
    expertQuotes: raw.expertAnalysis?.expertQuotes ?? [],
    referencedOrganizations: raw.expertAnalysis?.referencedOrganizations ?? [],
    researchPapers: raw.expertAnalysis?.researchPapers ?? [],
    governmentSources: raw.expertAnalysis?.governmentSources ?? [],
  },
  outline: raw.outline ?? { suggestedH2s: [], suggestedH3s: [], recommendedFAQ: [], recommendedCTA: '' },
});

// ---- Mega-Call Analysis Function ----

const buildMegaPrompt = (pages: FetchedPage[], topic: string): string => {
  const pageSummary = buildAllPagesSummary(pages);
  return `You are an expert SEO analyst and content strategist. Analyze the following ${pages.filter(p => p.fetchStatus === 'success').length} competitor pages for the topic "${topic}" and return a comprehensive analysis.

COMPETITOR PAGES:
${pageSummary}

Return ONLY valid JSON with this exact structure:
{
  "contentSimilarity": {
    "commonTopics": ["topic1", "topic2"],
    "commonQuestions": ["question1"],
    "repeatedAdvice": ["advice1"],
    "repeatedStatistics": ["stat1"],
    "commonH2s": ["heading1"],
    "commonH3s": ["subheading1"],
    "commonExamples": ["example1"],
    "frequentlyLinkedResources": ["url1"]
  },
  "contentGaps": {
    "missingTopics": ["topic1"],
    "missingSubtopics": ["subtopic1"],
    "missingFAQs": ["faq1"],
    "missingComparisons": ["comparison1"],
    "missingExamples": ["example type"],
    "missingCaseStudies": ["case study topic"],
    "missingStatistics": ["statistic type"],
    "missingExpertOpinions": ["expert type"],
    "contentOpportunities": [{"topic": "opportunity", "reason": "why"}]
  },
  "seoStructure": {
    "averageH2s": 5, "averageH3s": 12, "averageParagraphLength": 80,
    "bulletUsagePercent": 60, "tableUsagePercent": 30, "imageUsagePercent": 70,
    "faqUsagePercent": 40, "calloutUsagePercent": 20, "listUsagePercent": 50,
    "recommendations": ["rec1", "rec2"]
  },
  "hookAnalysis": {
    "topHookPattern": "description",
    "averageIntroLength": 95,
    "commonFirstSentenceStructure": "Question/Problem/Statistic",
    "hookStyles": [{"style": "problem-first", "count": 3}],
    "recommendation": "specific recommendation"
  },
  "writingStyle": {
    "tone": ["professional", "educational"],
    "readingLevel": "Grade 7-8",
    "sentenceComplexity": "moderate",
    "vocabulary": "industry-specific but accessible",
    "paragraphSize": "3-4 sentences",
    "formality": "semi-formal",
    "voice": "authoritative yet conversational",
    "persuasiveness": "moderate-high",
    "storytelling": "minimal",
    "educationalDepth": "comprehensive",
    "actionability": "high"
  },
  "readability": {
    "fleschReadingEase": 65, "gradeLevel": "Grade 7",
    "averageSentenceLength": 15, "averageWordLength": 4.5,
    "averageParagraphLength": 80, "passiveVoicePercent": 12,
    "transitionWordPercent": 8, "recommendedLevel": "Grade 7",
    "reason": "explanation"
  },
  "contentPatterns": {
    "averageArticleLength": 2500, "averageImages": 5, "averageTables": 2,
    "averageBulletLists": 4, "averageFAQs": 3, "averageLinks": 8,
    "averageCitations": 3, "averageExamples": 4
  },
  "searchIntent": {
    "primaryIntent": "informational",
    "confidence": 85,
    "explanation": "why this intent was determined"
  },
  "topicCoverage": {
    "coreTopics": ["topic1"],
    "supportingTopics": ["topic2"],
    "advancedTopics": ["topic3"],
    "missingTopics": ["topic4"],
    "optionalTopics": ["topic5"]
  },
  "faqs": {
    "questions": [{"question": "What is X?", "frequency": 4}]
  },
  "statistics": {
    "statistics": [{"value": "73% of marketers", "context": "use AI tools"}]
  },
  "expertAnalysis": {
    "expertQuotes": ["quote1"],
    "referencedOrganizations": ["org1"],
    "researchPapers": ["paper1"],
    "governmentSources": ["source1"]
  },
  "outline": {
    "suggestedH2s": ["H2-1", "H2-2"],
    "suggestedH3s": ["H3-1", "H3-2"],
    "recommendedFAQ": ["FAQ-1"],
    "recommendedCTA": "specific call-to-action"
  }
}`;
};

export const generateSerpIntelligenceReportMega = async (
  pages: FetchedPage[],
  topic: string,
  onProgress?: (stage: string, progress: number) => void,
): Promise<SerpIntelligenceReport> => {
  const successfulPages = pages.filter(p => p.fetchStatus === 'success');
  if (successfulPages.length === 0) {
    throw new Error('No successfully fetched pages to analyze');
  }

  const apiKey = localStorage.getItem('user_deepseek_api_key');
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('DeepSeek API key is missing. Please add your API key in Settings → API Provider Settings.');
  }

  const cacheKey = getCacheKey(successfulPages);
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    onProgress?.('Report complete (cached)!', 100);
    return cached.result;
  }

  onProgress?.('Analyzing competitor content...', 10);

  const prompt = buildMegaPrompt(successfulPages, topic);
  const raw = await callDeepSeek(prompt, { model: 'deepseek-v4-flash' });

  onProgress?.('Report complete!', 100);

  const result = validateAndRepairResponse(raw);
  analysisCache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
};

// ---- Individual Analysis Functions ----

export const analyzeContentSimilarity = async (pages: FetchedPage[]): Promise<ContentSimilarityResult> => {
  if (pages.filter(p => p.fetchStatus === 'success').length < 2) {
    return {
      commonTopics: [], commonQuestions: [], repeatedAdvice: [],
      repeatedStatistics: [], commonH2s: [], commonH3s: [],
      commonExamples: [], frequentlyLinkedResources: [],
    };
  }

  const content = buildContentSummary(pages);
  const prompt = `Analyze these ${pages.length} competitor pages and identify what they have in common.

Content:
${content.substring(0, 15000)}

Return JSON:
{
  "commonTopics": ["topic1", "topic2"],
  "commonQuestions": ["question1", "question2"],
  "repeatedAdvice": ["advice1"],
  "repeatedStatistics": ["stat1"],
  "commonH2s": ["heading1", "heading2"],
  "commonH3s": ["subheading1"],
  "commonExamples": ["example1"],
  "frequentlyLinkedResources": ["url1", "url2"]
}`;

  try {
    return await callDeepSeek(prompt);
  } catch (e: any) {
    if (e.message?.includes('CRITICAL_API_ERROR')) throw e;
    console.error('[SERP Analysis] Content similarity analysis failed:', e);
    return {
      commonTopics: [], commonQuestions: [], repeatedAdvice: [],
      repeatedStatistics: [], commonH2s: [], commonH3s: [],
      commonExamples: [], frequentlyLinkedResources: [],
    };
  }
};

export const analyzeContentGaps = async (pages: FetchedPage[]): Promise<ContentGapResult> => {
  if (pages.filter(p => p.fetchStatus === 'success').length < 2) {
    return {
      missingTopics: [], missingSubtopics: [], missingFAQs: [],
      missingComparisons: [], missingExamples: [], missingCaseStudies: [],
      missingStatistics: [], missingExpertOpinions: [], contentOpportunities: [],
    };
  }

  const content = buildContentSummary(pages);
  const prompt = `Analyze these ${pages.length} competitor pages and identify CONTENT GAPS - what's MISSING that a new article should cover.

Content:
${content.substring(0, 15000)}

Return JSON:
{
  "missingTopics": ["topic1", "topic2"],
  "missingSubtopics": ["subtopic1"],
  "missingFAQs": ["faq1"],
  "missingComparisons": ["comparison1"],
  "missingExamples": ["example type"],
  "missingCaseStudies": ["case study topic"],
  "missingStatistics": ["statistic type"],
  "missingExpertOpinions": ["expert type"],
  "contentOpportunities": [{"topic": "opportunity", "reason": "why it matters"}]
}`;

  try {
    const result = await callDeepSeek(prompt);
    return {
      ...result,
      contentOpportunities: (result.contentOpportunities || []).map((o: any) => ({
        topic: o.topic || '',
        reason: o.reason || '',
        enabled: true,
      })),
    };
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] Content gap analysis failed:', e);
    return {
      missingTopics: [], missingSubtopics: [], missingFAQs: [],
      missingComparisons: [], missingExamples: [], missingCaseStudies: [],
      missingStatistics: [], missingExpertOpinions: [], contentOpportunities: [],
    };
  }
};

export const analyzeSeoStructure = async (pages: FetchedPage[]): Promise<SeoStructureResult> => {
  const content = buildContentSummary(pages);
  const prompt = `Analyze the SEO structure of these ${pages.length} competitor pages.

Content:
${content.substring(0, 12000)}

Return JSON:
{
  "averageH2s": 5,
  "averageH3s": 12,
  "averageParagraphLength": 80,
  "bulletUsagePercent": 60,
  "tableUsagePercent": 30,
  "imageUsagePercent": 70,
  "faqUsagePercent": 40,
  "calloutUsagePercent": 20,
  "listUsagePercent": 50,
  "recommendations": ["rec1", "rec2"]
}`;

  try {
    return await callDeepSeek(prompt);
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] SEO structure analysis failed:', e);
    return {
      averageH2s: 0, averageH3s: 0, averageParagraphLength: 0,
      bulletUsagePercent: 0, tableUsagePercent: 0, imageUsagePercent: 0,
      faqUsagePercent: 0, calloutUsagePercent: 0, listUsagePercent: 0,
      recommendations: [],
    };
  }
};

export const analyzeHooks = async (pages: FetchedPage[]): Promise<HookAnalysisResult> => {
  const topPages = pages.filter(p => p.fetchStatus === 'success').slice(0, 5);
  if (topPages.length === 0) {
    return {
      topHookPattern: 'N/A', averageIntroLength: 0,
      commonFirstSentenceStructure: 'N/A', hookStyles: [], recommendation: 'N/A',
    };
  }

  const content = buildTop5Summary(pages);
  const prompt = `Analyze the INTRODUCTIONS/hooks of these ${topPages.length} top-ranking pages. Focus only on the first 200 words of each.

Content:
${content.substring(0, 10000)}

Return JSON:
{
  "topHookPattern": "description of most common hook",
  "averageIntroLength": 95,
  "commonFirstSentenceStructure": "Question/Problem/Statistic/Story",
  "hookStyles": [{"style": "problem-first", "count": 3}, {"style": "statistic-first", "count": 1}],
  "recommendation": "specific recommendation for a stronger hook"
}`;

  try {
    return await callDeepSeek(prompt);
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] Hook analysis failed:', e);
    return {
      topHookPattern: 'N/A', averageIntroLength: 0,
      commonFirstSentenceStructure: 'N/A', hookStyles: [], recommendation: 'N/A',
    };
  }
};

export const analyzeWritingStyle = async (pages: FetchedPage[]): Promise<WritingStyleResult> => {
  const content = buildContentSummary(pages);
  const prompt = `Analyze the writing style of these ${pages.length} competitor pages.

Content:
${content.substring(0, 12000)}

Return JSON:
{
  "tone": ["professional", "educational"],
  "readingLevel": "Grade 7-8",
  "sentenceComplexity": "moderate",
  "vocabulary": "industry-specific but accessible",
  "paragraphSize": "3-4 sentences",
  "formality": "semi-formal",
  "voice": "authoritative yet conversational",
  "persuasiveness": "moderate-high",
  "storytelling": "minimal",
  "educationalDepth": "comprehensive",
  "actionability": "high"
}`;

  try {
    return await callDeepSeek(prompt);
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] Writing style analysis failed:', e);
    return {
      tone: [], readingLevel: 'N/A', sentenceComplexity: 'N/A',
      vocabulary: 'N/A', paragraphSize: 'N/A', formality: 'N/A',
      voice: 'N/A', persuasiveness: 'N/A', storytelling: 'N/A',
      educationalDepth: 'N/A', actionability: 'N/A',
    };
  }
};

export const analyzeReadability = async (pages: FetchedPage[]): Promise<ReadabilityResult> => {
  const content = buildContentSummary(pages);
  const prompt = `Analyze the readability of these ${pages.length} competitor pages.

Content:
${content.substring(0, 10000)}

Return JSON:
{
  "fleschReadingEase": 65,
  "gradeLevel": "Grade 7",
  "averageSentenceLength": 15,
  "averageWordLength": 4.5,
  "averageParagraphLength": 80,
  "passiveVoicePercent": 12,
  "transitionWordPercent": 8,
  "recommendedLevel": "Grade 7",
  "reason": "explanation"
}`;

  try {
    return await callDeepSeek(prompt);
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] Readability analysis failed:', e);
    return {
      fleschReadingEase: 0, gradeLevel: 'N/A', averageSentenceLength: 0,
      averageWordLength: 0, averageParagraphLength: 0, passiveVoicePercent: 0,
      transitionWordPercent: 0, recommendedLevel: 'N/A', reason: 'N/A',
    };
  }
};

export const analyzeContentPatterns = async (pages: FetchedPage[]): Promise<ContentPatternResult> => {
  const content = buildContentSummary(pages);
  const prompt = `Analyze content patterns across these ${pages.length} competitor pages.

Content:
${content.substring(0, 10000)}

Return JSON:
{
  "averageArticleLength": 2500,
  "averageImages": 5,
  "averageTables": 2,
  "averageBulletLists": 4,
  "averageFAQs": 3,
  "averageLinks": 8,
  "averageCitations": 3,
  "averageExamples": 4
}`;

  try {
    return await callDeepSeek(prompt);
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] Content pattern analysis failed:', e);
    return {
      averageArticleLength: 0, averageImages: 0, averageTables: 0,
      averageBulletLists: 0, averageFAQs: 0, averageLinks: 0,
      averageCitations: 0, averageExamples: 0,
    };
  }
};

export const analyzeSearchIntent = async (pages: FetchedPage[], topic: string): Promise<SearchIntentResult> => {
  const content = buildTop5Summary(pages);
  const prompt = `Analyze the search intent for the topic: "${topic}" based on these ${pages.length} top-ranking pages.

Content:
${content.substring(0, 8000)}

Return JSON:
{
  "primaryIntent": "informational/commercial/transactional/navigational/mixed",
  "confidence": 85,
  "explanation": "why this intent was determined"
}`;

  try {
    return await callDeepSeek(prompt);
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] Search intent analysis failed:', e);
    return { primaryIntent: 'informational', confidence: 0, explanation: 'N/A' };
  }
};

export const analyzeTopicCoverage = async (pages: FetchedPage[]): Promise<TopicCoverageMap> => {
  const content = buildContentSummary(pages);
  const prompt = `Create a topic coverage map from these ${pages.length} competitor pages.

Content:
${content.substring(0, 12000)}

Return JSON:
{
  "coreTopics": ["topic1", "topic2"],
  "supportingTopics": ["topic3", "topic4"],
  "advancedTopics": ["topic5"],
  "missingTopics": ["topic6"],
  "optionalTopics": ["topic7"]
}`;

  try {
    return await callDeepSeek(prompt);
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] Topic coverage analysis failed:', e);
    return { coreTopics: [], supportingTopics: [], advancedTopics: [], missingTopics: [], optionalTopics: [] };
  }
};

export const analyzeFaqs = async (pages: FetchedPage[]): Promise<FaqAnalysisResult> => {
  const content = buildContentSummary(pages);
  const prompt = `Extract and merge FAQs from these ${pages.length} competitor pages.

Content:
${content.substring(0, 12000)}

Return JSON:
{
  "questions": [
    {"question": "What is X?", "frequency": 4},
    {"question": "How does Y work?", "frequency": 3}
  ]
}`;

  try {
    const result = await callDeepSeek(prompt);
    return {
      questions: (result.questions || []).map((q: any) => ({
        question: q.question || '',
        frequency: q.frequency || 1,
        enabled: true,
      })),
    };
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] FAQ analysis failed:', e);
    return { questions: [] };
  }
};

export const analyzeStatistics = async (pages: FetchedPage[]): Promise<StatisticsAnalysisResult> => {
  const content = buildContentSummary(pages);
  const prompt = `Extract all statistics, numbers, and data points from these ${pages.length} competitor pages.

Content:
${content.substring(0, 12000)}

Return JSON:
{
  "statistics": [
    {"value": "73% of marketers", "context": "use AI tools"},
    {"value": "$4.5 billion", "context": "market size in 2025"}
  ]
}`;

  try {
    const result = await callDeepSeek(prompt);
    return {
      statistics: (result.statistics || []).map((s: any) => ({
        value: s.value || '',
        context: s.context || '',
        enabled: true,
      })),
    };
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] Statistics analysis failed:', e);
    return { statistics: [] };
  }
};

export const analyzeExperts = async (pages: FetchedPage[]): Promise<ExpertAnalysisResult> => {
  const content = buildContentSummary(pages);
  const prompt = `Extract expert quotes, referenced organizations, research papers, and government sources from these ${pages.length} competitor pages.

Content:
${content.substring(0, 10000)}

Return JSON:
{
  "expertQuotes": ["quote1", "quote2"],
  "referencedOrganizations": ["org1", "org2"],
  "researchPapers": ["paper1"],
  "governmentSources": ["source1"]
}`;

  try {
    return await callDeepSeek(prompt);
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] Expert analysis failed:', e);
    return { expertQuotes: [], referencedOrganizations: [], researchPapers: [], governmentSources: [] };
  }
};

export const generateOutline = async (pages: FetchedPage[]): Promise<OutlineRecommendation> => {
  const content = buildContentSummary(pages);
  const prompt = `Generate an optimized article outline based on these ${pages.length} competitor pages.

Content:
${content.substring(0, 12000)}

Return JSON:
{
  "suggestedH2s": ["H2-1", "H2-2", "H2-3"],
  "suggestedH3s": ["H3-1", "H3-2", "H3-3"],
  "recommendedFAQ": ["FAQ-1", "FAQ-2"],
  "recommendedCTA": "specific call-to-action recommendation"
}`;

  try {
    return await callDeepSeek(prompt);
  } catch (e: any) { if (e?.message?.includes("CRITICAL_API_ERROR")) throw e;
    console.error('[SERP Analysis] Outline generation failed:', e);
    return { suggestedH2s: [], suggestedH3s: [], recommendedFAQ: [], recommendedCTA: '' };
  }
};

// ---- Full Report Generation ----

export const generateSerpIntelligenceReport = async (
  pages: FetchedPage[],
  topic: string,
  onProgress?: (stage: string, progress: number) => void,
): Promise<SerpIntelligenceReport> => {
  const updateProgress = (stage: string, progress: number) => {
    if (onProgress) onProgress(stage, progress);
    console.log(`[SERP Analysis] ${stage} (${progress}%)`);
  };

  const successfulPages = pages.filter(p => p.fetchStatus === 'success');
  if (successfulPages.length === 0) {
    throw new Error('No successfully fetched pages to analyze');
  }

  // Early validation: ensure API key exists before attempting 13 parallel AI calls
  const apiKey = localStorage.getItem('user_deepseek_api_key');
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('DeepSeek API key is missing. Please add your API key in Settings → API Provider Settings.');
  }

  updateProgress('Analyzing content similarity...', 5);
  const similarity = await analyzeContentSimilarity(successfulPages);

  updateProgress('Identifying content gaps...', 15);
  const gaps = await analyzeContentGaps(successfulPages);

  updateProgress('Analyzing SEO structure...', 25);
  const seoStructure = await analyzeSeoStructure(successfulPages);

  updateProgress('Analyzing hooks...', 35);
  const hook = await analyzeHooks(successfulPages);

  updateProgress('Analyzing writing style...', 45);
  const writingStyle = await analyzeWritingStyle(successfulPages);

  updateProgress('Analyzing readability...', 55);
  const readability = await analyzeReadability(successfulPages);

  updateProgress('Analyzing content patterns...', 65);
  const contentPatterns = await analyzeContentPatterns(successfulPages);

  updateProgress('Analyzing search intent...', 70);
  const searchIntent = await analyzeSearchIntent(successfulPages, topic);

  updateProgress('Mapping topic coverage...', 75);
  const topicCoverage = await analyzeTopicCoverage(successfulPages);

  updateProgress('Extracting FAQs...', 80);
  const faqs = await analyzeFaqs(successfulPages);

  updateProgress('Extracting statistics...', 85);
  const statistics = await analyzeStatistics(successfulPages);

  updateProgress('Extracting expert analysis...', 90);
  const experts = await analyzeExperts(successfulPages);

  updateProgress('Generating outline...', 95);
  const outline = await generateOutline(successfulPages);

  updateProgress('Report complete!', 100);

  return {
    similarity,
    gaps,
    seoStructure,
    hook,
    writingStyle,
    readability,
    contentPatterns,
    searchIntent,
    topicCoverage,
    faqs,
    statistics,
    experts,
    outline,
  };
};

// ---- Research Package Builder ----

export const buildResearchPackage = (
  topic: string,
  selectedUrls: string[],
  fetchedPages: FetchedPage[],
  report: SerpIntelligenceReport,
  userSelections: any,
): string => {
  const sections: string[] = [];

  sections.push(`# SERP Intelligence Research Package`);
  sections.push(`Topic: ${topic}\n`);

  // Selected content opportunities
  if (userSelections.contentOpportunities !== false && report.gaps.contentOpportunities.length > 0) {
    const enabled = report.gaps.contentOpportunities.filter((_, i) =>
      userSelections.contentOpportunities === true || userSelections.contentOpportunities?.[i] !== false
    );
    if (enabled.length > 0) {
      sections.push(`## Content Opportunities`);
      enabled.forEach(o => sections.push(`- **${o.topic}**: ${o.reason}`));
      sections.push('');
    }
  }

  // Common topics
  if (userSelections.includeCommonTopics !== false && report.similarity.commonTopics.length > 0) {
    sections.push(`## What Every Top Ranking Page Covers`);
    report.similarity.commonTopics.forEach(t => sections.push(`- ${t}`));
    sections.push('');
  }

  // Outline
  if (userSelections.includeOutline !== false && report.outline.suggestedH2s.length > 0) {
    sections.push(`## Suggested Outline`);
    report.outline.suggestedH2s.forEach((h2, i) => {
      sections.push(`${i + 1}. ${h2}`);
      const h3sForThisH2 = report.outline.suggestedH3s.slice(i * 2, (i + 1) * 2);
      h3sForThisH2.forEach(h3 => sections.push(`   - ${h3}`));
    });
    sections.push('');
  }

  // Hook recommendation
  if (userSelections.includeHookRecommendation !== false && report.hook.recommendation !== 'N/A') {
    sections.push(`## Hook Recommendation`);
    sections.push(`${report.hook.recommendation}`);
    sections.push(`Top pattern: ${report.hook.topHookPattern}`);
    sections.push(`Average intro length: ${report.hook.averageIntroLength} words`);
    sections.push('');
  }

  // Writing style
  if (userSelections.includeWritingStyle !== false && report.writingStyle.tone.length > 0) {
    sections.push(`## Writing Style`);
    sections.push(`Tone: ${report.writingStyle.tone.join(', ')}`);
    sections.push(`Reading Level: ${report.writingStyle.readingLevel}`);
    sections.push(`Voice: ${report.writingStyle.voice}`);
    sections.push('');
  }

  // Readability
  if (userSelections.includeReadability !== false && report.readability.recommendedLevel !== 'N/A') {
    sections.push(`## Readability Target`);
    sections.push(`Recommended: ${report.readability.recommendedLevel}`);
    sections.push(`Reason: ${report.readability.reason}`);
    sections.push('');
  }

  // FAQs
  if (report.faqs.questions.length > 0) {
    const enabledFaqs = report.faqs.questions.filter((_, i) =>
      userSelections.faqQuestions === true || userSelections.faqQuestions?.[i] !== false
    );
    if (enabledFaqs.length > 0) {
      sections.push(`## Suggested FAQs`);
      enabledFaqs.forEach(f => sections.push(`- ${f.question}`));
      sections.push('');
    }
  }

  // Statistics
  if (report.statistics.statistics.length > 0) {
    const enabledStats = report.statistics.statistics.filter((_, i) =>
      userSelections.statistics === true || userSelections.statistics?.[i] !== false
    );
    if (enabledStats.length > 0) {
      sections.push(`## Key Statistics to Include`);
      enabledStats.forEach(s => sections.push(`- ${s.value} (${s.context})`));
      sections.push('');
    }
  }

  // Fetched content
  sections.push(`## Source Content`);
  fetchedPages.filter(p => p.fetchStatus === 'success').forEach((p, i) => {
    sections.push(`### Source ${i + 1}: ${p.title}`);
    sections.push(`URL: ${p.url}`);
    sections.push(p.content.substring(0, 5000));
    sections.push('');
  });

  return sections.join('\n');
};
