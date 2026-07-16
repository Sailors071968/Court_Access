// ============================================================================
// Program 119 — Defense Opportunities
// Repository-backed defense intelligence derived from the Attorney Workbench
// bundle: unsupported elements, weak evidence/testimony, potential impeachment,
// outstanding investigation, and known statutory defenses / exceptions /
// immunities. Constitution-faithful — repository-backed vs illustrative are
// labeled separately; UNKNOWN where coverage is incomplete. No fabricated
// legal conclusions or defenses.
// ============================================================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldCheck, Scale, Gavel, UserX, Search, BookMarked, Loader2, Info,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { ProvenanceBadge } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

const ILLUSTRATIVE_DEFENSES = [
  { title: 'Lack of specific intent at entry (PC §459)', detail: 'If intent is inferred only from post-entry conduct, argue the prosecution cannot prove intent at the moment of entry.' },
  { title: 'Mistaken identity — surveillance gap', detail: 'A 35-minute camera gap leaves identity unsupported; move to exclude speculative identification.' },
  { title: 'Statutory defense: consent to enter', detail: 'If the occupant consented to entry, the entry element may be negated (illustrative statutory defense).' },
];

export function DefenseOpportunitiesPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [bundle, setBundle] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const b = await fetchWorkbench(caseId);
        if (!cancelled) setBundle(b);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load defense opportunities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Identifying defense opportunities…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!bundle) return null;

  const weakElements = bundle.elementMatrices.flatMap((m) => m.rows).filter((r) => r.status.toLowerCase() !== 'satisfied');
  const impeachment = bundle.trialPreparation.impeachmentOpportunities;
  const outstandingInvestigation = bundle.investigation.recommendedInvestigation;
  const defenses = [
    ...bundle.offenseAnalysis.flatMap((o) => o.defenses),
    ...bundle.legalAuthority.defenses,
  ];
  const exceptions = [
    ...bundle.offenseAnalysis.flatMap((o) => o.exceptions),
    ...bundle.legalAuthority.exceptions,
  ];
  const contradictions = bundle.evidenceWorkbench.contradictions;

  const totalSignals = weakElements.length + impeachment.length + defenses.length + exceptions.length + contradictions.length + outstandingInvestigation.length;
  const isEmpty = totalSignals === 0;

  const listSection = (icon: React.ReactNode, title: string, items: string[], hint: string) => (
    <Card key={title}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">{icon} {title}</h3>
        <ProvenanceBadge kind={items.length ? 'repository' : 'unknown'} />
      </div>
      <p className="text-xs text-gray-400 mb-3">{hint}</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">None identified from current repository coverage (UNKNOWN).</p>
      ) : (
        <ul className="space-y-2">{items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />{it}</li>
        ))}</ul>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck size={22} className="text-emerald-600" /> Defense Opportunities</h2>
        <p className="text-sm text-gray-500 mt-1">Repository-backed defense signals: unsupported elements, impeachment, statutory defenses, and outstanding investigation.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`${totalSignals} signal${totalSignals === 1 ? '' : 's'}`} /></div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>These are analytical signals from repository coverage, not legal advice or recommended defenses. Statutory defenses/exceptions appear only when present in the legislative repository; otherwise the section is <strong>UNKNOWN</strong>. Attorneys must independently evaluate all options.</span>
      </div>

      {isEmpty && (
        <Card className="border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-amber-900">Illustrative Defense Opportunities</h3>
            <ProvenanceBadge kind="illustrative" note="example only — not this case" />
          </div>
          <p className="text-sm text-amber-800 mb-4">No defense signals exist for this case yet (no unsupported elements, impeachment, or repository defenses). The following is an <strong>illustrative demonstration</strong> — fabricated example content, <strong>not</strong> findings about this case.</p>
          <div className="space-y-3">{ILLUSTRATIVE_DEFENSES.map((d, i) => (
            <div key={i} className="rounded-lg border border-amber-200 bg-white p-4">
              <div className="font-medium text-gray-900">{d.title}</div>
              <p className="mt-1 text-sm text-gray-600">{d.detail}</p>
            </div>
          ))}</div>
        </Card>
      )}

      {/* Unsupported elements — repository-backed */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Scale size={18} className="text-red-600" /> Unsupported / Weak Elements</h3>
          <ProvenanceBadge kind={weakElements.length ? 'repository' : 'unknown'} />
        </div>
        {weakElements.length === 0 ? (
          <p className="text-sm text-gray-500">No unsupported elements in current repository coverage (UNKNOWN where charges lack repository elements).</p>
        ) : (
          <div className="space-y-2">{weakElements.map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <span className="text-sm text-gray-800">{r.code} §{r.section} — {r.elementLabel}</span>
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{r.status.toUpperCase()}</span>
            </div>
          ))}</div>
        )}
      </Card>

      {listSection(<UserX size={18} className="text-orange-600" />, 'Potential Impeachment', impeachment.map((x) => `${x.title}${x.detail ? ` — ${x.detail}` : ''}`), 'Testimony and evidence that may impeach prosecution witnesses.')}
      {listSection(<Gavel size={18} className="text-purple-600" />, 'Known Statutory Defenses', defenses, 'Defenses present in the legislative repository for the charged offenses.')}
      {listSection(<BookMarked size={18} className="text-indigo-600" />, 'Known Exceptions & Immunities', exceptions, 'Statutory exceptions/immunities from the legislative repository.')}
      {listSection(<Search size={18} className="text-blue-600" />, 'Outstanding Investigation', outstandingInvestigation, 'Investigation that could strengthen the defense position.')}
    </div>
  );
}
