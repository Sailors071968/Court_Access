// ============================================================================
// Program 139 — Cinematic marketing video render pipeline.
// Records the public /reel-player cinematic sequence with Playwright (WebM),
// then uses ffmpeg to produce finished MP4 (Instagram Reel / TikTok / YouTube
// Shorts / Presentation), WebM, animated GIF preview, poster PNG, and thumbnail
// PNG. Output: reports/marketing/videos/.
// ============================================================================

import { chromium } from 'playwright';
import { mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.OUT || 'reports/marketing/videos';
const TMP = join(OUT, '_tmp');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const REEL_MS = 42000; // total sequence length
const WAIT_MS = REEL_MS + 3000;

function ff(args) {
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
}

async function record(format, size) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: size, recordVideo: { dir: TMP, size } });
  const page = await context.newPage();
  await page.goto(`${BASE}/reel-player?format=${format}&autoplay=1`, { waitUntil: 'networkidle' });
  // Wait for the sequence to finish (or the safety timeout).
  await page.waitForFunction(() => (window).__reelDone === true, { timeout: WAIT_MS }).catch(() => {});
  await page.waitForTimeout(800);
  const video = page.video();
  const tmpPath = await video.path();
  await context.close(); // finalizes the webm
  await browser.close();
  return tmpPath;
}

function derive(masterWebm, baseName, { poster = true, thumb = true, gif = true } = {}) {
  const mp4 = join(OUT, `${baseName}.mp4`);
  ff(['-i', masterWebm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', mp4]);
  if (poster) ff(['-ss', '1', '-i', masterWebm, '-frames:v', '1', join(OUT, `${baseName}-poster.png`)]);
  if (thumb) ff(['-ss', '5', '-i', masterWebm, '-frames:v', '1', '-vf', 'scale=640:-1', join(OUT, `${baseName}-thumbnail.png`)]);
  if (gif) ff(['-i', masterWebm, '-t', '8', '-vf', 'fps=12,scale=480:-1:flags=lanczos', join(OUT, `${baseName}-preview.gif`)]);
  return mp4;
}

async function run() {
  // --- Vertical master (9:16) → Instagram Reel / TikTok / YouTube Shorts ---
  console.log('Recording vertical 1080x1920…');
  const vtmp = await record('vertical', { width: 1080, height: 1920 });
  const vWebm = join(OUT, 'courtaccess-reel-vertical.webm');
  copyFileSync(vtmp, vWebm);
  console.log('Encoding Instagram Reel / TikTok / YouTube Shorts MP4…');
  derive(vWebm, 'instagram-reel', { poster: true, thumb: true, gif: true });
  // TikTok + Shorts share the vertical spec — encode each as its own finished MP4.
  ff(['-i', vWebm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', join(OUT, 'tiktok.mp4')]);
  ff(['-i', vWebm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', join(OUT, 'youtube-shorts.mp4')]);

  // --- Wide master (16:9) → Presentation video ---
  console.log('Recording wide 1920x1080…');
  const wtmp = await record('wide', { width: 1920, height: 1080 });
  const wWebm = join(OUT, 'courtaccess-presentation-wide.webm');
  copyFileSync(wtmp, wWebm);
  console.log('Encoding Presentation MP4…');
  derive(wWebm, 'presentation', { poster: true, thumb: true, gif: false });

  rmSync(TMP, { recursive: true, force: true });
  console.log(`\nDone. Videos in ${OUT}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
