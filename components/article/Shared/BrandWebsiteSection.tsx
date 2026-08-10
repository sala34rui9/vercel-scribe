import React from 'react';
import { Globe, Save, Trash2, Check } from 'lucide-react';

interface BrandWebsiteSectionProps {
  websiteUrl: string;
  onWebsiteUrlChange: (url: string) => void;
  urlSavedSuccess: boolean;
  onSave: () => void;
  onClear: () => void;
}

export const BrandWebsiteSection: React.FC<BrandWebsiteSectionProps> = ({
  websiteUrl,
  onWebsiteUrlChange,
  urlSavedSuccess,
  onSave,
  onClear,
}) => {
  return (
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
            onChange={(e) => onWebsiteUrlChange(e.target.value)}
            placeholder="https://yourbrand.com"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
          />
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!websiteUrl}
          title="Save for future sessions"
          className="p-2 bg-white border border-slate-300 text-slate-500 rounded-lg hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!websiteUrl}
          title="Clear saved website"
          className="p-2 bg-white border border-slate-300 text-slate-500 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
