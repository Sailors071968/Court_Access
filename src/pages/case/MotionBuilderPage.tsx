// ============================================================================
// CourtAccess — Canonical Motion Builder & Motion Intelligence Engine (Program 89)
// Repository-backed motion drafting. Every factual statement cites repository
// evidence/timeline; every legal statement cites a real authority. Sections
// with no repository support are marked UNKNOWN (attorney input required) —
// never fabricated. Export to Print/PDF and DOCX.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2, Printer, AlertTriangle, ArrowLeft, Gavel, BookOpen, FolderOpen,
  Network, Users, Clock, ShieldCheck, ScrollText, FileDown, StickyNote, Layers, RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  fetchMotionTypes, fetchMotionDraft, type MotionTypeMeta, type MotionDraft, type MotionTypeId,
  type MotionParagraph, type MotionSupportItem,
} from '../../services/motionBuilderApi';

function isUnknown(v: string | null | undefined): boolean {
  return !v || v === 'UNKNOWN' || v.startsWith('UNKNOWN');
}

function SupportBadge({ level }: { level: 'supported' | 'partial' | 'unknown' }) {
  if (level === 'supported') return <Badge variant="emerald">Repository-supported</Badge>;
  if (level === 'partial') return <Badge variant="amber">Partial</Badge>;
  return <Badge variant="slate">UNKNOWN</Badge>;
}

function Chips({ items }: { items: { type: string; id: string; label?: string }[] }) {
  if (!items || items.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 ml-1 align-middle">
      {items.slice(0, 6).map((c, i) => (
        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700/70 border border-white/10 text-slate-300 font-mono">
          {c.type}:{(c.label ?? c.id).slice(0, 18)}
        </span>
      ))}
      {items.length > 6 && <span className="text-[10px] text-slate-500">+{items.length - 6}</span>}
    </span>
  );
}

function Paragraph({ p }: { p: MotionParagraph }) {
  return (
    <p className={`text-sm leading-relaxed ${p.unknown ? 'text-amber-300/90' : 'text-slate-200'}`}>
      {p.unknown && <span className="ca-overline text-[10px] text-amber-400 mr-2">[ATTORNEY INPUT REQUIRED]</span>}
      {p.text}
      <Chips items={p.citations} />
    </p>
  );
}

function SupportList({ title, items, icon: Icon }: { title: string; items: MotionSupportItem[]; icon: React.ElementType }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-gold-light" />
        <span className="ca-overline text-[10px]">{title} <span className="text-slate-500">({items.length})</span></span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-amber-400/80 italic">UNKNOWN — none in repository</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 12).map((it) => (
            <li key={it.id} className="text-xs rounded-lg bg-navy-800/40 border border-white/5 px-2.5 py-1.5">
              <div className="text-slate-100">{it.label}</div>
              {it.detail && <div className="text-slate-400 mt-0.5">{it.detail}</div>}
            </li>
          ))}
          {items.length > 12 && <li className="text-[11px] text-slate-500">+{items.length - 12} more</li>}
        </ul>
      )}
    </div>
  );
}

type PanelId = 'authorities' | 'evidence' | 'repository' | 'graph' | 'review' | 'notes';

const PANELS: { id: PanelId; label: string; icon: React.ElementType }[] = [
  { id: 'authorities', label: 'Authorities', icon: BookOpen },
  { id: 'evidence', label: 'Evidence', icon: FolderOpen },
  { id: 'repository', label: 'Repository', icon: Layers },
  { id: 'graph', label: 'Graph', icon: Network },
  { id: 'review', label: 'Review', icon: ShieldCheck },
  { id: 'notes', label: 'Notes', icon: StickyNote },
];

