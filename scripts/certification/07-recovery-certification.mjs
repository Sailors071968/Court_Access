#!/usr/bin/env node
// Phase 10 — Recovery certification.
//
// Interrupts the things that actually go wrong in production — the database
// restarting, Redis restarting, the API process being killed, an upload being
// cut off mid-stream — and checks that the platform comes back and that no
// data is silently lost or corrupted.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { Results, req, registerUser, login, API, exercisedApiRoutes } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const exec = promisify(execFile);
const prisma = new PrismaClient();
const results = new Results('RECOVERY_CERTIFICATION', 'Phase 10 — Recovery Testing');

const sh = (cmd) => exec('bash', ['-lc', cmd]).catch((e) => ({ stdout: '', stderr: String(e) }));

// This suite deliberately restarts PostgreSQL, so the harness's own client
// will hold a closed connection. Retry through that; it says nothing about
// the product under test.
async function db(fn, attempts = 10) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!/P1017|P1001|Server has closed|Can't reach database/i.test(String(err))) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

async function waitForHealth(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await req('GET', '/api/health', { timeoutMs: 3000 });
    if (r.status === 200) return Math.round(timeoutMs - (deadline - Date.now()));
    await new Promise((x) => setTimeout(x, 500));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Baseline: a case with evidence that must survive every interruption
// ---------------------------------------------------------------------------

const user = await registerUser({ prefix: 'recovery', defaultRole: 'attorney' });
const created = await req('POST', '/api/cases', {
  token: user.token,
  body: {
    title: 'Recovery certification case',
    caseNumber: `REC-${Date.now()}`,
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
const caseId = created.json.case.caseId;

const reportBytes = await readFile('/tmp/courtaccess-fixtures/police-report.pdf');
{
  const form = new FormData();
  form.append('caseId', caseId);
  form.append('evidenceType', 'police_report');
  form.append('file', new Blob([reportBytes], { type: 'application/pdf' }), 'baseline.pdf');
  await fetch(`${API}/api/evidence/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}` },
    body: form,
  });
  exercisedApiRoutes.add('POST /api/evidence/upload');
}
await new Promise((r) => setTimeout(r, 3000));

const baselineEvidence = await db(() => prisma.evidence.count({ where: { caseId } }));
const baselineChunks = await db(async () =>
  prisma.evidenceChunk.count({
    where: {
      evidenceId: {
        in: (await prisma.evidence.findMany({ where: { caseId }, select: { evidenceId: true } })).map((e) => e.evidenceId),
      },
    },
  }),
);
console.log(`baseline: case ${caseId}, ${baselineEvidence} evidence, ${baselineChunks} chunks\n`);

async function assertDataIntact(id, label) {
  const ev = await db(() => prisma.evidence.count({ where: { caseId } }));
  const listed = await req('GET', `/api/cases/${caseId}/evidence`, { token: user.token });
  const viaApi = Array.isArray(listed.json?.evidence) ? listed.json.evidence.length : null;
  if (ev === baselineEvidence && viaApi === baselineEvidence) {
    results.pass(id, `${label}: case data is intact`, `${ev} evidence records still readable through the API`);
  } else {
    results.fail(id, `${label}: case data changed`, `db=${ev} api=${viaApi} expected=${baselineEvidence}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Database restart
// ---------------------------------------------------------------------------

console.log('--- restarting PostgreSQL ---');
await sh('sudo pg_ctlcluster 16 main restart');
await new Promise((r) => setTimeout(r, 2000));

let dbBack = false;
for (let i = 0; i < 60; i++) {
  const r = await req('GET', '/api/cases', { token: user.token, timeoutMs: 5000 });
  if (r.status === 200) {
    dbBack = true;
    results.pass('REC-01', 'The API reconnects to PostgreSQL after a database restart', `recovered on attempt ${i + 1}`);
    break;
  }
  await new Promise((x) => setTimeout(x, 1000));
}
if (!dbBack) results.fail('REC-01', 'The API did not reconnect after a database restart', '60s elapsed');
await assertDataIntact('REC-02', 'After a database restart');

// ---------------------------------------------------------------------------
// 2. Redis restart
// ---------------------------------------------------------------------------

console.log('--- restarting Redis ---');
await sh('sudo redis-cli shutdown nosave || true');
await new Promise((r) => setTimeout(r, 1500));
await sh('sudo redis-server /etc/redis/redis.conf --daemonize yes');
await new Promise((r) => setTimeout(r, 3000));

const redisPing = await sh('redis-cli ping');
redisPing.stdout.includes('PONG')
  ? results.pass('REC-03', 'Redis restarts cleanly')
  : results.fail('REC-03', 'Redis did not come back', redisPing.stderr.slice(0, 160));

const afterRedis = await req('GET', '/api/health', { timeoutMs: 10000 });
afterRedis.status === 200
  ? results.pass('REC-04', 'The API stays up across a Redis restart', `HTTP ${afterRedis.status}`)
  : results.fail('REC-04', 'The API did not survive a Redis restart', `HTTP ${afterRedis.status}`);

// Queue work must still be accepted once Redis is back.
let queueBack = false;
for (let i = 0; i < 30; i++) {
  const r = await req('POST', `/api/timeline/rebuild/${caseId}`, { token: user.token, body: {}, timeoutMs: 20000 });
  if (r.status >= 200 && r.status < 300) {
    queueBack = true;
    results.pass('REC-05', 'Queue work is accepted again after a Redis restart', `recovered on attempt ${i + 1}`);
    break;
  }
  await new Promise((x) => setTimeout(x, 1000));
}
if (!queueBack) results.fail('REC-05', 'Queue work is still refused after a Redis restart', '30s elapsed');

// ---------------------------------------------------------------------------
// 3. API process restart
// ---------------------------------------------------------------------------

console.log('--- restarting the API process ---');
const before = await req('GET', '/api/health');
const beforeUptime = before.json?.timestamp;

await sh("pkill -f 'tsx src/server.ts' || true");
await new Promise((r) => setTimeout(r, 3000));

const downCheck = await req('GET', '/api/health', { timeoutMs: 3000 });
downCheck.status === 0 || downCheck.status >= 500
  ? results.pass('REC-06', 'The API is confirmed down before the restart test', `status ${downCheck.status}`)
  : results.warn('REC-06', 'The API was still answering after the kill', `status ${downCheck.status}`);

// The restarted process must come back on the same database this run is
// using, otherwise the restart looks like data loss when it is really the
// server talking to a different schema.
const dbOverride = process.env.DATABASE_URL ? `export DATABASE_URL='${process.env.DATABASE_URL}'; ` : '';
await sh(
  "cd /workspace/backend && tmux -f /exec-daemon/tmux.portal.conf kill-session -t courtaccess-api 2>/dev/null; " +
    "tmux -f /exec-daemon/tmux.portal.conf new-session -d -s courtaccess-api -c /workspace/backend -- " +
    "bash -lc 'set -a; . ./.env.certification; set +a; " +
    dbOverride +
    'export RATE_LIMIT_REGISTER_PER_MINUTE=5000 RATE_LIMIT_GENERAL_PER_MINUTE=100000 ' +
    'RATE_LIMIT_LOGIN_PER_MINUTE=5000 RATE_LIMIT_UPLOAD_PER_MINUTE=100000 RATE_LIMIT_COMPLIANCE_PER_MINUTE=10000; ' +
    "npx tsx src/server.ts 2>&1 | tee /tmp/backend-run.log'",
);

const recoveredIn = await waitForHealth(120000);
recoveredIn !== null
  ? results.pass('REC-07', 'The API restarts and serves traffic again', `healthy within ${recoveredIn}ms`)
  : results.fail('REC-07', 'The API did not come back after a restart', '120s elapsed');

await assertDataIntact('REC-08', 'After an API restart');

// An existing session must still work after the process restarts.
const sessionAfter = await req('GET', '/api/auth/me', { token: user.token });
sessionAfter.status === 200
  ? results.pass('REC-09', 'An existing session survives an API restart', 'the token is still accepted')
  : results.fail('REC-09', 'Sessions are lost when the API restarts', `HTTP ${sessionAfter.status}`);

// Logging in again must also work.
const reLogin = await login(user.email, user.password);
reLogin.status === 200
  ? results.pass('REC-10', 'Users can log in again after an API restart', 'HTTP 200')
  : results.fail('REC-10', 'Login fails after an API restart', `HTTP ${reLogin.status}`);

// ---------------------------------------------------------------------------
// 4. Interrupted upload
// ---------------------------------------------------------------------------

console.log('--- interrupting an upload mid-stream ---');
const evidenceBeforeCut = await db(() => prisma.evidence.count({ where: { caseId } }));

// Write a valid multipart preamble and a partial body, then destroy the socket.
await new Promise((resolve) => {
  const boundary = '----certificationBoundary';
  const head =
    `--${boundary}\r\nContent-Disposition: form-data; name="caseId"\r\n\r\n${caseId}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="evidenceType"\r\n\r\npolice_report\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="interrupted.pdf"\r\n` +
    'Content-Type: application/pdf\r\n\r\n';

  const socket = net.connect(3001, '127.0.0.1', () => {
    socket.write(
      `POST /api/evidence/upload HTTP/1.1\r\nHost: 127.0.0.1:3001\r\n` +
        `Authorization: Bearer ${user.token}\r\n` +
        `Content-Type: multipart/form-data; boundary=${boundary}\r\n` +
        // Declare far more than will actually be sent.
        `Content-Length: ${head.length + reportBytes.length + 200}\r\n\r\n`,
    );
    socket.write(head);
    socket.write(reportBytes.subarray(0, Math.floor(reportBytes.length / 3)));
    setTimeout(() => {
      socket.destroy();
      resolve();
    }, 300);
  });
  socket.on('error', () => resolve());
});

await new Promise((r) => setTimeout(r, 4000));

const healthAfterCut = await req('GET', '/api/health');
healthAfterCut.status === 200
  ? results.pass('REC-11', 'An interrupted upload does not destabilise the API', 'health still 200')
  : results.fail('REC-11', 'The API is unhealthy after an interrupted upload', `HTTP ${healthAfterCut.status}`);

const evidenceAfterCut = await db(() => prisma.evidence.count({ where: { caseId } }));
const orphan = await db(() => prisma.evidence.findFirst({
  where: { caseId, fileName: 'interrupted.pdf' },
  select: { evidenceId: true, processingStatus: true, processingError: true, size: true },
}));
if (evidenceAfterCut === evidenceBeforeCut) {
  results.pass('REC-12', 'An interrupted upload leaves no partial evidence record', `still ${evidenceAfterCut} records`);
} else if (orphan && orphan.processingStatus === 'failed') {
  results.pass(
    'REC-12',
    'An interrupted upload is recorded as failed rather than left looking complete',
    `${orphan.processingError}`.slice(0, 160),
  );
} else {
  results.fail(
    'REC-12',
    'An interrupted upload left a record that looks complete',
    JSON.stringify(orphan ?? {}).slice(0, 220),
  );
}

// A normal upload must still work after the interruption.
{
  const form = new FormData();
  form.append('caseId', caseId);
  form.append('evidenceType', 'police_report');
  form.append('file', new Blob([reportBytes], { type: 'application/pdf' }), 'after-interruption.pdf');
  exercisedApiRoutes.add('POST /api/evidence/upload');
  const res = await fetch(`${API}/api/evidence/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}` },
    body: form,
  });
  exercisedApiRoutes.add('POST /api/evidence/upload');
  res.status === 201
    ? results.pass('REC-13', 'Uploads still succeed after an interrupted transfer', 'HTTP 201')
    : results.fail('REC-13', 'Uploads fail after an interrupted transfer', `HTTP ${res.status}`);
}

// ---------------------------------------------------------------------------
// 5. Worker recovery
// ---------------------------------------------------------------------------

const finalRebuild = await req('POST', `/api/timeline/rebuild/${caseId}`, { token: user.token, body: {} });
if (finalRebuild.status === 200) {
  const jobId = finalRebuild.json?.processingJobId;
  let job = null;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    job = await db(() => prisma.processingJob.findUnique({ where: { id: jobId } }));
    if (job && ['completed', 'failed'].includes(job.status)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  job?.status === 'completed'
    ? results.pass('REC-14', 'Queue workers process jobs after every restart in this run', `job ${jobId} completed`)
    : results.fail('REC-14', 'Queue workers did not recover', `job status=${job?.status} error=${job?.error ?? ''}`.slice(0, 200));
} else {
  results.fail('REC-14', 'Could not enqueue work after the restart sequence', `HTTP ${finalRebuild.status}`);
}

await results.write({ caseId, baselineEvidence, baselineChunks });
await prisma.$disconnect();
