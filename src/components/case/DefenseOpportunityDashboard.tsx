// ============================================================================
// Program 134 + 136 — Defense Opportunity Dashboard
// The flagship, top-of-case view that makes the strongest repository-backed
// defense opportunities obvious within one second, and the signature marketing
// surface of CourtAccess. Built from the Attorney Workbench bundle in `live`
// mode; `demo` mode renders a permanently-labeled ILLUSTRATIVE DEMONSTRATION
// dataset for marketing. CourtAccess NEVER determines guilt, guarantees a
// defense/outcome, or recommends litigation strategy. Repository / UNKNOWN /
// Illustrative are labeled via ProvenanceBadge; every live assertion is
// traceable and navigates to the supporting workspace. UNKNOWN wherever
// repository coverage is insufficient.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Scale, AlertTriangle, Gavel, MessageSquareWarning, ListChecks,
  Search, HelpCircle, ChevronRight, BookMarked, FileText, Clock, Network,
  Boxes, Info, Loader2, Users, Sparkles, GraduationCap, Presentation, Star,
  Flame, Brain, PackageSearch, ScanSearch,
} from 'lucide-react';
import { Card } from '../common/Card';
import { ProvenanceBadge, type Provenance } from '../common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

type Priority = 'Critical' | 'High' | 'Medium' | 'Low' | 'Human Review Required';
const PRIORITY_ORDER: Record<Priority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3, 'Human Review Required': 4 };
const PRIORITY_STYLE: Record<Priority, { badge: string; ring: string; dot: string; grad: string }> = {
  Critical: { badge: 'bg-red-100 text-red-700 border-red-300', ring: 'border-l-red-500', dot: 'bg-red-500', grad: 'from-red-500/10 to-transparent' },
  High: { badge: 'bg-orange-100 text-orange-700 border-orange-300', ring: 'border-l-orange-500', dot: 'bg-orange-500', grad: 'from-orange-500/10 to-transparent' },
  Medium: { badge: 'bg-amber-100 text-amber-700 border-amber-300', ring: 'border-l-amber-500', dot: 'bg-amber-500', grad: 'from-amber-400/10 to-transparent' },
  Low: { badge: 'bg-slate-100 text-slate-600 border-slate-300', ring: 'border-l-slate-400', dot: 'bg-slate-400', grad: 'from-slate-400/10 to-transparent' },
  'Human Review Required': { badge: 'bg-gray-200 text-gray-700 border-gray-400', ring: 'border-l-gray-500', dot: 'bg-gray-500', grad: 'from-gray-400/10 to-transparent' },
};

// Phase 4 — premium visual-importance indicators.
const TAG_STYLE: Record<string, { cls: string; icon: typeof Star }> = {
  'Critical Opportunity': { cls: 'bg-red-50 text-red-700 border-red-200', icon: Flame },
  'High Value': { cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: Star },
  'Evidence Missing': { cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: PackageSearch },
  'Contradiction Found': { cls: 'bg-red-50 text-red-700 border-red-200', icon: Scale },
  'Witness Conflict': { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: MessageSquareWarning },
  'Timeline Conflict': { cls: 'bg-cyan-50 text-cyan-700 border-cyan-200', icon: Clock },
  'Mens Rea Question': { cls: 'bg-violet-50 text-violet-700 border-violet-200', icon: Brain },
  'CALCRIM Deficiency': { cls: 'bg-sky-50 text-sky-700 border-sky-200', icon: ListChecks },
  'Investigation Needed': { cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: ScanSearch },
  'Human Review': { cls: 'bg-gray-100 text-gray-600 border-gray-300', icon: HelpCircle },
};

interface Citation { label: string; kind: 'statute' | 'calcrim' | 'authority' | 'evidence' | 'graph' | 'timeline'; to: string; locator: string }
interface Opportunity {
  id: string;
  icon: typeof Scale;
  title: string;
  plainEnglish: string;
  whyMatters: string;
  affectedCharge: string;
  affectedElements: string;
  affectedMensRea: string;
  supporting: string[];
  conflicting: string[];
  citations: Citation[];
  investigation: string[];
  confidence: string;
  priority: Priority;
  priorityReason: string;
  provenance: Provenance;
  tags: string[];
}

const MENS_RE = /intent|knowing|willful|reckless|negligen|malice|purpose|specific intent|general intent/i;

