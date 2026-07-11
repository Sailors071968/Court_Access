// ============================================================================
// Illustrative Attorney Workbench — demonstrates how CourtAccess surfaces
// prosecution weaknesses, element gaps, contradictions, defense opportunities,
// and investigative tasks. Public, read-only, clearly-labeled illustrative.
// ============================================================================

import { Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, Scale, ShieldCheck, Search, GitBranch, Gavel, FileText, Map, Network,
} from 'lucide-react';
import { DemoShell } from './DemoShell';
import {
  demoCase, demoWeaknesses, demoChargeAnalysis, demoDefenseOpps, demoTasks, demoContradictions,
  type DemoElement, type ElementStatus, type DemoWeakness,
} from './demoData';

const SECTIONS = [
  { id: 'weaknesses', label: 'Prosecution Weaknesses', icon: AlertTriangle },
  { id: 'elements', label: 'Element Analysis', icon: Scale },
  { id: 'defense', label: 'Defense Opportunities', icon: ShieldCheck },
  { id: 'tasks', label: 'Investigative Tasks', icon: Search },
  { id: 'contradictions', label: 'Contradictions', icon: GitBranch },
];

const SEV: Record<string, string> = { high: 'bg-red-500/15 text-red-300', medium: 'bg-amber-500/15 text-amber-300', low: 'bg-slate-500/15 text-slate-300' };
const EL_STATUS: Record<ElementStatus, { cls: string; label: string }> = {
  supported: { cls: 'bg-emerald-500/15 text-emerald-300', label: 'SUPPORTED' },
  partial: { cls: 'bg-amber-500/15 text-amber-300', label: 'PARTIAL' },
  missing: { cls: 'bg-red-500/15 text-red-300', label: 'MISSING' },
  contradicted: { cls: 'bg-red-500/15 text-red-300', label: 'CONTRADICTED' },
};

