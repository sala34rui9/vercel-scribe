import React from 'react';
import { ArticleType, ToneVoice, TargetCountry } from '../../../types';
import { Type, Sparkles, MapPin } from 'lucide-react';

interface ContentSettingsSectionProps {
  type: ArticleType;
  onTypeChange: (type: ArticleType) => void;
  tone: ToneVoice;
  onToneChange: (tone: ToneVoice) => void;
  targetCountry: TargetCountry;
  onTargetCountryChange: (country: TargetCountry) => void;
  wordCount: number;
  onWordCountChange: (count: number) => void;
}

export const ContentSettingsSection: React.FC<ContentSettingsSectionProps> = ({
  type,
  onTypeChange,
  tone,
  onToneChange,
  targetCountry,
  onTargetCountryChange,
  wordCount,
  onWordCountChange,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Article Type</label>
        <div className="relative">
          <Type className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <select
            value={type}
            onChange={(e) => onTypeChange(e.target.value as ArticleType)}
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
            onChange={(e) => onToneChange(e.target.value as ToneVoice)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm appearance-none bg-white"
          >
            {Object.values(ToneVoice).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-1">Target Country & Localization</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <select
            value={targetCountry}
            onChange={(e) => onTargetCountryChange(e.target.value as TargetCountry)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm appearance-none bg-white"
          >
            {Object.values(TargetCountry).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="col-span-2">
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
            onChange={(e) => onWordCountChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      </div>
    </div>
  );
};
