import React, { useState, useEffect } from 'react';
import { listFetchUsage, getTinyFishFetchApiKey, FetchUsageResponse } from '../services/tinyfishFetchService';
import { Settings, RefreshCw, AlertCircle, Loader2, Database, Clock, Globe } from 'lucide-react';

export const AdminUsage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FetchUsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const apiKey = getTinyFishFetchApiKey();

  const loadUsage = async (pageNum: number) => {
    if (!apiKey) {
      setError('TinyFish Fetch API Key is missing. Please add it in Settings.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await listFetchUsage(pageNum, 50);
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to load usage data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey) {
      loadUsage(page);
    } else {
      setError('TinyFish Fetch API Key is missing. Please add it in Settings.');
    }
  }, [page, apiKey]);

  if (!apiKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
          <Settings className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-medium text-slate-600">Admin Dashboard requires API Key</h3>
        <p className="text-slate-400 max-w-sm mt-2">
          Please add your TinyFish Fetch API Key in the settings modal to view usage logs.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative p-6">
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            <Database className="w-6 h-6 mr-2 text-cyan-600" />
            Admin Usage Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1">TinyFish Fetch API Activity Logs</p>
        </div>
        <button
          onClick={() => loadUsage(page)}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-start">
          <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
              <div className="text-sm text-slate-500 font-medium mb-1">Total Requests</div>
              <div className="text-2xl font-bold text-slate-900">{data.total}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
              <div className="text-sm text-slate-500 font-medium mb-1">Current Page</div>
              <div className="text-2xl font-bold text-slate-900">{data.page} / {data.total_pages}</div>
            </div>
          </div>

          <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Purpose</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Latency</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                      No usage logs found.
                    </td>
                  </tr>
                ) : (
                  data.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-slate-400" />
                        {new Date(item.created_at || Date.now()).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 truncate max-w-xs">
                        <div className="flex items-center" title={item.url}>
                          <Globe className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                          <span className="truncate">{item.url}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {item.purpose || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right">
                        {item.latency_ms ? `${item.latency_ms} ms` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {data.page} of {data.total_pages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!data.has_more || loading}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};
