// ============================================================================
// Court Access — Evidence Upload Management Dashboard
// Phase 233-235: Administrative evidence management, client disregard,
// admin override, and audit logging
// Route: /dashboard/evidence-management
// Visible to: admin, staff
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Upload,
  Trash2,
  RefreshCw,
  Eye,
  AlertTriangle,
  RotateCcw,
  Shield,
  Clock,
  Search,
  Filter,
  Download,
  XCircle,
  CheckCircle2,
  Archive,
  Flag,
  Activity,
  User,
  ChevronDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnalysisStatus = 'pending' | 'analyzing' | 'analyzed' | 'failed' | 'corrupted' | 'disregarded';

interface EvidenceUpload {
  fileId: string;
  caseId: string;
  caseName: string;
  defendantName: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByRole: 'defendant' | 'staff' | 'attorney' | 'admin';
  analysisStatus: AnalysisStatus;
  disregarded: boolean;
  disregardedAt: string | null;
  disregardedBy: string | null;
  deleted: boolean;
  deletedAt: string | null;
  isEvidenceArtifact: boolean;
  flaggedCorrupted: boolean;
}

interface EvidenceAdminAction {
  actionId: string;
  adminUser: string;
  fileId: string;
  fileName: string;
  actionType: 'delete' | 'restore' | 'reprocess' | 'mark_artifact' | 'flag_corrupted' | 'unflag_corrupted' | 'disregard' | 'undo_disregard';
  timestamp: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const EVIDENCE_KEY = 'courtaccess_evidence_uploads';
const AUDIT_KEY = 'courtaccess_evidence_audit_log';

function loadEvidence(): EvidenceUpload[] {
  const stored = localStorage.getItem(EVIDENCE_KEY);
  if (stored) return JSON.parse(stored);
  // Seed demo data
  const demo = generateDemoEvidence();
  localStorage.setItem(EVIDENCE_KEY, JSON.stringify(demo));
  return demo;
}

function saveEvidence(uploads: EvidenceUpload[]): void {
  localStorage.setItem(EVIDENCE_KEY, JSON.stringify(uploads));
}

function loadAuditLog(): EvidenceAdminAction[] {
  return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
}

function saveAuditLog(log: EvidenceAdminAction[]): void {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(log));
}

