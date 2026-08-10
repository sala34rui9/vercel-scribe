import React from 'react';
import { AIProvider, DeepSeekModel, BynaraModel, SearchProvider } from '../../../types';
import { isWebScanProvider } from '../../../services/researchProviderUtils';
import { BrainCircuit, Cpu, Globe, Search, Target, Zap, Fish } from 'lucide-react';

interface AiProviderSectionProps {
  provider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
  deepSeekModel: DeepSeekModel;
  onDeepSeekModelChange: (model: DeepSeekModel) => void;
  bynaraModel: BynaraModel;
  onBynaraModelChange: (model: BynaraModel) => void;
  researchProvider: SearchProvider;
  onResearchProviderChange: (provider: SearchProvider) => void;
}

export const AiProviderSection: React.FC<AiProviderSectionProps> = ({
  provider,
  onProviderChange,
  deepSeekModel,
  onDeepSeekModelChange,
  bynaraModel,
  onBynaraModelChange,
  researchProvider,
  onResearchProviderChange,
}) => {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 to-indigo-600"></div>
      <h2 className="text-lg font-semibold text-slate-800 flex items-center mb-4">
        <BrainCircuit className="w-5 h-5 mr-2 text-indigo-600" />
        AI Engine Selection
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Provider</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => onProviderChange(AIProvider.GEMINI)}
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
              onClick={() => onProviderChange(AIProvider.DEEPSEEK)}
              className={`flex items-center justify-center py-3 px-4 rounded-lg border-2 transition-all ${provider === AIProvider.DEEPSEEK
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                }`}
            >
              <Cpu className={`w-5 h-5 mr-2 ${provider === AIProvider.DEEPSEEK ? 'fill-indigo-600 text-indigo-600' : ''}`} />
              DeepSeek
            </button>
            <button
              type="button"
              onClick={() => onProviderChange(AIProvider.BYNARA)}
              className={`flex items-center justify-center py-3 px-4 rounded-lg border-2 transition-all ${provider === AIProvider.BYNARA
                ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold'
                : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300'
                }`}
            >
              <Globe className={`w-5 h-5 mr-2 ${provider === AIProvider.BYNARA ? 'fill-purple-600 text-purple-600' : ''}`} />
              Bynara
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
                onChange={(e) => onDeepSeekModelChange(e.target.value as DeepSeekModel)}
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
          </div>
        )}

        {/* Bynara Specific Model Selection */}
        {provider === AIProvider.BYNARA && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="block text-sm font-medium text-slate-700 mb-1">Bynara Model</label>
            <div className="relative">
              <div className="absolute left-3 top-3 w-4 h-4 text-purple-500">
                <Globe className="w-4 h-4" />
              </div>
              <select
                value={bynaraModel}
                onChange={(e) => onBynaraModelChange(e.target.value as BynaraModel)}
                className="w-full pl-10 pr-3 py-2.5 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm bg-purple-50/20 font-medium text-slate-700"
              >
                {Object.values(BynaraModel).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-purple-600 mt-1 flex items-center">
              <Target className="w-3 h-3 mr-1" />
              Select from ByNara's global model network
            </p>
            <p className="text-xs text-slate-500 mt-2 border-l-2 border-purple-200 pl-2">
              Note: Web scanning/research options below depend on your "Research Provider" setting.
            </p>

            {/* Research Provider Selector for DeepSeek/Bynara */}
            <div className="mt-3 pt-3 border-t border-indigo-200">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Research/Scanning Provider</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onResearchProviderChange(SearchProvider.TAVILY)}
                  className={`text-xs py-2 px-2 rounded border flex items-center justify-center ${
                    researchProvider === SearchProvider.TAVILY
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Search className="w-3 h-3 mr-1.5" />
                  Tavily
                </button>
                <button
                  type="button"
                  onClick={() => onResearchProviderChange(SearchProvider.TINYFISH)}
                  className={`text-xs py-2 px-2 rounded border flex items-center justify-center ${
                    researchProvider === SearchProvider.TINYFISH
                      ? 'bg-cyan-50 border-cyan-300 text-cyan-700 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Fish className="w-3 h-3 mr-1.5" />
                  TinyFish
                </button>
                <button
                  type="button"
                  onClick={() => onResearchProviderChange(SearchProvider.AUTO)}
                  className={`text-xs py-2 px-2 rounded border flex items-center justify-center ${
                    researchProvider === SearchProvider.AUTO
                      ? 'bg-violet-50 border-violet-300 text-violet-700 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Zap className="w-3 h-3 mr-1.5" />
                  Auto
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {researchProvider === SearchProvider.AUTO
                  ? '*Auto: Uses the best available provider with automatic fallback.'
                  : '*DeepSeek/Bynara require a web scanning provider. Choose Tavily, TinyFish, or Auto.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
