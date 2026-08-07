// ============================================================================
// Family portal.
//
// Written for someone who is frightened and is not a lawyer. Plain English, no
// jargon, nothing they cannot act on, and no legal advice of any kind.
//
// The questions are not answers. They are things worth asking the attorney,
// each one linked to what in the case prompted it, so the conversation starts
// somewhere real rather than with a worry.
// ============================================================================

import { useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, FileText, HelpCircle, Loader2, Scale } from 'lucide-react';
import { loadPanel } from '../../services/authedFetch';

interface FamilyView {
  caseTitle: string;
  stage: { label: string; plainEnglish: string };
  charges: Array<{ countNumber: number; plainLanguage: string; citation: string }>;
  chargesNote: string | null;
  nextHearing: { date: string; note: string | null } | null;
  recentlyAdded: Array<{ fileName: string; addedAt: string; readable: boolean }>;
  questions: Array<{ question: string; why: string; basedOn: string | null }>;
  caveat: string;
}

export function FamilyIntelligencePortal({ caseId }: { caseId: string }) {
  const [data, setData] = useState<FamilyView | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadPanel<FamilyView>(`/cases/${caseId}/family-view`, 'This case').then((r) => {
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
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
        <AlertCircle size={16} className="text-amber-600 mt-0.5" />
        <p className="text-sm text-amber-900">{unavailable}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 max-w-3xl" data-testid="family-portal">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{data.caseTitle}</h1>
        <p className="text-sm text-gray-500 mt-1">
          A plain-English summary of where things stand.
        </p>
      </div>

      {/* Where things stand ---------------------------------------------------- */}
      <section className="bg-white rounded-xl border-2 border-blue-200 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Where the case is now</p>
        <p className="text-lg font-semibold text-gray-900 mt-1" data-testid="family-stage">
          {data.stage.label}
        </p>
        <p className="text-sm text-gray-700 mt-1.5">{data.stage.plainEnglish}</p>
      </section>

      {/* Next hearing ----------------------------------------------------------- */}
      {data.nextHearing && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <CalendarDays size={16} /> Next court date
          </h2>
          <p className="text-sm text-gray-900">{new Date(data.nextHearing.date).toDateString()}</p>
          {data.nextHearing.note && <p className="text-sm text-gray-600 mt-0.5">{data.nextHearing.note}</p>}
        </section>
      )}

      {/* Charges ---------------------------------------------------------------- */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Scale size={16} /> What is charged
        </h2>
        {data.chargesNote ? (
          <p className="text-sm text-gray-600">{data.chargesNote}</p>
        ) : (
          <ul className="space-y-2" data-testid="family-charges">
            {data.charges.map((c) => (
              <li key={c.countNumber} className="text-sm">
                <span className="font-medium text-gray-900">Charge {c.countNumber}:</span>{' '}
                <span className="text-gray-700">{c.plainLanguage}</span>
                <span className="text-gray-400 text-xs"> ({c.citation})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recently added ---------------------------------------------------------- */}
      {data.recentlyAdded.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <FileText size={16} /> Recently added to the case
          </h2>
          <ul className="space-y-1.5">
            {data.recentlyAdded.map((f, i) => (
              <li key={i} className="text-sm text-gray-700">
                {f.fileName}
                <span className="text-xs text-gray-400"> — {new Date(f.addedAt).toLocaleDateString()}</span>
                {!f.readable && (
                  <span className="text-xs text-amber-700"> · could not be read by the system</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Questions ---------------------------------------------------------------- */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-1">
          <HelpCircle size={16} /> Questions you might ask the attorney
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          These are not answers, and they are not advice. They are things this case raised that are worth asking
          about.
        </p>
        {data.questions.length === 0 ? (
          <p className="text-sm text-gray-600" data-testid="family-no-questions">
            Nothing in the case file raises a question to pass on yet.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="family-questions">
            {data.questions.map((q, i) => (
              <li key={i} className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900">{q.question}</p>
                <p className="text-xs text-gray-600 mt-1">{q.why}</p>
                {q.basedOn && <p className="text-xs text-gray-400 mt-1">Based on: {q.basedOn}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-4">{data.caveat}</p>
    </div>
  );
}

export default FamilyIntelligencePortal;
