
import React, { useState, useCallback, useRef, Suspense, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ArticleForm } from './components/ArticleForm';
import { Dashboard } from './components/Dashboard';
import { SeoSettings } from './components/SeoSettings';
const ArticlePreview = React.lazy(() => import('./components/ArticlePreview').then(m => ({ default: m.ArticlePreview })));
import { ArticleConfig, GeneratedArticle, AIProvider, DeepSeekModel, SearchProvider, SEORankingData } from './types';
import { generateArticle, generatePrimaryKeywords, generateNLPKeywords, scanForInternalLinks, scanForExternalLinks } from './services/geminiService';
import { generateArticleDeepSeek, generatePrimaryKeywordsDeepSeek, generateNLPKeywordsDeepSeek } from './services/deepseekService';
import { scanForInternalLinksTavily, scanForExternalLinksTavily } from './services/tavilyService';
import { generateCloudflareImage } from './services/cloudflareImageService';
import { fetchSEORankingData } from './services/supabaseClient';
import { FileText, Loader2, AlertCircle, XCircle, Search, Link as LinkIcon, BrainCircuit, Activity, GripVertical, Home, BarChart3 } from 'lucide-react';

const injectImages = async (
  content: string, 
  topic: string, 
  config: ArticleConfig, 
  setLogs: (updater: (prev: string[]) => string[]) => void, 
  setProcessingStatus: (status: string) => void
): Promise<string> => {
  if (!config.imageCount || config.imageCount <= 0) return content;
  
  let finalContent = content;
  const h2Regex = /^## (.*$)/gim;
  const matches = [...finalContent.matchAll(h2Regex)];
  
  for (let i = 0; i < config.imageCount; i++) {
    try {
      setProcessingStatus(`Generating image ${i + 1}/${config.imageCount}...`);
      setLogs(prev => [...prev, `> Generating image ${i + 1} of ${config.imageCount} via Cloudflare AI...`]);
      
      let prompt = config.imagePrompt || topic;
      if (i > 0 && matches[i - 1]) {
        prompt = `${topic}, specifically focusing on: ${matches[i - 1][1]}`;
      }
      
      const base64Image = await generateCloudflareImage(prompt, config.imageStyle, config.imageRatio);
      
      if (i === 0) {
        finalContent = `![Featured Image](${base64Image})\n\n${finalContent}`;
      } else {
        let h2Count = 0;
        finalContent = finalContent.replace(/^## (.*$)/gim, (match) => {
          if (h2Count === (i - 1)) {
            h2Count++;
            return `${match}\n\n![Article Image ${i}](${base64Image})\n`;
          }
          h2Count++;
          return match;
        });
      }
      setLogs(prev => [...prev, `> Image ${i + 1} embedded successfully.`]);
    } catch (imgError) {
      console.error(`Image ${i + 1} generation failed`, imgError);
      setLogs(prev => [...prev, `> Warning: Image ${i + 1} generation failed.`]);
    }
  }
  return finalContent;
};

