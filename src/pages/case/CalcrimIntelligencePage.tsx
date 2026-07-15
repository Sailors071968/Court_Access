// ============================================================================
// Program 119 — CALCRIM Intelligence Workspace
// Organizes the prosecution's burden of proof by CALCRIM instruction and
// element, analyzes evidentiary support, and computes a weighted case-readiness
// score — entirely from the repository-backed Attorney Workbench bundle.
// Constitution-faithful: repository-backed vs illustrative are labeled
// separately; UNKNOWN is used wherever repository coverage is incomplete.
// No CALCRIM elements, legal conclusions, or recommendations are fabricated.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Scale, BookOpen, Brain, CheckCircle2, XCircle, AlertTriangle, HelpCircle,
  Loader2, Info, Gauge,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { ProvenanceBadge } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle, type ElementRow } from '../../services/workbenchApi';

// Clearly-labeled illustrative example (NOT repository data). Shown so attorneys
// can see a fully-analyzed CALCRIM instruction even when the repository lacks the
// selected offense. This is fabricated example content and is never presented as
// a finding about the real case.
const ILLUSTRATIVE = {
  calcrim: '1700',
  title: 'Burglary (Pen. Code, § 459)',
  elements: [
    { label: 'The defendant entered a building', status: 'satisfied', confidence: 'HIGH', evidence: 2, note: 'Entry corroborated by two independent sources (illustrative).' },
    { label: 'When entering, the defendant intended to commit theft or a felony', status: 'partial', confidence: 'LOW', evidence: 1, note: 'Intent inferred only from post-entry conduct (illustrative).' },
    { label: 'The building was inhabited (degree)', status: 'unsupported', confidence: 'UNKNOWN', evidence: 0, note: 'No repository evidence of habitation (illustrative).' },
  ],
  mensRea: { state: 'Specific intent to commit theft or a felony at time of entry', supporting: 1, missing: 1, conflicting: 0 },
};

function statusMeta(status: string) {
  const s = (status || '').toLowerCase();
  if (s.includes('satisf')) return { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2, label: 'SATISFIED' };
  if (s.includes('partial')) return { cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: AlertTriangle, label: 'PARTIALLY SUPPORTED' };
  if (s.includes('unsupported') || s.includes('missing')) return { cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle, label: 'UNSUPPORTED' };
  return { cls: 'bg-gray-100 text-gray-600 border-gray-300', Icon: HelpCircle, label: 'UNKNOWN' };
}

