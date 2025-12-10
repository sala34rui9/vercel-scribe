
import React, { useState, useEffect } from 'react';
import { ArticleConfig, ArticleType, ToneVoice, InternalLink, ExternalLink, OpeningStyle, ReadabilityLevel, ContentOpportunity, TargetCountry, AIProvider, DeepSeekModel, SearchProvider } from '../types';
import { generateNLPKeywords, generatePrimaryKeywords, scanForInternalLinks, scanForExternalLinks } from '../services/geminiService';
import { generateNLPKeywordsDeepSeek, generatePrimaryKeywordsDeepSeek } from '../services/deepseekService';
import { scanForInternalLinksTavily, scanForExternalLinksTavily } from '../services/tavilyService';
import {
  Wand2,
  Settings2,
  Target,
  Type,
  AlignLeft,
  Sparkles,
  Plus,
  X,
  Globe,
  Microscope,
  Search,
  Link as LinkIcon,
  ExternalLink as ExternalLinkIcon,
  CheckSquare,
  Square,
  BookOpen,
  Lightbulb,
  Save,
  Trash2,
  Check,
  RefreshCw,
  GraduationCap,
  Zap,
  AlertTriangle,
  FilePlus,
  UserCheck,
  Layers,
  FileText,
  MapPin,
  Cpu,
  BrainCircuit,
  ListOrdered
} from 'lucide-react';

interface ArticleFormProps {
  onGenerate: (config: ArticleConfig) => void;
  isGenerating: boolean;
}

