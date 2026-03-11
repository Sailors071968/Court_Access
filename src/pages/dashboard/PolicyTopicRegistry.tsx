// ============================================================================
// Phase 263 — Policy Topic Registry
// Canonical registry for 334 policy topics — single source of truth
// ============================================================================

import { useState } from 'react';
import { BookOpen, Search, Plus } from 'lucide-react';

interface PolicyTopic {
  topicId: string;
  canonicalName: string;
  aliases: string[];
  category: string;
}

const CATEGORIES = ['Use of Force', 'Pursuit', 'Detention', 'Search & Seizure', 'Evidence', 'Training', 'Conduct', 'Records', 'Internal Affairs', 'Technology', 'Weapons', 'Community Relations'];

const MOCK_TOPICS: PolicyTopic[] = [
  { topicId: 'pt-001', canonicalName: 'Use of Force', aliases: ['Force Policy', 'UOF Policy', 'Force Continuum'], category: 'Use of Force' },
  { topicId: 'pt-002', canonicalName: 'Body-Worn Camera', aliases: ['BWC Policy', 'Body Camera', 'Bodycam Policy'], category: 'Technology' },
  { topicId: 'pt-003', canonicalName: 'Vehicle Pursuit', aliases: ['Pursuit Policy', 'High-Speed Pursuit', 'Chase Policy'], category: 'Pursuit' },
  { topicId: 'pt-004', canonicalName: 'Internal Affairs Investigation', aliases: ['IA Policy', 'Internal Investigation', 'Complaint Investigation'], category: 'Internal Affairs' },
  { topicId: 'pt-005', canonicalName: 'Search and Seizure', aliases: ['Search Policy', 'Fourth Amendment Policy', 'Warrant Policy'], category: 'Search & Seizure' },
  { topicId: 'pt-006', canonicalName: 'Evidence Collection and Handling', aliases: ['Evidence Policy', 'Chain of Custody', 'Evidence Preservation'], category: 'Evidence' },
  { topicId: 'pt-007', canonicalName: 'Arrest Procedures', aliases: ['Arrest Policy', 'Booking Procedures', 'Custody Policy'], category: 'Detention' },
  { topicId: 'pt-008', canonicalName: 'Officer Discipline', aliases: ['Disciplinary Policy', 'Corrective Action', 'Progressive Discipline'], category: 'Conduct' },
  { topicId: 'pt-009', canonicalName: 'Training Requirements', aliases: ['Training Policy', 'Mandatory Training', 'In-Service Training'], category: 'Training' },
  { topicId: 'pt-010', canonicalName: 'Miranda Procedures', aliases: ['Miranda Rights', 'Custodial Interrogation', 'Rights Advisory'], category: 'Detention' },
  { topicId: 'pt-011', canonicalName: 'Foot Pursuit', aliases: ['Foot Chase Policy', 'On-Foot Pursuit'], category: 'Pursuit' },
  { topicId: 'pt-012', canonicalName: 'Less-Lethal Weapons', aliases: ['Taser Policy', 'OC Spray', 'Bean Bag Rounds', 'Impact Weapons'], category: 'Weapons' },
  { topicId: 'pt-013', canonicalName: 'Firearms Discharge', aliases: ['Shooting Policy', 'Deadly Force', 'Firearms Policy'], category: 'Weapons' },
  { topicId: 'pt-014', canonicalName: 'Critical Incident Response', aliases: ['Critical Incident', 'OIS Response', 'Major Incident'], category: 'Use of Force' },
  { topicId: 'pt-015', canonicalName: 'Records Retention', aliases: ['Record Keeping', 'Document Retention', 'Data Preservation'], category: 'Records' },
];

export function PolicyTopicRegistry() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const filtered = MOCK_TOPICS.filter((t) => {
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
            <p className="text-sm text-gray-500">Canonical registry — single source of truth for {MOCK_TOPICS.length} topics</p>
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
      <p className="text-xs text-gray-400 text-center">Showing {filtered.length} of {MOCK_TOPICS.length} registered topics</p>
    </div>
  );
}
