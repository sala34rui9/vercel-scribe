
import type { ImageModel, ImageStyle, ImageRatio } from './services/imagePresets';

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
  DEEPSEEK = "DeepSeek",
  BYNARA = "Bynara"
}

export enum DeepSeekModel {
  V3_NON_THINKING = "DeepSeek-v4-flash (Fast & Standard)",
  V3_THINKING = "DeepSeek-v4-pro (Reasoning Mode)",
  V3_SPECIALE = "DeepSeek-v4-pro Speciale (Advanced Reasoning)"
}

export enum BynaraModel {
  AGNES_2_0_FLASH = "agnes-2.0-flash",
  AGNES_2_5_FLASH = "agnes-2.5-flash",
  DEEPSEEK_V4_FLASH_FREE = "deepseek-v4-flash-free",
  LAGUNA_S_2_1 = "laguna-s-2.1",
  LING_3_0_FLASH_FREE = "ling-3.0-flash-free",
  MIMO_V2_5_FREE = "mimo-v2.5-free",
  MISTRAL_LARGE = "mistral-large",
  MISTRAL_MEDIUM_3_5 = "mistral-medium-3-5",
  QWEN_3_8_MAX_FREE = "qwen-3.8-max-free",
  STEPFUN_3_7_FLASH = "stepfun-3.7-flash",
  TENCENT_HY3_FREE = "tencent-hy3-free"
}

export enum SearchProvider {
  GEMINI = "Google Gemini",
  SERPSTACK = "SERPStack",
  TAVILY = "Tavily",
  TINYFISH = "TinyFish",
  BYNARA = "Bynara",
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
  imageModel: ImageModel; // AI model used for image generation
  imageStyle: ImageStyle; // Style of the generated image
  imageRatio: ImageRatio; // Aspect ratio of the generated image
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
  bynaraModel?: BynaraModel;
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

export type { ImageModel, ImageStyle, ImageRatio } from './services/imagePresets';

// ============================================================
// Wayback Machine Integration Types
// ============================================================

/**
 * Response from the Wayback Availability API.
 * Checks whether a URL has an archived snapshot.
 */
export interface WaybackAvailabilityResponse {
  url: string;
  archived_snapshots: {
    closest?: {
      status: string;
      available: boolean;
      url: string;
      timestamp: string;
    };
  };
}

/**
 * A single capture record from the CDX API.
 * Each row represents one archived snapshot of a URL.
 */
export interface WaybackCdxRecord {
  urlKey: string;
  timestamp: string;       // YYYYMMDDHHMMSS format
  original: string;        // Original URL
  mimeType: string;        // Content type
  statusCode: number;      // HTTP status code
  digest: string;          // Content hash (deduplication)
  length: number;          // Response body size in bytes
  redirectUrl?: string;    // Redirect target if 3xx
  robotFlags?: string;     // Robot flags
  offset?: number;         // WARC file offset
  filename?: string;       // WARC filename
}

/**
 * Parsed and normalized snapshot information.
 * Used throughout the application for timeline display and content retrieval.
 */
export interface WaybackSnapshot {
  url: string;             // Original URL that was archived
  snapshotUrl: string;     // Direct link to view the archived version
  timestamp: string;       // ISO 8601 formatted date
  date: Date;              // Parsed Date object
  statusCode: number;      // HTTP status code
  mimeType: string;        // Content type
  length: number;          // Content size in bytes
  isAvailable: boolean;    // Whether the snapshot is accessible
}

/**
 * Timeline entry grouping snapshots by year.
 * Used for the Snapshot Timeline UI component.
 */
export interface WaybackTimelineEntry {
  year: number;
  snapshots: WaybackSnapshot[];
  count: number;
}

/**
 * Complete timeline result for a URL.
 */
export interface WaybackTimeline {
  url: string;
  totalCaptures: number;
  firstCapture: Date | null;
  lastCapture: Date | null;
  timeline: WaybackTimelineEntry[];
}

/**
 * Result of content extraction from an archived page.
 */
export interface WaybackExtractedContent {
  url: string;
  snapshotUrl: string;
  timestamp: string;
  title: string;
  content: string;         // Extracted text/markdown content
  mimeType: string;
  statusCode: number;
  fetchStatus: 'success' | 'failed';
  errorMessage?: string;
  latencyMs?: number;
}

/**
 * Comparison result between two snapshots.
 * Used for AI-powered content diff analysis.
 */
export interface WaybackComparisonResult {
  older: WaybackSnapshot;
  newer: WaybackSnapshot;
  olderContent?: WaybackExtractedContent;
  newerContent?: WaybackExtractedContent;
  addedSections: string[];
  removedSections: string[];
  changedHeadings: string[];
  keywordChanges: string[];
  contentGrowth: number;   // Percentage change in content length
}

/**
 * SEO analysis derived from historical snapshots.
 */
export interface WaybackSeoAnalysis {
  url: string;
  contentFreshnessScore: number;  // 0-100
  historicalWordCount: number[];
  headingEvolution: string[][];
  keywordEvolution: string[][];
  publishingTrend: 'increasing' | 'decreasing' | 'stable' | 'irregular';
  missingTopics: string[];
  recommendations: string[];
}

/**
 * Backlink recovery recommendation.
 */
export interface WaybackBacklinkRecovery {
  url: string;
  hasBacklinks: boolean;
  backlinkCount: number;
  recommendation: 'restore' | 'redirect' | 'merge' | 'rewrite';
  reason: string;
  suggestedTarget?: string;
  topic: string;
}

/**
 * Expired domain analysis result.
 */
export interface WaybackDomainAnalysis {
  domain: string;
  originalNiche: string;
  contentQuality: 'high' | 'medium' | 'low' | 'unknown';
  spamIndicators: string[];
  historicalHomepage: WaybackSnapshot | null;
  businessCategory: string;
  publishingFrequency: 'daily' | 'weekly' | 'monthly' | 'irregular' | 'unknown';
  totalCaptures: number;
  firstCapture: Date | null;
  lastCapture: Date | null;
}

/**
 * Options for CDX API queries.
 */
export interface WaybackCdxOptions {
  from?: string;           // Start timestamp (YYYYMMDDHHMMSS)
  to?: string;             // End timestamp (YYYYMMDDHHMMSS)
  limit?: number;          // Max results to return
  offset?: number;         // Skip first N results
  filterStatus?: number;   // Filter by HTTP status code
  filterMimeType?: string; // Filter by MIME type
  collapse?: string;       // Collapse duplicates (e.g., 'digest')
  fl?: string;             // Fields to return (comma-separated)
}

/**
 * Options for content extraction.
 */
export interface WaybackExtractOptions {
  timeout?: number;        // Request timeout in ms
  maxContentLength?: number; // Max content size to extract
  includeMetadata?: boolean; // Include page metadata
}
