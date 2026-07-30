import React, { useState } from 'react';
import { PenTool, Layers, Home, FileText, Grid, Mic, Newspaper, MapPin, HelpCircle, ChevronLeft, ChevronRight, TrendingUp, Settings, Target, Archive } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onShowHome?: () => void;
  onShowArticles?: () => void;
  onShowEditor?: () => void;
  onShowSeo?: () => void;
  onShowSerp?: () => void;
  onShowAdmin?: () => void;
  onShowWayback?: () => void;
  savedCount?: number;
}

export const Layout: React.FC<LayoutProps> = ({ children, onShowHome, onShowArticles, onShowEditor, onShowSeo, onShowSerp, onShowAdmin, onShowWayback, savedCount = 0 }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors" onClick={onShowHome} title="Go to Home">
              <PenTool className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight cursor-pointer hover:text-blue-600 transition-colors" onClick={onShowHome} title="Go to Home">SEO Scribe</h1>
          </div>
          <div className="flex items-center space-x-4">
            {onShowHome && (
              <button
                onClick={onShowHome}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Go to Home"
              >
                <Home className="w-5 h-5" />
              </button>
            )}
            {savedCount > 0 && onShowArticles && (
              <button
                onClick={onShowArticles}
                className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-full hover:bg-green-100 transition-colors"
                title="View saved articles"
              >
                {savedCount} Saved
              </button>
            )}
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Layers className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex-1 flex">
        {/* Left Sidebar (desktop) */}
        <aside className={`flex flex-col ${sidebarCollapsed ? 'items-center w-20' : 'items-start w-56'} py-6 space-y-4 bg-white border-r border-slate-100 px-3 transition-all duration-200`}>
          <div className={`mb-2 w-full ${sidebarCollapsed ? 'flex justify-center' : 'flex items-center gap-3'}`}>
            <div className="bg-blue-600 p-2 rounded-lg">
              <PenTool className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h2 className="text-sm font-semibold text-slate-800">SEO Scribe</h2>
                <p className="text-xs text-slate-400">Write & Research</p>
              </div>
            )}
          </div>

          <nav className="flex flex-col items-start space-y-2 mt-4 w-full">
            <button onClick={onShowEditor} title="Builder" className="flex items-center gap-3 w-full text-slate-600 hover:text-blue-600 transition-colors rounded-md px-2 py-2">
              <Grid className="w-5 h-5" />
              <span className={`${sidebarCollapsed ? 'hidden' : 'text-sm'}`}>Builder</span>
            </button>

            <button onClick={onShowArticles} title="Docs" className="flex items-center gap-3 w-full text-slate-600 hover:text-blue-600 transition-colors rounded-md px-2 py-2 relative">
              <FileText className="w-5 h-5" />
              <span className={`${sidebarCollapsed ? 'hidden' : 'text-sm'}`}>Docs</span>
              {savedCount && savedCount > 0 && !sidebarCollapsed && <span className="ml-auto text-[11px] px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-100">{savedCount}</span>}
            </button>

            <button onClick={onShowSeo} title="SEO" className="flex items-center gap-3 w-full text-slate-600 hover:text-blue-600 transition-colors rounded-md px-2 py-2">
              <Target className="w-5 h-5" />
              <span className={`${sidebarCollapsed ? 'hidden' : 'text-sm'}`}>SEO</span>
            </button>
            <button onClick={onShowWayback} title="Wayback" className="flex items-center gap-3 w-full text-slate-600 hover:text-blue-600 transition-colors rounded-md px-2 py-2">
              <Archive className="w-5 h-5" />
              <span className={`${sidebarCollapsed ? 'hidden' : 'text-sm'}`}>Wayback</span>
            </button>

            <button onClick={onShowSerp} title="SERP Intel" className="flex items-center gap-3 w-full text-slate-600 hover:text-blue-600 transition-colors rounded-md px-2 py-2">
              <TrendingUp className="w-5 h-5" />
              <span className={`${sidebarCollapsed ? 'hidden' : 'text-sm'}`}>SERP Intel</span>
            </button>

            <button title="Voices" className="flex items-center gap-3 w-full text-slate-600 hover:text-blue-600 transition-colors rounded-md px-2 py-2">
              <Mic className="w-5 h-5" />
              <span className={`${sidebarCollapsed ? 'hidden' : 'text-sm'}`}>Voices</span>
            </button>

            <button title="News" className="flex items-center gap-3 w-full text-slate-600 hover:text-blue-600 transition-colors rounded-md px-2 py-2">
              <Newspaper className="w-5 h-5" />
              <span className={`${sidebarCollapsed ? 'hidden' : 'text-sm'}`}>News</span>
            </button>

            <button title="Roadmap" className="flex items-center gap-3 w-full text-slate-600 hover:text-blue-600 transition-colors rounded-md px-2 py-2">
              <MapPin className="w-5 h-5" />
              <span className={`${sidebarCollapsed ? 'hidden' : 'text-sm'}`}>Roadmap</span>
            </button>

            <button title="Help" className="flex items-center gap-3 w-full text-slate-600 hover:text-blue-600 transition-colors rounded-md px-2 py-2">
              <HelpCircle className="w-5 h-5" />
              <span className={`${sidebarCollapsed ? 'hidden' : 'text-sm'}`}>Help</span>
            </button>

            {onShowAdmin && (
              <button onClick={onShowAdmin} title="Admin" className="flex items-center gap-3 w-full text-slate-600 hover:text-blue-600 transition-colors rounded-md px-2 py-2 mt-4 pt-4 border-t border-slate-100">
                <Settings className="w-5 h-5" />
                <span className={`${sidebarCollapsed ? 'hidden' : 'text-sm'}`}>Admin</span>
              </button>
            )}
          </nav>

          <div className="mt-auto mb-4 w-full flex flex-col items-center">
            <div className="w-full flex items-center justify-center mb-3">
              <button onClick={() => setSidebarCollapsed((s) => !s)} title="Toggle sidebar" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
            </div>
            <div>
              <button onClick={onShowHome} title="Home" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                <Home className="w-5 h-5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 text-center text-xs text-slate-500">
          Powered by Google Gemini, DeepSeek AI & Tavily Search
        </div>
      </footer>
    </div>
  );
};




