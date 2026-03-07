// ============================================
// Court Access — Phase 54/56: Policy Compliance Page
// Upload department policies, view compliance findings,
// and link to relevant evidence and policy sections.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Plus, FileText, AlertTriangle, CheckCircle, XCircle, RefreshCw, Loader2, Filter, Search, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { apiFetch } from '../../services/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PolicyDocument {
  id: string;
  caseId: string;
  title: string;
  documentType: string;
  content: string;
  sections: Array<{ sectionId: string; title: string; content: string }>;
  status: string;
  createdAt: string;
  _count?: { findings: number };
}

interface EvidenceRef {
  id: string;
  filename: string;
  evidenceType: string;
}

interface PolicyComplianceFinding {
  id: string;
  caseId: string;
  evidenceId: string;
  policyDocumentId: string;
  policySection: string;
  description: string;
  confidenceScore: number;
  severity: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  policyDocument: { id: string; title: string; documentType: string } | null;
  evidence: EvidenceRef | null;
}

interface FindingSummary {
  total: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  avgConfidence: number;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  critical: { label: 'CRITICAL', color: 'text-red-800', bgColor: 'bg-red-100' },
  high: { label: 'HIGH', color: 'text-orange-800', bgColor: 'bg-orange-100' },
  medium: { label: 'MEDIUM', color: 'text-amber-800', bgColor: 'bg-amber-100' },
  low: { label: 'LOW', color: 'text-blue-800', bgColor: 'bg-blue-100' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700' },
  dismissed: { label: 'Dismissed', color: 'bg-gray-100 text-gray-500' },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  resolved: { label: 'Resolved', color: 'bg-purple-100 text-purple-700' },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  police_policy: 'Police Policy',
  use_of_force: 'Use of Force',
  arrest_procedure: 'Arrest Procedure',
  bodycam_rules: 'Body Camera Rules',
  evidence_handling: 'Evidence Handling',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Policy Upload Form
// ---------------------------------------------------------------------------

function PolicyUploadForm({
  caseId,
  onUploaded,
  onCancel,
}: {
  caseId: string;
  onUploaded: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('police_policy');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title || !content) return;
    setSaving(true);
    try {
      await apiFetch(`/api/policy/${caseId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ title, documentType, content }),
      });
      onUploaded();
    } catch (err) {
      console.error('Failed to upload policy:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Upload Policy Document</h3>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Policy Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Use of Force Policy"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Document Type</label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Policy Content *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Paste the full policy document text here. The system will automatically parse sections and index the content for compliance analysis..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !title || !content}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Uploading...' : 'Upload & Index'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Policy Document Card
// ---------------------------------------------------------------------------

function PolicyDocCard({ doc }: { doc: PolicyDocument }) {
  const [expanded, setExpanded] = useState(false);
  const sections = Array.isArray(doc.sections) ? doc.sections : [];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-indigo-600" />
            <span className="text-sm font-medium text-gray-900">{doc.title}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{sections.length} section{sections.length !== 1 ? 's' : ''} indexed</span>
            <span>{doc._count?.findings || 0} finding{(doc._count?.findings || 0) !== 1 ? 's' : ''}</span>
            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
          </div>

          {expanded && sections.length > 0 && (
            <div className="mt-3 space-y-2">
              {sections.map((s) => (
                <div key={s.sectionId} className="p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-700">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.content.substring(0, 200)}{s.content.length > 200 ? '...' : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Finding Card
// ---------------------------------------------------------------------------

function FindingCard({
  finding,
  onUpdateStatus,
}: {
  finding: PolicyComplianceFinding;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const severityConfig = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.medium;
  const statusConfig = STATUS_CONFIG[finding.status] || STATUS_CONFIG.active;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Severity indicator */}
        <div className={`p-2 rounded-lg ${severityConfig.bgColor} flex-shrink-0`}>
          <AlertTriangle size={16} className={severityConfig.color} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${severityConfig.bgColor} ${severityConfig.color}`}>
              {severityConfig.label}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            <span className="text-xs text-gray-400">
              {Math.round(finding.confidenceScore * 100)}% confidence
            </span>
          </div>

          <p className="text-sm text-gray-900 leading-relaxed mb-1">
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mr-1">Potential policy deviation detected</span>
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-2">
            {finding.description}
          </p>

          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            {finding.policyDocument && (
              <span className="flex items-center gap-1">
                <FileText size={10} />
                {finding.policyDocument.title}
              </span>
            )}
            {finding.policySection && (
              <span>Section: {finding.policySection}</span>
            )}
            {finding.evidence && (
              <span className="flex items-center gap-1">
                <span className="font-medium">Evidence:</span>
                {finding.evidence.filename}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {finding.status === 'active' && (
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onUpdateStatus(finding.id, 'confirmed')}
              className="p-1 text-gray-400 hover:text-green-600 rounded"
              title="Confirm finding"
            >
              <CheckCircle size={14} />
            </button>
            <button
              onClick={() => onUpdateStatus(finding.id, 'dismissed')}
              className="p-1 text-gray-400 hover:text-red-500 rounded"
              title="Dismiss finding"
            >
              <XCircle size={14} />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Policy Compliance Page
// ---------------------------------------------------------------------------

export function PolicyCompliancePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [findings, setFindings] = useState<PolicyComplianceFinding[]>([]);
  const [findingSummary, setFindingSummary] = useState<FindingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'findings' | 'policies'>('findings');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterStatus) params.set('status', filterStatus);

      const [docsRes, findingsRes, summaryRes] = await Promise.all([
        apiFetch(`/api/policy/${caseId}/documents`),
        apiFetch(`/api/policy/${caseId}/findings?${params}`),
        apiFetch(`/api/policy/${caseId}/findings/summary`),
      ]);

      const docsData = await docsRes.json();
      const findingsData = await findingsRes.json();
      const summaryData = await summaryRes.json();

      setDocuments(docsData.documents || []);
      setFindings(findingsData.findings || []);
      setFindingSummary(summaryData);
    } catch (err) {
      console.error('Failed to fetch policy data:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId, filterSeverity, filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAnalyze = async () => {
    if (!caseId) return;
    setAnalyzing(true);
    try {
      await apiFetch(`/api/policy/${caseId}/analyze`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await fetchData();
    } catch (err) {
      console.error('Compliance analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdateStatus = async (findingId: string, status: string) => {
    if (!caseId) return;
    try {
      await apiFetch(`/api/policy/${caseId}/findings/${findingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to update finding:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Shield size={20} className="text-blue-600" />
            Policy Compliance
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {documents.length} polic{documents.length !== 1 ? 'ies' : 'y'} indexed &middot; {findings.length} finding{findings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || documents.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {analyzing ? 'Analyzing...' : 'Run Compliance Check'}
          </button>
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            Add Policy
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {findingSummary && findingSummary.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="text-center py-3">
            <p className="text-2xl font-bold text-gray-900">{findingSummary.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Findings</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-2xl font-bold text-red-600">{findingSummary.bySeverity?.critical || 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Critical</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-2xl font-bold text-orange-600">{findingSummary.bySeverity?.high || 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">High</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-2xl font-bold text-amber-600">{(findingSummary.bySeverity?.medium || 0) + (findingSummary.bySeverity?.low || 0)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Medium/Low</p>
          </Card>
        </div>
      )}

      {/* Phase 60: AI Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          This analysis is automated and intended for investigative assistance only. It does not constitute legal advice, definitive conclusions, or expert opinion. All findings should be independently verified by qualified professionals before use in legal proceedings.
        </p>
      </div>

      {/* Upload Form */}
      {showUploadForm && caseId && (
        <PolicyUploadForm
          caseId={caseId}
          onUploaded={() => { setShowUploadForm(false); fetchData(); }}
          onCancel={() => setShowUploadForm(false)}
        />
      )}

      {/* Tab toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('findings')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'findings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Findings ({findings.length})
        </button>
        <button
          onClick={() => setActiveTab('policies')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'policies' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Policies ({documents.length})
        </button>
      </div>

      {/* Findings View */}
      {activeTab === 'findings' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Filter size={12} />
              Filters:
            </div>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="confirmed">Confirmed</option>
              <option value="dismissed">Dismissed</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 size={24} className="mx-auto mb-2 text-gray-400 animate-spin" />
              <p className="text-gray-400 text-sm">Loading findings...</p>
            </div>
          ) : findings.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Shield size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">No compliance findings yet.</p>
                <p className="text-gray-400 text-xs mt-1">
                  Upload policy documents and run compliance analysis to detect deviations.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {findings.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  onUpdateStatus={handleUpdateStatus}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Policies View */}
      {activeTab === 'policies' && (
        <>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 size={24} className="mx-auto mb-2 text-gray-400 animate-spin" />
              <p className="text-gray-400 text-sm">Loading policies...</p>
            </div>
          ) : documents.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <FileText size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">No policy documents uploaded.</p>
                <p className="text-gray-400 text-xs mt-1">
                  Upload department policies, use-of-force procedures, or body camera rules.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <PolicyDocCard key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
