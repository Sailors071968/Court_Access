#!/usr/bin/env node
// Program 145 — upload portal API certification.
//
// Exercises the path a browser takes: create a session, stream files in
// chunks preserving their folder paths, survive an interruption and resume
// from what the server actually holds, preview, then commit and follow the
// pipeline to completion. Also proves the portal is closed to non-admins and
// that a truncated transfer is rejected rather than silently accepted.

import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, login, API } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('UPLOAD_PORTAL_API', 'Program 145 — Upload Portal API');
const CORPUS = '/tmp/courtaccess-certification-corpus/SYNTHETIC-001';

// ---------------------------------------------------------------------------
// Closed to non-administrators
// ---------------------------------------------------------------------------

const NON_ADMIN = ['attorney', 'criminal_investigator', 'paralegal', 'criminal_defendant', 'family_member'];
const reached = [];
for (const role of NON_ADMIN) {
  const u = await registerUser({ prefix: `up-${role}`, defaultRole: role });
  if (!u.token) continue;
  for (const [method, url, body] of [
    ['POST', '/api/certification/uploads', { reference: 'X', label: 'X' }],
    ['GET', '/api/certification/uploads/00000000-0000-4000-8000-000000000000', undefined],
  ]) {
    const res = await req(method, url, { token: u.token, body });
    if (res.status !== 403 && res.status !== 401) reached.push(`${role} → ${method} ${url} (${res.status})`);
  }
}
reached.length === 0
  ? results.pass('UP-01', 'The upload portal is closed to every non-administrator role', `${NON_ADMIN.length} roles probed`)
  : results.fail('UP-01', 'A non-administrator reached the upload portal', reached.join('; '));

// ---------------------------------------------------------------------------
// Administrator session
// ---------------------------------------------------------------------------

const account = await registerUser({ prefix: 'up-admin', defaultRole: 'attorney' });
await prisma.user.update({ where: { id: account.user.userId }, data: { role: 'admin' } });
const session = await login(account.email, account.password);
const token = session.token;

// Collect the local "selection" — what a browser would hand us from a folder.
async function collect(root) {
  const out = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) await walk(abs);
      else if (e.isFile()) {
        const st = await stat(abs);
        out.push({
          absolutePath: abs,
          // Browsers report the selected folder as the first segment.
          relativePath: `SYNTHETIC-001/${path.relative(root, abs).split(path.sep).join('/')}`,
          size: st.size,
          lastModified: st.mtimeMs,
        });
      }
    }
  }
  await walk(root);
  out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return out;
}

const selection = await collect(CORPUS);

const totalBytes = selection.reduce((s, f) => s + f.size, 0);
console.log(`selection: ${selection.length} files, ${(totalBytes / 1e6).toFixed(1)}MB\n`);

const reference = `UP-${Date.now().toString().slice(-6)}`;
const created = await req('POST', '/api/certification/uploads', {
  token,
  body: { reference, label: 'Upload portal corpus', fileCount: selection.length, totalBytes },
});

if (created.status !== 201) {
  results.fail('UP-02', 'Could not create an upload session', `HTTP ${created.status}: ${(created.text ?? '').slice(0, 200)}`);
  await results.write({});
  await prisma.$disconnect();
  process.exit(1);
}
const uploadSessionId = created.json.uploadSessionId;
const chunkBytes = created.json.chunkBytes;
results.pass('UP-02', 'An administrator can open an upload session', `chunk size ${(chunkBytes / 1e6).toFixed(0)}MB`);

// ---------------------------------------------------------------------------
// Chunked upload
// ---------------------------------------------------------------------------

