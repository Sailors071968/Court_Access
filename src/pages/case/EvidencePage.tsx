// ============================================
// Court Access — Evidence / Documents Tab
// ============================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Upload, Eye, MoreHorizontal, Loader2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { AIStatusBadge } from '../../components/common/StatusBadge';
import { useDocuments } from '../../hooks/useApi';

export function EvidencePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: documents, isLoading } = useDocuments(caseId);
  const docList = documents || [];

  const filteredDocs = docList.filter((doc) => {
    const matchesSearch = !searchQuery || doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Documents</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search documents"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
            <Upload size={16} />
            Upload
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading documents...</span>
        </div>
      )}

      {/* Documents Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Document Name</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Type</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Filed Date</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Pages</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">AI Status</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{doc.fileName}</td>
                  <td className="py-3 px-4 text-gray-500">Document</td>
                  <td className="py-3 px-4 text-gray-500">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-gray-500">—</td>
                  <td className="py-3 px-4"><AIStatusBadge status={doc.analysisStatus} /></td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-1">
                        <Eye size={12} />
                        View
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded" aria-label="More options">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
