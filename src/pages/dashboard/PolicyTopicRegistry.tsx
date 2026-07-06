// ============================================================================
// Phase 263 — Policy Topic Registry
// Canonical registry for 334 policy topics — single source of truth
// ============================================================================

import { useState, useEffect } from 'react';
import { BookOpen, Search, Plus, Loader2 } from 'lucide-react';

interface PolicyTopic {
  topicId: string;
  canonicalName: string;
  aliases: string[];
  category: string;
}

const CATEGORIES = ['Use of Force', 'Pursuit', 'Detention', 'Search & Seizure', 'Evidence', 'Training', 'Conduct', 'Records', 'Internal Affairs', 'Technology', 'Weapons', 'Community Relations'];


export function PolicyTopicRegistry() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [topics, setTopics] = useState<PolicyTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTopics() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/operations/topics/registry');
        if (res.ok) {
          const json = await res.json();
          if (json.data) setTopics(json.data);
        }
      } catch {
        // API not available yet
      } finally {
        setIsLoading(false);
      }
    }
    fetchTopics();
  }, []);

  const filtered = topics.filter((t) => {
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (search && !t.canonicalName.toLowerCase().includes(search.toLowerCase()) && !t.aliases.some(a => a.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Policy Topic Registry</h1>
            <p className="text-sm text-gray-500">Canonical registry — single source of truth for {topics.length} topics</p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
          <Plus size={14} /> Add Topic
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search topics or aliases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2">
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading topics...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <BookOpen size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No policy topics registered yet.</p>
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Canonical Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Aliases</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((topic) => (
              <tr key={topic.topicId} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{topic.topicId}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{topic.canonicalName}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {topic.aliases.map((a) => (
                      <span key={a} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">{a}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{topic.category}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-blue-600 hover:text-blue-700 text-xs font-medium">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <p className="text-xs text-gray-400 text-center">Showing {filtered.length} of {topics.length} registered topics</p>
    </div>
  );
}