const App: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const STORAGE_KEY = 'seo_scribe_saved_articles_v1';
  const [generatedArticles, setGeneratedArticles] = useState<GeneratedArticle[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr as GeneratedArticle[];
      }
    } catch { }
    return [];
  });
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [activePage, setActivePage] = useState<'home' | 'editor' | 'articles' | 'seo'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.generatedArticles?.length > 0) return 'articles';
      }
    } catch (e) {
      // ignore
    }
    return 'editor';
  });
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  // Progress & Status for queue generation
  const [bulkProgress, setBulkProgress] = useState({ completed: 0, total: 0 });
  const [activeTasks, setActiveTasks] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  // Track active provider for loading screen
  const [activeProviderName, setActiveProviderName] = useState('AI');

  // Ref to hold the current AbortController
  const abortControllerRef = useRef<AbortController | null>(null);



  useEffect(() => {
    try {
      if (generatedArticles.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(generatedArticles));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { }
  }, [generatedArticles]);

  // Helper to handle generation with fallback
  const generateWithFallback = async (config: ArticleConfig, signal: AbortSignal): Promise<{ content: string, sources: string[] }> => {
    // 1. If user explicitly chose DeepSeek, strictly use DeepSeek
    if (config.provider === AIProvider.DEEPSEEK) {
      return await generateArticleDeepSeek(config, signal);
    }

    // 2. If User chose Gemini, try Gemini first
    try {
      return await generateArticle(config, signal);
    } catch (err: any) {
      if (signal.aborted) throw err;

      console.warn("Gemini Service failed:", err);
      // Fallback removed to enforce strict provider selection as per user request
      throw err;
    }
  };

  const handleGenerate = useCallback(async (config: ArticleConfig) => {
    // Abort any pending requests just in case
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setError(null);
    setActivePage('articles');

    // Set Provider Name for UI
    let providerName = "Google Gemini";
    if (config.provider === AIProvider.DEEPSEEK) {
      if (config.deepSeekModel === DeepSeekModel.V3_THINKING || config.deepSeekModel === DeepSeekModel.V3_SPECIALE) {
        providerName = "DeepSeek-R1 (Reasoning)";
      } else {
        providerName = "DeepSeek-V3";
      }
    }
    setActiveProviderName(providerName);

    try {
      if (config.mode === 'single') {
        setBulkProgress({ completed: 0, total: 1 });
        setProcessingStatus('Preparing generation...');
        setActiveTasks(1);

        try {
          // --- SE RANKING DATA ENRICHMENT ---
          let enrichedConfig = { ...config };
          const targetDomain = localStorage.getItem('seo_scribe_target_domain');
          const competitorDomain = localStorage.getItem('seo_scribe_competitor_domain');

          setTerminalLogs(['> Initializing writing engine...']);
          
          if (targetDomain) {
            setTerminalLogs(prev => [...prev, `> Connecting to SE Ranking API for ${targetDomain}...`]);
            setProcessingStatus('Analyzing domain rankings...');
            try {
              const seoData = await fetchSEORankingData(
                targetDomain,
                config.targetCountry,
                competitorDomain || undefined
              );
              enrichedConfig = {
                ...enrichedConfig,
                targetDomain,
                competitorDomain: competitorDomain || undefined,
                seoRankingData: seoData
              };
              const totalKeywords = seoData.lostKeywords.length + seoData.competitorGaps.length + seoData.aiOverviewKeywords.length;
              if (totalKeywords > 0) {
                setTerminalLogs(prev => [...prev, `> Discovered ${seoData.lostKeywords.length} Lost Keywords, ${seoData.competitorGaps.length} Gaps, ${seoData.aiOverviewKeywords.length} AI Overview targets.`]);
                setTerminalLogs(prev => [...prev, `> Injecting SEO intelligence into AI instructions...`]);
                setProcessingStatus(`Found ${totalKeywords} SEO keywords — Writing content...`);
              } else {
                setTerminalLogs(prev => [...prev, `> No specific gaps found. Proceeding with standard optimization.`]);
                setProcessingStatus('Writing content...');
              }
            } catch (e) {
              setTerminalLogs(prev => [...prev, `> SE Ranking fetch failed. Proceeding without specific gap data.`]);
              console.warn('SE Ranking enrichment failed, proceeding without:', e);
              setProcessingStatus('Writing content...');
            }
          } else {
            setTerminalLogs(prev => [...prev, `> Target domain not configured. Skipping SE Ranking fetch.`]);
            setProcessingStatus('Writing content...');
          }
          
          setTerminalLogs(prev => [...prev, `> Generating comprehensive content (Target: ${config.wordCount || 1000} words)...`]);

          // Check abort after SE Ranking fetch
          if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

          const result = await generateWithFallback(enrichedConfig, controller.signal);

          setTerminalLogs(prev => [...prev, `> Content generated successfully! Rendering Markdown...`]);
          
          let finalContent = result.content;
          finalContent = await injectImages(finalContent, config.topic, config, setTerminalLogs, setProcessingStatus);

          setGeneratedArticles(prev => [...prev, {
            id: crypto.randomUUID(),
            content: finalContent,
            title: config.topic,
            date: new Date().toISOString(),
            sources: result.sources,
            status: 'completed',
            seoRankingData: enrichedConfig.seoRankingData
          }]);
        } finally {
          setActiveTasks(0);
        }
      } else {
        // BULK GENERATION (PARALLEL MODE)
        const topics = config.queueTopics || [];
        if (topics.length === 0) throw new Error("No topics provided for bulk generation");

        setBulkProgress({ completed: 0, total: topics.length });

        // CONCURRENCY CONTROL
        // Default to higher parallelism for Gemini
        let CONCURRENCY_LIMIT = 5;
        const isDeepSeekWebMode = config.provider === AIProvider.DEEPSEEK && (config.deepResearch || config.realTimeData);

        // If DeepSeek + Web Scan is active, force Sequential Mode to prevent Rate Limits/Crashes
        if (isDeepSeekWebMode) {
          CONCURRENCY_LIMIT = 1;
          console.log("DeepSeek Web Mode detected: Switching to Safe Sequential Processing (1 at a time)");
        }

        const queue = [...topics];
        let completedCount = 0;

        // ========== CACHING OPTIMIZATION ==========
        // 1. BRAND RESEARCH CACHE: Fetch once, reuse for all articles
        let cachedBrandResearch: { brandVoice: string; siteArchitecture: string[]; content: string } | undefined;
        if (config.deepResearch && config.websiteUrl && config.provider === AIProvider.DEEPSEEK) {
          try {
            setProcessingStatus("Pre-fetching Brand Research (will be reused for all articles)...");
            const { analyzeBrandWebsite, getTavilyApiKey } = await import('./services/tavilyService');
            if (getTavilyApiKey()) {
              console.log('[Bulk Optimization] Fetching brand research ONCE for all articles');
              cachedBrandResearch = await analyzeBrandWebsite(config.websiteUrl);
            }
          } catch (e) {
            console.warn('[Bulk Optimization] Brand research pre-fetch failed, will use fallback per article', e);
          }
        }

        // 2. INTERNAL LINKS CACHE: Scan once per websiteUrl, reuse for all articles
        let cachedInternalLinks: { title: string; url: string; snippet?: string }[] = [];
        if (config.websiteUrl && config.autoOptimize) {
          try {
            setProcessingStatus("Pre-scanning Internal Links (will be reused for all articles)...");
            if (config.provider === AIProvider.DEEPSEEK && config.researchProvider === SearchProvider.TAVILY) {
              const tavilyResult = await scanForInternalLinksTavily(config.websiteUrl, config.queueTopics?.[0] || 'general');
              cachedInternalLinks = tavilyResult.links;
              console.log(`[Bulk Optimization] Cached ${cachedInternalLinks.length} internal links from Tavily`);
            } else if (config.provider === AIProvider.GEMINI || config.researchProvider === SearchProvider.GEMINI) {
              const scanResult = await scanForInternalLinks(config.websiteUrl, config.queueTopics?.[0] || 'general', config.primaryKeywords || [], config.deepResearch);
              cachedInternalLinks = scanResult.links;
              console.log(`[Bulk Optimization] Cached ${cachedInternalLinks.length} internal links from Gemini`);
            }
          } catch (e) {
            console.warn('[Bulk Optimization] Internal link pre-scan failed', e);
          }
        }
        // ========== END CACHING OPTIMIZATION ==========

        // ========== SE RANKING DATA CACHE ==========
        let cachedSeoRankingData: SEORankingData | undefined;
        const targetDomain = localStorage.getItem('seo_scribe_target_domain');
        const competitorDomain = localStorage.getItem('seo_scribe_competitor_domain');

        if (targetDomain) {
          try {
            setProcessingStatus('Pre-fetching SE Ranking intelligence (will be reused for all articles)...');
            cachedSeoRankingData = await fetchSEORankingData(
              targetDomain,
              config.targetCountry,
              competitorDomain || undefined
            );
            const totalKeywords = (cachedSeoRankingData.lostKeywords.length || 0) + (cachedSeoRankingData.competitorGaps.length || 0) + (cachedSeoRankingData.aiOverviewKeywords.length || 0);
            console.log(`[Bulk Optimization] Cached ${totalKeywords} SE Ranking keywords for all articles`);
          } catch (e) {
            console.warn('[Bulk Optimization] SE Ranking pre-fetch failed, will proceed without:', e);
          }
        }
        // ========== END SE RANKING DATA CACHE ==========

        // Worker Function
        const worker = async (workerId: number) => {
          while (queue.length > 0 && !controller.signal.aborted) {

            // Critical Section: Get next topic
            // In sequential mode, this naturally happens one by one.
            const topic = queue.shift();
            if (!topic) break;

            setActiveTasks(prev => prev + 1);
            setProcessingStatus(isDeepSeekWebMode
              ? `DeepSeek Web Mode: Analyzing "${topic}" (Safe Mode)...`
              : "Running Auto-SEO Analysis...");

            // Artificial Delay for DeepSeek Web Mode to let API cool down
            if (isDeepSeekWebMode) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }

            try {
              let topicPrimaryKeywords = config.primaryKeywords;
              let topicNLPKeywords = config.nlpKeywords;
              let topicInternalLinks = config.internalLinks || [];
              let topicExternalLinks = config.externalLinks || [];

              // --- AUTO-OPTIMIZATION PIPELINE (Per Article) ---
              if (config.autoOptimize) {
                // 1. KEYWORD ANALYSIS - Use keywordAnalysisProvider if available, otherwise fallback to provider
                try {
                  const keywordProvider = config.keywordAnalysisProvider || (config.provider === AIProvider.DEEPSEEK ? SearchProvider.TAVILY : SearchProvider.GEMINI);
                  if (keywordProvider === SearchProvider.TAVILY || config.provider === AIProvider.DEEPSEEK) {
                    topicPrimaryKeywords = await generatePrimaryKeywordsDeepSeek(topic);
                    topicNLPKeywords = await generateNLPKeywordsDeepSeek(topic);
                  } else {
                    topicPrimaryKeywords = await generatePrimaryKeywords(topic);
                    topicNLPKeywords = await generateNLPKeywords(topic);
                  }
                } catch (e) {
                  console.warn(`Keyword generation failed for ${topic}`, e);
                }

                // 2. LINK SCANNING - USE CACHED DATA IF AVAILABLE

                // Internal Links - Use cached links if available
                if (config.websiteUrl) {
                  if (cachedInternalLinks.length > 0) {
                    // USE CACHED DATA - No API call needed!
                    topicInternalLinks = cachedInternalLinks.slice(0, 3);
                    console.log(`[Bulk Optimization] Reusing ${topicInternalLinks.length} cached internal links for "${topic}"`);
                  } else {
                    // Fallback: Scan per article (should rarely happen)
                    try {
                      if (config.provider === AIProvider.DEEPSEEK && config.researchProvider === SearchProvider.TAVILY) {
                        const tavilyResult = await scanForInternalLinksTavily(config.websiteUrl, topic);
                        topicInternalLinks = tavilyResult.links.slice(0, 3);
                      } else if (config.provider === AIProvider.GEMINI || config.researchProvider === SearchProvider.GEMINI) {
                        const scanResult = await scanForInternalLinks(config.websiteUrl, topic, topicPrimaryKeywords, config.deepResearch);
                        topicInternalLinks = scanResult.links.slice(0, 3);
                      } else {
                        topicInternalLinks = [];
                      }
                    } catch (e) {
                      console.warn(`Internal link scanning failed for ${topic}`, e);
                    }
                  }
                }

                // External Links
                if (config.enableExternalLinks) {
                  try {
                    let domainToExclude = '';
                    try {
                      if (config.websiteUrl) {
                        domainToExclude = new URL(config.websiteUrl).hostname;
                      }
                    } catch (e) { }

                    if (config.provider === AIProvider.DEEPSEEK && (config.externalLinkSearchProvider === SearchProvider.TAVILY || config.researchProvider === SearchProvider.TAVILY)) {
                      const extLinks = await scanForExternalLinksTavily(topic, domainToExclude);
                      topicExternalLinks = extLinks.slice(0, 5);
                    } else {
                      const extLinks = await scanForExternalLinks(topic, domainToExclude);
                      topicExternalLinks = extLinks.slice(0, 5);
                    }
                  } catch (e) {
                    console.warn(`External link scanning failed for ${topic}`, e);
                  }
                }
              }

              // --- GENERATION PHASE ---

              const singleConfig: ArticleConfig = {
                ...config,
                mode: 'single',
                topic: topic,
                primaryKeywords: topicPrimaryKeywords,
                nlpKeywords: topicNLPKeywords,
                internalLinks: topicInternalLinks,
                externalLinks: topicExternalLinks,
                // Pass cached data to avoid redundant API calls
                cachedBrandResearch: cachedBrandResearch,
                cachedInternalLinks: cachedInternalLinks.length > 0 ? cachedInternalLinks : undefined,
                // Pass cached SE Ranking data
                targetDomain: targetDomain || undefined,
                competitorDomain: competitorDomain || undefined,
                seoRankingData: cachedSeoRankingData
              };

              const result = await generateWithFallback(singleConfig, controller.signal);

              let finalContent = result.content;
              finalContent = await injectImages(
                finalContent, 
                topic, 
                config, 
                (updater) => {}, // No-op logger for bulk mode
                setProcessingStatus
              );

              setGeneratedArticles(prev => [...prev, {
                id: crypto.randomUUID(),
                content: finalContent,
                title: topic,
                date: new Date().toISOString(),
                sources: result.sources,
                status: 'completed',
                strategy: {
                  primaryKeywords: topicPrimaryKeywords,
                  nlpKeywords: topicNLPKeywords,
                  internalLinksCount: topicInternalLinks.length,
                  externalLinksCount: topicExternalLinks.length
                }
              }]);

            } catch (err: any) {
              if (err.name === 'AbortError') return;

              console.error(`Failed to generate topic: ${topic}`, err);
              setGeneratedArticles(prev => [...prev, {
                id: crypto.randomUUID(),
                content: `Error generating content: ${err.message}`,
                title: topic,
                date: new Date().toISOString(),
                status: 'failed'
              }]);
            } finally {
              completedCount++;
              setBulkProgress(prev => ({ ...prev, completed: completedCount }));
              setActiveTasks(prev => prev - 1);
            }
          }
        };

        // Start Workers
        const workers = Array(Math.min(topics.length, CONCURRENCY_LIMIT))
          .fill(null)
          .map((_, i) => worker(i));

        await Promise.all(workers);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Generation cancelled by user");
      } else {
        setError(err.message || "Failed to generate article. Please try again.");
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsGenerating(false);
        abortControllerRef.current = null;
        setBulkProgress({ completed: 0, total: 0 });
        setProcessingStatus('');
        setActiveTasks(0);
      }
    }
  }, []);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      setBulkProgress({ completed: 0, total: 0 });
      setActiveTasks(0);
    }
  }, []);

  const handleReset = () => {
    setGeneratedArticles([]);
    setError(null);
    setFormKey(prev => prev + 1);
    try { localStorage.removeItem(STORAGE_KEY); } catch { }
    setActivePage('home');
  };

  const showArticles = useCallback(() => {
    setActivePage('articles');
  }, []);

  const showEditor = useCallback(() => {
    setActivePage('editor');
  }, []);

  const showSeo = useCallback(() => {
    setActivePage('seo');
  }, []);

  const showHome = useCallback(() => {
    setActivePage('home');
  }, []);

  const handleSaveArticles = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(generatedArticles)); } catch { }
  }, [generatedArticles]);

  const handleDeleteArticle = useCallback((id: string) => {
    setGeneratedArticles(prev => prev.filter(a => a.id !== id));
  }, []);

  // Show dashboard on home page
  if (activePage === 'home') {
    return (
      <Layout onShowHome={showHome} onShowArticles={showArticles} onShowEditor={showEditor} onShowSeo={showSeo} savedCount={generatedArticles.length}>
        <Dashboard onNavigate={setActivePage} />
      </Layout>
    );
  }

  return (
    <Layout onShowHome={showHome} onShowArticles={showArticles} onShowEditor={showEditor} onShowSeo={showSeo} savedCount={generatedArticles.length}>
      <div className="h-[calc(100vh-8rem)] w-full overflow-y-auto pb-8">
        {activePage === 'editor' && (
          <div className="max-w-5xl mx-auto">
            <ArticleForm key={formKey} onGenerate={handleGenerate} isGenerating={isGenerating} />
          </div>
        )}

        {activePage === 'seo' && (
          <SeoSettings />
        )}

        {activePage === 'articles' && (
          <div className="max-w-6xl mx-auto h-[calc(100vh-9rem)] flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
            {error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 backdrop-blur-sm p-6">
              <div className="text-center max-w-md">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Generation Failed</h3>
                <p className="text-slate-600 mb-6">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {isGenerating ? (
            <div className="flex-1 flex flex-col p-8 bg-slate-900 text-green-400 font-mono text-sm overflow-hidden">
              <div className="flex items-center justify-between mb-4 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
                <div className="flex items-center">
                  <div className="flex space-x-2 mr-4">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  SEO Scribe Terminal
                </div>
                <div className="text-indigo-400 font-semibold">{activeProviderName}</div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 py-4 flex flex-col justify-end">
                {terminalLogs.map((log, i) => (
                  <div key={i} className="animate-in fade-in slide-in-from-bottom-2">{log}</div>
                ))}
                <div className="flex items-center mt-2 animate-pulse">
                  <span className="mr-2">&gt;</span>
                  <div className="w-2 h-4 bg-green-400"></div>
                </div>
              </div>

              {bulkProgress.total > 0 && (
                <div className="mt-4 mb-4 space-y-3 bg-slate-800/50 p-4 rounded-lg max-w-md border border-slate-700 w-full">
                  <div className="flex justify-between text-xs text-slate-400 font-medium">
                    <span className="flex items-center">
                      <Activity className="w-3 h-3 mr-2 text-blue-400 animate-pulse" />
                      Active Workers: {activeTasks}
                    </span>
                    <span>{bulkProgress.completed} / {bulkProgress.total} Completed</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${(bulkProgress.completed / bulkProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                 <p className="text-slate-500 text-xs">Press Stop Generating to abort the process.</p>
                 <button
                  onClick={handleStopGeneration}
                  className="px-4 py-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 border border-red-900/50 transition-colors"
                >
                  Stop Generating
                </button>
              </div>
            </div>
          ) : (activePage === 'articles' && generatedArticles.length > 0) ? (
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
              <ArticlePreview articles={generatedArticles} onReset={handleReset} onSave={handleSaveArticles} onDelete={handleDeleteArticle} />
            </Suspense>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-medium text-slate-600">No content generated yet</h3>
              <p className="text-slate-400 max-w-sm mt-2">
                Go to the Builder tab to configure your requirements and start writing.
              </p>
            </div>
          )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default App;
