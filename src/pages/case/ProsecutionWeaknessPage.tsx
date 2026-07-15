// ============================================================================
// Program 118 — Prosecution Weakness Analysis
// Repository-backed litigation intelligence: surfaces unsupported offense
// elements, evidence gaps, conflicting testimony, and outstanding unknowns
// derived from the Attorney Workbench bundle. Faithful to the Engineering
// Constitution — repository-backed findings and illustrative demonstrations
// are always labeled separately; UNKNOWN is used where coverage is incomplete.
// ============================================================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldAlert, AlertTriangle, FileWarning, Scale, HelpCircle, Loader2, Info,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { ProvenanceBadge } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle, type ElementRow } from '../../services/workbenchApi';

interface WeakElement extends ElementRow {}

// Clearly-labeled illustrative example (NOT repository data) shown only when the
// case has no charges/evidence, so evaluators can see what the analysis produces.
const ILLUSTRATIVE_ELEMENTS = [
  { code: 'PC', section: '459', elementLabel: 'Entry into a building', status: 'unsupported', confidence: 'UNKNOWN', missingEvidenceReason: 'No evidence places the defendant inside the structure; surveillance gap 02:10–02:45.', calcrim: 'CALCRIM 1700' },
  { code: 'PC', section: '459', elementLabel: 'Intent to commit theft/felony at entry', status: 'partial', confidence: 'LOW', missingEvidenceReason: 'Intent inferred only from post-entry conduct; no direct evidence of pre-entry intent.', calcrim: 'CALCRIM 1700' },
];

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('unsupported') || s.includes('missing')) return 'bg-red-50 text-red-700 border-red-200';
  if (s.includes('partial')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s.includes('unknown')) return 'bg-gray-100 text-gray-600 border-gray-300';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