function Section({ id, title, icon: Icon, meta, children }: { id: string; title: string; icon: React.ElementType; meta?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 ca-panel p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-xl ca-gradient-gold flex items-center justify-center text-navy shadow-gold"><Icon className="w-5 h-5" /></span><h2 className="text-xl md:text-2xl font-bold text-slate-50 tracking-tight">{title}</h2></div>
        {meta && <span className="text-xs text-slate-400 hidden md:inline">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function ElementRow({ el }: { el: DemoElement }) {
  const s = EL_STATUS[el.status];
  return (
    <div className="rounded-xl bg-navy-900/40 border border-white/5 p-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-slate-100">{el.name}</span>
          <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-500">{el.kind}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.cls}`}>{s.label}</span>
      </div>
      <p className="text-xs text-slate-400 mt-1.5">{el.why}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        {el.supporting.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">supporting: {el.supporting.join(', ')}</span>}
        {el.missing && <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-300">missing: {el.missing}</span>}
        {el.contradicting && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300">contradicting: {el.contradicting}</span>}
      </div>
    </div>
  );
}

export function DemoWorkbenchPage() {
  return (
    <DemoShell>
      <div className="mb-6">
        <Link to="/demo" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-gold-light mb-4"><ArrowLeft className="w-4 h-4" /> Back to gallery</Link>
        <div className="ca-panel p-6 md:p-8 relative overflow-hidden">
          <div className="absolute inset-0 ca-gradient-gold opacity-[0.06] pointer-events-none" />
          <div className="relative">
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-full px-3 py-1 mb-3">Illustrative Example · Not actual case data</span>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-50 flex items-center gap-3"><Gavel className="w-7 h-7 text-gold-light" /> Attorney Workbench</h1>
            <p className="text-slate-400 mt-2 max-w-2xl">{demoCase.title} — how CourtAccess surfaces prosecution weaknesses, missing offense elements, contradictions, and defense opportunities. Every finding explains <span className="text-slate-200">why it matters</span>.</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-navy-800/50 border border-white/5 text-slate-300 hover:text-gold-light hover:border-gold-light/30"><s.icon className="w-3.5 h-3.5" />{s.label}</a>)}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Prosecution weaknesses */}
        <Section id="weaknesses" title="Prosecution Weaknesses" icon={AlertTriangle} meta={`${demoWeaknesses.length} identified`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {demoWeaknesses.map((w: DemoWeakness) => (
              <div key={w.id} className="rounded-2xl border border-white/10 bg-navy-800/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{w.category}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${SEV[w.severity]}`}>{w.severity.toUpperCase()}</span>
                </div>
                <div className="text-sm font-semibold text-slate-100 mt-1">{w.title}</div>
                {w.element && <div className="text-[11px] text-gold-light mt-0.5">{w.element}</div>}
                <p className="text-xs text-slate-400 mt-2"><span className="text-slate-300 font-medium">Why it matters:</span> {w.why}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Element analysis */}
        <Section id="elements" title="Element-Based Analysis" icon={Scale} meta={`${demoChargeAnalysis.length} charges`}>
          <div className="space-y-5">
            {demoChargeAnalysis.map((c) => (
              <div key={c.section} className="rounded-2xl border border-white/10 bg-navy-800/40 p-5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div><span className="text-lg font-bold text-slate-50">{c.code} {c.section}</span> <span className="text-sm text-slate-300">— {c.title}</span></div>
                  <div className="flex items-center gap-2"><span className="text-[11px] px-2 py-0.5 rounded bg-navy-700/70 border border-white/10 text-slate-300">{c.calcrim}</span><span className="text-[11px] px-2 py-0.5 rounded bg-navy-700/70 border border-white/10 text-slate-300">{c.classification}</span></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                  {c.elements.map((el, i) => <ElementRow key={i} el={el} />)}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Defense opportunities */}
        <Section id="defense" title="Defense Opportunities" icon={ShieldCheck} meta={`${demoDefenseOpps.length} opportunities`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {demoDefenseOpps.map((d) => (
              <div key={d.id} className="rounded-2xl border border-white/10 bg-navy-800/40 p-4">
                <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-300" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{d.category}</span></div>
                <div className="text-sm font-semibold text-slate-100 mt-1">{d.title}</div>
                <p className="text-xs text-slate-400 mt-2"><span className="text-slate-300 font-medium">Why it matters:</span> {d.why}</p>
                <div className="text-[10px] text-gold-light mt-2 font-mono">{d.repositoryRef}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Investigative tasks */}
        <Section id="tasks" title="Investigative Tasks" icon={Search} meta={`${demoTasks.length} tasks`}>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-navy-800/70 text-slate-300"><tr>{['Task', 'Priority', 'Reason', 'Value', 'Status'].map((h) => <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {demoTasks.map((t) => (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-slate-100">{t.task}</td>
                    <td className="px-3 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded ${SEV[t.priority]}`}>{t.priority.toUpperCase()}</span></td>
                    <td className="px-3 py-2 text-slate-400 max-w-[280px]">{t.reason}</td>
                    <td className="px-3 py-2 text-gold-light">{t.value}</td>
                    <td className="px-3 py-2 text-slate-300">{t.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Contradictions */}
        <Section id="contradictions" title="Contradiction Workspace" icon={GitBranch} meta={`${demoContradictions.length} contradictions`}>
          <div className="space-y-3">
            {demoContradictions.map((c) => (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-navy-800/40 p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-red-300" /><span className="text-sm font-semibold text-slate-100">{c.title}</span></div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${SEV[c.severity]}`}>{c.severity.toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 text-xs">
                  <div><span className="ca-overline text-[9px] block mb-0.5">Type</span><span className="text-slate-300">{c.type}</span></div>
                  <div><span className="ca-overline text-[9px] block mb-0.5">Affected Element</span><span className="text-gold-light">{c.element}</span></div>
                  <div><span className="ca-overline text-[9px] block mb-0.5">Sources</span><span className="text-slate-300">{c.sources.join(' · ')}</span></div>
                </div>
                <p className="text-xs text-slate-400 mt-2"><span className="text-slate-300 font-medium">Attorney recommendation:</span> {c.recommendation}</p>
              </div>
            ))}
          </div>
        </Section>

        <div className="flex flex-wrap gap-3">
          <Link to="/demo/brief" className="inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline"><FileText className="w-4 h-4" />Case Brief</Link>
          <Link to="/demo/knowledge-graph" className="inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline"><Network className="w-4 h-4" />Knowledge Graph</Link>
          <Link to="/demo/map" className="inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline"><Map className="w-4 h-4" />Investigative Map</Link>
        </div>
      </div>
    </DemoShell>
  );
}
