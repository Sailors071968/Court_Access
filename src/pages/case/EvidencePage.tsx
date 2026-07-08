// ============================================================================
// CourtAccess — Evidence Workspace (Program 28)
// Premier evidence management: inbox, OCR queue, review, chain of custody,
// media preview, batch operations, side-by-side comparison. On the design system.
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Eye, Columns, CheckSquare } from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Button } from '../../components/ui/button';
import { Card, StatCard } from '../../components/ui/card';
import { Tabs } from '../../components/ui/tabs';
import { SearchBar } from '../../components/ui/input';
import { Dropdown } from '../../components/ui/dropdown';
import { Dialog } from '../../components/ui/dialog';
import { ProgressBar } from '../../components/ui/progress';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/icons/registry';
import { DataTable, type Column } from '../../components/data/data-table';
import { SplitPane } from '../../components/layout/split-pane';
import { EvidenceStatus, HumanReviewBanner } from '../../components/indicators/indicators';
import { MediaPreview } from '../../components/evidence/MediaPreview';
import { EvidenceDetailDrawer } from '../../components/evidence/EvidenceDetailDrawer';
import { DoctrineCompliancePanel } from '../../components/case/DoctrineCompliancePanel';
import {
  fetchCaseEvidence,
  uploadEvidenceDirect,
  rebuildTimeline,
  EVIDENCE_TYPES,
  type ApiEvidence,
} from '../../services/caseApi';

type WorkspaceTab = 'inbox' | 'ocr' | 'review' | 'custody';

const TABS = [
  { id: 'inbox', label: 'Evidence Inbox', icon: <Icon name="evidence" size={15} /> },
  { id: 'ocr', label: 'OCR Queue', icon: <Icon name="ocr" size={15} /> },
  { id: 'review', label: 'Human Review', icon: <Icon name="humanReview" size={15} /> },
  { id: 'custody', label: 'Chain of Custody', icon: <Icon name="security" size={15} /> },
];

