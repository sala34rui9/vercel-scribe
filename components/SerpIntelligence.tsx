/**
 * SERP Intelligence Component
 * Interactive research workflow for analyzing top-ranking pages
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Search, Download, CheckSquare, Square, ChevronRight, ChevronLeft,
  Loader2, AlertCircle, Globe, FileText, Zap, Target, BarChart3,
  Eye, BookOpen, PenTool, RefreshCw, Check, X, ExternalLink,
  Layers, MessageSquare, TrendingUp, Hash
} from 'lucide-react';
import { SearchProvider, AIProvider, SerpSearchResult, FetchedPage, SerpIntelligenceReport, UserSelections, DeepSeekModel } from '../types';
import { searchWeb, getTinyFishApiKey } from '../services/tinyfishService';
import { getTinyFishFetchApiKey, fetchWebPages } from '../services/tinyfishFetchService';
import { getTavilyApiKey, tavilySearch } from '../services/tavilyService';
import { generateSerpIntelligenceReport, buildResearchPackage } from '../services/serpAnalysisService';
import { generateCompetitiveStrategyReport, buildCompetitivePrompt, CompetitiveStrategyReport } from '../services/competitiveStrategyService';
import CompetitiveStrategyReportComponent from './CompetitiveStrategyReport';

type WorkflowStep = 'search' | 'select' | 'fetch' | 'analyze' | 'recommendations' | 'competitive' | 'generate';

interface SerpIntelligenceProps {
  onGenerateWithResearch?: (researchPackage: string, topic: string, deepSeekModel: DeepSeekModel) => void;
}

export const SerpIntelligence: React.FC<SerpIntelligenceProps> = ({ onGenerateWithResearch }) => {
  // Workflow state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('search');
  const [topic, setTopic] = useState('');
  const [searchProvider, setSearchProvider] = useState<SearchProvider>(SearchProvider.TINYFISH);
  const [selectedDeepSeekModel, setSelectedDeepSeekModel] = useState<DeepSeekModel>(DeepSeekModel.V3_NON_THINKING);

  // Search results
  const [searchResults, setSearchResults] = useState<SerpSearchResult[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Fetch state
  const [fetchedPages, setFetchedPages] = useState<FetchedPage[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ completed: 0, total: 0 });

  // Analysis state
  const [report, setReport] = useState<SerpIntelligenceReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ stage: '', progress: 0 });

  // Recommendations state
  const [selections, setSelections] = useState<UserSelections>({
    contentOpportunities: [],
    faqQuestions: [],
    statistics: [],
    includeCommonTopics: true,
    includeOutline: true,
    includeHookRecommendation: true,
    includeWritingStyle: true,
    includeReadability: true,
  });

  const [isGenerating, setIsGenerating] = useState(false);

  // Competitive Strategy state
  const [competitiveReport, setCompetitiveReport] = useState<CompetitiveStrategyReport | null>(null);
  const [isGeneratingCompetitive, setIsGeneratingCompetitive] = useState(false);
  const [competitiveProgress, setCompetitiveProgress] = useState({ stage: '', progress: 0 });

  // Cache
  const fetchedCacheRef = useRef<Map<string, FetchedPage[]>>(new Map());

  // Step navigation
  const steps: { id: WorkflowStep; label: string; icon: React.ElementType }[] = [
    { id: 'search', label: 'Search', icon: Search },
    { id: 'select', label: 'Select URLs', icon: CheckSquare },
    { id: 'fetch', label: 'Fetch', icon: Download },
    { id: 'analyze', label: 'Analyze', icon: BarChart3 },
    { id: 'recommendations', label: 'Recommendations', icon: Target },
    { id: 'competitive', label: 'Competitive', icon: TrendingUp },
    { id: 'generate', label: 'Generate', icon: PenTool },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const goToStep = (step: WorkflowStep) => {
    setCurrentStep(step);
  };

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 'search': return searchResults.length > 0;
      case 'select': return selectedUrls.size > 0;
      case 'fetch': return fetchedPages.filter(p => p.fetchStatus === 'success').length > 0;
      case 'analyze': return report !== null;
      case 'recommendations': return true;
      case 'competitive': return competitiveReport !== null;
      case 'generate': return false;
      default: return false;
    }
  };

  const nextStep = () => {
    const next = steps[currentStepIndex + 1];
    if (next) {
      if (next.id === 'fetch' && selectedUrls.size > 0) {
        handleFetch();
      } else if (next.id === 'analyze' && fetchedPages.length > 0) {
        handleAnalyze();
      } else if (next.id === 'competitive' && fetchedPages.length > 0) {
        handleCompetitiveStrategy();
      }
      setCurrentStep(next.id);
    }
  };

  const prevStep = () => {
    const prev = steps[currentStepIndex - 1];
    if (prev) setCurrentStep(prev.id);
  };

  // ---- Step 1: Search ----
  const handleSearch = async () => {
    if (!topic.trim()) {
      setSearchError('Please enter a topic to search');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setSelectedUrls(new Set());

    try {
      if (searchProvider === SearchProvider.TINYFISH) {
        if (!getTinyFishApiKey()) {
          throw new Error('TinyFish API key is missing. Please add it in Settings.');
        }
        const result = await searchWeb(topic, { purpose: 'research' });
        const serpResults: SerpSearchResult[] = result.results.map((r, i) => ({
          rank: r.position || (i + 1),
          title: r.title,
          url: r.url,
          domain: r.site_name || new URL(r.url).hostname,
          snippet: r.snippet,
        }));
        setSearchResults(serpResults);
      } else if (searchProvider === SearchProvider.TAVILY) {
        if (!getTavilyApiKey()) {
          throw new Error('Tavily API key is missing. Please add it in Settings.');
        }
        const result = await tavilySearch(topic, { maxResults: 10, topic: 'general', searchDepth: 'advanced' });
        const serpResults: SerpSearchResult[] = (result.results || []).map((r: any, i: number) => ({
          rank: i + 1,
          title: r.title || 'Untitled',
          url: r.url,
          domain: new URL(r.url).hostname,
          snippet: r.content?.substring(0, 200) || '',
        }));
        setSearchResults(serpResults);
      }
    } catch (err: any) {
      setSearchError(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // ---- Step 2: URL Selection ----
  const toggleUrl = (url: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedUrls(new Set(searchResults.map(r => r.url)));
  };

  const selectNone = () => {
    setSelectedUrls(new Set());
  };


  // ---- Step 3: Fetch Content ----
  const handleFetch = async () => {
    const urls = Array.from(selectedUrls);
    if (urls.length === 0) return;
    const cacheKey = urls.sort().join(",");
    if (fetchedCacheRef.current.has(cacheKey)) {
      setFetchedPages(fetchedCacheRef.current.get(cacheKey)!);
      return;
    }
    if (!getTinyFishFetchApiKey()) {
      setSearchError("TinyFish Fetch API key is missing. Please add it in Settings.");
      return;
    }
    setIsFetching(true);
    setFetchProgress({ completed: 0, total: urls.length });
    setSearchError(null);
    const pages: FetchedPage[] = [];
    try {
      const fetchResult = await fetchWebPages(urls, { purpose: "research", format: "markdown" });
      for (const doc of fetchResult.results) {
        const pageUrl = doc.url || urls[0];
        pages.push({ url: pageUrl, finalUrl: doc.final_url || doc.url || pageUrl, domain: (() => { try { return new URL(doc.final_url || doc.url || pageUrl).hostname; } catch { return pageUrl; } })(), title: doc.title || "Untitled", author: doc.author || undefined, publicationDate: doc.published_date || undefined, content: doc.markdown || doc.text || "Content could not be extracted", language: doc.language || "en", fetchStatus: doc.status === "success" ? "success" as const : "failed" as const, errorMessage: doc.error || undefined });
      }
      setFetchProgress({ completed: urls.length, total: urls.length });
      setFetchedPages([...pages]);
      fetchedCacheRef.current.set(cacheKey, pages);
    } catch (err) {
      setSearchError("Fetch failed: " + err.message);
    } finally {
      setIsFetching(false);
    }
  };

  // ---- Step 4: Analyze ----
  const handleAnalyze = async () => {
    const successfulPages = fetchedPages.filter(p => p.fetchStatus === 'success');
    if (successfulPages.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisProgress({ stage: 'Starting analysis...', progress: 0 });

    try {
      const result = await generateSerpIntelligenceReport(
        successfulPages,
        topic,
        (stage, progress) => setAnalysisProgress({ stage, progress }),
      );
      setReport(result);
    } catch (err: any) {
      console.error('[SERP Intelligence] Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ---- Step 6: Competitive Strategy ----
  const handleCompetitiveStrategy = async () => {
    const successfulPages = fetchedPages.filter(p => p.fetchStatus === 'success');
    if (successfulPages.length === 0) return;

    setIsGeneratingCompetitive(true);
    setCompetitiveProgress({ stage: 'Starting competitive analysis...', progress: 0 });

    try {
      const result = await generateCompetitiveStrategyReport(
        successfulPages,
        topic,
        (stage, progress) => setCompetitiveProgress({ stage, progress }),
      );
      setCompetitiveReport(result);
    } catch (err: any) {
      console.error('[SERP Intelligence] Competitive strategy failed:', err);
      setSearchError(err.message || 'Competitive analysis failed');
    } finally {
      setIsGeneratingCompetitive(false);
    }
  };

  // ---- Step 7: Generate ----
  const handleGenerate = () => {
    setIsGenerating(true);

    // Use competitive report if available, otherwise fall back to basic report
    let researchPackage = '';
    if (competitiveReport) {
      researchPackage = buildCompetitivePrompt(topic, competitiveReport);
    } else if (report) {
      researchPackage = buildResearchPackage(
        topic,
        Array.from(selectedUrls),
        fetchedPages,
        report,
        selections,
      );
    }

    if (onGenerateWithResearch) {
      onGenerateWithResearch(researchPackage, topic, selectedDeepSeekModel);
    }

    setIsGenerating(false);
  };

  // ---- Render Steps ----
  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-4">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = step.id === currentStep;
        const isCompleted = i < currentStepIndex;
        const isReachable = i <= currentStepIndex || canGoNext();

        return (
          <React.Fragment key={step.id}>
            <button
              onClick={() => isReachable && goToStep(step.id)}
              disabled={!isReachable}
              className={`flex flex-col items-center gap-1.5 group ${isReachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isActive ? 'bg-blue-600 text-white shadow-lg scale-110' :
                isCompleted ? 'bg-green-500 text-white' :
                'bg-slate-200 text-slate-500'
              }`}>
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${i < currentStepIndex ? 'bg-green-500' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderSearchStep = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
          <Search className="w-5 h-5 mr-2 text-blue-600" />
          Search for SERP Analysis
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Topic / Keyword</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., best AI writing tools for content marketing"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Search Provider</label>
            <div className="flex gap-3">
              <button
                onClick={() => setSearchProvider(SearchProvider.TINYFISH)}
                className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                  searchProvider === SearchProvider.TINYFISH
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Search className="w-4 h-4 inline mr-1.5" />
                TinyFish Search
              </button>
              <button
                onClick={() => setSearchProvider(SearchProvider.TAVILY)}
                className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                  searchProvider === SearchProvider.TAVILY
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Globe className="w-4 h-4 inline mr-1.5" />
                Tavily Search
              </button>
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={isSearching || !topic.trim()}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isSearching ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Searching...</>
            ) : (
              <><Search className="w-5 h-5" /> Search SERP</>
            )}
          </button>
        </div>

        {searchError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            {searchError}
          </div>
        )}
      </div>

      {searchResults.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-600">{searchResults.length} results found</span>
            <button onClick={() => goToStep('select')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center">
              Proceed to Selection <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderSelectStep = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center">
            <CheckSquare className="w-5 h-5 mr-2 text-blue-600" />
            Select Sources to Analyze
          </h2>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors">
              Select All
            </button>
            <button onClick={selectNone} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors">
              Select None
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {searchResults.map((result) => (
            <div
              key={result.url}
              onClick={() => toggleUrl(result.url)}
              className={`px-6 py-4 cursor-pointer transition-colors ${
                selectedUrls.has(result.url) ? 'bg-blue-50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {selectedUrls.has(result.url) ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      #{result.rank}
                    </span>
                    <span className="text-xs text-slate-500 truncate">{result.domain}</span>
                  </div>
                  <h3 className="text-sm font-medium text-slate-800 mb-1 line-clamp-1">{result.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{result.snippet}</p>
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                    {result.url.length > 60 ? result.url.substring(0, 60) + '...' : result.url}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-sm text-slate-600">
            <span className="font-semibold text-blue-600">{selectedUrls.size}</span> of {searchResults.length} selected
          </span>
          <button
            onClick={nextStep}
            disabled={selectedUrls.size === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
          >
            Fetch Selected <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderFetchStep = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
          <Download className="w-5 h-5 mr-2 text-blue-600" />
          Fetch Content
        </h2>

        {isFetching && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
              <span>Fetching {fetchProgress.total} URLs...</span>
              <span>{fetchProgress.completed} / {fetchProgress.total}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(fetchProgress.completed / fetchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {fetchedPages.map((page, i) => (
            <div key={i} className={`p-3 rounded-lg border ${
              page.fetchStatus === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center gap-2">
                {page.fetchStatus === 'success' ? (
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-slate-800 truncate flex-1">{page.title || page.url}</span>
                <span className="text-xs text-slate-500">{page.domain}</span>
              </div>
              {page.fetchStatus === 'failed' && page.errorMessage && (
                <p className="text-xs text-red-600 mt-1 ml-6">{page.errorMessage}</p>
              )}
            </div>
          ))}
        </div>

        {fetchedPages.length > 0 && !isFetching && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-slate-600">
              <span className="font-semibold text-green-600">{fetchedPages.filter(p => p.fetchStatus === 'success').length}</span> successful,
              <span className="font-semibold text-red-600 ml-1">{fetchedPages.filter(p => p.fetchStatus === 'failed').length}</span> failed
            </span>
            <button
              onClick={nextStep}
              disabled={fetchedPages.filter(p => p.fetchStatus === 'success').length === 0}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              Analyze Content <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderAnalyzeStep = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
          SERP Intelligence Analysis
        </h2>

        {isAnalyzing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <div>
                <p className="text-sm font-medium text-slate-800">{analysisProgress.stage}</p>
                <p className="text-xs text-slate-500">This may take a few minutes...</p>
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${analysisProgress.progress}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['Similarity', 'Gaps', 'Structure', 'Hooks', 'Style', 'Readability', 'Intent', 'Topics'].map((label, i) => (
                <div key={label} className={`text-center p-2 rounded ${
                  analysisProgress.progress > (i + 1) * 12 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  <span className="text-xs font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isAnalyzing && report && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Analysis Complete!</h3>
            <p className="text-sm text-slate-600 mb-4">
              Analyzed {fetchedPages.filter(p => p.fetchStatus === 'success').length} pages across 12 dimensions
            </p>
            <button
              onClick={() => setCurrentStep('recommendations')}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto transition-colors"
            >
              View Recommendations <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderRecommendationsStep = () => {
    if (!report) return null;

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
            <Target className="w-5 h-5 mr-2 text-blue-600" />
            SERP Intelligence Report
          </h2>

          {/* Search Intent */}
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <h3 className="text-sm font-semibold text-indigo-800 flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4" /> Search Intent
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-indigo-700 capitalize">{report.searchIntent.primaryIntent}</span>
              <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">
                {report.searchIntent.confidence}% confidence
              </span>
            </div>
            <p className="text-sm text-indigo-700 mt-1">{report.searchIntent.explanation}</p>
          </div>

          {/* Content Similarity */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-emerald-600" /> What Every Top Ranking Page Covers
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={selections.includeCommonTopics}
                onChange={(e) => setSelections(prev => ({ ...prev, includeCommonTopics: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-slate-600">Include in research package</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {report.similarity.commonTopics.map((topic, i) => (
                <div key={i} className="text-sm bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded border border-emerald-200">
                  {topic}
                </div>
              ))}
            </div>
          </div>

          {/* Content Gaps */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-orange-600" /> Content Opportunities
            </h3>
            <div className="space-y-2">
              {report.gaps.contentOpportunities?.map((opp, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                  <input
                    type="checkbox"
                    checked={selections.contentOpportunities?.[i] !== false}
                    onChange={(e) => {
                      const newOps = [...(selections.contentOpportunities || [])];
                      newOps[i] = e.target.checked;
                      setSelections(prev => ({ ...prev, contentOpportunities: newOps }));
                    }}
                    className="w-4 h-4 text-orange-600 rounded mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium text-orange-800">{opp.topic}</span>
                    <p className="text-xs text-orange-700">{opp.reason}</p>
                  </div>
                </div>
              ))}
              {(!report.gaps.contentOpportunities || report.gaps.contentOpportunities.length === 0) && (
                <p className="text-sm text-slate-500">No specific opportunities identified</p>
              )}
            </div>
          </div>

          {/* Hook Analysis */}
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={selections.includeHookRecommendation}
                onChange={(e) => setSelections(prev => ({ ...prev, includeHookRecommendation: e.target.checked }))}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                <Zap className="w-4 h-4" /> Hook Analysis
              </h3>
            </div>
            <p className="text-sm text-purple-700 mb-1"><strong>Top pattern:</strong> {report.hook.topHookPattern}</p>
            <p className="text-sm text-purple-700 mb-1"><strong>Avg intro:</strong> {report.hook.averageIntroLength} words</p>
            <p className="text-sm text-purple-700"><strong>Recommendation:</strong> {report.hook.recommendation}</p>
          </div>

          {/* Writing Style */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={selections.includeWritingStyle}
                onChange={(e) => setSelections(prev => ({ ...prev, includeWritingStyle: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <PenTool className="w-4 h-4" /> Writing Style
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {report.writingStyle.tone.map((t, i) => (
                <span key={i} className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">{t}</span>
              ))}
            </div>
            <p className="text-sm text-blue-700 mt-2">{report.writingStyle.voice} | {report.writingStyle.formality}</p>
          </div>

          {/* Readability */}
          <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={selections.includeReadability}
                onChange={(e) => setSelections(prev => ({ ...prev, includeReadability: e.target.checked }))}
                className="w-4 h-4 text-teal-600 rounded"
              />
              <h3 className="text-sm font-semibold text-teal-800 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Readability
              </h3>
            </div>
            <p className="text-sm text-teal-700">
              <strong>Recommended:</strong> {report.readability.recommendedLevel} — {report.readability.reason}
            </p>
          </div>

          {/* Outline */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={selections.includeOutline}
                onChange={(e) => setSelections(prev => ({ ...prev, includeOutline: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" /> Suggested Outline
              </h3>
            </div>
            <div className="space-y-1">
              {report.outline.suggestedH2s.map((h2, i) => (
                <div key={i} className="text-sm text-slate-700 pl-2 border-l-2 border-slate-300">
                  {i + 1}. {h2}
                </div>
              ))}
            </div>
          </div>

          {/* FAQs */}
          {report.faqs.questions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-violet-600" /> Frequently Asked Questions
              </h3>
              <div className="space-y-2">
                {report.faqs.questions.map((faq, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selections.faqQuestions?.[i] !== false}
                      onChange={(e) => {
                        const newFaqs = [...(selections.faqQuestions || [])];
                        newFaqs[i] = e.target.checked;
                        setSelections(prev => ({ ...prev, faqQuestions: newFaqs }));
                      }}
                      className="w-4 h-4 text-violet-600 rounded"
                    />
                    <span className="text-sm text-slate-700">{faq.question}</span>
                    <span className="text-xs text-slate-400">({faq.frequency}x)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statistics */}
          {report.statistics.statistics.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
                <Hash className="w-4 h-4 text-amber-600" /> Key Statistics
              </h3>
              <div className="space-y-2">
                {report.statistics.statistics.map((stat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selections.statistics?.[i] !== false}
                      onChange={(e) => {
                        const newStats = [...(selections.statistics || [])];
                        newStats[i] = e.target.checked;
                        setSelections(prev => ({ ...prev, statistics: newStats }));
                      }}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <span className="text-sm text-slate-700"><strong>{stat.value}</strong> — {stat.context}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <button
              onClick={() => setCurrentStep('generate')}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              <PenTool className="w-5 h-5" />
              Proceed to Generate Article
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---- Step 6: Competitive Strategy Render ----
  const renderCompetitiveStep = () => {
    if (isGeneratingCompetitive) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-indigo-600" />
            Generating Competitive Strategy...
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              <div>
                <p className="text-sm font-medium text-slate-800">{competitiveProgress.stage}</p>
                <p className="text-xs text-slate-500">Analyzing competitors to build winning strategy...</p>
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${competitiveProgress.progress}%` }}
              />
            </div>
          </div>
        </div>
      );
    }

    if (!competitiveReport) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
          <TrendingUp className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Competitive Strategy</h2>
          <p className="text-sm text-slate-600 mb-4">
            Generate a comprehensive strategy to outperform all competing pages.
          </p>
          <button
            onClick={handleCompetitiveStrategy}
            className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Generate Strategy
          </button>
        </div>
      );
    }

    return (
      <CompetitiveStrategyReportComponent
        report={competitiveReport}
        onReportUpdate={setCompetitiveReport}
        onProceedToGenerate={() => setCurrentStep('generate')}
        fetchedPages={fetchedPages}
        topic={topic}
      />
    );
  };

  const renderGenerateStep = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
          <PenTool className="w-5 h-5 mr-2 text-blue-600" />
          Generate Article with Research
        </h2>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Your research package includes content from <strong>{fetchedPages.filter(p => p.fetchStatus === 'success').length}</strong> fetched pages,
              SERP analysis, gap analysis, and your selected recommendations.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold">Topic</p>
              <p className="text-sm font-medium text-slate-800">{topic}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold">Sources Analyzed</p>
              <p className="text-sm font-medium text-slate-800">{fetchedPages.filter(p => p.fetchStatus === 'success').length} pages</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Select Generation Model</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="deepseekModel"
                  value={DeepSeekModel.V3_NON_THINKING}
                  checked={selectedDeepSeekModel === DeepSeekModel.V3_NON_THINKING}
                  onChange={() => setSelectedDeepSeekModel(DeepSeekModel.V3_NON_THINKING)}
                  className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">Regular Mode (DeepSeek-V3.2)</div>
                  <div className="text-xs text-slate-500">Fast and efficient generation. Recommended for standard articles.</div>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="deepseekModel"
                  value={DeepSeekModel.V3_THINKING}
                  checked={selectedDeepSeekModel === DeepSeekModel.V3_THINKING}
                  onChange={() => setSelectedDeepSeekModel(DeepSeekModel.V3_THINKING)}
                  className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">Reasoning Mode (DeepSeek-V3.2 Thinking)</div>
                  <div className="text-xs text-slate-500">Advanced reasoning for higher quality content. <span className="text-amber-600 font-medium">Note: This will take significantly longer to generate.</span></div>
                </div>
              </label>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            {isGenerating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Building Research Package...</>
            ) : (
              <><Zap className="w-5 h-5" /> Generate Article with SERP Intelligence</>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {renderStepIndicator()}

      <div className="mt-6">
        {currentStep === 'search' && renderSearchStep()}
        {currentStep === 'select' && renderSelectStep()}
        {currentStep === 'fetch' && renderFetchStep()}
        {currentStep === 'analyze' && renderAnalyzeStep()}
        {currentStep === 'recommendations' && renderRecommendationsStep()}
        {currentStep === 'competitive' && renderCompetitiveStep()}
        {currentStep === 'generate' && renderGenerateStep()}
      </div>

      {/* Navigation */}
      {currentStep !== 'search' && (
        <div className="mt-6 flex justify-between">
          <button
            onClick={prevStep}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          {currentStep !== 'generate' && currentStep !== 'recommendations' && (
            <button
              onClick={nextStep}
              disabled={!canGoNext()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SerpIntelligence;
