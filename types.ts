
export enum ArticleType {
  BLOG_POST = "Blog Post",
  NEWS_ARTICLE = "News Article",
  HOW_TO_GUIDE = "How-to Guide",
  PRODUCT_REVIEW = "Product Review",
  CASE_STUDY = "Case Study",
  LISTICLE = "Listicle"
}

export enum ToneVoice {
  PROFESSIONAL = "Professional",
  CASUAL = "Casual",
  AUTHORITATIVE = "Authoritative",
  FRIENDLY = "Friendly",
  WITTY = "Witty",
  ACADEMIC = "Academic"
}

export enum OpeningStyle {
  NONE = "None (Default)",
  FACT_STATISTIC = "Fact / Statistic",
  PROBLEM_SOLUTION = "Problem–Solution",
  ANECDOTE = "Anecdote / Short Story",
  QUESTION = "Question",
  SCENARIO = "Scenario / Hypothetical"
}

export enum ReadabilityLevel {
  NONE = "None",
  GRADE_5 = "5th grade, easily understood by 11-year-olds",
  GRADE_6 = "6th grade, conversational language",
  GRADE_7 = "7th grade, fairly easy to read",
  GRADE_8 = "8th & 9th grade, easily understood (Recommended)",
  GRADE_10 = "10th to 12th grade, fairly difficult to read"
}

export enum TargetCountry {
  GLOBAL = "Global (International English)",
  US = "United States",
  UK = "United Kingdom",
  CANADA = "Canada",
  AUSTRALIA = "Australia",
  INDIA = "India",
  GERMANY = "Germany (English)",
  FRANCE = "France (English)"
}

export enum AIProvider {
  GEMINI = "Google Gemini",
  DEEPSEEK = "DeepSeek"
}

export enum DeepSeekModel {
  V3_NON_THINKING = "DeepSeek-v4-flash (Fast & Standard)",
  V3_THINKING = "DeepSeek-v4-pro (Reasoning Mode)",
  V3_SPECIALE = "DeepSeek-v4-pro Speciale (Advanced Reasoning)"
}

export enum SearchProvider {
  GEMINI = "Google Gemini",
  SERPSTACK = "SERPStack",
  TAVILY = "Tavily",
  TINYFISH = "TinyFish",
  AUTO = "Auto"
}

export interface InternalLink {
  title: string;
  url: string;
  snippet?: string;
}

export interface ContentOpportunity {
  topic: string;
  reason: string;
}

export interface ExternalLink {
  title: string;
  url: string;
  snippet?: string;
}

/**
 * SE Ranking intelligence data injected into the generation pipeline.
 * Populated by the fetch-seo-data Edge Function before article generation.
 */
export interface SEORankingData {
  lostKeywords: string[];       // Channel A: Keywords previously ranked but lost
  competitorGaps: string[];     // Channel B: Keywords competitors rank for but target doesn't
  aiOverviewKeywords: string[]; // Channel C: Keywords that trigger AI Overviews
  dataFetchedAt?: string;       // ISO timestamp for cache validation
}

export interface ArticleConfig {
  mode: 'single' | 'bulk';
  topic: string; // Used for single mode
  queueTopics?: string[]; // Used for queue/bulk mode
  autoOptimize: boolean; // Enables the Auto-SEO pipeline
  imageCount: number; // Number of Cloudflare images to generate (0 for none)
  imageStyle?: string; // Style of the generated image
  imageRatio?: string; // Aspect ratio of the generated image
  imagePrompt?: string; // Optional custom prompt for the image

  wordCount: number;
  type: ArticleType;
  tone: ToneVoice;
  openingStyle?: OpeningStyle;
  readability?: ReadabilityLevel;
  targetCountry: TargetCountry;
  humanizeContent: boolean;

  // Formatting Options
  includeBulletPoints: boolean;
  includeTables: boolean;
  includeItalics: boolean;
  includeBold: boolean;

  primaryKeywords: string[];
  nlpKeywords: string[];

  includeFaq: boolean;
  includeConclusion: boolean;

  websiteUrl?: string;
  deepResearch: boolean;
  realTimeData: boolean;

  internalLinks?: InternalLink[];
  externalLinks?: ExternalLink[];
  enableExternalLinks?: boolean; // For queue mode auto-scanning

  // AI Provider Settings
  provider: AIProvider;
  deepSeekModel?: DeepSeekModel;
  searchProvider?: SearchProvider; // For real-time data search (Gemini, SERPStack, or Tavily)
  researchProvider?: SearchProvider; // For internal/external link scanning (Gemini or Tavily)
  externalLinkSearchProvider?: SearchProvider; // For external link discovery (Gemini or Tavily)
  keywordAnalysisProvider?: SearchProvider; // For keyword analysis (Gemini or Tavily/DeepSeek)
  manualReferenceUrls?: string[]; // User-provided URLs for reference extraction

  // Caching fields (for bulk optimization)
  cachedBrandResearch?: {
    brandVoice: string;
    siteArchitecture: string[];
    content: string;
  };
  cachedInternalLinks?: InternalLink[]; // Pre-scanned internal links for reuse
  personalResources?: string; // User-provided text resources for context

  // SE Ranking Intelligence
  targetDomain?: string;          // User's target domain for SE Ranking queries
  competitorDomain?: string;      // Primary competitor domain for gap analysis
  seoRankingData?: SEORankingData; // Populated by fetch-seo-data before generation
}

