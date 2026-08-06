#!/usr/bin/env node
// Program 145, Phase 13 — upload stress.
//
// Measures what the portal actually sustains: increasing payload sizes,
// concurrent uploads, an interrupted transfer resumed, and a very large
// document. Every figure is measured here. Sizes beyond what this environment
// has disk and time for are reported as not exercised rather than extrapolated.

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { Results, req, registerUser, login, API } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('UPLOAD_STRESS', 'Program 145 — Upload Stress');
const WORK = '/tmp/courtaccess-upload-stress';
await rm(WORK, { recursive: true, force: true }).catch(() => {});
await mkdir(WORK, { recursive: true });

const account = await registerUser({ prefix: 'stress-up', defaultRole: 'attorney' });
await prisma.user.update({ where: { id: account.user.userId }, data: { role: 'admin' } });
const session = await login(account.email, account.password);
const token = session.token;

/** Free disk, so the ceiling reported is a fact about this machine. */
async function freeBytes() {
  try {
    const { statfs } = await import('node:fs/promises');
    const s = await statfs(WORK);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
const available = await freeBytes();
console.log(`free disk for staging: ${(available / 1e9).toFixed(1)}GB\n`);

/** Write a file of a given size without holding it in memory. */
async function makeFile(name, bytes) {
  const target = path.join(WORK, name);
  const block = Buffer.alloc(4 * 1024 * 1024, 0x41);
  const out = createWriteStream(target);
  let written = 0;
  while (written < bytes) {
    const take = Math.min(block.length, bytes - written);
    if (!out.write(take === block.length ? block : block.subarray(0, take))) {
      await new Promise((r) => out.once('drain', r));
    }
    written += take;
  }
  await new Promise((r) => out.end(r));
  return target;
}

async function newSession(reference, fileCount, totalBytes) {
  const res = await req('POST', '/api/certification/uploads', {
    token,
    body: { reference, label: `Stress ${reference}`, fileCount, totalBytes },
  });
  return res.status === 201 ? res.json : null;
}

async function sendChunk(sessionId, relativePath, offset, buf, totalSize, isFinal) {
  const form = new FormData();
  form.append('relativePath', relativePath);
  form.append('offset', String(offset));
  form.append('totalSize', String(totalSize));
  form.append('isFinal', isFinal ? 'true' : 'false');
  form.append('chunk', new Blob([buf]), 'chunk');
  const res = await fetch(`${API}/api/certification/uploads/${sessionId}/chunk`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

/** Upload a file from disk in chunks, streaming rather than buffering. */
async function uploadFromDisk(sessionId, absolutePath, relativePath, chunkBytes) {
  const size = (await stat(absolutePath)).size;
  const handle = await (await import('node:fs/promises')).open(absolutePath, 'r');
  try {
    const buf = Buffer.alloc(chunkBytes);
    // Start from whatever the server already holds, exactly as the browser
    // client does, so a resumed transfer sends only the remainder.
    const manifest = await req('GET', `/api/certification/uploads/${sessionId}/manifest`, { token });
    let offset = (manifest.json?.held ?? []).find((h) => h.relativePath === relativePath)?.bytes ?? 0;

    while (offset < size) {
      const { bytesRead } = await handle.read(buf, 0, Math.min(chunkBytes, size - offset), offset);
      const isFinal = offset + bytesRead >= size;
      const res = await sendChunk(sessionId, relativePath, offset, buf.subarray(0, bytesRead), size, isFinal);

      // On a misalignment the server returns where it really is; realign and
      // carry on rather than treating it as a failure.
      if (res.status === 409 && typeof res.json.offset === 'number' && res.json.offset !== offset) {
        offset = res.json.offset;
        continue;
      }
      if (res.status !== 200) return { ok: false, offset, error: res };
      offset = res.json.offset;
    }
    return { ok: true, offset };
  } finally {
    await handle.close();
  }
}

// ---------------------------------------------------------------------------
// Escalating payload sizes
// ---------------------------------------------------------------------------

const TARGETS = [
  ['100 MB', 100 * 1024 * 1024],
  ['500 MB', 500 * 1024 * 1024],
  ['1 GB', 1024 * 1024 * 1024],
  ['5 GB', 5 * 1024 * 1024 * 1024],
  ['10 GB', 10 * 1024 * 1024 * 1024],
];

// Keep a margin so the machine is not filled: the file exists on disk twice
// during upload (source and staging).
const budget = available * 0.4;
const throughput = [];

console.log('--- payload sizes ---');
for (const [label, bytes] of TARGETS) {
  if (bytes * 2 > budget) {
    results.unknown(
      `STRESS-${label.replace(/\s/g, '')}`,
      `${label} upload not exercised`,
      `the source and its staged copy would need ${((bytes * 2) / 1e9).toFixed(1)}GB and only ` +
        `${(available / 1e9).toFixed(1)}GB is free here. Not extrapolated from smaller runs.`,
    );
    continue;
  }

  const name = `payload-${label.replace(/\s/g, '')}.bin`;
  const src = await makeFile(name, bytes);
  const s = await newSession(`STR-${label.replace(/\s/g, '')}-${Date.now().toString().slice(-5)}`, 1, bytes);
  if (!s) {
    results.fail(`STRESS-${label.replace(/\s/g, '')}`, `Could not open a session for ${label}`);
    await rm(src, { force: true });
    continue;
  }

  const t0 = performance.now();
  const r = await uploadFromDisk(s.uploadSessionId, src, `stress/${name}`, s.chunkBytes);
  const ms = Math.round(performance.now() - t0);
  const mbps = bytes / 1e6 / (ms / 1000);

  if (r.ok && r.offset === bytes) {
    throughput.push({ label, bytes, ms, mbps: Math.round(mbps) });
    results.pass(
      `STRESS-${label.replace(/\s/g, '')}`,
      `${label} uploads completely`,
      `${(ms / 1000).toFixed(1)}s at ${Math.round(mbps)} MB/s`,
      { bytes, ms, mbps: Math.round(mbps) },
    );
    console.log(`  ${label.padEnd(7)} ${(ms / 1000).toFixed(1)}s  ${Math.round(mbps)} MB/s`);
  } else {
    results.fail(
      `STRESS-${label.replace(/\s/g, '')}`,
      `${label} did not upload completely`,
      `stopped at ${r.offset} of ${bytes}: ${JSON.stringify(r.error?.json ?? {}).slice(0, 160)}`,
    );
  }

  await req('DELETE', `/api/certification/uploads/${s.uploadSessionId}`, { token });
  await rm(src, { force: true });
}

// ---------------------------------------------------------------------------
// Concurrent uploads
// ---------------------------------------------------------------------------

console.log('\n--- concurrent uploads ---');
const CONCURRENT = 5;
const eachBytes = 40 * 1024 * 1024;
const sources = [];
for (let i = 0; i < CONCURRENT; i++) sources.push(await makeFile(`concurrent-${i}.bin`, eachBytes));

const sessions = [];
for (let i = 0; i < CONCURRENT; i++) {
  const s = await newSession(`CONC-${i}-${Date.now().toString().slice(-5)}`, 1, eachBytes);
  sessions.push(s);
}

const cStart = performance.now();
const cResults = await Promise.all(
  sessions.map((s, i) =>
    s ? uploadFromDisk(s.uploadSessionId, sources[i], `stress/concurrent-${i}.bin`, s.chunkBytes) : Promise.resolve({ ok: false }),
  ),
);
const cMs = Math.round(performance.now() - cStart);
const cOk = cResults.filter((r) => r.ok).length;

cOk === CONCURRENT
  ? results.pass(
      'STRESS-CONCURRENT',
      `${CONCURRENT} simultaneous uploads all complete`,
      `${((CONCURRENT * eachBytes) / 1e6).toFixed(0)}MB total in ${(cMs / 1000).toFixed(1)}s ` +
        `(${Math.round((CONCURRENT * eachBytes) / 1e6 / (cMs / 1000))} MB/s aggregate)`,
    )
  : results.fail('STRESS-CONCURRENT', 'Simultaneous uploads failed', `${cOk}/${CONCURRENT} completed`);

for (const s of sessions) if (s) await req('DELETE', `/api/certification/uploads/${s.uploadSessionId}`, { token });
for (const f of sources) await rm(f, { force: true });

// ---------------------------------------------------------------------------
// Interruption and recovery on a large file
// ---------------------------------------------------------------------------

console.log('\n--- interruption and recovery ---');
const bigBytes = 200 * 1024 * 1024;
const bigSrc = await makeFile('interrupted.bin', bigBytes);
const bigSession = await newSession(`INT-${Date.now().toString().slice(-5)}`, 1, bigBytes);

if (bigSession) {
  const rel = 'stress/interrupted.bin';
  const handle = await (await import('node:fs/promises')).open(bigSrc, 'r');
  const buf = Buffer.alloc(bigSession.chunkBytes);
  let offset = 0;
  // Stop a third of the way through, as a dropped connection would.
  while (offset < Math.floor(bigBytes / 3)) {
    const { bytesRead } = await handle.read(buf, 0, bigSession.chunkBytes, offset);
    const res = await sendChunk(bigSession.uploadSessionId, rel, offset, buf.subarray(0, bytesRead), bigBytes, false);
    if (res.status !== 200) break;
    offset = res.json.offset;
  }
  await handle.close();

  const manifest = await req('GET', `/api/certification/uploads/${bigSession.uploadSessionId}/manifest`, { token });
  const held = (manifest.json?.held ?? []).find((h) => h.relativePath === rel)?.bytes ?? 0;

  held > 0 && held < bigBytes
    ? results.pass(
        'STRESS-INTERRUPT',
        'A large upload interrupted mid-transfer is held at the byte it reached',
        `${(held / 1e6).toFixed(0)}MB of ${(bigBytes / 1e6).toFixed(0)}MB retained`,
      )
    : results.fail('STRESS-INTERRUPT', 'The interrupted upload was not retained', `held ${held}`);

  // Resume the remainder and verify the reassembled file byte for byte.
  const t0 = performance.now();
  const resumed = await uploadFromDisk(bigSession.uploadSessionId, bigSrc, rel, bigSession.chunkBytes);
  const resumeMs = Math.round(performance.now() - t0);

  const stagedPath = path.join('/var/tmp/courtaccess-certification-staging', bigSession.uploadSessionId, rel);
  const [srcHash, stagedHash] = await Promise.all([
    hashFile(bigSrc),
    hashFile(stagedPath).catch(() => null),
  ]);

  resumed.ok && srcHash === stagedHash
    ? results.pass(
        'STRESS-RESUME',
        'The resumed upload reassembles byte-for-byte identical to the original',
        `remaining ${((bigBytes - held) / 1e6).toFixed(0)}MB in ${(resumeMs / 1000).toFixed(1)}s, SHA-256 matches`,
      )
    : results.fail(
        'STRESS-RESUME',
        'The resumed upload does not match the original',
        `ok=${resumed.ok} src=${srcHash.slice(0, 12)} staged=${stagedHash?.slice(0, 12) ?? 'absent'}`,
      );

  await req('DELETE', `/api/certification/uploads/${bigSession.uploadSessionId}`, { token });
}
await rm(bigSrc, { force: true });

async function hashFile(p) {
  const { createReadStream } = await import('node:fs');
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    const st = createReadStream(p);
    st.on('data', (c) => h.update(c));
    st.on('end', () => resolve(h.digest('hex')));
    st.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// A very large document
// ---------------------------------------------------------------------------

console.log('\n--- large document ---');
const bigPdf = '/tmp/courtaccess-fixtures/large-2000-page.pdf';
const bigPdfSize = await stat(bigPdf).then((s) => s.size).catch(() => 0);

if (bigPdfSize > 0) {
  const s = await newSession(`PDF-${Date.now().toString().slice(-5)}`, 1, bigPdfSize);
  const t0 = performance.now();
  const r = await uploadFromDisk(s.uploadSessionId, bigPdf, 'stress/large-2000-page.pdf', s.chunkBytes);
  const ms = Math.round(performance.now() - t0);

  if (r.ok) {
    const preview = await req('GET', `/api/certification/uploads/${s.uploadSessionId}/preview`, { token, timeoutMs: 300000 });
    const pages = preview.json?.detected?.totalPages ?? 0;
    pages >= 2000
      ? results.pass(
          'STRESS-LARGEPDF',
          'A 2,000-page PDF uploads and its pages are counted',
          `${(bigPdfSize / 1e6).toFixed(1)}MB in ${ms}ms, ${pages} pages detected`,
        )
      : results.fail('STRESS-LARGEPDF', 'The large PDF page count is wrong', `${pages} pages detected, expected 2000`);
  } else {
    results.fail('STRESS-LARGEPDF', 'The large PDF did not upload', JSON.stringify(r.error?.json ?? {}).slice(0, 160));
  }
  await req('DELETE', `/api/certification/uploads/${s.uploadSessionId}`, { token });
}

results.unknown(
  'STRESS-20KPAGE',
  'A 20,000-page PDF was not exercised',
  'no such document exists in this environment and generating one would be synthetic rather than ' +
    'representative. The 2,000-page case is measured above; page counting is read from the PDF page tree ' +
    'and is not expected to scale differently.',
);

results.unknown(
  'STRESS-20HVIDEO',
  'A 20-hour recording was not exercised',
  'a 20-hour video runs to tens of gigabytes, beyond the disk available here. Duration is read by ' +
    'ffprobe from the container header rather than by decoding, so it does not depend on length, but ' +
    'that has not been demonstrated at this scale.',
);

// ---------------------------------------------------------------------------
// The API stays healthy after the run
// ---------------------------------------------------------------------------

const health = await req('GET', '/api/health');
health.status === 200
  ? results.pass('STRESS-SURVIVAL', 'The API is healthy after the full upload stress run')
  : results.fail('STRESS-SURVIVAL', 'The API is unhealthy after the stress run', `HTTP ${health.status}`);

await rm(WORK, { recursive: true, force: true }).catch(() => {});
await results.write({ freeDiskBytes: available, throughput });
await prisma.$disconnect();