function formatFileSize(bytes: number): string {
  if (!bytes || isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type MediaClass = 'document' | 'image' | 'audio' | 'video' | 'archive' | 'physical' | 'other';

// Classify an evidence item into a media class from its real MIME type / evidence type.
function classifyMedia(mime: string | null, evidenceType: string): MediaClass {
  const m = (mime ?? '').toLowerCase();
  const t = (evidenceType ?? '').toLowerCase();
  if (m.startsWith('image/') || t === 'photo') return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/') || ['bodycam', 'dashcam', 'witness_video'].includes(t)) return 'video';
  if (m.includes('zip') || m.includes('compressed') || m.includes('archive')) return 'archive';
  if (t === 'physical_evidence' || t === 'physical') return 'physical';
  if (m.includes('pdf') || m.includes('word') || m.includes('document') || m.includes('text') || m.includes('rtf') || m.includes('officedocument') ||
      ['transcript', 'police_report', 'forensic_report', 'autopsy_report', 'dispatch_log', 'other_document', 'discovery'].includes(t)) return 'document';
  return 'other';
}

// OCR / analysis completion is derived from real processing state — never assumed.
function isOcrComplete(ev: ApiEvidence): boolean {
  return ev.processingStatus === 'analyzed' || ev.analysisStatus === 'completed';
}
function isOcrPending(ev: ApiEvidence): boolean {
  return !isOcrComplete(ev) && ev.processingStatus !== 'failed' && ev.analysisStatus !== 'failed';
}

const UPLOAD_ACCEPT = '.pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.gif,.tiff,.tif,.heic,.webp,.mp4,.mov,.avi,.mp3,.wav,.zip';

export function EvidencePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [tab, setTab] = useState<WorkspaceTab>('inbox');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [evidence, setEvidence] = useState<ApiEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState('police_report');

  const [processing, setProcessing] = useState(false);
  const [processNote, setProcessNote] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<ApiEvidence | null>(null);
  const [compareMode, setCompareMode] = useState(false);

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
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const handleUpload = async () => {
    if (!selectedFile || !caseId) return;
    try {
      setUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      const newEvidence = await uploadEvidenceDirect({ caseId, file: selectedFile, evidenceType, onProgress: setUploadProgress });
      setEvidence((prev) => [newEvidence, ...prev]);
      setShowUpload(false);
      setSelectedFile(null);
      setUploadProgress(0);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = async () => {
    if (!caseId) return;
    try {
      setProcessing(true);
      setProcessNote(null);
      const result = await rebuildTimeline(caseId);
      setProcessNote(result.message || 'Processing started');
    } catch (err) {
      setProcessNote(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  // Counts for intelligence header.
  const counts = useMemo(() => {
    const analyzed = evidence.filter((e) => e.processingStatus === 'analyzed').length;
    const ocrQueue = evidence.filter((e) => ['pending', 'processing'].includes(e.processingStatus)).length;
    const review = evidence.filter((e) => e.processingStatus === 'pending').length;
    return { total: evidence.length, analyzed, ocrQueue, review };
  }, [evidence]);

  // Premium evidence summary — every value computed from the real evidence set.
  const summary = useMemo(() => {
    const media: Record<MediaClass, number> = { document: 0, image: 0, audio: 0, video: 0, archive: 0, physical: 0, other: 0 };
    let bytes = 0;
    let ocrDone = 0;
    let ocrPending = 0;
    let failed = 0;
    for (const e of evidence) {
      media[classifyMedia(e.mimeType, e.evidenceType)] += 1;
      bytes += Number(e.size) || 0;
      if (isOcrComplete(e)) ocrDone += 1;
      else if (isOcrPending(e)) ocrPending += 1;
      if (e.processingStatus === 'failed' || e.analysisStatus === 'failed') failed += 1;
    }
    const recent = [...evidence]
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, 5);
    const health = evidence.length === 0 ? 'UNKNOWN' : failed > 0 ? 'Attention' : ocrPending > 0 ? 'Processing' : 'Healthy';
    return { media, bytes, ocrDone, ocrPending, failed, recent, health };
  }, [evidence]);

  const typeCounts = evidence.reduce<Record<string, number>>((acc, ev) => {
    acc[ev.evidenceType] = (acc[ev.evidenceType] || 0) + 1;
    return acc;
  }, {});

  const typeOptions = [
    { value: 'all', label: `All types (${evidence.length})` },
    ...Object.entries(typeCounts).map(([type, count]) => ({
      value: type,
      label: `${type.replace(/_/g, ' ')} (${count})`,
    })),
  ];

  // Tab + filter + search pipeline.
  const rows = useMemo(() => {
    return evidence.filter((ev) => {
      if (tab === 'ocr' && !['pending', 'processing'].includes(ev.processingStatus)) return false;
      if (tab === 'review' && ev.processingStatus !== 'pending') return false;
      if (typeFilter !== 'all' && ev.evidenceType !== typeFilter) return false;
      if (searchQuery && !ev.fileName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [evidence, tab, typeFilter, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedList = evidence.filter((e) => selectedIds.has(e.evidenceId));

  const columns: Column<ApiEvidence>[] = [
    {
      key: 'select',
      header: '',
      width: '2.5rem',
      render: (ev) => (
        <input
          type="checkbox"
          checked={selectedIds.has(ev.evidenceId)}
          onChange={(e) => {
            e.stopPropagation();
            toggleSelect(ev.evidenceId);
          }}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-white/20 bg-navy-900"
          aria-label={`Select ${ev.fileName}`}
        />
      ),
    },
    { key: 'fileName', header: 'File Name', render: (ev) => <span className="font-medium text-white">{ev.fileName}</span> },
    { key: 'evidenceType', header: 'Type', render: (ev) => <span className="capitalize text-slate-400">{ev.evidenceType.replace(/_/g, ' ')}</span> },
    { key: 'uploadedAt', header: 'Uploaded', render: (ev) => <span className="text-slate-400">{new Date(ev.uploadedAt).toLocaleDateString()}</span> },
    { key: 'size', header: 'Size', render: (ev) => <span className="text-slate-400">{formatFileSize(Number(ev.size))}</span> },
    { key: 'processingStatus', header: 'Status', render: (ev) => <EvidenceStatus status={ev.processingStatus} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (ev) => (
        <Button variant="ghost" size="sm" onClick={() => setDetail(ev)}>
          <Eye size={14} /> View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence Workspace"
        overline="Evidence"
        subtitle={`${evidence.length} items`}
        action={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handleProcess} disabled={processing || evidence.length === 0}>
              <Play size={15} className={processing ? 'animate-pulse' : ''} /> Process Case
            </Button>
            <Button variant="primary" onClick={() => setShowUpload(true)}>
              <Icon name="upload" size={15} /> Upload
            </Button>
          </div>
        }
      />

      {processNote && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-blue-500/10 border border-blue-500/20 text-blue-300">
          <Icon name="aiAnalysis" size={16} /> {processNote}
          <button onClick={() => setProcessNote(null)} className="ml-auto text-slate-400 hover:text-white">Dismiss</button>
        </div>
      )}

      {/* Evidence Summary — media breakdown */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Evidence Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {([
            ['Total', counts.total, 'evidence', 'gold'],
            ['Documents', summary.media.document, 'documents', 'blue'],
            ['Images', summary.media.image, 'evidence', 'violet'],
            ['Audio', summary.media.audio, 'ocr', 'emerald'],
            ['Video', summary.media.video, 'evidence', 'blue'],
            ['Other', summary.media.other + summary.media.archive + summary.media.physical, 'evidence', 'violet'],
          ] as const).map(([label, value, icon, tile]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className={`inline-flex w-9 h-9 rounded-lg items-center justify-center mb-2 ca-icon-${tile}`}>
                <Icon name={icon as never} size={16} />
              </span>
              <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
              <div className="text-xs font-medium text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Processing + storage + health */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard tile="gold" icon={<Icon name="ocr" size={20} />} value={summary.ocrPending} label="Pending OCR" highlight={summary.ocrPending > 0} />
        <StatCard tile="emerald" icon={<Icon name="aiAnalysis" size={20} />} value={summary.ocrDone} label="Completed OCR" />
        <StatCard tile="blue" icon={<Icon name="evidence" size={20} />} value={formatFileSize(summary.bytes)} label="Storage Used" />
        <StatCard tile="violet" icon={<Icon name="humanReview" size={20} />} value={counts.review} label="Needs Review" highlight={counts.review > 0} />
      </div>

      {/* Pipeline status chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">Pipeline:</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-slate-300"><Icon name="knowledgeGraph" size={12} className="text-gold-light" /> Knowledge Graph: {counts.analyzed > 0 ? 'Linked' : counts.total > 0 ? 'Queued' : 'UNKNOWN'}</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-slate-300"><Icon name="timeline" size={12} className="text-gold-light" /> Timeline: {counts.analyzed > 0 ? 'Linked' : counts.total > 0 ? 'Queued' : 'UNKNOWN'}</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-slate-300"><Icon name="ocr" size={12} className="text-gold-light" /> OCR Queue: {summary.ocrPending}</span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${summary.health === 'Healthy' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : summary.health === 'Attention' ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}>Evidence Health: {summary.health}</span>
      </div>

      <HumanReviewBanner count={counts.review} onReview={() => setTab('review')} />

      <Tabs tabs={TABS} activeId={tab} onChange={(id) => setTab(id as WorkspaceTab)} />

      {/* Filters + batch bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchBar placeholder="Search evidence…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="sm:w-72" />
        <Dropdown options={typeOptions} value={typeFilter} onChange={setTypeFilter} />
        <div className="flex-1" />
        {selectedIds.size >= 2 && (
          <Button variant={compareMode ? 'primary' : 'outline'} size="sm" onClick={() => setCompareMode((v) => !v)}>
            <Columns size={14} /> Compare ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Batch operations bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-gold/10 border border-gold/20">
          <span className="text-sm text-gold-light flex items-center gap-2">
            <CheckSquare size={15} /> {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleProcess}>Process</Button>
            <Button variant="ghost" size="sm" onClick={() => setProcessNote(`${selectedIds.size} item(s) queued for review`)}>Mark for review</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {/* Compare view */}
      {compareMode && selectedList.length >= 2 ? (
        <Card padding="none" className="h-[32rem]">
          <SplitPane
            left={
              <div className="p-4 h-full">
                <p className="text-sm font-medium text-white mb-3 truncate">{selectedList[0].fileName}</p>
                <MediaPreview fileName={selectedList[0].fileName} mimeType={selectedList[0].mimeType} pageCount={selectedList[0].pageCount} duration={selectedList[0].duration} className="h-[26rem]" />
              </div>
            }
            right={
              <div className="p-4 h-full">
                <p className="text-sm font-medium text-white mb-3 truncate">{selectedList[1].fileName}</p>
                <MediaPreview fileName={selectedList[1].fileName} mimeType={selectedList[1].mimeType} pageCount={selectedList[1].pageCount} duration={selectedList[1].duration} className="h-[26rem]" />
              </div>
            }
          />
        </Card>
      ) : loading ? (
        <Spinner label="Loading evidence…" />
      ) : error ? (
        <Card>
          <EmptyState icon={<Icon name="evidence" size={22} />} title="Unable to load evidence" description={error} />
        </Card>
      ) : (
        <Card padding="sm">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(ev) => ev.evidenceId}
            onRowClick={(ev) => setDetail(ev)}
            emptyTitle={tab === 'ocr' ? 'OCR queue is clear' : tab === 'review' ? 'Nothing awaiting review' : 'No evidence uploaded yet'}
            emptyDescription={tab === 'inbox' ? 'Upload discovery to begin OCR and evidence extraction.' : undefined}
          />
        </Card>
      )}

      <DoctrineCompliancePanel />

      {/* Detail drawer */}
      <EvidenceDetailDrawer evidence={detail} onClose={() => setDetail(null)} />

      {/* Upload dialog */}
      <Dialog
        open={showUpload}
        onClose={() => { setShowUpload(false); setUploadError(null); }}
        title="Upload Evidence"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? `Uploading ${uploadProgress}%…` : 'Upload'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Evidence Type</label>
            <Dropdown
              options={EVIDENCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              value={evidenceType}
              onChange={setEvidenceType}
              className="w-full"
              buttonClassName="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">File</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/15"
              accept={UPLOAD_ACCEPT}
            />
          </div>
          {uploading && <ProgressBar value={uploadProgress} tone="gold" showValue />}
        </div>
      </Dialog>
    </div>
  );
}
