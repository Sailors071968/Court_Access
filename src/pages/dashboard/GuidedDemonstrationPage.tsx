// ============================================================================
// Program 137 — Guided Demonstration & Executive Sales Experience
// The definitive CourtAccess sales demonstration: a guided, step-by-step story
// that conveys value within ~15 seconds, an attorney/client walkthrough, a
// one-click drill-down, and the executive story flow. ALL content on this screen
// is a permanently-labeled ILLUSTRATIVE DEMONSTRATION using sample data — it
// never reflects a real case. CourtAccess never determines guilt, guarantees a
// defense/outcome, or recommends litigation strategy. Repository-backed findings
// are always distinguished from illustrative examples; UNKNOWN is preferred where
// evidence is insufficient.
// ============================================================================

import { useState } from 'react';
import {
  Sparkles, ShieldCheck, Boxes, Network, Gavel, Landmark, LayoutDashboard,
  ChevronLeft, ChevronRight, Search, HelpCircle, BookMarked, ListChecks, Clock,
  FileText, Scale, MessageSquare, User, GraduationCap, Presentation, PlayCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { ProvenanceBadge } from '../../components/common/ProvenanceBadge';

interface DrillItem { label: string; value: string; unknown?: boolean }
interface Step {
  id: string;
  icon: typeof Sparkles;
  title: string;
  tagline: string;
  plain: string;
  metrics: Array<{ label: string; value: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }>;
  story: { found: string; matters: string; where: string; unknown: string; investigate: string };
  drill: DrillItem[];
}

const STEPS: Step[] = [
  {
    id: 'defense', icon: ShieldCheck, title: 'Executive Defense Opportunity Dashboard',
    tagline: 'The strongest opportunities, ranked in one second.',
    plain: 'CourtAccess opens every case with the strongest repository-backed defense opportunities, ranked by priority and ready for attorney review.',
    metrics: [
      { label: 'Opportunities', value: '5', tone: 'neutral' },
      { label: 'Critical', value: '1', tone: 'bad' },
      { label: 'High value', value: '2', tone: 'warn' },
      { label: 'Repository confidence', value: '82%', tone: 'good' },
    ],
    story: {
      found: 'A required robbery element (force or fear) is not established in the record.',
      matters: 'The prosecution must prove every element beyond a reasonable doubt.',
      where: 'Preliminary transcript p.14 l.7; body-camera 00:03:12.',
      unknown: 'Whether medical records establish injury for the assault count.',
      investigate: 'Interview the responding officer; obtain full-resolution surveillance.',
    },
    drill: [
      { label: 'Statute', value: 'PEN §211 — Robbery' },
      { label: 'CALCRIM', value: '1600 — Robbery' },
      { label: 'Police report', value: 'Page 3, Paragraph 2' },
      { label: 'Transcript', value: 'Page 14, Line 7' },
      { label: 'Body camera', value: 't = 00:03:12' },
      { label: 'Medical records', value: 'UNKNOWN', unknown: true },
    ],
  },
  {
    id: 'evidence', icon: Boxes, title: 'Evidence Intelligence',
    tagline: 'Every item mapped to every element.',
    plain: 'CourtAccess maps each piece of evidence against every charge and CALCRIM element in a proof matrix, so strengths and gaps are obvious.',
    metrics: [
      { label: 'Evidence items', value: '18', tone: 'neutral' },
      { label: 'Elements supported', value: '7 / 11', tone: 'warn' },
      { label: 'Proof strength', value: '64%', tone: 'warn' },
      { label: 'Contradictions', value: '2', tone: 'bad' },
    ],
    story: {
      found: 'Two of eleven CALCRIM elements have no supporting evidence.',
      matters: 'Unsupported elements are points an attorney may review.',
      where: 'Proof Matrix rows for PEN §211 force/fear and intent.',
      unknown: 'Chain of custody for two exhibits (not in repository).',
      investigate: 'Request custody logs; confirm exhibit provenance.',
    },
    drill: [
      { label: 'Exhibit', value: 'Exhibit 4, Page 2' },
      { label: 'Photograph', value: 'Bounding region provided' },
      { label: 'Chain of custody', value: 'UNKNOWN', unknown: true },
      { label: 'Knowledge Graph', value: '42 nodes / 63 edges' },
    ],
  },
  {
    id: 'map', icon: Network, title: 'Case Intelligence Map',
    tagline: 'See the whole case at a glance.',
    plain: 'An interactive map shows how charges, elements, evidence, witnesses, and timeline events relate — every relationship is repository-derived.',
    metrics: [
      { label: 'Nodes', value: '42', tone: 'neutral' },
      { label: 'Relationships', value: '63', tone: 'neutral' },
      { label: 'Witnesses', value: '4', tone: 'neutral' },
      { label: 'Timeline conflicts', value: '1', tone: 'warn' },
    ],
    story: {
      found: 'A witness placement conflict appears on the timeline.',
      matters: 'Timeline conflicts may bear on identification reliability.',
      where: 'Knowledge Graph edge: Witness A ⟂ Witness B at 9:02 PM.',
      unknown: 'Exact vantage point and lighting for each witness.',
      investigate: 'Re-interview witnesses about vantage point and lighting.',
    },
    drill: [
      { label: 'Timeline', value: '9:02 PM — conflicting placements' },
      { label: 'Related witnesses', value: 'Witness A, Witness B' },
      { label: 'Related charge', value: 'PEN §459 — Burglary' },
      { label: 'Repository authority', value: 'CALCRIM 315 (eyewitness)' },
    ],
  },
  {
    id: 'motion', icon: Gavel, title: 'Motion Intelligence',
    tagline: 'Information for motion review — never a recommendation.',
    plain: 'CourtAccess organizes repository-backed information relevant to attorney motion review, without ever recommending whether to file.',
    metrics: [
      { label: 'Categories flagged', value: '3', tone: 'warn' },
      { label: 'Outstanding discovery', value: '5', tone: 'warn' },
      { label: 'Contradictions', value: '2', tone: 'bad' },
      { label: 'Repository confidence', value: '82%', tone: 'good' },
    ],
    story: {
      found: 'Suppression, Discovery, and Evidence categories carry repository signals.',
      matters: 'These are factual/evidentiary issues an attorney may review.',
      where: 'Collection circumstances for two exhibits are unestablished.',
      unknown: 'Whether a search exception applies (attorney judgment).',
      investigate: 'Obtain the arrest report and dispatch log.',
    },
    drill: [
      { label: 'Repository-flagged', value: 'Suppression, Discovery, Evidence' },
      { label: 'Supporting statute', value: 'PEN §1538.5 (illustrative)' },
      { label: 'Filing recommendation', value: 'None — attorney judgment' },
      { label: 'Search exception', value: 'UNKNOWN', unknown: true },
    ],
  },
  {
    id: 'trial', icon: Landmark, title: 'Trial Readiness Center',
    tagline: 'Everything the case still needs before trial.',
    plain: 'A single courtroom-preparation workflow: readiness metrics, a pretrial checklist, witness prep, exhibits, and a filterable timeline.',
    metrics: [
      { label: 'Trial readiness', value: '58%', tone: 'warn' },
      { label: 'Outstanding investigation', value: '4', tone: 'warn' },
      { label: 'Witnesses to prep', value: '4', tone: 'neutral' },
      { label: 'Human review', value: '3', tone: 'warn' },
    ],
    story: {
      found: 'Three items require attorney review before trial.',
      matters: 'Readiness is organized so nothing is missed.',
      where: 'Pretrial checklist: subpoenas, forensic testing, discovery.',
      unknown: 'Two exhibits’ chain of custody remains UNKNOWN.',
      investigate: 'Subpoena treating-hospital records; obtain EMS run sheet.',
    },
    drill: [
      { label: 'Outstanding subpoenas', value: '2' },
      { label: 'Outstanding forensic', value: '1' },
      { label: 'CALCRIM readiness', value: '7 / 11 elements' },
      { label: 'Chain of custody', value: 'UNKNOWN', unknown: true },
    ],
  },
  {
    id: 'command', icon: LayoutDashboard, title: 'Criminal Case Command Center',
    tagline: 'One command interface for the entire case.',
    plain: 'Every intelligence engine unified into a single executive command interface with shared-context navigation.',
    metrics: [
      { label: 'Case readiness', value: '61%', tone: 'warn' },
      { label: 'Repository confidence', value: '82%', tone: 'good' },
      { label: 'Open investigation', value: '4', tone: 'warn' },
      { label: 'Human review', value: '3', tone: 'warn' },
    ],
    story: {
      found: 'The highest-priority issues are surfaced first.',
      matters: 'Attorneys act on what matters most, immediately.',
      where: 'Executive intelligence panel + unified navigation.',
      unknown: 'Items flagged UNKNOWN are routed to human review.',
      investigate: 'Prioritized investigation tasks with expected impact.',
    },
    drill: [
      { label: 'Highest priority', value: 'Unproven PEN §211 element' },
      { label: 'Recently ingested', value: 'Body-camera clip (illustrative)' },
      { label: 'Collaboration', value: 'Defense team + review queue' },
      { label: 'Production gate', value: 'Illustrative' },
    ],
  },
];

const DIALOGUE = [
  { who: 'attorney', text: 'Here are the strongest repository-backed opportunities in your case, ranked by priority.' },
  { who: 'client', text: 'What does “force or fear not established” mean for the robbery charge?' },
  { who: 'attorney', text: 'It means the record doesn’t currently show that element. Let me open the supporting citation.' },
  { who: 'attorney', text: 'This points to the preliminary transcript, page 14, line 7, and the body-camera at 00:03:12.' },
  { who: 'client', text: 'And what do we still need to find out?' },
  { who: 'attorney', text: 'The medical records are UNKNOWN in the system — we should subpoena them. That’s the next investigation step.' },
];

const toneCls = (t?: string) => t === 'good' ? 'text-emerald-700' : t === 'warn' ? 'text-amber-700' : t === 'bad' ? 'text-red-700' : 'text-gray-900';

export function GuidedDemonstrationPage() {
  const [step, setStep] = useState(0);
  const [presentation, setPresentation] = useState(false);
  const [drillOpen, setDrillOpen] = useState(true);
  const s = STEPS[step];
  const StepIcon = s.icon;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Permanent illustrative label */}
      <div className="rounded-xl border border-amber-300 bg-amber-100/80 px-4 py-2.5 text-center text-sm font-bold uppercase tracking-widest text-amber-800">
        Illustrative Demonstration — sample data for presentation only
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-6 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-100"><Sparkles size={14} /> CourtAccess Guided Demonstration</div>
            <h1 className={`mt-1 font-bold ${presentation ? 'text-4xl' : 'text-2xl'}`}>See the value in 15 seconds</h1>
            <p className="mt-1 max-w-2xl text-sm text-indigo-100">A guided tour of how an attorney and client review repository-backed findings together — every claim traceable, every gap labeled UNKNOWN.</p>
          </div>
          <button onClick={() => setPresentation((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium transition ${presentation ? 'bg-white text-indigo-700' : 'bg-white/10 text-white'}`}><Presentation size={14} /> {presentation ? 'Presentation ON' : 'Presentation mode'}</button>
        </div>
        {/* Step rail */}
        <div className="relative mt-5 flex flex-wrap gap-2">
          {STEPS.map((st, i) => {
            const Ic = st.icon; const active = i === step;
            return (
              <button key={st.id} onClick={() => setStep(i)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-white text-indigo-700 border-white' : 'bg-white/10 text-white border-white/30'}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-indigo-600 text-white' : 'bg-white/20'}`}>{i + 1}</span>
                <Ic size={13} /> {st.title.split(' ').slice(0, 2).join(' ')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current step */}
      <Card className="border-l-4 border-l-indigo-500">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><StepIcon size={22} /></div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Step {step + 1} of {STEPS.length}</div>
              <h2 className={`font-bold text-gray-900 ${presentation ? 'text-2xl' : 'text-xl'}`}>{s.title}</h2>
              <p className="text-sm text-indigo-700 font-medium">{s.tagline}</p>
            </div>
          </div>
          <ProvenanceBadge kind="illustrative" />
        </div>
        <p className={`mt-3 text-gray-700 ${presentation ? 'text-lg' : 'text-sm'}`}>{s.plain}</p>

        {/* Metrics */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {s.metrics.map((m) => (
            <div key={m.label} className="rounded-xl border border-gray-100 bg-gradient-to-b from-white to-slate-50 p-3 text-center">
              <div className={`text-2xl font-bold ${toneCls(m.tone)}`}>{m.value}</div>
              <div className="text-xs text-gray-500 mt-1">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Executive story flow (Phase 4) */}
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1"><PlayCircle size={13} /> Executive story flow</h3>
          <div className="grid gap-2 md:grid-cols-5">
            {[
              { n: '1', k: 'What was found', v: s.story.found, c: 'border-l-indigo-400' },
              { n: '2', k: 'Why it matters', v: s.story.matters, c: 'border-l-violet-400' },
              { n: '3', k: 'Where the evidence is', v: s.story.where, c: 'border-l-emerald-400' },
              { n: '4', k: 'What remains UNKNOWN', v: s.story.unknown, c: 'border-l-gray-400' },
              { n: '5', k: 'What may clarify it', v: s.story.investigate, c: 'border-l-blue-400' },
            ].map((b) => (
              <div key={b.n} className={`rounded-lg border border-gray-100 border-l-4 ${b.c} bg-white p-3`}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{b.n}. {b.k}</div>
                <div className="mt-1 text-sm text-gray-700">{b.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* One-click drill-down (Phase 3) */}
        <div className="mt-5">
          <button onClick={() => setDrillOpen((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <BookMarked size={13} /> One-click drill-down <ChevronRight size={13} className={`transition-transform ${drillOpen ? 'rotate-90' : ''}`} />
          </button>
          {drillOpen && (
            <div className="mt-2 flex flex-wrap gap-2">
              {s.drill.map((d, i) => (
                <span key={i} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${d.unknown ? 'border-gray-300 bg-gray-100 text-gray-500' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`}>
                  {d.unknown ? <HelpCircle size={12} /> : drillIcon(d.label)}<span className="font-medium">{d.label}:</span> {d.value}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between">
          <button disabled={step === 0} onClick={() => setStep((v) => Math.max(0, v - 1))} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"><ChevronLeft size={16} /> Back</button>
          <div className="flex gap-1.5">{STEPS.map((_, i) => <span key={i} className={`h-2 w-2 rounded-full ${i === step ? 'bg-indigo-600' : 'bg-gray-300'}`} />)}</div>
          <button disabled={step === STEPS.length - 1} onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">Next <ChevronRight size={16} /></button>
        </div>
      </Card>

      {/* Attorney / client walkthrough (Phase 2) */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><GraduationCap size={18} className="text-indigo-600" /> Attorney &amp; Client Walkthrough</h3>
          <ProvenanceBadge kind="illustrative" />
        </div>
        <div className="space-y-2">
          {DIALOGUE.map((d, i) => (
            <div key={i} className={`flex ${d.who === 'attorney' ? 'justify-start' : 'justify-end'}`}>
              <div className={`flex max-w-[80%] items-start gap-2 rounded-2xl px-3 py-2 text-sm ${d.who === 'attorney' ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-100 text-slate-800'}`}>
                {d.who === 'attorney' ? <MessageSquare size={14} className="mt-0.5 flex-shrink-0 text-indigo-500" /> : <User size={14} className="mt-0.5 flex-shrink-0 text-slate-500" />}
                <span><span className="font-semibold">{d.who === 'attorney' ? 'Attorney' : 'Client'}:</span> {d.text}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-amber-700">Illustrative dialogue for demonstration only. CourtAccess does not determine guilt, guarantee a defense or outcome, or recommend litigation strategy.</p>
      </Card>
    </div>
  );
}

function drillIcon(label: string) {
  if (/statute/i.test(label)) return <BookMarked size={12} />;
  if (/calcrim/i.test(label)) return <ListChecks size={12} />;
  if (/transcript|report|exhibit|records|photograph/i.test(label)) return <FileText size={12} />;
  if (/camera|timestamp|t =/i.test(label)) return <Clock size={12} />;
  if (/graph|witness|timeline/i.test(label)) return <Network size={12} />;
  if (/investig|forensic|subpoena/i.test(label)) return <Search size={12} />;
  return <Scale size={12} />;
}