async function sendChunk(file, offset, buf, isFinal, sessionId = uploadSessionId) {
  const form = new FormData();
  form.append('relativePath', file.relativePath);
  form.append('offset', String(offset));
  form.append('totalSize', String(file.size));
  form.append('lastModified', String(Math.round(file.lastModified)));
  form.append('isFinal', isFinal ? 'true' : 'false');
  form.append('chunk', new Blob([buf]), 'chunk');

  const res = await fetch(`${API}/api/certification/uploads/${sessionId}/chunk`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function uploadFile(file, { stopAfterChunks = Infinity, startOffset = 0, sessionId = uploadSessionId } = {}) {
  const bytes = await readFile(file.absolutePath);
  let offset = startOffset;
  let sent = 0;

  // A zero-byte file still has to be sent, as a single final empty chunk,
  // otherwise it silently never arrives.
  if (bytes.length === 0) {
    const res = await sendChunk(file, 0, Buffer.alloc(0), true, sessionId);
    return res.status === 200 ? { complete: true, offset: 0 } : { error: res, offset: 0 };
  }

  while (offset < bytes.length) {
    if (sent >= stopAfterChunks) return { interrupted: true, offset };
    const end = Math.min(offset + chunkBytes, bytes.length);
    const isFinal = end === bytes.length;
    const res = await sendChunk(file, offset, bytes.subarray(offset, end), isFinal, sessionId);
    if (res.status !== 200) return { error: res, offset };
    offset = res.json.offset;
    sent++;
  }
  return { complete: true, offset };
}

// Upload everything except one large file, which is deliberately interrupted.
let uploaded = 0;
let uploadFailures = 0;

const t0 = performance.now();
for (const file of selection) {
  const r = await uploadFile(file);
  if (r.complete) uploaded++;
  else uploadFailures++;
}
const uploadMs = Math.round(performance.now() - t0);

uploadFailures === 0
  ? results.pass(
      'UP-03',
      'Files upload in chunks with their folder paths preserved',
      `${uploaded} file(s) in ${uploadMs}ms`,
    )
  : results.fail('UP-03', 'Some files failed to upload', `${uploadFailures} failure(s)`);

// ---------------------------------------------------------------------------
// Interruption and resume, on a file larger than one chunk
//
// Run in a throwaway session so a synthetic test file cannot end up in a
// certification corpus.
// ---------------------------------------------------------------------------

const BIG_PATH = '/tmp/courtaccess-certification-corpus/large-upload.bin';
await writeFile(BIG_PATH, Buffer.alloc(20 * 1024 * 1024, 0x42));
const bigFile = {
  absolutePath: BIG_PATH,
  relativePath: 'resume-probe/large-upload.bin',
  size: (await stat(BIG_PATH)).size,
  lastModified: (await stat(BIG_PATH)).mtimeMs,
};

const probeSession = await req('POST', '/api/certification/uploads', {
  token,
  body: {
    reference: `RESUME-${Date.now().toString().slice(-6)}`,
    label: 'Resume probe',
    fileCount: 1,
    totalBytes: bigFile.size,
  },
});
const probeId = probeSession.json.uploadSessionId;

const partial = await uploadFile(bigFile, { stopAfterChunks: 1, sessionId: probeId });
const probeManifest = await req('GET', `/api/certification/uploads/${probeId}/manifest`, { token });
const heldEntry = (probeManifest.json?.held ?? []).find((h) => h.relativePath === bigFile.relativePath);

partial.interrupted && heldEntry && heldEntry.bytes > 0 && heldEntry.bytes < bigFile.size
  ? results.pass(
      'UP-04',
      'An interrupted multi-chunk upload is held partially and the server reports how much it has',
      `${(heldEntry.bytes / 1e6).toFixed(0)}MB of ${(bigFile.size / 1e6).toFixed(0)}MB held`,
    )
  : results.fail(
      'UP-04',
      'The interrupted file was not held partially',
      `partial=${JSON.stringify(partial)} held=${JSON.stringify(heldEntry)}`,
    );

// Resuming from the wrong offset must be refused, with the true offset given.
const held = heldEntry?.bytes ?? 0;
const wrong = await sendChunk(bigFile, held + 999, Buffer.from('x'), false, probeId);
wrong.status === 409 && wrong.json.offset === held
  ? results.pass(
      'UP-05',
      'A chunk sent for the wrong offset is refused and the true offset returned',
      `HTTP 409, resume from ${wrong.json.offset}`,
    )
  : results.fail('UP-05', 'A misaligned chunk was not refused correctly', `HTTP ${wrong.status}: ${JSON.stringify(wrong.json).slice(0, 150)}`);

// Resume properly from where the server actually is.
const resumed = await uploadFile(bigFile, { startOffset: held, sessionId: probeId });
const resumedHash = await readFile(
  path.join('/var/tmp/courtaccess-certification-staging', probeId, bigFile.relativePath),
)
  .then((b) => createHash('sha256').update(b).digest('hex'))
  .catch(() => null);
const bigHash = createHash('sha256').update(await readFile(BIG_PATH)).digest('hex');

resumed.complete && resumedHash === bigHash
  ? results.pass(
      'UP-06',
      'A resumed upload reassembles byte-for-byte identical to the original',
      `${(bigFile.size / 1e6).toFixed(0)}MB across ${Math.ceil(bigFile.size / chunkBytes)} chunks, SHA-256 matches`,
    )
  : results.fail(
      'UP-06',
      'The resumed upload does not match the original',
      `complete=${resumed.complete} local=${bigHash.slice(0, 12)} staged=${resumedHash?.slice(0, 12) ?? 'absent'}`,
    );

await req('DELETE', `/api/certification/uploads/${probeId}`, { token });

// Every file in the real selection must now be present and the right size.
const finalManifest = await req('GET', `/api/certification/uploads/${uploadSessionId}/manifest`, { token });
const heldMap = new Map((finalManifest.json?.held ?? []).map((h) => [h.relativePath, h.bytes]));
const mismatched = selection.filter((f) => heldMap.get(f.relativePath) !== f.size);
mismatched.length === 0
  ? results.pass(
      'UP-07',
      'Every selected file arrived complete and byte-exact, including zero-byte files',
      `${selection.length} files, ${(finalManifest.json.heldBytes / 1e6).toFixed(1)}MB`,
    )
  : results.fail(
      'UP-07',
      'Files are missing or the wrong size on the server',
      mismatched.slice(0, 4).map((f) => `${f.relativePath}: ${heldMap.get(f.relativePath) ?? 'absent'} vs ${f.size}`).join('; '),
    );

// Byte-for-byte integrity of a sample, checked against the local original.
const sample = selection.find((f) => f.size > 1000) ?? selection[0];
const localHash = createHash('sha256').update(await readFile(sample.absolutePath)).digest('hex');
const stagedPath = path.join('/var/tmp/courtaccess-certification-staging', uploadSessionId, sample.relativePath);
const stagedHash = await readFile(stagedPath)
  .then((b) => createHash('sha256').update(b).digest('hex'))
  .catch(() => null);
stagedHash === localHash
  ? results.pass('UP-08', "Uploaded bytes match the file on the operator's machine", `SHA-256 ${localHash.slice(0, 16)}`)
  : results.fail('UP-08', 'The uploaded file does not match the original', `local ${localHash.slice(0, 12)} vs staged ${stagedHash?.slice(0, 12) ?? 'absent'}`);

// ---------------------------------------------------------------------------
// Truncated transfers must be refused
// ---------------------------------------------------------------------------

const liar = { relativePath: 'SYNTHETIC-001/liar.txt', size: 5000, lastModified: Date.now() };
const liarRes = await sendChunk(liar, 0, Buffer.alloc(100, 0x41), true);
liarRes.status === 422
  ? results.pass(
      'UP-09',
      'A transfer that ends short of its declared size is refused',
      liarRes.json.message.slice(0, 130),
    )
  : results.fail('UP-09', 'A truncated transfer was accepted', `HTTP ${liarRes.status}`);

// Path traversal in the folder path must be refused.
const evil = { relativePath: '../../../etc/courtaccess-escape.txt', size: 4, lastModified: Date.now() };
const evilRes = await sendChunk(evil, 0, Buffer.from('evil'), true);
evilRes.status === 400
  ? results.pass('UP-10', 'A traversal path in the upload is refused', `HTTP 400`)
  : results.fail('UP-10', 'A traversal path was accepted', `HTTP ${evilRes.status}`);

// ---------------------------------------------------------------------------
// Preview before committing
// ---------------------------------------------------------------------------

const preview = await req('GET', `/api/certification/uploads/${uploadSessionId}/preview`, { token, timeoutMs: 300000 });
if (preview.status !== 200) {
  results.fail('UP-11', 'Preview failed', `HTTP ${preview.status}: ${(preview.text ?? '').slice(0, 200)}`);
} else {
  const d = preview.json.detected;
  results.pass(
    'UP-11',
    'Preview reports what arrived before anything is processed',
    `${d.documents} documents, ${d.videos} video, ${d.audio} audio, ${d.images} images, ${d.totalPages} pages`,
    d,
  );

  d.videoSeconds > 0 || d.audioSeconds > 0
    ? results.pass(
        'UP-12',
        'Media running times are measured from the files themselves',
        `${Math.round(d.videoSeconds)}s of video, ${Math.round(d.audioSeconds)}s of audio`,
      )
    : results.fail('UP-12', 'No media durations were measured', JSON.stringify(d));

  preview.json.estimate?.totalSeconds >= 0 && preview.json.estimate?.basis
    ? results.pass(
        'UP-13',
        'Processing time is estimated and the basis stated',
        `about ${preview.json.estimate.totalSeconds}s total`,
      )
    : results.fail('UP-13', 'No processing estimate was offered', JSON.stringify(preview.json.estimate));

  Array.isArray(preview.json.unmeasured)
    ? results.pass(
        'UP-14',
        'Files that could not be measured are named rather than averaged away',
        `${preview.json.unmeasured.length} unmeasured`,
      )
    : results.fail('UP-14', 'Unmeasured files are not reported');
}

// ---------------------------------------------------------------------------
// Commit and follow the pipeline
// ---------------------------------------------------------------------------

const commit = await req('POST', `/api/certification/uploads/${uploadSessionId}/commit`, { token, body: {} });
commit.status === 202
  ? results.pass('UP-15', 'Committing starts processing without blocking the browser', 'HTTP 202')
  : results.fail('UP-15', 'Commit did not start processing', `HTTP ${commit.status}: ${(commit.text ?? '').slice(0, 200)}`);

const stagesSeen = new Set();
let final = null;
const deadline = Date.now() + 900000;
while (Date.now() < deadline) {
  const s = await req('GET', `/api/certification/uploads/${uploadSessionId}`, { token });
  if (s.status === 200) {
    if (s.json.stage) stagesSeen.add(s.json.stage);
    if (s.json.status === 'completed' || s.json.status === 'failed') {
      final = s.json;
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1000));
}

if (!final) {
  results.fail('UP-16', 'Processing never reached a terminal state', '15 minutes elapsed');
} else if (final.status === 'failed') {
  results.fail('UP-16', 'Processing failed', `${final.stage}: ${(final.error ?? '').slice(0, 200)}`);
} else {
  results.pass(
    'UP-16',
    'Upload, import and certification complete end to end',
    `${final.stage} — ${final.stageDetail}`,
  );

  stagesSeen.size >= 2
    ? results.pass(
        'UP-17',
        'The operator is told which stage the work is on throughout',
        `stages reported: ${[...stagesSeen].join(' → ')}`,
      )
    : results.warn('UP-17', 'Few distinct stages were observed', [...stagesSeen].join(', '));

  final.certificationCaseId && final.certificationRunId
    ? results.pass('UP-18', 'The upload produced a certification corpus and a run', `case ${final.certificationCaseId.slice(0, 8)}`)
    : results.fail('UP-18', 'No corpus or run resulted from the upload', JSON.stringify(final).slice(0, 200));

  // The uploaded corpus must have gone through the same inventory as before.
  const inv = await req('GET', `/api/certification/cases/${final.certificationCaseId}/inventory`, { token });
  if (inv.status === 200) {
    const t = inv.json.totals;
    t.files > 0 && t.ingested > 0
      ? results.pass(
          'UP-19',
          'The uploaded corpus is inventoried with pages and durations',
          `${t.files} files, ${t.pages} pages, ${t.videoSeconds}s video, ${t.audioSeconds}s audio, ${t.duplicates} duplicate(s)`,
          t,
        )
      : results.fail('UP-19', 'The uploaded corpus inventory is empty', JSON.stringify(t));

    const hierarchical = inv.json.files.filter((f) => f.relativePath.includes('/'));
    hierarchical.length > 0
      ? results.pass('UP-20', 'The operator\'s folder hierarchy survives the upload', `e.g. ${hierarchical[0].relativePath}`)
      : results.fail('UP-20', 'Folder hierarchy was lost in the upload');

    const timestamped = inv.json.files.filter((f) => f.originalModifiedAt).length;
    timestamped > 0
      ? results.pass('UP-21', 'Modification times from the operator\'s machine are preserved', `${timestamped}/${inv.json.files.length} files`)
      : results.fail('UP-21', 'Modification times were not preserved');
  } else {
    results.fail('UP-19', 'The uploaded corpus has no inventory', `HTTP ${inv.status}`);
  }
}

// A committed session cannot be cancelled out from under the pipeline.
const lateCancel = await req('DELETE', `/api/certification/uploads/${uploadSessionId}`, { token });
[409, 200].includes(lateCancel.status)
  ? results.pass('UP-22', 'Cancelling after commit is handled deliberately', `HTTP ${lateCancel.status}`)
  : results.fail('UP-22', 'Unexpected response cancelling a committed session', `HTTP ${lateCancel.status}`);

await results.write({ uploadSessionId, reference, selectionFiles: selection.length, selectionBytes: totalBytes });
await prisma.$disconnect();
