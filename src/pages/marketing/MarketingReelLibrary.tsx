// ============================================================================
// Program 141 — Marketing Reel Library (PUBLIC)
// Publicly viewable gallery of the finished marketing videos rendered in
// Program 139. Served directly from the site's static assets (/marketing/*) —
// no repository access or authentication required. Every asset is a
// permanently-labeled ILLUSTRATIVE DEMONSTRATION.
// ============================================================================

import { Film, Download, Sparkles, Instagram, Youtube, Music2, Presentation } from 'lucide-react';

interface Reel {
  id: string; title: string; platform: string; icon: typeof Film; src: string; poster: string; aspect: string; download: string;
}

const REELS: Reel[] = [
  { id: 'instagram', title: 'Instagram Reel', platform: 'Instagram · 9:16', icon: Instagram, src: '/marketing/instagram-reel.mp4', poster: '/marketing/instagram-reel-poster.png', aspect: '9 / 16', download: '/marketing/instagram-reel.mp4' },
  { id: 'tiktok', title: 'TikTok', platform: 'TikTok · 9:16', icon: Music2, src: '/marketing/tiktok.mp4', poster: '/marketing/instagram-reel-poster.png', aspect: '9 / 16', download: '/marketing/tiktok.mp4' },
  { id: 'youtube', title: 'YouTube Short', platform: 'YouTube Shorts · 9:16', icon: Youtube, src: '/marketing/youtube-shorts.mp4', poster: '/marketing/instagram-reel-poster.png', aspect: '9 / 16', download: '/marketing/youtube-shorts.mp4' },
  { id: 'presentation', title: 'Presentation Video', platform: 'Law firm / investor · 16:9', icon: Presentation, src: '/marketing/presentation.mp4', poster: '/marketing/presentation-poster.png', aspect: '16 / 9', download: '/marketing/presentation.mp4' },
];

export function MarketingReelLibrary() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300"><Sparkles size={14} /> CourtAccess Marketing</div>
        <h1 className="mt-2 text-4xl font-black">Marketing Reel Library</h1>
        <p className="mt-2 max-w-2xl text-indigo-200">Finished, ready-to-post videos for Instagram, TikTok, YouTube Shorts, and presentations. Every video is an <strong>Illustrative Demonstration</strong> and never determines guilt, guarantees a defense or outcome, or recommends litigation strategy.</p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-300">
          <Film size={13} /> Illustrative Demonstration
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {REELS.map((r) => {
            const RIcon = r.icon;
            const vertical = r.aspect === '9 / 16';
            return (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold"><RIcon size={16} className="text-indigo-300" /> {r.title}</div>
                  <a href={r.download} download className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20"><Download size={12} /> MP4</a>
                </div>
                <div className={`mt-3 overflow-hidden rounded-xl bg-black ${vertical ? 'mx-auto' : ''}`} style={vertical ? { maxWidth: 260 } : undefined}>
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    poster={r.poster}
                    src={r.src}
                    style={{ aspectRatio: r.aspect, width: '100%', display: 'block' }}
                  />
                </div>
                <div className="mt-2 text-xs text-indigo-200">{r.platform}</div>
              </div>
            );
          })}
        </div>

        {/* Poster / thumbnail assets */}
        <h2 className="mt-12 text-2xl font-bold">Poster &amp; Thumbnail Assets</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Reel poster', src: '/marketing/instagram-reel-poster.png' },
            { label: 'Reel thumbnail', src: '/marketing/instagram-reel-thumbnail.png' },
            { label: 'Presentation poster', src: '/marketing/presentation-poster.png' },
            { label: 'Presentation thumbnail', src: '/marketing/presentation-thumbnail.png' },
          ].map((a) => (
            <a key={a.label} href={a.src} download className="block rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10">
              <img src={a.src} alt={a.label} className="w-full rounded-lg" />
              <div className="mt-2 flex items-center justify-between text-xs text-indigo-200">{a.label}<Download size={12} /></div>
            </a>
          ))}
        </div>

        <div className="mt-6">
          <a href="/marketing/instagram-reel-preview.gif" download className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"><Download size={14} /> Animated GIF preview</a>
        </div>

        <p className="mt-10 text-center text-xs text-indigo-300/70">CourtAccess — Criminal Litigation Intelligence. Illustrative demonstration assets for marketing use.</p>
      </div>
    </div>
  );
}