function buildDocHtml(draft: MotionDraft, notes: string): string {
  const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const h = draft.header;
  const sections = draft.draft.sections
    .map(
      (s) =>
        `<h2 style="font-size:13pt;margin:16pt 0 6pt;">${esc(s.title)}</h2>` +
        s.paragraphs
          .map((p) => `<p style="margin:0 0 8pt;text-align:justify;">${p.unknown ? '<b>[ATTORNEY INPUT REQUIRED] </b>' : ''}${esc(p.text)}</p>`)
          .join(''),
    )
    .join('');
  const notesHtml = notes.trim() ? `<h2 style="font-size:13pt;margin:16pt 0 6pt;">Attorney Notes</h2><p style="white-space:pre-wrap;">${esc(notes)}</p>` : '';
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(h.motionTitle)}</title></head>
<body style="font-family:'Times New Roman',serif;font-size:12pt;color:#000;">
<div style="text-align:center;margin-bottom:18pt;">
<div style="font-weight:bold;letter-spacing:1pt;">COURTACCESS</div>
<div style="font-size:9pt;color:#555;">TRUTH · EVIDENCE · JUSTICE</div>
</div>
<table style="width:100%;font-size:11pt;margin-bottom:12pt;"><tr>
<td>${esc(h.court)}<br/>${esc(h.caseTitle)}<br/>Case No. ${esc(h.caseNumber)}</td>
<td style="text-align:right;">Judge: ${esc(h.judge)}<br/>Attorney: ${esc(h.attorney)}<br/>Generated: ${esc(new Date(h.generatedAt).toLocaleString())}</td>
</tr></table>
<h1 style="font-size:15pt;text-align:center;text-transform:uppercase;">${esc(h.motionTitle)}</h1>
<p style="font-size:9pt;color:#555;">Repository: ${esc(h.repositoryVersion)} · Integrity: ${esc(h.repositoryStatus)} · Knowledge Graph: ${esc(h.knowledgeGraphStatus)} · Hash: ${esc(draft.reproducibilityHash.slice(0, 24))}…</p>
<hr/>
${sections}
${notesHtml}
<hr/>
<p style="font-size:8pt;color:#777;">Generated by CourtAccess Motion Builder v${esc(draft.motionVersion)}. Every factual assertion is drawn from the case repository; items marked UNKNOWN require attorney verification. This document is not legal advice and must be reviewed by counsel before filing.</p>
</body></html>`;
}

export function MotionBuilderPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [types, setTypes] = useState<MotionTypeMeta[]>([]);
  const [selected, setSelected] = useState<MotionTypeId>('suppress');
  const [draft, setDraft] = useState<MotionDraft | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelId>('authorities');
  const [notes, setNotes] = useState('');

  const notesKey = useMemo(() => `ca-motion-notes-${caseId}-${selected}`, [caseId, selected]);

  useEffect(() => {
    if (!caseId) return;
    (async () => {
      setLoadingTypes(true);
      try {
        const t = await fetchMotionTypes(caseId);
        setTypes(t);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load motion types');
      } finally {
        setLoadingTypes(false);
      }
    })();
  }, [caseId]);

  const loadDraft = async (mt: MotionTypeId) => {
    if (!caseId) return;
    setLoadingDraft(true);
    try {
      setDraft(await fetchMotionDraft(caseId, mt));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate motion');
    } finally {
      setLoadingDraft(false);
    }
  };

  useEffect(() => { void loadDraft(selected); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selected, caseId]);
  useEffect(() => { setNotes(localStorage.getItem(notesKey) ?? ''); }, [notesKey]);

  const saveNotes = (v: string) => { setNotes(v); localStorage.setItem(notesKey, v); };

  const exportDocx = () => {
    if (!draft) return;
    const html = buildDocHtml(draft, notes);
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.header.motionTitle.replace(/[^a-z0-9]+/gi, '_')}_${draft.caseId.slice(0, 8)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grouped = useMemo(() => {
    const m = new Map<string, MotionTypeMeta[]>();
    for (const t of types) { const arr = m.get(t.category) ?? []; arr.push(t); m.set(t.category, arr); }
    return Array.from(m.entries());
  }, [types]);

  return (
    <div className="motion-builder pb-16">
      {/* Header hero (screen only) */}
      <div className="print:hidden mb-6">
        <Link to={`/cases/${caseId}/overview`} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-gold-light mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to case overview
        </Link>
        <div className="ca-panel p-6 md:p-8 relative overflow-hidden">
          <div className="absolute inset-0 ca-gradient-gold opacity-[0.06] pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="ca-overline">Canonical Motion Builder{draft ? ` · v${draft.motionVersion}` : ''}</div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-50 mt-1 tracking-tight flex items-center gap-3">
                <Gavel className="w-7 h-7 text-gold-light" /> {draft?.header.motionTitle ?? 'Motion Builder'}
              </h1>
              {draft && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge variant="gold">{draft.header.caseTitle}</Badge>
                  {draft.header.caseNumber !== 'UNKNOWN' && <Badge variant="navy">{draft.header.caseNumber}</Badge>}
                  <SupportBadge level={(types.find((t) => t.id === selected)?.repositorySupport) ?? 'unknown'} />
                  <span className="text-xs text-slate-400">Generated {new Date(draft.header.generatedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="secondary" onClick={() => void loadDraft(selected)} disabled={loadingDraft}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingDraft ? 'animate-spin' : ''}`} />Regenerate
              </Button>
              <Button variant="secondary" onClick={exportDocx} disabled={!draft}><FileDown className="w-4 h-4 mr-2" />DOCX</Button>
              <Button variant="primary" onClick={() => window.print()} disabled={!draft}><Printer className="w-4 h-4 mr-2" />PDF / Print</Button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="print:hidden ca-panel p-4 mb-4 flex items-center gap-3 border border-amber-500/30">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span className="text-sm text-slate-200">{error}</span>
          <Button size="sm" variant="secondary" onClick={() => void loadDraft(selected)}>Retry</Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_340px] gap-6">
        {/* ---- Motion List ---- */}
        <aside className="print:hidden space-y-4">
          <div className="ca-panel p-4">
            <div className="ca-overline mb-3">Motion Types</div>
            {loadingTypes ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : (
              <div className="space-y-4">
                {grouped.map(([cat, items]) => (
                  <div key={cat}>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">{cat}</div>
                    <div className="space-y-1">
                      {items.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelected(t.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${selected === t.id ? 'bg-gold-light/10 border-gold-light/40' : 'bg-navy-800/30 border-white/5 hover:border-white/20'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm ${selected === t.id ? 'text-gold-light font-semibold' : 'text-slate-200'}`}>{t.label}</span>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.repositorySupport === 'supported' ? 'bg-emerald-400' : t.repositorySupport === 'partial' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ---- Motion Document (printable) ---- */}
        <main className="min-w-0">
          {loadingDraft && !draft ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-gold-light" />
              <p>Generating repository-backed motion…</p>
            </div>
          ) : draft ? (
            <div className="report-root">
              {/* Print cover */}
              <div className="report-cover hidden print:block mb-6">
                <div className="text-2xl font-bold tracking-tight">CourtAccess</div>
                <div className="ca-overline mt-1">Truth · Evidence · Justice</div>
                <p className="text-sm mt-6">{draft.header.court}</p>
                <p className="text-sm">{draft.header.caseTitle} · Case No. {draft.header.caseNumber}</p>
                <h1 className="text-3xl font-bold mt-8 uppercase">{draft.header.motionTitle}</h1>
                <p className="text-xs mt-6 text-slate-600">Judge {draft.header.judge} · Attorney {draft.header.attorney}</p>
                <p className="text-xs mt-1 text-slate-500 font-mono">Repository {draft.header.repositoryVersion} · Hash {draft.reproducibilityHash.slice(0, 28)}…</p>
              </div>

              {/* Screen header block */}
              <div className="report-section ca-panel p-6 mb-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ['Motion', draft.header.motionTitle], ['Case', draft.header.caseTitle], ['Court', draft.header.court],
                    ['Judge', draft.header.judge], ['Attorney', draft.header.attorney], ['Repository', draft.header.repositoryStatus],
                    ['Knowledge Graph', draft.header.knowledgeGraphStatus], ['Repository Version', draft.header.repositoryVersion],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-navy-800/50 border border-white/5 px-3 py-2">
                      <div className="ca-overline text-[10px]">{l}</div>
                      <div className={`text-sm mt-0.5 ${isUnknown(v) ? 'text-amber-400 font-medium' : 'text-slate-100'}`}>{isUnknown(v) ? 'UNKNOWN' : v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Draft sections */}
              <div className="report-section ca-panel p-6 md:p-8 space-y-6">
                {draft.draft.sections.map((s) => (
                  <div key={s.id} className="report-charge">
                    <h2 className="text-lg font-bold text-slate-50 mb-2 border-b border-white/10 pb-1.5">{s.title}</h2>
                    <div className="space-y-2.5">
                      {s.paragraphs.map((p, i) => <Paragraph key={i} p={p} />)}
                    </div>
                  </div>
                ))}
              </div>

              <p className="report-footer text-center text-xs text-slate-500 mt-8">
                CourtAccess · Motion Builder v{draft.motionVersion} · Repository-backed · Items marked UNKNOWN require attorney verification · Not legal advice
              </p>
            </div>
          ) : (
            <div className="ca-panel p-10 text-center text-slate-400">Select a motion type to generate a repository-backed draft.</div>
          )}
        </main>

        {/* ---- Side Panels ---- */}
        <aside className="print:hidden space-y-4">
          <div className="ca-panel p-2">
            <div className="grid grid-cols-3 gap-1">
              {PANELS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPanel(p.id)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] transition-colors ${panel === p.id ? 'bg-gold-light/10 text-gold-light' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <p.icon className="w-4 h-4" />{p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ca-panel p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {!draft ? (
              <p className="text-sm text-slate-400">No draft loaded.</p>
            ) : panel === 'authorities' ? (
              <>
                <SupportList title="Supporting Authorities" items={draft.repositoryAnalysis.supportingAuthorities} icon={BookOpen} />
                <SupportList title="CALCRIM" items={draft.repositoryAnalysis.supportingCalcrim} icon={ScrollText} />
                <div>
                  <div className="ca-overline text-[10px] mb-2">Provider Availability</div>
                  {draft.authorityPanel.providerAvailability.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs rounded-lg bg-navy-800/40 px-2.5 py-1.5 mb-1 border border-white/5">
                      <span className="text-slate-300">{p.provider}</span>
                      <span className={isUnknown(p.status) ? 'text-amber-400' : 'text-slate-200'}>{p.status}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : panel === 'evidence' ? (
              <>
                <SupportList title="Supporting Evidence" items={draft.repositoryAnalysis.supportingEvidence} icon={FolderOpen} />
                <SupportList title="Supporting Witnesses" items={draft.repositoryAnalysis.supportingWitnesses} icon={Users} />
                <SupportList title="Supporting Discovery" items={draft.repositoryAnalysis.supportingDiscovery} icon={FolderOpen} />
                <SupportList title="Supporting Timeline" items={draft.repositoryAnalysis.supportingTimeline} icon={Clock} />
              </>
            ) : panel === 'repository' ? (
              <>
                <SupportList title="Repository Records (Charges)" items={draft.repositoryAnalysis.supportingRepositoryRecords} icon={Layers} />
                <div>
                  <div className="ca-overline text-[10px] mb-2">Repository References</div>
                  {draft.evidencePanel.repositoryReferences.length === 0 ? (
                    <p className="text-xs text-amber-400/80 italic">UNKNOWN — none</p>
                  ) : draft.evidencePanel.repositoryReferences.map((r, i) => (
                    <div key={i} className="text-xs text-slate-200 rounded-lg bg-navy-800/40 px-2.5 py-1.5 mb-1 border border-white/5">{r.code} {r.section} — {r.title}</div>
                  ))}
                </div>
              </>
            ) : panel === 'graph' ? (
              <div>
                <div className="ca-overline text-[10px] mb-2">Knowledge Graph</div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg bg-navy-800/50 px-3 py-2 text-center"><div className="text-xl font-bold text-gold-light">{draft.evidencePanel.knowledgeGraph.nodeCount}</div><div className="ca-overline text-[9px]">Nodes</div></div>
                  <div className="rounded-lg bg-navy-800/50 px-3 py-2 text-center"><div className="text-xl font-bold text-gold-light">{draft.evidencePanel.knowledgeGraph.edgeCount}</div><div className="ca-overline text-[9px]">Edges</div></div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(draft.evidencePanel.knowledgeGraph.byType).map(([t, n]) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-navy-800/60 border border-white/10 text-slate-300">{t}: <span className="text-gold-light">{n}</span></span>
                  ))}
                </div>
                <Link to={`/cases/${caseId}/knowledge-graph`} className="inline-flex items-center gap-1.5 text-xs text-gold-light hover:underline mt-3"><Network className="w-3.5 h-3.5" /> Open interactive graph</Link>
              </div>
            ) : panel === 'review' ? (
              <>
                <div className="rounded-xl bg-navy-800/40 border border-white/5 px-3 py-2.5">
                  <div className="ca-overline text-[10px]">Repository Confidence</div>
                  <div className="text-sm text-slate-100 mt-0.5">{draft.attorneyReview.repositoryConfidence.value}</div>
                  {draft.attorneyReview.repositoryConfidence.note && <div className="text-xs text-slate-400 mt-1">{draft.attorneyReview.repositoryConfidence.note}</div>}
                </div>
                <ReviewList title="Human Review Required" items={draft.attorneyReview.humanReviewRequired} tone="amber" />
                <ReviewList title="Missing Authorities" items={draft.attorneyReview.missingAuthorities} tone="amber" />
                <ReviewList title="Unknown Evidence" items={draft.attorneyReview.unknownEvidence} tone="slate" />
                <SupportList title="Contradictions" items={draft.attorneyReview.contradictions.map((c) => ({ id: c.id, label: c.value, detail: c.note ?? undefined, citations: c.citations }))} icon={AlertTriangle} />
                <SupportList title="Repository Gaps" items={draft.attorneyReview.repositoryGaps.map((c) => ({ id: c.id, label: c.value, detail: c.note ?? undefined, citations: c.citations }))} icon={AlertTriangle} />
                <SupportList title="Missing Evidence" items={draft.attorneyReview.missingEvidence.map((c) => ({ id: c.id, label: c.value, detail: c.note ?? undefined, citations: c.citations }))} icon={FolderOpen} />
              </>
            ) : (
              <div>
                <div className="ca-overline text-[10px] mb-2">Attorney Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => saveNotes(e.target.value)}
                  placeholder="Private working notes for this motion…"
                  className="w-full h-56 rounded-xl bg-navy-900/50 border border-white/10 px-3 py-2 text-sm text-slate-100 focus:border-gold-light/50 focus:outline-none resize-none"
                />
                <p className="text-[11px] text-slate-500 mt-2">{draft.attorneyNotesHint} Saved locally in this browser; included in DOCX export.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReviewList({ title, items, tone }: { title: string; items: string[]; tone: 'amber' | 'slate' }) {
  return (
    <div>
      <div className="ca-overline text-[10px] mb-2">{title} <span className="text-slate-500">({items.length})</span></div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic">None</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 10).map((it, i) => (
            <li key={i} className={`text-xs rounded-lg px-2.5 py-1.5 border ${tone === 'amber' ? 'bg-amber-500/5 border-amber-500/20 text-slate-200' : 'bg-navy-800/40 border-white/5 text-slate-300'}`}>{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
