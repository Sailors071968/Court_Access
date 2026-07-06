// ============================================
// Court Access — Evidence / Documents Tab
// Wired to real backend API (Phase 4 — Product Completion)
// ============================================

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Upload, Eye, MoreHorizontal, Loader2, Play, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { DoctrineCompliancePanel } from '../../components/case/DoctrineCompliancePanel';
import {
  fetchCaseEvidence,
  uploadEvidenceDirect,
  pollEvidenceProcessing,
  rebuildTimeline,
  EVIDENCE_TYPES,
  formatFileSize,
  type ApiEvidence,
} from '../../services/caseApi';

export function EvidencePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [evidence, setEvidence] = useState<ApiEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState('police_report');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process case state
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);
  const [processIsError, setProcessIsError] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchCaseEvidence(caseId);
        if (!cancelled) setEvidence(data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load evidence');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const handleUpload = async () => {
    if (!selectedFile || !caseId) return;
    try {
      setUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      const newEvidence = await uploadEvidenceDirect({
        caseId,
        file: selectedFile,
        evidenceType,
        onProgress: setUploadProgress,
      });
      setEvidence((prev) => [newEvidence, ...prev]);

      const finalEvidence = await pollEvidenceProcessing(newEvidence.evidenceId, {
        onUpdate: (ev) => {
          setEvidence((prev) =>
            prev.map((item) => (item.evidenceId === ev.evidenceId ? ev : item)),
          );
        },
      });
      setEvidence((prev) =>
        prev.map((item) => (item.evidenceId === finalEvidence.evidenceId ? finalEvidence : item)),
      );

      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadProgress(0);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleProcessCase = async () => {
    if (!caseId) return;
    try {
      setProcessing(true);
      setProcessResult(null);
      setProcessIsError(false);
      const result = await rebuildTimeline(caseId);
      setProcessResult(result.message || 'Processing started');
    } catch (err) {
      setProcessIsError(true);
      setProcessResult(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  // Build dynamic tabs from real evidence types
  const typeCounts = evidence.reduce<Record<string, number>>((acc, ev) => {
    acc[ev.evidenceType] = (acc[ev.evidenceType] || 0) + 1;
    return acc;
  }, {});

  const dynamicTabs = [
    { id: 'all', label: 'All Evidence', count: evidence.length },
    ...Object.entries(typeCounts).map(([type, count]) => ({
      id: type,
      label: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    })),
  ];

  const filteredEvidence = evidence.filter((ev) => {
    const matchesTab = activeTab === 'all' || ev.evidenceType === activeTab;
    const matchesSearch = !searchQuery || ev.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Evidence</h2>
          <p className="text-sm text-gray-500 mt-1">{evidence.length} items</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search evidence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search evidence"
            />
          </div>
          <button
            onClick={handleProcessCase}
            disabled={processing || evidence.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {processing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Process Case
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            <Upload size={16} />
            Upload
          </button>
        </div>
      </div>

      {/* Process Result */}
      {processResult && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          processIsError
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-blue-50 border border-blue-200 text-blue-700'
        }`}>
          {processIsError ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {processResult}
          <button onClick={() => setProcessResult(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Evidence Type Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {dynamicTabs.map((tab) => (
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

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading evidence...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-12">
          <AlertCircle size={24} className="text-red-400 mx-auto mb-2" />
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Evidence Table */}
      {!loading && !error && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">File Name</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Uploaded</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Size</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvidence.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      {evidence.length === 0 ? 'No evidence uploaded yet. Click "Upload" to add your first file.' : 'No evidence matches your filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredEvidence.map((ev) => (
                    <tr key={ev.evidenceId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{ev.fileName}</td>
                      <td className="py-3 px-4 text-gray-500 capitalize">{ev.evidenceType.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-4 text-gray-500">{new Date(ev.uploadedAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-gray-500">{formatFileSize(Number(ev.size))}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ev.processingStatus === 'analyzed' ? 'bg-green-100 text-green-700' :
                          ev.processingStatus === 'processing' ? 'bg-blue-100 text-blue-700' :
                          ev.processingStatus === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {ev.processingStatus}
                        </span>
                      </td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Police Training Doctrine Compliance */}
      <DoctrineCompliancePanel />

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Evidence</h2>
            {uploadError && <p className="text-sm text-red-600 mb-3">{uploadError}</p>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Evidence Type</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {EVIDENCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  accept=".pdf,.doc,.docx,.mp4,.mov,.avi,.jpg,.jpeg,.png"
                />
              </div>
              {uploading && (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  {uploadProgress >= 100 && (
                    <p className="text-xs text-blue-600 flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" />
                      Running OCR and text extraction...
                    </p>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowUploadModal(false); setUploadError(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  {uploading ? (uploadProgress >= 100 ? 'Processing...' : `Uploading ${uploadProgress}%...`) : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

