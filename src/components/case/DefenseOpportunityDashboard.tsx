// ============================================================================
// Program 134 — Defense Opportunity Dashboard
// The flagship, top-of-case view that makes the strongest repository-backed
// defense opportunities obvious within seconds. Built from the Attorney
// Workbench bundle. CourtAccess NEVER determines guilt, states that a defense
// will succeed, or recommends a litigation strategy — it organizes evidence-
// governed information for attorney review. Repository / UNKNOWN / Illustrative
// labeled via ProvenanceBadge; every citation is traceable and navigates to the
// supporting workspace. UNKNOWN wherever repository coverage is insufficient.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Scale, AlertTriangle, Gavel, MessageSquareWarning, ListChecks,
  Search, HelpCircle, ChevronRight, BookMarked, FileText, Clock, Network,
  Boxes, Info, Loader2, Users, Sparkles, GraduationCap,
} from 'lucide-react';
import { Card } from '../common/Card';
import { ProvenanceBadge, type Provenance } from '../common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

type Priority = 'Critical' | 'High' | 'Medium' | 'Low' | 'Human Review Required';
const PRIORITY_ORDER: Record<Priority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3, 'Human Review Required': 4 };
const PRIORITY_STYLE: Record<Priority, { badge: string; ring: string; dot: string }> = {
  Critical: { badge: 'bg-red-100 text-red-700 border-red-300', ring: 'border-l-red-500', dot: 'bg-red-500' },
  High: { badge: 'bg-orange-100 text-orange-700 border-orange-300', ring: 'border-l-orange-500', dot: 'bg-orange-500' },
  Medium: { badge: 'bg-amber-100 text-amber-700 border-amber-300', ring: 'border-l-amber-500', dot: 'bg-amber-500' },
  Low: { badge: 'bg-slate-100 text-slate-600 border-slate-300', ring: 'border-l-slate-400', dot: 'bg-slate-400' },
  'Human Review Required': { badge: 'bg-gray-200 text-gray-700 border-gray-400', ring: 'border-l-gray-500', dot: 'bg-gray-500' },
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
}

const MENS_RE = /intent|knowing|willful|reckless|negligen|malice|purpose|specific intent|general intent/i;

