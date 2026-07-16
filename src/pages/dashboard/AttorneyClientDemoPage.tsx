// ============================================================================
// Program 138 — Cinematic Attorney/Client Demonstration Experience
// The flagship marketing demonstration: a scripted, cinematic attorney/client
// scene player, a stunning flagship defense-opportunity display, and one-click
// traceability. EVERY surface is a permanently-labeled ILLUSTRATIVE
// DEMONSTRATION using sample data — it never reflects a real case. CourtAccess
// never determines guilt, guarantees a defense/outcome, or recommends litigation
// strategy. Illustrative content is always distinguished from repository-backed
// findings; UNKNOWN is preferred where evidence is insufficient.
// ============================================================================

import { useEffect, useState } from 'react';
import {
  Sparkles, Scale, Clock, Boxes, Users, MessageSquareWarning, Search, ShieldCheck,
  HelpCircle, ChevronLeft, ChevronRight, Play, Pause, BookMarked, ListChecks,
  FileText, Network, User, MessageSquare, Film,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { ProvenanceBadge } from '../../components/common/ProvenanceBadge';

interface Cite { label: string; kind: 'statute' | 'calcrim' | 'report' | 'transcript' | 'exhibit' | 'video' | 'audio' | 'authority' | 'graph' | 'timeline'; locator: string; unknown?: boolean }
interface Opportunity {
  id: string; icon: typeof Scale; category: string; priority: 'Critical' | 'High' | 'Medium' | 'Human Review Required';
  title: string; plain: string; confidence: string; cites: Cite[];
}

const CAT_STYLE: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 border-red-300',
  High: 'bg-orange-100 text-orange-700 border-orange-300',
  Medium: 'bg-amber-100 text-amber-700 border-amber-300',
  'Human Review Required': 'bg-gray-200 text-gray-700 border-gray-400',
};

const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'surveillance', icon: Search, category: 'Investigation', priority: 'High',
    title: 'Potential surveillance footage worth requesting',
    plain: 'A nearby business may have camera coverage of the location at the relevant time — worth requesting for attorney review.',
    confidence: 'MEDIUM',
    cites: [
      { label: 'Police report', kind: 'report', locator: 'Page 5, Paragraph 3' },
      { label: 'Timeline', kind: 'timeline', locator: '9:02 PM' },
      { label: 'Business camera', kind: 'video', locator: 'UNKNOWN', unknown: true },
    ],
  },
  {
    id: 'chain', icon: Boxes, category: 'Evidence', priority: 'Critical',
    title: 'Evidence handling questions for attorney review',
    plain: 'The record does not establish chain-of-custody transfers for two exhibits — an evidentiary question an attorney may review.',
    confidence: 'HIGH',
    cites: [
      { label: 'Exhibit 4', kind: 'exhibit', locator: 'Page 2' },
      { label: 'Chain of custody', kind: 'report', locator: 'UNKNOWN', unknown: true },
    ],
  },
  {
    id: 'officer', icon: MessageSquareWarning, category: 'Witness', priority: 'High',
    title: 'Officer credibility review opportunities',
    plain: 'A prior inconsistent statement appears between the report and the preliminary hearing — relevant to credibility review.',
    confidence: 'MEDIUM',
    cites: [
      { label: 'Report', kind: 'report', locator: 'Page 3, Paragraph 2' },
      { label: 'Transcript', kind: 'transcript', locator: 'Page 22, Line 15' },
      { label: 'Body camera', kind: 'video', locator: 't = 00:03:12' },
    ],
  },
  {
    id: 'priors', icon: Scale, category: 'CALCRIM', priority: 'Medium',
    title: 'Older conviction evidentiary issues for attorney evaluation',
    plain: 'A prior conviction may raise admissibility questions worth an attorney’s evaluation.',
    confidence: 'MEDIUM',
    cites: [
      { label: 'CALCRIM 316', kind: 'calcrim', locator: 'Witness prior conviction' },
      { label: 'Repository authority', kind: 'authority', locator: 'Evidence Code (illustrative)' },
    ],
  },
  {
    id: 'statements', icon: MessageSquareWarning, category: 'Contradiction', priority: 'High',
    title: 'Statement inconsistencies',
    plain: 'Two witness statements describe the vehicle differently — an inconsistency for attorney review.',
    confidence: 'MEDIUM',
    cites: [
      { label: '911 audio', kind: 'audio', locator: 't = 00:00:41' },
      { label: 'Transcript', kind: 'transcript', locator: 'Page 22, Line 15' },
    ],
  },
  {
    id: 'timeline', icon: Clock, category: 'Timeline', priority: 'High',
    title: 'Timeline discrepancies',
    plain: 'Two accounts place the defendant in different locations at the same time.',
    confidence: 'MEDIUM',
    cites: [
      { label: 'Report', kind: 'report', locator: 'Page 6, Paragraph 1' },
      { label: 'Knowledge Graph', kind: 'graph', locator: 'Witness A ⟂ Witness B' },
    ],
  },
];

