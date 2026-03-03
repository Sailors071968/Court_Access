// ============================================
// Court Access — Cases List Page
// ============================================

import { useNavigate } from 'react-router-dom';
import { Search, Plus, Filter } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../components/common/Card';
import { CaseStatusBadge } from '../components/common/StatusBadge';
import { MOCK_CASES } from '../constants/mockData';

export function CasesListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredCases = MOCK_CASES.filter((c) => {
    const matchesSearch = !searchQuery ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
          <p className="text-sm text-gray-500 mt-1">{MOCK_CASES.length} total cases</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
          <Plus size={16} />
          New Case
        </button>
      </div>

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

      {/* Cases Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCases.map((c) => (
          <Card key={c.id} hover padding="md" className="cursor-pointer" onClick={() => navigate(`/cases/${c.id}/overview`)}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{c.title}</h3>
                <p className="text-sm text-gray-500">#{c.caseNumber}</p>
              </div>
              <CaseStatusBadge status={c.status} />
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p><span className="font-medium">Jurisdiction:</span> {c.jurisdiction}</p>
              <p><span className="font-medium">Judge:</span> {c.judge}</p>
              {c.nextHearing && <p><span className="font-medium">Next Hearing:</span> {c.nextHearing}</p>}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
              <span>{c.documentsCount} documents</span>
              <span>{c.chargesCount} charges</span>
            </div>
          </Card>
        ))}
      </div>

      {filteredCases.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No cases found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
