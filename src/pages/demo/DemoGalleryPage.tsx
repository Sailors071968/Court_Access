// ============================================================================
// Premium Illustrative Demonstration Gallery (public, read-only)
// Executive litigation-intelligence dashboard matching the CourtAccess premium
// visual reference. Every value is a clearly-labeled illustrative example.
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale, ShieldCheck, Gem, ClipboardCheck, FileText, Users, BookOpen, Landmark, AlertTriangle,
  Network, Clock, Search, ArrowRight, Gavel, Map, HelpCircle, Brain, RefreshCw, ShieldAlert,
  FileCheck2, GitBranch,
} from 'lucide-react';
import { DemoShell } from './DemoShell';
import { KnowledgeGraphWorkspace } from '../../components/graph/KnowledgeGraphWorkspace';
import {
  demoCase, demoStats, demoScorecard, demoKeyFindings, demoTimeline, demoKnowledgeGraph,
  demoWorkspaces, demoReports, demoKgSignificance, type DemoTimelineEvent, type DemoReportType,
} from './demoData';

const ICONS: Record<string, React.ElementType> = {
  workbench: Gavel, report: FileText, contradiction: GitBranch, shield: ShieldCheck, search: Search,
  graph: Network, timeline: Clock, map: Map, evidence: FileCheck2, calcrim: Scale, sentencing: ShieldAlert,
};

// ── Premium gradient scorecard card ─────────────────────────────────────────
function ScoreCard({ icon: Icon, label, value, tier, sub, gradient, ring }: {
  icon: React.ElementType; label: string; value: number; tier: string; sub: string; gradient: string; ring: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 p-6 ${gradient} transition-transform hover:-translate-y-0.5`}>
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full blur-2xl opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle, currentColor, transparent 70%)' }} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">{label}</div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-5xl font-extrabold text-white tracking-tight">{value}</span>
            <span className="text-2xl font-bold text-white/80">%</span>
          </div>
          <div className={`text-sm font-bold mt-1 ${ring}`}>{tier}</div>
          <p className="text-xs text-white/70 mt-2 max-w-[16rem]">{sub}</p>
        </div>
        <span className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-white/10 ring-1 ring-white/20 ${ring}`}><Icon className="w-7 h-7" /></span>
      </div>
    </div>
  );
}

const KIND_DOT: Record<DemoTimelineEvent['kind'], string> = {
  incident: 'bg-red-400', investigation: 'bg-blue-400', evidence: 'bg-emerald-400', discovery: 'bg-violet-400', court: 'bg-gold-light',
};

