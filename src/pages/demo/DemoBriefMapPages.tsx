// ============================================================================
// Illustrative Case Brief + Investigative Mapping workspaces (public, labeled).
// ============================================================================

import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Map, Printer, MapPin, Camera, Route, AlertTriangle } from 'lucide-react';
import { DemoShell } from './DemoShell';
import { demoCase, demoCaseBrief, demoMap } from './demoData';

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="ca-panel p-5">
      <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => <li key={i} className="text-sm text-slate-200 flex gap-2"><span className="text-gold-light mt-1.5 w-1 h-1 rounded-full bg-gold-light flex-shrink-0" />{it}</li>)}
      </ul>
    </div>
  );
}

export function DemoCaseBriefPage() {
  const b = demoCaseBrief;
  return (
    <DemoShell>
      <div className="report-root max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Link to="/demo" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-gold-light"><ArrowLeft className="w-4 h-4" /> Back to gallery</Link>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg ca-gradient-gold text-navy"><Printer className="w-4 h-4" />Print / PDF</button>
        </div>
        <div className="ca-panel p-6 md:p-8 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 ca-gradient-gold opacity-[0.05] pointer-events-none" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-full px-3 py-1"><FileText className="w-3.5 h-3.5" />Illustrative Example</span>
            <h1 className="text-3xl font-bold text-slate-50 mt-4">Case Brief</h1>
            <p className="text-slate-400 mt-1">{demoCase.title} · Case No. {demoCase.caseNumber}</p>
          </div>
        </div>
        <div className="ca-panel p-6 mb-4"><h3 className="text-sm font-bold text-white uppercase tracking-wide mb-2">Case Overview</h3><p className="text-sm text-slate-200 leading-relaxed">{b.overview}</p></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Panel title="Material Facts" items={b.materialFacts} />
          <Panel title="Key Evidence" items={b.keyEvidence} />
          <Panel title="Potential Weaknesses" items={b.weaknesses} />
          <Panel title="Contradictions" items={b.contradictions} />
          <Panel title="Relevant Statutes" items={b.statutes} />
          <Panel title="Relevant Authorities" items={b.authorities} />
          <Panel title="Key Legal Issues" items={b.issues} />
          <Panel title="Attorney Recommendations" items={b.recommendations} />
          <Panel title="Outstanding Investigative Tasks" items={b.outstandingTasks} />
          <Panel title="Human Review Items" items={b.humanReview} />
        </div>
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-amber-300 mt-8">Illustrative Example · Demonstration Only · Not Actual Case Information</p>
      </div>
    </DemoShell>
  );
}

const KIND_ICON: Record<string, React.ElementType> = { incident: MapPin, business: MapPin, 'camera-candidate': Camera, route: Route };

export function DemoMapPage() {
  return (
    <DemoShell>
      <div className="mb-4"><Link to="/demo" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-gold-light"><ArrowLeft className="w-4 h-4" /> Back to gallery</Link></div>
      <div className="ca-panel p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 ca-gradient-gold opacity-[0.05] pointer-events-none" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-full px-3 py-1"><Map className="w-3.5 h-3.5" />Illustrative Example</span>
          <h1 className="text-3xl font-bold text-slate-50 mt-4">Investigative Mapping</h1>
          <p className="text-slate-400 mt-1">{demoCase.title}</p>
        </div>
      </div>

      <div className="ca-panel p-4 mb-4 border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-200">{demoMap.disclaimer}</p>
      </div>

      {/* Illustrative map canvas */}
      <div className="ca-panel p-2 mb-4">
        <div className="relative h-72 rounded-xl overflow-hidden bg-navy-900" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <span className="w-10 h-10 rounded-full bg-red-500/30 ring-2 ring-red-400 flex items-center justify-center"><MapPin className="w-5 h-5 text-red-300" /></span>
            <span className="text-[10px] text-red-300 mt-1 font-semibold">Incident (illustrative)</span>
          </span>
          <span className="absolute left-[28%] top-[34%] flex flex-col items-center"><span className="w-7 h-7 rounded-full bg-blue-500/25 ring-2 ring-blue-400 flex items-center justify-center"><Camera className="w-3.5 h-3.5 text-blue-300" /></span><span className="text-[9px] text-blue-300 mt-0.5">Camera?</span></span>
          <span className="absolute left-[70%] top-[62%] flex flex-col items-center"><span className="w-7 h-7 rounded-full bg-blue-500/25 ring-2 ring-blue-400 flex items-center justify-center"><Camera className="w-3.5 h-3.5 text-blue-300" /></span><span className="text-[9px] text-blue-300 mt-0.5">Camera?</span></span>
          <span className="absolute left-[62%] top-[26%] flex flex-col items-center"><span className="w-7 h-7 rounded-full bg-emerald-500/25 ring-2 ring-emerald-400 flex items-center justify-center"><MapPin className="w-3.5 h-3.5 text-emerald-300" /></span><span className="text-[9px] text-emerald-300 mt-0.5">Business</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="ca-panel p-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">Points of Interest</h3>
          <div className="space-y-2">
            {demoMap.points.map((p) => { const Icon = KIND_ICON[p.kind] ?? MapPin; return (
              <div key={p.id} className="flex items-start gap-3 rounded-lg bg-navy-800/40 border border-white/5 px-3 py-2">
                <Icon className="w-4 h-4 text-gold-light mt-0.5 flex-shrink-0" />
                <div><div className="text-sm text-slate-100">{p.label}</div><div className="text-xs text-slate-400">{p.note}</div></div>
              </div>
            ); })}
          </div>
        </div>
        <div className="ca-panel p-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">Travel-Time Analysis</h3>
          {demoMap.travelTimes.map((t, i) => (
            <div key={i} className="rounded-lg bg-navy-800/40 border border-white/5 px-3 py-3">
              <div className="text-sm text-slate-100">{t.from} → {t.to}</div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div><div className="text-lg font-bold text-gold-light">{t.distance}</div><div className="ca-overline text-[9px]">Distance</div></div>
                <div><div className="text-lg font-bold text-gold-light">{t.driving}</div><div className="ca-overline text-[9px]">Driving</div></div>
                <div><div className="text-lg font-bold text-gold-light">{t.walking}</div><div className="ca-overline text-[9px]">Walking</div></div>
              </div>
              <p className="text-xs text-amber-300/80 mt-2">{t.note}</p>
            </div>
          ))}
          <p className="text-xs text-slate-500 mt-3">Attorney recommendation: verify all locations and camera candidates in the field; the platform does not assert cameras exist.</p>
        </div>
      </div>
      <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-amber-300 mt-8">Illustrative Example · Investigative Aid · Requires Field Verification</p>
    </DemoShell>
  );
}
