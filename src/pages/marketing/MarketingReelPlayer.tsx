// ============================================================================
// Program 139 — Cinematic Marketing Reel Player
// A self-contained, auto-playing cinematic sequence used as the SOURCE for
// rendered marketing videos (MP4/WebM/GIF via the Playwright + ffmpeg pipeline
// in scripts/program-139-render.mjs). Public route — no auth required so the
// render pipeline is deterministic. Every frame shows a permanent ILLUSTRATIVE
// DEMONSTRATION label. CourtAccess never determines guilt, guarantees a defense
// or outcome, or recommends litigation strategy; illustrative content is clearly
// labeled and UNKNOWN is shown where evidence is insufficient.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Scale, ShieldCheck, Clock, FileText, HelpCircle, Music, Sparkles, Gavel } from 'lucide-react';

type SpeakerBeat = {
  kind: 'title' | 'line' | 'cards' | 'trace' | 'closing';
  speaker?: 'attorney' | 'client';
  caption: string;
  lines?: string[];
  ms: number;
};

const BEATS: SpeakerBeat[] = [
  { kind: 'title', caption: 'CourtAccess — Criminal Litigation Intelligence', ms: 4000 },
  { kind: 'line', speaker: 'attorney', lines: ['The prosecutor is offering fourteen years.', 'Trial begins in two weeks.'], caption: 'Attorney: “Fourteen years on the table. Trial in two weeks.”', ms: 5000 },
  { kind: 'line', speaker: 'client', lines: ['I’ve been reviewing my case', 'in CourtAccess.'], caption: 'Client: “I’ve been reviewing my case in CourtAccess.”', ms: 5000 },
  { kind: 'cards', caption: 'CourtAccess organizes repository-backed issues for attorney review.', ms: 6500 },
  { kind: 'trace', caption: 'Every issue links directly to the supporting records — UNKNOWN where evidence is insufficient.', ms: 6500 },
  { kind: 'line', speaker: 'attorney', lines: ['Where did you get all of this?'], caption: 'Attorney: “Where did you get all of this?”', ms: 4500 },
  { kind: 'line', speaker: 'client', lines: ['From CourtAccess.', 'It linked every issue to the records.'], caption: 'Client: “It linked every issue directly to the supporting records.”', ms: 5000 },
  { kind: 'closing', caption: 'CourtAccess — organize repository-backed litigation intelligence for attorney review.', ms: 5500 },
];

const OPP = [
  { icon: Clock, cat: 'Timeline', title: 'Timeline discrepancies', conf: 'MEDIUM' },
  { icon: Scale, cat: 'Evidence', title: 'Evidence handling questions', conf: 'HIGH' },
  { icon: Gavel, cat: 'CALCRIM', title: 'Unproven element — PEN §211', conf: 'HIGH' },
  { icon: ShieldCheck, cat: 'Investigation', title: 'Surveillance worth requesting', conf: 'MEDIUM' },
];

const TRACE = [
  { label: 'Police report', value: 'Page 3, ¶2', unknown: false },
  { label: 'Transcript', value: 'Page 14, Line 7', unknown: false },
  { label: 'Body camera', value: 't = 00:03:12', unknown: false },
  { label: 'Medical records', value: 'UNKNOWN', unknown: true },
];

const STYLE = `
@keyframes reelFadeUp { from { opacity:0; transform: translateY(24px);} to {opacity:1; transform:none;} }
@keyframes reelPop { 0%{opacity:0; transform:scale(.9);} 60%{opacity:1;} 100%{opacity:1; transform:scale(1);} }
@keyframes reelKen { from { transform: scale(1);} to { transform: scale(1.08);} }
@keyframes reelDraw { from { width:0;} to { width:100%;} }
@keyframes reelFloat { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-8px);} }
@keyframes reelGlow { 0%,100%{ opacity:.35;} 50%{ opacity:.7;} }
.reel-fadeup{ animation: reelFadeUp .7s ease-out both;}
.reel-pop{ animation: reelPop .6s ease-out both;}
.reel-ken{ animation: reelKen 7s ease-out both;}
.reel-float{ animation: reelFloat 3.5s ease-in-out infinite;}
.reel-glow{ animation: reelGlow 3s ease-in-out infinite;}
`;

