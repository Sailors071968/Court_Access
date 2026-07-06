// =============================================================================
// CourtAccess — Document Analysis Panel (Program 29)
// Right-side extraction & intelligence panel. Progressive disclosure via tabs.
// Reusable. Reflects real processing status; never fabricates extracted content.
// =============================================================================

import { useState } from 'react';
import { Icon } from '../icons/registry';
import { Tabs } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { ProgressRing } from '../ui/progress';
import { EmptyState } from '../ui/empty-state';
import { UnknownIndicator, StatusBadge } from '../indicators/indicators';
import type { ApiEvidence } from '../../services/caseApi';

type PanelTab = 'overview' | 'entities' | 'citations' | 'issues' | 'annotations' | 'audit';

const TABS = [
  { id: 'overview', label: 'Overview', icon: <Icon name="aiAnalysis" size={14} /> },
  { id: 'entities', label: 'Entities', icon: <Icon name="knowledgeGraph" size={14} /> },
  { id: 'citations', label: 'Citations', icon: <Icon name="statutes" size={14} /> },
  { id: 'issues', label: 'Issues', icon: <Icon name="contradiction" size={14} /> },
  { id: 'annotations', label: 'Notes', icon: <Icon name="documents" size={14} /> },
  { id: 'audit', label: 'Audit', icon: <Icon name="audit" size={14} /> },
];

const EXTRACTION_CATEGORIES = [
  { key: 'evidence', label: 'Evidence extraction', icon: 'evidence' as const },
  { key: 'witness', label: 'Witness extraction', icon: 'witness' as const },
  { key: 'timeline', label: 'Timeline extraction', icon: 'timeline' as const },
  { key: 'charge', label: 'Charge extraction', icon: 'statutes' as const },
  { key: 'authority', label: 'Authority extraction', icon: 'authorities' as const },
];

interface DocumentAnalysisPanelProps {
  evidence: ApiEvidence;
  className?: string;
}

export function DocumentAnalysisPanel({ evidence, className }: DocumentAnalysisPanelProps) {
  const [tab, setTab] = useState<PanelTab>('overview');
  const analyzed = evidence.processingStatus === 'analyzed';

  return (
    <div className={className}>
      <div className="px-3 pt-3">
        <Tabs tabs={TABS} activeId={tab} onChange={(id) => setTab(id as PanelTab)} variant="pill" />
      </div>

      <div className="p-4">
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="flex flex-col items-center py-2">
              <ProgressRing value={0} label="UNKNOWN" tone="gold" />
              <p className="text-xs text-slate-400 mt-3 text-center">Extraction confidence is computed from the record; no value is estimated.</p>
            </div>
            <div className="space-y-2">
              <Row label="OCR" value={<StatusBadge status={evidence.processingStatus} />} />
              <Row label="Pages" value={<span className="text-slate-200">{evidence.pageCount ?? '—'}</span>} />
              <Row label="Multiplex" value={<span className="text-slate-200">{evidence.multiplexDetected ? `Yes (${evidence.multiplexCount ?? 0})` : 'No'}</span>} />
            </div>
          </div>
        )}

        {tab === 'entities' && (
          <div className="space-y-2">
            {EXTRACTION_CATEGORIES.map((cat) => (
              <div key={cat.key} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                <span className="flex items-center gap-2 text-sm text-slate-200">
                  <Icon name={cat.icon} size={15} variant="selected" /> {cat.label}
                </span>
                {analyzed ? <Badge variant="success">Processed</Badge> : <Badge variant="default">Pending</Badge>}
              </div>
            ))}
          </div>
        )}

        {tab === 'citations' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Citations mapped from this document (side-by-side verifiable).</p>
            <EmptyState icon={<Icon name="statutes" size={20} />} title="No mapped citations" description="Verified citations populate from extraction output — none are fabricated." />
          </div>
        )}

        {tab === 'issues' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
              <span className="text-sm text-slate-200">Contradictions</span>
              <Badge variant="default">UNKNOWN</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
              <span className="text-sm text-slate-200">Issue detection</span>
              <Badge variant="default">{analyzed ? 'Processed' : 'Pending'}</Badge>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.03]">
              <UnknownIndicator label="Unknowns flagged during extraction appear here" />
            </div>
          </div>
        )}

        {tab === 'annotations' && (
          <EmptyState icon={<Icon name="documents" size={20} />} title="No annotations yet" description="Highlight text in the reader to add annotations and bookmarks." />
        )}

        {tab === 'audit' && (
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li><span className="text-slate-500">{new Date(evidence.uploadedAt).toLocaleString()}</span> — Uploaded by {evidence.uploadedBy}</li>
            {analyzed && <li className="text-emerald-400">Extraction completed · audit trail sealed</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03]">
      <span className="text-sm text-slate-400">{label}</span>
      {value}
    </div>
  );
}
