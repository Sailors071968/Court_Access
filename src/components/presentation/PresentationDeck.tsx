// =============================================================================
// CourtAccess — Presentation Deck framework (Program 33)
// Reusable full-screen deck: slides, keyboard nav, audience modes, print, export.
// Courtroom-focused communication built on the unified dark design language.
// =============================================================================

import { useEffect, useState, type ReactNode } from 'react';
import { X, ChevronLeft, ChevronRight, Printer, Download, Maximize } from 'lucide-react';
import { cn } from '../../lib/utils';

export type AudienceMode = 'juror' | 'judge' | 'client';

export interface Slide {
  id: string;
  title: string;
  subtitle?: string;
  /** Optional per-audience explanation shown beneath the title. */
  audienceNote?: Partial<Record<AudienceMode, string>>;
  content: ReactNode;
}

interface PresentationDeckProps {
  title: string;
  slides: Slide[];
  open: boolean;
  onClose: () => void;
  onExport?: () => void;
}

const AUDIENCE_LABEL: Record<AudienceMode, string> = {
  juror: 'Juror',
  judge: 'Judge',
  client: 'Client',
};

export function PresentationDeck({ title, slides, open, onClose, onExport }: PresentationDeckProps) {
  const [index, setIndex] = useState(0);
  const [audience, setAudience] = useState<AudienceMode>('juror');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setIndex((i) => Math.min(i + 1, slides.length - 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, slides.length, onClose]);

  if (!open) return null;
  const slide = slides[index];

  return (
    <div className="fixed inset-0 z-[90] ca-gradient-hero flex flex-col animate-fade-in">
      {/* Chrome */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 print:hidden">
        <p className="text-sm font-semibold text-gold-light uppercase tracking-wide">{title}</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 p-1">
            {(Object.keys(AUDIENCE_LABEL) as AudienceMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setAudience(m)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  audience === m ? 'bg-gold/10 text-gold-light' : 'text-slate-400 hover:text-white',
                )}
              >
                {AUDIENCE_LABEL[m]}
              </button>
            ))}
          </div>
          <button onClick={() => window.print()} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" title="Print"><Printer size={16} /></button>
          {onExport && <button onClick={onExport} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" title="Export"><Download size={16} /></button>}
          <button onClick={() => document.documentElement.requestFullscreen?.()} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" title="Full screen"><Maximize size={16} /></button>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" title="Exit"><X size={18} /></button>
        </div>
      </div>

      {/* Slide */}
      <div className="flex-1 flex items-center justify-center px-8 overflow-hidden">
        <div className="w-full max-w-5xl animate-slide-up">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-light mb-2">{slide.subtitle}</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4 font-serif">{slide.title}</h2>
          {slide.audienceNote?.[audience] && (
            <p className="text-lg text-slate-300 mb-6 max-w-3xl">{slide.audienceNote[audience]}</p>
          )}
          <div className="mt-6">{slide.content}</div>
        </div>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 print:hidden">
        <button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white disabled:opacity-40"><ChevronLeft size={16} /> Previous</button>
        <div className="flex items-center gap-1.5">
          {slides.map((s, i) => (
            <button key={s.id} onClick={() => setIndex(i)} className={cn('w-2 h-2 rounded-full transition-colors', i === index ? 'bg-gold-light' : 'bg-white/20 hover:bg-white/40')} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
        <button onClick={() => setIndex(Math.min(slides.length - 1, index + 1))} disabled={index === slides.length - 1} className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white disabled:opacity-40">Next <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}
