// ============================================================================
// CourtAccess — Canonical Trial Preparation Command Center (Program 90)
// The attorney's primary pre-trial environment. Every readiness metric,
// exhibit, witness-prep item, timeline entry, authority, and checklist item is
// repository-backed. UNKNOWN is shown wherever repository evidence is
// insufficient — trial strategy, testimony, exhibits, and authorities are
// never fabricated. Exports: Print/PDF, DOCX (Notebook / Exhibit / Witness index).
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2, Printer, RefreshCw, AlertTriangle, ArrowLeft, Gauge, Users, FileBox, Clock,
  BookOpen, CheckSquare, NotebookPen, Network, FileDown, ChevronDown, ShieldCheck, Gavel, FileText,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  fetchTrialPrep, type TrialPrepReport, type TrialReadinessMetric, type TrialNotebookItem,
  type TrialChecklistItem, type TrialCitation,
} from '../../services/trialPrepApi';

const SECTIONS = [
  { id: 'overview', label: 'Trial Overview', icon: Gauge },
  { id: 'witnesses', label: 'Witness Prep', icon: Users },
  { id: 'exhibits', label: 'Exhibit Manager', icon: FileBox },
  { id: 'timeline', label: 'Trial Timeline', icon: Clock },
  { id: 'authorities', label: 'Authorities', icon: BookOpen },
  { id: 'checklist', label: 'Trial Checklist', icon: CheckSquare },
  { id: 'notebook', label: 'Trial Notebook', icon: NotebookPen },
  { id: 'graph', label: 'Knowledge Graph', icon: Network },
];

function isUnknown(v: string | null | undefined): boolean {
  return !v || v === 'UNKNOWN' || v.startsWith('UNKNOWN');
}

function statusColor(status: string): string {
  if (status === 'ready') return 'emerald';
  if (status === 'partial') return 'amber';
  if (status === 'incomplete') return 'danger';
  return 'slate';
}

function Chips({ items }: { items: TrialCitation[] }) {
  if (!items || items.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 ml-1 align-middle">
      {items.slice(0, 6).map((c, i) => (
        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700/70 border border-white/10 text-slate-300 font-mono">
          {c.type}:{(c.label ?? c.id).slice(0, 16)}
        </span>
      ))}
      {items.length > 6 && <span className="text-[10px] text-slate-500">+{items.length - 6}</span>}
    </span>
  );
}

