import React from 'react';
import { Type, Check } from 'lucide-react';

interface FormattingSectionProps {
  includeBulletPoints: boolean;
  onBulletPointsChange: (checked: boolean) => void;
  includeTables: boolean;
  onTablesChange: (checked: boolean) => void;
  includeBold: boolean;
  onBoldChange: (checked: boolean) => void;
  includeItalics: boolean;
  onItalicsChange: (checked: boolean) => void;
}

export const FormattingSection: React.FC<FormattingSectionProps> = ({
  includeBulletPoints,
  onBulletPointsChange,
  includeTables,
  onTablesChange,
  includeBold,
  onBoldChange,
  includeItalics,
  onItalicsChange,
}) => {
  return (
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
            onChange={(e) => onBulletPointsChange(e.target.checked)}
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
            onChange={(e) => onTablesChange(e.target.checked)}
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
            onChange={(e) => onBoldChange(e.target.checked)}
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
            onChange={(e) => onItalicsChange(e.target.checked)}
            className="opacity-0 absolute w-0 h-0"
          />
          <span className="text-sm text-slate-700">Italics</span>
        </label>
      </div>
    </div>
  );
};
