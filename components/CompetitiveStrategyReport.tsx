/**
 * Competitive Strategy Report Component
 * Displays the "Better Than Competitors" analysis
 * Features interactive outline builder with regeneration
 */

import React, { useState } from 'react';
import {
  BarChart3, CheckSquare, Square, RefreshCw, ChevronDown, ChevronUp,
  Zap, Eye, AlertTriangle, Hash, MessageSquare, Award,
  Plus, X, ArrowRight, Layers, TrendingUp, BookOpen
} from 'lucide-react';
import {
  CompetitiveStrategyReport,
  CompetitiveAdvantage,
  OutlineOption,
  generateAllOutlineOptions,
} from '../services/competitiveStrategyService';
import { FetchedPage } from '../types';

interface CompetitiveReportProps {
  report: CompetitiveStrategyReport;
  onReportUpdate: (report: CompetitiveStrategyReport) => void;
  onProceedToGenerate: (report: CompetitiveStrategyReport) => void;
  fetchedPages: FetchedPage[];
  topic: string;
}

export const CompetitiveStrategyReportComponent: React.FC<CompetitiveReportProps> = ({
  report,
  onReportUpdate,
  onProceedToGenerate,
  fetchedPages,
  topic,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'outline', 'advantages'])
  );
  const [regeneratingOption, setRegeneratingOption] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isExpanded = (id: string) => expandedSections.has(id);

  // ---- Outline Selection ----
  const selectOutlineOption = (index: number) => {
    const option = report.outlineOptions[index];
    if (!option) return;
    onReportUpdate({
      ...report,
      selectedOutlineIndex: index,
      selectedH2s: new Set(option.h2s),
      selectedH3s: new Set(option.h3s),
    });
  };

  const toggleH2 = (h2: string) => {
    const newH2s = new Set(report.selectedH2s);
    if (newH2s.has(h2)) newH2s.delete(h2);
    else newH2s.add(h2);
    onReportUpdate({ ...report, selectedH2s: newH2s });
  };

  const toggleH3 = (h3: string) => {
    const newH3s = new Set(report.selectedH3s);
    if (newH3s.has(h3)) newH3s.delete(h3);
    else newH3s.add(h3);
    onReportUpdate({ ...report, selectedH3s: newH3s });
  };

  const regenerateOutline = async (optionIndex: number) => {
    setRegeneratingOption(report.outlineOptions[optionIndex].id);
    try {
      const newOptions = await generateAllOutlineOptions(
        fetchedPages.filter(p => p.fetchStatus === 'success'),
        topic,
      );
      // Replace only the selected option, keep others
      const updatedOptions = [...report.outlineOptions];
      if (newOptions[optionIndex]) {
        updatedOptions[optionIndex] = newOptions[optionIndex];
      }
      onReportUpdate({ ...report, outlineOptions: updatedOptions });
    } catch (e) {
      console.error('Failed to regenerate outline:', e);
    } finally {
      setRegeneratingOption(null);
    }
  };

  // ---- FAQ & Stats Toggles ----
  const toggleFaq = (index: number) => {
    const newFaqs = [...report.faqs];
    newFaqs[index] = { ...newFaqs[index], enabled: !newFaqs[index].enabled };
    onReportUpdate({ ...report, faqs: newFaqs });
  };

  const toggleStat = (index: number) => {
    const newStats = [...report.statistics];
    newStats[index] = { ...newStats[index], enabled: !newStats[index].enabled };
    onReportUpdate({ ...report, statistics: newStats });
  };

  const selectedOutline = report.outlineOptions[report.selectedOutlineIndex];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          Generate Better Than Competitors
        </h2>
        <p className="text-indigo-100 mt-1 text-sm">
          AI-powered competitive strategy for: "{topic}"
        </p>
        <div className="flex items-center gap-4 mt-3">
          <span className="text-xs bg-white/20 px-2 py-1 rounded">
            {fetchedPages.filter(p => p.fetchStatus === 'success').length} pages analyzed
          </span>
          <span className="text-xs bg-white/20 px-2 py-1 rounded">
            {report.competitiveAdvantages.length} advantages identified
          </span>
        </div>
      </div>

      {/* Section 1: SERP Overview */}
      <CollapsibleSection
        id="overview"
        title="SERP Overview"
        icon={<BarChart3 className="w-4 h-4" />}
        isExpanded={isExpanded('overview')}
        onToggle={() => toggleSection('overview')}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Avg Words" value={report.overview.averageWordCount.toLocaleString()} />
          <StatCard label="Avg Reading Time" value={`${report.overview.averageReadingTime} min`} />
          <StatCard label="Avg H2s" value={report.overview.averageH2Count.toString()} />
          <StatCard label="Avg H3s" value={report.overview.averageH3Count.toString()} />
          <StatCard label="Avg Tables" value={report.overview.averageTableCount.toString()} />
          <StatCard label="Avg Bullet Lists" value={report.overview.averageBulletListCount.toString()} />
          <StatCard label="Avg Images" value={report.overview.averageImageCount.toString()} />
          <StatCard label="Avg Ext Links" value={report.overview.averageExternalLinks.toString()} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
          <div>
            <span className="font-medium">Shortest:</span>{' '}
            {report.overview.shortestArticle.wordCount.toLocaleString()} words
          </div>
          <div>
            <span className="font-medium">Longest:</span>{' '}
            {report.overview.longestArticle.wordCount.toLocaleString()} words
          </div>
          <div>
            <span className="font-medium">Newest:</span>{' '}
            {report.overview.newestArticle.date || 'N/A'}
          </div>
          <div>
            <span className="font-medium">Avg Age:</span>{' '}
            {report.overview.averageFreshnessDays} days
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 2: What Every Competitor Covers */}
      <CollapsibleSection
        id="common"
        title="What Every Competitor Covers"
        icon={<Eye className="w-4 h-4" />}
        isExpanded={isExpanded('common')}
        onToggle={() => toggleSection('common')}
      >
        <p className="text-xs text-slate-500 mb-2">These topics are REQUIRED — every top page covers them.</p>
        <div className="flex flex-wrap gap-2">
          {report.commonTopics.map((topic, i) => (
            <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
              ✓ {topic}
            </span>
          ))}
          {report.commonTopics.length === 0 && (
            <span className="text-sm text-slate-500">No universal topics identified</span>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 3: Opportunity Topics */}
      <CollapsibleSection
        id="opportunities"
        title="What Only Some Competitors Cover"
        icon={<Layers className="w-4 h-4" />}
        isExpanded={isExpanded('opportunities')}
        onToggle={() => toggleSection('opportunities')}
      >
        <p className="text-xs text-slate-500 mb-2">These represent OPPORTUNITIES — only a few pages cover them.</p>
        <div className="flex flex-wrap gap-2">
          {report.opportunityTopics.map((topic, i) => (
            <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200">
              {topic}
            </span>
          ))}
          {report.opportunityTopics.length === 0 && (
            <span className="text-sm text-slate-500">No opportunity topics identified</span>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 4: Missing Opportunities */}
      <CollapsibleSection
        id="missing"
        title="Missing Opportunities (No Competitor Covers)"
        icon={<AlertTriangle className="w-4 h-4" />}
        isExpanded={isExpanded('missing')}
        onToggle={() => toggleSection('missing')}
      >
        <p className="text-xs text-slate-500 mb-2">Topics NONE of the competitors discuss — your chance to stand out.</p>
        <div className="space-y-2">
          {report.missingOpportunities.map((topic, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
              <Plus className="w-3 h-3 text-red-500" />
              <span className="text-sm text-red-800">{topic}</span>
            </div>
          ))}
          {report.missingOpportunities.length === 0 && (
            <span className="text-sm text-slate-500">No specific gaps identified</span>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 5: Weaknesses */}
      <CollapsibleSection
        id="weaknesses"
        title="Competitor Weaknesses"
        icon={<AlertTriangle className="w-4 h-4" />}
        isExpanded={isExpanded('weaknesses')}
        onToggle={() => toggleSection('weaknesses')}
      >
        <div className="space-y-2">
          {report.weaknesses.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <X className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
          {report.weaknesses.length === 0 && (
            <span className="text-sm text-slate-500">No weaknesses identified</span>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 6: Outline Builder (KEY FEATURE) */}
      <CollapsibleSection
        id="outline"
        title="Outline Recommendation"
        icon={<BookOpen className="w-4 h-4" />}
        isExpanded={isExpanded('outline')}
        onToggle={() => toggleSection('outline')}
      >
        <div className="space-y-4">
          {/* Outline Option Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Choose an Outline Strategy</label>
            <div className="grid grid-cols-3 gap-2">
              {report.outlineOptions.map((option, i) => (
                <button
                  key={option.id}
                  onClick={() => selectOutlineOption(i)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    report.selectedOutlineIndex === i
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-800">{option.label}</div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {option.h2s.length} H2s, {option.h3s.length} H3s
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Outline with Toggles */}
          {selectedOutline && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                <span className="text-sm font-medium text-slate-700">
                  {selectedOutline.label}
                </span>
                <button
                  onClick={() => regenerateOutline(report.selectedOutlineIndex)}
                  disabled={regeneratingOption === selectedOutline.id}
                  className="text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${regeneratingOption === selectedOutline.id ? 'animate-spin' : ''}`} />
                  {regeneratingOption === selectedOutline.id ? 'Regenerating...' : 'Regenerate'}
                </button>
              </div>

              <div className="p-4 space-y-2">
                {selectedOutline.h2s.map((h2, i) => (
                  <div key={i}>
                    {/* H2 Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <button
                        onClick={() => toggleH2(h2)}
                        className="flex-shrink-0"
                      >
                        {report.selectedH2s.has(h2) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                        )}
                      </button>
                      <span className={`text-sm font-semibold ${
                        report.selectedH2s.has(h2) ? 'text-slate-800' : 'text-slate-400 line-through'
                      }`}>
                        {i + 1}. {h2}
                      </span>
                    </label>

                    {/* H3 Toggles for this H2 */}
                    {report.selectedH2s.has(h2) && (
                      <div className="ml-6 mt-1 space-y-1">
                        {selectedOutline.h3s
                          .slice(i * 3, (i + 1) * 3)
                          .map((h3, j) => (
                            <label key={j} className="flex items-center gap-2 cursor-pointer group">
                              <button onClick={() => toggleH3(h3)} className="flex-shrink-0">
                                {report.selectedH3s.has(h3) ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                                )}
                              </button>
                              <span className={`text-xs ${
                                report.selectedH3s.has(h3) ? 'text-slate-700' : 'text-slate-400 line-through'
                              }`}>
                                {h3}
                              </span>
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* CTA Recommendation */}
              {selectedOutline.recommendedCTA && (
                <div className="px-4 py-3 bg-indigo-50 border-t border-indigo-200">
                  <span className="text-xs font-semibold text-indigo-700">Recommended CTA: </span>
                  <span className="text-xs text-indigo-600">{selectedOutline.recommendedCTA}</span>
                </div>
              )}
            </div>
          )}

          {/* Selected count summary */}
          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span>{report.selectedH2s.size} H2s selected</span>
            <span>•</span>
            <span>{report.selectedH3s.size} H3s selected</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 7: FAQ Recommendation */}
      <CollapsibleSection
        id="faqs"
        title="FAQ Recommendation"
        icon={<MessageSquare className="w-4 h-4" />}
        isExpanded={isExpanded('faqs')}
        onToggle={() => toggleSection('faqs')}
      >
        <div className="space-y-2">
          {report.faqs.map((faq, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer group">
              <button onClick={() => toggleFaq(i)} className="flex-shrink-0">
                {faq.enabled ? (
                  <CheckSquare className="w-4 h-4 text-violet-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                )}
              </button>
              <span className={`text-sm ${faq.enabled ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                {faq.question}
              </span>
              <span className="text-[10px] text-slate-400 ml-auto">({faq.frequency}x)</span>
            </label>
          ))}
          {report.faqs.length === 0 && (
            <span className="text-sm text-slate-500">No FAQs extracted</span>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 8: Statistics */}
      <CollapsibleSection
        id="stats"
        title="Key Statistics"
        icon={<Hash className="w-4 h-4" />}
        isExpanded={isExpanded('stats')}
        onToggle={() => toggleSection('stats')}
      >
        <div className="space-y-2">
          {report.statistics.map((stat, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer group">
              <button onClick={() => toggleStat(i)} className="flex-shrink-0">
                {stat.enabled ? (
                  <CheckSquare className="w-4 h-4 text-amber-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                )}
              </button>
              <span className={`text-sm ${stat.enabled ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                <strong>{stat.value}</strong> — {stat.context}
              </span>
            </label>
          ))}
          {report.statistics.length === 0 && (
            <span className="text-sm text-slate-500">No statistics extracted</span>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 9: Competitive Advantages */}
      <CollapsibleSection
        id="advantages"
        title="Competitive Advantage Summary"
        icon={<Award className="w-4 h-4" />}
        isExpanded={isExpanded('advantages')}
        onToggle={() => toggleSection('advantages')}
      >
        <p className="text-xs text-slate-500 mb-3">Top actions most likely to make your article more valuable than competitors.</p>
        <div className="space-y-2">
          {report.competitiveAdvantages.map((adv, i) => (
            <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-sm font-bold text-slate-400 w-6 text-center">{adv.rank}</span>
              <div className="flex-1">
                <span className="text-sm text-slate-800">{adv.action}</span>
                <div className="flex items-center gap-2 mt-1">
                  <ImpactBadge impact={adv.impact} />
                  <EffortBadge effort={adv.effort} />
                </div>
              </div>
            </div>
          ))}
          {report.competitiveAdvantages.length === 0 && (
            <span className="text-sm text-slate-500">No advantages identified</span>
          )}
        </div>
      </CollapsibleSection>

      {/* Proceed Button */}
      <div className="pt-4 border-t border-slate-200">
        <button
          onClick={() => onProceedToGenerate(report)}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 flex items-center justify-center gap-2 transition-all shadow-lg"
        >
          <Zap className="w-5 h-5" />
          Generate Article with Competitive Strategy
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ---- Sub-components ----

const CollapsibleSection: React.FC<{
  id: string;
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon, isExpanded, onToggle, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
    >
      <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
        {icon}
        {title}
      </span>
      {isExpanded ? (
        <ChevronUp className="w-4 h-4 text-slate-500" />
      ) : (
        <ChevronDown className="w-4 h-4 text-slate-500" />
      )}
    </button>
    {isExpanded && <div className="p-4">{children}</div>}
  </div>
);

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
    <div className="text-lg font-bold text-slate-800">{value}</div>
    <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
  </div>
);

const ImpactBadge: React.FC<{ impact: string }> = ({ impact }) => {
  const colors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[impact as keyof typeof colors] || colors.medium}`}>
      {impact} impact
    </span>
  );
};

const EffortBadge: React.FC<{ effort: string }> = ({ effort }) => {
  const colors = {
    high: 'bg-slate-200 text-slate-700',
    medium: 'bg-slate-100 text-slate-600',
    low: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[effort as keyof typeof colors] || colors.medium}`}>
      {effort} effort
    </span>
  );
};

export default CompetitiveStrategyReportComponent;
