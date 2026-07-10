import React, { useState, useEffect } from 'react';
import { Search, Globe, Target, TrendingDown, Layers, Zap, AlertCircle, Loader2 } from 'lucide-react';
import {
  fetchDomainOverview,
  fetchTopCompetitors,
  fetchSimilarKeywords,
  fetchRelatedKeywords,
  fetchSEORankingData
} from '../services/supabaseClient';
import { DomainOverview, CompetitorEntry } from '../types';

type Tab = 'overview' | 'competitors' | 'dropped' | 'gaps' | 'clusters' | 'ai';

const FindKeywords: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  // States for Inputs
  const [targetDomain, setTargetDomain] = useState('');
  const [targetCountry, setTargetCountry] = useState('us');
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [seedKeyword, setSeedKeyword] = useState('');
  
  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [domainOverview, setDomainOverview] = useState<DomainOverview | null>(null);
  const [topCompetitors, setTopCompetitors] = useState<CompetitorEntry[]>([]);
  const [lostKeywords, setLostKeywords] = useState<string[]>([]);
  const [competitorGaps, setCompetitorGaps] = useState<string[]>([]);
  const [similarKeywords, setSimilarKeywords] = useState<string[]>([]);
  const [relatedKeywords, setRelatedKeywords] = useState<string[]>([]);
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);

  // Pre-fill target domain if available in localStorage
  useEffect(() => {
    const savedDomain = localStorage.getItem('seo_scribe_target_domain');
    if (savedDomain) setTargetDomain(savedDomain);
  }, []);

  const handleFetchOverview = async () => {
    if (!targetDomain) {
      setError("Please enter a target domain.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDomainOverview(targetDomain);
      if (data) setDomainOverview(data);
      else setError("Failed to fetch domain overview or no data available.");
    } catch (e: any) {
      setError(e.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchCompetitors = async () => {
    if (!targetDomain) {
      setError("Please enter a target domain.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTopCompetitors(targetDomain, targetCountry);
      setTopCompetitors(data);
    } catch (e: any) {
      setError(e.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchDropped = async () => {
    if (!targetDomain) {
      setError("Please enter a target domain.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSEORankingData(targetDomain, targetCountry);
      setLostKeywords(data.lostKeywords || []);
    } catch (e: any) {
      setError(e.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchGaps = async () => {
    if (!targetDomain || !competitorDomain) {
      setError("Please enter both target and competitor domains.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSEORankingData(targetDomain, targetCountry, competitorDomain);
      setCompetitorGaps(data.competitorGaps || []);
    } catch (e: any) {
      setError(e.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchClusters = async () => {
    if (!seedKeyword) {
      setError("Please enter a seed keyword.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [similar, related] = await Promise.all([
        fetchSimilarKeywords(seedKeyword, targetCountry),
        fetchRelatedKeywords(seedKeyword, targetCountry)
      ]);
      setSimilarKeywords(similar);
      setRelatedKeywords(related);
    } catch (e: any) {
      setError(e.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAi = async () => {
    if (!targetDomain) {
      setError("Please enter a target domain.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSEORankingData(targetDomain, targetCountry);
      setAiKeywords(data.aiOverviewKeywords || []);
    } catch (e: any) {
      setError(e.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

  const renderContent = () => {
    if (activeTab === 'overview') {
      return (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input type="text" value={targetDomain} onChange={(e) => setTargetDomain(e.target.value)} placeholder="Target Domain (e.g. visa.com)" className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors" />
            <button onClick={handleFetchOverview} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />} Get Overview
            </button>
          </div>
          {domainOverview && (
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-gray-400 text-sm">Total Keywords</div>
                <div className="text-2xl font-bold text-blue-400">{formatNumber(domainOverview.totalKeywords)}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-gray-400 text-sm">Organic Traffic</div>
                <div className="text-2xl font-bold text-green-400">{formatNumber(domainOverview.organicTraffic)}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-gray-400 text-sm">Paid Traffic</div>
                <div className="text-2xl font-bold text-purple-400">{formatNumber(domainOverview.paidTraffic)}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-gray-400 text-sm">Traffic Value</div>
                <div className="text-2xl font-bold text-yellow-400">${formatNumber(domainOverview.trafficValue)}</div>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    if (activeTab === 'competitors') {
      return (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input type="text" value={targetDomain} onChange={(e) => setTargetDomain(e.target.value)} placeholder="Target Domain" className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors" />
            <input type="text" value={targetCountry} onChange={(e) => setTargetCountry(e.target.value)} placeholder="Region (e.g. us)" className="w-32 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors" />
            <button onClick={handleFetchCompetitors} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4 mr-2" />} Find Competitors
            </button>
          </div>
          {topCompetitors.length > 0 && (
            <div className="mt-4 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="p-3 text-gray-300">Competitor Domain</th>
                    <th className="p-3 text-gray-300 text-right">Overlapping Keywords</th>
                  </tr>
                </thead>
                <tbody>
                  {topCompetitors.map((comp, i) => (
                    <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                      <td className="p-3 text-white">{comp.domain}</td>
                      <td className="p-3 text-gray-400 text-right">{formatNumber(comp.overlappingKeywords)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'dropped') {
      return (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input type="text" value={targetDomain} onChange={(e) => setTargetDomain(e.target.value)} placeholder="Target Domain" className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors" />
            <button onClick={handleFetchDropped} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4 mr-2" />} Find Dropped
            </button>
          </div>
          {lostKeywords.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
              {lostKeywords.map((kw, i) => (
                <div key={i} className="bg-gray-800 p-2 rounded text-red-400 border border-gray-700 text-sm truncate">{kw}</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'gaps') {
      return (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input type="text" value={targetDomain} onChange={(e) => setTargetDomain(e.target.value)} placeholder="Your Domain" className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors" />
            <input type="text" value={competitorDomain} onChange={(e) => setCompetitorDomain(e.target.value)} placeholder="Competitor Domain" className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors" />
            <button onClick={handleFetchGaps} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4 mr-2" />} Find Gaps
            </button>
          </div>
          {competitorGaps.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
              {competitorGaps.map((kw, i) => (
                <div key={i} className="bg-gray-800 p-2 rounded text-blue-400 border border-gray-700 text-sm truncate">{kw}</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'clusters') {
      return (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input type="text" value={seedKeyword} onChange={(e) => setSeedKeyword(e.target.value)} placeholder="Seed Keyword (e.g. credit cards)" className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors" />
            <button onClick={handleFetchClusters} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />} Expand Topic
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            {similarKeywords.length > 0 && (
              <div>
                <h4 className="text-gray-300 font-semibold mb-2">Similar Keywords</h4>
                <div className="space-y-2">
                  {similarKeywords.map((kw, i) => (
                    <div key={i} className="bg-gray-800 p-2 rounded text-gray-300 border border-gray-700 text-sm">{kw}</div>
                  ))}
                </div>
              </div>
            )}
            {relatedKeywords.length > 0 && (
              <div>
                <h4 className="text-gray-300 font-semibold mb-2">Related Keywords</h4>
                <div className="space-y-2">
                  {relatedKeywords.map((kw, i) => (
                    <div key={i} className="bg-gray-800 p-2 rounded text-gray-300 border border-gray-700 text-sm">{kw}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'ai') {
      return (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input type="text" value={targetDomain} onChange={(e) => setTargetDomain(e.target.value)} placeholder="Competitor Domain" className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors" />
            <button onClick={handleFetchAi} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />} Find AI Overviews
            </button>
          </div>
          {aiKeywords.length > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {aiKeywords.map((kw, i) => (
                <div key={i} className="bg-gray-800 p-3 rounded text-purple-400 border border-gray-700 text-sm">{kw}</div>
              ))}
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="border-b border-gray-800 p-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Search className="w-5 h-5 mr-2 text-blue-500" /> Keyword Explorer
        </h2>
        <p className="text-gray-400 text-sm mt-1">Discover opportunities powered by SE Ranking</p>
      </div>
      
      {error && (
        <div className="p-4 bg-red-900/30 border-b border-red-900 text-red-400 flex items-center text-sm">
          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex border-b border-gray-800 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: Globe },
          { id: 'competitors', label: 'Competitors', icon: Target },
          { id: 'dropped', label: 'Dropped', icon: TrendingDown },
          { id: 'gaps', label: 'Gaps', icon: Layers },
          { id: 'clusters', label: 'Topic Clusters', icon: Search },
          { id: 'ai', label: 'AI Overviews', icon: Zap }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id as Tab); setError(null); }}
            className={`flex items-center px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.id ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/10' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            <t.icon className="w-4 h-4 mr-2" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {renderContent()}
      </div>
    </div>
  );
};

export default FindKeywords;