export interface GeneratedArticle {
  id: string;
  title: string;
  content: string;
  date: string;
  sources?: string[];
  status?: 'completed' | 'failed' | 'pending';
  error?: string;
  seoRankingData?: SEORankingData;
  strategy?: {
    primaryKeywords: string[];
    nlpKeywords: string[];
    internalLinksCount: number;
    externalLinksCount: number;
  };
}

export interface NLPKeywordResponse {
  keywords: string[];
}

export interface DomainOverview {
  totalKeywords: number;
  organicTraffic: number;
  paidTraffic: number;
  trafficValue: number;
  currency: string;
}

export interface CompetitorEntry {
  domain: string;
  overlappingKeywords: number;
  commonKeywords?: string[];
}

export interface KeywordExplorerData {
  domainOverview?: DomainOverview;
  topCompetitors?: CompetitorEntry[];
  lostKeywords: string[];
  competitorGaps: string[];
  similarKeywords: string[];
  relatedKeywords: string[];
  aiOverviewKeywords: string[];
}

// ============================================================
// SERP Intelligence Types
// ============================================================

export interface SerpSearchResult {
  rank: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedDate?: string;
  authorityScore?: number;
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  domain: string;
  title: string;
  author?: string;
  publicationDate?: string;
  content: string;
  language: string;
  fetchStatus: 'success' | 'failed';
  errorMessage?: string;
  latencyMs?: number;
}

export interface ContentSimilarityResult {
  commonTopics: string[];
  commonQuestions: string[];
  repeatedAdvice: string[];
  repeatedStatistics: string[];
  commonH2s: string[];
  commonH3s: string[];
  commonExamples: string[];
  frequentlyLinkedResources: string[];
}

export interface ContentGapResult {
  missingTopics: string[];
  missingSubtopics: string[];
  missingFAQs: string[];
  missingComparisons: string[];
  missingExamples: string[];
  missingCaseStudies: string[];
  missingStatistics: string[];
  missingExpertOpinions: string[];
  contentOpportunities: Array<{ topic: string; reason: string; enabled: boolean }>;
}

export interface SeoStructureResult {
  averageH2s: number;
  averageH3s: number;
  averageParagraphLength: number;
  bulletUsagePercent: number;
  tableUsagePercent: number;
  imageUsagePercent: number;
  faqUsagePercent: number;
  calloutUsagePercent: number;
  listUsagePercent: number;
  recommendations: string[];
}

export interface HookAnalysisResult {
  topHookPattern: string;
  averageIntroLength: number;
  commonFirstSentenceStructure: string;
  hookStyles: Array<{ style: string; count: number }>;
  recommendation: string;
}

export interface WritingStyleResult {
  tone: string[];
  readingLevel: string;
  sentenceComplexity: string;
  vocabulary: string;
  paragraphSize: string;
  formality: string;
  voice: string;
  persuasiveness: string;
  storytelling: string;
  educationalDepth: string;
  actionability: string;
}

export interface ReadabilityResult {
  fleschReadingEase: number;
  gradeLevel: string;
  averageSentenceLength: number;
  averageWordLength: number;
  averageParagraphLength: number;
  passiveVoicePercent: number;
  transitionWordPercent: number;
  recommendedLevel: string;
  reason: string;
}

export interface ContentPatternResult {
  averageArticleLength: number;
  averageImages: number;
  averageTables: number;
  averageBulletLists: number;
  averageFAQs: number;
  averageLinks: number;
  averageCitations: number;
  averageExamples: number;
}

export interface SearchIntentResult {
  primaryIntent: 'informational' | 'commercial' | 'transactional' | 'navigational' | 'mixed';
  confidence: number;
  explanation: string;
}

export interface TopicCoverageMap {
  coreTopics: string[];
  supportingTopics: string[];
  advancedTopics: string[];
  missingTopics: string[];
  optionalTopics: string[];
}

export interface FaqAnalysisResult {
  questions: Array<{ question: string; frequency: number; enabled: boolean }>;
}

export interface StatisticsAnalysisResult {
  statistics: Array<{ value: string; context: string; enabled: boolean }>;
}

export interface ExpertAnalysisResult {
  expertQuotes: string[];
  referencedOrganizations: string[];
  researchPapers: string[];
  governmentSources: string[];
}

export interface SerpIntelligenceReport {
  similarity: ContentSimilarityResult;
  gaps: ContentGapResult;
  seoStructure: SeoStructureResult;
  hook: HookAnalysisResult;
  writingStyle: WritingStyleResult;
  readability: ReadabilityResult;
  contentPatterns: ContentPatternResult;
  searchIntent: SearchIntentResult;
  topicCoverage: TopicCoverageMap;
  faqs: FaqAnalysisResult;
  statistics: StatisticsAnalysisResult;
  experts: ExpertAnalysisResult;
  outline: OutlineRecommendation;
}

export interface OutlineRecommendation {
  suggestedH2s: string[];
  suggestedH3s: string[];
  recommendedFAQ: string[];
  recommendedCTA: string;
}

export interface UserSelections {
  contentOpportunities: boolean[];
  faqQuestions: boolean[];
  statistics: boolean[];
  includeCommonTopics: boolean;
  includeOutline: boolean;
  includeHookRecommendation: boolean;
  includeWritingStyle: boolean;
  includeReadability: boolean;
}

export interface SerpResearchPackage {
  topic: string;
  selectedUrls: string[];
  fetchedPages: FetchedPage[];
  report: SerpIntelligenceReport;
  userSelections: UserSelections;
}
