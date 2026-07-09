// ============================================================================
// Program 94 — Illustrative report viewer (public, read-only). Renders a
// clearly-labeled, production-quality example report of the requested type.
// ============================================================================

import { useParams, Link, Navigate } from 'react-router-dom';
import { Printer, ArrowLeft, FileText } from 'lucide-react';
import { DemoShell } from './DemoShell';
import { DemoTimelineSection, DemoKnowledgeGraphSection } from './DemoGalleryPage';
import { demoReports, demoCase, type DemoReportType } from './demoData';

export function DemoReportPage() {
  const { type } = useParams<{ type: string }>();
  const report = type ? demoReports[type as DemoReportType] : undefined;
  if (!report) return <Navigate to="/demo" replace />;

  const isGraph = report.type === 'knowledge-graph';
  const isTimeline = report.type === 'timeline';

  return (
    <DemoShell>
      <div className="report-root max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Link to="/demo" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-gold-light"><ArrowLeft className="w-4 h-4" /> Back to gallery</Link>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg ca-gradient-gold text-navy"><Printer className="w-4 h-4" />Print / PDF</button>
        </div>

        {/* Report header */}
        <div className="ca-panel p-6 md:p-8 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 ca-gradient-gold opacity-[0.05] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="w-10 h-10 rounded-xl ca-gradient-gold flex items-center justify-center text-navy"><FileText className="w-5 h-5" /></span>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-full px-3 py-1">Illustrative Example</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-50 mt-4">{report.title}</h1>
            <p className="text-slate-400 mt-1">{report.subtitle}</p>
            <p className="text-sm text-slate-500 mt-3">{demoCase.title} · Case No. {demoCase.caseNumber} · {demoCase.court}</p>
          </div>
        </div>

        {isGraph && <div className="mb-6"><DemoKnowledgeGraphSection /></div>}
        {isTimeline && <div className="mb-6"><DemoTimelineSection /></div>}

        {/* Report sections */}
        <div className="space-y-5">
          {report.sections.map((s, i) => (
            <div key={i} className="ca-panel p-6">
              <h2 className="text-lg font-bold text-slate-50 border-b border-white/10 pb-2 mb-3">{s.heading}</h2>
              <ul className="space-y-2">
                {s.body.map((b, j) => <li key={j} className="text-sm text-slate-200 leading-relaxed">{b}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-amber-300 mt-8">Illustrative Example · Demonstration Only · Not Actual Case Information</p>
      </div>
    </DemoShell>
  );
}

export function DemoKnowledgeGraphPage() {
  return (
    <DemoShell>
      <div className="flex items-center justify-between mb-4">
        <Link to="/demo" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-gold-light"><ArrowLeft className="w-4 h-4" /> Back to gallery</Link>
        <span className="text-xs font-bold uppercase tracking-wider text-amber-400/80">Illustrative — not actual case data</span>
      </div>
      <h1 className="text-3xl font-bold text-slate-50 mb-2">Illustrative Knowledge Graph</h1>
      <p className="text-slate-400 mb-6">Interactive relationship graph across charges, evidence, witnesses, timeline, statutes, CALCRIM, and authorities. Drag, zoom, and select nodes.</p>
      <DemoKnowledgeGraphSection />
    </DemoShell>
  );
}

export function DemoTimelinePage() {
  return (
    <DemoShell>
      <div className="flex items-center justify-between mb-4">
        <Link to="/demo" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-gold-light"><ArrowLeft className="w-4 h-4" /> Back to gallery</Link>
        <span className="text-xs font-bold uppercase tracking-wider text-amber-400/80">Illustrative — not actual case data</span>
      </div>
      <h1 className="text-3xl font-bold text-slate-50 mb-2">Illustrative Timeline</h1>
      <p className="text-slate-400 mb-6">Chronological reconstruction from incident through sentencing. Every entry is a demonstration example.</p>
      <DemoTimelineSection />
    </DemoShell>
  );
}
