// =============================================================================
// CourtAccess — Evidence Detail Drawer (Program 28)
// Slide-over with progressive-disclosure sections. Reusable across workspaces.
// =============================================================================

import { X } from 'lucide-react';
import { MediaPreview } from './MediaPreview';
import { Accordion } from '../ui/accordion';
import { Badge } from '../ui/badge';
import { Icon } from '../icons/registry';
import { EvidenceStatus, OcrStatus, CitationIndicator, UnknownIndicator } from '../indicators/indicators';
import type { ApiEvidence } from '../../services/caseApi';
import { cn } from '../../lib/utils';

interface EvidenceDetailDrawerProps {
  evidence: ApiEvidence | null;
  onClose: () => void;
}

function ocrStateFromStatus(status: string): 'queued' | 'processing' | 'complete' | 'failed' {
  if (status === 'analyzed') return 'complete';
  if (status === 'processing') return 'processing';
  if (status === 'failed') return 'failed';
  return 'queued';
}

export function EvidenceDetailDrawer({ evidence, onClose }: EvidenceDetailDrawerProps) {
  if (!evidence) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label={`Evidence: ${evidence.fileName}`}
        className={cn('relative w-full max-w-md ca-panel !rounded-none border-l border-white/10 h-full overflow-y-auto animate-slide-up')}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 sticky top-0 bg-navy-800/90 backdrop-blur-md z-10">
          <div className="min-w-0">
            <Badge variant="default">{evidence.evidenceType.replace(/_/g, ' ')}</Badge>
            <h3 className="text-sm font-semibold text-white mt-1 truncate">{evidence.fileName}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <MediaPreview
            fileName={evidence.fileName}
            mimeType={evidence.mimeType}
            pageCount={evidence.pageCount}
            duration={evidence.duration}
          />

          <div className="flex flex-wrap items-center gap-2">
            <EvidenceStatus status={evidence.processingStatus} />
            <OcrStatus state={ocrStateFromStatus(evidence.processingStatus)} />
          </div>

          <Accordion
            defaultOpenIds={['identity', 'extraction']}
            items={[
              {
                id: 'identity',
                title: 'File & Identity',
                icon: <Icon name="documents" size={15} />,
                content: (
                  <div className="space-y-2 text-sm text-slate-300">
                    <Row label="Evidence ID" value={evidence.evidenceId} mono />
                    <Row label="SHA-256" value={evidence.sha256 ? `${evidence.sha256.slice(0, 20)}…` : 'UNKNOWN'} mono title={evidence.sha256 ?? undefined} />
                    <Row label="Size" value={formatBytes(evidence.size)} />
                    <Row label="MIME type" value={evidence.mimeType ?? 'UNKNOWN'} />
                    <Row label="Type" value={evidence.evidenceType.replace(/_/g, ' ')} />
                    <Row label="Uploaded" value={new Date(evidence.uploadedAt).toLocaleString()} />
                    <Row label="Uploader" value={evidence.uploadedBy} mono />
                  </div>
                ),
              },
              {
                id: 'extraction',
                title: 'Extraction Status',
                icon: <Icon name="aiAnalysis" size={15} />,
                content: (
                  <div className="space-y-2 text-sm text-slate-300">
                    <Row label="Pages" value={evidence.pageCount ? String(evidence.pageCount) : '—'} />
                    <Row label="Normalized pages" value={evidence.normalizedPageCount ? String(evidence.normalizedPageCount) : '—'} />
                    <Row label="Multiplex detected" value={evidence.multiplexDetected ? `Yes (${evidence.multiplexCount ?? 0})` : 'No'} />
                    {evidence.processingError && <p className="text-red-400 text-xs">{evidence.processingError}</p>}
                  </div>
                ),
              },
              {
                id: 'citations',
                title: 'Citation Verification',
                icon: <Icon name="statutes" size={15} />,
                content: (
                  <div className="flex flex-wrap gap-1.5">
                    <CitationIndicator source={`EV-${evidence.evidenceId.slice(0, 6)}`} />
                    <span className="text-xs text-slate-400">Citations verify once extraction completes.</span>
                  </div>
                ),
              },
              {
                id: 'findings',
                title: 'Contradictions & Unknowns',
                icon: <Icon name="contradiction" size={15} />,
                content: (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400">Findings populate from evidence-governed analysis once extraction completes.</p>
                    <UnknownIndicator label="No unknowns flagged" />
                  </div>
                ),
              },
              {
                id: 'custody',
                title: 'Chain of Custody',
                icon: <Icon name="security" size={15} />,
                content: (
                  <ul className="space-y-1.5 text-xs text-slate-400">
                    <li><span className="text-slate-400">{new Date(evidence.uploadedAt).toLocaleString()}</span> — Uploaded by {evidence.uploadedBy}</li>
                    <li><span className="text-slate-400">Integrity</span> — {evidence.sha256 ? `SHA-256 ${evidence.sha256.slice(0, 16)}…` : 'Hash UNKNOWN'}</li>
                    <li><span className="text-slate-400">Storage</span> — {evidence.s3Key ? 'Sealed in evidence vault' : 'Pending'}</li>
                  </ul>
                ),
              },
              {
                id: 'tags',
                title: 'Tags, Collections & Bookmarks',
                icon: <Icon name="filters" size={15} />,
                content: (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="gold">{evidence.evidenceType.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="text-xs text-slate-400">Add tags, collections, and bookmarks to organize evidence.</p>
                  </div>
                ),
              },
              {
                id: 'relationships',
                title: 'Relationships',
                icon: <Icon name="knowledgeGraph" size={15} />,
                content: <p className="text-sm text-slate-400">Linked entities appear in the Knowledge Graph.</p>,
              },
              {
                id: 'versions',
                title: 'Version & Audit History',
                icon: <Icon name="audit" size={15} />,
                content: (
                  <ul className="space-y-1.5 text-xs text-slate-400">
                    <li><span className="text-slate-400">v1</span> — Original upload · {new Date(evidence.uploadedAt).toLocaleDateString()}</li>
                    <li className="text-emerald-400">Audit trail available</li>
                  </ul>
                ),
              },
            ]}
          />
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, mono, title }: { label: string; value: string; mono?: boolean; title?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400 flex-shrink-0">{label}</span>
      <span className={cn('text-slate-200 truncate text-right', mono && 'font-mono text-xs')} title={title}>{value}</span>
    </div>
  );
}

function formatBytes(size: string | number): string {
  const b = Number(size);
  if (!b || isNaN(b)) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