function generateDemoEvidence(): EvidenceUpload[] {
  const cases = [
    { id: 'case-001', name: 'Sample Case A', defendant: 'Defendant A' },
    { id: 'case-002', name: 'Sample Case B', defendant: 'Defendant B' },
    { id: 'case-003', name: 'Sample Case C', defendant: 'Defendant C' },
  ];
  const files = [
    { name: 'arrest_report.pdf', type: 'application/pdf', size: 245000 },
    { name: 'bodycam_footage.mp4', type: 'video/mp4', size: 52000000 },
    { name: 'witness_statement_01.pdf', type: 'application/pdf', size: 128000 },
    { name: 'forensic_analysis.pdf', type: 'application/pdf', size: 890000 },
    { name: 'photo_evidence_01.jpg', type: 'image/jpeg', size: 3200000 },
    { name: 'lab_results.pdf', type: 'application/pdf', size: 456000 },
    { name: 'defendant_statement.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 67000 },
    { name: 'surveillance_clip.mp4', type: 'video/mp4', size: 28000000 },
    { name: 'phone_records.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 145000 },
    { name: 'toxicology_report.pdf', type: 'application/pdf', size: 234000 },
    { name: 'scene_photos.zip', type: 'application/zip', size: 15000000 },
    { name: 'character_reference.pdf', type: 'application/pdf', size: 89000 },
  ];
  const statuses: AnalysisStatus[] = ['pending', 'analyzing', 'analyzed', 'analyzed', 'analyzed', 'failed', 'analyzed', 'pending', 'analyzed', 'analyzed', 'analyzing', 'analyzed'];
  const uploaders = [
    { name: 'Jane Doe', role: 'attorney' as const },
    { name: 'Admin User', role: 'admin' as const },
    { name: 'John Smith', role: 'defendant' as const },
    { name: 'Staff Member', role: 'staff' as const },
  ];

  return files.map((f, i) => {
    const caseInfo = cases[i % cases.length];
    const uploader = uploaders[i % uploaders.length];
    const daysAgo = Math.floor(Math.random() * 30);
    const uploadDate = new Date(Date.now() - daysAgo * 86400000);

    return {
      fileId: `file-${String(i + 1).padStart(3, '0')}`,
      caseId: caseInfo.id,
      caseName: caseInfo.name,
      defendantName: caseInfo.defendant,
      fileName: f.name,
      fileType: f.type,
      fileSizeBytes: f.size,
      uploadedAt: uploadDate.toISOString(),
      uploadedBy: uploader.name,
      uploadedByRole: uploader.role,
      analysisStatus: statuses[i],
      disregarded: i === 5, // one disregarded for demo
      disregardedAt: i === 5 ? new Date(Date.now() - 2 * 86400000).toISOString() : null,
      disregardedBy: i === 5 ? 'John Smith' : null,
      deleted: false,
      deletedAt: null,
      isEvidenceArtifact: i === 3,
      flaggedCorrupted: i === 5,
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EvidenceManagementDashboard() {
  const [uploads, setUploads] = useState<EvidenceUpload[]>([]);
  const [auditLog, setAuditLog] = useState<EvidenceAdminAction[]>([]);
  const [activeTab, setActiveTab] = useState<'uploads' | 'audit'>('uploads');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDeletedFilter, setShowDeletedFilter] = useState(false);
  const [actionNotesModal, setActionNotesModal] = useState<{ fileId: string; action: EvidenceAdminAction['actionType'] } | null>(null);
  const [actionNotes, setActionNotes] = useState('');

  const refresh = useCallback(() => {
    setUploads(loadEvidence());
    setAuditLog(loadAuditLog().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // --- Admin Actions ---

  function logAction(fileId: string, actionType: EvidenceAdminAction['actionType'], notes: string) {
    const file = uploads.find((u) => u.fileId === fileId);
    const entry: EvidenceAdminAction = {
      actionId: crypto.randomUUID(),
      adminUser: 'Admin User',
      fileId,
      fileName: file?.fileName || 'Unknown',
      actionType,
      timestamp: new Date().toISOString(),
      notes,
    };
    const log = loadAuditLog();
    log.push(entry);
    saveAuditLog(log);
  }

  function handleAction(fileId: string, action: EvidenceAdminAction['actionType']) {
    setActionNotesModal({ fileId, action });
    setActionNotes('');
  }

  function executeAction() {
    if (!actionNotesModal) return;
    const { fileId, action } = actionNotesModal;
    const current = loadEvidence();
    const updated = current.map((u) => {
      if (u.fileId !== fileId) return u;
      switch (action) {
        case 'delete':
          return { ...u, deleted: true, deletedAt: new Date().toISOString() };
        case 'restore':
          return { ...u, deleted: false, deletedAt: null };
        case 'reprocess':
          return { ...u, analysisStatus: 'pending' as AnalysisStatus };
        case 'mark_artifact':
          return { ...u, isEvidenceArtifact: !u.isEvidenceArtifact };
        case 'flag_corrupted':
          return { ...u, flaggedCorrupted: true, analysisStatus: 'corrupted' as AnalysisStatus };
        case 'unflag_corrupted':
          return { ...u, flaggedCorrupted: false, analysisStatus: 'pending' as AnalysisStatus };
        case 'disregard':
          return { ...u, disregarded: true, disregardedAt: new Date().toISOString(), disregardedBy: 'Admin User', analysisStatus: 'disregarded' as AnalysisStatus };
        case 'undo_disregard':
          return { ...u, disregarded: false, disregardedAt: null, disregardedBy: null, analysisStatus: 'pending' as AnalysisStatus };
        default:
          return u;
      }
    });
    saveEvidence(updated);
    logAction(fileId, action, actionNotes);
    setActionNotesModal(null);
    setActionNotes('');
    refresh();
  }

  // --- Filtering ---

  const filtered = uploads.filter((u) => {
    if (!showDeletedFilter && u.deleted) return false;
    if (statusFilter !== 'all' && u.analysisStatus !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.fileName.toLowerCase().includes(q) ||
        u.caseName.toLowerCase().includes(q) ||
        u.defendantName.toLowerCase().includes(q) ||
        u.caseId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // --- Stats ---
  const totalFiles = uploads.filter((u) => !u.deleted).length;
  const analyzedFiles = uploads.filter((u) => u.analysisStatus === 'analyzed' && !u.deleted).length;
  const pendingFiles = uploads.filter((u) => (u.analysisStatus === 'pending' || u.analysisStatus === 'analyzing') && !u.deleted).length;
  const failedFiles = uploads.filter((u) => (u.analysisStatus === 'failed' || u.analysisStatus === 'corrupted') && !u.deleted).length;
  const disregardedFiles = uploads.filter((u) => u.disregarded && !u.deleted).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evidence Management</h1>
          <p className="text-sm text-gray-500 mt-1">Administrative evidence upload management and audit trail</p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={<FileText size={14} className="text-blue-500" />} label="Total Files" value={totalFiles} />
        <StatCard icon={<CheckCircle2 size={14} className="text-emerald-500" />} label="Analyzed" value={analyzedFiles} />
        <StatCard icon={<Clock size={14} className="text-amber-500" />} label="Pending" value={pendingFiles} />
        <StatCard icon={<XCircle size={14} className="text-red-500" />} label="Failed/Corrupted" value={failedFiles} />
        <StatCard icon={<Archive size={14} className="text-gray-500" />} label="Disregarded" value={disregardedFiles} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('uploads')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'uploads' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Upload size={14} className="inline mr-1.5" />Uploads
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'audit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity size={14} className="inline mr-1.5" />Audit Log
        </button>
      </div>

      {/* Uploads Tab */}
      {activeTab === 'uploads' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files, cases, defendants..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="analyzing">Analyzing</option>
                <option value="analyzed">Analyzed</option>
                <option value="failed">Failed</option>
                <option value="corrupted">Corrupted</option>
                <option value="disregarded">Disregarded</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeletedFilter}
                onChange={(e) => setShowDeletedFilter(e.target.checked)}
                className="rounded border-gray-300"
              />
              Show deleted
            </label>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">File</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Case</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Defendant</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Uploaded</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Flags</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        No evidence files match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((upload) => (
                      <tr
                        key={upload.fileId}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          upload.deleted ? 'opacity-50 bg-red-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileTypeIcon fileType={upload.fileType} />
                            <div>
                              <p className="font-medium text-gray-900 text-xs">{upload.fileName}</p>
                              <p className="text-[10px] text-gray-400">{formatFileSize(upload.fileSizeBytes)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{upload.caseName}</td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{upload.defendantName}</td>
                        <td className="px-4 py-3 text-xs">
                          <p className="text-gray-700">{new Date(upload.uploadedAt).toLocaleDateString()}</p>
                          <p className="text-[10px] text-gray-400">{upload.uploadedBy} ({upload.uploadedByRole})</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500">{getFileTypeLabel(upload.fileType)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <AnalysisStatusBadge status={upload.analysisStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {upload.disregarded && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">DISREGARD</span>
                            )}
                            {upload.isEvidenceArtifact && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">ARTIFACT</span>
                            )}
                            {upload.flaggedCorrupted && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">CORRUPT</span>
                            )}
                            {upload.deleted && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">DELETED</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <ActionButton
                              icon={<Eye size={12} />}
                              title="View file"
                              onClick={() => alert(`Viewing ${upload.fileName} (demo mode)`)}
                            />
                            {!upload.deleted && (
                              <>
                                <ActionButton
                                  icon={<RotateCcw size={12} />}
                                  title="Reprocess"
                                  onClick={() => handleAction(upload.fileId, 'reprocess')}
                                />
                                <ActionButton
                                  icon={<Flag size={12} />}
                                  title={upload.flaggedCorrupted ? 'Unflag corrupted' : 'Flag corrupted'}
                                  onClick={() => handleAction(upload.fileId, upload.flaggedCorrupted ? 'unflag_corrupted' : 'flag_corrupted')}
                                  danger={!upload.flaggedCorrupted}
                                />
                                <ActionButton
                                  icon={<Shield size={12} />}
                                  title={upload.isEvidenceArtifact ? 'Unmark artifact' : 'Mark as evidence artifact'}
                                  onClick={() => handleAction(upload.fileId, 'mark_artifact')}
                                />
                                {upload.disregarded ? (
                                  <ActionButton
                                    icon={<CheckCircle2 size={12} />}
                                    title="Undo disregard"
                                    onClick={() => handleAction(upload.fileId, 'undo_disregard')}
                                  />
                                ) : (
                                  <ActionButton
                                    icon={<Archive size={12} />}
                                    title="Mark disregard"
                                    onClick={() => handleAction(upload.fileId, 'disregard')}
                                  />
                                )}
                                <ActionButton
                                  icon={<Trash2 size={12} />}
                                  title="Delete"
                                  onClick={() => handleAction(upload.fileId, 'delete')}
                                  danger
                                />
                              </>
                            )}
                            {upload.deleted && (
                              <ActionButton
                                icon={<RotateCcw size={12} />}
                                title="Restore"
                                onClick={() => handleAction(upload.fileId, 'restore')}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Security note */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-800">
              <AlertTriangle size={12} className="inline mr-1" />
              <strong>Security:</strong> Clients cannot delete files. Client users may only mark uploads as &quot;Disregard&quot;.
              All admin actions are logged in the audit trail.
            </p>
          </div>
        </>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Shield size={14} /> Evidence Admin Action Log
            </h3>
          </div>
          {auditLog.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              No admin actions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Timestamp</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Admin</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">File</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => (
                    <tr key={entry.actionId} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <User size={10} className="text-gray-400" />
                          {entry.adminUser}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 font-medium">{entry.fileName}</td>
                      <td className="px-4 py-3">
                        <ActionTypeBadge type={entry.actionType} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                        {entry.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Action Notes Modal */}
      {actionNotesModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Confirm Action: {formatActionType(actionNotesModal.action)}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              This action will be recorded in the audit log. Add optional notes below.
            </p>
            <textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder="Reason for this action (optional)..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setActionNotesModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ActionButton({ icon, title, onClick, danger }: { icon: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        danger
          ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
      }`}
    >
      {icon}
    </button>
  );
}

function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  const config: Record<AnalysisStatus, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pending' },
    analyzing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Analyzing' },
    analyzed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Analyzed' },
    failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
    corrupted: { bg: 'bg-red-100', text: 'text-red-700', label: 'Corrupted' },
    disregarded: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Disregarded' },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function ActionTypeBadge({ type }: { type: EvidenceAdminAction['actionType'] }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    delete: { bg: 'bg-red-100', text: 'text-red-700', label: 'Delete' },
    restore: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Restore' },
    reprocess: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Reprocess' },
    mark_artifact: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Mark Artifact' },
    flag_corrupted: { bg: 'bg-red-100', text: 'text-red-700', label: 'Flag Corrupted' },
    unflag_corrupted: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Unflag Corrupted' },
    disregard: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Disregard' },
    undo_disregard: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Undo Disregard' },
  };
  const c = config[type] || { bg: 'bg-gray-100', text: 'text-gray-600', label: type };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function FileTypeIcon({ fileType }: { fileType: string }) {
  const color = fileType.startsWith('image/')
    ? 'text-purple-500 bg-purple-50'
    : fileType.startsWith('video/')
    ? 'text-red-500 bg-red-50'
    : fileType.includes('pdf')
    ? 'text-red-500 bg-red-50'
    : fileType.includes('spreadsheet') || fileType.includes('excel')
    ? 'text-emerald-500 bg-emerald-50'
    : 'text-blue-500 bg-blue-50';

  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
      {fileType.startsWith('video/') ? <Download size={14} /> : <FileText size={14} />}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Video';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Spreadsheet';
  if (mimeType.includes('word')) return 'Document';
  if (mimeType.includes('zip')) return 'Archive';
  return 'File';
}

function formatActionType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
