import React from 'react';
import { FileText, BarChart3, Rocket, Zap } from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: 'editor') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const features = [
    {
      id: 1,
      title: '1-Click Blog Post',
      description: 'Create the perfect article using only the title. Generate and publish it in 1 click.',
      label: 'Lightning-Fast',
      labelColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      iconColor: 'text-orange-500',
    },
    {
      id: 2,
      title: 'Bulk Article Generation',
      description: 'Bulk generate and auto-post up to 100 articles in a batch to WordPress in 1-click.',
      label: 'Power That Scares',
      labelColor: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-500',
    },
    {
      id: 3,
      title: 'Super Page',
      description: 'Clone SERP winners in seconds. Your CTA lands where conversions peak.',
      label: 'Conversion Rocket',
      labelColor: 'text-teal-500',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
      iconColor: 'text-teal-500',
    },
    {
      id: 4,
      title: 'Rewriter Tool',
      description: 'Rewrite with SERP data. Transform any text into ranking-ready content.',
      label: 'Rank-Ready Copy',
      labelColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-500',
      badge: 'New!',
      badgeColor: 'bg-blue-600',
    },
  ];

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 tracking-tight">Dashboard</h1>
          <p className="text-lg text-slate-600 max-w-2xl">Tools to help you create</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div
              key={feature.id}
              className={`${feature.bgColor} border-2 ${feature.borderColor} rounded-xl p-8 hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden relative`}
              onClick={() => onNavigate('editor')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${feature.bgColor} border border-current border-opacity-20`}>
                    <FileText className={`w-6 h-6 ${feature.iconColor}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${feature.labelColor} uppercase tracking-wider`}>{feature.label}</span>
                    {feature.badge && <span className={`${feature.badgeColor} text-white text-xs font-bold px-2 py-0.5 rounded`}>{feature.badge}</span>}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-slate-800 transition-colors">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm">{feature.description}</p>
                <div className="mt-6 flex items-center text-slate-700 group-hover:text-slate-900 font-medium text-sm">
                  <span>Get Started</span>
                  <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Articles Generated', value: '10K+', icon: BarChart3 },
            { label: 'Active Users', value: '5K+', icon: Rocket },
            { label: 'Avg Time Saved', value: '2 hours', icon: Zap },
          ].map((stat, idx) => {
            const StatIcon = stat.icon;
            return (
              <div key={idx} className="bg-white rounded-lg border border-slate-200 p-6 text-center hover:border-blue-300 hover:shadow-md transition-all">
                <div className="flex justify-center mb-3">
                  <StatIcon className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-slate-900 mb-2">{stat.value}</p>
                <p className="text-sm text-slate-600">{stat.label}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 sm:p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to transform your content creation?</h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">Start generating SEO-optimized articles in seconds with AI-powered writing assistance.</p>
          <button onClick={() => onNavigate('editor')} className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors inline-flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Start Creating Now
          </button>
        </div>
      </div>
    </div>
  );
};
