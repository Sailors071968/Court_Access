// ============================================================================
// Evidence coverage.
//
// For each charged count, the elements taken from the statute with whatever in
// the record touches them, whatever cuts the other way, and — most usefully —
// the elements with nothing behind them at all.
//
// It decides nothing. Whether an element is proved is a jury question on
// evidence a court has admitted.
// ============================================================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ExternalLink, Info, Loader2, MinusCircle,
} from 'lucide-react';
import { loadPanel } from '../../services/authedFetch';

interface Citation {
  evidenceId: string;
  fileName: string;
  excerpt: string;
  matchedOn: string;
}

interface Element {
  element: string;
  source: string;
  supporting: Citation[];
  conflicting: Citation[];
  status: 'has_material' | 'no_material';
  citationCount: number;
  basis: string;
}

interface Count {
  countNumber: number;
  citation: string;
  officialUrl: string | null;
  legislativeNote: string | null;
  calcrim: { status: string; instruction: string | null; reason: string | null };
  mentalStates: Array<{ mentalState: string; basis: string | null }>;
  elements: Element[];
  elementsWithMaterial: number;
  elementsWithout: number;
  unavailable: string | null;
}

interface Coverage {
  counts: Count[];
  documentsExamined: number;
  note: string | null;
  caveat: string;
}

interface Explanation {
  subject: string;
  whyDisplayed: string;
  producedBy: string;
  repository: string;
  supportingEvidence: Citation[];
  conflictingEvidence: Citation[];
  missingEvidence: string[];
  authorities: Array<{ citation: string; officialUrl: string | null }>;
  openQuestions: string[];
  unknown: string[];
}

export function EvidenceCoveragePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<Coverage | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [explanation, setExplanation] = useState<Explanation | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    void loadPanel<Coverage>(`/cases/${caseId}/evidence-coverage`, 'Evidence coverage').then((r) => {
      if (cancelled) return;
      if (r.data) setData(r.data);
      else setUnavailable(r.unavailableReason);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const explainCount = async (countNumber: number) => {
    const r = await loadPanel<Explanation>(`/cases/${caseId}/explain/count/${countNumber}`, 'The explanation');
    if (r.data) setExplanation(r.data);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 p-6">
        <Loader2 size={16} className="animate-spin" /> Organising the record against the elements…
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
    <div className="space-y-5" data-testid="evidence-coverage">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Evidence coverage</h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.documentsExamined} document(s) examined against the elements of {data.counts.length} count(s).
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs text-gray-600">{data.caveat}</p>
      </div>

      {data.note && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-900">{data.note}</p>
        </div>
      )}

      {data.counts.map((count) => (
        <section key={count.countNumber} className="bg-white rounded-xl border border-gray-200 p-5" data-testid={`count-${count.countNumber}`}>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Count {count.countNumber} — {count.citation}
              </h2>
              {count.legislativeNote && <p className="text-xs text-gray-500 mt-0.5">{count.legislativeNote}</p>}
            </div>
            <div className="flex items-center gap-3">
              {count.officialUrl && (
                <a
                  href={count.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                >
                  Statute <ExternalLink size={11} />
                </a>
              )}
              <button
                data-testid={`explain-${count.countNumber}`}
                onClick={() => void explainCount(count.countNumber)}
                className="text-xs px-2.5 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Info size={12} /> Explain this
              </button>
            </div>
          </div>

          {count.unavailable ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-900">{count.unavailable}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-3">
                <span>
                  <span className="font-medium text-gray-900">{count.elementsWithMaterial}</span> element(s) with
                  material
                </span>
                <span>
                  <span className="font-medium text-gray-900">{count.elementsWithout}</span> with nothing in the
                  record
                </span>
                <span>
                  CALCRIM:{' '}
                  {count.calcrim.instruction ?? <span className="text-gray-400">UNKNOWN</span>}
                </span>
                <span>
                  Mental state:{' '}
                  {count.mentalStates.map((m) => m.mentalState).join(', ') || 'unknown'}
                </span>
              </div>

              <ul className="space-y-2">
                {count.elements.map((el, i) => {
                  const key = `${count.countNumber}-${i}`;
                  const isOpen = open[key] ?? false;
                  return (
                    <li key={key} className="border border-gray-200 rounded-lg">
                      <button
                        onClick={() => setOpen((p) => ({ ...p, [key]: !isOpen }))}
                        className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-gray-50"
                      >
                        {isOpen ? (
                          <ChevronDown size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        ) : (
                          <ChevronRight size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        )}
                        {el.status === 'has_material' ? (
                          <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <MinusCircle size={14} className="text-gray-300 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-900">{el.element}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {el.source} · {el.supporting.length} supporting, {el.conflicting.length} contrary
                          </p>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-3 space-y-3">
                          <p className="text-xs text-gray-600">{el.basis}</p>

                          {el.supporting.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-emerald-800 mb-1">In the record</p>
                              <ul className="space-y-1.5">
                                {el.supporting.map((c, k) => (
                                  <li key={k} className="text-xs border border-gray-200 rounded p-2">
                                    <span className="font-medium text-gray-800">{c.fileName}</span>
                                    <p className="text-gray-600 mt-0.5 italic">{c.excerpt}</p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {el.conflicting.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-amber-800 mb-1">Cuts the other way</p>
                              <ul className="space-y-1.5">
                                {el.conflicting.map((c, k) => (
                                  <li key={k} className="text-xs border border-amber-200 bg-amber-50/50 rounded p-2">
                                    <span className="font-medium text-gray-800">{c.fileName}</span>
                                    <p className="text-gray-600 mt-0.5 italic">{c.excerpt}</p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ))}

      {/* Explain this ---------------------------------------------------------- */}
      {explanation && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center p-6 overflow-auto z-50" onClick={() => setExplanation(null)}>
          <div
            className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl w-full my-8 space-y-4"
            onClick={(e) => e.stopPropagation()}
            data-testid="explanation"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-base font-semibold text-gray-900">{explanation.subject}</h2>
              <button onClick={() => setExplanation(null)} className="text-xs text-gray-500 hover:text-gray-700">
                Close
              </button>
            </div>

            <Field label="Why this is displayed" value={explanation.whyDisplayed} />
            <Field label="What produced it" value={explanation.producedBy} />
            <Field label="Repository" value={explanation.repository} />

            {explanation.authorities.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700">Authority</p>
                {explanation.authorities.map((a, i) => (
                  <p key={i} className="text-xs mt-0.5">
                    {a.officialUrl ? (
                      <a href={a.officialUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                        {a.citation}
                      </a>
                    ) : (
                      a.citation
                    )}
                  </p>
                ))}
              </div>
            )}

            {explanation.missingEvidence.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-800">Not in the record</p>
                <ul className="text-xs text-amber-800 mt-1 space-y-0.5 list-disc list-inside">
                  {explanation.missingEvidence.slice(0, 8).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {explanation.unknown.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700">Not determined</p>
                <ul className="text-xs text-gray-600 mt-1 space-y-0.5 list-disc list-inside">
                  {explanation.unknown.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-700">{label}</p>
      <p className="text-xs text-gray-600 mt-0.5">{value}</p>
    </div>
  );
}

export default EvidenceCoveragePage;
