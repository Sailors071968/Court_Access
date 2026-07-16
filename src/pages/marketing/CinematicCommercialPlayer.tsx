// ============================================================================
// Program 142 — Cinematic AI Commercial (render source)
// A premium, auto-playing cinematic advertisement using AI-generated actor
// imagery, cinematic lighting/motion, animated dashboard fly-ins, subtitle
// dialogue, a music placeholder, and a branded CourtAccess.net ending. Public
// route (no auth) so the render pipeline (scripts/program-142-render.mjs) can
// capture it to MP4. Every illustrative scene is labeled ILLUSTRATIVE
// DEMONSTRATION; CourtAccess never claims to determine guilt, guarantee a
// defense, or predict outcomes. Voice-over is intentionally a post-production
// placeholder — dialogue is carried by cinematic subtitles (never fabricated).
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Scale, ShieldCheck, Clock, Boxes, MessageSquareWarning, Search, ListChecks, BookMarked, Music, HelpCircle } from 'lucide-react';

const ATTORNEY_IMG = '/marketing/actors/actor-attorney.png';
const DEFENDANT_IMG = '/marketing/actors/actor-defendant.png';

type Beat =
  | { kind: 'actor'; who: 'attorney' | 'client'; img: string; name: string; lines: string[]; caption: string; weight: number }
  | { kind: 'dashboard'; caption: string; weight: number }
  | { kind: 'ending'; caption: string; weight: number };

const BEATS: Beat[] = [
  { kind: 'actor', who: 'attorney', img: ATTORNEY_IMG, name: 'Defense Attorney', lines: ['The prosecutor is offering', 'fourteen years.', 'Trial begins in two weeks.'], caption: 'Attorney: “The prosecutor is offering fourteen years. Trial begins in two weeks.”', weight: 5 },
  { kind: 'actor', who: 'client', img: DEFENDANT_IMG, name: 'Defendant', lines: ['I’ve been reviewing my case', 'in CourtAccess.', 'It highlighted several issues', 'I’d like to discuss.'], caption: 'Client: “I’ve been reviewing my case in CourtAccess — it highlighted several issues.”', weight: 5.5 },
  { kind: 'dashboard', caption: 'CourtAccess organizes evidence-backed information into clear issues for attorney review.', weight: 7 },
  { kind: 'actor', who: 'attorney', img: ATTORNEY_IMG, name: 'Defense Attorney', lines: ['These are important issues.', 'Where did you find', 'all of this?'], caption: 'Attorney: “These are important issues. Where did you find all of this?”', weight: 4.5 },
  { kind: 'actor', who: 'client', img: DEFENDANT_IMG, name: 'Defendant', lines: ['CourtAccess organized everything', 'and linked it directly', 'to the supporting records.'], caption: 'Client: “CourtAccess linked every issue directly to the supporting records.”', weight: 5 },
  { kind: 'actor', who: 'attorney', img: ATTORNEY_IMG, name: 'Defense Attorney', lines: ['We should investigate', 'these issues before', 'making any decisions.'], caption: 'Attorney: “We should investigate these issues before making any decisions.”', weight: 4.5 },
  { kind: 'ending', caption: 'CourtAccess.net — Evidence. Intelligence. Defense.', weight: 4 },
];

const FINDINGS = [
  { icon: Search, label: 'Potential surveillance opportunities' },
  { icon: Boxes, label: 'Evidence handling review' },
  { icon: MessageSquareWarning, label: 'Statement inconsistencies' },
  { icon: Clock, label: 'Timeline discrepancies' },
  { icon: ListChecks, label: 'CALCRIM element review' },
  { icon: BookMarked, label: 'Supporting citations' },
];

const STYLE = `
@keyframes cmFade { from { opacity:0 } to { opacity:1 } }
@keyframes cmKen { from { transform: scale(1.02) } to { transform: scale(1.12) } }
@keyframes cmRise { from { opacity:0; transform: translateY(40px) } to { opacity:1; transform:none } }
@keyframes cmFlyIn { 0% { opacity:0; transform: translateY(60px) scale(.9) } 60% { opacity:1 } 100% { opacity:1; transform:none } }
@keyframes cmGlow { 0%,100% { opacity:.35 } 50% { opacity:.75 } }
@keyframes cmSweep { 0% { transform: translateX(-120%) } 100% { transform: translateX(220%) } }
@keyframes cmPulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.06) } }
.cm-fade{ animation: cmFade .9s ease-out both }
.cm-ken{ animation: cmKen 7s ease-out both }
.cm-rise{ animation: cmRise .8s cubic-bezier(.2,.7,.2,1) both }
.cm-fly{ animation: cmFlyIn .8s cubic-bezier(.2,.7,.2,1) both }
.cm-glow{ animation: cmGlow 3.5s ease-in-out infinite }
.cm-pulse{ animation: cmPulse 3s ease-in-out infinite }
`;

