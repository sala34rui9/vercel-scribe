import React, { useState, useEffect } from 'react';
import { 
  ArticleConfig, ArticleType, ToneVoice, InternalLink, ExternalLink, 
  OpeningStyle, ReadabilityLevel, TargetCountry, 
  AIProvider, DeepSeekModel, BynaraModel, SearchProvider 
} from '../../types';
import { isWebScanProvider } from '../../services/researchProviderUtils';
import type { ImageModel, ImageStyle, ImageRatio } from '../../services/imagePresets';

// Shared Components
import { AiProviderSection } from './Shared/AiProviderSection';
import { ImageSettingsSection } from './Shared/ImageSettingsSection';
import { BrandWebsiteSection } from './Shared/BrandWebsiteSection';
import { ResearchTogglesSection } from './Shared/ResearchTogglesSection';
import { FormattingSection } from './Shared/FormattingSection';
import { ContentSettingsSection } from './Shared/ContentSettingsSection';
import { StyleSection } from './Shared/StyleSection';
import { ResourcesSection } from './Shared/ResourcesSection';

import {
  Wand2, Settings2, Sparkles, Link as LinkIcon, 
  ExternalLink as ExternalLinkIcon, AlertTriangle
} from 'lucide-react';

interface BulkArticleFormProps {
  onGenerate: (config: ArticleConfig) => void;
  isGenerating: boolean;
}

