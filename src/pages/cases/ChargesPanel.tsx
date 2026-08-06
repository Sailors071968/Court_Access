// ============================================================================
// Charges.
//
// What the defendant faces now, prominently; what they faced before, below it.
// Every filing is kept, every change between filings is named, and the wording
// shown is the People's own.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronRight,
  FilePlus2, Gavel, History, Loader2, Scale, XCircle,
} from 'lucide-react';
import { authorizedFetch, describeFailure } from '../../services/session';

interface Defendant {
  name: string;
  status: string;
  note?: string | null;
}

interface CurrentCharge {
  filedChargeId: string;
  countNumber: number;
  code: string;
  section: string;
  subdivision: string | null;
  normalizedCitation: string;
  verbatimText: string;
  status: string;
  enhancements: string[];
  officialStatuteId: string | null;
  statuteNote: string | null;
  defendants: Defendant[];
}

interface CurrentCharges {
  operativeDocument: { chargingDocumentId: string; kind: string; name: string; filedAt: string; court: string | null; courtCaseNumber: string | null } | null;
  charges: CurrentCharge[];
  activeCounts: number;
  dismissedCounts: number;
  message?: string;
}

interface Change {
  type: string;
  description: string;
  citation: string;
}

interface TimelineEntry {
  chargingDocumentId: string;
  kind: string;
  name: string;
  filedAt: string;
  filingSequence: number;
  isOperative: boolean;
  countCount: number;
  activeCount: number;
  changesFromPrevious: Change[];
}

