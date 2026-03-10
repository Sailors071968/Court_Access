// Phase 254-255 — API Registry Dashboard + AI Recommended APIs
// Route: /dashboard/api-registry

import { useState } from 'react';
import { Plug, Activity, AlertTriangle, CheckCircle, XCircle, Zap, Star } from 'lucide-react';
import { Card } from '../../components/common/Card';

interface ApiIntegration {
  name: string;
  status: 'active' | 'degraded' | 'offline';
  usageMetrics: string;
  errorRate: string;
  recommendationScore: number;
  description: string;
}

interface RecommendedApi {
  name: string;
  category: string;
  reasonRecommended: string;
  integrationDifficulty: 'Easy' | 'Medium' | 'Hard';
  potentialBenefit: string;
}

const CURRENT_APIS: ApiIntegration[] = [
  { name: 'OpenAI', status: 'active', usageMetrics: '12,450 calls/day', errorRate: '0.02%', recommendationScore: 95, description: 'AI text analysis, evidence summarization, legal research' },
  { name: 'AWS Textract', status: 'active', usageMetrics: '3,200 docs/day', errorRate: '0.1%', recommendationScore: 92, description: 'PDF OCR, document text extraction, form parsing' },
  { name: 'Stripe', status: 'active', usageMetrics: '890 txns/day', errorRate: '0.01%', recommendationScore: 98, description: 'Payment processing, subscription billing, invoicing' },
  { name: 'Cloudflare R2', status: 'active', usageMetrics: '45 GB/day', errorRate: '0.005%', recommendationScore: 96, description: 'Object storage for documents, evidence files, media' },
  { name: 'Redis', status: 'active', usageMetrics: '125K ops/sec', errorRate: '0.001%', recommendationScore: 97, description: 'Caching, session management, real-time queues' },
  { name: 'Neo4j', status: 'active', usageMetrics: '8,500 queries/hr', errorRate: '0.05%', recommendationScore: 88, description: 'Knowledge graph, evidence relationships, entity mapping' },
  { name: 'Apify', status: 'degraded', usageMetrics: '450 crawls/day', errorRate: '2.1%', recommendationScore: 72, description: 'Web scraping, policy document crawling, data collection' },
];

const RECOMMENDED_APIS: RecommendedApi[] = [
  { name: 'Mapbox', category: 'Geospatial', reasonRecommended: 'Visualize incident locations, evidence chain geography, court jurisdictions', integrationDifficulty: 'Easy', potentialBenefit: 'Interactive maps for case evidence locations and jurisdictional analysis' },
  { name: 'AssemblyAI', category: 'Audio/Video', reasonRecommended: 'Transcribe body camera footage, depositions, 911 calls automatically', integrationDifficulty: 'Easy', potentialBenefit: 'Automated transcription reduces manual review time by 80%' },
  { name: 'Pinecone', category: 'Vector Search', reasonRecommended: 'Semantic search across legal corpus, similar case finding, precedent matching', integrationDifficulty: 'Medium', potentialBenefit: 'AI-powered case law search with 95% relevance accuracy' },
  { name: 'LangSmith', category: 'AI Observability', reasonRecommended: 'Monitor AI pipeline quality, track prompt performance, debug LLM outputs', integrationDifficulty: 'Easy', potentialBenefit: 'Reduce AI hallucination rate and improve output reliability' },
  { name: 'OpenEvidence', category: 'Medical/Legal', reasonRecommended: 'Access medical literature for injury cases, toxicology references', integrationDifficulty: 'Medium', potentialBenefit: 'Evidence-based medical analysis for personal injury and force cases' },
];