interface Scene { who: 'attorney' | 'client' | 'narrator'; lines: string[]; note?: string; showOpportunities?: boolean }
const SCENES: Scene[] = [
  { who: 'attorney', lines: ['The prosecutor is offering fourteen years.', 'Trial begins in two weeks.'] },
  { who: 'client', lines: ['I’ve been reviewing my case in CourtAccess.', 'It highlighted several issues I’d like to discuss.'] },
  { who: 'narrator', lines: ['The client reviews illustrative repository-backed opportunities — each with repository confidence, supporting citations, and UNKNOWN where applicable.'], showOpportunities: true },
  { who: 'attorney', lines: ['These are important issues.', 'Where did you get all of this?'] },
  { who: 'client', lines: ['From CourtAccess.', 'It linked every issue directly to the supporting records.'] },
  { who: 'attorney', lines: ['These findings may justify additional investigation.', 'Let’s evaluate whether we should request more time to investigate them.'], note: 'CourtAccess organizes information for attorney review — it does not recommend a strategy or predict any outcome.' },
];

function citeIcon(k: Cite['kind']) {
  if (k === 'statute') return <BookMarked size={12} />;
  if (k === 'calcrim') return <ListChecks size={12} />;
  if (k === 'video' || k === 'audio') return <Clock size={12} />;
  if (k === 'graph') return <Network size={12} />;
  if (k === 'timeline') return <Clock size={12} />;
  return <FileText size={12} />;
}