const CHANGE_STYLE: Record<string, { colour: string; label: string }> = {
  added: { colour: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Added' },
  dismissed: { colour: 'text-red-700 bg-red-50 border-red-200', label: 'No longer charged' },
  renumbered: { colour: 'text-blue-700 bg-blue-50 border-blue-200', label: 'Renumbered' },
  allegation_modified: { colour: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Allegation rewritten' },
  enhancement_added: { colour: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Enhancement added' },
  enhancement_dismissed: { colour: 'text-red-700 bg-red-50 border-red-200', label: 'Enhancement dropped' },
  defendant_added: { colour: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Defendant added' },
  defendant_removed: { colour: 'text-red-700 bg-red-50 border-red-200', label: 'Defendant removed' },
  defendant_status_changed: { colour: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Defendant status' },
};

async function get<T>(path: string): Promise<T> {
  const res = await authorizedFetch(path);
  const body = await res.text();
  if (!res.ok) throw new Error(await describeFailure(res, body));
  return JSON.parse(body) as T;
}

export function ChargesPanel({ caseId }: { caseId: string }) {
  const [current, setCurrent] = useState<CurrentCharges | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [codes, setCodes] = useState<Array<{ abbreviation: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [comparison, setComparison] = useState<{ from: string; to: string; changes: Change[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, t] = await Promise.all([
        get<CurrentCharges>(`/api/cases/${caseId}/charges/current`),
        get<{ timeline: TimelineEntry[] }>(`/api/cases/${caseId}/charges/timeline`),
      ]);
      setCurrent(c);
      setTimeline(t.timeline);
      await get<{ codes: typeof codes }>('/api/charging/codes').then((r) => setCodes(r.codes)).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The charges could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const compare = async (from: string, to: string) => {
    try {
      const r = await get<{ from: { name: string }; to: { name: string }; changes: Change[] }>(
        `/api/cases/${caseId}/charges/compare?from=${from}&to=${to}`,
      );
      setComparison({ from: r.from.name, to: r.to.name, changes: r.changes });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The comparison failed.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 p-6">
        <Loader2 size={16} className="animate-spin" /> Loading charges…
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="charges-panel">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <XCircle size={16} className="text-red-600 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Current charges ---------------------------------------------------- */}
      <section className="bg-white rounded-xl border-2 border-indigo-200 p-5" data-testid="current-charges">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Gavel size={18} className="text-indigo-600" /> Current charges
            </h2>
            {current?.operativeDocument ? (
              <p className="text-sm text-gray-600 mt-0.5">
                As charged in the <span className="font-medium">{current.operativeDocument.name}</span>, filed{' '}
                {new Date(current.operativeDocument.filedAt).toLocaleDateString()}
                {current.operativeDocument.courtCaseNumber ? ` · ${current.operativeDocument.courtCaseNumber}` : ''}
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-0.5">{current?.message}</p>
            )}
          </div>
          {current?.operativeDocument && (
            <div className="text-right text-xs whitespace-nowrap">
              <p className="text-emerald-700 font-medium">{current.activeCounts} active</p>
              {current.dismissedCounts > 0 && <p className="text-red-700">{current.dismissedCounts} dismissed</p>}
            </div>
          )}
        </div>

        {(current?.charges ?? []).length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            <FilePlus2 size={28} className="mx-auto text-gray-300 mb-2" />
            No charging document has been filed for this case yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {current!.charges.map((c) => (
              <li
                key={c.filedChargeId}
                className={`border rounded-lg p-4 ${c.status === 'dismissed' ? 'border-red-200 bg-red-50/40' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      Count {c.countNumber} — {c.normalizedCitation}
                      {c.status === 'dismissed' && (
                        <span className="ml-2 text-xs font-medium text-red-700 uppercase tracking-wide">Dismissed</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Defendants:{' '}
                      {c.defendants.map((d, i) => (
                        <span key={d.name}>
                          {i > 0 && ', '}
                          <span className={d.status !== 'charged' ? 'line-through text-gray-400' : ''}>{d.name}</span>
                          {d.status !== 'charged' && (
                            <span className="text-amber-700 not-italic"> ({d.status})</span>
                          )}
                        </span>
                      ))}
                    </p>
                  </div>
                  {c.officialStatuteId ? (
                    <span className="text-xs text-emerald-700 flex items-center gap-1 whitespace-nowrap">
                      <CheckCircle2 size={12} /> statute retrieved
                    </span>
                  ) : (
                    <span className="text-xs text-amber-700 flex items-center gap-1 whitespace-nowrap" title={c.statuteNote ?? ''}>
                      <AlertTriangle size={12} /> statute unavailable
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-700 mt-2 italic bg-gray-50 border border-gray-200 rounded p-2">
                  {c.verbatimText}
                </p>

                {c.enhancements.length > 0 && (
                  <p className="text-xs text-gray-600 mt-2">
                    <span className="font-medium">Enhancements:</span> {c.enhancements.join('; ')}
                  </p>
                )}
                {c.statuteNote && <p className="text-xs text-amber-700 mt-1.5">{c.statuteNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Charging history ---------------------------------------------------- */}
      {timeline.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5" data-testid="charging-history">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <History size={16} /> Charging history
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Every document the People have filed. Nothing is removed — a superseded pleading remains exactly as it
            was filed.
          </p>

          <ol className="space-y-3">
            {timeline.map((doc, i) => {
              const open = expanded[doc.chargingDocumentId] ?? doc.isOperative;
              return (
                <li key={doc.chargingDocumentId} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [doc.chargingDocumentId]: !open }))}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                  >
                    {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {doc.name}
                        {doc.isOperative && (
                          <span className="ml-2 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 uppercase">
                            Operative
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        Filed {new Date(doc.filedAt).toLocaleDateString()} · {doc.countCount} count(s),{' '}
                        {doc.activeCount} active
                        {doc.changesFromPrevious.length > 0 && ` · ${doc.changesFromPrevious.length} change(s)`}
                      </p>
                    </div>
                    {i > 0 && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          void compare(timeline[0].chargingDocumentId, doc.chargingDocumentId);
                        }}
                        onKeyDown={() => {}}
                        className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
                      >
                        Compare with first
                      </span>
                    )}
                  </button>

                  {open && doc.changesFromPrevious.length > 0 && (
                    <ul className="px-4 pb-3 space-y-1.5">
                      {doc.changesFromPrevious.map((c, k) => {
                        const style = CHANGE_STYLE[c.type] ?? { colour: 'text-gray-700 bg-gray-50 border-gray-200', label: c.type };
                        return (
                          <li key={k} className={`text-xs border rounded px-2 py-1.5 ${style.colour}`}>
                            <span className="font-medium">{style.label}:</span> {c.description}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {open && doc.changesFromPrevious.length === 0 && i === 0 && (
                    <p className="px-4 pb-3 text-xs text-gray-500">
                      The first charging document in this case; there is nothing before it to compare against.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Comparison ----------------------------------------------------------- */}
      {comparison && (
        <section className="bg-white rounded-xl border border-gray-200 p-5" data-testid="charge-comparison">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              {comparison.from} <ArrowRight size={14} className="text-gray-400" /> {comparison.to}
            </h2>
            <button onClick={() => setComparison(null)} className="text-xs text-gray-500 hover:text-gray-700">
              Close
            </button>
          </div>
          {comparison.changes.length === 0 ? (
            <p className="text-sm text-gray-500">The charges are identical between these two filings.</p>
          ) : (
            <ul className="space-y-1.5">
              {comparison.changes.map((c, i) => {
                const style = CHANGE_STYLE[c.type] ?? { colour: 'text-gray-700 bg-gray-50 border-gray-200', label: c.type };
                return (
                  <li key={i} className={`text-xs border rounded px-2 py-1.5 ${style.colour}`}>
                    <span className="font-medium">{style.label}:</span> {c.description}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {codes.length > 0 && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Scale size={12} /> Charges may cite any of the {codes.length} California codes; each section is retrieved
          from the Legislature when the document is filed.
        </p>
      )}
    </div>
  );
}

export default ChargesPanel;