// ── Interactive timeline (Phase 8) ──────────────────────────────────────────
export function DemoTimelineSection({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const events = compact ? demoTimeline.slice(0, 6) : demoTimeline;
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-white/10" />
      <div className="space-y-3">
        {events.map((t, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="relative">
              <span className={`absolute -left-[18px] top-3 w-3 h-3 rounded-full ring-4 ring-navy-800 ${KIND_DOT[t.kind]}`} />
              <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="w-full text-left ca-panel p-4 hover:border-gold-light/30 transition-colors">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gold-light">{t.phase}</span>
                    <span className="text-xs text-slate-500">{t.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.contradictions && t.contradictions.length > 0 && <span className="text-[10px] font-bold uppercase text-red-300 bg-red-500/15 px-2 py-0.5 rounded">conflict</span>}
                    <ArrowRight className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-100 mt-1">{t.title}</div>
                <div className="text-sm text-slate-400 mt-0.5">{t.detail}</div>
                {isOpen && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-white/10 pt-3">
                    <DetailList label="Source / Evidence" items={[...(t.sources ?? []), ...(t.evidence ?? [])]} />
                    <DetailList label="Witnesses" items={t.witnesses ?? []} />
                    <DetailList label="Related Charges" items={t.charges ?? []} />
                    <DetailList label="Contradictions" items={(t.contradictions ?? []).map((c) => `flag ${c}`)} tone="red" />
                    {t.note && <div className="sm:col-span-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">Attorney note: {t.note}</div>}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailList({ label, items, tone }: { label: string; items: string[]; tone?: 'red' }) {
  return (
    <div>
      <div className="ca-overline text-[9px] mb-1">{label}</div>
      {items.length === 0 ? <span className="text-[11px] text-slate-500">UNKNOWN / none</span> : (
        <ul className="space-y-0.5">{items.map((it, i) => <li key={i} className={`text-[11px] ${tone === 'red' ? 'text-red-300' : 'text-slate-300'}`}>{it}</li>)}</ul>
      )}
    </div>
  );
}

// ── Knowledge graph section with significance legend ─────────────────────────
export function DemoKnowledgeGraphSection() {
  return (
    <div>
      <div className="ca-panel p-2 md:p-4"><KnowledgeGraphWorkspace data={demoKnowledgeGraph} height={520} /></div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        {Object.entries(demoKgSignificance).slice(0, 6).map(([id, s]) => (
          <div key={id} className="text-xs rounded-lg bg-navy-800/40 border border-white/5 px-3 py-2">
            <span className="text-gold-light font-semibold">{demoKnowledgeGraph.nodes.find((n) => n.id === id)?.label ?? id}</span>
            <span className="text-slate-300"> — {s.significance}</span>
            {s.affects && <span className="text-slate-500"> ({s.affects})</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const REPORT_ORDER: DemoReportType[] = ['attorney-report', 'motion', 'calcrim', 'sentencing', 'evidence', 'discovery', 'timeline', 'witness', 'knowledge-graph', 'voir-dire', 'trial-prep', 'repository'];

function findingTone(tone: string) {
  if (tone === 'weakness') return { icon: AlertTriangle, cls: 'text-amber-300', bar: 'bg-amber-400' };
  if (tone === 'contradiction') return { icon: GitBranch, cls: 'text-red-300', bar: 'bg-red-400' };
  return { icon: ShieldCheck, cls: 'text-emerald-300', bar: 'bg-emerald-400' };
}

export function DemoGalleryPage() {
  return (
    <DemoShell>
      {/* ── Case header hero (reference layout) ── */}
      <section className="relative rounded-3xl overflow-hidden mb-6 border border-white/10">
        <img src="/hero-courthouse.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-900/95 via-navy-900/85 to-navy-800/80" />
        <div className="relative px-6 md:px-10 py-8 md:py-10">
          <div className="flex items-start gap-5">
            <span className="hidden sm:flex w-20 h-20 rounded-2xl ca-gradient-gold items-center justify-center text-navy shadow-gold flex-shrink-0"><Scale className="w-11 h-11" /></span>
            <div className="min-w-0">
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-full px-3 py-1 mb-3">Illustrative Example · Demonstration Only</span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">{demoCase.title}</h1>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-3 mt-5">
                {[
                  ['Case No.', demoCase.caseNumber], ['Court', demoCase.court], ['Judge', demoCase.judge],
                  ['Status', demoCase.status], ['Next Hearing', `${demoCase.nextHearing}`],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{l}</div>
                    <div className={`text-sm mt-0.5 ${l === 'Status' ? 'text-emerald-400 font-semibold' : 'text-slate-100'}`}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Premium scorecard ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ScoreCard icon={ShieldCheck} label="Case Strength" value={demoScorecard.caseStrength.value} tier={demoScorecard.caseStrength.label} sub={demoScorecard.caseStrength.sub} gradient="bg-gradient-to-br from-emerald-600/25 to-navy-900/60" ring="text-emerald-300" />
        <ScoreCard icon={Gem} label="Evidence Confidence" value={demoScorecard.evidenceConfidence.value} tier={demoScorecard.evidenceConfidence.label} sub={demoScorecard.evidenceConfidence.sub} gradient="bg-gradient-to-br from-blue-600/25 to-navy-900/60" ring="text-blue-300" />
        <ScoreCard icon={ClipboardCheck} label="Overall Completeness" value={demoScorecard.completeness.value} tier={demoScorecard.completeness.label} sub={demoScorecard.completeness.sub} gradient="bg-gradient-to-br from-violet-600/25 to-navy-900/60" ring="text-violet-300" />
      </section>

      {/* ── Evidence Summary · Key Findings · Timeline ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Evidence Summary */}
        <div className="ca-panel p-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-4">Evidence Summary</h2>
          <div className="space-y-3">
            {[
              [FileText, 'text-emerald-300', demoStats.evidence, 'Supporting Documents', 'Verified & authenticated'],
              [Users, 'text-blue-300', demoStats.witnesses, 'Witness Statements', 'Consistent with evidence'],
              [BookOpen, 'text-violet-300', demoStats.statutes, 'Statutes', 'Directly relevant'],
              [Landmark, 'text-gold-light', demoStats.authorities, 'Authorities', 'Cases & secondary sources'],
              [AlertTriangle, 'text-amber-300', demoStats.evidenceGaps, 'Evidence Gaps', 'May impact argument strength'],
              [ShieldAlert, 'text-red-300', demoStats.humanReview, 'Human Review Required', 'Attorney validation needed'],
            ].map(([Icon, cls, n, title, sub], i) => {
              const IconC = Icon as React.ElementType;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${cls}`}><IconC className="w-4 h-4" /></span>
                  <span className="text-xl font-bold text-white tabular-nums w-8">{n as number}</span>
                  <span className="min-w-0"><span className="block text-sm font-medium text-slate-100">{title as string}</span><span className="block text-xs text-slate-500">{sub as string}</span></span>
                </div>
              );
            })}
          </div>
          <Link to="/demo/workbench" className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline">View all evidence <ArrowRight className="w-4 h-4" /></Link>
        </div>

        {/* Key Findings */}
        <div className="ca-panel p-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-4">Key Findings</h2>
          <div className="space-y-3">
            {demoKeyFindings.map((f, i) => {
              const t = findingTone(f.tone);
              return (
                <div key={i} className="rounded-xl bg-navy-800/50 border border-white/5 p-3 flex gap-3">
                  <span className={`w-1 rounded-full ${t.bar}`} />
                  <span className={`mt-0.5 ${t.cls}`}><t.icon className="w-4 h-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${t.cls}`}>{f.title}</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${f.confidence === 'HIGH' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{f.confidence}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{f.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <Link to="/demo/workbench" className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline">View all findings <ArrowRight className="w-4 h-4" /></Link>
        </div>

        {/* Timeline overview */}
        <div className="ca-panel p-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-4">Timeline Overview</h2>
          <div className="relative pl-5">
            <div className="absolute left-1.5 top-1 bottom-1 w-px bg-white/10" />
            <div className="space-y-3">
              {demoTimeline.slice(0, 5).map((t, i) => (
                <div key={i} className="relative">
                  <span className={`absolute -left-[14px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-navy-800 ${KIND_DOT[t.kind]}`} />
                  <div className="text-xs text-slate-500">{t.time}</div>
                  <div className="text-sm font-medium text-slate-100">{t.title}</div>
                </div>
              ))}
            </div>
          </div>
          <Link to="/demo/timeline" className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline">View full timeline <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>

      {/* ── Integrity · Uncertainties · AI ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="ca-panel p-5">
          <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-5 h-5 text-emerald-300" /><h3 className="text-sm font-bold text-white uppercase tracking-wide">Repository Integrity</h3></div>
          <p className="text-sm text-slate-300">All records current · hash-verified provenance (illustrative).</p>
          <Link to="/demo/reports/repository" className="mt-3 inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline">Repository summary <ArrowRight className="w-4 h-4" /></Link>
        </div>
        <div className="ca-panel p-5">
          <div className="flex items-center gap-2 mb-2"><HelpCircle className="w-5 h-5 text-violet-300" /><h3 className="text-sm font-bold text-white uppercase tracking-wide">Uncertainties</h3></div>
          <div className="text-3xl font-bold text-white">3 <span className="text-sm font-medium text-slate-400">Open items</span></div>
          <ul className="text-xs text-slate-400 mt-2 space-y-1 list-disc list-inside"><li>Intent-at-entry unproven</li><li>Cell-tower data incomplete</li><li>Forensic analysis pending</li></ul>
          <Link to="/demo/workbench" className="mt-3 inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline">View all uncertainties <ArrowRight className="w-4 h-4" /></Link>
        </div>
        <div className="ca-panel p-5">
          <div className="flex items-center gap-2 mb-2"><Brain className="w-5 h-5 text-blue-300" /><h3 className="text-sm font-bold text-white uppercase tracking-wide">AI Analysis</h3></div>
          <p className="text-sm text-blue-300 font-semibold">Analysis complete</p>
          <p className="text-xs text-slate-400 mt-1">Every finding is citation-backed; confidence calibrated to evidence. UNKNOWN shown where unsupported.</p>
          <Link to="/demo/workbench" className="mt-3 inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline">View analysis <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {[[RefreshCw, 'Reproducible'], [Scale, 'Attorney-First'], [ShieldCheck, 'Built for Justice'], [FileCheck2, 'No Citation → No Finding']].map(([Icon, label], i) => {
          const IconC = Icon as React.ElementType;
          return <div key={i} className="ca-panel p-4 flex items-center gap-2 justify-center"><IconC className="w-4 h-4 text-gold-light" /><span className="text-sm font-semibold text-slate-200">{label as string}</span></div>;
        })}
      </section>

      {/* ── Workspaces ── */}
      <section id="workspaces" className="mb-10 scroll-mt-24">
        <h2 className="text-2xl font-bold text-slate-50 mb-1">Explore the litigation workspaces</h2>
        <p className="text-slate-400 mb-4">Every workspace demonstrates how CourtAccess surfaces prosecution weaknesses and defense opportunities. Illustrative examples.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {demoWorkspaces.map((w) => {
            const Icon = ICONS[w.icon] ?? FileText;
            const inner = (
              <div className="group ca-panel p-5 h-full transition-all hover:border-gold-light/40 hover:-translate-y-0.5 relative overflow-hidden">
                <div className="absolute inset-0 ca-gradient-gold opacity-0 group-hover:opacity-[0.05] transition-opacity pointer-events-none" />
                <div className="flex items-start gap-3 relative">
                  <span className="w-11 h-11 rounded-xl ca-gradient-gold flex items-center justify-center text-navy flex-shrink-0 shadow-gold"><Icon className="w-5 h-5" /></span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><h3 className="font-bold text-slate-50 truncate">{w.name}</h3><ArrowRight className="w-4 h-4 text-gold-light opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                    <p className="text-sm text-slate-400 mt-1 leading-relaxed">{w.blurb}</p>
                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-400/80">Illustrative</span>
                  </div>
                </div>
              </div>
            );
            return w.to ? <Link key={w.id} to={`/demo/${w.to}`}>{inner}</Link> : <div key={w.id}>{inner}</div>;
          })}
        </div>
      </section>

      {/* ── Knowledge Graph ── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-50">Illustrative Knowledge Graph</h2>
          <Link to="/demo/knowledge-graph" className="text-sm text-gold-light hover:underline inline-flex items-center gap-1">Open full view <ArrowRight className="w-4 h-4" /></Link>
        </div>
        <DemoKnowledgeGraphSection />
      </section>

      {/* ── Reports ── */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-50 mb-4">Illustrative reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORT_ORDER.map((type) => {
            const r = demoReports[type];
            return (
              <Link key={type} to={`/demo/reports/${type}`} className="group ca-panel p-5 transition-all hover:border-gold-light/40 hover:-translate-y-0.5">
                <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-gold-light" /><h3 className="font-bold text-slate-50">{r.title}</h3></div>
                <p className="text-sm text-slate-400 mt-1">{r.subtitle}</p>
                <span className="inline-flex items-center gap-1 mt-3 text-sm text-gold-light">View example <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>
              </Link>
            );
          })}
        </div>
      </section>
    </DemoShell>
  );
}
