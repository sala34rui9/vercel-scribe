import React, { useState, useEffect } from 'react';
import { Target, BarChart3, Globe, Save, ShieldCheck, Key, Activity, RefreshCw } from 'lucide-react';
import { fetchSEORankingData } from '../services/supabaseClient';
import { SEORankingData } from '../types';

export const SeoSettings: React.FC = () => {
  const [seRankingKey, setSeRankingKey] = useState('');
  const [targetDomain, setTargetDomain] = useState('');
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [hasSeRankingKey, setHasSeRankingKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<SEORankingData | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    const srKey = localStorage.getItem('user_se_ranking_api_key');
    if (srKey) {
      setHasSeRankingKey(true);
      setSeRankingKey(srKey);
    }

    const td = localStorage.getItem('seo_scribe_target_domain');
    if (td) setTargetDomain(td);

    const cd = localStorage.getItem('seo_scribe_competitor_domain');
    if (cd) setCompetitorDomain(cd);
  }, []);

  const handleSaveSettings = () => {
    let saved = false;

    if (seRankingKey.trim()) {
      localStorage.setItem('user_se_ranking_api_key', seRankingKey.trim());
      setHasSeRankingKey(true);
      saved = true;
    } else {
      localStorage.removeItem('user_se_ranking_api_key');
      setHasSeRankingKey(false);
    }

    if (targetDomain.trim()) {
      localStorage.setItem('seo_scribe_target_domain', targetDomain.trim());
    } else {
      localStorage.removeItem('seo_scribe_target_domain');
    }

    if (competitorDomain.trim()) {
      localStorage.setItem('seo_scribe_competitor_domain', competitorDomain.trim());
    } else {
      localStorage.removeItem('seo_scribe_competitor_domain');
    }

    saved = saved || targetDomain.trim().length > 0 || competitorDomain.trim().length > 0;

    if (saved || seRankingKey.trim() === '') {
      setSaveStatus('saved');
      // Trigger a custom event so Layout can update its badges if necessary
      window.dispatchEvent(new Event('seo_settings_updated'));
      setTimeout(() => {
        setSaveStatus('idle');
      }, 1500);
    }
  };

  const handleRunScan = async () => {
    if (!targetDomain) return;
    setIsScanning(true);
    setScanError(null);
    try {
      handleSaveSettings(); // Save before scanning to ensure API keys are current
      
      // Call the Supabase Edge Function directly so we can see the raw response
      const { supabase } = await import('../services/supabaseClient');
      const seRankingKey = localStorage.getItem('user_se_ranking_api_key');
      
      const { data, error } = await supabase.functions.invoke('fetch-seo-data', {
        body: {
          targetDomain,
          competitorDomain: competitorDomain || undefined,
          seRankingKey
        }
      });
      
      if (error) {
        setScanError(`Edge Function error: ${error.message}`);
        console.error('Scan error:', error);
        return;
      }
      
      if (data?.error) {
        setScanError(`API error: ${data.error}`);
        console.error('API error:', data.error);
      }
      
      console.log('[SEO Scan] Raw response:', JSON.stringify(data, null, 2));
      
      setScanResults({
        lostKeywords: data?.lostKeywords || [],
        competitorGaps: data?.competitorGaps || [],
        aiOverviewKeywords: data?.aiOverviewKeywords || [],
        dataFetchedAt: data?.dataFetchedAt
      });
    } catch (e: any) {
      setScanError(e.message || 'Unknown error during scan');
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  const clearSeRanking = () => {
    localStorage.removeItem('user_se_ranking_api_key');
    setSeRankingKey('');
    setHasSeRankingKey(false);
    window.dispatchEvent(new Event('seo_settings_updated'));
  };

  return (
    <div className="max-w-4xl mx-auto w-full py-8 px-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center">
          <div className="bg-amber-100 p-2 rounded-lg mr-4">
            <Target className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">SEO Intelligence Settings</h2>
            <p className="text-sm text-slate-500 mt-1">
              Configure your SE Ranking API and target domains for data-driven article optimization.
            </p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* SE Ranking Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center border-b border-slate-100 pb-2">
              <Key className="w-4 h-4 mr-2 text-slate-500" />
              API Authentication
            </h3>
            <label className="flex items-center text-sm font-semibold text-slate-700 mt-4">
              <BarChart3 className="w-4 h-4 mr-1.5 text-amber-500" />
              SE Ranking API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={seRankingKey}
                onChange={(e) => setSeRankingKey(e.target.value)}
                placeholder="Your SE Ranking API key..."
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-mono transition-shadow"
              />
              {hasSeRankingKey && (
                <button 
                  onClick={clearSeRanking} 
                  className="px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Powers keyword gap analysis and lost keyword recovery. Required for SEO Intelligence features.
            </p>
          </div>

          {/* Domain Targeting Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center border-b border-slate-100 pb-2">
              <Globe className="w-4 h-4 mr-2 text-slate-500" />
              Domain Targeting
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Target Domain */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-slate-700">
                  <Globe className="w-4 h-4 mr-1.5 text-blue-500" />
                  Target Domain
                </label>
                <input
                  type="text"
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                  placeholder="e.g. example.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm transition-shadow"
                />
                <p className="text-xs text-slate-500">Your website domain for keyword analysis</p>
              </div>

              {/* Competitor Domain */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-slate-700">
                  <Target className="w-4 h-4 mr-1.5 text-red-500" />
                  Primary Competitor Domain
                  <span className="ml-2 text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                </label>
                <input
                  type="text"
                  value={competitorDomain}
                  onChange={(e) => setCompetitorDomain(e.target.value)}
                  placeholder="e.g. competitor.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm transition-shadow"
                />
                <p className="text-xs text-slate-500">Enables competitor gap analysis</p>
              </div>
            </div>
          </div>

          {/* Intelligence Radar Section */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center">
                <Activity className="w-4 h-4 mr-2 text-indigo-500" />
                Live Intelligence Radar
              </h3>
              <button
                onClick={handleRunScan}
                disabled={!targetDomain || isScanning || !hasSeRankingKey}
                className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Scanning Domains...' : 'Run Intelligence Scan'}
              </button>
            </div>

            {scanError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <p className="font-semibold mb-1">⚠️ Scan Failed</p>
                <p className="font-mono text-xs break-all">{scanError}</p>
              </div>
            )}

            {scanResults && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 animate-in slide-in-from-bottom-2">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Lost Keywords</div>
                  <div className="text-2xl font-bold text-slate-800">{scanResults.lostKeywords.length}</div>
                  <div className="text-xs text-slate-400 mt-2 truncate" title={scanResults.lostKeywords.join(', ')}>
                    {scanResults.lostKeywords.length > 0 ? scanResults.lostKeywords.slice(0, 3).join(', ') : 'None found'}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Competitor Gaps</div>
                  <div className="text-2xl font-bold text-slate-800">{scanResults.competitorGaps.length}</div>
                  <div className="text-xs text-slate-400 mt-2 truncate" title={scanResults.competitorGaps.join(', ')}>
                    {scanResults.competitorGaps.length > 0 ? scanResults.competitorGaps.slice(0, 3).join(', ') : 'None found'}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">AI Overview Targets</div>
                  <div className="text-2xl font-bold text-slate-800">{scanResults.aiOverviewKeywords.length}</div>
                  <div className="text-xs text-slate-400 mt-2 truncate" title={scanResults.aiOverviewKeywords.join(', ')}>
                    {scanResults.aiOverviewKeywords.length > 0 ? scanResults.aiOverviewKeywords.slice(0, 3).join(', ') : 'None found'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex justify-end pt-6 border-t border-slate-100">
            <button
              onClick={handleSaveSettings}
              className={`flex items-center px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                saveStatus === 'saved'
                  ? 'bg-green-600 text-white shadow-md shadow-green-500/20'
                  : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm hover:shadow-md'
              }`}
            >
              {saveStatus === 'saved' ? (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Settings Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
