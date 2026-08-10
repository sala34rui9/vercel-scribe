import React from 'react';
import { FileText, Upload, X } from 'lucide-react';

interface ResourcesSectionProps {
  personalFileName: string;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  personalResources?: string;
}

export const ResourcesSection: React.FC<ResourcesSectionProps> = ({
  personalFileName,
  onFileUpload,
  onClear,
}) => {
  return (
    <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <FileText className="w-5 h-5 text-indigo-600 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Personal Resources</h3>
            <p className="text-xs text-slate-500 mt-1">
              Upload a .txt file to provide additional context, facts, or guidelines.
            </p>
          </div>
        </div>
        <div className="relative">
          <input
            type="file"
            accept=".txt"
            onChange={onFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
            id="personal-resources-upload"
          />
          <button
            type="button"
            className="flex items-center px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            {personalFileName ? 'Change' : 'Upload .txt'}
          </button>
        </div>
      </div>

      {personalFileName && (
        <div className="mt-3 flex items-center justify-between p-2 bg-white border border-indigo-100 rounded-md animate-in fade-in slide-in-from-left-2 duration-200">
          <div className="flex items-center min-w-0">
            <div className="p-1 px-1.5 bg-indigo-100 rounded text-indigo-700 font-bold text-[10px] mr-2">TXT</div>
            <span className="text-xs text-slate-600 truncate max-w-[200px]">{personalFileName}</span>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
            title="Remove context"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