export const ArticleForm: React.FC<ArticleFormProps> = ({ onGenerate, isGenerating }) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  // AI Provider State - Persisted to LocalStorage
  const [provider, setProvider] = useState<AIProvider>(() => {
    return (localStorage.getItem('seo_scribe_provider') as AIProvider) || AIProvider.GEMINI;
  });

  const [deepSeekModel, setDeepSeekModel] = useState<DeepSeekModel>(() => {
    return (localStorage.getItem('seo_scribe_deepseek_model') as DeepSeekModel) || DeepSeekModel.V3_NON_THINKING;
  });

  const [topic, setTopic] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [autoOptimize, setAutoOptimize] = useState(true);

  // Initialize from local storage if available
  const [websiteUrl, setWebsiteUrl] = useState(() => {
    return localStorage.getItem('brandWebsiteUrl') || '';
  });
  const [urlSavedSuccess, setUrlSavedSuccess] = useState(false);

  const [deepResearch, setDeepResearch] = useState(false);
  const [realTimeData, setRealTimeData] = useState(false);
  const [realTimeSearchProvider, setRealTimeSearchProvider] = useState<SearchProvider>(() => {
    const stored = localStorage.getItem('seo_scribe_realtime_search_provider');
    return (stored as SearchProvider) || SearchProvider.GEMINI;
  });

  // Research Provider State (for scanning links etc)
  const [researchProvider, setResearchProvider] = useState<SearchProvider>(() => {
    return (localStorage.getItem('seo_scribe_research_provider') as SearchProvider) || SearchProvider.TAVILY;
  });

  // Keyword Analysis Provider State (independent of main provider)
  const [keywordAnalysisProvider, setKeywordAnalysisProvider] = useState<SearchProvider>(() => {
    const stored = localStorage.getItem('seo_scribe_keyword_analysis_provider');
    return (stored as SearchProvider) || SearchProvider.GEMINI;
  });

  const [wordCount, setWordCount] = useState(1000);
  const [type, setType] = useState<ArticleType>(ArticleType.BLOG_POST);
  const [tone, setTone] = useState<ToneVoice>(ToneVoice.PROFESSIONAL);

  // Opening Style State
  const [useCustomOpening, setUseCustomOpening] = useState(false);
  const [openingStyle, setOpeningStyle] = useState<OpeningStyle>(OpeningStyle.FACT_STATISTIC);

  // Readability State
  const [readability, setReadability] = useState<ReadabilityLevel>(ReadabilityLevel.NONE);
  const [humanizeContent, setHumanizeContent] = useState(false);
  const [targetCountry, setTargetCountry] = useState<TargetCountry>(TargetCountry.US);

  const [primaryKeywordInput, setPrimaryKeywordInput] = useState('');
  const [primaryKeywords, setPrimaryKeywords] = useState<string[]>([]);
  const [isGeneratingPrimary, setIsGeneratingPrimary] = useState(false);

  const [nlpKeywords, setNlpKeywords] = useState<string[]>([]);
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);

  const [includeFaq, setIncludeFaq] = useState(false);
  const [includeConclusion, setIncludeConclusion] = useState(true);

  // Internal Linking State
  const [foundLinks, setFoundLinks] = useState<InternalLink[]>([]);
  const [contentOpportunities, setContentOpportunities] = useState<ContentOpportunity[]>([]);
  const [selectedLinkUrls, setSelectedLinkUrls] = useState<Set<string>>(new Set());
  const [isScanningLinks, setIsScanningLinks] = useState(false);

  // External Linking State
  const [includeExternalLinks, setIncludeExternalLinks] = useState(false);
  const [foundExternalLinks, setFoundExternalLinks] = useState<ExternalLink[]>([]);
  const [selectedExternalLinkUrls, setSelectedExternalLinkUrls] = useState<Set<string>>(new Set());
  const [isScanningExternal, setIsScanningExternal] = useState(false);

  // Formatting Options State
  const [includeBulletPoints, setIncludeBulletPoints] = useState(true);
  const [includeTables, setIncludeTables] = useState(true);
  const [includeItalics, setIncludeItalics] = useState(true);
  const [includeBold, setIncludeBold] = useState(true);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('seo_scribe_provider', provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem('seo_scribe_deepseek_model', deepSeekModel);
  }, [deepSeekModel]);

  useEffect(() => {
    localStorage.setItem('seo_scribe_research_provider', researchProvider);
  }, [researchProvider]);

  useEffect(() => {
    localStorage.setItem('seo_scribe_keyword_analysis_provider', keywordAnalysisProvider);
  }, [keywordAnalysisProvider]);

  // Force Tavily when DeepSeek is selected
  useEffect(() => {
    if (provider === AIProvider.DEEPSEEK && researchProvider !== SearchProvider.TAVILY) {
      setResearchProvider(SearchProvider.TAVILY);
    }
  }, [provider, researchProvider]);

  // Keyword Management
  const addPrimaryKeyword = () => {
    if (primaryKeywordInput.trim() && !primaryKeywords.includes(primaryKeywordInput.trim())) {
      setPrimaryKeywords([...primaryKeywords, primaryKeywordInput.trim()]);
      setPrimaryKeywordInput('');
    }
  };

  const removePrimaryKeyword = (kw: string) => {
    setPrimaryKeywords(primaryKeywords.filter(k => k !== kw));
  };

  const handleGeneratePrimary = async () => {
    const topicToAnalyze = mode === 'single' ? topic : bulkInput.split('\n')[0];
    if (!topicToAnalyze) return;
    setIsGeneratingPrimary(true);

    let keywords: string[] = [];
    try {
      // Use keywordAnalysisProvider instead of main provider
      if (keywordAnalysisProvider === SearchProvider.TAVILY || provider === AIProvider.DEEPSEEK) {
        try {
          keywords = await generatePrimaryKeywordsDeepSeek(topicToAnalyze);
        } catch (e: any) {
          alert(`DeepSeek Error: ${e.message || "Failed to generate keywords"}`);
          setIsGeneratingPrimary(false);
          return;
        }
      } else {
        try {
          keywords = await generatePrimaryKeywords(topicToAnalyze);
        } catch (e) {
          console.warn("Gemini Primary Keyword generation failed", e);
        }
      }

      if (keywords.length > 0) {
        const uniqueNew = keywords.filter(k => !primaryKeywords.includes(k));
        setPrimaryKeywords([...primaryKeywords, ...uniqueNew]);
      }
    } catch (e) {
      console.error("Failed to generate primary keywords", e);
    } finally {
      setIsGeneratingPrimary(false);
    }
  };

  const handleGenerateNLP = async () => {
    const topicToAnalyze = mode === 'single' ? topic : bulkInput.split('\n')[0];
    if (!topicToAnalyze) return;
    setIsGeneratingKeywords(true);

    let keywords: string[] = [];
    try {
      // Use keywordAnalysisProvider instead of main provider
      if (keywordAnalysisProvider === SearchProvider.TAVILY || provider === AIProvider.DEEPSEEK) {
        try {
          keywords = await generateNLPKeywordsDeepSeek(topicToAnalyze);
        } catch (e: any) {
          alert(`DeepSeek Error: ${e.message || "Failed to generate keywords"}`);
          setIsGeneratingKeywords(false);
          return;
        }
      } else {
        try {
          keywords = await generateNLPKeywords(topicToAnalyze);
        } catch (e) {
          console.warn("Gemini NLP Keyword generation failed", e);
        }
      }

      if (keywords.length > 0) {
        const uniqueNew = keywords.filter(k => !nlpKeywords.includes(k));
        setNlpKeywords([...nlpKeywords, ...uniqueNew]);
      }
    } catch (e) {
      console.error("Failed to generate NLP keywords", e);
    } finally {
      setIsGeneratingKeywords(false);
    }
  };

  const removeNlpKeyword = (kw: string) => {
    setNlpKeywords(nlpKeywords.filter(k => k !== kw));
  };

  const handleSaveUrl = () => {
    if (websiteUrl) {
      localStorage.setItem('brandWebsiteUrl', websiteUrl);
      setUrlSavedSuccess(true);
      setTimeout(() => setUrlSavedSuccess(false), 2000);
    }
  };

  const handleClearUrl = () => {
    setWebsiteUrl('');
    localStorage.removeItem('brandWebsiteUrl');
    setFoundLinks([]);
    setContentOpportunities([]);
    setSelectedLinkUrls(new Set());
  };

  const handleScanLinks = async (forceRefresh = false) => {
    const currentTopic = mode === 'single' ? topic : bulkInput.split('\n')[0];
    if (!websiteUrl || !currentTopic) return;

    // DeepSeek requires Tavily (enforced by UI, but keep check as safety)
    if (provider === AIProvider.DEEPSEEK && researchProvider !== SearchProvider.TAVILY) {
      alert("⚠️ Web Scan Disabled\n\nDeepSeek requires Tavily for web scanning. Please ensure Tavily is selected as the Research Provider.");
      return;
    }

    const cacheKey = `seo_scribe_link_cache_v3_${websiteUrl.trim().toLowerCase()}_${currentTopic.trim().toLowerCase()}_${deepResearch}`;

    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && (Array.isArray(parsed.links) || Array.isArray(parsed.opportunities))) {
            setFoundLinks(parsed.links || []);
            setContentOpportunities(parsed.opportunities || []);
            setSelectedLinkUrls(new Set());
            return;
          }
        } catch (e) {
          localStorage.removeItem(cacheKey);
        }
      }
    }

    setIsScanningLinks(true);
    setFoundLinks([]);
    setContentOpportunities([]);
    setSelectedLinkUrls(new Set());

    try {
      if (provider === AIProvider.DEEPSEEK && researchProvider === SearchProvider.TAVILY) {
        // Use Tavily for scanning
        const result = await scanForInternalLinksTavily(websiteUrl, currentTopic);
        setFoundLinks(result.links);
        // Tavily scan currently returns empty opportunities usually
        setContentOpportunities(result.opportunities);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch (e) {
          console.warn("Failed to cache internal links", e);
        }
      } else {
        // Use Gemini Service
        const result = await scanForInternalLinks(websiteUrl, currentTopic, primaryKeywords, deepResearch);
        setFoundLinks(result.links);
        setContentOpportunities(result.opportunities);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch (e) {
          console.warn("Failed to cache internal links", e);
        }
      }
    } catch (e) {
      console.error("Failed to scan links", e);
    } finally {
      setIsScanningLinks(false);
    }
  };

  const toggleLinkSelection = (url: string) => {
    const newSelection = new Set(selectedLinkUrls);
    if (newSelection.has(url)) {
      newSelection.delete(url);
    } else {
      newSelection.add(url);
    }
    setSelectedLinkUrls(newSelection);
  };

  const selectMostComplimenting = () => {
    const newSelection = new Set<string>();
    foundLinks.slice(0, 3).forEach(link => newSelection.add(link.url));
    setSelectedLinkUrls(newSelection);
  };

  const selectAllLinks = () => {
    const newSelection = new Set<string>();
    foundLinks.forEach(link => newSelection.add(link.url));
    setSelectedLinkUrls(newSelection);
  };

  const handleScanExternalLinks = async () => {
    const currentTopic = mode === 'single' ? topic : bulkInput.split('\n')[0];
    if (!currentTopic) return;

    // DeepSeek requires Tavily (enforced by UI, but keep check as safety)
    if (provider === AIProvider.DEEPSEEK && researchProvider !== SearchProvider.TAVILY) {
      alert("⚠️ Web Scan Disabled\n\nDeepSeek requires Tavily for web scanning. Please ensure Tavily is selected as the Research Provider.");
      return;
    }

    setIsScanningExternal(true);
    setFoundExternalLinks([]);
    setSelectedExternalLinkUrls(new Set());

    try {
      let domainToExclude = '';
      try {
        if (websiteUrl) {
          domainToExclude = new URL(websiteUrl).hostname;
        }
      } catch (e) { }

      // Logic to choose provider
      let links: any[] = [];
      if (provider === AIProvider.DEEPSEEK && researchProvider === SearchProvider.TAVILY) {
        links = await scanForExternalLinksTavily(currentTopic, domainToExclude);
      } else {
        links = await scanForExternalLinks(currentTopic, domainToExclude);
      }
      setFoundExternalLinks(links);
    } catch (e) {
      console.error("Failed to scan external links", e);
    } finally {
      setIsScanningExternal(false);
    }
  };

  const toggleExternalLinkSelection = (url: string) => {
    const newSelection = new Set(selectedExternalLinkUrls);
    if (newSelection.has(url)) {
      newSelection.delete(url);
    } else {
      if (newSelection.size >= 10) return;
      newSelection.add(url);
    }
    setSelectedExternalLinkUrls(newSelection);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const internalLinks = foundLinks.filter(link => selectedLinkUrls.has(link.url));
    const externalLinks = includeExternalLinks
      ? foundExternalLinks.filter(link => selectedExternalLinkUrls.has(link.url))
      : [];

    let queueTopics: string[] = [];
    if (mode === 'bulk') {
      queueTopics = bulkInput.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    }

    onGenerate({
      mode,
      topic,
      queueTopics,
      autoOptimize,
      wordCount,
      type,
      tone,
      openingStyle: useCustomOpening ? openingStyle : OpeningStyle.NONE,
      readability,
      targetCountry,
      humanizeContent,
      primaryKeywords,
      nlpKeywords,
      includeFaq,
      includeConclusion,
      websiteUrl,
      deepResearch,
      realTimeData,
      searchProvider: realTimeData ? realTimeSearchProvider : undefined,
      internalLinks,
      externalLinks,
      enableExternalLinks: includeExternalLinks, // Pass preference for auto-scan
      provider,
      deepSeekModel,
      researchProvider, // Pass the selected research provider
      keywordAnalysisProvider, // Pass the keyword analysis provider
      includeBulletPoints,
      includeTables,
      includeItalics,
      includeBold
    });
  };

  const isFormValid = mode === 'single' ? !!topic : bulkInput.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* AI Model Provider Selection */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 to-indigo-600"></div>
        <h2 className="text-lg font-semibold text-slate-800 flex items-center mb-4">
          <BrainCircuit className="w-5 h-5 mr-2 text-indigo-600" />
          AI Engine Selection
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Provider</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider(AIProvider.GEMINI)}
                className={`flex items-center justify-center py-3 px-4 rounded-lg border-2 transition-all ${provider === AIProvider.GEMINI
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                  }`}
              >
                <Zap className={`w-5 h-5 mr-2 ${provider === AIProvider.GEMINI ? 'fill-blue-600 text-blue-600' : ''}`} />
                Google Gemini
              </button>
              <button
                type="button"
                onClick={() => setProvider(AIProvider.DEEPSEEK)}
                className={`flex items-center justify-center py-3 px-4 rounded-lg border-2 transition-all ${provider === AIProvider.DEEPSEEK
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                  }`}
              >
                <Cpu className={`w-5 h-5 mr-2 ${provider === AIProvider.DEEPSEEK ? 'fill-indigo-600 text-indigo-600' : ''}`} />
                DeepSeek
              </button>
            </div>
          </div>

          {/* DeepSeek Specific Model Selection */}
          {provider === AIProvider.DEEPSEEK && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-medium text-slate-700 mb-1">DeepSeek Model Variant</label>
              <div className="relative">
                <div className="absolute left-3 top-3 w-4 h-4 text-indigo-500">
                  <Cpu className="w-4 h-4" />
                </div>
                <select
                  value={deepSeekModel}
                  onChange={(e) => setDeepSeekModel(e.target.value as DeepSeekModel)}
                  className="w-full pl-10 pr-3 py-2.5 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm bg-indigo-50/20 font-medium text-slate-700"
                >
                  {Object.values(DeepSeekModel).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-indigo-600 mt-1 flex items-center">
                <Target className="w-3 h-3 mr-1" />
                {deepSeekModel.includes('Thinking') ? 'Reasoning Engine Active (Slower, Higher Quality)' : 'Standard Chat Mode (Faster)'}
              </p>
              <p className="text-xs text-slate-500 mt-2 border-l-2 border-indigo-200 pl-2">
                Note: Web scanning/research options below depend on your "Research Provider" setting.
              </p>

              {/* Research Provider Selector for DeepSeek - Tavily Only */}
              <div className="mt-3 pt-3 border-t border-indigo-200">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Research/Scanning Provider</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    disabled
                    className="text-xs py-2 px-2 rounded border flex items-center justify-center bg-emerald-50 border-emerald-300 text-emerald-700 font-bold cursor-not-allowed"
                  >
                    <Search className="w-3 h-3 mr-1.5" />
                    Tavily (Required for DeepSeek)
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  *DeepSeek requires Tavily for web scanning. Gemini option is disabled.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center mb-4">
          <Settings2 className="w-5 h-5 mr-2 text-blue-600" />
          Core Settings
        </h2>

        {/* Mode Selector */}
        <div className="flex p-1 bg-slate-100 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-all ${mode === 'single'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            Single Article
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-all ${mode === 'bulk'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <ListOrdered className="w-4 h-4 mr-2" />
            Bulk Generation
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'single' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Article Topic</label>
              <input
                type="text"
                required={mode === 'single'}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. The Future of Sustainable Farming"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Content Queue (Topics)
              </label>
              <div className="relative">
                <textarea
                  required={mode === 'bulk'}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder={"Topic 1: Best SEO Strategies\nTopic 2: Digital Marketing Trends\nTopic 3: ..."}
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm resize-y"
                />
                <div className="absolute bottom-3 right-3 text-xs text-slate-400 bg-white/80 px-2 rounded">
                  {bulkInput.split('\n').filter(l => l.trim()).length} topics queued
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <label className="flex items-start cursor-pointer">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={autoOptimize}
                      onChange={(e) => setAutoOptimize(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-1"
                    />
                  </div>
                  <div className="ml-3">
                    <span className="block text-sm font-semibold text-blue-800">
                      Auto-Generate SEO Strategy (Parallel Execution)
                    </span>
                    <p className="text-xs mt-1 text-blue-600">
                      System will process up to 3 articles in parallel.
                      <br />• Auto-generates unique Primary & NLP Keywords
                      {provider === AIProvider.GEMINI ? (
                        <>
                          <br />• Scans your Brand Website for relevant internal links
                          <br />• Finds authoritative external sources
                        </>
                      ) : (
                        <>
                          <br /><span className="text-amber-600 font-bold">• Note: Web Scanning skipped for DeepSeek</span>
                        </>
                      )}
                    </p>
                    {deepResearch && provider === AIProvider.GEMINI && (
                      <p className="text-xs mt-1 text-amber-600 font-semibold">
                        Note: Deep Research + Parallel mode may hit rate limits faster.
                      </p>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-slate-700">Brand Website (Optional)</label>
              {urlSavedSuccess && (
                <span className="text-xs font-medium text-green-600 flex items-center animate-in fade-in duration-300">
                  <Check className="w-3 h-3 mr-1" />
                  Saved
                </span>
              )}
            </div>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourbrand.com"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveUrl}
                disabled={!websiteUrl}
                title="Save for future sessions"
                className="p-2 bg-white border border-slate-300 text-slate-500 rounded-lg hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleClearUrl}
                disabled={!websiteUrl}
                title="Clear saved website"
                className="p-2 bg-white border border-slate-300 text-slate-500 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Research Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`p-4 rounded-lg border transition-all ${deepResearch ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-start cursor-pointer">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    checked={deepResearch}
                    onChange={(e) => setDeepResearch(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mt-1"
                  />
                </div>
                <div className="ml-3">
                  <span className={`block text-sm font-semibold ${deepResearch ? 'text-indigo-800' : 'text-slate-700'}`}>
                    Deep Brand Research
                  </span>
                  <p className={`text-xs mt-1 ${deepResearch ? 'text-indigo-600' : 'text-slate-500'}`}>
                    Analyzes brand voice & site architecture.
                    {provider === AIProvider.DEEPSEEK && " (Uses inferred knowledge)"}
                  </p>
                </div>
              </label>
            </div>

            <div className={`p-4 rounded-lg border transition-all ${realTimeData ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-start cursor-pointer">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    checked={realTimeData}
                    onChange={(e) => setRealTimeData(e.target.checked)}
                    className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500 mt-1"
                  />
                </div>
                <div className="ml-3">
                  <span className={`block text-sm font-semibold ${realTimeData ? 'text-amber-800' : 'text-slate-700'}`}>
                    Include Real-Time Data
                  </span>
                  <p className={`text-xs mt-1 ${realTimeData ? 'text-amber-600' : 'text-slate-500'}`}>
                    Fetches latest news & stats via Search.
                    {provider === AIProvider.DEEPSEEK && " (Uses recent training data)"}
                  </p>
                </div>
              </label>

              {/* Search Provider Selection - Only show when realTimeData is enabled */}
              {realTimeData && (
                <div className="mt-3 pl-7 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Search Provider:</label>
                  <div className="flex gap-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="searchProvider"
                        value={SearchProvider.GEMINI}
                        checked={realTimeSearchProvider === SearchProvider.GEMINI}
                        onChange={(e) => {
                          const provider = e.target.value as SearchProvider;
                          setRealTimeSearchProvider(provider);
                          localStorage.setItem('seo_scribe_realtime_search_provider', provider);
                        }}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 font-medium">Google Gemini (with grounding)</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="searchProvider"
                        value={SearchProvider.SERPSTACK}
                        checked={realTimeSearchProvider === SearchProvider.SERPSTACK}
                        onChange={(e) => {
                          const provider = e.target.value as SearchProvider;
                          setRealTimeSearchProvider(provider);
                          localStorage.setItem('seo_scribe_realtime_search_provider', provider);
                        }}
                        className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-slate-700 font-medium">SERPStack API</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>


          {/* Formatting Options */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center mb-3">
              <Type className="w-4 h-4 mr-2 text-violet-600" />
              Formatting Preferences
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="relative flex items-center space-x-2 cursor-pointer touch-manipulation">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeBulletPoints ? 'bg-violet-600 border-violet-600' : 'bg-white border-slate-300'}`}>
                  {includeBulletPoints && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={includeBulletPoints}
                  onChange={(e) => setIncludeBulletPoints(e.target.checked)}
                  className="opacity-0 absolute w-0 h-0"
                />
                <span className="text-sm text-slate-700">Bullet Points</span>
              </label>

              <label className="relative flex items-center space-x-2 cursor-pointer touch-manipulation">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeTables ? 'bg-violet-600 border-violet-600' : 'bg-white border-slate-300'}`}>
                  {includeTables && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={includeTables}
                  onChange={(e) => setIncludeTables(e.target.checked)}
                  className="opacity-0 absolute w-0 h-0"
                />
                <span className="text-sm text-slate-700">Tables (Comparison)</span>
              </label>

              <label className="relative flex items-center space-x-2 cursor-pointer touch-manipulation">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeBold ? 'bg-violet-600 border-violet-600' : 'bg-white border-slate-300'}`}>
                  {includeBold && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={includeBold}
                  onChange={(e) => setIncludeBold(e.target.checked)}
                  className="opacity-0 absolute w-0 h-0"
                />
                <span className="text-sm text-slate-700">Bold Text</span>
              </label>

              <label className="relative flex items-center space-x-2 cursor-pointer touch-manipulation">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeItalics ? 'bg-violet-600 border-violet-600' : 'bg-white border-slate-300'}`}>
                  {includeItalics && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={includeItalics}
                  onChange={(e) => setIncludeItalics(e.target.checked)}
                  className="opacity-0 absolute w-0 h-0"
                />
                <span className="text-sm text-slate-700">Italics</span>
              </label>
            </div>
          </div>
          {/* Internal Linking Section */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center">
                <LinkIcon className="w-4 h-4 mr-2 text-blue-600" />
                Internal Linking Strategy
              </h3>
            </div>

            {/* Logic Branch: If Bulk + AutoOptimize, we hide controls and show info message */}
            {mode === 'bulk' && autoOptimize ? (
              <div className="p-4 bg-white text-sm text-slate-500 italic">
                {websiteUrl ? (
                  provider === AIProvider.GEMINI ? (
                    <div className="flex items-center text-blue-600">
                      <Sparkles className="w-4 h-4 mr-2" />
                      System will automatically scan <strong>{websiteUrl}</strong> for relevant links for each topic in the queue.
                    </div>
                  ) : (
                    provider === AIProvider.DEEPSEEK && researchProvider === SearchProvider.TAVILY ? (
                      <div className="flex items-center text-emerald-600">
                        <Sparkles className="w-4 h-4 mr-2" />
                        System will scan <strong>{websiteUrl}</strong> via Tavily for each topic.
                      </div>
                    ) : (
                      <div className="flex items-center text-slate-500">
                        <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                        Link scanning disabled (Gemini research in DeepSeek mode). Switch to Tavily.
                      </div>
                    )
                  )
                ) : (
                  "Add a Brand Website above to enable auto-linking in queue mode."
                )}
              </div>
            ) : (
              <div className="p-4 bg-white">
                {!websiteUrl ? (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    Enter a Brand Website above to enable internal linking features.
                  </div>
                ) : (
                  <div className="space-y-4">

                    {foundLinks.length === 0 && contentOpportunities.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => handleScanLinks(false)}
                        disabled={isScanningLinks || (mode === 'single' && !topic)}
                        className="w-full py-2 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                      >
                        {isScanningLinks ? (
                          <>
                            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                            Scanning Website...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-2" />
                            Scan for Internal Links
                            {deepResearch && <span className="ml-1 text-xs text-indigo-600 font-bold">(Deep)</span>}
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="space-y-4">
                        {/* Action Buttons */}
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={selectMostComplimenting}
                            disabled={foundLinks.length === 0}
                            className="flex-1 py-1.5 px-3 bg-blue-50 text-blue-700 text-xs font-medium rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
                          >
                            Top 3
                          </button>
                          <button
                            type="button"
                            onClick={selectAllLinks}
                            disabled={foundLinks.length === 0}
                            className="flex-1 py-1.5 px-3 bg-slate-100 text-slate-700 text-xs font-medium rounded hover:bg-slate-200 transition-colors disabled:opacity-50"
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => handleScanLinks(true)}
                            disabled={isScanningLinks}
                            title="Rescan Website"
                            className="py-1.5 px-3 bg-slate-100 text-slate-600 text-xs font-medium rounded hover:bg-slate-200 transition-colors"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isScanningLinks ? 'animate-spin' : ''}`} />
                          </button>
                        </div>

                        {/* Verified Links List */}
                        {foundLinks.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center text-xs font-semibold text-green-700">
                              <Check className="w-3.5 h-3.5 mr-1" /> Verified Existing Pages ({foundLinks.length})
                            </div>
                            <div className="max-h-48 overflow-y-auto border border-green-100 bg-green-50/20 rounded-lg divide-y divide-green-50">
                              {foundLinks.map((link, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => toggleLinkSelection(link.url)}
                                  className={`p-3 flex items-start space-x-3 cursor-pointer transition-colors ${selectedLinkUrls.has(link.url) ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                                    }`}
                                >
                                  <div className="mt-0.5">
                                    {selectedLinkUrls.has(link.url) ? (
                                      <CheckSquare className="w-4 h-4 text-blue-600" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-300" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${selectedLinkUrls.has(link.url) ? 'text-blue-700' : 'text-slate-700'}`}>
                                      {link.title}
                                    </p>
                                    <a
                                      href={link.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs text-slate-400 hover:text-blue-500 flex items-center mt-0.5 truncate"
                                    >
                                      {link.url} <ExternalLinkIcon className="w-3 h-3 ml-1 inline" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-slate-500 text-right">
                              {selectedLinkUrls.size} links selected
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded text-xs text-slate-500 text-center">
                            No direct existing links found for this topic.
                          </div>
                        )}

                        {/* Content Opportunities Section */}
                        {contentOpportunities.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                            <div className="flex items-center text-xs font-semibold text-amber-700">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Content Gap Analysis ({contentOpportunities.length})
                            </div>
                            <p className="text-xs text-slate-500 mb-2">
                              These topics are highly relevant but were NOT found on your site. Consider creating them to boost authority.
                            </p>
                            <div className="max-h-40 overflow-y-auto border border-amber-100 bg-amber-50/30 rounded-lg">
                              {contentOpportunities.map((op, idx) => (
                                <div key={idx} className="p-3 border-b border-amber-50 last:border-0 hover:bg-amber-50/50 transition-colors">
                                  <div className="flex items-start">
                                    <FilePlus className="w-4 h-4 text-amber-400 mt-0.5 mr-2 shrink-0" />
                                    <div>
                                      <p className="text-sm font-medium text-slate-800">{op.topic}</p>
                                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{op.reason}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* External Linking Section */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center">
                <ExternalLinkIcon className="w-4 h-4 mr-2 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-800">External Linking Strategy</h3>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeExternalLinks}
                  onChange={(e) => setIncludeExternalLinks(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span className="ml-2 text-xs font-medium text-slate-600">Enable</span>
              </label>
            </div>

            {/* Logic Branch: If Bulk + AutoOptimize + Enabled, hide manual search */}
            {includeExternalLinks && mode === 'bulk' && autoOptimize ? (
              <div className="p-4 bg-white text-sm text-slate-500 italic">
                {provider === AIProvider.GEMINI ? (
                  <div className="flex items-center text-indigo-600">
                    <Sparkles className="w-4 h-4 mr-2" />
                    System will automatically find authoritative external sources for each topic.
                  </div>
                ) : (
                  <div className="flex items-center text-slate-500">
                    <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                    Link search skipped for DeepSeek queue to prevent quota errors.
                  </div>
                )}
              </div>
            ) : includeExternalLinks && (
              <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Find authoritative external sources to boost credibility. Select up to 10 links.
                  </p>

                  {foundExternalLinks.length === 0 ? (
                    <button
                      type="button"
                      onClick={handleScanExternalLinks}
                      disabled={isScanningExternal || (mode === 'single' && !topic)}
                      className="w-full py-2 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      {isScanningExternal ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                          Finding Resources...
                        </>
                      ) : (
                        <>
                          <Globe className="w-4 h-4 mr-2" />
                          Find External Sources
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-medium ${selectedExternalLinkUrls.size >= 10 ? 'text-amber-600' : 'text-slate-500'}`}>
                          {selectedExternalLinkUrls.size}/10 selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setFoundExternalLinks([])}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Clear Results
                        </button>
                      </div>

                      <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                        {foundExternalLinks.map((link, idx) => (
                          <div
                            key={idx}
                            onClick={() => toggleExternalLinkSelection(link.url)}
                            className={`p-3 flex items-start space-x-3 cursor-pointer transition-colors ${selectedExternalLinkUrls.has(link.url) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                              }`}
                          >
                            <div className="mt-0.5">
                              {selectedExternalLinkUrls.has(link.url) ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${selectedExternalLinkUrls.has(link.url) ? 'text-indigo-700' : 'text-slate-700'}`}>
                                {link.title}
                              </p>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-slate-400 hover:text-indigo-500 flex items-center mt-0.5 truncate"
                              >
                                {link.url} <ExternalLinkIcon className="w-3 h-3 ml-1 inline" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>


          {/* Type & Tone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Article Type</label>
              <div className="relative">
                <Type className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ArticleType)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm appearance-none bg-white"
                >
                  {Object.values(ArticleType).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Brand Voice</label>
              <div className="relative">
                <Sparkles className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as ToneVoice)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm appearance-none bg-white"
                >
                  {Object.values(ToneVoice).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Target Country Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Target Country & Localization</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <select
                value={targetCountry}
                onChange={(e) => setTargetCountry(e.target.value as TargetCountry)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm appearance-none bg-white"
              >
                {Object.values(TargetCountry).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Target Word Count: <span className="font-bold text-blue-600">{wordCount}</span>
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={wordCount}
                onChange={(e) => setWordCount(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center mb-4">
          <AlignLeft className="w-5 h-5 mr-2 text-blue-600" />
          Structure & Style
        </h2>
        <div className="space-y-4">
          {/* Readability Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Text Readability</label>
            <div className="relative">
              <GraduationCap className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <select
                value={readability}
                onChange={(e) => setReadability(e.target.value as ReadabilityLevel)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm appearance-none bg-white"
              >
                {Object.values(ReadabilityLevel).map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Humanize Content Toggle */}
          <div className={`p-3 rounded-lg border transition-all ${humanizeContent ? 'bg-pink-50 border-pink-200' : 'bg-slate-50 border-slate-200'}`}>
            <label className="flex items-start cursor-pointer">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  checked={humanizeContent}
                  onChange={(e) => setHumanizeContent(e.target.checked)}
                  className="w-4 h-4 text-pink-600 border-slate-300 rounded focus:ring-pink-500 mt-1"
                />
              </div>
              <div className="ml-3">
                <div className="flex items-center">
                  <UserCheck className={`w-4 h-4 mr-1.5 ${humanizeContent ? 'text-pink-600' : 'text-slate-500'}`} />
                  <span className={`block text-sm font-semibold ${humanizeContent ? 'text-pink-800' : 'text-slate-700'}`}>
                    Humanize Content (Anti-Bot Mode)
                  </span>
                </div>
                <p className={`text-xs mt-1 ${humanizeContent ? 'text-pink-600' : 'text-slate-500'}`}>
                  Removes AI-sounding terms (e.g., "delve", "tapestry"). Prioritizes natural, conversational flow.
                </p>
              </div>
            </label>
          </div>

          {/* Custom Opening Section */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <BookOpen className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
                <div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomOpening}
                      onChange={(e) => setUseCustomOpening(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm font-semibold text-slate-800">Customize Opening Style</span>
                  </label>
                  <p className="text-xs text-slate-500 mt-1 ml-6">
                    Choose specifically how you want the article to begin.
                  </p>
                </div>
              </div>
            </div>

            {useCustomOpening && (
              <div className="mt-3 ml-8 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Select Opening Type</label>
                <div className="relative">
                  <Lightbulb className="absolute left-3 top-2.5 w-4 h-4 text-amber-500" />
                  <select
                    value={openingStyle}
                    onChange={(e) => setOpeningStyle(e.target.value as OpeningStyle)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm appearance-none bg-white"
                  >
                    {Object.values(OpeningStyle)
                      .filter(style => style !== OpeningStyle.NONE)
                      .map(style => (
                        <option key={style} value={style}>{style}</option>
                      ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={includeFaq}
                onChange={(e) => setIncludeFaq(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Include FAQ Section</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={includeConclusion}
                onChange={(e) => setIncludeConclusion(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Include Key Takeaways/Conclusion</span>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center mb-4">
          <Target className="w-5 h-5 mr-2 text-blue-600" />
          SEO Strategy
        </h2>

        {/* Keyword Analysis Provider Selector */}
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Keyword Analysis Provider</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKeywordAnalysisProvider(SearchProvider.GEMINI)}
              className={`text-xs py-2 px-2 rounded border flex items-center justify-center ${keywordAnalysisProvider === SearchProvider.GEMINI
                ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              <Zap className="w-3 h-3 mr-1.5" />
              Google Gemini
            </button>
            <button
              type="button"
              onClick={() => setKeywordAnalysisProvider(SearchProvider.TAVILY)}
              className={`text-xs py-2 px-2 rounded border flex items-center justify-center ${keywordAnalysisProvider === SearchProvider.TAVILY
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              <Search className="w-3 h-3 mr-1.5" />
              Tavily (DeepSeek)
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Choose provider for keyword analysis (independent of main writer)
          </p>
        </div>

        {/* Logic: If Bulk + AutoOptimize, show message instead of manual inputs */}
        {mode === 'bulk' && autoOptimize ? (
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-center">
            <Sparkles className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Auto-Optimization Enabled</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Keywords will be generated automatically for each topic in the queue using {keywordAnalysisProvider === SearchProvider.TAVILY ? 'DeepSeek' : 'Gemini'} to ensure maximum relevance.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Primary Keywords */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-700">Primary Keywords</label>
                <button
                  type="button"
                  onClick={handleGeneratePrimary}
                  disabled={!isFormValid || isGeneratingPrimary}
                  className="text-xs flex items-center text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 transition-colors"
                >
                  {isGeneratingPrimary ? (
                    <span className="animate-pulse">Analyzing...</span>
                  ) : (
                    <>
                      <Search className="w-3 h-3 mr-1" />
                      {keywordAnalysisProvider === SearchProvider.TAVILY ? "Analyze via DeepSeek" : "Analyze via Gemini"}
                    </>
                  )}
                </button>
              </div>

              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={primaryKeywordInput}
                  onChange={(e) => setPrimaryKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPrimaryKeyword())}
                  placeholder="Type and press Enter"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={addPrimaryKeyword}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {primaryKeywords.map((kw, idx) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    {kw}
                    <button type="button" onClick={() => removePrimaryKeyword(kw)} className="ml-1.5 hover:text-blue-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              {primaryKeywords.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  Add main keywords to target or click "Analyze Topic" to auto-suggest.
                </p>
              )}
            </div>

            {/* NLP Keywords */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-700">NLP & LSI Keywords</label>
                <button
                  type="button"
                  onClick={handleGenerateNLP}
                  disabled={!isFormValid || isGeneratingKeywords}
                  className="text-xs flex items-center text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50 transition-colors"
                >
                  {isGeneratingKeywords ? (
                    <span className="animate-pulse">Analyzing...</span>
                  ) : (
                    <>
                      <Wand2 className="w-3 h-3 mr-1" />
                      {keywordAnalysisProvider === SearchProvider.TAVILY ? "Generate via DeepSeek" : "Generate via Gemini"}
                    </>
                  )}
                </button>
              </div>

              <div className="min-h-[80px] p-3 bg-slate-50 border border-slate-200 rounded-lg">
                {nlpKeywords.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">
                    {!isFormValid ? "Enter a topic to generate NLP keywords" : "Click Auto-Generate to fetch semantic keywords"}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {nlpKeywords.map((kw, idx) => (
                      <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                        {kw}
                        <button type="button" onClick={() => removeNlpKeyword(kw)} className="ml-1.5 hover:text-purple-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isGenerating || !isFormValid}
        className={`w-full py-4 px-6 rounded-xl text-white font-medium text-lg flex items-center justify-center transition-all ${isGenerating || !isFormValid
          ? 'bg-slate-400 cursor-not-allowed'
          : provider === AIProvider.DEEPSEEK
            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/25'
            : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-blue-500/25'
          }`}
      >
        {isGenerating ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
            {mode === 'single' ? 'Generating Content...' : 'Processing Queue...'}
          </>
        ) : (
          <>
            {mode === 'single' ? 'Generate SEO Article' : ('Start Queue Processing (' + bulkInput.split('\n').filter(l => l.trim()).length + ')')}
            <Wand2 className="w-5 h-5 ml-2" />
          </>
        )}
      </button>
    </form >
  );
}
