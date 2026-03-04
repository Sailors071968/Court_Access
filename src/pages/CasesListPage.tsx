// ============================================
// Court Access — Cases List Page
// Connected to real backend API
// ============================================

import { useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../components/common/Card';
import { useCases, createCase } from '../hooks/useApi';

export function CasesListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewCase, setShowNewCase] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: cases, isLoading, refetch } = useCases();
  const allCases = cases || [];

  const filteredCases = allCases.filter((c) => {
    const matchesSearch = !searchQuery ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.caseNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await createCase({ title: newTitle, caseNumber: newCaseNumber || undefined });
      setShowNewCase(false);
      setNewTitle('');
      setNewCaseNumber('');
      refetch();
    } catch {
      // Error handled by API client
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
          <p className="text-sm text-gray-500 mt-1">{allCases.length} total cases</p>
        </div>
        <button
          onClick={() => setShowNewCase(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          <Plus size={16} />
          New Case
        </button>
      </div>

      {/* New Case Form */}
      {showNewCase && (
        <Card>
          <form onSubmit={handleCreateCase} className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Create New Case</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Title</label>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="People v. Doe" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Number (optional)</label>
                <input type="text" value={newCaseNumber} onChange={(e) => setNewCaseNumber(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="2024-CF-001234" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">{creating ? 'Creating...' : 'Create Case'}</button>
              <button type="button" onClick={() => setShowNewCase(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Search cases"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading cases...</span>
        </div>
      )}

      {/* Cases Grid */}
      {!isLoading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCases.map((c) => (
            <Card key={c.id} hover padding="md" className="cursor-pointer" onClick={() => navigate(`/cases/${c.id}/overview`)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{c.title}</h3>
                  {c.caseNumber && <p className="text-sm text-gray-500">#{c.caseNumber}</p>}
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 capitalize">{c.status}</span>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p><span className="font-medium">Created:</span> {new Date(c.createdAt).toLocaleDateString()}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredCases.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">{allCases.length === 0 ? 'No cases yet. Create your first case to get started.' : 'No cases found matching your criteria.'}</p>
        </div>
      )}
    </div>
  );
}
