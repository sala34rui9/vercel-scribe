
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
  V3_NON_THINKING = "DeepSeek-V3.2 (Non-thinking Mode)",
  V3_THINKING = "DeepSeek-V3.2 (Thinking Mode)",
  V3_SPECIALE = "DeepSeek-V3.2-Speciale (Thinking Mode Only)"
}

export enum SearchProvider {
  GEMINI = "Google Gemini",
  SERPSTACK = "SERPStack"
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

export interface ArticleConfig {
  mode: 'single' | 'bulk';
  topic: string; // Used for single mode
  queueTopics?: string[]; // Used for queue/bulk mode
  autoOptimize: boolean; // Enables the Auto-SEO pipeline
  
  wordCount: number;
  type: ArticleType;
  tone: ToneVoice;
  openingStyle?: OpeningStyle;
  readability?: ReadabilityLevel;
  targetCountry: TargetCountry;
  humanizeContent: boolean;
  
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
  searchProvider?: SearchProvider; // For real-time data search (Gemini or SERPStack)
}

export interface GeneratedArticle {
  id: string;
  title: string;
  content: string;
  date: string;
  sources?: string[];
  status?: 'completed' | 'failed';
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
