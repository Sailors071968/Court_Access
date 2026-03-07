// ============================================
// Court Access — Phase E: Cold Archive System Page
// Archive/restore cases with immutable audit ledger.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Archive, RotateCcw, Shield, Clock, AlertTriangle, CheckCircle, FileText, Hash, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { apiFetch } from '../../services/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArchiveManifest {
  caseId: string;
  archivedAt: string;
  reason: string;
  evidenceFiles: Array<{
    evidenceId: string;
    fileName: string;
    sha256: string;
    sha3: string;
  }>;
  counts: {
    evidence: number;
    timelineEvents: number;
    entities: number;
    narratives: number;
  };
}

interface ArchiveRecord {
  id: string;
  caseId: string;
  archiveHash: string;
  archiveLocation: string;
  archiveTimestamp: string;
  archiveManifest: ArchiveManifest;
  status: string;
  fileCount: number;
  totalSizeBytes: string;
  createdAt: string;
  updatedAt: string;
}

interface AuditLogEntry {
  id: string;
  caseId: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: typeof Archive }> = {
  active: { color: 'bg-green-100 text-green-700', label: 'Active', icon: CheckCircle },
  archived: { color: 'bg-amber-100 text-amber-700', label: 'Archived', icon: Archive },
  restoring: { color: 'bg-blue-100 text-blue-700', label: 'Restoring...', icon: Loader2 },
  restored: { color: 'bg-green-100 text-green-700', label: 'Restored', icon: RotateCcw },
  failed: { color: 'bg-red-100 text-red-700', label: 'Failed', icon: AlertTriangle },
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  archive_initiated: 'Archive Initiated',
  archive_completed: 'Archive Completed',
  restore_initiated: 'Restore Initiated',
  restore_completed: 'Restore Completed',
  hash_verified: 'Hash Verified',
  hash_failed: 'Hash Verification Failed',
};

// ---------------------------------------------------------------------------
// Main Archive Status Page
// ---------------------------------------------------------------------------

export function ArchiveStatusPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [archive, setArchive] = useState<ArchiveRecord | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [status, setStatus] = useState<string>('active');
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/archives/${caseId}`);
      const data = await res.json();
      setArchive(data.archive || null);
      setAuditLog(data.auditLog || []);
      setStatus(data.status || 'active');
    } catch (err) {
      console.error('Failed to fetch archive status:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleArchive = async () => {
    if (!caseId) return;
    setArchiving(true);
    try {
      const res = await apiFetch(`/api/archives/${caseId}/archive`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'attorney', reason: 'manual_archive' }),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Failed to archive:', err);
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async () => {
    if (!caseId) return;
    setRestoring(true);
    try {
      const res = await apiFetch(`/api/archives/${caseId}/restore`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'attorney' }),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Failed to restore:', err);
    } finally {
      setRestoring(false);
    }
  };

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading archive status...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Archive size={20} className="text-amber-600" />
            Cold Archive
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Immutable evidence archival with cryptographic verification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            aria-label="Refresh status"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Current Status */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${statusConfig.color}`}>
              <StatusIcon size={22} className={status === 'restoring' ? 'animate-spin' : ''} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Case Status</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === 'active' && (
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                {archiving ? 'Archiving...' : 'Archive Case'}
              </button>
            )}
            {(status === 'archived' || status === 'failed') && (
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {restoring ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                {restoring ? 'Restoring...' : 'Restore Case'}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Archive Details */}
      {archive && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Shield size={14} className="text-green-500" />
            Archive Details
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500">Archive Hash</p>
              <p className="font-mono text-xs text-gray-700 mt-0.5 break-all flex items-center gap-1">
                <Hash size={10} className="text-gray-400 flex-shrink-0" />
                {archive.archiveHash}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Archive Location</p>
              <p className="text-xs text-gray-700 mt-0.5">{archive.archiveLocation}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Archived At</p>
              <p className="text-xs text-gray-700 mt-0.5">
                {new Date(archive.archiveTimestamp).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">File Count</p>
              <p className="text-xs text-gray-700 mt-0.5">{archive.fileCount} files</p>
            </div>
          </div>

          {/* Manifest */}
          {archive.archiveManifest && archive.archiveManifest.counts && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Archive Manifest</p>
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-gray-900">{archive.archiveManifest.counts.evidence}</p>
                  <p className="text-xs text-gray-500">Evidence</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-gray-900">{archive.archiveManifest.counts.timelineEvents}</p>
                  <p className="text-xs text-gray-500">Timeline</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-gray-900">{archive.archiveManifest.counts.entities}</p>
                  <p className="text-xs text-gray-500">Entities</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-gray-900">{archive.archiveManifest.counts.narratives}</p>
                  <p className="text-xs text-gray-500">Narratives</p>
                </div>
              </div>
            </div>
          )}

          {/* Evidence Files in Archive */}
          {archive.archiveManifest && archive.archiveManifest.evidenceFiles && archive.archiveManifest.evidenceFiles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Archived Evidence Files</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {archive.archiveManifest.evidenceFiles.map((file) => (
                  <div key={file.evidenceId} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs">
                    <FileText size={12} className="text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700 truncate flex-1">{file.fileName || file.evidenceId}</span>
                    <span className="font-mono text-[10px] text-gray-400 truncate max-w-[120px]">{file.sha256.slice(0, 16)}...</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Audit Log */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Clock size={14} className="text-gray-500" />
          Audit Ledger
        </h3>
        {auditLog.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No audit events recorded</p>
        ) : (
          <div className="space-y-2">
            {auditLog.map((entry) => {
              const isError = entry.action.includes('failed');
              return (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    isError ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isError ? 'bg-red-200' : 'bg-gray-200'
                  }`}>
                    {isError ? (
                      <AlertTriangle size={12} className="text-red-600" />
                    ) : (
                      <CheckCircle size={12} className="text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {AUDIT_ACTION_LABELS[entry.action] || entry.action}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span>{entry.actor}</span>
                      <span>&middot;</span>
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    </div>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <div className="mt-1 text-xs text-gray-400">
                        {Object.entries(entry.details).map(([k, v]) => (
                          <span key={k} className="mr-2">
                            {k}: <span className="font-mono">{String(v)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
