import React from 'react';
import { ReadabilityLevel, OpeningStyle } from '../../../types';
import { GraduationCap, BookOpen, Lightbulb, UserCheck } from 'lucide-react';

interface StyleSectionProps {
  readability: ReadabilityLevel;
  onReadabilityChange: (level: ReadabilityLevel) => void;
  humanizeContent: boolean;
  onHumanizeChange: (checked: boolean) => void;
  useCustomOpening: boolean;
  onUseCustomOpeningChange: (checked: boolean) => void;
  openingStyle: OpeningStyle;
  onOpeningStyleChange: (style: OpeningStyle) => void;
  includeFaq: boolean;
  onIncludeFaqChange: (checked: boolean) => void;
  includeConclusion: boolean;
  onIncludeConclusionChange: (checked: boolean) => void;
}

export const StyleSection: React.FC<StyleSectionProps> = ({
  readability,
  onReadabilityChange,
  humanizeContent,
  onHumanizeChange,
  useCustomOpening,
  onUseCustomOpeningChange,
  openingStyle,
  onOpeningStyleChange,
  includeFaq,
  onIncludeFaqChange,
  includeConclusion,
  onIncludeConclusionChange,
}) => {
  return (
    <div className="space-y-4">
      {/* Readability Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Text Readability</label>
        <div className="relative">
          <GraduationCap className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <select
            value={readability}
            onChange={(e) => onReadabilityChange(e.target.value as ReadabilityLevel)}
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
              onChange={(e) => onHumanizeChange(e.target.checked)}
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
                  onChange={(e) => onUseCustomOpeningChange(e.target.checked)}
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
                onChange={(e) => onOpeningStyleChange(e.target.value as OpeningStyle)}
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
            onChange={(e) => onIncludeFaqChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">Include FAQ Section</span>
        </label>
        <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
          <input
            type="checkbox"
            checked={includeConclusion}
            onChange={(e) => onIncludeConclusionChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">Include Key Takeaways/Conclusion</span>
        </label>
      </div>
    </div>
  );
};
