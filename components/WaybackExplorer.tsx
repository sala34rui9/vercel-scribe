/**
 * Wayback Machine Explorer Component
 * UI for historical content intelligence, archive recovery, and SEO analysis.
 */

import React, { useState } from 'react';
import {
  Archive, Search, Clock, GitCompare, RefreshCw, AlertCircle,
  Loader2, ExternalLink, Calendar, Globe, TrendingUp, Shield,
  ChevronRight, CheckCircle, XCircle, FileText, RotateCcw,
  Link as LinkIcon, BarChart3, History
} from 'lucide-react';
import {
  checkAvailability,
  fetchSnapshots,
  buildTimeline,
  extractContent,
  recoverContent,
  compareSnapshots,
  analyzeHistoricalSeo,
  analyzeExpiredDomain,
  getBacklinkRecoveryRecommendation,
} from '../services/waybackService';
import type {
  WaybackSnapshot,
  WaybackTimeline,
  WaybackExtractedContent,
  WaybackSeoAnalysis,
  WaybackDomainAnalysis,
  WaybackBacklinkRecovery,
  WaybackComparisonResult,
} from '../types';

type Tab = 'status' | 'timeline' | 'compare' | 'seo' | 'recover' | 'domain';

const WaybackExplorer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('status');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results state
  const [availability, setAvailability] = useState<{ isAvailable: boolean; snapshot: WaybackSnapshot | null } | null>(null);
  const [timeline, setTimeline] = useState<WaybackTimeline | null>(null);
  const [extractedContent, setExtractedContent] = useState<WaybackExtractedContent | null>(null);
  const [seoAnalysis, setSeoAnalysis] = useState<WaybackSeoAnalysis | null>(null);
  const [domainAnalysis, setDomainAnalysis] = useState<WaybackDomainAnalysis | null>(null);
  const [backlinkRecovery, setBacklinkRecovery] = useState<WaybackBacklinkRecovery | null>(null);
  const [comparison, setComparison] = useState<WaybackComparisonResult | null>(null);

  // Compare state
  const [olderUrl, setOlderUrl] = useState('');
  const [newerUrl, setNewerUrl] = useState('');

  const handleCheckAvailability = async () => {
    if (!url.trim()) {
      setError('Please enter a URL to check');
      return;
    }
    setLoading(true);
    setError(null);
    setAvailability(null);
    try {
      const result = await checkAvailability(url.trim());
      setAvailability(result);
    } catch (e: any) {
      setError(e.message || 'Failed to check availability');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchTimeline = async () => {
    if (!url.trim()) {
      setError('Please enter a URL to fetch timeline');
      return;
    }
    setLoading(true);
    setError(null);
    setTimeline(null);
    try {
      const snapshots = await fetchSnapshots(url.trim(), { limit: 500 });
      const tl = buildTimeline(url.trim(), snapshots);
      setTimeline(tl);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch timeline');
    } finally {
      setLoading(false);
    }
  };

  const handleExtractContent = async (snapshot: WaybackSnapshot) => {
    setLoading(true);
    setError(null);
    setExtractedContent(null);
    try {
      const content = await extractContent(snapshot, { maxContentLength: 10000 });
      setExtractedContent(content);
    } catch (e: any) {
      setError(e.message || 'Failed to extract content');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverContent = async () => {
    if (!url.trim()) {
      setError('Please enter a URL to recover');
      return;
    }
    setLoading(true);
    setError(null);
    setExtractedContent(null);
    try {
      const content = await recoverContent(url.trim(), { maxContentLength: 15000 });
      if (content) {
        setExtractedContent(content);
      } else {
        setError('No archived content found for this URL');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to recover content');
    } finally {
      setLoading(false);
    }
  };

  const handleSeoAnalysis = async () => {
    if (!url.trim()) {
      setError('Please enter a URL to analyze');
      return;
    }
    setLoading(true);
    setError(null);
    setSeoAnalysis(null);
    try {
      const analysis = await analyzeHistoricalSeo(url.trim(), { limit: 50 });
      setSeoAnalysis(analysis);
    } catch (e: any) {
      setError(e.message || 'Failed to analyze SEO');
    } finally {
      setLoading(false);
    }
  };

  const handleDomainAnalysis = async () => {
    if (!url.trim()) {
      setError('Please enter a domain to analyze');
      return;
    }
    setLoading(true);
    setError(null);
    setDomainAnalysis(null);
    try {
      const analysis = await analyzeExpiredDomain(url.trim());
      setDomainAnalysis(analysis);
    } catch (e: any) {
      setError(e.message || 'Failed to analyze domain');
    } finally {
      setLoading(false);
    }
  };

  const handleBacklinkRecovery = async () => {
    if (!url.trim()) {
      setError('Please enter a URL to analyze');
      return;
    }
    setLoading(true);
    setError(null);
    setBacklinkRecovery(null);
    try {
      const result = await getBacklinkRecoveryRecommendation(url.trim(), 25);
      setBacklinkRecovery(result);
    } catch (e: any) {
      setError(e.message || 'Failed to get recovery recommendation');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!olderUrl.trim() || !newerUrl.trim()) {
      setError('Please enter both URLs to compare');
      return;
    }
    setLoading(true);
    setError(null);
    setComparison(null);
    try {
      const [olderSnap, newerSnap] = await Promise.all([
        fetchSnapshots(olderUrl.trim(), { limit: 1 }),
        fetchSnapshots(newerUrl.trim(), { limit: 1 }),
      ]);

      if (olderSnap.length === 0 || newerSnap.length === 0) {
        setError('Could not find snapshots for one or both URLs');
        return;
      }

      // Sort to ensure older is actually older
      const [older, newer] = olderSnap[0].date <= newerSnap[0].date
        ? [olderSnap[0], newerSnap[0]]
        : [newerSnap[0], olderSnap[0]];

      const result = await compareSnapshots(older, newer);
      setComparison(result);
    } catch (e: any) {
      setError(e.message || 'Failed to compare snapshots');
    } finally {
      setLoading(false);
    }
  };

  const renderStatusTab = () => (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL to check (e.g. https://example.com)"
          className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
          onKeyDown={(e) => e.key === 'Enter' && handleCheckAvailability()}
        />
        <button
          onClick={handleCheckAvailability}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Check
        </button>
      </div>

      {availability && (
        <div className="mt-4 space-y-4">
          {availability.isAvailable ? (
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
              <div className="flex items-center text-green-400 mb-3">
                <CheckCircle className="w-5 h-5 mr-2" />
                <span className="font-semibold">Archive Available</span>
              </div>
              {availability.snapshot && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Latest Snapshot:</span>
                    <span className="text-white">{new Date(availability.snapshot.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status Code:</span>
                    <span className="text-white">{availability.snapshot.statusCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Content Type:</span>
                    <span className="text-white">{availability.snapshot.mimeType}</span>
                  </div>
                  <div className="pt-2 flex space-x-2">
                    <a
                      href={availability.snapshot.snapshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs flex items-center transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" /> View Snapshot
                    </a>
                    <button
                      onClick={() => handleExtractContent(availability.snapshot!)}
                      disabled={loading}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center transition-colors disabled:opacity-50"
                    >
                      <FileText className="w-3 h-3 mr-1" /> Extract Content
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <div className="flex items-center text-red-400">
                <XCircle className="w-5 h-5 mr-2" />
                <span className="font-semibold">No Archive Found</span>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                This URL has no archived snapshots in the Wayback Machine.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderTimelineTab = () => (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL for timeline (e.g. https://example.com)"
          className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
          onKeyDown={(e) => e.key === 'Enter' && handleFetchTimeline()}
        />
        <button
          onClick={handleFetchTimeline}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
          Get Timeline
        </button>
      </div>

      {timeline && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-400">
              {timeline.totalCaptures} captures from {timeline.firstCapture?.getFullYear()} - {timeline.lastCapture?.getFullYear()}
            </div>
          </div>
          <div className="space-y-3">
            {timeline.timeline.map((entry) => (
              <div key={entry.year} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-white">{entry.year}</span>
                  <span className="text-sm text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded">
                    {entry.count} captures
                  </span>
                </div>
                {entry.snapshots.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {entry.snapshots.slice(0, 12).map((snap, i) => (
                      <a
                        key={i}
                        href={snap.snapshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 rounded transition-colors"
                        title={new Date(snap.timestamp).toLocaleString()}
                      >
                        {new Date(snap.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </a>
                    ))}
                    {entry.snapshots.length > 12 && (
                      <span className="px-2 py-1 text-xs text-gray-500">+{entry.snapshots.length - 12} more</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderCompareTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Older URL</label>
          <input
            type="text"
            value={olderUrl}
            onChange={(e) => setOlderUrl(e.target.value)}
            placeholder="https://example.com (older version)"
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Newer URL</label>
          <input
            type="text"
            value={newerUrl}
            onChange={(e) => setNewerUrl(e.target.value)}
            placeholder="https://example.com (newer version)"
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>
      <button
        onClick={handleCompare}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4 mr-2" />}
        Compare Versions
      </button>

      {comparison && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">Older Version</div>
              <div className="text-white font-semibold">{new Date(comparison.older.timestamp).toLocaleDateString()}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">Newer Version</div>
              <div className="text-white font-semibold">{new Date(comparison.newer.timestamp).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Content Growth</div>
            <div className="text-2xl font-bold text-blue-400">
              {comparison.contentGrowth > 0 ? '+' : ''}{comparison.contentGrowth}%
            </div>
          </div>

          {comparison.addedSections.length > 0 && (
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
              <div className="text-sm text-green-400 font-semibold mb-2">Added Sections</div>
              <ul className="space-y-1">
                {comparison.addedSections.map((section, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start">
                    <ChevronRight className="w-3 h-3 mr-1 mt-1 text-green-400 flex-shrink-0" />
                    {section}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {comparison.removedSections.length > 0 && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <div className="text-sm text-red-400 font-semibold mb-2">Removed Sections</div>
              <ul className="space-y-1">
                {comparison.removedSections.map((section, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start">
                    <ChevronRight className="w-3 h-3 mr-1 mt-1 text-red-400 flex-shrink-0" />
                    {section}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderSeoTab = () => (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL for historical SEO analysis"
          className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
          onKeyDown={(e) => e.key === 'Enter' && handleSeoAnalysis()}
        />
        <button
          onClick={handleSeoAnalysis}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}
          Analyze SEO
        </button>
      </div>

      {seoAnalysis && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">Freshness Score</div>
              <div className="text-2xl font-bold text-blue-400">{seoAnalysis.contentFreshnessScore}/100</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">Publishing Trend</div>
              <div className="text-lg font-bold text-purple-400 capitalize">{seoAnalysis.publishingTrend}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">Avg Word Count</div>
              <div className="text-2xl font-bold text-green-400">
                {seoAnalysis.historicalWordCount.length > 0
                  ? Math.round(seoAnalysis.historicalWordCount.reduce((a, b) => a + b, 0) / seoAnalysis.historicalWordCount.length)
                  : 0}
              </div>
            </div>
          </div>

          {seoAnalysis.recommendations.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400 font-semibold mb-2">Recommendations</div>
              <ul className="space-y-2">
                {seoAnalysis.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start">
                    <TrendingUp className="w-3 h-3 mr-2 mt-1 text-blue-400 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderRecoverTab = () => (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter deleted URL to recover content"
          className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
          onKeyDown={(e) => e.key === 'Enter' && handleRecoverContent()}
        />
        <button
          onClick={handleRecoverContent}
          disabled={loading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
          Recover
        </button>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={handleBacklinkRecovery}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center transition-colors disabled:opacity-50 text-sm"
        >
          <LinkIcon className="w-4 h-4 mr-2" /> Backlink Recovery
        </button>
      </div>

      {extractedContent && (
        <div className="mt-4">
          {extractedContent.fetchStatus === 'success' ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-green-400 font-semibold flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" /> Content Recovered
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(extractedContent.timestamp).toLocaleDateString()}
                </span>
              </div>
              {extractedContent.title && (
                <div className="text-white font-bold text-lg mb-2">{extractedContent.title}</div>
              )}
              <div className="text-gray-300 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                {extractedContent.content}
              </div>
            </div>
          ) : (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <div className="text-red-400 font-semibold flex items-center">
                <XCircle className="w-4 h-4 mr-2" /> Extraction Failed
              </div>
              <p className="text-gray-400 text-sm mt-2">{extractedContent.errorMessage}</p>
            </div>
          )}
        </div>
      )}

      {backlinkRecovery && (
        <div className="mt-4 bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 font-semibold mb-2">Backlink Recovery Recommendation</div>
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="text-gray-400 text-sm w-32">Recommendation:</span>
              <span className={`text-sm font-semibold capitalize ${
                backlinkRecovery.recommendation === 'restore' ? 'text-green-400' :
                backlinkRecovery.recommendation === 'merge' ? 'text-blue-400' :
                backlinkRecovery.recommendation === 'redirect' ? 'text-yellow-400' :
                'text-purple-400'
              }`}>
                {backlinkRecovery.recommendation}
              </span>
            </div>
            <div className="flex items-start">
              <span className="text-gray-400 text-sm w-32 flex-shrink-0">Reason:</span>
              <span className="text-gray-300 text-sm">{backlinkRecovery.reason}</span>
            </div>
            {backlinkRecovery.topic && (
              <div className="flex items-start">
                <span className="text-gray-400 text-sm w-32 flex-shrink-0">Topic:</span>
                <span className="text-gray-300 text-sm">{backlinkRecovery.topic}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderDomainTab = () => (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter expired domain (e.g. example.com)"
          className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
          onKeyDown={(e) => e.key === 'Enter' && handleDomainAnalysis()}
        />
        <button
          onClick={handleDomainAnalysis}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
          Analyze Domain
        </button>
      </div>

      {domainAnalysis && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">Total Captures</div>
              <div className="text-xl font-bold text-blue-400">{domainAnalysis.totalCaptures}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">Content Quality</div>
              <div className={`text-xl font-bold capitalize ${
                domainAnalysis.contentQuality === 'high' ? 'text-green-400' :
                domainAnalysis.contentQuality === 'medium' ? 'text-yellow-400' :
                domainAnalysis.contentQuality === 'low' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {domainAnalysis.contentQuality}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">Publishing</div>
              <div className="text-lg font-bold text-purple-400 capitalize">{domainAnalysis.publishingFrequency}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">First Capture</div>
              <div className="text-sm font-bold text-white">
                {domainAnalysis.firstCapture?.toLocaleDateString() || 'N/A'}
              </div>
            </div>
          </div>

          {domainAnalysis.spamIndicators.length > 0 && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <div className="text-sm text-red-400 font-semibold mb-2 flex items-center">
                <Shield className="w-4 h-4 mr-2" /> Spam Indicators
              </div>
              <ul className="space-y-1">
                {domainAnalysis.spamIndicators.map((indicator, i) => (
                  <li key={i} className="text-sm text-gray-300">{indicator}</li>
                ))}
              </ul>
            </div>
          )}

          {domainAnalysis.originalNiche && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400 font-semibold mb-1">Original Niche / Title</div>
              <div className="text-white text-sm">{domainAnalysis.originalNiche}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'status': return renderStatusTab();
      case 'timeline': return renderTimelineTab();
      case 'compare': return renderCompareTab();
      case 'seo': return renderSeoTab();
      case 'recover': return renderRecoverTab();
      case 'domain': return renderDomainTab();
      default: return null;
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="border-b border-gray-800 p-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Archive className="w-5 h-5 mr-2 text-blue-500" /> Wayback Explorer
        </h2>
        <p className="text-gray-400 text-sm mt-1">Historical content intelligence & archive recovery</p>
      </div>

      {error && (
        <div className="p-4 bg-red-900/30 border-b border-red-900 text-red-400 flex items-center text-sm">
          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex border-b border-gray-800 overflow-x-auto no-scrollbar">
        {[
          { id: 'status', label: 'Archive Status', icon: Search },
          { id: 'timeline', label: 'Timeline', icon: History },
          { id: 'compare', label: 'Compare', icon: GitCompare },
          { id: 'seo', label: 'SEO Analysis', icon: BarChart3 },
          { id: 'recover', label: 'Recover', icon: RotateCcw },
          { id: 'domain', label: 'Domain', icon: Globe },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id as Tab); setError(null); }}
            className={`flex items-center px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/10'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
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

export default WaybackExplorer;
