
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { GeneratedArticle } from '../types';
import { Copy, RefreshCw, CheckCircle, ExternalLink, Microscope, Code, ChevronRight, FileText, XCircle } from 'lucide-react';
import { marked } from 'marked';

interface ArticlePreviewProps {
  articles: GeneratedArticle[]; // Now accepts an array
  onReset: () => void;
}

export const ArticlePreview: React.FC<ArticlePreviewProps> = ({ articles, onReset }) => {
  const [selectedArticleId, setSelectedArticleId] = useState<string>(articles[0]?.id || '');
  const [copied, setCopied] = React.useState(false);
  const [htmlCopied, setHtmlCopied] = React.useState(false);
  
  // HTML Preview Modal State
  const [showHtmlPreview, setShowHtmlPreview] = React.useState(false);
  const [htmlContent, setHtmlContent] = React.useState('');

  const activeArticle = articles.find(a => a.id === selectedArticleId) || articles[0];

  useEffect(() => {
    // If list changes (e.g. bulk generation adding items), ensure we have a selection
    if (!selectedArticleId && articles.length > 0) {
      setSelectedArticleId(articles[0].id);
    }
  }, [articles, selectedArticleId]);

  const handleCopy = () => {
    if (!activeArticle) return;
    navigator.clipboard.writeText(activeArticle.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHtml = async () => {
    if (!activeArticle) return;
    try {
      const html = await marked.parse(activeArticle.content);
      setHtmlContent(html as string);
      setShowHtmlPreview(true);
    } catch (e) {
      console.error("Failed to parse markdown to HTML", e);
    }
  };

  const handleModalCopy = () => {
    navigator.clipboard.writeText(htmlContent);
    setHtmlCopied(true);
    setTimeout(() => setHtmlCopied(false), 2000);
  };

  const isBulkMode = articles.length > 1;

  return (
    <div className="flex h-full">
      {/* Sidebar for Bulk Mode */}
      {isBulkMode && (
        <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col h-full overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-200 bg-white">
             <h3 className="text-sm font-semibold text-slate-800">Generated Articles ({articles.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {articles.map((article, idx) => (
              <button
                key={article.id}
                onClick={() => setSelectedArticleId(article.id)}
                className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${
                  selectedArticleId === article.id
                    ? 'bg-white border-blue-300 shadow-sm ring-1 ring-blue-200'
                    : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-start">
                   <span className="text-xs font-mono text-slate-400 mr-2 mt-0.5">#{idx + 1}</span>
                   <div className="flex-1 min-w-0">
                     <p className={`font-medium truncate ${selectedArticleId === article.id ? 'text-blue-700' : 'text-slate-700'}`}>
                       {article.title}
                     </p>
                     <p className="text-xs text-slate-400 mt-1 flex items-center">
                       {article.status === 'failed' ? (
                         <span className="text-red-500 flex items-center"><XCircle className="w-3 h-3 mr-1"/> Failed</span>
                       ) : (
                         <span className="text-green-600 flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Completed</span>
                       )}
                     </p>
                   </div>
                   {selectedArticleId === article.id && <ChevronRight className="w-4 h-4 text-blue-500 mt-1" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Preview Mode</span>
            {activeArticle && (
               <>
                <span className="text-slate-300">|</span>
                <span className="text-xs text-slate-500 truncate max-w-[200px]" title={activeArticle.title}>
                  {activeArticle.title}
                </span>
               </>
            )}
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleCopyHtml}
              className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-white text-slate-700 border border-slate-200 hover:bg-slate-50`}
              title="View & Copy HTML"
            >
              <Code className="w-4 h-4 mr-1.5" />
              Copy HTML
            </button>
            <button
              onClick={handleCopy}
              className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                copied 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copy Markdown
                </>
              )}
            </button>
            <button
              onClick={onReset}
              className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Start Over
            </button>
          </div>
        </div>

        {/* Article Body */}
        <div className="flex-1 overflow-y-auto p-8 bg-white">
          <div className="max-w-3xl mx-auto">
            {activeArticle ? (
              <>
                 <ReactMarkdown
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-4xl font-extrabold text-slate-900 mb-6 mt-4 leading-tight border-b pb-4" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-2xl font-bold text-slate-800 mt-10 mb-4 leading-snug" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-xl font-bold text-slate-800 mt-6 mb-3" {...props} />,
                    p: ({node, ...props}) => <p className="mb-4 text-slate-600 leading-7" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 text-slate-600 space-y-2" {...props} />,
                    li: ({node, ...props}) => <li className="pl-1" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-6 bg-slate-50 italic text-slate-700 rounded-r" {...props} />,
                    a: ({node, ...props}) => <a className="text-blue-600 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-500 underline-offset-2 transition-all" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-slate-900" {...props} />,
                    code: ({node, ...props}) => <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
                  }}
                >
                  {activeArticle.content}
                </ReactMarkdown>

                {/* Sources Section */}
                {activeArticle.sources && activeArticle.sources.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-slate-200">
                    <div className="flex items-center text-slate-800 mb-4">
                      <Microscope className="w-5 h-5 mr-2 text-indigo-600" />
                      <h3 className="text-lg font-bold">Deep Research Sources</h3>
                    </div>
                    <ul className="grid grid-cols-1 gap-2">
                      {activeArticle.sources.map((source, index) => (
                        <li key={index}>
                          <a 
                            href={source} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-300 transition-all group"
                          >
                            <ExternalLink className="w-4 h-4 text-slate-400 mr-3 group-hover:text-blue-500" />
                            <span className="text-sm text-slate-600 truncate flex-1 font-medium">{source}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
               <div className="text-center py-20 text-slate-400">
                 <FileText className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                 <p>Select an article from the list to preview content.</p>
               </div>
            )}
          </div>
        </div>
      </div>

       {/* HTML Preview Modal */}
       {showHtmlPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <Code className="w-5 h-5 mr-2 text-blue-600" />
                HTML Source Code
              </h3>
              <button 
                onClick={() => setShowHtmlPreview(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden relative">
              <textarea
                readOnly
                value={htmlContent}
                className="w-full h-full p-6 font-mono text-sm bg-slate-50 text-slate-700 resize-none outline-none focus:bg-white transition-colors"
              />
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
               <button
                  onClick={handleModalCopy}
                  className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                    htmlCopied 
                      ? 'bg-green-600 text-white shadow-green-200' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                  } shadow-lg`}
                >
                  {htmlCopied ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Copied to Clipboard
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy HTML Code
                    </>
                  )}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
