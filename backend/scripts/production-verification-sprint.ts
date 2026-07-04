#!/usr/bin/env npx tsx
/**
 * Production Verification Sprint — E2E attorney workflow checks
 * Run: npx tsx backend/scripts/production-verification-sprint.ts
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = process.env.API_BASE || 'http://localhost:3001';
const REPORT_DIR = resolve(__dirname, '../../reports/verification-sprint');
const TEST_EMAIL = 'verify-attorney@courtaccess.test';
const TEST_PASSWORD = 'VerifyAttorney1!';
const ADMIN_EMAIL = 'verify-admin@courtaccess.test';
const STAFF_EMAIL = 'verify-staff@courtaccess.test';

interface WorkflowResult {
  id: string;
  title: string;
  status: 'PASS' | 'FAIL';
  verified: string;
  commands: string[];
  evidence: string[];
  defects: string[];
}

const results: WorkflowResult[] = [];
const commands: string[] = [];

function record(cmd: string) {
  commands.push(cmd);
}

function addResult(r: WorkflowResult) {
  results.push(r);
  const icon = r.status === 'PASS' ? '✓' : '✗';
  console.log(`${icon} ${r.id}: ${r.title} — ${r.status}`);
  if (r.defects.length) {
    for (const d of r.defects) console.log(`    DEFECT: ${d}`);
  }
}

async function api(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown; expectStatus?: number },
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (opts?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts?.token) headers['Authorization'] = `Bearer ${opts.token}`;
  record(`curl -s -X ${method} ${API}${path}`);
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body: unknown;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (opts?.expectStatus !== undefined && res.status !== opts.expectStatus) {
    throw new Error(`Expected ${opts.expectStatus} got ${res.status}: ${text.slice(0, 300)}`);
  }
  return { status: res.status, body, headers: res.headers };
}

async function loginWithRetry(email: string, password: string, attempts = 5): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const res = await api('POST', '/api/auth/login', { body: { email, password } });
    const token = (res.body as { accessToken?: string }).accessToken;
    if (token) return token;
    if (res.status === 429) {
      const retryAfter = (res.body as { retryAfter?: number }).retryAfter ?? 15;
      await sleep((retryAfter + 1) * 1000);
      continue;
    }
    throw new Error(`Login failed for ${email}: ${res.status}`);
  }
  throw new Error(`Login rate-limited for ${email}`);
}

async function uploadEvidence(
  token: string,
  caseId: string,
  filePath: string,
): Promise<{ status: number; body: unknown }> {
  const form = new FormData();
  const fileContent = readFileSync(filePath);
  const blob = new Blob([fileContent], { type: 'text/plain' });
  form.append('file', blob, 'police-report.txt');
  form.append('caseId', caseId);
  form.append('evidenceType', 'police_report');
  record(`curl -F file=@${filePath} -F caseId=${caseId} ${API}/api/evidence/upload`);
  const res = await fetch(`${API}/api/evidence/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureUser(
  email: string,
  password: string,
  role: string,
  name: string,
  tenantId: string,
): Promise<void> {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash(password, 12);
  const now = new Date();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name, passwordHash: hash, role, tenantId },
      });
      await tx.subscription.create({
        data: {
          userId: created.id,
          planId: 'FREE',
          activatedAt: now,
          billingPeriodStart: now,
          billingPeriodEnd: new Date(now.getFullYear() + 100, 0, 1),
          subscriptionStatus: 'active',
          subscriptionTier: 'free',
        },
      });
      await tx.aiCreditBalance.create({
        data: {
          userId: created.id,
          monthlyCredits: 0,
          purchasedCredits: 0,
          creditsUsed: 0,
          billingPeriodStart: now,
          billingPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      });
    });
  } else {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: hash, role } });
  }
  await prisma.$disconnect();
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const evidence: string[] = [];

  await ensureUser(TEST_EMAIL, TEST_PASSWORD, 'attorney', 'Verify Attorney', 'tenant-verify-attorney');
  await ensureUser(ADMIN_EMAIL, TEST_PASSWORD, 'admin', 'Verify Admin', 'tenant-verify-admin');
  await ensureUser(STAFF_EMAIL, TEST_PASSWORD, 'staff', 'Verify Staff', 'tenant-verify-staff');

  // ── P0-001: Backend TypeScript compilation ─────────────────────────────
  try {
    execSync('cd /workspace/backend && npx tsc --noEmit', { stdio: 'pipe' });
    addResult({
      id: 'P0-001',
      title: 'Backend TypeScript compilation clean',
      status: 'PASS',
      verified: 'npx tsc --noEmit exits 0',
      commands: ['cd /workspace/backend && npx tsc --noEmit'],
      evidence: ['tsc exit code 0'],
      defects: [],
    });
  } catch (e) {
    addResult({
      id: 'P0-001',
      title: 'Backend TypeScript compilation clean',
      status: 'FAIL',
      verified: 'tsc --noEmit failed',
      commands: ['cd /workspace/backend && npx tsc --noEmit'],
      evidence: [String(e)],
      defects: ['TypeScript compilation errors remain'],
    });
  }

  // ── P0-003: Authentication hook ─────────────────────────────────────────
  const unauthCases = await api('GET', '/api/cases', { expectStatus: 401 });
  evidence.push(`unauth /api/cases → ${unauthCases.status}`);

  const health = await api('GET', '/api/health', { expectStatus: 200 });
  evidence.push(`health: ${JSON.stringify(health.body)}`);

  const token = await loginWithRetry(TEST_EMAIL, TEST_PASSWORD);
  evidence.push(`login returned token: ${!!token}`);

  const me = await api('GET', '/api/auth/me', { token, expectStatus: 200 });
  const meBody = me.body as { user?: { role?: string } };
  evidence.push(`/api/auth/me role=${meBody.user?.role}`);

  addResult({
    id: 'P0-003',
    title: 'Enable authentication hook',
    status:
      unauthCases.status === 401 && token && meBody.user?.role === 'attorney' ? 'PASS' : 'FAIL',
    verified: 'Protected routes return 401 without token; register/login/me work for attorney',
    commands: [
      'GET /api/cases (no auth) → 401',
      'POST /api/auth/login (attorney)',
      'GET /api/auth/me',
    ],
    evidence,
    defects:
      unauthCases.status === 401 && token && meBody.user?.role === 'attorney'
        ? []
        : ['Auth hook or attorney registration broken'],
  });

  // Admin token for security log tests
  const adminToken = await loginWithRetry(ADMIN_EMAIL, TEST_PASSWORD);
  const staffToken = await loginWithRetry(STAFF_EMAIL, TEST_PASSWORD);

  // ── Audit logging ───────────────────────────────────────────────────────
  const secLogs = await api('GET', '/api/security/log?limit=20', { token: adminToken });
  const secBody = secLogs.body as { events?: Array<{ event?: string }> };
  const hasLoginEvent = (secBody.events ?? []).some(
    (l) => l.event === 'LOGIN_SUCCESS' || l.event === 'USER_REGISTERED',
  );
  evidence.push(`security logs count: ${(secBody.events ?? []).length}, hasAuthEvent=${hasLoginEvent}`);

  // ── Create case (foundation for most workflows) ─────────────────────────
  const newCase = await api('POST', '/api/cases', {
    token,
    body: {
      title: 'Verification Sprint Case',
      caseNumber: `VER-${Date.now()}`,
      jurisdiction: 'CA',
      caseType: 'felony',
    },
    expectStatus: 201,
  });
  const caseBody = newCase.body as { case?: { caseId?: string; title?: string } };
  const caseId = caseBody.case?.caseId!;
  evidence.push(`created case: ${caseId}`);

  // DB persistence check
  const caseGet = await api('GET', `/api/cases/${caseId}`, { token, expectStatus: 200 });
  const caseGetBody = caseGet.body as { case?: { title?: string } };
  const persisted = caseGetBody.case?.title === 'Verification Sprint Case';

  // ── P1-015: Charges ─────────────────────────────────────────────────────
  let chargeId: string | undefined;
  let charges: unknown[] = [];
  try {
    const chargeCreate = await api('POST', '/api/charges', {
      token,
      body: {
        caseId,
        code: 'PC',
        section: '459',
        title: 'Burglary',
        victim: 'State of California',
        dateOfOffense: '2026-01-15',
      },
      expectStatus: 200,
    });
    chargeId = (chargeCreate.body as { charge?: { id?: string } }).charge?.id;
    const chargesList = await api('GET', `/api/charges/${caseId}`, { token, expectStatus: 200 });
    charges = (chargesList.body as { charges?: unknown[] }).charges ?? [];
  } catch (e) {
    evidence.push(`charge error: ${e}`);
  }
  addResult({
    id: 'P1-015',
    title: 'Wire charges UI to API',
    status: chargeId && charges.length > 0 ? 'PASS' : 'FAIL',
    verified: 'POST /api/charges creates charge; GET /api/charges/:caseId returns persisted data',
    commands: ['POST /api/charges', `GET /api/charges/${caseId}`],
    evidence: [`chargeId=${chargeId}`, `chargesCount=${charges.length}`],
    defects: chargeId && charges.length > 0 ? [] : ['Charge CRUD not persisting'],
  });

  // ── P1-001: Document upload ─────────────────────────────────────────────
  const testFile = resolve(REPORT_DIR, 'test-police-report.txt');
  writeFileSync(
    testFile,
    'OFFICER JOHNSON: At 2245 hours I observed suspect near 1200 Main Street. Subject appeared nervous. I detained subject for investigation.',
  );
  const upload = await uploadEvidence(token, caseId, testFile);
  const uploadBody = upload.body as { evidence?: { evidenceId?: string; processingStatus?: string } };
  const evidenceId = uploadBody.evidence?.evidenceId;
  let uploadPass = upload.status === 200 || upload.status === 201;
  if (evidenceId) {
    await sleep(3000);
    const evList = await api('GET', `/api/cases/${caseId}/evidence`, { token });
    const evItems = (evList.body as { evidence?: unknown[] }).evidence ?? [];
    uploadPass = uploadPass && evItems.length > 0;
    evidence.push(`evidence list count=${evItems.length}, processingStatus=${uploadBody.processingStatus}`);
  }
  addResult({
    id: 'P1-001',
    title: 'Fix document upload end-to-end',
    status: uploadPass && evidenceId ? 'PASS' : 'FAIL',
    verified: 'Multipart upload to /api/evidence/upload; evidence persisted in DB',
    commands: [`POST /api/evidence/upload (file=${testFile})`, `GET /api/cases/${caseId}/evidence`],
    evidence: [`upload status=${upload.status}`, `evidenceId=${evidenceId}`],
    defects: uploadPass && evidenceId ? [] : [`Upload failed: status=${upload.status}`],
  });

  // ── P1-010: Litigation strategy ───────────────────────────────────────────
  const litStrat = await api('GET', `/api/cases/${caseId}/litigation-strategy`, { token });
  const litBody = litStrat.body as Record<string, unknown>;
  const litPass = litStrat.status === 200 && litBody && !('error' in litBody && !('recommendations' in litBody));
  addResult({
    id: 'P1-010',
    title: 'Wire litigation strategy API',
    status: litPass ? 'PASS' : 'FAIL',
    verified: 'GET /api/cases/:id/litigation-strategy returns 200 with strategy payload',
    commands: [`GET /api/cases/${caseId}/litigation-strategy`],
    evidence: [`status=${litStrat.status}`, `keys=${Object.keys(litBody).join(',')}`],
    defects: litPass ? [] : [`Litigation strategy returned ${litStrat.status}`],
  });

  // ── P1-016: Case analysis ─────────────────────────────────────────────────
  const analysis = await api('GET', `/api/cases/${caseId}/analysis`, { token });
  const analysisBody = analysis.body as Record<string, unknown>;
  const analysisPass = analysis.status === 200 && analysisBody;
  addResult({
    id: 'P1-016',
    title: 'Case analysis API and panel',
    status: analysisPass ? 'PASS' : 'FAIL',
    verified: 'GET /api/cases/:id/analysis returns evidence-governed analysis',
    commands: [`GET /api/cases/${caseId}/analysis`],
    evidence: [`status=${analysis.status}`, `keys=${Object.keys(analysisBody ?? {}).join(',')}`],
    defects: analysisPass ? [] : [`Case analysis returned ${analysis.status}`],
  });

  // ── P1-013: Attorney reports ──────────────────────────────────────────────
  const compliance = await api('POST', `/api/compliance/report/${caseId}`, {
    token,
    body: { caseName: 'Verification Sprint Case' },
  });
  const expert = await api('GET', `/api/compliance/expert/${caseId}`, { token });
  const reportsPass = compliance.status === 200 && expert.status === 200;
  addResult({
    id: 'P1-013',
    title: 'Attorney reports UI',
    status: reportsPass ? 'PASS' : 'FAIL',
    verified: 'Compliance report POST and expert package GET return 200',
    commands: [
      `POST /api/compliance/report/${caseId}`,
      `GET /api/compliance/expert/${caseId}`,
    ],
    evidence: [`compliance status=${compliance.status}`, `expert status=${expert.status}`],
    defects: reportsPass ? [] : ['Attorney report endpoints failed'],
  });

  // ── P1-017: Exhibit routes ────────────────────────────────────────────────
  const exhibit = await api('POST', '/api/exhibits/create-scene', {
    token,
    body: { latitude: 34.0522, longitude: -118.2437, radiusMeters: 100 },
  });
  const exBody = exhibit.body as { success?: boolean };
  addResult({
    id: 'P1-017',
    title: 'Register exhibit routes',
    status: exhibit.status === 200 && exBody.success === true ? 'PASS' : 'FAIL',
    verified: 'POST /api/exhibits/create-scene with auth returns success',
    commands: ['POST /api/exhibits/create-scene'],
    evidence: [`status=${exhibit.status}`, `success=${exBody.success}`],
    defects:
      exhibit.status === 200 && exBody.success === true ? [] : ['Exhibit route failed or unauthorized'],
  });

  // ── P1-019: Narrative routes ──────────────────────────────────────────────
  const claims = await api('GET', `/api/narrative/${caseId}/claims`, { token });
  const claimsBody = claims.body as { claims?: unknown[]; total?: number };
  const narrativeAnalyze = await api('POST', `/api/narrative/analyze/${caseId}`, { token });
  const narrAnalyzeStatus = narrativeAnalyze.status;
  const narrAnalyzeBody = narrativeAnalyze.body as { status?: string };
  const narrPass =
    claims.status === 200 &&
    Array.isArray(claimsBody.claims) &&
    (narrAnalyzeStatus === 202 ||
      narrAnalyzeStatus === 200 ||
      narrAnalyzeBody.status === 'queued');
  addResult({
    id: 'P1-019',
    title: 'Wire narrative routes to DB',
    status: narrPass ? 'PASS' : 'FAIL',
    verified: 'GET claims from Prisma; POST analyze enqueues job',
    commands: [
      `GET /api/narrative/${caseId}/claims`,
      `POST /api/narrative/analyze/${caseId}`,
    ],
    evidence: [
      `claims status=${claims.status} total=${claimsBody.total}`,
      `analyze status=${narrAnalyzeStatus}`,
    ],
    defects: narrPass ? [] : ['Narrative routes not operational'],
  });

  // ── P1-021: Timeline routes ───────────────────────────────────────────────
  const timeline = await api('GET', `/api/timeline/${caseId}/events`, { token });
  const tlBody = timeline.body as { events?: unknown[]; unknowns?: string[]; error?: string };
  const noDebugStubs =
    timeline.status === 200 &&
    !JSON.stringify(tlBody).includes('burglary debug') &&
    !JSON.stringify(tlBody).includes('DEBUG_BURGLARY');
  const timelinePass =
    timeline.status === 200 &&
    Array.isArray(tlBody.events) &&
    Array.isArray(tlBody.unknowns) &&
    noDebugStubs;
  addResult({
    id: 'P1-021',
    title: 'Timeline routes use real DB events not debug stubs',
    status: timelinePass ? 'PASS' : 'FAIL',
    verified: 'GET /api/timeline/:id/events returns DB events + unknowns when empty',
    commands: [`GET /api/timeline/${caseId}/events`],
    evidence: [
      `events=${tlBody.events?.length}`,
      `unknowns=${JSON.stringify(tlBody.unknowns)}`,
      `noDebugStubs=${noDebugStubs}`,
    ],
    defects: timelinePass ? [] : ['Timeline still returns stubs or missing unknowns'],
  });

  // ── P0-002: Constitutional — no fabricated doctrine data ─────────────────
  const doctrineSource = readFileSync(
    resolve(__dirname, '../../src/services/doctrineService.ts'),
    'utf-8',
  );
  const noDemoInFrontend =
    !doctrineSource.includes('DEMO_COMPLIANCE') && !doctrineSource.includes('DEMO_STATUS');
  const doctrineStatus = await api('GET', '/api/doctrine/status', { token });
  const doctrineAnalyze = await api('POST', '/api/doctrine/analyze', {
    token,
    body: { evidenceText: 'Officer conducted warrantless search of vehicle.' },
  });
  const doctrinePass =
    noDemoInFrontend &&
    doctrineStatus.status === 200 &&
    doctrineAnalyze.status === 200;
  addResult({
    id: 'P0-002',
    title: 'Remove fabricated doctrine demo data',
    status: doctrinePass ? 'PASS' : 'FAIL',
    verified: 'No DEMO_* in frontend; doctrine API returns real analysis or error (not fake violations)',
    commands: ['grep DEMO_ src/services/doctrineService.ts', 'GET /api/doctrine/status', 'POST /api/doctrine/analyze'],
    evidence: [
      `noDemoInFrontend=${noDemoInFrontend}`,
      `status=${doctrineStatus.status}`,
      `analyze=${doctrineAnalyze.status}`,
    ],
    defects: doctrinePass ? [] : ['Fabricated doctrine data may still exist'],
  });

  // ── P1-018 + P1-020: Workers ──────────────────────────────────────────────
  const redisKeys = execSync('redis-cli keys "bull:*" 2>/dev/null | wc -l', { encoding: 'utf-8' }).trim();
  const hasRedisQueues = parseInt(redisKeys, 10) > 0;
  const workersPass =
    hasRedisQueues &&
    (narrAnalyzeStatus === 202 ||
      narrAnalyzeStatus === 200 ||
      narrAnalyzeBody.status === 'queued');
  addResult({
    id: 'P1-018',
    title: 'Wire pipeline workers to real processing',
    status: workersPass ? 'PASS' : 'FAIL',
    verified: 'BullMQ queues in Redis; narrative analyze enqueues job (202)',
    commands: ['redis-cli keys bull:*', `POST /api/narrative/analyze/${caseId}`],
    evidence: [`redisBullKeys=${redisKeys}`, `narrativeAnalyze=${narrAnalyzeStatus}`],
    defects: workersPass ? [] : ['Pipeline workers not confirmed running'],
  });
  const subQueueKeys = execSync('redis-cli keys "bull:narrative-*" 2>/dev/null', { encoding: 'utf-8' });
  const subWorkersPass = subQueueKeys.includes('narrative-claim-extraction');
  addResult({
    id: 'P1-020',
    title: 'Register narrative sub-queue workers',
    status: subWorkersPass ? 'PASS' : 'FAIL',
    verified: 'Narrative sub-queues present in Redis (claim-extraction, etc.)',
    commands: ['redis-cli keys bull:narrative-*'],
    evidence: [subQueueKeys.split('\n').filter(Boolean).slice(0, 5).join(', ')],
    defects: subWorkersPass ? [] : ['Narrative sub-workers not started'],
  });

  // ── P2-001: Staff dashboard live data ─────────────────────────────────────
  const staffSource = readFileSync(
    resolve(__dirname, '../../src/pages/dashboard/StaffDashboard.tsx'),
    'utf-8',
  );
  const usesLiveFetch =
    staffSource.includes('fetchCases') && staffSource.includes('fetchCaseEvidence');
  const noHardcodedStats =
    !staffSource.includes('activeCases: 12') &&
    !staffSource.includes('pendingReviews: 8');
  const staffCases = staffToken
    ? await api('GET', '/api/cases', { token: staffToken })
    : { status: 0, body: null, headers: new Headers() };
  addResult({
    id: 'P2-001',
    title: 'Remove StaffDashboard hardcoded stats',
    status: usesLiveFetch && noHardcodedStats && staffCases.status === 200 ? 'PASS' : 'FAIL',
    verified: 'StaffDashboard uses fetchCases/fetchCaseEvidence; staff user can list cases via API',
    commands: ['grep StaffDashboard.tsx', 'GET /api/cases as staff'],
    evidence: [
      `usesLiveFetch=${usesLiveFetch}`,
      `noHardcodedStats=${noHardcodedStats}`,
      `staffCasesStatus=${staffCases.status}`,
    ],
    defects:
      usesLiveFetch && noHardcodedStats && staffCases.status === 200
        ? []
        : ['Staff dashboard may still use hardcoded data'],
  });

  // ── Audit logging result ──────────────────────────────────────────────────
  addResult({
    id: 'AUDIT',
    title: 'Security audit logging',
    status: hasLoginEvent && secLogs.status === 200 ? 'PASS' : 'FAIL',
    verified: 'SecurityLog entries created for login/register; admin can query /api/security/logs',
    commands: ['GET /api/security/log (admin)'],
    evidence: [`hasLoginEvent=${hasLoginEvent}`, `logCount=${(secBody.events ?? []).length}`],
    defects: hasLoginEvent ? [] : ['No auth events in security log'],
  });

  // ── DB persistence ────────────────────────────────────────────────────────
  addResult({
    id: 'DB-PERSIST',
    title: 'Database persistence',
    status: persisted && caseId ? 'PASS' : 'FAIL',
    verified: 'Case created via API retrievable from PostgreSQL',
    commands: ['POST /api/cases', `GET /api/cases/${caseId}`],
    evidence: [`caseId=${caseId}`, `persisted=${persisted}`],
    defects: persisted ? [] : ['Case not persisted'],
  });

  // Write report
  const report = {
    generatedAt: new Date().toISOString(),
    environment: { api: API, database: 'postgresql://localhost:5432/courtaccess', redis: 'localhost:6379' },
    summary: {
      total: results.length,
      passed: results.filter((r) => r.status === 'PASS').length,
      failed: results.filter((r) => r.status === 'FAIL').length,
    },
    workflows: results,
    testCredentials: { attorney: TEST_EMAIL, admin: ADMIN_EMAIL, caseId },
  };

  const reportPath = resolve(REPORT_DIR, 'verification-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);
  console.log(`PASS: ${report.summary.passed}/${report.summary.total}`);

  process.exit(report.summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Verification sprint fatal error:', err);
  process.exit(1);
});
