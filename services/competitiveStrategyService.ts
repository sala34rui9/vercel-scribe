/**
 * Competitive Strategy Engine
 * Generates "Better Than Competitor" strategy reports
 * Works with fetched content from SERP Intelligence
 */

import {
  FetchedPage,
  ContentGapResult,
  SerpIntelligenceReport,
} from '../types';
import {
  analyzeContentSimilarity,
  analyzeContentGaps,
  analyzeFaqs,
  analyzeStatistics,
  callDeepSeek,
  buildContentSummary,
  buildTop5Summary,
} from './serpAnalysisService';

// ---- Strategy Report Types ----

export interface SerpOverviewStats {
  averageWordCount: number;
  shortestArticle: { wordCount: number; url: string };
  longestArticle: { wordCount: number; url: string };
  averageReadingTime: number;
  averageH2Count: number;
  averageH3Count: number;
  averageFaqCount: number;
  averageTableCount: number;
  averageBulletListCount: number;
  averageImageCount: number;
  averageInternalLinks: number;
  averageExternalLinks: number;
  averageFreshnessDays: number;
  newestArticle: { date: string; url: string };
  oldestArticle: { date: string; url: string };
}

export interface OutlineOption {
  id: string;
  label: string;
  h2s: string[];
  h3s: string[];
  recommendedFAQ: string[];
  recommendedCTA: string;
}

export interface CompetitiveAdvantage {
  rank: number;
  action: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
}

export interface CompetitiveStrategyReport {
  overview: SerpOverviewStats;
  commonTopics: string[];
  opportunityTopics: string[];
  missingOpportunities: string[];
  weaknesses: string[];
  outlineOptions: OutlineOption[];
  selectedOutlineIndex: number;
  selectedH2s: Set<string>;
  selectedH3s: Set<string>;
  faqs: Array<{ question: string; frequency: number; enabled: boolean }>;
  statistics: Array<{ value: string; context: string; enabled: boolean }>;
  competitiveAdvantages: CompetitiveAdvantage[];
}

// ---- Computed Stats from Fetched Pages ----

