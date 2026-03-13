// ============================================
// Court Access — Evidence / Documents Tab
// ============================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Upload, Eye, MoreHorizontal } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { AIStatusBadge } from '../../components/common/StatusBadge';
import { DoctrineCompliancePanel } from '../../components/case/DoctrineCompliancePanel';
import { caseDataProvider } from '../../services/caseDataProvider';
import type { DocumentEntity } from '../../models/DocumentModel';

const DOCUMENT_TABS = [
  { id: 'all', label: 'All Documents', count: 0 },
  { id: 'defense_motion', label: 'Motions', count: 0 },
  { id: 'transcript', label: 'Transcripts', count: 0 },
  { id: 'charging_document', label: 'Charging Documents', count: 0 },
  { id: 'court_order', label: 'Court Orders', count: 0 },
  { id: 'other', label: 'Other Filings', count: 0 },
];

export function EvidencePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allDocuments, setAllDocuments] = useState<DocumentEntity[]>([]);
  const documentTypeLabels = caseDataProvider.getDocumentTypeLabels();

  useEffect(() => {
    caseDataProvider.getDocuments(caseId).then(setAllDocuments);
  }, [caseId]);

  const filteredDocs = allDocuments.filter((doc: DocumentEntity) => {
    const matchesTab = activeTab === 'all' || doc.type === activeTab;
    const matchesSearch = !searchQuery || doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
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

      {/* Document Type Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {DOCUMENT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

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
                  <td className="py-3 px-4 font-medium text-gray-900">{doc.name}</td>
                  <td className="py-3 px-4 text-gray-500">{documentTypeLabels[doc.type]}</td>
                  <td className="py-3 px-4 text-gray-500">{doc.filedDate}</td>
                  <td className="py-3 px-4 text-gray-500">{doc.pages} pages</td>
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

      {/* Police Training Doctrine Compliance */}
      <DoctrineCompliancePanel />
    </div>
  );
}
