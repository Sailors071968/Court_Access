// ============================================================================
// Program 129 — Case Theory Center
// Organizes repository-backed evidence into structured competing case theories
// (potential prosecution theory vs potential defense theory) for attorney
// review. CourtAccess NEVER determines guilt, predicts verdicts, or recommends a
// litigation strategy. Repository-backed vs UNKNOWN vs Illustrative are labeled
// via ProvenanceBadge; UNKNOWN wherever repository coverage is insufficient. No
// case theories, legal conclusions, or outcomes are fabricated.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Scale, Gavel, Shield, GitCompareArrows, BarChart3, TrendingUp, ClipboardList,
  Users, FileText, Clock, ListChecks, Info, HelpCircle, Loader2, AlertTriangle,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { ProvenanceBadge, type Provenance } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

const kindOf = (n: number): Provenance => (n > 0 ? 'repository' : 'unknown');

interface Theory {
  id: 'prosecution' | 'defense';
  label: string;
  icon: typeof Gavel;
  accent: string;
  summary: string;
  supporting: string[];
  conflicting: string[];
  factualQuestions: string[];
  evidentiaryQuestions: string[];
  relatedWitnesses: string[];
  relatedDocuments: string[];
  relatedTimeline: string[];
  relatedCalcrim: string[];
  missingEvidence: string[];
  missingWitnesses: string[];
  investigationOpportunities: string[];
  confidence: number;
}