export const computeSerpOverview = (pages: FetchedPage[]): SerpOverviewStats => {
  const successful = pages.filter(p => p.fetchStatus === 'success');
  if (successful.length === 0) {
    return {
      averageWordCount: 0, shortestArticle: { wordCount: 0, url: '' },
      longestArticle: { wordCount: 0, url: '' }, averageReadingTime: 0,
      averageH2Count: 0, averageH3Count: 0, averageFaqCount: 0,
      averageTableCount: 0, averageBulletListCount: 0, averageImageCount: 0,
      averageInternalLinks: 0, averageExternalLinks: 0, averageFreshnessDays: 0,
      newestArticle: { date: '', url: '' }, oldestArticle: { date: '', url: '' },
    };
  }

  const wordCounts = successful.map(p => p.content.split(/\s+/).length);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  const avgWords = Math.round(totalWords / successful.length);

  const h2Counts = successful.map(p => (p.content.match(/^## /gm) || []).length);
  const h3Counts = successful.map(p => (p.content.match(/^### /gm) || []).length);
  const tableCounts = successful.map(p => (p.content.match(/\|.*\|.*\|/g) || []).length);
  const bulletCounts = successful.map(p => (p.content.match(/^[-*] /gm) || []).length);
  const imageCounts = successful.map(p => (p.content.match(/!\[.*?\]\(.*?\)/g) || []).length);
  const internalLinkCounts = successful.map(p => (p.content.match(/\[.*?\]\((?!https?:\/\/)(.*?)\)/g) || []).length);
  const externalLinkCounts = successful.map(p => (p.content.match(/\[.*?\]\(https?:\/\/.*?\)/g) || []).length);

  const shortestIdx = wordCounts.indexOf(Math.min(...wordCounts));
  const longestIdx = wordCounts.indexOf(Math.max(...wordCounts));

  const dates = successful.filter(p => p.publicationDate).map(p => ({ date: p.publicationDate!, url: p.url }));
  const sortedDates = dates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const now = Date.now();
  const freshnessDays = successful.filter(p => p.publicationDate).map(p => {
    const pubDate = new Date(p.publicationDate!).getTime();
    return Math.round((now - pubDate) / (1000 * 60 * 60 * 24));
  });
  const avgFreshness = freshnessDays.length > 0 ? Math.round(freshnessDays.reduce((a, b) => a + b, 0) / freshnessDays.length) : 0;

  return {
    averageWordCount: avgWords,
    shortestArticle: { wordCount: Math.min(...wordCounts), url: successful[shortestIdx]?.url || '' },
    longestArticle: { wordCount: Math.max(...wordCounts), url: successful[longestIdx]?.url || '' },
    averageReadingTime: Math.round(avgWords / 200),
    averageH2Count: Math.round(h2Counts.reduce((a, b) => a + b, 0) / successful.length),
    averageH3Count: Math.round(h3Counts.reduce((a, b) => a + b, 0) / successful.length),
    averageFaqCount: Math.round(successful.filter(p => p.content.toLowerCase().includes('faq') || p.content.includes('Frequently Asked')).length),
    averageTableCount: Math.round(tableCounts.reduce((a, b) => a + b, 0) / successful.length),
    averageBulletListCount: Math.round(bulletCounts.reduce((a, b) => a + b, 0) / successful.length),
    averageImageCount: Math.round(imageCounts.reduce((a, b) => a + b, 0) / successful.length),
    averageInternalLinks: Math.round(internalLinkCounts.reduce((a, b) => a + b, 0) / successful.length),
    averageExternalLinks: Math.round(externalLinkCounts.reduce((a, b) => a + b, 0) / successful.length),
    averageFreshnessDays: avgFreshness,
    newestArticle: sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : { date: 'N/A', url: '' },
    oldestArticle: sortedDates.length > 0 ? sortedDates[0] : { date: 'N/A', url: '' },
  };
};

// ---- AI-Powered Analysis ----

export const analyzeWeaknesses = async (pages: FetchedPage[]): Promise<string[]> => {
  const content = buildContentSummary(pages);
  const prompt = `Analyze these ${pages.length} competitor pages and identify their WEAKNESSES - what they do poorly or are missing.

Content:
${content.substring(0, 12000)}

Return JSON:
{
  "weaknesses": [
    "too generic advice without specifics",
    "outdated statistics from 2022",
    "no visual examples or screenshots",
    "weak introduction that doesn't hook readers",
    "thin conclusion without actionable next steps"
  ]
}

Focus on content quality weaknesses, not technical SEO. Be specific and actionable.`;

  try {
    const result = await callDeepSeek(prompt);
    return result.weaknesses || [];
  } catch (e) {
    console.error('[Competitive Strategy] Weakness analysis failed:', e);
    return [];
  }
};

export const generateCompetitiveAdvantages = async (
  pages: FetchedPage[],
  topic: string,
  weaknesses: string[],
  gaps: ContentGapResult,
): Promise<CompetitiveAdvantage[]> => {
  const content = buildTop5Summary(pages);
  const weaknessList = weaknesses.slice(0, 5).map(w => `  - ${w}`).join('\n');
  const gapList = gaps.contentOpportunities.slice(0, 5).map(g => `  - ${g.topic}: ${g.reason}`).join('\n');

  const prompt = `Based on this competitive analysis for "${topic}", generate the Top 10 actions to create a BETTER article than all competitors.

Weaknesses found:
${weaknessList}

Content opportunities:
${gapList}

Sample content:
${content.substring(0, 8000)}

Return JSON:
{
  "advantages": [
    {"action": "Add unique case study with real implementation data", "impact": "high", "effort": "medium"},
    {"action": "Include fresh 2025-2026 statistics from authoritative sources", "impact": "high", "effort": "low"},
    {"action": "Add step-by-step implementation checklist", "impact": "high", "effort": "low"}
  ]
}

Rank by expected impact on content quality. Be specific and actionable.`;

  try {
    const result = await callDeepSeek(prompt);
    return (result.advantages || []).map((a: any, i: number) => ({
      rank: i + 1,
      action: a.action || '',
      impact: a.impact || 'medium',
      effort: a.effort || 'medium',
    }));
  } catch (e) {
    console.error('[Competitive Strategy] Advantage generation failed:', e);
    return [];
  }
};

// ---- Outline Generation with Variations ----

export const generateOutlineOption = async (
  pages: FetchedPage[],
  topic: string,
  variation: 'standard' | 'comprehensive' | 'action-oriented',
): Promise<Omit<OutlineOption, 'id' | 'label'>> => {
  const content = buildContentSummary(pages);
  const variationPrompts = {
    standard: 'Create a clear, well-organized outline covering all essential topics.',
    comprehensive: 'Create an extremely thorough outline that leaves no subtopic uncovered. Include advanced sections, edge cases, and deep dives.',
    'action-oriented': 'Create a practical, action-focused outline with step-by-step guides, checklists, implementation steps, and hands-on exercises.',
  };

  const prompt = `Generate an article outline for: "${topic}"

${variationPrompts[variation]}

Based on analysis of ${pages.length} competitor pages:
${content.substring(0, 10000)}

Return JSON:
{
  "h2s": ["Introduction", "H2-2", "H2-3", "Conclusion"],
  "h3s": ["H2-1-H3-1", "H2-1-H3-2", "H2-2-H3-1"],
  "recommendedFAQ": ["FAQ-1", "FAQ-2", "FAQ-3"],
  "recommendedCTA": "specific call-to-action"
}

Rules:
- Include 6-10 H2 headings
- Include 2-4 H3 subheadings per H2
- Include 3-5 recommended FAQs
- Make headings specific and compelling
- Include Introduction and Conclusion as first/last H2`;

  try {
    const result = await callDeepSeek(prompt);
    return {
      h2s: result.h2s || [],
      h3s: result.h3s || [],
      recommendedFAQ: result.recommendedFAQ || [],
      recommendedCTA: result.recommendedCTA || '',
    };
  } catch (e) {
    console.error('[Competitive Strategy] Outline generation failed:', e);
    return { h2s: [], h3s: [], recommendedFAQ: [], recommendedCTA: '' };
  }
};

export const generateAllOutlineOptions = async (
  pages: FetchedPage[],
  topic: string,
): Promise<OutlineOption[]> => {
  const variations: Array<{ id: string; label: string; style: 'standard' | 'comprehensive' | 'action-oriented' }> = [
    { id: 'option-a', label: 'Option A: Standard', style: 'standard' },
    { id: 'option-b', label: 'Option B: Comprehensive', style: 'comprehensive' },
    { id: 'option-c', label: 'Option C: Action-Oriented', style: 'action-oriented' },
  ];

  const options: OutlineOption[] = [];
  for (const v of variations) {
    const outline = await generateOutlineOption(pages, topic, v.style);
    options.push({ id: v.id, label: v.label, ...outline });
  }
  return options;
};

// ---- Mega-Call Strategy Function ----

export const generateCompetitiveStrategyMega = async (
  pages: FetchedPage[],
  topic: string,
  analysisResults: SerpIntelligenceReport,
  onProgress?: (stage: string, progress: number) => void,
): Promise<CompetitiveStrategyReport> => {
  const successful = pages.filter(p => p.fetchStatus === 'success');
  if (successful.length === 0) throw new Error('No successfully fetched pages');

  onProgress?.('Analyzing competitors to build winning strategy...', 50);

  const content = buildTop5Summary(successful);
  const prompt = `Based on analysis of ${successful.length} competitor pages for "${topic}", generate a competitive strategy.

Content sample:
${content.substring(0, 4000)}

Analysis findings:
- Common topics: ${analysisResults.similarity.commonTopics.join(', ')}
- Content gaps: ${analysisResults.gaps.missingTopics.join(', ')}
- Missing subtopics: ${analysisResults.gaps.missingSubtopics.join(', ')}
- Missing FAQs: ${analysisResults.gaps.missingFAQs.join(', ')}

Return JSON:
{
  "weaknesses": ["weakness1", "weakness2"],
  "outlines": {
    "standard": { "h2s": ["H2-1", "H2-2"], "h3s": ["H3-1"], "recommendedFAQ": ["FAQ-1"], "recommendedCTA": "..." },
    "comprehensive": { "h2s": ["H2-1"], "h3s": ["H3-1"], "recommendedFAQ": ["FAQ-1"], "recommendedCTA": "..." },
    "actionOriented": { "h2s": ["H2-1"], "h3s": ["H3-1"], "recommendedFAQ": ["FAQ-1"], "recommendedCTA": "..." }
  },
  "competitiveAdvantages": [
    {"action": "...", "impact": "high", "effort": "medium"}
  ]
}`;

  const result = await callDeepSeek(prompt, { model: 'deepseek-v4-pro' });

  onProgress?.('Competitive strategy complete!', 100);

  const overview = computeSerpOverview(successful);

  return {
    overview,
    commonTopics: analysisResults.similarity.commonTopics || [],
    opportunityTopics: [
      ...(analysisResults.gaps.missingSubtopics || []),
      ...(analysisResults.gaps.missingComparisons || []),
      ...(analysisResults.gaps.missingExamples || []),
    ].slice(0, 10),
    missingOpportunities: analysisResults.gaps.contentOpportunities?.map(o => o.topic) || [],
    weaknesses: result.weaknesses || [],
    outlineOptions: [
      { id: 'option-a', label: 'Option A: Standard', ...result.outlines?.standard },
      { id: 'option-b', label: 'Option B: Comprehensive', ...result.outlines?.comprehensive },
      { id: 'option-c', label: 'Option C: Action-Oriented', ...result.outlines?.actionOriented },
    ],
    selectedOutlineIndex: 0,
    selectedH2s: new Set(result.outlines?.standard?.h2s || []),
    selectedH3s: new Set(result.outlines?.standard?.h3s || []),
    faqs: analysisResults.faqs.questions || [],
    statistics: analysisResults.statistics.statistics || [],
    competitiveAdvantages: (result.competitiveAdvantages || []).map((a: any, i: number) => ({
      rank: i + 1,
      action: a.action || '',
      impact: a.impact || 'medium',
      effort: a.effort || 'medium',
    })),
  };
};

// ---- Full Report Generation ----

export const generateCompetitiveStrategyReport = async (
  pages: FetchedPage[],
  topic: string,
  onProgress?: (stage: string, progress: number) => void,
): Promise<CompetitiveStrategyReport> => {
  const updateProgress = (stage: string, progress: number) => {
    if (onProgress) onProgress(stage, progress);
    console.log(`[Competitive Strategy] ${stage} (${progress}%)`);
  };

  const successful = pages.filter(p => p.fetchStatus === 'success');
  if (successful.length === 0) throw new Error('No successfully fetched pages');

  updateProgress('Computing SERP overview...', 5);
  const overview = computeSerpOverview(successful);

  updateProgress('Analyzing common topics...', 15);
  const similarity = await analyzeContentSimilarity(successful);
  const commonTopics = similarity.commonTopics || [];

  updateProgress('Identifying content gaps...', 30);
  const gaps = await analyzeContentGaps(successful);
  const missingOpportunities = gaps.contentOpportunities?.map(o => o.topic) || [];

  updateProgress('Finding opportunity topics...', 45);
  const opportunityTopics = [
    ...(gaps.missingSubtopics || []),
    ...(gaps.missingComparisons || []),
    ...(gaps.missingExamples || []),
  ].slice(0, 10);

  updateProgress('Analyzing competitor weaknesses...', 55);
  const weaknesses = await analyzeWeaknesses(successful);

  updateProgress('Generating outline options...', 65);
  const outlineOptions = await generateAllOutlineOptions(successful, topic);

  updateProgress('Extracting FAQs...', 75);
  const faqsResult = await analyzeFaqs(successful);

  updateProgress('Extracting statistics...', 82);
  const statsResult = await analyzeStatistics(successful);

  updateProgress('Generating competitive advantages...', 90);
  const competitiveAdvantages = await generateCompetitiveAdvantages(
    successful, topic, weaknesses, gaps,
  );

  updateProgress('Report complete!', 100);

  return {
    overview,
    commonTopics,
    opportunityTopics,
    missingOpportunities,
    weaknesses,
    outlineOptions,
    selectedOutlineIndex: 0,
    selectedH2s: new Set(outlineOptions[0]?.h2s || []),
    selectedH3s: new Set(outlineOptions[0]?.h3s || []),
    faqs: faqsResult.questions,
    statistics: statsResult.statistics,
    competitiveAdvantages,
  };
};

// ---- Research Package Builder ----

export const buildCompetitivePrompt = (
  topic: string,
  report: CompetitiveStrategyReport,
): string => {
  const sections: string[] = [];

  sections.push('# Competitive Content Strategy\n');
  sections.push(`Topic: ${topic}\n`);

  // Selected outline
  const selectedOutline = report.outlineOptions[report.selectedOutlineIndex];
  if (selectedOutline) {
    const activeH2s = selectedOutline.h2s.filter(h => report.selectedH2s.has(h));
    const activeH3s = selectedOutline.h3s.filter(h => report.selectedH3s.has(h));
    if (activeH2s.length > 0) {
      sections.push('## Article Outline (SELECTED)\n');
      activeH2s.forEach((h2, i) => {
        sections.push(`${i + 1}. ${h2}`);
        const h3sForH2 = activeH3s.slice(i * 2, (i + 1) * 2);
        h3sForH2.forEach(h3 => sections.push(`   - ${h3}`));
      });
      sections.push('');
    }
    if (selectedOutline.recommendedCTA) {
      sections.push(`## Recommended CTA: ${selectedOutline.recommendedCTA}\n`);
    }
  }

  // Common topics to cover
  if (report.commonTopics.length > 0) {
    sections.push('## Topics Every Competitor Covers (REQUIRED)');
    report.commonTopics.forEach(t => sections.push(`- ${t}`));
    sections.push('');
  }

  // Missing opportunities
  if (report.missingOpportunities.length > 0) {
    sections.push('## Content Opportunities (DIFFERENTIATORS)');
    report.missingOpportunities.forEach(t => sections.push(`- ${t}`));
    sections.push('');
  }

  // Competitive advantages
  if (report.competitiveAdvantages.length > 0) {
    sections.push('## Top Competitive Actions');
    report.competitiveAdvantages.forEach(a => {
      sections.push(`${a.rank}. [${a.impact.toUpperCase()}] ${a.action}`);
    });
    sections.push('');
  }

  // FAQs
  const activeFaqs = report.faqs.filter(f => f.enabled);
  if (activeFaqs.length > 0) {
    sections.push('## Suggested FAQs');
    activeFaqs.forEach(f => sections.push(`- ${f.question}`));
    sections.push('');
  }

  // Statistics
  const activeStats = report.statistics.filter(s => s.enabled);
  if (activeStats.length > 0) {
    sections.push('## Key Statistics to Include');
    activeStats.forEach(s => sections.push(`- ${s.value} (${s.context})`));
    sections.push('');
  }

  return sections.join('\n');
};