export function ProsecutionWeaknessPage() {
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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load analysis');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={22} className="animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Analyzing prosecution case…</span>
      </div>
    );
  }
  if (error) {
    return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  }
  if (!bundle) return null;

  const weakElements: WeakElement[] = bundle.elementMatrices
    .flatMap((m) => m.rows)
    .filter((r) => r.status.toLowerCase() !== 'satisfied');
  const evidenceGaps = [
    ...bundle.investigation.evidenceGaps.map((g) => g.finding),
    ...bundle.evidenceWorkbench.missing,
  ];
  const contradictions = bundle.evidenceWorkbench.contradictions;
  const unknowns = bundle.caseOverview.outstandingUnknowns?.length
    ? bundle.caseOverview.outstandingUnknowns
    : bundle.intelligence.unknowns.all;

  const totalCharges = bundle.caseOverview.charges.length;
  const totalEvidence = bundle.caseOverview.evidenceSummary.total;
  const isEmptyCase = totalCharges === 0 && totalEvidence === 0;

  const summary = [
    { icon: <ShieldAlert size={22} />, value: weakElements.length, label: 'Unsupported / Partial Elements', tone: 'text-red-700' },
    { icon: <FileWarning size={22} />, value: evidenceGaps.length, label: 'Evidence Gaps', tone: 'text-amber-700' },
    { icon: <AlertTriangle size={22} />, value: contradictions.length, label: 'Conflicting Testimony', tone: 'text-orange-700' },
    { icon: <HelpCircle size={22} />, value: unknowns.length, label: 'Outstanding UNKNOWNs', tone: 'text-gray-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldAlert size={22} className="text-red-600" />
          Prosecution Weakness Analysis
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Deterministic analysis of where the prosecution's case lacks repository-backed support.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ProvenanceBadge kind="repository" note={`${totalCharges} charges · ${totalEvidence} evidence items`} />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>
          These are analytical observations derived from repository coverage, not legal conclusions.
          Every item requires independent attorney review. Where the repository cannot support a finding,
          it is marked <strong>UNKNOWN</strong> rather than asserted.
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summary.map((s) => (
          <Card key={s.label} padding="sm">
            <div className="flex flex-col items-center text-center gap-1">
              <span className={s.tone}>{s.icon}</span>
              <span className={`text-2xl font-bold ${s.tone}`}>{s.value}</span>
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
          </Card>
        ))}
      </div>

      {isEmptyCase && (
        <Card className="border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-amber-900">Illustrative Weakness Analysis</h3>
            <ProvenanceBadge kind="illustrative" note="example only — not this case" />
          </div>
          <p className="text-sm text-amber-800 mb-4">
            This case has no charges or evidence yet, so there is nothing to analyze from the repository.
            The following is an <strong>illustrative demonstration</strong> of the analysis CourtAccess
            produces once charges and evidence are ingested. It is fabricated example content and is
            <strong> not</strong> a finding about this case.
          </p>
          <div className="space-y-3">
            {ILLUSTRATIVE_ELEMENTS.map((el, i) => (
              <div key={i} className="rounded-lg border border-amber-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{el.code} §{el.section} — {el.elementLabel}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone(el.status)}`}>{el.status.toUpperCase()}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{el.missingEvidenceReason}</p>
                <p className="mt-1 text-xs text-gray-400">{el.calcrim} · confidence {el.confidence}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Unsupported / Partial offense elements — repository-backed */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Scale size={18} className="text-red-600" /> Unsupported Offense Elements
          </h3>
          <ProvenanceBadge kind={weakElements.length ? 'repository' : 'unknown'} />
        </div>
        {weakElements.length === 0 ? (
          <p className="text-sm text-gray-500">
            No unsupported elements found in the current repository coverage
            {totalCharges === 0 ? ' — no charges mapped yet (UNKNOWN).' : '.'}
          </p>
        ) : (
          <div className="space-y-3">
            {weakElements.map((r, i) => (
              <div key={`${r.elementId}-${i}`} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{r.code} §{r.section} — {r.elementLabel}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone(r.status)}`}>{r.status.toUpperCase()}</span>
                </div>
                {r.missingEvidenceReason && <p className="mt-1 text-sm text-gray-600">{r.missingEvidenceReason}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>Supporting evidence: {r.supportingEvidence.length}</span>
                  <span>Contradictory evidence: {r.contradictoryEvidence.length}</span>
                  <span>Confidence: {r.confidence || 'UNKNOWN'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Evidence gaps — repository-backed */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileWarning size={18} className="text-amber-600" /> Evidence Gaps & Missing Intent Evidence
          </h3>
          <ProvenanceBadge kind={evidenceGaps.length ? 'repository' : 'unknown'} />
        </div>
        {evidenceGaps.length === 0 ? (
          <p className="text-sm text-gray-500">No evidence gaps identified from current repository coverage.</p>
        ) : (
          <ul className="space-y-2">
            {evidenceGaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <FileWarning size={14} className="mt-0.5 text-amber-500 flex-shrink-0" />{g}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Conflicting testimony / contradictions — repository-backed */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-600" /> Conflicting Testimony & Contradictions
          </h3>
          <ProvenanceBadge kind={contradictions.length ? 'repository' : 'unknown'} />
        </div>
        {contradictions.length === 0 ? (
          <p className="text-sm text-gray-500">No contradictions detected in current repository coverage.</p>
        ) : (
          <div className="space-y-3">
            {contradictions.map((c) => (
              <div key={c.id} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-800">{c.finding}</p>
                <p className="mt-1 text-xs text-gray-400">Status: {c.status}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Outstanding unknowns — UNKNOWN */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <HelpCircle size={18} className="text-gray-500" /> Outstanding Unknowns
          </h3>
          <ProvenanceBadge kind="unknown" />
        </div>
        {unknowns.length === 0 ? (
          <p className="text-sm text-gray-500">No outstanding unknowns recorded.</p>
        ) : (
          <ul className="space-y-2">
            {unknowns.map((u, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <HelpCircle size={14} className="mt-0.5 text-gray-400 flex-shrink-0" />{u}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
