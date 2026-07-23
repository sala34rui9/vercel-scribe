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

async function callDeepSeek(prompt: string): Promise<any> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) {
    throw new Error('DeepSeek API key is missing. Please add your API key in Settings.');
  }

  const payload = {
    model: "deepseek-chat",
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
    throw new Error(`DeepSeek API Error (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  return JSON.parse(cleanJsonOutput(content));
}

function buildContentSummary(pages: FetchedPage[]): string {
  return pages
    .filter(p => p.fetchStatus === 'success')
    .map((p, i) => `--- PAGE ${i + 1} ---\nURL: ${p.url}\nTitle: ${p.title}\nDomain: ${p.domain}\nContent:\n${p.content.substring(0, 3000)}`)
    .join('\n\n');
}

function buildTop5Summary(pages: FetchedPage[]): string {
  return pages
    .filter(p => p.fetchStatus === 'success')
    .slice(0, 5)
    .map((p, i) => `--- PAGE ${i + 1} ---\nURL: ${p.url}\nTitle: ${p.title}\nContent:\n${p.content.substring(0, 2000)}`)
    .join('\n\n');
}

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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
