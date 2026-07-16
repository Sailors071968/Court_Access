// ============================================================================
// Program 142 — Cinematic AI commercial render pipeline.
// Records the public /commercial cinematic advertisement with Playwright (WebM)
// across formats/durations, then uses ffmpeg to produce all required finished
// MP4s: Instagram Reel (30s + 45s), YouTube Short, TikTok, 16:9 presentation,
// 1080p master, 4K master (upscaled), vertical 9:16, square 1:1 — plus posters
// and thumbnails. Output: reports/marketing/commercial/.
// ============================================================================

import { chromium } from 'playwright';
import { mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.OUT || 'reports/marketing/commercial';
const TMP = join(OUT, '_tmp');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

function ff(args) { execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' }); }

async function record(format, size, durationSec) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: size, recordVideo: { dir: TMP, size } });
  const page = await context.newPage();
  await page.goto(`${BASE}/commercial?format=${format}&duration=${durationSec}&autoplay=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => (window).__reelDone === true, { timeout: durationSec * 1000 + 6000 }).catch(() => {});
  await page.waitForTimeout(800);
  const tmpPath = await page.video().path();
  await context.close();
  await browser.close();
  return tmpPath;
}

function toMp4(webm, out, extraVf) {
  const args = ['-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30'];
  if (extraVf) args.push('-vf', extraVf);
  args.push(out);
  ff(args);
}
function poster(webm, out, ss = 1) { ff(['-ss', String(ss), '-i', webm, '-frames:v', '1', out]); }
function thumb(webm, out, ss = 3) { ff(['-ss', String(ss), '-i', webm, '-frames:v', '1', '-vf', 'scale=640:-1', out]); }

async function run() {
  // Masters.
  console.log('Recording vertical 9:16 @30s…');
  const v30 = join(OUT, 'master-vertical-30s.webm'); copyFileSync(await record('vertical', { width: 1080, height: 1920 }, 30), v30);
  console.log('Recording vertical 9:16 @45s…');
  const v45 = join(OUT, 'master-vertical-45s.webm'); copyFileSync(await record('vertical', { width: 1080, height: 1920 }, 45), v45);
  console.log('Recording wide 16:9 @45s…');
  const w45 = join(OUT, 'master-wide-45s.webm'); copyFileSync(await record('wide', { width: 1920, height: 1080 }, 45), w45);
  console.log('Recording square 1:1 @30s…');
  const s30 = join(OUT, 'master-square-30s.webm'); copyFileSync(await record('square', { width: 1080, height: 1080 }, 30), s30);

  // Derive finished MP4s.
  console.log('Encoding finished MP4s…');
  toMp4(v30, join(OUT, 'instagram-reel-30s.mp4'));
  toMp4(v45, join(OUT, 'instagram-reel-45s.mp4'));
  toMp4(v30, join(OUT, 'youtube-short.mp4'));
  toMp4(v30, join(OUT, 'tiktok.mp4'));
  toMp4(v30, join(OUT, 'vertical-9x16.mp4'));
  toMp4(s30, join(OUT, 'square-1x1.mp4'));
  toMp4(w45, join(OUT, 'presentation-16x9.mp4'));
  toMp4(w45, join(OUT, 'master-1080p.mp4'));
  toMp4(w45, join(OUT, 'master-4k.mp4'), 'scale=3840:2160:flags=lanczos'); // upscaled 4K master

  // Posters + thumbnails.
  poster(v30, join(OUT, 'instagram-reel-poster.png'), 2);
  thumb(v30, join(OUT, 'instagram-reel-thumbnail.png'), 4);
  poster(w45, join(OUT, 'presentation-poster.png'), 2);
  thumb(w45, join(OUT, 'presentation-thumbnail.png'), 4);
  poster(v30, join(OUT, 'ending-brand-frame.png'), 28); // branded ending frame

  rmSync(TMP, { recursive: true, force: true });
  console.log(`\nDone. Commercial videos in ${OUT}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
