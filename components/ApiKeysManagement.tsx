import React, { useState, useEffect } from 'react';
import { Zap, Cpu, Globe, Search, BarChart3, Fish, Eye, EyeOff, Pencil, Trash2, Save, ShieldCheck, Key } from 'lucide-react';

interface ApiKeyEntry {
  key: string;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  description: string;
}

const API_KEYS: ApiKeyEntry[] = [
  { key: 'user_gemini_api_key', label: 'Google Gemini', icon: <Zap className="w-4 h-4 text-blue-500" />, placeholder: 'AIzaSy...', description: 'Primary AI writing engine' },
  { key: 'user_deepseek_api_key', label: 'DeepSeek', icon: <Cpu className="w-4 h-4 text-indigo-500" />, placeholder: 'sk-...', description: 'DeepSeek-V3.2 & Speciale models' },
  { key: 'user_bynara_api_key', label: 'Bynara', icon: <Globe className="w-4 h-4 text-purple-500" />, placeholder: 'sk-nry-...', description: 'Bynara models (e.g. deepseek-3.2)' },
  { key: 'user_tavily_api_key', label: 'Tavily', icon: <Search className="w-4 h-4 text-emerald-500" />, placeholder: 'tvly-...', description: 'Web research and real-time data' },
  { key: 'user_tinyfish_api_key', label: 'TinyFish', icon: <Fish className="w-4 h-4 text-cyan-500" />, placeholder: 'tfk-...', description: 'TinyFish web research provider' },
  { key: 'user_tinyfish_fetch_api_key', label: 'TinyFish Fetch', icon: <Fish className="w-4 h-4 text-cyan-600" />, placeholder: 'tff-...', description: 'Advanced RAG integration' },
  { key: 'user_se_ranking_api_key', label: 'SE Ranking', icon: <BarChart3 className="w-4 h-4 text-amber-500" />, placeholder: 'Your API key...', description: 'Keyword gap analysis & lost keyword recovery' },
  { key: 'user_cloudflare_api_url', label: 'Cloudflare Account ID', icon: <Globe className="w-4 h-4 text-orange-500" />, placeholder: 'e.g. 9a78...', description: 'Cloudflare Workers AI account ID' },
  { key: 'user_cloudflare_api_token', label: 'Cloudflare API Token', icon: <Globe className="w-4 h-4 text-orange-600" />, placeholder: 'Your secret API token...', description: 'Bearer token for Cloudflare Workers AI' },
];

const maskKey = (value: string): string => {
  if (value.length <= 8) return '••••••••';
  return value.slice(0, 6) + '••••••••••••••••••••' + value.slice(-4);
};

export const ApiKeysManagement: React.FC = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [editingKeys, setEditingKeys] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    const initial: Record<string, string> = {};
    API_KEYS.forEach(entry => {
      initial[entry.key] = localStorage.getItem(entry.key) || '';
    });
    setValues(initial);
  }, []);

  const handleChange = (key: string, newValue: string) => {
    setValues(prev => ({ ...prev, [key]: newValue }));
  };

  const toggleVisibility = (key: string) => {
    setVisibleKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEdit = (key: string) => {
    setEditingKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClear = (key: string) => {
    localStorage.removeItem(key);
    setValues(prev => ({ ...prev, [key]: '' }));
  };

  const handleSaveAll = () => {
    API_KEYS.forEach(entry => {
      const val = values[entry.key]?.trim();
      if (val) {
        localStorage.setItem(entry.key, val);
      } else {
        localStorage.removeItem(entry.key);
      }
    });
    setSaveStatus('saved');
    setEditingKeys({});
    setTimeout(() => setSaveStatus('saved'), 1500);
    setTimeout(() => setSaveStatus('idle'), 1500);
  };

  const configuredCount = API_KEYS.filter(entry => values[entry.key]?.trim()).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            <Key className="w-6 h-6 mr-2 text-blue-600" />
            API Provider Keys
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage all your API credentials in one place ({configuredCount}/{API_KEYS.length} configured)
          </p>
        </div>
        <button
          onClick={handleSaveAll}
          className={`flex items-center px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            saveStatus === 'saved'
              ? 'bg-green-600 text-white'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {saveStatus === 'saved' ? (
            <>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Keys Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save All Changes
            </>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-auto space-y-3">
        {API_KEYS.map(entry => {
          const value = values[entry.key] || '';
          const isConfigured = !!value.trim();
          const isVisible = visibleKeys[entry.key] || false;
          const isEditing = editingKeys[entry.key] || false;

          return (
            <div key={entry.key} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {entry.icon}
                  <span className="ml-2 text-sm font-semibold text-slate-800">{entry.label}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isConfigured
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-slate-50 text-slate-400 border border-slate-200'
                }`}>
                  {isConfigured ? '● Configured' : '○ Not Set'}
                </span>
              </div>

              {isConfigured && !isEditing ? (
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded border border-slate-100 flex-1">
                    {isVisible ? value : maskKey(value)}
                  </code>
                  <button
                    onClick={() => toggleVisibility(entry.key)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    title={isVisible ? 'Hide key' : 'Show key'}
                  >
                    {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => toggleEdit(entry.key)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit key"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleClear(entry.key)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Clear key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mt-2">
                  <input
                    type={isEditing ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => handleChange(entry.key, e.target.value)}
                    placeholder={entry.placeholder}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                  />
                  {isEditing && (
                    <button
                      onClick={() => toggleEdit(entry.key)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                    >
                      Done
                    </button>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-400 mt-2">{entry.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
