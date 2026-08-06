// ============================================================================
// Defence strategy workspace.
//
// Organises what is in the record into the themes a defence lawyer thinks in.
// Every passage shown is quoted from a document in this case so it can be
// checked against the original.
//
// It organises; it does not conclude. Nothing here says a defence is
// available, sound, or worth running.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronRight, FileText, HelpCircle, Loader2, Scale, Search } from 'lucide-react';
import { loadPanel } from '../../services/authedFetch';

interface Citation {
  evidenceId: string;
  fileName: string;
  excerpt: string;
  matchedOn: string;
}

interface Theme {
  id: string;
  label: string;
  group: string;
  status: 'supported' | 'unsupported';
  citations: Citation[];
  documentCount: number;
  missing: string[];
  openQuestions: string[];
  authorities: Array<{ kind: string; citation: string; officialUrl: string | null }>;
  basis: string;
}

interface ThemeResponse {
  themes: Theme[];
  documentsExamined: number;
  caveat: string;
  message?: string;
}

const GROUP_LABELS: Record<string, string> = {
  factual: 'Factual',
  mental_state: 'Mental state',
  constitutional: 'Constitutional',
  reliability: 'Reliability and credibility',
  procedural: 'Procedural',
  burden: 'Burden of proof',
};

export function DefenseStrategyWorkspace() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<ThemeResponse | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showUnsupported, setShowUnsupported] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    setLoading(true);
    void loadPanel<ThemeResponse>(`/cases/${caseId}/defense-themes`, 'The defence strategy workspace').then((r) => {
      if (cancelled) return;
      if (r.data) setData(r.data);
      else setUnavailable(r.unavailableReason);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const supported = useMemo(() => data?.themes.filter((t) => t.status === 'supported') ?? [], [data]);
  const unsupported = useMemo(() => data?.themes.filter((t) => t.status === 'unsupported') ?? [], [data]);

  const byGroup = useMemo(() => {
    const map = new Map<string, Theme[]>();
    for (const t of supported) {
      if (!map.has(t.group)) map.set(t.group, []);
      map.get(t.group)!.push(t);
    }
    return map;
  }, [supported]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 p-6">
        <Loader2 size={16} className="animate-spin" /> Organising the record…
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
    <div className="space-y-6" data-testid="defense-strategy">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Scale size={19} className="text-indigo-600" /> Defence strategy
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.documentsExamined} document(s) examined. {supported.length} of {data.themes.length} themes have
          material in the record.
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs text-gray-600">{data.caveat}</p>
      </div>

      {data.message && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-900">{data.message}</p>
        </div>
      )}

      {/* Supported themes ---------------------------------------------------- */}
      {[...byGroup.entries()].map(([group, themes]) => (
        <section key={group}>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            {GROUP_LABELS[group] ?? group}
          </h2>
          <div className="space-y-2">
            {themes.map((t) => {
              const isOpen = open[t.id] ?? false;
              return (
                <div key={t.id} className="bg-white border border-gray-200 rounded-xl" data-testid={`theme-${t.id}`}>
                  <button
                    onClick={() => setOpen((p) => ({ ...p, [t.id]: !isOpen }))}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
                  >
                    {isOpen ? (
                      <ChevronDown size={15} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={15} className="text-gray-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{t.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t.documentCount} document(s), {t.citations.length} passage(s)
                      </p>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-4">
                      <p className="text-xs text-gray-600">{t.basis}</p>

                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                          <FileText size={12} /> Passages in the record
                        </p>
                        <ul className="space-y-2">
                          {t.citations.map((c, i) => (
                            <li key={i} className="border border-gray-200 rounded-lg p-2.5">
                              <p className="text-xs font-medium text-gray-800">{c.fileName}</p>
                              <p className="text-xs text-gray-600 mt-1 italic">{c.excerpt}</p>
                              <p className="text-[11px] text-gray-400 mt-1">matched on “{c.matchedOn}”</p>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {t.missing.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-amber-800 mb-1.5 flex items-center gap-1.5">
                            <AlertTriangle size={12} /> Commonly needed and not in the record
                          </p>
                          <ul className="text-xs text-amber-800 space-y-0.5 list-disc list-inside">
                            {t.missing.map((m, i) => (
                              <li key={i}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {t.openQuestions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                            <HelpCircle size={12} /> Unanswered
                          </p>
                          <ul className="text-xs text-gray-600 space-y-0.5 list-disc list-inside">
                            {t.openQuestions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {t.authorities.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1.5">Authorities</p>
                          <ul className="text-xs space-y-0.5">
                            {t.authorities.map((a, i) => (
                              <li key={i}>
                                {a.officialUrl ? (
                                  <a href={a.officialUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                                    {a.citation}
                                  </a>
                                ) : (
                                  <span className="text-gray-700">{a.citation}</span>
                                )}
                                <span className="text-gray-400"> — {a.kind}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {supported.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <Search size={26} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-600">
            Nothing in the record touches any of the {data.themes.length} themes yet.
          </p>
        </div>
      )}

      {/* Themes with nothing in the record ------------------------------------ */}
      <section>
        <button
          data-testid="toggle-unsupported"
          onClick={() => setShowUnsupported((v) => !v)}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1.5"
        >
          {showUnsupported ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {unsupported.length} theme(s) with nothing in the record
        </button>
        {showUnsupported && (
          <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4" data-testid="unsupported-themes">
            <p className="text-xs text-gray-500 mb-3">
              These are listed so it is clear they were examined. Nothing found is not the same as nothing there.
            </p>
            <ul className="space-y-1.5">
              {unsupported.map((t) => (
                <li key={t.id} className="text-xs">
                  <span className="font-medium text-gray-800">{t.label}</span>
                  <span className="text-gray-500"> — {t.basis}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

export default DefenseStrategyWorkspace;
