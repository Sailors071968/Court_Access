#!/usr/bin/env node
/**
 * NIIS bulk-import acceptance harness.
 *
 * Simulates the hardened client flow against a running API:
 *   fingerprint → create job → upload batches of 25 with retry → poll → process
 *
 * Usage:
 *   node backend/scripts/niis-bulk-import-acceptance.mjs \
 *     --base https://courtaccess.net \
 *     --email admin@courtaccess.local \
 *     --password '…' \
 *     --counts 1,25,100
 *
 * Optional: --counts 1,25,100,500,1200
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const base = (arg('base', 'http://127.0.0.1:3100')).replace(/\/$/, '');
const email = arg('email', 'admin@courtaccess.local');
const password = arg('password', process.env.ADMIN_PASSWORD || '');
const counts = arg('counts', '1,25,100').split(',').map((n) => Number(n.trim())).filter((n) => n > 0);
const fixturePath = resolve(root, 'fixtures/sacramento/roster-2026-08-10.csv');

if (!password) {
  console.error('Missing --password or ADMIN_PASSWORD');
  process.exit(2);
}
if (!existsSync(fixturePath)) {
  console.error('Missing fixture', fixturePath);
  process.exit(2);
}

const fixtureBytes = readFileSync(fixturePath);
const fixtureName = 'roster-2026-08-10.csv';

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function login() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`login failed: ${res.status} ${JSON.stringify(body)}`);
  const token = body.token || body.accessToken || body.access_token;
  if (!token) throw new Error(`login response missing token: ${JSON.stringify(body)}`);
  return token;
}

async function api(token, path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`${init.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function makeFiles(n) {
  // Unique content per file so fingerprints differ; first file uses the real fixture.
  const files = [];
  for (let i = 0; i < n; i += 1) {
    const bytes = i === 0
      ? fixtureBytes
      : Buffer.from(
        `${fixtureBytes.toString('utf8')}\n#acceptance-clone-${i}-${Date.now()}\n`,
        'utf8',
      );
    const name = i === 0 ? fixtureName : `roster-acceptance-${String(i).padStart(5, '0')}.csv`;
    files.push({ name, bytes, sha256: sha256(bytes), sizeBytes: bytes.length });
  }
  return files;
}

async function runCount(token, n) {
  const started = Date.now();
  console.log(`\n=== Acceptance: ${n} file(s) ===`);
  const files = makeFiles(n);

  const created = await api(token, '/api/admin/intelligence/import-jobs', {
    method: 'POST',
    body: JSON.stringify({
      facility: 'sacramento',
      rosterDate: '2026-08-10',
      label: `acceptance-${n}`,
      autoProcess: true,
      files: files.map((f) => ({ name: f.name, sizeBytes: f.sizeBytes, sha256: f.sha256 })),
    }),
  });

  const jobId = created.job.jobId;
  const toUpload = created.decisions.filter((d) => d.action === 'upload');
  const skipped = created.decisions.filter((d) => d.action === 'skip_duplicate').length;
  console.log(`job ${jobId}: upload=${toUpload.length} skipped=${skipped}`);

  const byHash = new Map(files.map((f) => [f.sha256, f]));
  const CHUNK = 25;
  const MAX_RETRIES = 3;

  for (let i = 0; i < toUpload.length; i += CHUNK) {
    const slice = toUpload.slice(i, i + CHUNK);
    let attempt = 0;
    for (;;) {
      attempt += 1;
      const form = new FormData();
      form.append('batchIndex', String(Math.floor(i / CHUNK)));
      for (const d of slice) {
        const f = byHash.get(d.sha256);
        form.append('jobFileId', d.jobFileId);
        form.append('files', new Blob([f.bytes], { type: 'text/csv' }), f.name);
      }
      try {
        const result = await api(token, `/api/admin/intelligence/import-jobs/${jobId}/uploads`, {
          method: 'POST',
          body: form,
          headers: {},
        });
        console.log(
          `  batch ${Math.floor(i / CHUNK) + 1}: accepted=${result.accepted.length} rejected=${result.rejected.length}`,
        );
        if (result.rejected.length && result.accepted.length === 0) {
          throw new Error(result.rejected.map((r) => r.reason).join('; '));
        }
        break;
      } catch (err) {
        if (attempt >= MAX_RETRIES) throw err;
        console.warn(`  batch retry ${attempt}: ${err.message}`);
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  // Poll until terminal.
  let job;
  for (let t = 0; t < 180; t += 1) {
    job = await api(token, `/api/admin/intelligence/import-jobs/${jobId}`);
    if (['completed', 'failed', 'cancelled'].includes(job.status)) break;
    if (job.status === 'queued' || (job.filesUploaded > 0 && job.filesProcessing === 0 && job.filesCompleted === 0 && job.filesPending === 0)) {
      try {
        await api(token, `/api/admin/intelligence/import-jobs/${jobId}/process`, {
          method: 'POST',
          body: '{}',
        });
      } catch {
        // already processing
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `result status=${job.status} completed=${job.filesCompleted} failed_up=${job.filesFailedUpload} ` +
    `failed_proc=${job.filesFailedProcessing} skipped=${job.filesSkippedDuplicate} ` +
    `files/min=${job.metrics?.filesPerMinute ?? '—'} rows/s=${job.metrics?.rowsPerSecond ?? '—'} ${elapsed}s`,
  );

  if (job.status !== 'completed' && job.filesCompleted + job.filesSkippedDuplicate < n) {
    throw new Error(`Acceptance failed for n=${n}: status=${job.status}`);
  }
  return job;
}

const token = await login();
console.log(`Logged in to ${base}`);
const results = [];
for (const n of counts) {
  results.push(await runCount(token, n));
}
console.log('\nAll acceptance counts passed:', counts.join(', '));
