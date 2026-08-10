import React from 'react';
import { SearchProvider, AIProvider } from '../../../types';
import { Microscope, Search } from 'lucide-react';

interface ResearchTogglesSectionProps {
  deepResearch: boolean;
  onDeepResearchChange: (checked: boolean) => void;
  realTimeData: boolean;
  onRealTimeDataChange: (checked: boolean) => void;
  realTimeSearchProvider: SearchProvider;
  onRealTimeSearchProviderChange: (provider: SearchProvider) => void;
  provider: AIProvider;
}

export const ResearchTogglesSection: React.FC<ResearchTogglesSectionProps> = ({
  deepResearch,
  onDeepResearchChange,
  realTimeData,
  onRealTimeDataChange,
  realTimeSearchProvider,
  onRealTimeSearchProviderChange,
  provider,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className={`p-4 rounded-lg border transition-all ${deepResearch ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
        <label className="flex items-start cursor-pointer">
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              checked={deepResearch}
              onChange={(e) => onDeepResearchChange(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mt-1"
            />
          </div>
          <div className="ml-3">
            <span className={`block text-sm font-semibold ${deepResearch ? 'text-indigo-800' : 'text-slate-700'}`}>
              Deep Brand Research
            </span>
            <p className={`text-xs mt-1 ${deepResearch ? 'text-indigo-600' : 'text-slate-500'}`}>
              Analyzes brand voice & site architecture.
              {(provider === AIProvider.DEEPSEEK || provider === AIProvider.BYNARA) && " (Uses inferred knowledge)"}
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
              onChange={(e) => onRealTimeDataChange(e.target.checked)}
              className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500 mt-1"
            />
          </div>
          <div className="ml-3">
            <span className={`block text-sm font-semibold ${realTimeData ? 'text-amber-800' : 'text-slate-700'}`}>
              Include Real-Time Data
            </span>
            <p className={`text-xs mt-1 ${realTimeData ? 'text-amber-600' : 'text-slate-500'}`}>
              Fetches latest news & stats via Search.
              {(provider === AIProvider.DEEPSEEK || provider === AIProvider.BYNARA) && " (Uses recent training data)"}
            </p>
          </div>
        </label>

        {/* Search Provider Selection - Only show when realTimeData is enabled */}
        {realTimeData && (
          <div className="mt-3 pl-7 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Search Provider</label>
            <div className="relative">
              <select
                value={realTimeSearchProvider}
                onChange={(e) => {
                  const prov = e.target.value as SearchProvider;
                  onRealTimeSearchProviderChange(prov);
                }}
                className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white text-slate-700 appearance-none cursor-pointer hover:border-blue-400 transition-colors"
              >
                <option value={SearchProvider.GEMINI}>Google Gemini (with grounding)</option>
                <option value={SearchProvider.SERPSTACK}>SERPStack API</option>
                <option value={SearchProvider.TAVILY}>Tavily Search API</option>
                <option value={SearchProvider.TINYFISH}>TinyFish Search API</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              {realTimeSearchProvider === SearchProvider.GEMINI && "Best for general knowledge & latest Google data."}
              {realTimeSearchProvider === SearchProvider.SERPSTACK && "Good for scraping specific SERP features."}
              {realTimeSearchProvider === SearchProvider.TAVILY && "Optimized for AI research & accurate citations."}
              {realTimeSearchProvider === SearchProvider.TINYFISH && "AI-powered search with smart query understanding."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
