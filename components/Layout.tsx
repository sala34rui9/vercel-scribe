
import React, { useState, useEffect } from 'react';
import { PenTool, Layers, Key, X, Save, ShieldCheck, AlertCircle, Cpu, Zap, Search, Home } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onShowHome?: () => void;
  onShowArticles?: () => void;
  onShowEditor?: () => void;
  savedCount?: number;
}

export const Layout: React.FC<LayoutProps> = ({ children, onShowHome, onShowArticles, onShowEditor, savedCount = 0 }) => {
  const [showKeyModal, setShowKeyModal] = useState(false);
  
  const [geminiKey, setGeminiKey] = useState('');
  const [deepSeekKey, setDeepSeekKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');
  
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [hasDeepSeekKey, setHasDeepSeekKey] = useState(false);
  const [hasTavilyKey, setHasTavilyKey] = useState(false);
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    // Check for existing keys on mount
    const gKey = localStorage.getItem('user_gemini_api_key');
    if (gKey) {
      setHasGeminiKey(true);
      setGeminiKey(gKey);
    }
    
    const dKey = localStorage.getItem('user_deepseek_api_key');
    if (dKey) {
      setHasDeepSeekKey(true);
      setDeepSeekKey(dKey);
    }
    
    const tKey = localStorage.getItem('user_tavily_api_key');
    if (tKey) {
      setHasTavilyKey(true);
      setTavilyKey(tKey);
    }
  }, []);

  const handleSaveKeys = () => {
    let saved = false;
    
    if (geminiKey.trim()) {
      localStorage.setItem('user_gemini_api_key', geminiKey.trim());
      setHasGeminiKey(true);
      saved = true;
    }
    
    if (deepSeekKey.trim()) {
      localStorage.setItem('user_deepseek_api_key', deepSeekKey.trim());
      setHasDeepSeekKey(true);
      saved = true;
    }
    
    if (tavilyKey.trim()) {
      localStorage.setItem('user_tavily_api_key', tavilyKey.trim());
      setHasTavilyKey(true);
      saved = true;
    }

    if (saved) {
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
        setShowKeyModal(false);
      }, 1500);
    }
  };

  const clearGemini = () => {
    localStorage.removeItem('user_gemini_api_key');
    setGeminiKey('');
    setHasGeminiKey(false);
  };

  const clearDeepSeek = () => {
    localStorage.removeItem('user_deepseek_api_key');
    setDeepSeekKey('');
    setHasDeepSeekKey(false);
  };

  const clearTavily = () => {
    localStorage.removeItem('user_tavily_api_key');
    setTavilyKey('');
    setHasTavilyKey(false);
  };

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
             <div className="flex items-center space-x-2">
                {hasGeminiKey && (
                  <span className="text-xs font-medium px-2 py-1 rounded border flex items-center bg-blue-50 text-blue-700 border-blue-200">
                    <Zap className="w-3 h-3 mr-1"/> Gemini Ready
                  </span>
                )}
                {hasDeepSeekKey && (
                  <span className="text-xs font-medium px-2 py-1 rounded border flex items-center bg-indigo-50 text-indigo-700 border-indigo-200">
                    <Cpu className="w-3 h-3 mr-1"/> DeepSeek Ready
                  </span>
                )}
                {hasTavilyKey && (
                  <span className="text-xs font-medium px-2 py-1 rounded border flex items-center bg-emerald-50 text-emerald-700 border-emerald-200">
                    <Search className="w-3 h-3 mr-1"/> Tavily Ready
                  </span>
                )}
             </div>
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
            
            <button 
              onClick={() => setShowKeyModal(true)}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors relative"
              title="Manage API Keys"
            >
              <Key className="w-5 h-5" />
              {(hasGeminiKey || hasDeepSeekKey || hasTavilyKey) && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full border border-white"></span>} 
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Layers className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 text-center text-xs text-slate-500">
          Powered by Google Gemini, DeepSeek AI & Tavily Search
        </div>
      </footer>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                 <h3 className="text-lg font-bold text-slate-800 flex items-center">
                   <Key className="w-5 h-5 mr-2 text-blue-600" />
                   API Provider Settings
                 </h3>
                 <button 
                   onClick={() => setShowKeyModal(false)}
                   className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                 >
                   <X className="w-5 h-5 text-slate-500" />
                 </button>
              </div>
              
              <div className="p-6 space-y-6">
                 <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 shrink-0" />
                    <p className="text-sm text-blue-700">
                      Keys are stored locally in your browser. Add keys for the providers you wish to use.
                    </p>
                 </div>

                 {/* Gemini Section */}
                 <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-slate-700">
                      <Zap className="w-4 h-4 mr-1.5 text-blue-500" />
                      Google Gemini API Key
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                      />
                      {hasGeminiKey && (
                        <button onClick={clearGemini} className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200">Clear</button>
                      )}
                    </div>
                 </div>

                 {/* DeepSeek Section */}
                 <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center text-sm font-semibold text-slate-700">
                      <Cpu className="w-4 h-4 mr-1.5 text-indigo-500" />
                      DeepSeek API Key
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        value={deepSeekKey}
                        onChange={(e) => setDeepSeekKey(e.target.value)}
                        placeholder="sk-..."
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm font-mono"
                      />
                       {hasDeepSeekKey && (
                        <button onClick={clearDeepSeek} className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200">Clear</button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">Required for DeepSeek-V3.2 & Speciale models</p>
                 </div>

                 {/* Tavily Section */}
                 <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center text-sm font-semibold text-slate-700">
                      <Search className="w-4 h-4 mr-1.5 text-emerald-500" />
                      Tavily API Key
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        value={tavilyKey}
                        onChange={(e) => setTavilyKey(e.target.value)}
                        placeholder="tvly-..."
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-mono"
                      />
                       {hasTavilyKey && (
                        <button onClick={clearTavily} className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200">Clear</button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">Required for web research and real-time data</p>
                 </div>


                 <div className="flex justify-end pt-4">
                    <button
                      onClick={handleSaveKeys}
                      className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                          Save Settings
                        </>
                      )}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
