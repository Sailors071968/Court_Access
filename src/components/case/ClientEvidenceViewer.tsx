// ============================================================================
// Phase 270 — Client Evidence Viewer (Enhanced)
// Features: highlight evidence references, jump to timestamps,
//           link analysis observations
// Phase 271 — Analysis Citation System integrated
// ============================================================================

import { useState } from 'react';
import { FileText, Clock, Link2, Highlighter } from 'lucide-react';

interface EvidenceReference {
  id: string;
  evidenceId: string;
  evidenceName: string;
  pageOrTimestamp: string;
  excerpt: string;
  observationId?: string;
}

interface AnalysisCitation {
  observationId: string;
  observationNumber: number;
  description: string;
  citations: {
    source: string;
    reference: string;
  }[];
}

const MOCK_REFERENCES: EvidenceReference[] = [
  { id: 'ref1', evidenceId: 'ev-1', evidenceName: 'Police Report #2024-1847', pageOrTimestamp: 'Page 3, Paragraph 6', excerpt: '...officer observed suspect begin to flee on foot...', observationId: 'obs-14' },
  { id: 'ref2', evidenceId: 'ev-2', evidenceName: 'Bodycam 2 - Officer Chen', pageOrTimestamp: '00:04:22', excerpt: '...suspect appears stationary with hands visible...', observationId: 'obs-14' },
  { id: 'ref3', evidenceId: 'ev-3', evidenceName: 'Dispatch Log', pageOrTimestamp: '14:33:05', excerpt: 'Unit 42 reports suspect fleeing eastbound', observationId: 'obs-14' },
];

const MOCK_CITATIONS: AnalysisCitation[] = [
  {
    observationId: 'obs-14',
    observationNumber: 14,
    description: 'Possible narrative discrepancy between officer report and bodycam footage regarding suspect movement.',
    citations: [
      { source: 'Bodycam 2', reference: '00:04:22' },
      { source: 'Officer Report', reference: 'paragraph 6' },
      { source: 'Dispatch Log', reference: '14:33:05 timestamp' },
    ],
  },
  {
    observationId: 'obs-15',
    observationNumber: 15,
    description: 'Timeline suggests backup was requested after force application, contrary to report narrative.',
    citations: [
      { source: 'Dispatch Log', reference: '14:35:15' },
      { source: 'Officer Report', reference: 'page 5, paragraph 2' },
      { source: 'Bodycam 1', reference: '00:06:30' },
    ],
  },
];

export function ClientEvidenceViewer() {
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Highlighter size={18} className="text-blue-600" />
        Evidence Viewer with Citations
      </h3>

      {/* Analysis Citations (Phase 271) */}
      <div className="space-y-3">
        {MOCK_CITATIONS.map((citation) => (
          <div
            key={citation.observationId}
            className={`p-4 rounded-lg border transition-all cursor-pointer ${
              selectedCitation === citation.observationId
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-blue-300'
            }`}
            onClick={() => setSelectedCitation(selectedCitation === citation.observationId ? null : citation.observationId)}
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                #{citation.observationNumber}
              </span>
              <div className="flex-1">
                <p className="text-sm text-gray-900 font-medium">{citation.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {citation.citations.map((cite, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                      <Link2 size={10} />
                      {cite.source} — {cite.reference}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Expanded evidence references */}
            {selectedCitation === citation.observationId && (
              <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                <h4 className="text-xs font-semibold text-blue-700">LINKED EVIDENCE</h4>
                {MOCK_REFERENCES.filter((r) => r.observationId === citation.observationId).map((ref) => (
                  <div key={ref.id} className="flex items-start gap-2 p-2 bg-white rounded border border-blue-100">
                    <FileText size={14} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-gray-900">{ref.evidenceName}</p>
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <Clock size={10} /> {ref.pageOrTimestamp}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 italic">&ldquo;{ref.excerpt}&rdquo;</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
