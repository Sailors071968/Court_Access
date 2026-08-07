// ============================================================================
// Attorney war room.
//
// One screen: where the case stands, what is charged, what the record raises,
// what is missing, and what has happened lately. Everything links to the
// record behind it.
//
// Nothing here states a conclusion about guilt, the merits of an issue, or how
// the case will end.
// ============================================================================

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Clock, FileText, Gavel, Loader2, Scale, Search,
} from 'lucide-react';
import { loadPanel } from '../../services/authedFetch';

interface WarRoom {
  case: { title: string; caseNumber: string; court: string | null; nextHearing: string | null; nextHearingNote: string | null } | null;
  stage: { stage: string; label: string; source: string; basis: string };
  charges: {
    operativeDocument: { name: string; filedAt: string; kind: string } | null;
    counts: Array<{ countNumber: number; citation: string; status: string; defendants: Array<{ name: string; status: string }> }>;
    note: string | null;
  };
  repositoryIssues: Array<{
    id: string;
    topic: string;
    documentCount: number;
    statement: string;
    firstPassage: { fileName: string; excerpt: string } | null;
  }>;
  defenceThemes: { supported: number; examined: number; topThemes: Array<{ id: string; label: string; documentCount: number }> };
  outstanding: { missingMaterial: string[] };
  recentActivity: Array<{ at: string; kind: string; what: string; consequence: string | null }>;
  caveat: string;
}

export function AttorneyWarRoom() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<WarRoom | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    void loadPanel<WarRoom>(`/cases/${caseId}/war-room`, 'The war room').then((r) => {
      if (cancelled) return;
      if (r.data) setData(r.data);
      else setUnavailable(r.unavailableReason);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 p-6">
        <Loader2 size={16} className="animate-spin" /> Assembling the case…
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
        <AlertTriangle size={16} className="text-amber-600 mt-0.5" />
        <p className="text-sm text-amber-900">{unavailable}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5" data-testid="war-room">
      {/* Stage --------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border-2 border-indigo-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Current stage</p>
            <p className="text-2xl font-semibold text-gray-900 mt-0.5" data-testid="war-room-stage">
              {data.stage.label}
            </p>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">{data.stage.basis}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {data.stage.source === 'attorney'
                ? 'Set by counsel.'
                : data.stage.source === 'inferred'
                  ? 'Worked out from what is on the record.'
                  : 'Not determined.'}
            </p>
          </div>
          {data.case?.nextHearing && (
            <div className="text-right">
              <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                <Clock size={12} /> Next in court
              </p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(data.case.nextHearing).toLocaleDateString()}
              </p>
              {data.case.nextHearingNote && <p className="text-xs text-gray-500">{data.case.nextHearingNote}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Charges ------------------------------------------------------------ */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Gavel size={16} /> Charges
            </h2>
            <Link to={`/cases/${caseId}/charges`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              Full record <ArrowRight size={11} />
            </Link>
          </div>
          {data.charges.note ? (
            <p className="text-sm text-gray-500">{data.charges.note}</p>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-2">
                As charged in the {data.charges.operativeDocument?.name}, filed{' '}
                {data.charges.operativeDocument && new Date(data.charges.operativeDocument.filedAt).toLocaleDateString()}
              </p>
              <ul className="space-y-1.5">
                {data.charges.counts.map((c) => (
                  <li key={c.countNumber} className="text-xs">
                    <span className={`font-medium ${c.status === 'dismissed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      Count {c.countNumber} — {c.citation}
                    </span>
                    <span className="text-gray-500"> · {c.defendants.map((d) => d.name).join(', ')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Defence themes ------------------------------------------------------ */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Scale size={16} /> Defence themes
            </h2>
            <Link to={`/cases/${caseId}/litigation-strategy`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              Workspace <ArrowRight size={11} />
            </Link>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            {data.defenceThemes.supported} of {data.defenceThemes.examined} themes have material in the record.
          </p>
          {data.defenceThemes.topThemes.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing in the record touches any theme yet.</p>
          ) : (
            <ul className="space-y-1">
              {data.defenceThemes.topThemes.map((t) => (
                <li key={t.id} className="text-xs flex items-center justify-between">
                  <span className="text-gray-900">{t.label}</span>
                  <span className="text-gray-400">{t.documentCount} doc(s)</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Repository-backed issues ---------------------------------------------- */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Search size={16} /> Issues the record raises
          </h2>
          <Link to={`/cases/${caseId}/motions`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
            Review queue <ArrowRight size={11} />
          </Link>
        </div>
        {data.repositoryIssues.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing in the record raises an issue for review.</p>
        ) : (
          <ul className="space-y-2" data-testid="war-room-issues">
            {data.repositoryIssues.map((i) => (
              <li key={i.id} className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900">{i.topic}</p>
                <p className="text-xs text-gray-500 mt-0.5">{i.statement}</p>
                {i.firstPassage && (
                  <p className="text-xs text-gray-600 mt-1.5 italic">
                    {i.firstPassage.fileName}: {i.firstPassage.excerpt.slice(0, 200)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Outstanding --------------------------------------------------------- */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <AlertTriangle size={16} /> Not in the record
          </h2>
          {data.outstanding.missingMaterial.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing has been identified as missing.</p>
          ) : (
            <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside" data-testid="war-room-missing">
              {data.outstanding.missingMaterial.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity ------------------------------------------------------ */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <FileText size={16} /> What changed
          </h2>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing has happened on this case yet.</p>
          ) : (
            <ul className="space-y-2" data-testid="war-room-activity">
              {data.recentActivity.slice(0, 8).map((a, i) => (
                <li key={i} className="text-xs">
                  <p className="text-gray-900">{a.what}</p>
                  {a.consequence && <p className="text-gray-500 mt-0.5">{a.consequence}</p>}
                  <p className="text-gray-400 mt-0.5">{new Date(a.at).toLocaleDateString()}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-4">{data.caveat}</p>
    </div>
  );
}

export default AttorneyWarRoom;