function Section({ id, title, icon: Icon, meta, children }: { id: string; title: string; icon: React.ElementType; meta?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="report-section scroll-mt-24 ca-panel p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl ca-gradient-gold flex items-center justify-center text-navy shadow-gold"><Icon className="w-5 h-5" /></span>
          <h2 className="text-xl md:text-2xl font-bold text-slate-50 tracking-tight">{title}</h2>
        </div>
        {meta && <span className="text-xs text-slate-400 font-medium hidden md:inline">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ m }: { m: TrialReadinessMetric }) {
  const tone = statusColor(m.status);
  const toneClass = tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : tone === 'danger' ? 'text-red-400' : 'text-slate-400';
  return (
    <div className="rounded-2xl bg-navy-800/50 border border-white/5 p-4">
      <div className="flex items-center justify-between">
        <span className="ca-overline text-[10px]">{m.label}</span>
        <Badge variant={tone as 'emerald' | 'amber' | 'danger' | 'slate'}>{m.status.toUpperCase()}</Badge>
      </div>
      <div className={`text-lg font-bold mt-2 ${m.score == null ? 'text-amber-400' : toneClass}`}>{m.value}</div>
      {m.score != null && (
        <div className="h-1.5 rounded-full bg-navy-900 mt-2 overflow-hidden">
          <div className={`h-full rounded-full ${tone === 'emerald' ? 'bg-emerald-400' : tone === 'amber' ? 'bg-amber-400' : tone === 'danger' ? 'bg-red-400' : 'bg-slate-500'}`} style={{ width: `${m.score}%` }} />
        </div>
      )}
      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{m.note}</p>
    </div>
  );
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function downloadDoc(title: string, bodyHtml: string, caseId: string, tp: TrialPrepReport) {
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="font-family:'Times New Roman',serif;font-size:12pt;color:#000;">
<div style="text-align:center;margin-bottom:14pt;"><div style="font-weight:bold;letter-spacing:1pt;">COURTACCESS</div><div style="font-size:9pt;color:#555;">TRUTH · EVIDENCE · JUSTICE</div></div>
<h1 style="font-size:15pt;text-align:center;">${esc(title)}</h1>
<p style="font-size:10pt;">${esc(tp.header.caseTitle)} · Case No. ${esc(tp.header.caseNumber)} · ${esc(tp.header.court)}</p>
<p style="font-size:8pt;color:#555;">Repository ${esc(tp.header.repositoryVersion)} · Hash ${esc(tp.reproducibilityHash.slice(0, 24))}… · Generated ${esc(new Date(tp.header.generatedAt).toLocaleString())}</p>
<hr/>${bodyHtml}<hr/>
<p style="font-size:8pt;color:#777;">Generated by CourtAccess Trial Preparation v${esc(tp.trialPrepVersion)}. Repository-backed; items marked UNKNOWN require attorney verification. Not legal advice.</p>
</body></html>`;
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, '_')}_${caseId.slice(0, 8)}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TrialPrepPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [tp, setTp] = useState<TrialPrepReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const notesKey = useMemo(() => `ca-trial-notes-${caseId}`, [caseId]);

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      setTp(await fetchTrialPrep(caseId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trial preparation');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [caseId]);
  useEffect(() => { setNotes(localStorage.getItem(notesKey) ?? ''); }, [notesKey]);
  const saveNotes = (v: string) => { setNotes(v); localStorage.setItem(notesKey, v); };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-gold-light" />
        <p>Assembling repository-backed trial preparation…</p>
      </div>
    );
  }
  if (error || !tp) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <p className="text-slate-300">{error ?? 'No trial preparation data.'}</p>
        <Button onClick={() => void load()} variant="secondary"><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
      </div>
    );
  }

  const h = tp.header;
  const d = tp.dashboard;
  const metrics = [d.caseReadiness, d.evidenceReadiness, d.witnessReadiness, d.motionReadiness, d.discoveryStatus, d.repositoryCoverage, d.knowledgeGraphHealth, d.timelineCompleteness, d.humanReview];

  const exportNotebook = () => {
    const nb = tp.notebook;
    const group = (t: string, items: TrialNotebookItem[]) => `<h2 style="font-size:13pt;margin:14pt 0 4pt;">${esc(t)}</h2>` + (items.length ? items.map((i) => `<p style="margin:0 0 6pt;"><b>${esc(i.title)}:</b> ${esc(i.detail)} <span style="font-size:8pt;color:#777;">[${esc(i.confidence)}]</span></p>`).join('') : '<p style="color:#b45309;">UNKNOWN — none in repository.</p>');
    const body = group('Issue List', nb.issueList) + group('Voir Dire', nb.voirDire) + group('Opening', nb.opening) + group('Direct Examination', nb.directExamination) + group('Cross Examination', nb.crossExamination) + group('Objections / Impeachment', nb.objections) + group('Closing', nb.closing) + group('Trial Notebook', nb.trialNotebook) + (notes.trim() ? `<h2 style="font-size:13pt;margin:14pt 0 4pt;">Attorney Notes</h2><p style="white-space:pre-wrap;">${esc(notes)}</p>` : '');
    downloadDoc('Trial Notebook', body, caseId!, tp);
    setExportOpen(false);
  };
  const exportExhibits = () => {
    const rows = tp.exhibits.map((e) => `<tr><td>${esc(e.exhibitNumber)}</td><td>${esc(e.evidenceItem)}</td><td>${esc(e.evidenceType)}</td><td>${esc(e.hashVerification)}</td><td>${esc(e.chainOfCustody)}</td><td>${esc(e.admissionStatus)}</td></tr>`).join('');
    const body = tp.exhibits.length ? `<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:10pt;"><tr><th>#</th><th>Evidence</th><th>Type</th><th>Hash</th><th>Chain of Custody</th><th>Admission</th></tr>${rows}</table>` : '<p style="color:#b45309;">UNKNOWN — no exhibits in repository.</p>';
    downloadDoc('Exhibit Index', body, caseId!, tp);
    setExportOpen(false);
  };
  const exportWitnesses = () => {
    const rows = tp.witnessPrep.map((w) => `<tr><td>${esc(w.name)}</td><td>${esc(w.witnessType)}</td><td>${esc(w.interviewStatus)}</td><td>${esc(w.credibilityStatus)}</td><td>${w.timelineLinks.length}</td></tr>`).join('');
    const body = tp.witnessPrep.length ? `<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:10pt;"><tr><th>Witness</th><th>Type</th><th>Interview</th><th>Credibility</th><th>Timeline Links</th></tr>${rows}</table>` : '<p style="color:#b45309;">UNKNOWN — no witnesses in repository.</p>';
    downloadDoc('Witness Index', body, caseId!, tp);
    setExportOpen(false);
  };

  return (
    <div className="report-root max-w-6xl mx-auto pb-16">
      {/* Print cover */}
      <div className="report-cover hidden print:block mb-8">
        <div className="text-3xl font-bold tracking-tight">CourtAccess</div>
        <div className="ca-overline mt-1">Truth · Evidence · Justice</div>
        <h1 className="text-4xl font-bold mt-8">Trial Preparation</h1>
        <p className="text-lg mt-2">{h.caseTitle} · {h.caseNumber}</p>
        <p className="text-sm mt-6 text-slate-600">{h.court} · Judge {h.judge}</p>
        <p className="text-xs mt-1 text-slate-500 font-mono">Repository {h.repositoryVersion} · Hash {tp.reproducibilityHash.slice(0, 28)}…</p>
      </div>

      {/* Screen header hero */}
      <div className="print:hidden mb-6">
        <Link to={`/cases/${caseId}/overview`} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-gold-light mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to case overview
        </Link>
        <div className="ca-panel p-6 md:p-8 relative overflow-hidden">
          <div className="absolute inset-0 ca-gradient-gold opacity-[0.06] pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="ca-overline">Trial Preparation Command Center · v{tp.trialPrepVersion}</div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-50 mt-1 tracking-tight flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-gold-light" /> {h.caseTitle}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="gold">{h.caseNumber}</Badge>
                <Badge variant="navy">{h.court}</Badge>
                <span className="text-xs text-slate-400">Trial date: {h.trialDate ? new Date(h.trialDate).toLocaleDateString() : 'UNKNOWN'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 relative">
              <Button variant="secondary" onClick={() => void load()}><RefreshCw className="w-4 h-4 mr-2" />Regenerate</Button>
              <div className="relative">
                <Button variant="secondary" onClick={() => setExportOpen((o) => !o)}><FileDown className="w-4 h-4 mr-2" />DOCX<ChevronDown className="w-3 h-3 ml-1" /></Button>
                {exportOpen && (
                  <div className="absolute right-0 mt-1 w-52 rounded-xl bg-navy-800 border border-white/10 shadow-xl z-20 py-1">
                    <button onClick={exportNotebook} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5">Trial Notebook</button>
                    <button onClick={exportExhibits} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5">Exhibit Index</button>
                    <button onClick={exportWitnesses} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5">Witness Index</button>
                  </div>
                )}
              </div>
              <Button variant="primary" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />PDF / Print</Button>
            </div>
          </div>
        </div>
      </div>

      {/* TOC */}
      <nav className="report-toc ca-panel p-5 mb-8 print:hidden">
        <div className="ca-overline mb-3">Command Center</div>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-navy-800/50 border border-white/5 text-slate-300 hover:text-gold-light hover:border-gold-light/30 transition-colors">
              <s.icon className="w-3.5 h-3.5" />{s.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="space-y-6">
        {/* 1. Trial Overview / Dashboard */}
        <Section id="overview" title="Trial Overview" icon={Gauge} meta={`Repository ${h.repositoryVersion}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.map((m) => <MetricCard key={m.id} m={m} />)}
          </div>
          <div className="flex flex-wrap gap-2 mt-4 print:hidden">
            <Link to={`/cases/${caseId}/report`} className="text-sm text-gold-light hover:underline inline-flex items-center gap-1.5"><FileText className="w-4 h-4" />Attorney Report</Link>
            <span className="text-slate-600">·</span>
            <Link to={`/cases/${caseId}/motions`} className="text-sm text-gold-light hover:underline inline-flex items-center gap-1.5"><Gavel className="w-4 h-4" />Motion Builder</Link>
          </div>
        </Section>

        {/* 2. Witness Preparation */}
        <Section id="witnesses" title="Witness Preparation" icon={Users} meta={`${tp.witnessPrep.length} witness(es)`}>
          {tp.witnessPrep.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No witnesses recorded — witness preparation is UNKNOWN.</p>
          ) : (
            <div className="space-y-4">
              {tp.witnessPrep.map((w) => (
                <div key={w.id} className="report-charge rounded-2xl border border-white/10 bg-navy-800/40 p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-lg font-bold text-slate-50">{w.name}</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="navy">{isUnknown(w.witnessType) ? 'UNKNOWN type' : w.witnessType}</Badge>
                        <Badge variant="slate">{w.interviewStatus}</Badge>
                        <Badge variant={isUnknown(w.credibilityStatus) ? 'slate' : 'amber'}>credibility: {isUnknown(w.credibilityStatus) ? 'UNKNOWN' : w.credibilityStatus}</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 text-right">
                      Timeline links: {w.timelineLinks.length}<br />KG: {w.knowledgeGraphLinked ? 'linked' : 'UNKNOWN'}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <div className="ca-overline text-[10px] mb-1">Potential Impeachment</div>
                      {w.potentialImpeachment.length === 0 ? <span className="text-xs text-amber-400/80">UNKNOWN — none in repository</span> : (
                        <ul className="space-y-1">{w.potentialImpeachment.map((it, i) => <li key={i} className="text-xs text-slate-200">{it.text}<Chips items={it.citations} /></li>)}</ul>
                      )}
                    </div>
                    <div>
                      <div className="ca-overline text-[10px] mb-1">Cross-Examination Notes</div>
                      {w.crossExaminationNotes.length === 0 ? <span className="text-xs text-amber-400/80">UNKNOWN — none in repository</span> : (
                        <ul className="space-y-1">{w.crossExaminationNotes.map((it, i) => <li key={i} className="text-xs text-slate-200">{it.text}<Chips items={it.citations} /></li>)}</ul>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">Prior statements: <span className="text-amber-400/80">{w.priorStatements}</span></div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 3. Exhibit Manager */}
        <Section id="exhibits" title="Exhibit Manager" icon={FileBox} meta={`${tp.exhibits.length} exhibit(s)`}>
          {tp.exhibits.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No evidence uploaded — exhibit list is UNKNOWN.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tp.exhibits.map((e) => (
                <div key={e.repositoryId} className="report-charge rounded-2xl border border-white/10 bg-navy-800/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gold-light">Exhibit {e.exhibitNumber}</span>
                    <Badge variant={isUnknown(e.hashVerification) ? 'slate' : 'emerald'}>{isUnknown(e.hashVerification) ? 'hash UNKNOWN' : 'hash verified'}</Badge>
                  </div>
                  <div className="text-sm text-slate-100 mt-1 truncate">{e.evidenceItem}</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
                    <div><span className="text-slate-500">Type:</span> <span className="text-slate-300">{e.evidenceType}</span></div>
                    <div><span className="text-slate-500">OCR:</span> <span className="text-slate-300">{e.ocrStatus}</span></div>
                    <div><span className="text-slate-500">Chain:</span> <span className={isUnknown(e.chainOfCustody) ? 'text-amber-400' : 'text-slate-300'}>{e.chainOfCustody}</span></div>
                    <div><span className="text-slate-500">Admission:</span> <span className="text-amber-400">{e.admissionStatus}</span></div>
                    <div className="col-span-2"><span className="text-slate-500">Repository ID:</span> <span className="font-mono text-slate-400">{e.repositoryId.slice(0, 16)}…</span></div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {e.relatedTimelineEvents.length > 0 && <Badge variant="info">timeline linked</Badge>}
                    {e.knowledgeGraphLinked && <Badge variant="gold">KG</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 4. Trial Timeline */}
        <Section id="timeline" title="Trial Timeline" icon={Clock} meta={`${tp.trialTimeline.events.length} event(s)`}>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(tp.trialTimeline.buckets).map(([b, n]) => (
              <span key={b} className="text-xs px-2.5 py-1 rounded-lg bg-navy-800/60 border border-white/10 text-slate-300 capitalize">{b}: <span className="text-gold-light font-semibold">{n}</span></span>
            ))}
            {tp.trialTimeline.events.length === 0 && <span className="text-sm text-amber-400/80 italic">UNKNOWN — no timeline events in repository.</span>}
          </div>
          <div className="space-y-1.5">
            {tp.trialTimeline.events.slice(0, 60).map((t) => (
              <div key={t.id} className="flex items-start gap-3 rounded-lg bg-navy-800/40 px-3 py-2 border border-white/5">
                <Badge variant="slate">{t.bucket}</Badge>
                <div className="w-40 flex-shrink-0 text-xs text-slate-400">{t.timestamp ? new Date(t.timestamp).toLocaleString() : (t.timeText || 'UNKNOWN')}</div>
                <div className="min-w-0 flex-1 text-sm text-slate-100">{t.description}{t.actor ? <span className="text-slate-500"> — {t.actor}</span> : ''}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 5. Authority Preparation */}
        <Section id="authorities" title="Authority Preparation" icon={BookOpen}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="ca-overline text-[10px] mb-2">California Statutes</div>
              {tp.authorities.statutes.length === 0 ? <span className="text-xs text-amber-400/80 italic">UNKNOWN — no repository match</span> : (
                <ul className="text-sm text-slate-200 space-y-1">{tp.authorities.statutes.map((s, i) => <li key={i}>{s.code} {s.section} — {s.title}</li>)}</ul>
              )}
            </div>
            <div>
              <div className="ca-overline text-[10px] mb-2">CALCRIM Instructions</div>
              {tp.authorities.calcrim.length === 0 ? <span className="text-xs text-amber-400/80 italic">UNKNOWN — none linked</span> : (
                <ul className="text-sm text-slate-200 space-y-1">{tp.authorities.calcrim.map((c, i) => <li key={i}>{c.instructionNumber} — {c.title}</li>)}</ul>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="ca-overline text-[10px] mb-2">Provider Availability</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {tp.authorities.providerAvailability.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm rounded-lg bg-navy-800/40 px-3 py-2 border border-white/5">
                  <span className="text-slate-300">{p.provider}</span>
                  <span className={isUnknown(p.status) ? 'text-amber-400' : 'text-slate-200'}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 6. Trial Checklist */}
        <Section id="checklist" title="Trial Checklist" icon={CheckSquare}>
          <div className="space-y-2">
            {tp.checklist.map((c: TrialChecklistItem) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl bg-navy-800/40 border border-white/5 px-4 py-3">
                <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold ${c.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400' : c.status === 'incomplete' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {c.status === 'ready' ? '✓' : c.status === 'incomplete' ? '!' : '?'}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100">{c.label} <Badge variant={c.status === 'ready' ? 'emerald' : c.status === 'incomplete' ? 'danger' : 'slate'}>{c.status.toUpperCase()}</Badge></div>
                  <div className="text-xs text-slate-400 mt-0.5">{c.detail}</div>
                  <Chips items={c.citations} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 7. Trial Notebook */}
        <Section id="notebook" title="Trial Notebook" icon={NotebookPen}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <NotebookGroup title="Issue List" items={tp.notebook.issueList} />
            <NotebookGroup title="Voir Dire" items={tp.notebook.voirDire} />
            <NotebookGroup title="Opening" items={tp.notebook.opening} />
            <NotebookGroup title="Direct Examination" items={tp.notebook.directExamination} />
            <NotebookGroup title="Cross-Examination" items={tp.notebook.crossExamination} />
            <NotebookGroup title="Objections / Impeachment" items={tp.notebook.objections} />
            <NotebookGroup title="Closing" items={tp.notebook.closing} />
            <NotebookGroup title="Trial Notebook" items={tp.notebook.trialNotebook} />
          </div>
          <div className="mt-5 print:hidden">
            <div className="ca-overline text-[10px] mb-2">Attorney Notes (private, saved in this browser · included in DOCX)</div>
            <textarea value={notes} onChange={(e) => saveNotes(e.target.value)} placeholder="Trial strategy notes, reminders, to-dos…" className="w-full h-40 rounded-xl bg-navy-900/50 border border-white/10 px-3 py-2 text-sm text-slate-100 focus:border-gold-light/50 focus:outline-none resize-none" />
          </div>
          {notes.trim() && <div className="hidden print:block mt-4"><div className="ca-overline text-[10px] mb-1">Attorney Notes</div><p className="text-sm whitespace-pre-wrap">{notes}</p></div>}
        </Section>

        {/* 8. Knowledge Graph */}
        <Section id="graph" title="Knowledge Graph" icon={Network} meta={`status: ${tp.knowledgeGraph.status}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-navy-800/50 px-4 py-3 text-center"><div className="text-2xl font-bold text-gold-light">{tp.knowledgeGraph.nodeCount}</div><div className="ca-overline text-[10px] mt-1">Nodes</div></div>
            <div className="rounded-xl bg-navy-800/50 px-4 py-3 text-center"><div className="text-2xl font-bold text-gold-light">{tp.knowledgeGraph.edgeCount}</div><div className="ca-overline text-[10px] mt-1">Edges</div></div>
            <div className="rounded-xl bg-navy-800/50 px-4 py-3 text-center"><div className="text-2xl font-bold text-gold-light">{Object.keys(tp.knowledgeGraph.byType).length}</div><div className="ca-overline text-[10px] mt-1">Node Types</div></div>
            <div className="rounded-xl bg-navy-800/50 px-4 py-3 text-center"><div className="text-sm font-bold text-slate-100 mt-1.5">{tp.knowledgeGraph.status}</div><div className="ca-overline text-[10px] mt-1">Status</div></div>
          </div>
          <Link to={`/cases/${caseId}/knowledge-graph`} className="print:hidden inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline mt-4"><Network className="w-4 h-4" />Open interactive knowledge graph</Link>
        </Section>
      </div>

      <p className="report-footer text-center text-xs text-slate-500 mt-10">
        CourtAccess · Trial Preparation Command Center v{tp.trialPrepVersion} · Repository-backed · Items marked UNKNOWN require attorney verification · Not legal advice
      </p>
    </div>
  );
}

function NotebookGroup({ title, items }: { title: string; items: TrialNotebookItem[] }) {
  return (
    <div className="rounded-xl bg-navy-800/30 border border-white/5 p-4">
      <div className="ca-overline text-[10px] mb-2">{title} <span className="text-slate-500">({items.length})</span></div>
      {items.length === 0 ? (
        <span className="text-xs text-amber-400/80 italic">UNKNOWN — none in repository</span>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 12).map((i) => (
            <li key={i.id} className="text-xs rounded-lg bg-navy-900/40 px-2.5 py-1.5">
              <span className="text-slate-100 font-medium">{i.title}</span>
              {i.detail && i.detail !== i.title && <span className="text-slate-400"> — {i.detail}</span>}
              <Chips items={i.citations} />
            </li>
          ))}
          {items.length > 12 && <li className="text-[11px] text-slate-500">+{items.length - 12} more</li>}
        </ul>
      )}
    </div>
  );
}