export function AttorneyClientDemoPage() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [drill, setDrill] = useState<string | null>(null);
  const s = SCENES[scene];

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setScene((v) => (v + 1) % SCENES.length), 4200);
    return () => clearTimeout(t);
  }, [playing, scene]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Permanent illustrative label */}
      <div className="rounded-xl border border-amber-300 bg-amber-100/80 px-4 py-2.5 text-center text-sm font-bold uppercase tracking-widest text-amber-800">
        Illustrative Demonstration — sample data for presentation only
      </div>

      {/* Cinematic stage */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200"><Film size={14} /> Attorney &amp; Client — a CourtAccess story</div>
          <div className="flex items-center gap-1">
            <button aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((v) => !v)} className="rounded-full bg-white/10 p-2 hover:bg-white/20">{playing ? <Pause size={16} /> : <Play size={16} />}</button>
          </div>
        </div>

        <div className="relative mt-6 min-h-[180px]">
          {s.who !== 'narrator' ? (
            <div className={`flex ${s.who === 'attorney' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-3xl px-6 py-5 ${s.who === 'attorney' ? 'bg-white/10' : 'bg-indigo-500/25'} backdrop-blur`}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-200">
                  {s.who === 'attorney' ? <MessageSquare size={13} /> : <User size={13} />} {s.who === 'attorney' ? 'Attorney' : 'Client'}
                </div>
                {s.lines.map((l, i) => <p key={i} className="text-2xl font-semibold leading-snug">{l}</p>)}
                {s.note && <p className="mt-3 text-xs text-amber-200">{s.note}</p>}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Sparkles size={22} className="mx-auto mb-2 text-indigo-300" />
              <p className="mx-auto max-w-2xl text-lg text-indigo-100">{s.lines[0]}</p>
            </div>
          )}
        </div>

        {/* Scene nav */}
        <div className="relative mt-6 flex items-center justify-between">
          <button disabled={scene === 0} onClick={() => setScene((v) => Math.max(0, v - 1))} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm disabled:opacity-30"><ChevronLeft size={16} /> Prev</button>
          <div className="flex items-center gap-2">
            {SCENES.map((_, i) => <button key={i} aria-label={`Scene ${i + 1}`} onClick={() => setScene(i)} className={`h-2 rounded-full transition-all ${i === scene ? 'w-6 bg-white' : 'w-2 bg-white/40'}`} />)}
            <span className="ml-2 text-xs text-indigo-200">Scene {scene + 1} / {SCENES.length}</span>
          </div>
          <button disabled={scene === SCENES.length - 1} onClick={() => setScene((v) => Math.min(SCENES.length - 1, v + 1))} className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm disabled:opacity-30">Next <ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Flagship defense-opportunity display (Phase 2) — always visible, spotlighted in scene 3 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><ShieldCheck size={18} className="text-indigo-600" /> Top Defense Opportunities</h2>
          <ProvenanceBadge kind="illustrative" note="6 sample opportunities" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {OPPORTUNITIES.map((o) => {
            const open = drill === o.id;
            const OppIcon = o.icon;
            return (
              <Card key={o.id} className={`transition-all duration-200 hover:shadow-lg ${s.showOpportunities ? 'ring-1 ring-indigo-200' : ''}`}>
                <button className="w-full text-left" onClick={() => setDrill(open ? null : o.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${CAT_STYLE[o.priority]}`}><OppIcon size={17} /></div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">{o.category}</div>
                        <h3 className="text-sm font-semibold text-gray-900 leading-tight">{o.title}</h3>
                      </div>
                    </div>
                    <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CAT_STYLE[o.priority]}`}>{o.priority}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{o.plain}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <ProvenanceBadge kind="illustrative" note={`confidence ${o.confidence}`} />
                    <span className="text-xs text-indigo-600 flex items-center gap-1">{open ? 'Hide' : 'Trace'} evidence <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} /></span>
                  </div>
                </button>
                {/* Phase 3 — clickable traceability */}
                {open && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5 flex items-center gap-1"><BookMarked size={12} /> Traceable citations</div>
                    <div className="flex flex-wrap gap-1.5">
                      {o.cites.map((c, i) => (
                        <span key={i} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${c.unknown ? 'border-gray-300 bg-gray-100 text-gray-500' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`}>
                          {c.unknown ? <HelpCircle size={11} /> : citeIcon(c.kind)}<span className="font-medium">{c.label}:</span> {c.locator}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* One-second impact strip (Phase 4) */}
      <Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-center">
          {[
            { k: 'What we found', v: '6 issues', tone: 'text-indigo-700', icon: Sparkles },
            { k: 'Why it may matter', v: 'attorney review', tone: 'text-violet-700', icon: Scale },
            { k: 'Where evidence is', v: 'traceable', tone: 'text-emerald-700', icon: BookMarked },
            { k: 'What is UNKNOWN', v: '2 items', tone: 'text-gray-600', icon: HelpCircle },
          ].map((b) => {
            const BIcon = b.icon;
            return (
              <div key={b.k} className="rounded-xl border border-gray-100 bg-gradient-to-b from-white to-slate-50 p-3">
                <BIcon size={18} className={`mx-auto ${b.tone}`} />
                <div className={`mt-1 text-lg font-bold ${b.tone}`}>{b.v}</div>
                <div className="text-[11px] text-gray-500">{b.k}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-amber-700">Illustrative demonstration. CourtAccess organizes repository-backed information for attorney review; it does not determine guilt, guarantee any defense or outcome, or recommend litigation strategy.</p>
      </Card>

      {/* Category legend (Phase 2 coverage) */}
      <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
        {['CALCRIM Issues', 'Timeline Issues', 'Evidence Issues', 'Witness Issues', 'Contradictions', 'Investigation Opportunities', 'Human Review Required'].map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5"><Users size={11} className="text-gray-400" />{c}</span>
        ))}
      </div>
    </div>
  );
}