export function MarketingReelPlayer() {
  const [params] = useSearchParams();
  const wide = (params.get('format') || 'vertical') === 'wide';
  const autoplay = params.get('autoplay') !== '0';
  const loop = params.get('loop') === '1';
  const [beat, setBeat] = useState(0);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  const total = useMemo(() => BEATS.reduce((s, b) => s + b.ms, 0), []);

  useEffect(() => {
    if (!autoplay || startedRef.current) return;
    startedRef.current = true;
    let i = 0;
    let cancelled = false;
    const next = () => {
      if (cancelled) return;
      if (i >= BEATS.length) {
        if (loop) { i = 0; setBeat(0); setTimeout(next, BEATS[0].ms); return; }
        setDone(true);
        (window as unknown as { __reelDone?: boolean }).__reelDone = true;
        return;
      }
      setBeat(i);
      const ms = BEATS[i].ms;
      i += 1;
      setTimeout(next, ms);
    };
    next();
    return () => { cancelled = true; };
  }, [autoplay, loop]);

  const b = BEATS[Math.min(beat, BEATS.length - 1)];
  const elapsed = BEATS.slice(0, beat).reduce((s, x) => s + x.ms, 0);
  const progress = Math.min(100, Math.round(((elapsed + (done ? b.ms : 0)) / total) * 100));

  return (
    <div
      data-reel-done={done ? 'true' : 'false'}
      className={`relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white ${wide ? 'w-screen h-screen' : 'w-screen h-screen'}`}
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <style>{STYLE}</style>
      {/* Ambient glow */}
      <div className="reel-glow absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />
      <div className="reel-glow absolute -bottom-28 -left-24 h-96 w-96 rounded-full bg-violet-500/30 blur-3xl" />

      {/* Permanent illustrative label + progress + music placeholder */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300"><Sparkles size={14} /> Illustrative Demonstration</div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-indigo-100"><Music size={12} /> music placeholder</div>
      </div>
      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/10">
        <div className="h-full bg-gradient-to-r from-indigo-400 to-violet-400" style={{ width: `${progress}%`, transition: 'width .5s linear' }} />
      </div>

      {/* Brand watermark */}
      <div className="absolute bottom-24 left-0 right-0 z-10 text-center text-sm font-semibold tracking-wide text-indigo-200/80">CourtAccess</div>

      {/* Scene */}
      <div key={beat} className={`absolute inset-0 z-10 flex flex-col items-center justify-center ${wide ? 'px-24' : 'px-8'}`}>
        {b.kind === 'title' && (
          <div className="reel-fadeup text-center">
            <div className="reel-float mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-2xl"><Scale size={48} /></div>
            <h1 className={`font-black leading-tight ${wide ? 'text-6xl' : 'text-5xl'}`}>CourtAccess</h1>
            <p className={`mt-3 font-medium text-indigo-200 ${wide ? 'text-2xl' : 'text-xl'}`}>Criminal Litigation Intelligence</p>
          </div>
        )}

        {b.kind === 'line' && (
          <div className={`reel-fadeup w-full ${b.speaker === 'attorney' ? 'text-left' : 'text-right'}`}>
            <div className={`inline-block max-w-[90%] rounded-3xl px-8 py-6 backdrop-blur ${b.speaker === 'attorney' ? 'bg-white/10' : 'bg-indigo-500/25'}`}>
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-200">{b.speaker === 'attorney' ? 'Attorney' : 'Client'}</div>
              {b.lines?.map((l, i) => <p key={i} className={`font-bold leading-snug ${wide ? 'text-5xl' : 'text-4xl'}`}>{l}</p>)}
            </div>
          </div>
        )}

        {b.kind === 'cards' && (
          <div className="w-full reel-ken">
            <h2 className={`mb-5 text-center font-bold ${wide ? 'text-4xl' : 'text-3xl'}`}>Top Defense Opportunities</h2>
            <div className={`mx-auto grid gap-4 ${wide ? 'max-w-4xl grid-cols-2' : 'max-w-xl grid-cols-1'}`}>
              {OPP.map((o, i) => {
                const Ic = o.icon;
                return (
                  <div key={o.title} className="reel-pop rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur" style={{ animationDelay: `${i * 0.25}s` }}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/40"><Ic size={22} /></div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-200">{o.cat}</div>
                        <div className={`font-semibold ${wide ? 'text-xl' : 'text-lg'}`}>{o.title}</div>
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-[11px] font-semibold text-amber-200">Illustrative · confidence {o.conf}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {b.kind === 'trace' && (
          <div className="w-full">
            <h2 className={`mb-5 text-center font-bold ${wide ? 'text-4xl' : 'text-3xl'}`}>Traceable to the record</h2>
            <div className={`mx-auto flex flex-col gap-3 ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
              {TRACE.map((t, i) => (
                <div key={t.label} className={`reel-fadeup flex items-center justify-between rounded-xl border px-5 py-4 backdrop-blur ${t.unknown ? 'border-white/20 bg-white/5' : 'border-indigo-300/30 bg-indigo-500/15'}`} style={{ animationDelay: `${i * 0.3}s` }}>
                  <span className="flex items-center gap-2 text-indigo-100">{t.unknown ? <HelpCircle size={18} /> : <FileText size={18} />}<span className={`font-semibold ${wide ? 'text-xl' : 'text-lg'}`}>{t.label}</span></span>
                  <span className={`font-mono ${t.unknown ? 'text-amber-300' : 'text-white'} ${wide ? 'text-lg' : 'text-base'}`}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {b.kind === 'closing' && (
          <div className="reel-fadeup text-center">
            <div className="reel-float mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-400 to-violet-500 shadow-2xl"><ShieldCheck size={40} /></div>
            <h1 className={`font-black leading-tight ${wide ? 'text-5xl' : 'text-4xl'}`}>Know your case.</h1>
            <p className={`mx-auto mt-4 max-w-xl text-indigo-200 ${wide ? 'text-2xl' : 'text-lg'}`}>CourtAccess organizes repository-backed litigation intelligence into clear issues for attorney review.</p>
            <p className="mx-auto mt-4 max-w-lg text-xs text-amber-300">Illustrative demonstration. CourtAccess does not determine guilt, guarantee any defense or outcome, or recommend litigation strategy.</p>
          </div>
        )}
      </div>

      {/* Subtitle caption track */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-8 pb-10">
        <div className="mx-auto max-w-3xl rounded-xl bg-black/50 px-5 py-3 text-center backdrop-blur">
          <p className={`font-medium text-white ${wide ? 'text-xl' : 'text-base'}`}>{b.caption}</p>
        </div>
      </div>
    </div>
  );
}
