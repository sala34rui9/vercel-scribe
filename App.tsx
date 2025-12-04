
import React, { useState, useCallback, useRef } from 'react';
import { Layout } from './components/Layout';
import { ArticleForm } from './components/ArticleForm';
import { ArticlePreview } from './components/ArticlePreview';
import { ArticleConfig, GeneratedArticle, AIProvider, DeepSeekModel } from './types';
import { generateArticle, generatePrimaryKeywords, generateNLPKeywords, scanForInternalLinks, scanForExternalLinks } from './services/geminiService';
import { generateArticleDeepSeek, generatePrimaryKeywordsDeepSeek, generateNLPKeywordsDeepSeek } from './services/deepseekService';
import { FileText, Loader2, AlertCircle, XCircle, Search, Link as LinkIcon, BrainCircuit, Activity } from 'lucide-react';

const App: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedArticles, setGeneratedArticles] = useState<GeneratedArticle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  
  // Progress & Status for queue generation
  const [bulkProgress, setBulkProgress] = useState({ completed: 0, total: 0 });
  const [activeTasks, setActiveTasks] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  
  // Track active provider for loading screen
  const [activeProviderName, setActiveProviderName] = useState('AI');
  
  // Ref to hold the current AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to handle generation with fallback
  const generateWithFallback = async (config: ArticleConfig, signal: AbortSignal): Promise<{content: string, sources: string[]}> => {
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
    setGeneratedArticles([]); // Clear previous results
    
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
        setProcessingStatus('Generating Article...');
        setActiveTasks(1);
        
        try {
          const result = await generateWithFallback(config, controller.signal);
          
          setGeneratedArticles([{
            id: crypto.randomUUID(),
            content: result.content,
            title: config.topic,
            date: new Date().toISOString(),
            sources: result.sources,
            status: 'completed'
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
        const CONCURRENCY_LIMIT = 3;
        const queue = [...topics];
        let completedCount = 0;

        // Worker Function
        const worker = async (workerId: number) => {
          while (queue.length > 0 && !controller.signal.aborted) {
            const topic = queue.shift();
            if (!topic) break;

            setActiveTasks(prev => prev + 1);
            setProcessingStatus("Running Auto-SEO Analysis...");

            try {
              let topicPrimaryKeywords = config.primaryKeywords;
              let topicNLPKeywords = config.nlpKeywords;
              let topicInternalLinks = config.internalLinks || [];
              let topicExternalLinks = config.externalLinks || [];

              // --- AUTO-OPTIMIZATION PIPELINE (Per Article) ---
              if (config.autoOptimize) {
                 // 1. KEYWORD ANALYSIS
                 try {
                   if (config.provider === AIProvider.DEEPSEEK) {
                      // DeepSeek ONLY - Strict Isolation
                      topicPrimaryKeywords = await generatePrimaryKeywordsDeepSeek(topic);
                      topicNLPKeywords = await generateNLPKeywordsDeepSeek(topic);
                   } else {
                      // Gemini Only
                      topicPrimaryKeywords = await generatePrimaryKeywords(topic);
                      topicNLPKeywords = await generateNLPKeywords(topic);
                   }
                 } catch (e) {
                   console.warn(`Keyword generation failed for ${topic}`, e);
                 }

                 // 2. LINK SCANNING
                 // CRITICAL FIX: Only run scanning if Provider is GEMINI.
                 // DeepSeek cannot scan, and trying to use Gemini (if scanning) triggers quota errors.
                 if (config.provider === AIProvider.GEMINI) {
                   
                   // Internal Links
                   if (config.websiteUrl) {
                      try {
                         const scanResult = await scanForInternalLinks(config.websiteUrl, topic, topicPrimaryKeywords, config.deepResearch);
                         topicInternalLinks = scanResult.links.slice(0, 3);
                      } catch (e) {
                         console.warn(`Internal link scanning failed for ${topic}`, e);
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
                          } catch (e) {}
                          
                          const extLinks = await scanForExternalLinks(topic, domainToExclude);
                          topicExternalLinks = extLinks.slice(0, 5);
                      } catch (e) {
                         console.warn(`External link scanning failed for ${topic}`, e);
                      }
                   }
                 }
                 // If DeepSeek, we skip scanning to guarantee 0 Gemini calls.
              }
              
              // --- GENERATION PHASE ---
              
              const singleConfig: ArticleConfig = {
                ...config,
                mode: 'single',
                topic: topic,
                primaryKeywords: topicPrimaryKeywords,
                nlpKeywords: topicNLPKeywords,
                internalLinks: topicInternalLinks,
                externalLinks: topicExternalLinks
              };

              const result = await generateWithFallback(singleConfig, controller.signal);

              setGeneratedArticles(prev => [...prev, {
                id: crypto.randomUUID(),
                content: result.content,
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
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-8rem)]">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-4 xl:col-span-3 h-full overflow-y-auto pr-2">
          <ArticleForm key={formKey} onGenerate={handleGenerate} isGenerating={isGenerating} />
        </div>

        {/* Right Column: Output */}
        <div className="lg:col-span-8 xl:col-span-9 h-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
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
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
                <div className="relative bg-white p-4 rounded-full shadow-lg border border-blue-100">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-slate-900">
                  {processingStatus || (activeProviderName.includes("Reasoning") ? "Reasoning & Writing..." : "Processing Queue...")}
                </h3>
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mt-1">
                  Powered by {activeProviderName}
                </p>
                {bulkProgress.total > 0 ? (
                   <div className="mt-4 space-y-3 bg-slate-50 p-4 rounded-lg max-w-md border border-slate-100 w-full">
                      <div className="flex justify-between text-sm text-slate-600 font-medium">
                         <span className="flex items-center">
                            <Activity className="w-4 h-4 mr-2 text-blue-500 animate-pulse" />
                            Active Workers: {activeTasks}
                         </span>
                         <span>{bulkProgress.completed} / {bulkProgress.total} Completed</span>
                      </div>
                      
                      <div className="w-full bg-slate-200 rounded-full h-2">
                         <div 
                           className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                           style={{ width: `${(bulkProgress.completed / bulkProgress.total) * 100}%` }}
                         ></div>
                      </div>

                      <div className="pt-2 text-left">
                         <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                            <div className="flex items-center text-blue-600">
                               <Search className="w-3 h-3 mr-1" /> Analyzing Topics (Unique)
                            </div>
                            {activeProviderName.includes('Gemini') && (
                              <div className="flex items-center text-blue-600">
                                <LinkIcon className="w-3 h-3 mr-1" /> Scanning Links
                              </div>
                            )}
                         </div>
                      </div>

                      {generatedArticles.length > 0 && (
                        <p className="text-xs text-green-600 pt-2 border-t border-slate-200 mt-2">
                          {generatedArticles.length} articles ready to view
                        </p>
                      )}
                   </div>
                ) : (
                  <p className="text-slate-500 max-w-sm mt-2">
                    {activeProviderName.includes("Reasoning") 
                      ? "DeepSeek is performing advanced reasoning to structure your article..." 
                      : "The AI engine is researching and writing your optimized article..."}
                  </p>
                )}
              </div>
              
              <button
                onClick={handleStopGeneration}
                className="flex items-center px-4 py-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 border border-red-200 transition-colors text-sm font-medium"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Stop Generating
              </button>
            </div>
          ) : generatedArticles.length > 0 ? (
            <ArticlePreview articles={generatedArticles} onReset={handleReset} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-medium text-slate-600">No content generated yet</h3>
              <p className="text-slate-400 max-w-sm mt-2">
                Configure your requirements on the left and hit "Generate" to start writing.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default App;