function ReadinessBar({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((score / max) * 100)));
  const tone = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{label}</span><span>{pct}%</span></div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function CalcrimIntelligencePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [bundle, setBundle] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCharge, setSelectedCharge] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const b = await fetchWorkbench(caseId);
        if (!cancelled) { setBundle(b); setSelectedCharge(b.caseOverview.charges[0]?.id ?? null); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load CALCRIM intelligence');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const readiness = useMemo(() => {
    if (!bundle) return null;
    const cc = bundle.commandCenter;
    // Weighted case-readiness (all inputs repository-backed from the command center).
    const components = [
      { label: 'CALCRIM Coverage', score: cc.legalCoverage.score, weight: 0.25 },
      { label: 'Evidence Coverage', score: cc.evidenceHealth.score, weight: 0.2 },
      { label: 'Timeline Coverage', score: cc.timelineCoverage.score, weight: 0.15 },
      { label: 'Trial Readiness', score: cc.trialReadiness.score, weight: 0.2 },
      { label: 'Case Health', score: cc.caseHealth.score, weight: 0.2 },
    ];
    const weighted = Math.round(components.reduce((s, c) => s + c.score * c.weight, 0));
    return { components, weighted, contradictions: cc.contradictionCount, unknowns: cc.unknownCount };
  }, [bundle]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Analyzing burden of proof…</span></div>;
  }
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!bundle) return null;

  const charges = bundle.caseOverview.charges;
  const matrix = bundle.elementMatrices.find((m) => m.chargeId === selectedCharge);
  const offense = bundle.offenseAnalysis.find((o) => o.chargeId === selectedCharge);
  const rows: ElementRow[] = matrix?.rows ?? [];
  const hasRealElements = rows.some((r) => r.status.toLowerCase() !== 'unknown');
  const mensReaRows = rows.filter((r) => /intent|knowledge|mens|willful|malic|reckless|negligen/i.test(r.elementLabel));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Scale size={22} className="text-indigo-600" /> CALCRIM Intelligence</h2>
        <p className="text-sm text-gray-500 mt-1">The prosecution's burden of proof, organized by CALCRIM instruction and analyzed element-by-element.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`${charges.length} charge${charges.length === 1 ? '' : 's'} · legislative repository`} /></div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>Element statuses and mens rea are derived from repository coverage, not legal conclusions. Where the legislative repository does not contain an offense's elements, the analysis is marked <strong>UNKNOWN</strong> rather than asserted. All findings require independent attorney review.</span>
      </div>

      {/* Case Readiness (Phase 6, weighted) */}
      {readiness && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Gauge size={18} className="text-indigo-600" /> Weighted Case Readiness</h3>
            <ProvenanceBadge kind="repository" />
          </div>
          <div className="grid md:grid-cols-[160px_1fr] gap-6 items-center">
            <div className="text-center">
              <div className={`text-4xl font-bold ${readiness.weighted >= 70 ? 'text-emerald-600' : readiness.weighted >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{readiness.weighted}%</div>
              <div className="text-xs text-gray-500 mt-1">Overall readiness</div>
              <div className="mt-2 text-xs text-gray-400">{readiness.contradictions} contradiction(s) · {readiness.unknowns} UNKNOWN(s)</div>
            </div>
            <div className="space-y-3">
              {readiness.components.map((c) => (
                <div key={c.label}>
                  <ReadinessBar label={`${c.label} (weight ${Math.round(c.weight * 100)}%)`} score={c.score} />
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">Score = Σ(component × weight): CALCRIM 25% · Evidence 20% · Timeline 15% · Trial Readiness 20% · Case Health 20%.</p>
        </Card>
      )}

      {/* Charge selector */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Charge Selector</h3>
        {charges.length === 0 ? (
          <p className="text-sm text-gray-500">No charges mapped to this case yet — CALCRIM analysis is <strong>UNKNOWN</strong> until charges are added.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {charges.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCharge(c.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${selectedCharge === c.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {c.code} §{c.section}{c.title ? ` — ${c.title}` : ''}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Selected charge — CALCRIM instruction + element analysis (repository-backed) */}
      {selectedCharge && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><BookOpen size={18} className="text-indigo-600" /> CALCRIM Instruction & Elements</h3>
            <ProvenanceBadge kind={hasRealElements ? 'repository' : 'unknown'} />
          </div>
          {offense && offense.applicableCalcrim.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {offense.applicableCalcrim.map((ci, i) => (
                <span key={i} className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">CALCRIM {ci.instructionNumber} — {ci.title}</span>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-gray-500">No CALCRIM instruction found in the legislative repository for this charge (<strong>UNKNOWN</strong>).{offense?.unknownLegalQuestions?.[0] ? ` ${offense.unknownLegalQuestions[0]}` : ''}</p>
          )}

          <div className="space-y-3">
            {rows.map((r, i) => {
              const m = statusMeta(r.status);
              return (
                <div key={`${r.elementId}-${i}`} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{r.elementLabel}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}><m.Icon size={12} /> {m.label}</span>
                  </div>
                  {r.missingEvidenceReason && <p className="mt-1 text-sm text-gray-600">{r.missingEvidenceReason}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>Supporting evidence: {r.supportingEvidence.length}</span>
                    <span>Contradictory: {r.contradictoryEvidence.length}</span>
                    <span>Confidence: {r.confidence || 'UNKNOWN'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Mens Rea (Phase 3) */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Brain size={18} className="text-purple-600" /> Mens Rea Analysis</h3>
          <ProvenanceBadge kind={mensReaRows.length ? 'repository' : 'unknown'} />
        </div>
        {mensReaRows.length === 0 ? (
          <p className="text-sm text-gray-500">Required mental state could not be determined from repository coverage for this charge (<strong>UNKNOWN</strong>).</p>
        ) : (
          <div className="space-y-2">
            {mensReaRows.map((r, i) => {
              const m = statusMeta(r.status);
              return (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <span className="text-sm text-gray-800">{r.elementLabel}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}>{m.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Illustrative CALCRIM demonstration (clearly labeled) */}
      <Card className="border-amber-200 bg-amber-50/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-amber-900">Illustrative CALCRIM Demonstration</h3>
          <ProvenanceBadge kind="illustrative" note="example only — not this case" />
        </div>
        <p className="text-sm text-amber-800 mb-4">
          Example of a fully-analyzed instruction (<strong>CALCRIM {ILLUSTRATIVE.calcrim} — {ILLUSTRATIVE.title}</strong>) shown so attorneys can see the capability when the legislative repository already covers an offense. This is fabricated example content, <strong>not</strong> a finding about this case.
        </p>
        <div className="space-y-3">
          {ILLUSTRATIVE.elements.map((el, i) => {
            const m = statusMeta(el.status);
            return (
              <div key={i} className="rounded-lg border border-amber-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{el.label}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}><m.Icon size={12} /> {m.label}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{el.note}</p>
                <div className="mt-2 flex gap-3 text-xs text-gray-500"><span>Evidence: {el.evidence}</span><span>Confidence: {el.confidence}</span></div>
              </div>
            );
          })}
          <div className="rounded-lg border border-amber-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900"><Brain size={15} className="text-purple-600" /> Mens rea: {ILLUSTRATIVE.mensRea.state}</div>
            <div className="mt-1 text-xs text-gray-500">Supporting: {ILLUSTRATIVE.mensRea.supporting} · Missing: {ILLUSTRATIVE.mensRea.missing} · Conflicting: {ILLUSTRATIVE.mensRea.conflicting}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
