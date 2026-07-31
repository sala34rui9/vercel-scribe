import React, { useState } from 'react';
import { Database, Key, FlaskConical } from 'lucide-react';
import { ApiKeysManagement } from './ApiKeysManagement';
import { AdminUsageContent } from './AdminUsageContent';
import { ApiTestPanel } from './ApiTestPanel';

type AdminTab = 'usage' | 'keys' | 'test';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('usage');

  return (
    <div className="flex h-full gap-0">
      {/* Sub-nav sidebar */}
      <div className="w-48 shrink-0 border-r border-slate-200 bg-slate-50 py-4">
        <nav className="flex flex-col space-y-1 px-3">
          <button
            onClick={() => setActiveTab('usage')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'usage'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Database className="w-4 h-4" />
            Usage
          </button>
          <button
            onClick={() => setActiveTab('keys')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'keys'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Key className="w-4 h-4" />
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'test'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            Test
          </button>
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'usage' && <AdminUsageContent />}
        {activeTab === 'keys' && <ApiKeysManagement />}
        {activeTab === 'test' && <ApiTestPanel />}
      </div>
    </div>
  );
};
