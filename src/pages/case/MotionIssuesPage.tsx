// ============================================================================
// Motion intelligence.
//
// Repository-backed issues the record raises, organised for review. This page
// does not recommend filing anything, does not assess merits and does not
// predict how a court would rule. It says what is in the record and what is
// missing, and leaves the judgement where it belongs.
// ============================================================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronRight, FileText, HelpCircle, Loader2, Gavel } from 'lucide-react';
import { loadPanel } from '../../services/authedFetch';

interface Citation {
  evidenceId: string;
  fileName: string;
  excerpt: string;
  matchedOn: string;
}

interface Issue {
  id: string;
  topic: string;
  group: string;
  statement: string;
  whyItAppears: string;
  supportingEvidence: Citation[];
  missingEvidence: string[];
  openQuestions: string[];
  reviewStatus: string;
}

interface Response {
  documentsExamined: number;
  issues: Issue[];
  notRaised: Array<{ topic: string; reason: string }>;
  caveat: string;
}

export function MotionIssuesPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<Response | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showNotRaised, setShowNotRaised] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    void loadPanel<Response>(`/cases/${caseId}/motion-issues`, 'Motion intelligence').then((r) => {
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
    <div className="space-y-6" data-testid="motion-issues">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Gavel size={19} className="text-indigo-600" /> Motion intelligence
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.issues.length} issue(s) raised by {data.documentsExamined} document(s) in the record.
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs text-gray-600">{data.caveat}</p>
      </div>

      {data.issues.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-600">
            Nothing in the record raises any of the issues this page organises.
            {data.documentsExamined === 0 && ' No evidence has been processed for this case yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.issues.map((issue) => {
            const isOpen = open[issue.id] ?? false;
            return (
              <div key={issue.id} className="bg-white border border-gray-200 rounded-xl" data-testid={`issue-${issue.id}`}>
                <button
                  onClick={() => setOpen((p) => ({ ...p, [issue.id]: !isOpen }))}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
                >
                  {isOpen ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{issue.topic}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{issue.statement}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">
                    {issue.supportingEvidence.length} passage(s)
                  </span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-4">
                    <p className="text-xs text-gray-600">{issue.whyItAppears}</p>

                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <FileText size={12} /> In the record
                      </p>
                      <ul className="space-y-2">
                        {issue.supportingEvidence.map((c, i) => (
                          <li key={i} className="border border-gray-200 rounded-lg p-2.5">
                            <p className="text-xs font-medium text-gray-800">{c.fileName}</p>
                            <p className="text-xs text-gray-600 mt-1 italic">{c.excerpt}</p>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {issue.missingEvidence.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-amber-800 mb-1.5 flex items-center gap-1.5">
                          <AlertTriangle size={12} /> Not in the record
                        </p>
                        <ul className="text-xs text-amber-800 space-y-0.5 list-disc list-inside">
                          {issue.missingEvidence.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {issue.openQuestions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                          <HelpCircle size={12} /> Unanswered
                        </p>
                        <ul className="text-xs text-gray-600 space-y-0.5 list-disc list-inside">
                          {issue.openQuestions.map((q, i) => (
                            <li key={i}>{q}</li>
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
      )}

      {data.notRaised.length > 0 && (
        <section>
          <button
            data-testid="toggle-not-raised"
            onClick={() => setShowNotRaised((v) => !v)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1.5"
          >
            {showNotRaised ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {data.notRaised.length} topic(s) the record does not raise
          </button>
          {showNotRaised && (
            <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4" data-testid="not-raised">
              <ul className="space-y-1.5">
                {data.notRaised.map((n) => (
                  <li key={n.topic} className="text-xs">
                    <span className="font-medium text-gray-800">{n.topic}</span>
                    <span className="text-gray-500"> — {n.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default MotionIssuesPage;