function tagsFor(o: Omit<Opportunity, 'tags'>): string[] {
  const t = new Set<string>();
  if (o.priority === 'Critical') t.add('Critical Opportunity');
  if (o.priority === 'High') t.add('High Value');
  if (/unproven|unsupported|element/i.test(o.title)) t.add('CALCRIM Deficiency');
  if (/contradiction/i.test(o.title)) t.add('Contradiction Found');
  if (/impeach|witness/i.test(o.title)) t.add('Witness Conflict');
  if (/timeline/i.test(o.title + o.plainEnglish)) t.add('Timeline Conflict');
  if (o.supporting.some((s) => /missing/i.test(s)) || /missing/i.test(o.plainEnglish)) t.add('Evidence Missing');
  if (!o.affectedMensRea.startsWith('UNKNOWN')) t.add('Mens Rea Question');
  if (o.investigation.length > 0) t.add('Investigation Needed');
  if (o.provenance === 'unknown' || o.priority === 'Human Review Required') t.add('Human Review');
  return [...t];
}

// ------- Phase 7: permanently-labeled ILLUSTRATIVE DEMONSTRATION dataset -------
const DEMO_OPPORTUNITIES: Opportunity[] = ([
  {
    id: 'demo-1', icon: ListChecks, priority: 'Critical' as Priority,
    title: 'Unproven element — PEN §211: taking by force or fear',
    plainEnglish: 'The record does not establish that force or fear was used during the alleged taking. This is a required element of robbery.',
    whyMatters: 'Robbery requires proof of force or fear beyond a reasonable doubt. Without it, the charge may warrant review.',
    affectedCharge: 'PEN §211', affectedElements: 'Taking accomplished by force or fear', affectedMensRea: 'Specific intent to permanently deprive',
    supporting: ['No repository evidence establishes force or fear.', 'Victim statement does not describe a threat.'],
    conflicting: ['Surveillance still shows proximity (does not establish force).'],
    citations: [
      { label: 'PEN §211', kind: 'statute', to: '#', locator: 'Statute' },
      { label: 'CALCRIM 1600 — Robbery', kind: 'calcrim', to: '#', locator: 'Instruction' },
      { label: 'Prelim transcript p.14 l.7', kind: 'evidence', to: '#', locator: 'Page 14, Line 7' },
      { label: 'Bodycam 00:03:12', kind: 'evidence', to: '#', locator: 't=00:03:12' },
    ],
    investigation: ['Interview the responding officer about the initial encounter.', 'Obtain the store’s full-resolution surveillance clip.'],
    confidence: 'HIGH', priorityReason: 'Unsupported required element with high repository confidence.', provenance: 'illustrative',
  },
  {
    id: 'demo-2', icon: Scale, priority: 'High' as Priority,
    title: 'Contradiction in the record',
    plainEnglish: 'Two witness accounts place the defendant in different locations at the same time.',
    whyMatters: 'A contradiction may bear on the reliability of an identification and merits attorney review.',
    affectedCharge: 'PEN §459', affectedElements: 'Entry into a structure', affectedMensRea: 'UNKNOWN',
    supporting: ['Witness A: defendant at the front entrance 9:02 PM.', 'Witness B: defendant across the street 9:02 PM.'],
    conflicting: [],
    citations: [
      { label: 'Report p.3 ¶2', kind: 'evidence', to: '#', locator: 'Page 3, Paragraph 2' },
      { label: 'Report p.6 ¶1', kind: 'evidence', to: '#', locator: 'Page 6, Paragraph 1' },
    ],
    investigation: ['Re-interview both witnesses regarding vantage point and lighting.'],
    confidence: 'MEDIUM', priorityReason: 'Repository-detected contradiction affecting identification reliability.', provenance: 'illustrative',
  },
  {
    id: 'demo-3', icon: MessageSquareWarning, priority: 'High' as Priority,
    title: 'Potential impeachment material',
    plainEnglish: 'A witness gave a prior statement that differs from later testimony about the vehicle color.',
    whyMatters: 'Prior inconsistent statements may bear on credibility. CourtAccess does not assert impeachment is appropriate.',
    affectedCharge: 'VEH §10851', affectedElements: 'Identity of the vehicle', affectedMensRea: 'UNKNOWN',
    supporting: ['Initial 911 call: “dark blue sedan”.', 'Preliminary hearing: “black SUV”.'],
    conflicting: [],
    citations: [
      { label: '911 audio 00:00:41', kind: 'evidence', to: '#', locator: 't=00:00:41' },
      { label: 'Prelim transcript p.22 l.15', kind: 'evidence', to: '#', locator: 'Page 22, Line 15' },
    ],
    investigation: ['Obtain the CAD/911 recording and dispatch log.'],
    confidence: 'MEDIUM', priorityReason: 'Repository-flagged prior inconsistent statement.', provenance: 'illustrative',
  },
  {
    id: 'demo-4', icon: ShieldCheck, priority: 'Medium' as Priority,
    title: 'Repository-backed defense: necessity',
    plainEnglish: 'The repository identifies a potential statutory defense relevant to the charged conduct.',
    whyMatters: 'A recognized defense is an authority an attorney may review for applicability — not a guarantee it applies.',
    affectedCharge: 'HS §11350', affectedElements: 'Knowing possession', affectedMensRea: 'Knowledge of presence and nature',
    supporting: ['Repository authority: recognized affirmative defense on point.'],
    conflicting: [],
    citations: [
      { label: 'CALCRIM 3403 — Necessity', kind: 'calcrim', to: '#', locator: 'Instruction' },
      { label: 'Repository authority', kind: 'authority', to: '#', locator: 'Authorities' },
    ],
    investigation: [],
    confidence: 'HIGH', priorityReason: 'Repository-identified statutory defense; applicability requires review.', provenance: 'illustrative',
  },
  {
    id: 'demo-5', icon: HelpCircle, priority: 'Human Review Required' as Priority,
    title: 'Unproven element — PEN §245(a)(1): great bodily injury',
    plainEnglish: 'The repository cannot classify whether the injury element is supported. This requires attorney review.',
    whyMatters: 'When the record is insufficient, CourtAccess reports UNKNOWN rather than guessing.',
    affectedCharge: 'PEN §245(a)(1)', affectedElements: 'Force likely to produce great bodily injury', affectedMensRea: 'UNKNOWN',
    supporting: ['Repository status for this element: UNKNOWN.'],
    conflicting: [],
    citations: [{ label: 'Medical records (not in repository)', kind: 'evidence', to: '#', locator: 'UNKNOWN' }],
    investigation: ['Subpoena treating-hospital records.', 'Obtain EMS run sheet.'],
    confidence: 'UNKNOWN', priorityReason: 'Repository coverage insufficient — flagged for human review.', provenance: 'unknown',
  },
] as Omit<Opportunity, 'tags'>[]).map((o) => ({ ...o, tags: tagsFor(o) }));