function getStatusBadge(status: 'active' | 'degraded' | 'offline') {
  const map = {
    active: { icon: <CheckCircle size={12} />, bg: 'bg-green-50', text: 'text-green-700', label: 'Active' },
    degraded: { icon: <AlertTriangle size={12} />, bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Degraded' },
    offline: { icon: <XCircle size={12} />, bg: 'bg-red-50', text: 'text-red-700', label: 'Offline' },
  };
  const s = map[status];
  return <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ' + s.bg + ' ' + s.text}>{s.icon} {s.label}</span>;
}

function getDifficultyBadge(diff: string) {
  const map: Record<string, string> = {
    Easy: 'bg-green-50 text-green-700',
    Medium: 'bg-yellow-50 text-yellow-700',
    Hard: 'bg-red-50 text-red-700',
  };
  return <span className={'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ' + (map[diff] || 'bg-gray-50 text-gray-700')}>{diff}</span>;
}

export function ApiRegistryDashboard() {
  const [activeTab, setActiveTab] = useState<'current' | 'recommended'>('current');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Plug size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">API Registry Dashboard</h1>
            <p className="text-sm text-gray-500">Manage and monitor all platform API integrations</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><div className="flex items-center gap-3"><Plug size={20} className="text-blue-600" /><div><p className="text-sm text-gray-500">Active APIs</p><p className="text-2xl font-bold">{CURRENT_APIS.filter(a => a.status === 'active').length}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><AlertTriangle size={20} className="text-yellow-600" /><div><p className="text-sm text-gray-500">Degraded</p><p className="text-2xl font-bold">{CURRENT_APIS.filter(a => a.status === 'degraded').length}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><Activity size={20} className="text-green-600" /><div><p className="text-sm text-gray-500">Avg Score</p><p className="text-2xl font-bold">{Math.round(CURRENT_APIS.reduce((s, a) => s + a.recommendationScore, 0) / CURRENT_APIS.length)}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><Star size={20} className="text-purple-600" /><div><p className="text-sm text-gray-500">Recommended</p><p className="text-2xl font-bold">{RECOMMENDED_APIS.length}</p></div></div></Card>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
        <button onClick={() => setActiveTab('current')} className={'px-4 py-2 rounded-md text-sm font-medium transition-colors ' + (activeTab === 'current' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
          <Plug size={14} className="inline mr-1.5" /> Current Integrations
        </button>
        <button onClick={() => setActiveTab('recommended')} className={'px-4 py-2 rounded-md text-sm font-medium transition-colors ' + (activeTab === 'recommended' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
          <Zap size={14} className="inline mr-1.5" /> AI Recommended
        </button>
      </div>

      {activeTab === 'current' && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current API Integrations</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">API Name</th>
                  <th className="text-center py-3 px-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">Usage Metrics</th>
                  <th className="text-right py-3 px-3 text-gray-500 font-medium">Error Rate</th>
                  <th className="text-center py-3 px-3 text-gray-500 font-medium">Score</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {CURRENT_APIS.map(api => (
                  <tr key={api.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 font-medium text-gray-900">{api.name}</td>
                    <td className="py-3 px-3 text-center">{getStatusBadge(api.status)}</td>
                    <td className="py-3 px-3 text-gray-600 text-xs">{api.usageMetrics}</td>
                    <td className="py-3 px-3 text-right text-xs font-medium text-gray-700">{api.errorRate}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ' + (api.recommendationScore >= 90 ? 'bg-green-50 text-green-700' : api.recommendationScore >= 75 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700')}>{api.recommendationScore}</span>
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-xs max-w-[250px] truncate">{api.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'recommended' && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Recommended APIs</h2>
          <p className="text-sm text-gray-500 mb-4">System-recommended APIs based on platform usage patterns and feature gaps.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">API Name</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">Category</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">Reason Recommended</th>
                  <th className="text-center py-3 px-3 text-gray-500 font-medium">Difficulty</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">Potential Benefit</th>
                </tr>
              </thead>
              <tbody>
                {RECOMMENDED_APIS.map(api => (
                  <tr key={api.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 font-medium text-gray-900">{api.name}</td>
                    <td className="py-3 px-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">{api.category}</span></td>
                    <td className="py-3 px-3 text-gray-600 text-xs max-w-[200px]">{api.reasonRecommended}</td>
                    <td className="py-3 px-3 text-center">{getDifficultyBadge(api.integrationDifficulty)}</td>
                    <td className="py-3 px-3 text-gray-500 text-xs max-w-[250px]">{api.potentialBenefit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