export const BulkArticleForm: React.FC<BulkArticleFormProps> = ({ onGenerate, isGenerating }) => {
  // Provider State
  const [provider, setProvider] = useState<AIProvider>(() => {
    return (localStorage.getItem('seo_scribe_provider') as AIProvider) || AIProvider.GEMINI;
  });
  const [deepSeekModel, setDeepSeekModel] = useState<DeepSeekModel>(() => {
    return (localStorage.getItem('seo_scribe_deepseek_model') as DeepSeekModel) || DeepSeekModel.V3_NON_THINKING;
  });
  const [bynaraModel, setBynaraModel] = useState<BynaraModel>(() => {
    return (localStorage.getItem('seo_scribe_bynara_model') as BynaraModel) || BynaraModel.MISTRAL_LARGE;
  });
  const [researchProvider, setResearchProvider] = useState<SearchProvider>(() => {
    return (localStorage.getItem('seo_scribe_research_provider') as SearchProvider) || SearchProvider.TAVILY;
  });
  const [keywordAnalysisProvider, setKeywordAnalysisProvider] = useState<SearchProvider>(() => {
    const stored = localStorage.getItem('seo_scribe_keyword_analysis_provider');
    return (stored as SearchProvider) || SearchProvider.GEMINI;
  });
  // Unused in bulk (no manual keyword analysis UI), but required by handleSubmit to pass configuration
  const [keywordAnalysisModel] = useState<DeepSeekModel>(() => {
    const stored = localStorage.getItem('seo_scribe_keyword_analysis_model');
    return (stored as DeepSeekModel) || DeepSeekModel.V3_NON_THINKING;
  });

  // Image State
  const [imageCount, setImageCount] = useState<number>(() => {
    return parseInt(localStorage.getItem('seo_scribe_image_count') || '0', 10);
  });
  const [imageModel, setImageModel] = useState<ImageModel>(() => {
    return (localStorage.getItem('seo_scribe_image_model') as ImageModel) || 'sdxl';
  });
  const [imageStyle, setImageStyle] = useState<ImageStyle>(() => {
    return (localStorage.getItem('seo_scribe_image_style') as ImageStyle) || 'photorealistic';
  });
  const [imageRatio, setImageRatio] = useState<ImageRatio>(() => {
    return (localStorage.getItem('seo_scribe_image_ratio') as ImageRatio) || '16:9';
  });

  // Website State
  const [websiteUrl, setWebsiteUrl] = useState(() => {
    return localStorage.getItem('brandWebsiteUrl') || '';
  });
  const [urlSavedSuccess, setUrlSavedSuccess] = useState(false);

  // Research State
  const [deepResearch, setDeepResearch] = useState(false);
  const [realTimeData, setRealTimeData] = useState(false);
  const [realTimeSearchProvider, setRealTimeSearchProvider] = useState<SearchProvider>(() => {
    const stored = localStorage.getItem('seo_scribe_realtime_search_provider');
    return (stored as SearchProvider) || SearchProvider.GEMINI;
  });

  // Content Settings State
  const [wordCount, setWordCount] = useState(1000);
  const [type, setType] = useState<ArticleType>(ArticleType.BLOG_POST);
  const [tone, setTone] = useState<ToneVoice>(ToneVoice.PROFESSIONAL);
  const [targetCountry, setTargetCountry] = useState<TargetCountry>(TargetCountry.US);

  // Formatting State
  const [includeBulletPoints, setIncludeBulletPoints] = useState(true);
  const [includeTables, setIncludeTables] = useState(true);
  const [includeItalics, setIncludeItalics] = useState(true);
  const [includeBold, setIncludeBold] = useState(true);

  // Style State
  const [useCustomOpening, setUseCustomOpening] = useState(false);
  const [openingStyle, setOpeningStyle] = useState<OpeningStyle>(OpeningStyle.FACT_STATISTIC);
  const [readability, setReadability] = useState<ReadabilityLevel>(ReadabilityLevel.NONE);
  const [humanizeContent, setHumanizeContent] = useState(false);
  const [includeFaq, setIncludeFaq] = useState(false);
  const [includeConclusion, setIncludeConclusion] = useState(true);

  // Resources State
  const [personalResources, setPersonalResources] = useState('');
  const [personalFileName, setPersonalFileName] = useState('');

  // BULK MODE SPECIFIC STATE
  const [bulkInput, setBulkInput] = useState('');
  const [autoOptimize, setAutoOptimize] = useState(true);
  
  // External Linking State
  const [includeExternalLinks, setIncludeExternalLinks] = useState(false);

  // Persistence Effects
  useEffect(() => { localStorage.setItem('seo_scribe_provider', provider); }, [provider]);
  useEffect(() => { localStorage.setItem('seo_scribe_deepseek_model', deepSeekModel); }, [deepSeekModel]);
  useEffect(() => { localStorage.setItem('seo_scribe_bynara_model', bynaraModel); }, [bynaraModel]);
  useEffect(() => { localStorage.setItem('seo_scribe_research_provider', researchProvider); }, [researchProvider]);
  useEffect(() => { localStorage.setItem('seo_scribe_image_count', imageCount.toString()); }, [imageCount]);
  useEffect(() => { localStorage.setItem('seo_scribe_image_model', imageModel); }, [imageModel]);
  useEffect(() => { localStorage.setItem('seo_scribe_image_style', imageStyle); }, [imageStyle]);
  useEffect(() => { localStorage.setItem('seo_scribe_image_ratio', imageRatio); }, [imageRatio]);

  // Force a web-scan-capable provider when DeepSeek is selected
  useEffect(() => {
    if ((provider === AIProvider.DEEPSEEK || provider === AIProvider.BYNARA) && !isWebScanProvider(researchProvider)) {
      setResearchProvider(SearchProvider.TAVILY);
    }
  }, [provider, researchProvider]);

  // Website Save/Clear handlers
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
  };

  // Resource Upload
  const handlePersonalResourcesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
      alert("Please upload a .txt file only.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPersonalResources(text);
        setPersonalFileName(file.name);
        alert(`Successfully loaded context from ${file.name}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  const clearPersonalResources = () => {
    setPersonalResources('');
    setPersonalFileName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const queueTopics = bulkInput.split('\n').map(t => t.trim()).filter(t => t.length > 0);

    onGenerate({
      mode: 'bulk',
      topic: '',
      queueTopics,
      autoOptimize,
      imageCount,
      imageModel,
      imageStyle,
      imageRatio,
      wordCount,
      type,
      tone,
      openingStyle: useCustomOpening ? openingStyle : OpeningStyle.NONE,
      readability,
      targetCountry,
      humanizeContent,
      primaryKeywords: [],
      nlpKeywords: [],
      includeFaq,
      includeConclusion,
      websiteUrl,
      deepResearch,
      realTimeData,
      searchProvider: realTimeData ? realTimeSearchProvider : undefined,
      internalLinks: [],
      externalLinks: [],
      enableExternalLinks: includeExternalLinks,
      provider,
      deepSeekModel,
      bynaraModel,
      researchProvider,
      keywordAnalysisProvider,
      includeBulletPoints,
      includeTables,
      includeItalics,
      includeBold,
      personalResources: personalResources || undefined
    });
  };

  const isFormValid = bulkInput.trim().length > 0;
  const queuedCount = bulkInput.split('\n').filter(l => l.trim()).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AiProviderSection
        provider={provider} onProviderChange={setProvider}
        deepSeekModel={deepSeekModel} onDeepSeekModelChange={setDeepSeekModel}
        bynaraModel={bynaraModel} onBynaraModelChange={setBynaraModel}
        researchProvider={researchProvider} onResearchProviderChange={setResearchProvider}
      />
      <ImageSettingsSection
        imageCount={imageCount} onImageCountChange={setImageCount}
        imageModel={imageModel} onImageModelChange={setImageModel}
        imageStyle={imageStyle} onImageStyleChange={setImageStyle}
        imageRatio={imageRatio} onImageRatioChange={setImageRatio}
      />

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center mb-4">
          <Settings2 className="w-5 h-5 mr-2 text-blue-600" />
          Core Settings
        </h2>
        <div className="space-y-4">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Content Queue (Topics)
            </label>
            <div className="relative">
              <textarea
                required
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={"Topic 1: Best SEO Strategies\nTopic 2: Digital Marketing Trends\nTopic 3: ..."}
                rows={6}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm resize-y"
              />
              <div className="absolute bottom-3 right-3 text-xs text-slate-400 bg-white/80 px-2 rounded">
                {queuedCount} topics queued
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
                        <br /><span className="text-amber-600 font-bold">• Note: Web Scanning in Bulk Mode will run sequentially (slower) to prevent errors.</span>
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

          <BrandWebsiteSection
            websiteUrl={websiteUrl}
            onWebsiteUrlChange={setWebsiteUrl}
            urlSavedSuccess={urlSavedSuccess}
            onSave={handleSaveUrl}
            onClear={handleClearUrl}
          />

          <ResearchTogglesSection
            deepResearch={deepResearch}
            onDeepResearchChange={setDeepResearch}
            realTimeData={realTimeData}
            onRealTimeDataChange={setRealTimeData}
            realTimeSearchProvider={realTimeSearchProvider}
            onRealTimeSearchProviderChange={setRealTimeSearchProvider}
            provider={provider}
          />
          <FormattingSection
            includeBulletPoints={includeBulletPoints}
            onBulletPointsChange={setIncludeBulletPoints}
            includeTables={includeTables}
            onTablesChange={setIncludeTables}
            includeBold={includeBold}
            onBoldChange={setIncludeBold}
            includeItalics={includeItalics}
            onItalicsChange={setIncludeItalics}
          />
          
          <ContentSettingsSection
            type={type}
            onTypeChange={setType}
            tone={tone}
            onToneChange={setTone}
            targetCountry={targetCountry}
            onTargetCountryChange={setTargetCountry}
            wordCount={wordCount}
            onWordCountChange={setWordCount}
          />
        </div>
      </div>

      <StyleSection
        readability={readability}
        onReadabilityChange={setReadability}
        humanizeContent={humanizeContent}
        onHumanizeChange={setHumanizeContent}
        useCustomOpening={useCustomOpening}
        onUseCustomOpeningChange={setUseCustomOpening}
        openingStyle={openingStyle}
        onOpeningStyleChange={setOpeningStyle}
        includeFaq={includeFaq}
        onIncludeFaqChange={setIncludeFaq}
        includeConclusion={includeConclusion}
        onIncludeConclusionChange={setIncludeConclusion}
      />

      <ResourcesSection
        personalFileName={personalFileName}
        onFileUpload={handlePersonalResourcesUpload}
        onClear={clearPersonalResources}
        personalResources={personalResources}
      />

      {/* SEO Strategy Information (Bulk specific) */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center mb-4">
          <Sparkles className="w-5 h-5 mr-2 text-blue-600" />
          SEO Strategy
        </h2>
        <div className="p-6 bg-slate-50 border border-slate-100 rounded-lg text-center">
          <Sparkles className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Auto-Optimization Enabled</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Primary & NLP Keywords will be automatically generated for each topic in the queue to ensure maximum relevance and SEO alignment.
          </p>
        </div>
      </div>

      {/* Internal Linking Section */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center">
            <LinkIcon className="w-4 h-4 mr-2 text-blue-600" /> Internal Linking Strategy
          </h3>
        </div>
        <div className="p-4 bg-white">
          {autoOptimize && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-slate-600">
              {websiteUrl ? (
                provider === AIProvider.GEMINI ? (
                  <div className="flex items-start">
                    <Sparkles className="w-4 h-4 mr-2 mt-0.5 text-blue-600 flex-shrink-0" />
                    <div>
                      System will <span className="font-semibold text-blue-700">automatically scan</span> <strong>{websiteUrl}</strong> for relevant links for each topic.
                    </div>
                  </div>
                ) : (
                  (provider === AIProvider.DEEPSEEK || provider === AIProvider.BYNARA) && isWebScanProvider(researchProvider) ? (
                    <div className="flex items-start">
                      <Sparkles className="w-4 h-4 mr-2 mt-0.5 text-emerald-600 flex-shrink-0" />
                      <div>
                        System will scan <strong>{websiteUrl}</strong> via {researchProvider === SearchProvider.AUTO ? 'Auto (best available)' : researchProvider}.
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start">
                      <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 text-amber-500 flex-shrink-0" />
                      Link scanning disabled. Switch to Tavily, TinyFish, or Auto to enable.
                    </div>
                  )
                )
              ) : (
                "Add a Brand Website above to enable auto-linking."
              )}
            </div>
          )}
          <p className="text-xs text-slate-500 italic text-center py-2">
            Link selection is handled automatically in Bulk Mode. Manual selection is disabled.
          </p>
        </div>
      </div>

      {/* External Linking Section */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center"><ExternalLinkIcon className="w-4 h-4 mr-2 text-indigo-600" /><h3 className="text-sm font-semibold text-slate-800">External Linking Strategy</h3></div>
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" checked={includeExternalLinks} onChange={(e) => setIncludeExternalLinks(e.target.checked)} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
            <span className="ml-2 text-xs font-medium text-slate-600">Enable</span>
          </label>
        </div>
        {includeExternalLinks && (
          <div className="p-4 bg-white text-sm text-slate-500 italic">
            {provider === AIProvider.GEMINI ? (
              <div className="flex items-center text-indigo-600">
                <Sparkles className="w-4 h-4 mr-2" />
                System will automatically find authoritative external sources for each topic.
              </div>
            ) : (
              <div className="flex items-center text-blue-600">
                <Sparkles className="w-4 h-4 mr-2" />
                System will find external sources via {researchProvider === SearchProvider.AUTO ? 'Auto (best available)' : researchProvider} for each topic (runs sequentially for stability).
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isGenerating || !isFormValid}
        className={`w-full py-4 px-6 rounded-xl text-white font-medium text-lg flex items-center justify-center transition-all ${isGenerating || !isFormValid
          ? 'bg-slate-400 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-blue-500/25'
        }`}
      >
        {isGenerating ? (
          <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" /> Processing Queue...</>
        ) : (
          <>Start Queue Processing ({queuedCount}) <Wand2 className="w-5 h-5 ml-2" /></>
        )}
      </button>
    </form>
  );
};