function Section({ icon, title, kind, note, children }: { icon: React.ReactNode; title: string; kind: Provenance; note?: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">{icon} {title}</h3>
        <ProvenanceBadge kind={kind} note={note} />
      </div>
      {children}
    </Card>
  );
}
function Bullets({ items, empty }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-gray-500">{empty ?? 'No repository information established (UNKNOWN).'}</p>;
  return <ul className="space-y-1.5">{items.map((t, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />{t}</li>)}</ul>;
}

export function CaseTheoryPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [b, setB] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try { const bundle = await fetchWorkbench(caseId); if (!cancelled) setB(bundle); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load case theory intelligence'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const derived = useMemo(() => {
    if (!b) return null;
    const rows = b.elementMatrices.flatMap((m) => m.rows);
    const evById = new Map(b.evidenceWorkbench.items.map((i) => [i.evidenceId, i.fileName]));
    const nameOf = (id: string) => evById.get(id) ?? id;
    const supportedRows = rows.filter((r) => r.supportingEvidence.length > 0);
    const weakRows = rows.filter((r) => r.status.toLowerCase() !== 'satisfied');
    const contradictions = b.evidenceWorkbench.contradictions.map((c) => c.finding);
    const witnessNodes = b.evidenceWorkbench.graph.nodes.filter((n) => /witness/i.test(n.type)).map((n) => n.label);
    const docNodes = b.evidenceWorkbench.graph.nodes.filter((n) => /doc|report|record/i.test(n.type)).map((n) => n.label);
    const timeline = b.caseOverview.caseTimeline.slice(0, 12).map((t) => `${t.timestamp ?? 'UNKNOWN time'}: ${t.description}`);
    const calcrim = b.offenseAnalysis.flatMap((o) => o.applicableCalcrim.map((c) => `${c.instructionNumber} ${c.title}`));
    const defenses = [...new Set([...b.offenseAnalysis.flatMap((o) => o.defenses), ...b.legalAuthority.defenses])];
    const exceptions = [...new Set([...b.offenseAnalysis.flatMap((o) => o.exceptions), ...b.legalAuthority.exceptions])];
    const impeachment = b.trialPreparation.impeachmentOpportunities.map((i) => `${i.title}${i.detail ? ` — ${i.detail}` : ''}`);
    const supportingEvidenceList = [...new Set(supportedRows.flatMap((r) => r.supportingEvidence.map((s) => `${nameOf(s.evidenceId)} → ${r.code} §${r.section} (${r.elementLabel})`)))];
    const contradictoryEvidenceList = [...new Set(rows.flatMap((r) => r.contradictoryEvidence.map((s) => `${nameOf(s.evidenceId)} ⟂ ${r.code} §${r.section} (${r.elementLabel})`)))];
    const cc = b.commandCenter;
    const inv = b.investigation;
    const conf = cc.unknownCount === 0 ? 100 : Math.max(0, 100 - cc.unknownCount * 10);

    const prosecution: Theory = {
      id: 'prosecution', label: 'Potential Prosecution Theory', icon: Gavel, accent: 'border-red-200 bg-red-50/40',
      summary: `Organized from the elements the prosecution would need to establish: ${supportedRows.length}/${rows.length} CALCRIM element(s) currently have repository-backed supporting evidence.`,
      supporting: supportingEvidenceList,
      conflicting: [...contradictoryEvidenceList, ...contradictions],
      factualQuestions: weakRows.map((r) => `${r.code} §${r.section} — ${r.elementLabel}: ${r.status} (not established by repository).`),
      evidentiaryQuestions: b.evidenceWorkbench.missing,
      relatedWitnesses: witnessNodes,
      relatedDocuments: docNodes,
      relatedTimeline: timeline,
      relatedCalcrim: calcrim,
      missingEvidence: b.evidenceWorkbench.missing,
      missingWitnesses: inv.witnessGaps.map((w) => w.finding),
      investigationOpportunities: inv.recommendedInvestigation,
      confidence: rows.length ? Math.round((supportedRows.length / rows.length) * 100) : 0,
    };
    const defense: Theory = {
      id: 'defense', label: 'Potential Defense Theory', icon: Shield, accent: 'border-blue-200 bg-blue-50/40',
      summary: `Organized from repository-backed points of doubt and known defenses: ${weakRows.length} element(s) lack full repository support; ${defenses.length} statutory defense(s) and ${exceptions.length} exception(s) noted.`,
      supporting: [
        ...weakRows.map((r) => `Reasonable-doubt point — ${r.code} §${r.section} (${r.elementLabel}) is ${r.status} in the repository.`),
        ...contradictions,
        ...impeachment,
        ...defenses.map((d) => `Statutory defense: ${d}`),
        ...exceptions.map((e) => `Exception: ${e}`),
      ],
      conflicting: supportingEvidenceList,
      factualQuestions: inv.witnessGaps.map((w) => w.finding),
      evidentiaryQuestions: [...b.evidenceWorkbench.missing, ...inv.evidenceGaps.map((g) => g.finding)],
      relatedWitnesses: witnessNodes,
      relatedDocuments: docNodes,
      relatedTimeline: timeline,
      relatedCalcrim: [...new Set(weakRows.map((r) => `${r.code} §${r.section} (${r.elementLabel})`))],
      missingEvidence: b.evidenceWorkbench.missing,
      missingWitnesses: inv.witnessGaps.map((w) => w.finding),
      investigationOpportunities: [...inv.recommendedInvestigation, ...inv.recommendedSubpoenas],
      confidence: rows.length ? Math.round((weakRows.length / rows.length) * 100) : 0,
    };
    return { rows, supportedRows, weakRows, contradictions, prosecution, defense, conf };
  }, [b]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Building Case Theory Center…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!b || !derived) return null;

  const cc = b.commandCenter;
  const inv = b.investigation;
  const { rows, supportedRows, weakRows, prosecution, defense, conf } = derived;
  const theories = [prosecution, defense];
  const outstandingUnknowns = b.caseOverview.outstandingUnknowns?.length ? b.caseOverview.outstandingUnknowns : b.intelligence.unknowns.all;

  const comparisonRows: Array<{ label: string; p: number; d: number }> = [
    { label: 'Supporting information', p: prosecution.supporting.length, d: defense.supporting.length },
    { label: 'Conflicting information', p: prosecution.conflicting.length, d: defense.conflicting.length },
    { label: 'Missing evidence', p: prosecution.missingEvidence.length, d: defense.missingEvidence.length },
    { label: 'Missing witnesses', p: prosecution.missingWitnesses.length, d: defense.missingWitnesses.length },
    { label: 'Contradictions', p: cc.contradictionCount, d: cc.contradictionCount },
    { label: 'Investigation opportunities', p: prosecution.investigationOpportunities.length, d: defense.investigationOpportunities.length },
    { label: 'Repository confidence', p: prosecution.confidence, d: defense.confidence },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Scale size={22} className="text-indigo-600" /> Case Theory Center</h2>
        <p className="text-sm text-gray-500 mt-1">Repository-backed evidence organized into competing case theories for attorney review.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`${supportedRows.length}/${rows.length} elements supported · confidence ${conf}%`} /></div>
      </div>

      {/* Mandatory disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span><strong>CourtAccess does not determine guilt, predict verdicts, or recommend a litigation strategy.</strong> The theories below are structured organizations of repository-derived evidence for attorney review only. Where the repository does not establish a fact, the result is <strong>UNKNOWN</strong>. All legal judgment remains with the attorney.</span>
      </div>

      {/* Phase 1 — Case Theory Center dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<ListChecks size={20} />} value={`${cc.legalCoverage.score}%`} label="CALCRIM coverage" />
        <StatCard icon={<BarChart3 size={20} />} value={`${cc.evidenceHealth.score}%`} label="Evidence coverage" />
        <StatCard icon={<Users size={20} />} value={prosecution.relatedWitnesses.length} label="Witnesses (graph)" />
        <StatCard icon={<Scale size={20} />} value={cc.contradictionCount} label="Contradictions" highlight={cc.contradictionCount > 0} />
        <StatCard icon={<GitCompareArrows size={20} />} value={`${conf}%`} label="Repository confidence" />
        <StatCard icon={<HelpCircle size={20} />} value={cc.unknownCount} label="Human review" highlight={cc.unknownCount > 0} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {theories.map((t) => (
          <div key={t.id} className={`rounded-xl border p-5 ${t.accent}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2"><t.icon size={18} />{t.label}</h3>
              <ProvenanceBadge kind={kindOf(t.supporting.length)} note={`confidence ${t.confidence}%`} />
            </div>
            <p className="text-sm text-gray-600">{t.summary}</p>
            <p className="mt-2 text-xs text-amber-700">Structured for review — not a guilt determination, verdict prediction, or strategy recommendation.</p>
          </div>
        ))}
      </div>

      {/* Phase 2 — Theory Support Matrix */}
      {theories.map((t) => (
        <Section key={t.id} icon={<t.icon size={18} className="text-indigo-600" />} title={`Theory Support Matrix — ${t.label}`} kind={kindOf(t.supporting.length + t.conflicting.length)} note={`repository confidence ${t.confidence}%`}>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-800 mb-1">Repository-backed supporting evidence</h4>
              <Bullets items={t.supporting} empty="No repository-backed supporting evidence (UNKNOWN)." />
              <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Repository-backed conflicting evidence</h4>
              <Bullets items={t.conflicting} />
              <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Related CALCRIM elements</h4>
              <Bullets items={t.relatedCalcrim} />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding factual questions</h4>
              <Bullets items={t.factualQuestions} />
              <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding evidentiary questions</h4>
              <Bullets items={t.evidentiaryQuestions} />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><h4 className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-1"><Users size={13} />Witnesses</h4><Bullets items={t.relatedWitnesses} /></div>
                <div><h4 className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-1"><FileText size={13} />Documents</h4><Bullets items={t.relatedDocuments} /></div>
              </div>
              <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3 flex items-center gap-1"><Clock size={13} />Related timeline</h4>
              <Bullets items={t.relatedTimeline} />
            </div>
          </div>
        </Section>
      ))}

      {/* Phase 3 — Theory Comparison */}
      <Section icon={<GitCompareArrows size={18} className="text-purple-600" />} title="Theory Comparison" kind="repository">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">Dimension</th>
                <th className="py-2 px-3 text-center text-red-700">Prosecution</th>
                <th className="py-2 px-3 text-center text-blue-700">Defense</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((r) => (
                <tr key={r.label} className="border-b border-gray-100">
                  <td className="py-2 pr-3 text-gray-700">{r.label}</td>
                  <td className="py-2 px-3 text-center font-medium text-gray-800">{r.label.includes('confidence') ? `${r.p}%` : r.p}</td>
                  <td className="py-2 px-3 text-center font-medium text-gray-800">{r.label.includes('confidence') ? `${r.d}%` : r.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">Counts reflect repository coverage only. Equal or higher counts do not indicate strength, likelihood, or outcome — they are organizational tallies for attorney review.</p>
      </Section>

      {/* Phase 4 — Evidence Weight Visualization */}
      <Section icon={<BarChart3 size={18} className="text-emerald-600" />} title="Evidence Weight Visualization" kind={kindOf(rows.length)} note="supporting vs contradictory evidence links per element">
        {rows.length === 0 ? <p className="text-sm text-gray-500">No CALCRIM elements available (UNKNOWN).</p> : (
          <div className="space-y-2">
            {rows.map((r, i) => {
              const sup = r.supportingEvidence.length;
              const con = r.contradictoryEvidence.length;
              const max = Math.max(sup, con, 1);
              return (
                <div key={`${r.elementId}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-0.5">{r.code} §{r.section} — {r.elementLabel} <span className="text-gray-400">({r.status})</span></div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 flex justify-end"><div className="h-3 rounded-l bg-red-400" style={{ width: `${(con / max) * 100}%` }} title={`${con} contradictory`} /></div>
                      <div className="h-3 w-px bg-gray-300" />
                      <div className="flex-1"><div className="h-3 rounded-r bg-emerald-400" style={{ width: `${(sup / max) * 100}%` }} title={`${sup} supporting`} /></div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap"><span className="text-red-600">{con}</span> / <span className="text-emerald-600">{sup}</span></div>
                </div>
              );
            })}
            <div className="flex items-center gap-4 pt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-red-400" /> contradictory links</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-emerald-400" /> supporting links</span>
              <span>· Knowledge Graph: {b.evidenceWorkbench.graph.nodes.length} nodes / {b.evidenceWorkbench.graph.edges.length} edges</span>
            </div>
          </div>
        )}
      </Section>

      {/* Phase 5 — Theory Evolution */}
      <Section icon={<TrendingUp size={18} className="text-blue-600" />} title="Theory Evolution" kind="repository" note="repository state + clearly-labeled illustrative examples">
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
          <span className="font-medium">Current repository state:</span> {supportedRows.length}/{rows.length} elements supported · {cc.contradictionCount} contradiction(s) · {cc.unknownCount} UNKNOWN · {weakRows.length} element(s) not fully established.
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-1"><h4 className="text-sm font-medium text-gray-800">How the analysis could change as evidence is added</h4><ProvenanceBadge kind="illustrative" /></div>
          <ul className="space-y-1.5 text-sm text-gray-600">
            {weakRows.slice(0, 4).map((r, i) => (
              <li key={i} className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" /><span><em>Illustrative:</em> if repository-backed evidence were added addressing {r.code} §{r.section} ({r.elementLabel}), this element could move from "{r.status}" toward supported — reducing the outstanding factual question above.</span></li>
            ))}
            {weakRows.length === 0 && <li className="text-gray-500">No unsupported elements — no illustrative evolution examples to show.</li>}
          </ul>
          <p className="mt-1 text-xs text-amber-700">These examples are illustrative demonstrations of how the analysis reorganizes when repository evidence changes; they are not predictions, conclusions, or case-specific findings.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Investigation impact</h4><Bullets items={inv.recommendedInvestigation} /></div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Human review checklist</h4>
            {outstandingUnknowns.length === 0 ? <p className="text-sm text-gray-500">No outstanding review items recorded.</p> : (
              <ul className="space-y-1.5">{outstandingUnknowns.map((u, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><HelpCircle size={13} className="mt-0.5 text-gray-400 flex-shrink-0" /><span><input type="checkbox" className="mr-2 align-middle" aria-label="reviewed" />{u}</span></li>)}</ul>
            )}
          </div>
        </div>
      </Section>

      {/* Phase 6 — Attorney Executive Briefing */}
      <Section icon={<ClipboardList size={18} className="text-gray-700" />} title="Attorney Executive Briefing — Case Theory" kind="repository">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1 text-sm text-gray-700">
            <div><span className="text-gray-500">Case theory summary:</span> both a potential prosecution and a potential defense theory are organized above from repository evidence; {supportedRows.length}/{rows.length} elements supported, {weakRows.length} not fully established.</div>
            <div><span className="text-gray-500">Repository confidence:</span> {conf}% ({cc.unknownCount} UNKNOWN)</div>
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding factual questions</h4>
            <Bullets items={weakRows.map((r) => `${r.code} §${r.section} — ${r.elementLabel}: ${r.status}`)} empty="No unsupported elements (none outstanding)." />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding investigation</h4>
            <Bullets items={[...inv.recommendedInvestigation, ...inv.evidenceGaps.map((g) => g.finding)]} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding legal research (topics for research, not conclusions)</h4>
            <Bullets items={[...b.intelligence.recommendedMotions, ...b.legalAuthority.authorities.map((a) => a.finding)]} />
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          <span>This briefing organizes repository-derived facts only. It does not determine guilt, predict a verdict, or recommend a strategy. UNKNOWN denotes insufficient repository coverage requiring attorney review.</span>
        </div>
      </Section>
    </div>
  );
}
