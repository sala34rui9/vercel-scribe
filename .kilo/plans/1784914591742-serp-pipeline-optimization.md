# SERP Intelligence Optimization: Single Mega-Call Architecture

## Problem

The current SERP Intelligence pipeline makes **~21 sequential DeepSeek API calls** (13 in Step 4 + 8 in Step 6), taking ~135 seconds total. Your earlier version was fast and high-quality because it likely consolidated these into **1-2 mega-calls**.

## Solution: Single Mega-Call Architecture

Replace 21 sequential API calls with **1 mega-call** (main analysis) + optionally **1 follow-up call** (competitive strategy). This matches your earlier fast architecture while preserving all analysis dimensions.

---

## How It Works

### The Mega-Prompt Design

One prompt sends all competitor content + requests all 13 analyses in a single JSON response:

```typescript
const MEGA_PROMPT = `You are an expert SEO analyst and content strategist. Analyze the following ${pages.length} competitor pages for the topic "${topic}" and return a comprehensive analysis.

COMPETITOR PAGES:
${buildAllPagesSummary(pages)}

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
```

### Content Preparation Function

```typescript
function buildAllPagesSummary(pages: FetchedPage[]): string {
  return pages
    .filter(p => p.fetchStatus === 'success')
    .map((p, i) => `--- PAGE ${i + 1} ---\nURL: ${p.url}\nTitle: ${p.title}\nContent:\n${p.content.substring(0, 2000)}`)
    .join('\n\n');
}
```

### Token Budget

| Component | Size |
|-----------|------|
| 10 pages × 2,000 chars | ~20,000 chars (~5,000 tokens) |
| Prompt instructions | ~2,000 chars (~500 tokens) |
| **Total input** | ~5,500 tokens |
| **Expected output** | ~2,000-3,000 tokens |
| **DeepSeek V4 Pro limit** | 128K input / 8,192 output |

Well within limits.

---

## Implementation Plan

### Task 1: Create the Mega-Call Function

**File**: `services/serpAnalysisService.ts`

Replace the 13 individual `analyze*` calls + `generateSerpIntelligenceReport()` with:

```typescript
export const generateSerpIntelligenceReportMega = async (
  pages: FetchedPage[],
  topic: string,
  onProgress?: (stage: string, progress: number) => void,
): Promise<SerpIntelligenceReport> => {
  const successfulPages = pages.filter(p => p.fetchStatus === 'success');
  if (successfulPages.length === 0) {
    throw new Error('No successfully fetched pages to analyze');
  }

  onProgress?.('Analyzing competitor content...', 10);
  
  const prompt = buildMegaPrompt(successfulPages, topic);
  const result = await callDeepSeek(prompt, { model: 'pro', temperature: 0.3 });
  
  onProgress?.('Report complete!', 100);
  
  return {
    similarity: result.contentSimilarity,
    gaps: {
      ...result.contentGaps,
      contentOpportunities: (result.contentGaps.contentOpportunities || []).map((o: any) => ({
        topic: o.topic || '',
        reason: o.reason || '',
        enabled: true,
      })),
    },
    seoStructure: result.seoStructure,
    hook: result.hookAnalysis,
    writingStyle: result.writingStyle,
    readability: result.readability,
    contentPatterns: result.contentPatterns,
    searchIntent: result.searchIntent,
    topicCoverage: result.topicCoverage,
    faqs: {
      questions: (result.faqs.questions || []).map((q: any) => ({
        question: q.question || '',
        frequency: q.frequency || 1,
        enabled: true,
      })),
    },
    statistics: {
      statistics: (result.statistics.statistics || []).map((s: any) => ({
        value: s.value || '',
        context: s.context || '',
        enabled: true,
      })),
    },
    experts: result.expertAnalysis,
    outline: result.outline,
  };
};
```

### Task 2: Consolidate Competitive Strategy into Mega-Call OR Separate Call

**Decision**: Use a **2nd mega-call** for competitive strategy (weaknesses + 3 outlines + advantages), receiving the first call's results as context. This avoids a single enormous prompt and enables better reasoning.

**File**: `services/competitiveStrategyService.ts`

```typescript
export const generateCompetitiveStrategyMega = async (
  pages: FetchedPage[],
  topic: string,
  analysisResults: SerpIntelligenceReport, // From 1st mega-call
  onProgress?: (stage: string, progress: number) => void,
): Promise<CompetitiveStrategyReport> => {
  const successful = pages.filter(p => p.fetchStatus === 'success');
  if (successful.length === 0) throw new Error('No successfully fetched pages');

  onProgress?.('Analyzing competitors to build winning strategy...', 50);

  const content = buildTop5Summary(successful);
  const prompt = `Based on analysis of ${successful.length} competitor pages for "${topic}", generate a competitive strategy.

CONTENT:
${content.substring(0, 4000)}

ANALYSIS FINDINGS:
- Common topics: ${analysisResults.similarity.commonTopics.join(', ')}
- Content gaps: ${analysisResults.gaps.missingTopics.join(', ')}
- Missing subtopics: ${analysisResults.gaps.missingSubtopics.join(', ')}

Return JSON:
{
  "weaknesses": ["weakness1", "weakness2", ...],
  "outlines": {
    "standard": { "h2s": [...], "h3s": [...], "recommendedFAQ": [...], "recommendedCTA": "..." },
    "comprehensive": { "h2s": [...], "h3s": [...], "recommendedFAQ": [...], "recommendedCTA": "..." },
    "actionOriented": { "h2s": [...], "h3s": [...], "recommendedFAQ": [...], "recommendedCTA": "..." }
  },
  "competitiveAdvantages": [
    {"action": "...", "impact": "high", "effort": "medium"},
    ...
  ]
}`;

  const result = await callDeepSeek(prompt, { model: 'pro', temperature: 0.3 });
  
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
```

### Task 3: Update SerpIntelligence.tsx to Use Mega-Calls

**File**: `components/SerpIntelligence.tsx`

Replace `handleAnalyze` and `handleCompetitiveStrategy`:

```typescript
const handleAnalyze = async () => {
  const successfulPages = fetchedPages.filter(p => p.fetchStatus === 'success');
  if (successfulPages.length === 0) return;

  setIsAnalyzing(true);
  setAnalysisProgress({ stage: 'Analyzing competitor content...', progress: 0 });

  try {
    const result = await generateSerpIntelligenceReportMega(
      successfulPages,
      topic,
      (stage, progress) => setAnalysisProgress({ stage, progress }),
    );
    setReport(result);
  } catch (err: any) {
    setSearchError('Analysis failed: ' + (err?.message || String(err)));
  } finally {
    setIsAnalyzing(false);
  }
};

const handleCompetitiveStrategy = async () => {
  const successfulPages = fetchedPages.filter(p => p.fetchStatus === 'success');
  if (successfulPages.length === 0) return;

  setIsGeneratingCompetitive(true);
  setCompetitiveProgress({ stage: 'Analyzing competitors...', progress: 0 });

  try {
    const result = await generateCompetitiveStrategyMega(
      successfulPages,
      topic,
      report!, // Results from Step 4
      (stage, progress) => setCompetitiveProgress({ stage, progress }),
    );
    setCompetitiveReport(result);
  } catch (err: any) {
    setSearchError('Competitive analysis failed: ' + (err?.message || String(err)));
  } finally {
    setIsGeneratingCompetitive(false);
  }
};
```

### Task 4: Add Partial Response Validation & Repair

**File**: `services/serpIntelligenceService.ts` (new utility)

```typescript
const validateAndRepairResponse = (raw: any): SerpIntelligenceReport => {
  // Ensure all required fields exist with defaults
  // Handles cases where model might skip a section
  return {
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
    seoStructure: { /* defaults */ },
    hook: { /* defaults */ },
    writingStyle: { /* defaults */ },
    readability: { /* defaults */ },
    contentPatterns: { /* defaults */ },
    searchIntent: raw.searchIntent ?? { primaryIntent: 'informational', confidence: 0, explanation: 'N/A' },
    topicCoverage: { /* defaults */ },
    faqs: { questions: (raw.faqs?.questions || []).map((q: any) => ({ question: q.question || '', frequency: q.frequency || 1, enabled: true })) },
    statistics: { statistics: (raw.statistics?.statistics || []).map((s: any) => ({ value: s.value || '', context: s.context || '', enabled: true })) },
    experts: { /* defaults */ },
    outline: raw.outline ?? { suggestedH2s: [], suggestedH3s: [], recommendedFAQ: [], recommendedCTA: '' },
  };
};
```

### Task 5: Add Caching for Repeated Analyses

**File**: `services/serpAnalysisService.ts`

```typescript
const analysisCache = new Map<string, { result: SerpIntelligenceReport; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(pages: FetchedPage[]): string {
  return pages
    .filter(p => p.fetchStatus === 'success')
    .map(p => p.url)
    .sort()
    .join('|');
}

// In generateSerpIntelligenceReportMega:
const cacheKey = getCacheKey(successfulPages);
const cached = analysisCache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
  onProgress?.('Report complete (cached)!', 100);
  return cached.result;
}
// ... after getting result:
analysisCache.set(cacheKey, { result, timestamp: Date.now() });
```

---

## Comparison: Before vs After

| Metric | Current (21 calls) | Mega-Call (2 calls) | Improvement |
|--------|-------------------|---------------------|-------------|
| SERP Analysis (Step 4) | ~90s | ~10-12s | **85% faster** |
| Competitive Strategy (Step 6) | ~45s | ~8-10s | **80% faster** |
| Total pipeline | ~135s | ~18-22s | **85% faster** |
| DeepSeek API calls | ~21 | **2** | **90% fewer** |
| Input tokens | ~120k | ~8k | **93% less** |
| Cost per session | ~$0.15-0.25 | ~$0.04-0.06 | **75% cheaper** |
| Time to first result | ~90s | ~10s | **89% faster** |

---

## Files to Modify

| File | Changes |
|------|---------|
| `services/serpAnalysisService.ts` | Add `generateSerpIntelligenceReportMega()`, `buildAllPagesSummary()`, `buildMegaPrompt()`, caching, `validateAndRepairResponse()`. Keep old functions as fallback. |
| `services/competitiveStrategyService.ts` | Add `generateCompetitiveStrategyMega()`. Keep old functions as fallback. |
| `components/SerpIntelligence.tsx` | Update `handleAnalyze()` and `handleCompetitiveStrategy()` to use mega-call functions. |

---

## Risk Mitigation

1. **Feature flag**: Add `useMegaCall` toggle in settings to switch between old and new implementations
2. **Response validation**: `validateAndRepairResponse()` ensures no missing fields crash the UI
3. **Fallback**: If mega-call fails, fall back to individual calls (old behavior)
4. **Content overflow**: If total content > 8,000 chars, reduce per-page truncation to 1,500 chars

---

## Validation Plan

1. Run same URLs through old and new implementations, compare JSON outputs
2. Test with edge cases: 1 page, 5 pages, 10 pages, pages with failed fetches
3. Monitor DeepSeek response quality — if model skips sections, tighten prompt instructions
4. Measure actual API response times in production
