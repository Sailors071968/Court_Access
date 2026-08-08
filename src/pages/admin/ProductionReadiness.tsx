// ============================================================================
// Executive production readiness.
//
// Shows where the platform stands on measured evidence: what every
// certification suite found, which release-gate criteria are satisfied, what
// is still failing, and what has never been measured. The recommendation is
// derived from the gate rather than asserted, so it cannot say "ready" while
// something below it says otherwise.
// ============================================================================

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { certificationApi, type ReadinessReport } from '../../services/certificationApi';

const RECOMMENDATION_STYLE: Record<string, string> = {
  'READY FOR PRODUCTION': 'bg-emerald-50 border-emerald-200 text-emerald-900',
  'READY WITH LIMITATIONS': 'bg-amber-50 border-amber-200 text-amber-900',
  'NOT READY': 'bg-red-50 border-red-200 text-red-900',
};

export function ProductionReadiness() {
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await certificationApi.readiness());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The readiness report could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading && !report) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 p-8">
        <Loader2 size={16} className="animate-spin" /> Assembling the readiness report…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
        <XCircle size={16} className="text-red-600 mt-0.5" />
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  if (!report) return null;

  const { totals, gate } = report;

  return (
    <div className="space-y-6" data-testid="readiness-dashboard">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Production Readiness</h1>
          <p className="text-sm text-gray-500 mt-1">
            Assembled from {report.suites.length} certification suites that executed against this build. Every
            figure below was measured, not asserted.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Recommendation ---------------------------------------------------- */}
      <div className={`rounded-xl border p-5 ${RECOMMENDATION_STYLE[report.recommendation]}`}>
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">Release recommendation</p>
        <p className="text-2xl font-semibold mt-1" data-testid="recommendation">
          {report.recommendation}
        </p>
        <p className="text-sm mt-2 opacity-90">{report.recommendationBasis}</p>
      </div>

      {/* Headline numbers -------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card label="Checks executed" value={String(totals.checks)} />
        <Card label="Passing" value={String(totals.pass)} tone="good" />
        <Card label="Critical defects" value={String(totals.fail)} tone={totals.fail > 0 ? 'bad' : 'good'} />
        <Card label="Warnings" value={String(totals.warning)} tone={totals.warning > 0 ? 'warn' : 'good'} />
        <Card label="Unknown coverage" value={String(totals.unknown)} tone={totals.unknown > 0 ? 'warn' : 'good'} />
      </div>

      {/* Release gate ------------------------------------------------------ */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900">Release gate</h2>
        <p className="text-sm text-gray-500 mt-0.5 mb-4">
          {gate.passed
            ? 'Every criterion is satisfied.'
            : `Blocked by ${gate.blockedBy.length} criterion(s): ${gate.blockedBy.join(', ')}.`}
        </p>
        <ul className="divide-y divide-gray-100">
          {gate.criteria.map((c) => (
            <li key={c.id} className="py-3 flex items-start gap-3">
              <StatusIcon status={c.status} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{c.requirement}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.evidence}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Gold Standard ----------------------------------------------------- */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900">Gold Standard certification</h2>
        {report.goldStandard.authorizedCases.length === 0 ? (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-900 font-medium flex items-center gap-1.5">
              <AlertTriangle size={14} /> No attorney-authorized case has been processed
            </p>
            <p className="text-xs text-amber-800 mt-1.5">
              {report.goldStandard.corporaTotal} corpora exist, all of them synthetic fixtures created by the
              certification suites. Real-discovery certification is the one test that exercises the material this
              platform exists to handle, and it has not been run. Import a case through the Gold Standard portal
              to close this.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {report.goldStandard.authorizedCases.map((c) => (
              <li key={c.reference} className="text-sm text-gray-700">
                <span className="font-mono text-xs">{c.reference}</span> — {c.label} ({c.fileCount} files, {c.status})
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-500 mt-3">
          {report.goldStandard.runs} certification run(s) recorded.{' '}
          {report.goldStandard.baselineSet ? 'A baseline is set for regression comparison.' : 'No baseline set yet.'}
        </p>
      </section>

      {/* Suites ------------------------------------------------------------ */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Certification suites</h2>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3 font-medium">Suite</th>
                <th className="py-2 px-2 font-medium text-right">Pass</th>
                <th className="py-2 px-2 font-medium text-right">Fail</th>
                <th className="py-2 px-2 font-medium text-right">Warn</th>
                <th className="py-2 px-2 font-medium text-right">Unknown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.suites.map((s) => (
                <tr key={s.suite}>
                  <td className="py-1.5 pr-3 text-gray-700">{s.title}</td>
                  <td className="py-1.5 px-2 text-right text-emerald-700">{s.pass}</td>
                  <td className={`py-1.5 px-2 text-right ${s.fail > 0 ? 'text-red-700 font-semibold' : 'text-gray-400'}`}>
                    {s.fail}
                  </td>
                  <td className={`py-1.5 px-2 text-right ${s.warning > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                    {s.warning}
                  </td>
                  <td className={`py-1.5 px-2 text-right ${s.unknown > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                    {s.unknown}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Defects ------------------------------------------------------------ */}
      {report.criticalDefects.length > 0 && (
        <section className="bg-white rounded-xl border border-red-200 p-5">
          <h2 className="text-base font-semibold text-red-900 mb-3">
            Critical defects ({report.criticalDefects.length})
          </h2>
          <ul className="space-y-2">
            {report.criticalDefects.map((d) => (
              <li key={`${d.suite}-${d.id}`} className="text-xs">
                <span className="font-mono text-red-700">{d.id}</span>{' '}
                <span className="text-gray-900">{d.title}</span>
                {d.detail && <p className="text-gray-600 mt-0.5">{d.detail}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Unknown coverage ---------------------------------------------------- */}
      {report.unknownCoverage.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            Not measured ({report.unknownCoverage.length})
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Recorded as unknown rather than counted as passes. Each one is a claim this platform is not entitled
            to make.
          </p>
          <ul className="space-y-2">
            {report.unknownCoverage.map((u) => (
              <li key={`${u.suite}-${u.id}`} className="text-xs">
                <span className="font-mono text-gray-500">{u.id}</span>{' '}
                <span className="text-gray-900">{u.title}</span>
                {u.detail && <p className="text-gray-600 mt-0.5">{u.detail}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'PASS') return <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />;
  if (status === 'FAIL') return <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />;
  return <HelpCircle size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />;
}

function Card({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  const colour =
    tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${colour}`}>{value}</p>
    </div>
  );
}

export default ProductionReadiness;