export function DefenseOpportunityDashboard({
  caseId, compact = false, mode = 'live',
}: { caseId?: string; compact?: boolean; mode?: 'live' | 'demo' }) {
  const [b, setB] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(mode === 'live');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clientMode, setClientMode] = useState(false);
  const [presentation, setPresentation] = useState(false);

  useEffect(() => {
    if (mode !== 'live' || !caseId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try { const bundle = await fetchWorkbench(caseId); if (!cancelled) setB(bundle); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load defense opportunities'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [caseId, mode]);

  const liveOpportunities = useMemo<Opportunity[]>(() => {
    if (!b) return [];
    const base = `/cases/${caseId}`;
    const evById = new Map(b.evidenceWorkbench.items.map((i) => [i.evidenceId, i.fileName]));
    const nameOf = (id: string) => evById.get(id) ?? id;
    const calcrimFor = (chargeId: string): Citation[] => b.offenseAnalysis
      .filter((o) => o.chargeId === chargeId)
      .flatMap((o) => o.applicableCalcrim.map((c) => ({ label: `CALCRIM ${c.instructionNumber} — ${c.title}`, kind: 'calcrim' as const, to: `${base}/calcrim-intelligence`, locator: 'CALCRIM Intelligence' })));
    const authorityCites: Citation[] = b.legalAuthority.authorities.map((a) => ({ label: a.finding, kind: 'authority', to: `${base}/case-theory`, locator: 'Case Theory' }));
    const out: Omit<Opportunity, 'tags'>[] = [];

    b.elementMatrices.flatMap((m) => m.rows).filter((r) => r.status.toLowerCase() !== 'satisfied').forEach((r, i) => {
      const unknown = r.status.toLowerCase() === 'unknown';
      const highConf = /high/i.test(r.confidence);
      const priority: Priority = unknown ? 'Human Review Required' : r.status.toLowerCase() === 'unsupported' ? (highConf ? 'Critical' : 'High') : 'Medium';
      out.push({
        id: `element:${r.elementId}:${i}`, icon: ListChecks, priority,
        title: `Unproven element — ${r.code} §${r.section}: ${r.elementLabel}`,
        plainEnglish: `The record does not currently establish "${r.elementLabel}" for the charge under ${r.code} §${r.section}. Its repository status is ${r.status}.`,
        whyMatters: 'The prosecution must prove every element beyond a reasonable doubt. A gap in repository support for an element is a point an attorney may review.',
        affectedCharge: `${r.code} §${r.section}`, affectedElements: r.elementLabel,
        affectedMensRea: MENS_RE.test(r.elementLabel) ? r.elementLabel : 'UNKNOWN (no mens-rea element identified in repository for this row)',
        supporting: [`Repository status for this element: ${r.status}.`, ...(r.missingEvidenceReason ? [r.missingEvidenceReason] : [])],
        conflicting: r.supportingEvidence.map((s) => `${nameOf(s.evidenceId)} (${s.role}) currently supports this element.`),
        citations: [
          { label: `${r.code} §${r.section}`, kind: 'statute', to: `${base}/charges`, locator: 'Charges' },
          ...calcrimFor(r.chargeId),
          ...r.contradictoryEvidence.map((s) => ({ label: nameOf(s.evidenceId), kind: 'evidence' as const, to: `${base}/evidence-intelligence`, locator: `role: ${s.role}` })),
        ],
        investigation: b.investigation.recommendedInvestigation.slice(0, 4),
        confidence: r.confidence,
        priorityReason: unknown ? 'Repository coverage is insufficient to classify this element (UNKNOWN) — flagged for human review.' : `${r.status} element with ${r.confidence} repository confidence.`,
        provenance: unknown ? 'unknown' : 'repository',
      });
    });
    b.evidenceWorkbench.contradictions.forEach((c, i) => out.push({
      id: `contradiction:${c.id ?? i}`, icon: Scale, priority: 'High',
      title: 'Contradiction in the record', plainEnglish: c.finding,
      whyMatters: 'Repository-detected contradictions may bear on the reliability of evidence or testimony and are points an attorney may review.',
      affectedCharge: b.caseOverview.charges.map((ch) => `${ch.code} §${ch.section}`).join(', ') || 'UNKNOWN',
      affectedElements: 'UNKNOWN (not element-linked in repository)', affectedMensRea: 'UNKNOWN',
      supporting: [c.finding], conflicting: [],
      citations: [{ label: 'Cross-Examination workspace', kind: 'evidence', to: `${base}/cross-examination`, locator: 'Contradiction Analysis' }],
      investigation: b.investigation.witnessGaps.map((w) => w.finding).slice(0, 3),
      confidence: c.status ?? 'UNKNOWN', priorityReason: 'Repository-detected contradiction affecting evidentiary reliability.', provenance: 'repository',
    }));
    b.trialPreparation.impeachmentOpportunities.forEach((imp, i) => out.push({
      id: `impeach:${imp.id ?? i}`, icon: MessageSquareWarning, priority: 'High',
      title: 'Potential impeachment material', plainEnglish: `${imp.title}${imp.detail ? ` — ${imp.detail}` : ''}`,
      whyMatters: 'Repository-flagged impeachment material may bear on witness credibility and is a point an attorney may review. CourtAccess does not assert that impeachment is appropriate.',
      affectedCharge: b.caseOverview.charges.map((ch) => `${ch.code} §${ch.section}`).join(', ') || 'UNKNOWN',
      affectedElements: 'UNKNOWN', affectedMensRea: 'UNKNOWN',
      supporting: [imp.title], conflicting: [],
      citations: (imp.citations ?? []).map((ct) => ({ label: ct.label ?? ct.id, kind: 'evidence' as const, to: `${base}/cross-examination`, locator: ct.type })),
      investigation: [], confidence: 'repository', priorityReason: 'Repository-flagged impeachment material affecting credibility review.', provenance: 'repository',
    }));
    const defenseItems = [
      ...b.offenseAnalysis.flatMap((o) => o.defenses.map((d) => ({ text: d, kind: 'defense', chargeId: o.chargeId, code: o.code, section: o.section }))),
      ...b.offenseAnalysis.flatMap((o) => o.exceptions.map((e) => ({ text: e, kind: 'exception', chargeId: o.chargeId, code: o.code, section: o.section }))),
      ...b.legalAuthority.defenses.map((d) => ({ text: d, kind: 'defense', chargeId: '', code: '', section: '' })),
      ...b.legalAuthority.exceptions.map((e) => ({ text: e, kind: 'exception', chargeId: '', code: '', section: '' })),
    ];
    defenseItems.forEach((d, i) => out.push({
      id: `defense:${i}`, icon: ShieldCheck, priority: 'Medium',
      title: `Repository-backed ${d.kind}: ${d.text}`,
      plainEnglish: `The repository identifies a possible ${d.kind} (${d.text}) relevant to ${d.code ? `${d.code} §${d.section}` : 'the charges'}.`,
      whyMatters: `A statutory ${d.kind} is a repository-backed authority an attorney may review for applicability. CourtAccess does not assert that it applies or will succeed.`,
      affectedCharge: d.code ? `${d.code} §${d.section}` : (b.caseOverview.charges.map((ch) => `${ch.code} §${ch.section}`).join(', ') || 'UNKNOWN'),
      affectedElements: 'UNKNOWN', affectedMensRea: 'UNKNOWN',
      supporting: [`Repository-identified ${d.kind}: ${d.text}`], conflicting: [],
      citations: [...(d.chargeId ? calcrimFor(d.chargeId) : []), ...authorityCites].slice(0, 5),
      investigation: [], confidence: 'repository', priorityReason: `Repository-identified ${d.kind}; applicability requires attorney review.`, provenance: 'repository',
    }));

    return out.map((o) => ({ ...o, tags: tagsFor(o) })).sort((a, c) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[c.priority]);
  }, [b, caseId]);

  const isDemo = mode === 'demo';
  const opportunities = isDemo ? DEMO_OPPORTUNITIES : liveOpportunities;

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Analyzing repository-backed defense opportunities…</span></div>;
  if (error) return <div className="p-6 text-center text-sm text-red-600">{error}</div>;
  if (!isDemo && !b) return null;

  const cc = b?.commandCenter;
  const repoConfidence = isDemo ? 82 : (cc && cc.unknownCount === 0 ? 100 : Math.max(0, 100 - (cc?.unknownCount ?? 0) * 10));
  const counts = opportunities.reduce((acc, o) => { acc[o.priority] = (acc[o.priority] ?? 0) + 1; return acc; }, {} as Record<Priority, number>);
  const top = opportunities.slice(0, compact ? 4 : opportunities.length);

  const citeIcon = (k: Citation['kind']) => k === 'statute' ? <BookMarked size={12} /> : k === 'calcrim' ? <ListChecks size={12} /> : k === 'authority' ? <Gavel size={12} /> : k === 'timeline' ? <Clock size={12} /> : k === 'graph' ? <Network size={12} /> : <FileText size={12} />;
  const titleSize = presentation ? 'text-xl' : 'text-base';
  const bodySize = presentation ? 'text-base' : 'text-sm';

  return (
    <div className="space-y-4">
      {/* Marketing demonstration banner (permanent, Phase 7) */}
      {isDemo && (
        <div className="rounded-xl border border-amber-300 bg-amber-100/80 px-4 py-2.5 text-center text-sm font-bold uppercase tracking-widest text-amber-800">
          Illustrative Demonstration — sample data for presentation only
        </div>
      )}

      {/* Phase 1 — flagship glass header */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-6 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-100"><Sparkles size={14} /> CourtAccess Litigation Intelligence</div>
            <h2 className={`mt-1 font-bold ${presentation ? 'text-4xl' : 'text-2xl'}`}>Top Defense Opportunities</h2>
            <p className="mt-1 max-w-2xl text-sm text-indigo-100">The strongest repository-backed opportunities for this case — ranked, cited, and ready for attorney review.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-2xl bg-white/15 px-4 py-2 text-right backdrop-blur">
              <div className="text-3xl font-bold leading-none">{opportunities.length}</div>
              <div className="text-[11px] uppercase tracking-wide text-indigo-100">opportunities</div>
            </div>
            <div className="rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">Repository confidence {repoConfidence}%</div>
          </div>
        </div>
        {/* Priority ribbon */}
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(['Critical', 'High', 'Medium', 'Low', 'Human Review Required'] as Priority[]).map((p) => (
            <div key={p} className="rounded-xl bg-white/15 px-3 py-2 text-center backdrop-blur">
              <div className="text-2xl font-bold leading-none">{counts[p] ?? 0}</div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-indigo-100">{p}</div>
            </div>
          ))}
        </div>
        {/* Mode toggles */}
        <div className="relative mt-4 flex flex-wrap gap-2">
          <button onClick={() => setClientMode((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium transition ${clientMode ? 'bg-white text-indigo-700' : 'bg-white/10 text-white'}`}><GraduationCap size={14} /> {clientMode ? 'Client explanation ON' : 'Client explanation'}</button>
          <button onClick={() => setPresentation((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium transition ${presentation ? 'bg-white text-indigo-700' : 'bg-white/10 text-white'}`}><Presentation size={14} /> {presentation ? 'Presentation ON' : 'Presentation mode'}</button>
        </div>
      </div>

      {/* Constitution disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span><strong>CourtAccess does not determine guilt, guarantee any defense or outcome, or recommend litigation strategy.</strong> Each opportunity organizes {isDemo ? 'illustrative sample' : 'repository-derived'} facts for attorney review. {isDemo ? 'All cards on this screen are an ILLUSTRATIVE DEMONSTRATION.' : 'Every citation is traceable to supporting material; where the repository is insufficient, the result is'} {isDemo ? '' : <strong>UNKNOWN</strong>}.</span>
      </div>

      {opportunities.length === 0 ? (
        <Card><p className="text-sm text-gray-500">No repository-backed defense opportunities identified for this case yet (UNKNOWN). As evidence, charges, and CALCRIM coverage are added, opportunities will appear here.</p></Card>
      ) : (
        <div className="space-y-3">
          {top.map((o) => {
            const isOpen = expanded === o.id || presentation;
            const st = PRIORITY_STYLE[o.priority];
            return (
              <Card key={o.id} className={`border-l-4 ${st.ring} bg-gradient-to-r ${st.grad} transition-all duration-200 hover:shadow-lg`}>
                <button className="w-full text-left" onClick={() => setExpanded(isOpen && expanded === o.id ? null : o.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl ${st.badge} shadow-sm`}><o.icon size={20} /></div>
                      <div>
                        <h3 className={`${titleSize} font-semibold text-gray-900`}>{o.title}</h3>
                        <p className={`${bodySize} text-gray-600 mt-0.5`}>{o.plainEnglish}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {o.priority === 'Critical' && <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" /></span>}
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${st.badge}`}>{o.priority}</span>
                      {!presentation && <ChevronRight size={18} className={`text-gray-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} />}
                    </div>
                  </div>
                  {/* Phase 4 — visual importance tags */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-14">
                    {o.tags.map((tag) => {
                      const ts = TAG_STYLE[tag] ?? { cls: 'bg-gray-100 text-gray-600 border-gray-300', icon: Star };
                      const TIcon = ts.icon;
                      return <span key={tag} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ts.cls}`}><TIcon size={11} />{tag}</span>;
                    })}
                    <ProvenanceBadge kind={o.provenance} note={`confidence ${o.confidence}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className={`mt-4 pl-14 space-y-4 ${bodySize}`}>
                    <div className="rounded-lg bg-white/70 border border-gray-100 p-3 text-gray-700"><span className="font-medium">Why it matters:</span> {o.whyMatters}</div>

                    {clientMode ? (
                      <div className="space-y-2 text-gray-700">
                        <div><span className="font-medium text-gray-900">What was found:</span> {o.plainEnglish}</div>
                        <div><span className="font-medium text-gray-900">Why it may matter:</span> {o.whyMatters}</div>
                        <div><span className="font-medium text-gray-900">What additional investigation may help:</span> {o.investigation.length ? o.investigation.join('; ') : 'No specific repository-backed items yet (UNKNOWN).'}</div>
                        <div><span className="font-medium text-gray-900">What remains unknown:</span> {o.provenance === 'unknown' || o.affectedMensRea.startsWith('UNKNOWN') ? 'Some facts are not established by the record and require review.' : 'See attorney view for the detailed record.'}</div>
                        <p className="text-xs text-amber-700">Plain-English summary for client review — not legal advice, and not a prediction of any outcome.</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">Evidence supporting review</h4>
                            {o.supporting.length ? <ul className="space-y-1 text-gray-700">{o.supporting.map((s, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />{s}</li>)}</ul> : <p className="text-gray-500">UNKNOWN</p>}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-1">Evidence conflicting with review</h4>
                            {o.conflicting.length ? <ul className="space-y-1 text-gray-700">{o.conflicting.map((s, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />{s}</li>)}</ul> : <p className="text-gray-500">None recorded (UNKNOWN).</p>}
                          </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-3">
                          <div className="rounded-lg border border-gray-100 bg-white/70 p-2"><span className="text-xs text-gray-500">Affected charge</span><div className="text-gray-800">{o.affectedCharge}</div></div>
                          <div className="rounded-lg border border-gray-100 bg-white/70 p-2"><span className="text-xs text-gray-500">Affected element(s)</span><div className="text-gray-800">{o.affectedElements}</div></div>
                          <div className="rounded-lg border border-gray-100 bg-white/70 p-2"><span className="text-xs text-gray-500">Affected mens rea</span><div className="text-gray-800">{o.affectedMensRea}</div></div>
                        </div>

                        {/* Phase 3 — traceable citation panel */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1"><BookMarked size={12} /> Citations (click to open supporting material)</h4>
                          {o.citations.length === 0 ? <p className="text-gray-500">No repository citations available (UNKNOWN).</p> : (
                            <div className="flex flex-wrap gap-2">
                              {o.citations.map((c, i) => isDemo ? (
                                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">{citeIcon(c.kind)}<span className="font-medium">{c.label}</span><span className="text-indigo-400">· {c.locator}</span></span>
                              ) : (
                                <Link key={i} to={c.to} className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700 hover:bg-indigo-100">{citeIcon(c.kind)}<span className="font-medium">{c.label}</span><span className="text-indigo-400">· {c.locator}</span></Link>
                              ))}
                            </div>
                          )}
                          {!isDemo && <p className="mt-1 text-[11px] text-gray-400">Granular locators (police-report page/paragraph, transcript page/line, dash/body-cam & audio timestamps, exhibit image locations) display only when present in repository metadata; otherwise they are UNKNOWN and are not fabricated.</p>}
                        </div>

                        {/* Phase 5 — investigation impact */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1"><Search size={12} /> Investigation impact</h4>
                          {o.investigation.length ? <ul className="space-y-1 text-gray-700">{o.investigation.map((s, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />{s}</li>)}</ul> : <p className="text-gray-500">No repository-backed investigation items for this opportunity (UNKNOWN).</p>}
                          {!isDemo && caseId && <Link to={`/cases/${caseId}/investigation-command`} className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">Open Investigation Command Center <ChevronRight size={12} /></Link>}
                        </div>

                        <div className="flex items-start gap-2 text-xs text-gray-500"><span className={`mt-1 h-2 w-2 rounded-full ${st.dot} flex-shrink-0`} /><span><span className="font-medium text-gray-700">Priority: {o.priority}.</span> {o.priorityReason}</span></div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {compact && opportunities.length > top.length && caseId && (
            <Link to={`/cases/${caseId}/defense-opportunity-dashboard`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">View all {opportunities.length} defense opportunities <ChevronRight size={14} /></Link>
          )}
        </div>
      )}

      {!compact && !isDemo && caseId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link to={`/cases/${caseId}/evidence-intelligence`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 text-sm"><Boxes size={16} className="text-emerald-600 mb-1" /><div className="font-medium text-gray-800">Evidence Intelligence</div></Link>
          <Link to={`/cases/${caseId}/case-theory`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 text-sm"><Scale size={16} className="text-indigo-600 mb-1" /><div className="font-medium text-gray-800">Case Theory</div></Link>
          <Link to={`/cases/${caseId}/cross-examination`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 text-sm"><Users size={16} className="text-amber-600 mb-1" /><div className="font-medium text-gray-800">Cross-Examination</div></Link>
          <Link to={`/cases/${caseId}/investigation-command`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 text-sm"><Search size={16} className="text-blue-600 mb-1" /><div className="font-medium text-gray-800">Investigation</div></Link>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        <Info size={13} className="mt-0.5 flex-shrink-0" />
        <span>{isDemo ? 'This screen is an ILLUSTRATIVE DEMONSTRATION using sample data for marketing and training. It does not reflect a real case.' : 'Every assertion is traceable to repository-backed evidence or citations. Illustrative content, when shown, is labeled separately. UNKNOWN denotes insufficient repository coverage requiring attorney review.'}</span>
      </div>
    </div>
  );
}
