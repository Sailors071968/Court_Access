// =============================================================================
// CourtAccess — Document Reader (Program 29)
// Beautiful, low-distraction reading pane. Premium typography.
// Reusable across the document workspace and side-by-side compare.
// =============================================================================

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Highlighter, Bookmark } from 'lucide-react';
import { MediaPreview } from '../evidence/MediaPreview';
import { OcrStatus } from '../indicators/indicators';
import { cn } from '../../lib/utils';
import type { ApiEvidence } from '../../services/caseApi';

interface DocumentReaderProps {
  evidence: ApiEvidence;
  /** Extracted OCR text, when available. */
  extractedText?: string;
  url?: string;
  onAnnotate?: () => void;
  onBookmark?: () => void;
  className?: string;
}

function ocrStateFromStatus(status: string): 'queued' | 'processing' | 'complete' | 'failed' {
  if (status === 'analyzed') return 'complete';
  if (status === 'processing') return 'processing';
  if (status === 'failed') return 'failed';
  return 'queued';
}

export function DocumentReader({ evidence, extractedText, url, onAnnotate, onBookmark, className }: DocumentReaderProps) {
  const [page, setPage] = useState(1);
  const totalPages = evidence.pageCount ?? evidence.normalizedPageCount ?? 1;

  return (
    <div className={cn('flex flex-col h-full bg-navy-900/40', className)}>
      {/* Minimal reader toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium text-white truncate">{evidence.fileName}</p>
          <OcrStatus state={ocrStateFromStatus(evidence.processingStatus)} />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onAnnotate} className="p-1.5 rounded-lg text-slate-400 hover:text-gold-light hover:bg-white/5" title="Annotate" aria-label="Annotate"><Highlighter size={15} /></button>
          <button onClick={onBookmark} className="p-1.5 rounded-lg text-slate-400 hover:text-gold-light hover:bg-white/5" title="Bookmark" aria-label="Bookmark"><Bookmark size={15} /></button>
        </div>
      </div>

      {/* Reading surface */}
      <div className="flex-1 overflow-y-auto p-6">
        {extractedText ? (
          <article className="mx-auto max-w-prose text-slate-200 leading-8 text-[15px] font-serif whitespace-pre-wrap">
            {extractedText}
          </article>
        ) : (
          <div className="mx-auto max-w-2xl">
            <MediaPreview
              fileName={evidence.fileName}
              mimeType={evidence.mimeType}
              url={url}
              pageCount={evidence.pageCount}
              duration={evidence.duration}
              className="min-h-[24rem]"
            />
            {evidence.processingStatus !== 'analyzed' && (
              <p className="text-center text-xs text-slate-400 mt-4">
                Extracted text appears here once OCR &amp; AI extraction complete.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Page nav */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 px-4 py-2.5 border-t border-white/10">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="text-xs text-slate-400 tabular-nums">Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}
