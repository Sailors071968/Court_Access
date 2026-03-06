// ============================================
// Court Access — Phase D: Evidence Integrity Certificates Page
// Forensic verification with SHA-256 + SHA3-256 and exportable certificates.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Download, CheckCircle, XCircle, RefreshCw, FileText, Lock, Clock } from 'lucide-react';
import { Card } from '../../components/common/Card';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntegrityReport {
  id: string;
  evidenceId: string;
  caseId: string;
  fileName: string;
  sha256Hash: string;
  sha3Hash: string;
  uploadTimestamp: string;
  verificationStatus: string;
  chainOfCustody: Array<{ action: string; timestamp: string; actor: string }>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Integrity Report Card
// ---------------------------------------------------------------------------

function IntegrityReportCard({
  report,
  onExport,
}: {
  report: IntegrityReport;
  onExport: (evidenceId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isVerified = report.verificationStatus === 'verified';

  return (
    <Card className={`${isVerified ? 'border-green-200' : 'border-red-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isVerified ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {isVerified ? (
              <CheckCircle size={18} className="text-green-600" />
            ) : (
              <XCircle size={18} className="text-red-600" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {report.fileName || report.evidenceId}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                isVerified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                <Shield size={10} />
                {isVerified ? 'Verified' : 'Failed'}
              </span>
              <span className="text-xs text-gray-400">
                Uploaded {new Date(report.uploadTimestamp).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onExport(report.evidenceId)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            aria-label="Export certificate"
            title="Download Integrity Certificate"
          >
            <Download size={16} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            aria-label="Toggle details"
          >
            <FileText size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {/* Hash Details */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cryptographic Hashes</p>
            <div className="space-y-2">
              <div className="p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-1 mb-1">
                  <Lock size={10} className="text-gray-400" />
                  <span className="text-xs font-medium text-gray-600">SHA-256</span>
                </div>
                <p className="font-mono text-[10px] text-gray-700 break-all">{report.sha256Hash}</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-1 mb-1">
                  <Lock size={10} className="text-gray-400" />
                  <span className="text-xs font-medium text-gray-600">SHA3-256</span>
                </div>
                <p className="font-mono text-[10px] text-gray-700 break-all">{report.sha3Hash}</p>
              </div>
            </div>
          </div>

          {/* Chain of Custody */}
          {Array.isArray(report.chainOfCustody) && report.chainOfCustody.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Chain of Custody</p>
              <div className="space-y-1">
                {report.chainOfCustody.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600 p-2 bg-gray-50 rounded">
                    <Clock size={10} className="text-gray-400" />
                    <span className="font-medium">{entry.action}</span>
                    <span className="text-gray-400">by {entry.actor}</span>
                    <span className="text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence ID */}
          <div className="text-xs text-gray-400">
            Evidence ID: <span className="font-mono">{report.evidenceId}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Integrity Certificate Page
// ---------------------------------------------------------------------------

export function IntegrityCertificatePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [reports, setReports] = useState<IntegrityReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrity/${caseId}`);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      console.error('Failed to fetch integrity reports:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleExport = async (evidenceId: string) => {
    if (!caseId) return;
    try {
      const res = await fetch(`${API_BASE}/api/integrity/${caseId}/${evidenceId}/export`);
      const data = await res.json();

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `integrity-cert-${evidenceId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export certificate:', err);
    }
  };

  const verifiedCount = reports.filter((r) => r.verificationStatus === 'verified').length;
  const failedCount = reports.filter((r) => r.verificationStatus === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Shield size={20} className="text-green-600" />
            Integrity Certificates
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Forensic verification for {reports.length} evidence file{reports.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchReports}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          aria-label="Refresh reports"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
          <p className="text-xs text-gray-500">Total Files</p>
        </Card>
        <Card className="text-center border-green-200">
          <p className="text-2xl font-bold text-green-600">{verifiedCount}</p>
          <p className="text-xs text-green-600">Verified</p>
        </Card>
        <Card className="text-center border-red-200">
          <p className="text-2xl font-bold text-red-600">{failedCount}</p>
          <p className="text-xs text-red-600">Failed</p>
        </Card>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading integrity reports...</div>
      ) : reports.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Shield size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">No integrity certificates yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Upload evidence to automatically generate SHA-256 + SHA3-256 integrity certificates.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <IntegrityReportCard key={report.id} report={report} onExport={handleExport} />
          ))}
        </div>
      )}
    </div>
  );
}