export function DefenseOpportunityDashboard({ caseId, compact = false }: { caseId: string; compact?: boolean }) {
  const [b, setB] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clientMode, setClientMode] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try { const bundle = await fetchWorkbench(caseId); if (!cancelled) setB(bundle); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load defense opportunities'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const opportunities = useMemo<Opportunity[]>(() => {
    if (!b) return [];
    const base = `/cases/${caseId}`;
    const evById = new Map(b.evidenceWorkbench.items.map((i) => [i.evidenceId, i.fileName]));
    const nameOf = (id: string) => evById.get(id) ?? id;
    const calcrimFor = (chargeId: string): Citation[] => b.offenseAnalysis
      .filter((o) => o.chargeId === chargeId)
      .flatMap((o) => o.applicableCalcrim.map((c) => ({ label: `CALCRIM ${c.instructionNumber} — ${c.title}`, kind: 'calcrim' as const, to: `${base}/calcrim-intelligence`, locator: 'CALCRIM Intelligence' })));
    const authorityCites: Citation[] = b.legalAuthority.authorities.map((a) => ({ label: a.finding, kind: 'authority', to: `${base}/case-theory`, locator: 'Case Theory' }));
    const out: Opportunity[] = [];

    // 1) Unsupported / partial CALCRIM elements — strongest repository-backed points.
    b.elementMatrices.flatMap((m) => m.rows).filter((r) => r.status.toLowerCase() !== 'satisfied').forEach((r, i) => {
      const unknown = r.status.toLowerCase() === 'unknown';
      const highConf = /high/i.test(r.confidence);
      const priority: Priority = unknown ? 'Human Review Required' : r.status.toLowerCase() === 'unsupported' ? (highConf ? 'Critical' : 'High') : 'Medium';
      const cites: Citation[] = [
        { label: `${r.code} §${r.section}`, kind: 'statute', to: `${base}/charges`, locator: 'Charges' },
        ...calcrimFor(r.chargeId),
        ...r.contradictoryEvidence.map((s) => ({ label: nameOf(s.evidenceId), kind: 'evidence' as const, to: `${base}/evidence-intelligence`, locator: `role: ${s.role}` })),
      ];
      out.push({
        id: `element:${r.elementId}:${i}`,
        icon: ListChecks,
        title: `Unproven element — ${r.code} §${r.section}: ${r.elementLabel}`,
        plainEnglish: `The record does not currently establish "${r.elementLabel}" for the charge under ${r.code} §${r.section}. Its repository status is ${r.status}.`,
        whyMatters: 'The prosecution must prove every element beyond a reasonable doubt. A gap in repository support for an element is a point an attorney may review.',
        affectedCharge: `${r.code} §${r.section}`,
        affectedElements: r.elementLabel,
        affectedMensRea: MENS_RE.test(r.elementLabel) ? r.elementLabel : 'UNKNOWN (no mens-rea element identified in repository for this row)',
        supporting: [`Repository status for this element: ${r.status}.`, ...(r.missingEvidenceReason ? [r.missingEvidenceReason] : [])],
        conflicting: r.supportingEvidence.map((s) => `${nameOf(s.evidenceId)} (${s.role}) currently supports this element.`),
        citations: cites,
        investigation: b.investigation.recommendedInvestigation.slice(0, 4),
        confidence: r.confidence,
        priority,
        priorityReason: unknown ? 'Repository coverage is insufficient to classify this element (UNKNOWN) — flagged for human review.' : `${r.status} element with ${r.confidence} repository confidence.`,
        provenance: unknown ? 'unknown' : 'repository',
      });
    });

    // 2) Contradictions.
    b.evidenceWorkbench.contradictions.forEach((c, i) => out.push({
      id: `contradiction:${c.id ?? i}`,
      icon: Scale,
      title: `Contradiction in the record`,
      plainEnglish: c.finding,
      whyMatters: 'Repository-detected contradictions may bear on the reliability of evidence or testimony and are points an attorney may review.',
      affectedCharge: b.caseOverview.charges.map((ch) => `${ch.code} §${ch.section}`).join(', ') || 'UNKNOWN',
      affectedElements: 'UNKNOWN (not element-linked in repository)',
      affectedMensRea: 'UNKNOWN',
      supporting: [c.finding],
      conflicting: [],
      citations: [{ label: 'Cross-Examination workspace', kind: 'evidence', to: `${base}/cross-examination`, locator: 'Contradiction Analysis' }],
      investigation: b.investigation.witnessGaps.map((w) => w.finding).slice(0, 3),
      confidence: c.status ?? 'UNKNOWN',
      priority: 'High',
      priorityReason: 'Repository-detected contradiction affecting evidentiary reliability.',
      provenance: 'repository',
    }));

    // 3) Impeachment opportunities.
    b.trialPreparation.impeachmentOpportunities.forEach((imp, i) => out.push({
      id: `impeach:${imp.id ?? i}`,
      icon: MessageSquareWarning,
      title: `Potential impeachment material`,
      plainEnglish: `${imp.title}${imp.detail ? ` — ${imp.detail}` : ''}`,
      whyMatters: 'Repository-flagged impeachment material may bear on witness credibility and is a point an attorney may review. CourtAccess does not assert that impeachment is appropriate.',
      affectedCharge: b.caseOverview.charges.map((ch) => `${ch.code} §${ch.section}`).join(', ') || 'UNKNOWN',
      affectedElements: 'UNKNOWN',
      affectedMensRea: 'UNKNOWN',
      supporting: [imp.title],
      conflicting: [],
      citations: (imp.citations ?? []).map((ct) => ({ label: ct.label ?? ct.id, kind: 'evidence' as const, to: `${base}/cross-examination`, locator: ct.type })),
      investigation: [],
      confidence: 'repository',
      priority: 'High',
      priorityReason: 'Repository-flagged impeachment material affecting credibility review.',
      provenance: 'repository',
    }));

    // 4) Statutory defenses / exceptions / immunities.
    const defenseItems = [
      ...b.offenseAnalysis.flatMap((o) => o.defenses.map((d) => ({ text: d, kind: 'defense', chargeId: o.chargeId, code: o.code, section: o.section }))),
      ...b.offenseAnalysis.flatMap((o) => o.exceptions.map((e) => ({ text: e, kind: 'exception', chargeId: o.chargeId, code: o.code, section: o.section }))),
      ...b.legalAuthority.defenses.map((d) => ({ text: d, kind: 'defense', chargeId: '', code: '', section: '' })),
      ...b.legalAuthority.exceptions.map((e) => ({ text: e, kind: 'exception', chargeId: '', code: '', section: '' })),
    ];
    defenseItems.forEach((d, i) => out.push({
      id: `defense:${i}`,
      icon: ShieldCheck,
      title: `Repository-backed ${d.kind}: ${d.text}`,
      plainEnglish: `The repository identifies a possible ${d.kind} (${d.text}) relevant to ${d.code ? `${d.code} §${d.section}` : 'the charges'}.`,
      whyMatters: `A statutory ${d.kind} is a repository-backed authority an attorney may review for applicability. CourtAccess does not assert that it applies or will succeed.`,
      affectedCharge: d.code ? `${d.code} §${d.section}` : (b.caseOverview.charges.map((ch) => `${ch.code} §${ch.section}`).join(', ') || 'UNKNOWN'),
      affectedElements: 'UNKNOWN',
      affectedMensRea: 'UNKNOWN',
      supporting: [`Repository-identified ${d.kind}: ${d.text}`],
      conflicting: [],
      citations: [...(d.chargeId ? calcrimFor(d.chargeId) : []), ...authorityCites].slice(0, 5),
      investigation: [],
      confidence: 'repository',
      priority: 'Medium',
      priorityReason: `Repository-identified ${d.kind}; applicability requires attorney review.`,
      provenance: 'repository',
    }));

    return out.sort((a, c) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[c.priority]);
  }, [b, caseId]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Analyzing repository-backed defense opportunities…</span></div>;
  if (error) return <div className="p-6 text-center text-sm text-red-600">{error}</div>;
  if (!b) return null;

  const cc = b.commandCenter;
  const repoConfidence = cc.unknownCount === 0 ? 100 : Math.max(0, 100 - cc.unknownCount * 10);
  const counts = opportunities.reduce((acc, o) => { acc[o.priority] = (acc[o.priority] ?? 0) + 1; return acc; }, {} as Record<Priority, number>);
  const humanReview = counts['Human Review Required'] ?? 0;
  const top = opportunities.slice(0, compact ? 4 : opportunities.length);

  const citeIcon = (k: Citation['kind']) => k === 'statute' ? <BookMarked size={12} /> : k === 'calcrim' ? <ListChecks size={12} /> : k === 'authority' ? <Gavel size={12} /> : k === 'timeline' ? <Clock size={12} /> : k === 'graph' ? <Network size={12} /> : <FileText size={12} />;

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Sparkles size={22} className="text-indigo-600" /> Defense Opportunity Dashboard</h2>
            <p className="text-sm text-gray-600 mt-1">The strongest repository-backed defense opportunities for this case, ranked by priority.</p>
            <div className="mt-2"><ProvenanceBadge kind="repository" note={`${opportunities.length} opportunity(ies) · confidence ${repoConfidence}%`} /></div>
          </div>
          <button onClick={() => setClientMode((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${clientMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>
            <GraduationCap size={14} /> {clientMode ? 'Client explanation mode' : 'Attorney view'}
          </button>
        </div>
        {/* Priority ribbon */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(['Critical', 'High', 'Medium', 'Low', 'Human Review Required'] as Priority[]).map((p) => (
            <div key={p} className={`rounded-lg border ${PRIORITY_STYLE[p].badge} px-3 py-2 text-center`}>
              <div className="text-xl font-bold">{counts[p] ?? 0}</div>
              <div className="text-[11px] font-medium">{p}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Constitution disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span><strong>CourtAccess does not determine guilt, state that any defense will succeed, or recommend a litigation strategy.</strong> Each opportunity organizes repository-derived facts for attorney review. Every citation is traceable to supporting material; where the repository is insufficient, the result is <strong>UNKNOWN</strong>.</span>
      </div>

      {opportunities.length === 0 ? (
        <Card><p className="text-sm text-gray-500">No repository-backed defense opportunities identified for this case yet (UNKNOWN). As evidence, charges, and CALCRIM coverage are added, opportunities will appear here.</p></Card>
      ) : (
        <div className="space-y-3">
          {top.map((o) => {
            const isOpen = expanded === o.id;
            const st = PRIORITY_STYLE[o.priority];
            return (
              <Card key={o.id} className={`border-l-4 ${st.ring}`}>
                <button className="w-full text-left" onClick={() => setExpanded(isOpen ? null : o.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${st.badge}`}><o.icon size={18} /></div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{o.title}</h3>
                        <p className="text-sm text-gray-600 mt-0.5">{o.plainEnglish}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${st.badge}`}>{o.priority}</span>
                      <ChevronRight size={18} className={`text-gray-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-12">
                    <ProvenanceBadge kind={o.provenance} note={`confidence ${o.confidence}`} />
                    <span className="text-xs text-gray-500">Charge: {o.affectedCharge}</span>
                    {humanReview > 0 && o.priority === 'Human Review Required' && <span className="text-xs text-gray-500 flex items-center gap-1"><HelpCircle size={11} /> requires human review</span>}
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-4 pl-12 space-y-4">
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm text-gray-700"><span className="font-medium">Why it matters:</span> {o.whyMatters}</div>

                    {clientMode ? (
                      // Phase 7 — Client Explanation Mode
                      <div className="space-y-2 text-sm text-gray-700">
                        <div><span className="font-medium text-gray-900">What has been found:</span> {o.plainEnglish}</div>
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
                            {o.supporting.length ? <ul className="space-y-1 text-sm text-gray-700">{o.supporting.map((s, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />{s}</li>)}</ul> : <p className="text-sm text-gray-500">UNKNOWN</p>}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-1">Evidence conflicting with review</h4>
                            {o.conflicting.length ? <ul className="space-y-1 text-sm text-gray-700">{o.conflicting.map((s, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />{s}</li>)}</ul> : <p className="text-sm text-gray-500">None recorded (UNKNOWN).</p>}
                          </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-3 text-sm">
                          <div className="rounded-lg border border-gray-100 p-2"><span className="text-xs text-gray-500">Affected charge</span><div className="text-gray-800">{o.affectedCharge}</div></div>
                          <div className="rounded-lg border border-gray-100 p-2"><span className="text-xs text-gray-500">Affected element(s)</span><div className="text-gray-800">{o.affectedElements}</div></div>
                          <div className="rounded-lg border border-gray-100 p-2"><span className="text-xs text-gray-500">Affected mens rea</span><div className="text-gray-800">{o.affectedMensRea}</div></div>
                        </div>

                        {/* Phase 3 — Citation panel */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1"><BookMarked size={12} /> Citations (click to open supporting material)</h4>
                          {o.citations.length === 0 ? <p className="text-sm text-gray-500">No repository citations available (UNKNOWN).</p> : (
                            <div className="flex flex-wrap gap-2">
                              {o.citations.map((c, i) => (
                                <Link key={i} to={c.to} className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700 hover:bg-indigo-100">
                                  {citeIcon(c.kind)}<span className="font-medium">{c.label}</span><span className="text-indigo-400">· {c.locator}</span>
                                </Link>
                              ))}
                            </div>
                          )}
                          <p className="mt-1 text-[11px] text-gray-400">Granular locators (police-report page/paragraph, transcript page/line, dash/body-cam & audio timestamps, exhibit image locations) display only when present in repository metadata; otherwise they are UNKNOWN and are not fabricated.</p>
                        </div>

                        {/* Phase 4 — Investigation opportunities */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1"><Search size={12} /> Investigation opportunities</h4>
                          {o.investigation.length ? <ul className="space-y-1 text-sm text-gray-700">{o.investigation.map((s, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />{s}</li>)}</ul> : <p className="text-sm text-gray-500">No repository-backed investigation items for this opportunity (UNKNOWN).</p>}
                          <Link to={`/cases/${caseId}/investigation-command`} className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">Open Investigation Command Center <ChevronRight size={12} /></Link>
                        </div>

                        {/* Phase 5 — priority explanation */}
                        <div className="flex items-start gap-2 text-xs text-gray-500"><span className={`mt-1 h-2 w-2 rounded-full ${st.dot} flex-shrink-0`} /><span><span className="font-medium text-gray-700">Priority: {o.priority}.</span> {o.priorityReason}</span></div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {compact && opportunities.length > top.length && (
            <Link to={`/cases/${caseId}/defense-opportunity-dashboard`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">View all {opportunities.length} defense opportunities <ChevronRight size={14} /></Link>
          )}
        </div>
      )}

      {!compact && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link to={`/cases/${caseId}/evidence-intelligence`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 text-sm"><Boxes size={16} className="text-emerald-600 mb-1" /><div className="font-medium text-gray-800">Evidence Intelligence</div></Link>
          <Link to={`/cases/${caseId}/case-theory`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 text-sm"><Scale size={16} className="text-indigo-600 mb-1" /><div className="font-medium text-gray-800">Case Theory</div></Link>
          <Link to={`/cases/${caseId}/cross-examination`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 text-sm"><Users size={16} className="text-amber-600 mb-1" /><div className="font-medium text-gray-800">Cross-Examination</div></Link>
          <Link to={`/cases/${caseId}/investigation-command`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 text-sm"><Search size={16} className="text-blue-600 mb-1" /><div className="font-medium text-gray-800">Investigation</div></Link>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        <Info size={13} className="mt-0.5 flex-shrink-0" />
        <span>Every assertion is traceable to repository-backed evidence or citations. Illustrative content, when shown, is labeled separately. UNKNOWN denotes insufficient repository coverage requiring attorney review.</span>
      </div>
    </div>
  );
}
