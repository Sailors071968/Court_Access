// =============================================================================
// CourtAccess — Report Engine (Program 30)
// One reusable renderer for every report type. Preview modes (document / PDF /
// Word / print / presentation), section nav, citation & audit links, evidence
// drill-down, human-review indicators, live updates. No duplicated report logic.
// =============================================================================

import { useEffect, useState } from 'react';
import { Download, Printer, Presentation, ChevronLeft, ChevronRight, X, FileText, UserCheck } from 'lucide-react';
import { Icon } from '../icons/registry';
import { Dropdown } from '../ui/dropdown';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import type { CitationRef } from '../../services/workbenchApi';
import { REPORT_TYPES, type ReportDoc, type ReportBlock, type ReportPreviewMode, type ReportType } from './types';

interface ReportEngineProps {
  report: ReportDoc;
  reportType: ReportType;
  onChangeType: (t: ReportType) => void;
  onDrillCitation?: (ref: CitationRef) => void;
  loading?: boolean;
  className?: string;
}

const MODE_LABEL: Record<ReportPreviewMode, string> = {
  document: 'Document',
  pdf: 'PDF',
  word: 'Word',
  presentation: 'Slides',
};

export function ReportEngine({ report, reportType, onChangeType, onDrillCitation, loading, className }: ReportEngineProps) {
  const [mode, setMode] = useState<ReportPreviewMode>('document');
  const [activeSection, setActiveSection] = useState(0);
  const [presenting, setPresenting] = useState(false);

  useEffect(() => setActiveSection(0), [reportType]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 print:hidden">
        <Dropdown
          options={REPORT_TYPES.map((r) => ({ value: r.id, label: r.label }))}
          value={reportType}
          onChange={(v) => onChangeType(v as ReportType)}
          className="lg:w-64"
          buttonClassName="w-full"
        />
        <div className="flex items-center gap-1 rounded-xl border border-white/10 p-1">
          {(['document', 'pdf', 'word'] as ReportPreviewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                mode === m ? 'bg-gold/10 text-gold-light' : 'text-slate-400 hover:text-white',
              )}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPresenting(true)}><Presentation size={14} /> Present</Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={14} /> Print</Button>
          <Button variant="primary" size="sm"><Download size={14} /> Export</Button>
        </div>
      </div>

      {loading ? (
        <div className="h-96 rounded-xl bg-white/5 animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[14rem_1fr] gap-6">
          {/* Section nav */}
          <nav className="print:hidden space-y-1" aria-label="Report sections">
            {report.sections.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(i)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  i === activeSection ? 'bg-gold/10 text-gold-light' : 'text-slate-400 hover:text-white hover:bg-white/5',
                )}
              >
                {s.icon && <Icon name={s.icon} size={14} />}
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </nav>

          {/* Paper */}
          <div
            className={cn(
              'report-paper mx-auto w-full bg-[#faf8f3] text-slate-100 rounded-xl shadow-elevated',
              mode === 'pdf' && 'ring-1 ring-black/10',
              mode === 'word' && 'max-w-3xl',
            )}
          >
            <div className="px-8 py-8 sm:px-12 sm:py-10">
              <header className="border-b border-white/10 pb-5 mb-6">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                  <FileText size={13} /> CourtAccess · {MODE_LABEL[mode]} preview
                </div>
                <h1 className="text-3xl font-bold text-white mt-3 font-serif">{report.title}</h1>
                {report.subtitle && <p className="text-sm text-slate-400 mt-1">{report.subtitle}</p>}
                <p className="text-xs text-slate-400 mt-1">Generated {new Date(report.generatedAt).toLocaleString()}</p>
              </header>

              {/* In document/word mode show all sections; in pdf mode paginate visually */}
              {(mode === 'document' || mode === 'word' ? report.sections : [report.sections[activeSection]])
                .filter(Boolean)
                .map((section) => (
                  <section key={section.id} className="mb-8 last:mb-0">
                    <h2 className="text-lg font-bold text-white font-serif mb-3">{section.title}</h2>
                    <div className="space-y-3">
                      {section.blocks.map((block, bi) => (
                        <ReportBlockView key={bi} block={block} onDrillCitation={onDrillCitation} />
                      ))}
                    </div>
                  </section>
                ))}

              {mode === 'pdf' && report.sections.length > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4 border-t border-white/10 print:hidden">
                  <button onClick={() => setActiveSection((i) => Math.max(0, i - 1))} disabled={activeSection === 0} className="text-slate-400 disabled:opacity-40"><ChevronLeft size={16} /></button>
                  <span className="text-xs text-slate-400">Page {activeSection + 1} / {report.sections.length}</span>
                  <button onClick={() => setActiveSection((i) => Math.min(report.sections.length - 1, i + 1))} disabled={activeSection === report.sections.length - 1} className="text-slate-400 disabled:opacity-40"><ChevronRight size={16} /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {presenting && <PresentationDeck report={report} onClose={() => setPresenting(false)} />}
    </div>
  );
}

function ReportBlockView({ block, onDrillCitation }: { block: ReportBlock; onDrillCitation?: (ref: CitationRef) => void }) {
  switch (block.kind) {
    case 'paragraph':
      return <p className="text-[15px] leading-7 text-slate-200 font-serif">{block.text}</p>;
    case 'list':
      return block.ordered ? (
        <ol className="list-decimal list-inside space-y-1 text-[15px] text-slate-200">{block.items.map((it, i) => <li key={i}>{it}</li>)}</ol>
      ) : (
        <ul className="list-disc list-inside space-y-1 text-[15px] text-slate-200">{block.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
      );
    case 'keyvalue':
      return (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
          {block.rows.map((r, i) => (
            <div key={i} className="flex justify-between border-b border-slate-100 py-1">
              <dt className="text-sm text-slate-400">{r.label}</dt>
              <dd className="text-sm font-medium text-slate-100">{r.value}</dd>
            </div>
          ))}
        </dl>
      );
    case 'table':
      return (
        <table className="w-full text-sm border border-white/10">
          <thead>
            <tr className="bg-white/10">
              {block.headers.map((h) => <th key={h} className="text-left py-2 px-3 font-semibold text-slate-300 border-b border-white/10">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} className="odd:bg-white/5 even:bg-white/5/60">
                {row.map((cell, ci) => <td key={ci} className="py-2 px-3 text-slate-200 border-b border-slate-100 align-top">{cell || '—'}</td>)}
              </tr>
            ))}
            {block.rows.length === 0 && <tr><td colSpan={block.headers.length} className="py-3 px-3 text-center text-slate-400">No entries.</td></tr>}
          </tbody>
        </table>
      );
    case 'citations':
      return (
        <div className="flex flex-wrap gap-1.5">
          {block.refs.map((ref, i) => (
            <button
              key={i}
              onClick={() => onDrillCitation?.(ref)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 hover:bg-amber-500/15"
            >
              {ref.type}:{ref.label ?? ref.id.slice(0, 6)}
            </button>
          ))}
        </div>
      );
    case 'callout':
      return (
        <div className={cn('rounded-lg border px-3 py-2 text-sm', block.tone === 'danger' ? 'border-red-500/20 bg-red-500/10 text-red-300' : block.tone === 'warning' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-blue-500/20 bg-blue-500/10 text-blue-300')}>
          {block.text}
        </div>
      );
    case 'humanReview':
      return (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-500/10 px-3 py-2">
          <UserCheck size={16} className="text-amber-300" />
          <span className="text-sm text-amber-300"><strong>{block.count}</strong> item{block.count === 1 ? '' : 's'} require human review. {block.note}</span>
        </div>
      );
    default:
      return null;
  }
}

function PresentationDeck({ report, onClose }: { report: ReportDoc; onClose: () => void }) {
  const [i, setI] = useState(0);
  const section = report.sections[i];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((p) => Math.min(p + 1, report.sections.length - 1));
      else if (e.key === 'ArrowLeft') setI((p) => Math.max(p - 1, 0));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [report.sections.length, onClose]);

  return (
    <div className="fixed inset-0 z-[80] ca-gradient-hero flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <p className="text-sm font-semibold text-gold-light uppercase tracking-wide">{report.title}</p>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><X size={18} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-3xl w-full animate-slide-up">
          <h2 className="text-4xl font-bold text-white mb-8 font-serif">{section.title}</h2>
          <div className="space-y-4 text-slate-200">
            {section.blocks.map((b, bi) => (
              <div key={bi} className="[&_*]:!text-slate-200">
                <div className="text-lg"><PresentationBlock block={b} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
        <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white disabled:opacity-40"><ChevronLeft size={16} /> Previous</button>
        <span className="text-xs text-slate-400">{i + 1} / {report.sections.length}</span>
        <button onClick={() => setI(Math.min(report.sections.length - 1, i + 1))} disabled={i === report.sections.length - 1} className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white disabled:opacity-40">Next <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

function PresentationBlock({ block }: { block: ReportBlock }) {
  if (block.kind === 'paragraph') return <p>{block.text}</p>;
  if (block.kind === 'list') return <ul className="list-disc list-inside space-y-2">{block.items.slice(0, 8).map((it, i) => <li key={i}>{it}</li>)}</ul>;
  if (block.kind === 'keyvalue') return <dl className="space-y-2">{block.rows.map((r, i) => <div key={i} className="flex justify-between border-b border-white/10 pb-1"><dt className="text-slate-400">{r.label}</dt><dd>{r.value}</dd></div>)}</dl>;
  if (block.kind === 'table') return <p className="text-slate-400">{block.rows.length} entries — see full report.</p>;
  if (block.kind === 'callout' || block.kind === 'humanReview') return <p className="text-gold-light">{block.kind === 'humanReview' ? `${block.count} items need review` : block.text}</p>;
  return null;
}
