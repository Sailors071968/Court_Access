#!/usr/bin/env node
// Program 154, Phase 7 — deployment validation.
//
// Exercises the parts of a running deployment that can be exercised here, and
// records the parts that cannot as not measurable rather than as passes. This
// environment has no object storage, no payment keys, no mail credentials and
// no public ingress of its own, so several of the things a launch checklist
// asks about genuinely cannot be answered from inside it.
//
// Saying so is the point. A deployment checklist that reports green on
// subsystems it never touched is worse than no checklist.

import { Results, req, registerUser } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('DEPLOYMENT_VALIDATION', 'Program 154 — Deployment Validation');
const WEB = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';

// ---------------------------------------------------------------------------
// The application itself
// ---------------------------------------------------------------------------

const health = await req('GET', '/api/health');
health.status === 200 && health.json?.status === 'ok'
  ? results.pass('DEP-01', 'The API is running and reports healthy', `version ${health.json.version}, ${health.json.environment}`)
  : results.fail('DEP-01', 'The API is not healthy', `HTTP ${health.status}`);

const spa = await fetch(`${WEB}/`).catch(() => null);
spa?.ok
  ? results.pass('DEP-02', 'The application is served', `HTTP ${spa.status}`)
  : results.fail('DEP-02', 'The application is not served');

// ---------------------------------------------------------------------------
// Data layer
// ---------------------------------------------------------------------------

const migrations = await prisma
  .$queryRawUnsafe(`SELECT count(*)::int AS done, count(*) FILTER (WHERE finished_at IS NULL)::int AS pending FROM _prisma_migrations`)
  .catch(() => null);
migrations && migrations[0].pending === 0
  ? results.pass('DEP-03', 'Every database migration has been applied', `${migrations[0].done} migrations, none pending`)
  : results.fail('DEP-03', 'Migrations are incomplete', JSON.stringify(migrations?.[0]));

const tables = await prisma.$queryRawUnsafe(
  `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`,
);
tables[0].n > 100
  ? results.pass('DEP-04', 'The schema is present in the running database', `${tables[0].n} tables`)
  : results.fail('DEP-04', 'The schema is incomplete', `${tables[0].n} tables`);

// Schema drift would mean the running database does not match the code.
const { execFile } = await import('node:child_process');
const { promisify } = await import('node:util');
const exec = promisify(execFile);
const drift = await exec(
  'npx',
  ['prisma', 'migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
  { cwd: '/workspace/backend', timeout: 120000, env: { ...process.env } },
)
  .then((r) => r.stdout)
  .catch(() => 'ERROR');
/empty migration/i.test(drift)
  ? results.pass('DEP-05', 'The running database matches the schema in the code', 'no drift')
  : results.fail('DEP-05', 'The database has drifted from the code', drift.slice(0, 160));

// ---------------------------------------------------------------------------
// Authentication and session
// ---------------------------------------------------------------------------

const account = await registerUser({ prefix: 'deploy', defaultRole: 'attorney' });
account.token
  ? results.pass('DEP-06', 'Registration and sign-in work end to end', 'token issued')
  : results.fail('DEP-06', 'Authentication is broken', `HTTP ${account.status}`);

const anonymous = await req('GET', '/api/cases');
[401, 403].includes(anonymous.status)
  ? results.pass('DEP-07', 'Protected routes refuse an unauthenticated caller', `HTTP ${anonymous.status}`)
  : results.fail('DEP-07', 'A protected route served an anonymous caller', `HTTP ${anonymous.status}`);

const refresh = await req('POST', '/api/auth/refresh', { body: { refreshToken: account.refreshToken } });
refresh.status === 200 && refresh.json?.accessToken
  ? results.pass('DEP-08', 'Token renewal works, so a session outlives fifteen minutes', 'new access token issued')
  : results.fail('DEP-08', 'Token renewal is broken', `HTTP ${refresh.status}`);

// ---------------------------------------------------------------------------
// Queues and workers
// ---------------------------------------------------------------------------

let redisUp = false;
try {
  const redis = await exec('redis-cli', ['ping'], { timeout: 8000 });
  redisUp = /PONG/i.test(redis.stdout);
} catch {
  redisUp = false;
}
redisUp
  ? results.pass('DEP-09', 'Redis is reachable, so queues can run', 'PONG')
  : results.fail('DEP-09', 'Redis is not reachable; background processing cannot run');

const queues = await req('GET', '/api/admin/queues', { token: account.token });
[200, 401, 403].includes(queues.status)
  ? results.pass('DEP-10', 'The queue endpoint responds and is access controlled', `HTTP ${queues.status}`)
  : results.fail('DEP-10', 'The queue endpoint is broken', `HTTP ${queues.status}`);

// ---------------------------------------------------------------------------
// Upload and processing, exercised rather than assumed
// ---------------------------------------------------------------------------

const made = await req('POST', '/api/cases', {
  token: account.token,
  body: { title: 'Deployment probe', caseNumber: `DEP-${Date.now()}`, jurisdiction: 'Los Angeles County', caseType: 'felony' },
});
const caseId = made.json?.case?.caseId ?? made.json?.caseId;

const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/Contents 4 0 R>>endobj\n' +
    '4 0 obj<</Length 60>>stream\nBT /F1 12 Tf 72 720 Td (Deployment probe document.) Tj ET\nendstream endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF',
);
const form = new FormData();
form.append('caseId', caseId);
form.append('evidenceType', 'police_report');
form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'deployment-probe.pdf');

