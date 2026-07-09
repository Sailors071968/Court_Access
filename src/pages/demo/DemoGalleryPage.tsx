// ============================================================================
// Program 94 — Illustrative Litigation Demonstration Gallery (public, read-only)
// Showcases CourtAccess work product with clearly-labeled illustrative examples.
// ============================================================================

import { Link } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Briefcase, FolderOpen, Network, Clock, ClipboardList, Users,
  Scale, Gavel, ShieldCheck, BookOpen, Landmark, Search, Settings, CreditCard, Database,
  Home, ArrowRight, FileBox,
} from 'lucide-react';
import { DemoShell } from './DemoShell';
import { KnowledgeGraphWorkspace } from '../../components/graph/KnowledgeGraphWorkspace';
import {
  demoCase, demoStats, demoCharges, demoTimeline, demoKnowledgeGraph, demoWorkspaces, demoReports,
  type DemoTimelineEvent, type DemoReportType,
} from './demoData';

const ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard, overview: FileText, workbench: Briefcase, evidence: FolderOpen,
  graph: Network, timeline: Clock, discovery: ClipboardList, witness: Users, 'voir-dire': Users,
  motion: Gavel, trial: ShieldCheck, report: FileText, calcrim: Scale, sentencing: Scale,
  authority: Landmark, research: BookOpen, admin: Settings, billing: CreditCard, search: Search,
  repository: Database, landing: Home,
};

export function DemoWorkspaceGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {demoWorkspaces.map((w) => {
        const Icon = ICONS[w.icon] ?? FileBox;
        const card = (
          <div className="group ca-panel p-5 h-full transition-all hover:border-gold-light/40 hover:-translate-y-0.5 relative overflow-hidden">
            <div className="absolute inset-0 ca-gradient-gold opacity-0 group-hover:opacity-[0.05] transition-opacity pointer-events-none" />
            <div className="flex items-start gap-3 relative">
              <span className="w-11 h-11 rounded-xl ca-gradient-gold flex items-center justify-center text-navy flex-shrink-0 shadow-gold"><Icon className="w-5 h-5" /></span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-50 truncate">{w.name}</h3>
                  {w.to && <ArrowRight className="w-4 h-4 text-gold-light opacity-0 group-hover:opacity-100 transition-opacity" />}
                </div>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">{w.blurb}</p>
                <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-400/80">Illustrative</span>
              </div>
            </div>
          </div>
        );
        return w.to ? <Link key={w.id} to={`/demo/${w.to}`}>{card}</Link> : <div key={w.id}>{card}</div>;
      })}
    </div>
  );
}

const KIND_COLOR: Record<DemoTimelineEvent['kind'], string> = {
  incident: 'bg-red-400', investigation: 'bg-blue-400', evidence: 'bg-emerald-400', discovery: 'bg-violet-400', court: 'bg-gold-light',
};

