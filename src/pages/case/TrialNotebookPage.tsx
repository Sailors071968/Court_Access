// ============================================================================
// Program 125 — Attorney Work Product: Trial Notebook
// Generates a professional trial-notebook packet from repository-backed
// litigation intelligence (Attorney Workbench bundle): case/charge/evidence
// summaries, witness preparation, cross-examination, discovery preparation,
// motion preparation, investigation dossier, and a human-review checklist.
// Constitution-faithful — repository-backed vs illustrative labeled separately;
// UNKNOWN wherever repository evidence is insufficient. No attorney opinions,
// legal conclusions, defense theories, or case outcomes are fabricated.
// ============================================================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BookOpen, FileText, Users, Crosshair, FileSearch, Gavel, Search,
  ClipboardCheck, Loader2, Info, HelpCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { ProvenanceBadge, type Provenance } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

function Section({ icon, title, kind, children, note }: { icon: React.ReactNode; title: string; kind: Provenance; note?: string; children: React.ReactNode }) {
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
  if (!items.length) return <p className="text-sm text-gray-500">{empty ?? 'None identified from current repository coverage (UNKNOWN).'}</p>;
  return <ul className="space-y-1.5">{items.map((t, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />{t}</li>)}</ul>;
}
const kindOf = (n: number): Provenance => (n > 0 ? 'repository' : 'unknown');

export function TrialNotebookPage() {
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
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load trial notebook'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Generating trial notebook…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!b) return null;

  const co = b.caseOverview;
  const cc = b.commandCenter;
  const tp = b.trialPreparation;
  const inv = b.investigation;
  const weakElements = b.elementMatrices.flatMap((m) => m.rows).filter((r) => r.status.toLowerCase() !== 'satisfied');
  const contradictions = b.evidenceWorkbench.contradictions;
  const defenses = [...b.offenseAnalysis.flatMap((o) => o.defenses), ...b.legalAuthority.defenses];
  const motions = b.intelligence.recommendedMotions;
  const outstanding = co.outstandingUnknowns?.length ? co.outstandingUnknowns : b.intelligence.unknowns.all;
  const repoConfidence = cc.unknownCount === 0 ? 100 : Math.max(0, 100 - cc.unknownCount * 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BookOpen size={22} className="text-indigo-600" /> Trial Notebook</h2>
        <p className="text-sm text-gray-500 mt-1">Attorney work product generated from repository-backed litigation intelligence.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`${co.charges.length} charges · repository confidence ${repoConfidence}%`} /></div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>This packet is evidence-governed work product, not legal advice or attorney opinion. Every item is derived from repository coverage; where the repository is insufficient, the result is <strong>UNKNOWN</strong>. Attorneys must independently verify and exercise judgment.</span>
      </div>

      {/* Case + Charge + Evidence summary */}
      <Section icon={<FileText size={18} className="text-indigo-600" />} title="Case, Charge & Evidence Summary" kind="repository">
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div className="space-y-1">
            <div><span className="text-gray-500">Case:</span> {co.case.title} (#{co.case.caseNumber})</div>
            <div><span className="text-gray-500">Status / phase:</span> {co.case.status} / {co.case.phase}</div>
            <div><span className="text-gray-500">Charges:</span> {co.charges.length ? co.charges.map((c) => `${c.code} §${c.section}`).join(', ') : 'UNKNOWN'}</div>
            <div><span className="text-gray-500">Court / judge:</span> {co.court ?? 'UNKNOWN'} / {co.judge ?? 'UNKNOWN'}</div>
          </div>
          <div className="space-y-1">
            <div><span className="text-gray-500">Evidence items:</span> {co.evidenceSummary.total} ({co.evidenceSummary.processingPending} pending)</div>
            <div><span className="text-gray-500">CALCRIM coverage:</span> {cc.legalCoverage.score}% ({cc.legalCoverage.offensesCovered}/{cc.legalCoverage.offensesTotal})</div>
            <div><span className="text-gray-500">Contradictions:</span> {cc.contradictionCount}</div>
            <div><span className="text-gray-500">Trial readiness:</span> {cc.trialReadiness.score}% ({cc.trialReadiness.label})</div>
          </div>
        </div>
      </Section>

      {/* Phase 2 — Witness Preparation */}
      <Section icon={<Users size={18} className="text-blue-600" />} title="Witness Preparation" kind={kindOf(tp.witnessList.length + inv.witnessGaps.length)}>
        <div className="grid md:grid-cols-2 gap-4">
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Witness list</h4><Bullets items={tp.witnessList.map((w) => `${w.title}${w.detail ? ` — ${w.detail}` : ''}`)} empty="No witnesses listed (UNKNOWN)." /></div>
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding interview topics</h4><Bullets items={inv.witnessGaps.map((w) => w.finding)} /></div>
        </div>
      </Section>

      {/* Phase 3 — Cross-Examination */}
      <Section icon={<Crosshair size={18} className="text-red-600" />} title="Cross-Examination" kind={kindOf(tp.impeachmentOpportunities.length + tp.crossExaminationTopics.length + contradictions.length)}>
        <div className="grid md:grid-cols-2 gap-4">
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Impeachment material</h4><Bullets items={tp.impeachmentOpportunities.map((t) => `${t.title}${t.detail ? ` — ${t.detail}` : ''}`)} empty="None identified (UNKNOWN)." /></div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Cross-examination topics</h4>
            <Bullets items={tp.crossExaminationTopics.map((t) => t.title)} empty="None (UNKNOWN)." />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Contradictions (prior inconsistencies)</h4>
            <Bullets items={contradictions.map((c) => c.finding)} empty="None detected (UNKNOWN)." />
          </div>
        </div>
      </Section>

      {/* Phase 4 — Discovery Preparation */}
      <Section icon={<FileSearch size={18} className="text-emerald-600" />} title="Discovery Preparation" kind={kindOf(inv.recommendedDiscovery.length + inv.recommendedSubpoenas.length + b.evidenceWorkbench.missing.length)}>
        <div className="grid md:grid-cols-2 gap-4">
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding subpoenas</h4><Bullets items={inv.recommendedSubpoenas} /></div>
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Digital evidence & discovery requests</h4><Bullets items={[...inv.recommendedDiscovery, ...inv.discoveryRequests.map((d) => d.title)]} /></div>
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Missing evidence</h4><Bullets items={b.evidenceWorkbench.missing} /></div>
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Evidence gaps</h4><Bullets items={inv.evidenceGaps.map((g) => g.finding)} /></div>
        </div>
      </Section>

      {/* Phase 5 — Motion Preparation */}
      <Section icon={<Gavel size={18} className="text-purple-600" />} title="Motion Preparation" kind={kindOf(motions.length + defenses.length + cc.motionOpportunities)}>
        <div className="grid md:grid-cols-2 gap-4">
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Repository-recommended motions</h4><Bullets items={motions} empty={`No repository-recommended motions (UNKNOWN). Motion opportunities flagged: ${cc.motionOpportunities}.`} /></div>
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Supporting statutory defenses</h4><Bullets items={defenses} /></div>
        </div>
        <p className="mt-2 text-xs text-gray-400">Motions are surfaced from repository coverage; drafting and legal sufficiency remain attorney judgment. UNKNOWN where unsupported.</p>
      </Section>

      {/* Phase 6 — Investigation Dossier */}
      <Section icon={<Search size={18} className="text-blue-600" />} title="Investigation Dossier" kind={kindOf(inv.tasks.length + inv.recommendedInvestigation.length + inv.timelineGaps.length)}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Priority-ranked tasks</h4>
            {inv.tasks.length === 0 ? <p className="text-sm text-gray-500">No investigation tasks recorded (UNKNOWN).</p> : (
              <ul className="space-y-1.5">{[...inv.tasks].sort((a, c) => (a.priority > c.priority ? 1 : -1)).map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm"><span className="text-gray-700">{t.title}</span><span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500">{t.priority}</span></li>
              ))}</ul>
            )}
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Recommended investigation</h4>
            <Bullets items={inv.recommendedInvestigation} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Timeline / travel verification</h4>
            <Bullets items={inv.timelineGaps.map((t) => t.finding)} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Unsupported elements to investigate</h4>
            <Bullets items={weakElements.map((r) => `${r.code} §${r.section} — ${r.elementLabel} (${r.status})`)} />
          </div>
        </div>
      </Section>

      {/* Trial outlines (from repository trialPreparation) */}
      <Section icon={<BookOpen size={18} className="text-indigo-600" />} title="Opening / Closing Outlines & Notebook" kind={kindOf(tp.openingOutline.length + tp.closingOutline.length + tp.trialNotebook.length)}>
        <div className="grid md:grid-cols-3 gap-4">
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Opening outline</h4><Bullets items={tp.openingOutline.map((o) => o.title)} /></div>
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Closing outline</h4><Bullets items={tp.closingOutline.map((o) => o.title)} /></div>
          <div><h4 className="text-sm font-medium text-gray-800 mb-1">Trial notebook entries</h4><Bullets items={tp.trialNotebook.map((o) => o.title)} /></div>
        </div>
      </Section>

      {/* Phase 1 — Human review checklist */}
      <Section icon={<ClipboardCheck size={18} className="text-gray-600" />} title="Human Review Checklist" kind={kindOf(outstanding.length)}>
        {outstanding.length === 0 ? <p className="text-sm text-gray-500">No outstanding review items recorded.</p> : (
          <ul className="space-y-1.5">{outstanding.map((u, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><HelpCircle size={13} className="mt-0.5 text-gray-400 flex-shrink-0" /><span><input type="checkbox" className="mr-2 align-middle" aria-label="reviewed" />{u}</span></li>
          ))}</ul>
        )}
        <p className="mt-2 text-xs text-gray-400">Repository confidence: {repoConfidence}% ({cc.unknownCount} UNKNOWN). Every UNKNOWN requires attorney review before trial.</p>
      </Section>
    </div>
  );
}