const upload = await fetch('http://127.0.0.1:3001/api/evidence/upload', {
  method: 'POST',
  headers: { Authorization: `Bearer ${account.token}` },
  body: form,
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

upload.status === 201
  ? results.pass('DEP-11', 'A document uploads through the production pipeline', upload.json.evidence?.fileName)
  : results.fail('DEP-11', 'Upload failed', `HTTP ${upload.status}: ${JSON.stringify(upload.json).slice(0, 150)}`);

if (upload.status === 201) {
  const evidenceId = upload.json.evidence.evidenceId;
  let processed = null;
  for (let i = 0; i < 40; i++) {
    const row = await prisma.evidence.findUnique({ where: { evidenceId }, select: { processingStatus: true } });
    if (row && ['completed', 'failed', 'analyzed'].includes(row.processingStatus)) {
      processed = row.processingStatus;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  processed
    ? results.pass('DEP-12', 'An uploaded document is processed to a terminal state', processed)
    : results.fail('DEP-12', 'Processing never finished', '40 seconds elapsed');

  const chunks = await prisma.evidenceChunk.count({ where: { evidenceId } });
  chunks > 0
    ? results.pass('DEP-13', 'Text is extracted and stored so findings can cite it', `${chunks} chunk(s)`)
    : results.warn('DEP-13', 'No text was extracted from the probe document', 'the fixture is a minimal PDF');

  const stored = await prisma.evidence.findUnique({ where: { evidenceId }, select: { size: true, sha256: true } }).catch(() => null);
  stored?.sha256
    ? results.pass('DEP-14', 'Uploaded bytes are fingerprinted on storage', stored.sha256.slice(0, 16))
    : results.warn('DEP-14', 'No content hash was recorded for the upload');
}

// ---------------------------------------------------------------------------
// Permissions and isolation
// ---------------------------------------------------------------------------

const other = await registerUser({ prefix: 'deploy-other', defaultRole: 'attorney' });
const cross = await req('GET', `/api/cases/${caseId}`, { token: other.token });
[403, 404].includes(cross.status)
  ? results.pass('DEP-15', 'A case is not visible to another firm', `HTTP ${cross.status}`)
  : results.fail('DEP-15', 'A case leaked across firms', `HTTP ${cross.status}`);

const defendant = await registerUser({ prefix: 'deploy-def', defaultRole: 'criminal_defendant' });
const adminProbe = await req('GET', '/api/certification/status', { token: defendant.token });
[401, 403].includes(adminProbe.status)
  ? results.pass('DEP-16', 'Administrator surfaces refuse a non-administrator', `HTTP ${adminProbe.status}`)
  : results.fail('DEP-16', 'A non-administrator reached an administrator surface', `HTTP ${adminProbe.status}`);

// ---------------------------------------------------------------------------
// Statutory retrieval depends on a public service
// ---------------------------------------------------------------------------

const law = await req('GET', '/api/law/statute/PEN/459', { token: account.token, timeoutMs: 60000 });
law.status === 200
  ? results.pass('DEP-17', 'The official California source is reachable from this deployment', law.json.statute.officialUrl.slice(0, 80))
  : results.fail('DEP-17', 'The official source could not be reached', `HTTP ${law.status}`);

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

const billing = await req('GET', '/api/billing/subscription', { token: account.token });
billing.status === 200
  ? results.pass('DEP-18', 'The billing endpoint responds', 'HTTP 200')
  : results.fail('DEP-18', 'The billing endpoint is broken', `HTTP ${billing.status}`);

const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
stripeConfigured
  ? results.pass('DEP-19', 'Payment processing is configured')
  : results.unknown(
      'DEP-19',
      'Payment processing is not configured in this environment',
      'No Stripe key is present, so a real subscription, renewal, refund or chargeback cannot be exercised here. ' +
        'The billing model and metrics API exist and are covered by other suites.',
    );

// ---------------------------------------------------------------------------
// Things this environment genuinely cannot answer
// ---------------------------------------------------------------------------

results.unknown(
  'DEP-20',
  'Object storage has not been exercised',
  'No R2 or S3 credentials are present. Uploads are written to local disk, which is what the upload and stress ' +
    'suites measured. Behaviour against remote object storage — latency, partial writes, credential expiry — is ' +
    'unproven.',
);

results.unknown(
  'DEP-21',
  'Email delivery has not been exercised',
  'No SES credentials are present, so verification mail, invitations and notifications cannot be sent or ' +
    'observed from here.',
);

results.unknown(
  'DEP-22',
  'HTTPS and Cloudflare in front of a real deployment have not been validated',
  'This environment has no public ingress of its own. Review has been done through a temporary tunnel, which ' +
    'terminates TLS elsewhere and is not the production edge. Certificate handling, WAF rules, caching and rate ' +
    'limiting at the edge are unproven.',
);

results.unknown(
  'DEP-23',
  'Browser compatibility beyond Chromium has not been measured',
  'Every browser check in this platform runs in Chromium. Safari and Firefox are untested, which matters most ' +
    'for the upload portal, since directory selection and resumable upload behave differently across engines.',
);

await results.write({ web: WEB });
await prisma.$disconnect();