export function DemoTimelineSection() {
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-white/10" />
      <div className="space-y-4">
        {demoTimeline.map((t, i) => (
          <div key={i} className="relative">
            <span className={`absolute -left-[18px] top-1.5 w-3 h-3 rounded-full ring-4 ring-navy-800 ${KIND_COLOR[t.kind]}`} />
            <div className="ca-panel p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gold-light">{t.phase}</span>
                  <span className="text-xs text-slate-500">{t.time}</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/70">Illustrative</span>
              </div>
              <div className="text-sm font-semibold text-slate-100 mt-1">{t.title}</div>
              <div className="text-sm text-slate-400 mt-0.5">{t.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemoKnowledgeGraphSection() {
  return (
    <div className="ca-panel p-2 md:p-4">
      <KnowledgeGraphWorkspace data={demoKnowledgeGraph} height={520} />
    </div>
  );
}

function StatTile({ v, l }: { v: number; l: string }) {
  return (
    <div className="rounded-xl bg-navy-800/60 border border-white/5 px-4 py-3 text-center">
      <div className="text-2xl font-bold text-gold-light">{v}</div>
      <div className="ca-overline text-[10px] mt-1">{l}</div>
    </div>
  );
}

const REPORT_ORDER: DemoReportType[] = [
  'attorney-report', 'motion', 'voir-dire', 'sentencing', 'calcrim', 'discovery',
  'evidence', 'knowledge-graph', 'timeline', 'witness', 'trial-prep', 'repository',
];

export function DemoGalleryPage() {
  return (
    <DemoShell>
      {/* Hero */}
      <section className="relative rounded-3xl overflow-hidden mb-10 border border-white/10">
        <img src="/hero-courthouse.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900/90 via-navy-800/80 to-navy-900/95" />
        <div className="relative px-6 md:px-12 py-14 md:py-20">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-full px-3 py-1 mb-4">Illustrative Example · Demonstration Only</span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-3xl">See the quality of work product CourtAccess produces</h1>
          <p className="text-lg text-slate-300 mt-4 max-w-2xl">Explore a fully illustrative criminal case across every CourtAccess workspace — dashboards, knowledge graph, timeline, motions, reports, and more. No account required. Nothing here is real case data.</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <a href="#workspaces" className="px-5 py-2.5 rounded-xl ca-gradient-gold text-navy font-semibold hover:opacity-90">Browse the workspaces</a>
            <Link to="/demo/knowledge-graph" className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-semibold hover:bg-white/15">View the knowledge graph</Link>
          </div>
        </div>
      </section>

      {/* Illustrative case card */}
      <section className="ca-panel p-6 md:p-8 mb-10 relative overflow-hidden">
        <div className="absolute inset-0 ca-gradient-gold opacity-[0.05] pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="ca-overline">Featured Illustrative Case</div>
              <h2 className="text-2xl font-bold text-slate-50 mt-1">{demoCase.title}</h2>
              <p className="text-sm text-slate-400 mt-1">Case No. {demoCase.caseNumber} · {demoCase.court} · {demoCase.judge}</p>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400/80 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">Not actual case data</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-6">
            <StatTile v={demoStats.charges} l="Charges" />
            <StatTile v={demoStats.evidence} l="Evidence" />
            <StatTile v={demoStats.witnesses} l="Witnesses" />
            <StatTile v={demoStats.discovery} l="Discovery" />
            <StatTile v={demoStats.timelineEvents} l="Timeline" />
            <StatTile v={demoStats.motions} l="Motions" />
            <StatTile v={demoStats.authorities} l="Authorities" />
            <StatTile v={demoStats.kgNodes} l="Graph Nodes" />
          </div>
          <div className="flex flex-wrap gap-2 mt-5">
            {demoCharges.map((c) => (
              <span key={c.section} className="text-xs px-3 py-1.5 rounded-lg bg-navy-800/60 border border-white/10 text-slate-200">{c.code} {c.section} — {c.title}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Workspaces */}
      <section id="workspaces" className="mb-12 scroll-mt-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-50">Explore every workspace</h2>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400/70">Illustrative previews</span>
        </div>
        <DemoWorkspaceGrid />
      </section>

      {/* Knowledge Graph */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-50">Illustrative Knowledge Graph</h2>
          <Link to="/demo/knowledge-graph" className="text-sm text-gold-light hover:underline inline-flex items-center gap-1">Open full view <ArrowRight className="w-4 h-4" /></Link>
        </div>
        <DemoKnowledgeGraphSection />
      </section>

      {/* Timeline */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-50">Illustrative Timeline</h2>
          <Link to="/demo/timeline" className="text-sm text-gold-light hover:underline inline-flex items-center gap-1">Open full view <ArrowRight className="w-4 h-4" /></Link>
        </div>
        <DemoTimelineSection />
      </section>

      {/* Reports */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-50 mb-4">Illustrative reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORT_ORDER.map((type) => {
            const r = demoReports[type];
            return (
              <Link key={type} to={`/demo/reports/${type}`} className="group ca-panel p-5 transition-all hover:border-gold-light/40 hover:-translate-y-0.5">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gold-light" />
                  <h3 className="font-bold text-slate-50">{r.title}</h3>
                </div>
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