export function CinematicCommercialPlayer() {
  const [params] = useSearchParams();
  const format = (params.get('format') || 'vertical') as 'vertical' | 'wide' | 'square';
  const durationMs = Math.max(20000, (parseInt(params.get('duration') || '35', 10) || 35) * 1000);
  const autoplay = params.get('autoplay') !== '0';
  const loop = params.get('loop') === '1';
  const wide = format === 'wide';

  const timings = useMemo(() => {
    const totalWeight = BEATS.reduce((s, b) => s + b.weight, 0);
    return BEATS.map((b) => Math.round((b.weight / totalWeight) * durationMs));
  }, [durationMs]);

  const [beat, setBeat] = useState(0);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!autoplay || started.current) return;
    started.current = true;
    let i = 0; let cancelled = false;
    const step = () => {
      if (cancelled) return;
      if (i >= BEATS.length) {
        if (loop) { i = 0; setBeat(0); setTimeout(step, timings[0]); return; }
        setDone(true); (window as unknown as { __reelDone?: boolean }).__reelDone = true; return;
      }
      setBeat(i); const ms = timings[i]; i += 1; setTimeout(step, ms);
    };
    step();
    return () => { cancelled = true; };
  }, [autoplay, loop, timings]);

  const b = BEATS[Math.min(beat, BEATS.length - 1)];
  const elapsed = timings.slice(0, beat).reduce((s, x) => s + x, 0);
  const total = timings.reduce((s, x) => s + x, 0);
  const progress = Math.min(100, Math.round(((elapsed + (done ? timings[beat] : 0)) / total) * 100));

  return (
    <div
      data-reel-done={done ? 'true' : 'false'}
      className="relative w-screen h-screen overflow-hidden bg-black text-white"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <style>{STYLE}</style>

      {/* Cinematic background: depth-of-field gradient + moving light */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-black" />
      <div className="cm-glow absolute -right-32 -top-32 h-[38rem] w-[38rem] rounded-full bg-indigo-600/25 blur-3xl" />
      <div className="cm-glow absolute -bottom-40 -left-24 h-[38rem] w-[38rem] rounded-full bg-violet-600/20 blur-3xl" />

      {/* Letterbox bars */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[6%] bg-black/70 z-30" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[6%] bg-black/70 z-30" />

      {/* Persistent labels */}
      <div className="absolute inset-x-0 top-[7%] z-30 flex items-center justify-between px-8">
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300/90">Illustrative Demonstration</div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-indigo-100"><Music size={12} /> music placeholder</div>
      </div>
      <div className="absolute inset-x-0 top-[6%] z-30 h-1 bg-white/10"><div className="h-full bg-gradient-to-r from-indigo-400 to-violet-400" style={{ width: `${progress}%`, transition: 'width .5s linear' }} /></div>

      {/* Scene */}
      <div key={beat} className={`absolute inset-0 z-10 flex flex-col items-center justify-center ${wide ? 'px-24' : 'px-8'}`}>
        {b.kind === 'actor' && (
          <div className="cm-fade flex w-full flex-col items-center">
            {/* Cinematic actor frame with vignette + glow */}
            <div className="relative overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10" style={{ width: wide ? 420 : 360, height: wide ? 520 : 460 }}>
              <img src={b.img} alt={b.name} className="cm-ken h-full w-full object-cover" />
              <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 120px 40px rgba(0,0,0,0.55)' }} />
              {/* light sweep */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="cm-glow absolute -inset-y-10 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent" /></div>
              {/* lower-third name plate */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-indigo-200">{b.name}</div>
              </div>
            </div>
            <div className="cm-rise mt-6 max-w-2xl text-center">
              {b.lines.map((l, i) => <p key={i} className={`font-bold leading-tight ${wide ? 'text-4xl' : 'text-3xl'}`}>{l}</p>)}
            </div>
          </div>
        )}

        {b.kind === 'dashboard' && (
          <div className="w-full">
            <h2 className={`mb-6 text-center font-black ${wide ? 'text-4xl' : 'text-3xl'}`}>What CourtAccess found</h2>
            <div className={`mx-auto grid gap-4 ${wide ? 'max-w-4xl grid-cols-3' : format === 'square' ? 'max-w-2xl grid-cols-2' : 'max-w-lg grid-cols-1'}`}>
              {FINDINGS.map((f, i) => {
                const Ic = f.icon;
                return (
                  <div key={f.label} className="cm-fly rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur" style={{ animationDelay: `${i * 0.22}s` }}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/40"><Ic size={22} /></div>
                      <div className={`font-semibold ${wide ? 'text-lg' : 'text-base'}`}>{f.label}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-200"><span className="rounded-full bg-amber-400/20 px-2 py-0.5">Illustrative</span></div>
                  </div>
                );
              })}
            </div>
            <div className="cm-fly mt-5 flex items-center justify-center gap-2 text-sm text-indigo-200" style={{ animationDelay: '1.4s' }}>
              <HelpCircle size={14} /> UNKNOWN shown where the record is insufficient · every finding links to supporting records
            </div>
          </div>
        )}

        {b.kind === 'ending' && (
          <div className="cm-fade text-center">
            <div className="cm-pulse mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-2xl"><Scale size={56} /></div>
            <h1 className={`font-black tracking-tight ${wide ? 'text-7xl' : 'text-6xl'}`}>CourtAccess<span className="text-indigo-300">.net</span></h1>
            <p className={`mt-4 font-semibold text-indigo-200 ${wide ? 'text-3xl' : 'text-2xl'}`}>Evidence. Intelligence. Defense.</p>
            <p className={`mt-2 text-indigo-300/80 ${wide ? 'text-xl' : 'text-lg'}`}>Know your case. Help your attorney.</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-indigo-100"><ShieldCheck size={13} /> Organizes evidence-backed information for attorney review</div>
          </div>
        )}
      </div>

      {/* Subtitle track */}
      {b.kind !== 'ending' && (
        <div className="absolute inset-x-0 bottom-[8%] z-30 px-8">
          <div className="mx-auto max-w-3xl rounded-xl bg-black/60 px-5 py-3 text-center backdrop-blur">
            <p className={`font-medium ${wide ? 'text-xl' : 'text-base'}`}>{b.caption}</p>
          </div>
        </div>
      )}
    </div>
  );
}
