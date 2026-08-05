#!/usr/bin/env node
// Phase 7 — Security certification.
//
// Exercises the boundaries that matter for a multi-tenant litigation system:
// one firm must never reach another firm's case or evidence, a role must not
// exceed its permissions, tokens must be validated properly, and abuse
// controls must actually engage.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, login, API, OUT_DIR, exercisedApiRoutes } from './lib/harness.mjs';

const results = new Results('SECURITY_CERTIFICATION', 'Phase 7 — Security Testing');

// ---------------------------------------------------------------------------
// Two independent tenants, each with a case and a piece of evidence
// ---------------------------------------------------------------------------

async function makeTenant(prefix, role = 'attorney') {
  const user = await registerUser({ prefix, defaultRole: role });
  if (!user.token) throw new Error(`registration failed for ${prefix}: ${user.status} ${user.raw?.text}`);
  const c = await req('POST', '/api/cases', {
    token: user.token,
    body: {
      title: `${prefix} matter`,
      caseNumber: `${prefix.toUpperCase()}-${Date.now()}`,
      jurisdiction: 'Alameda County',
      caseType: 'felony',
    },
  });
  if (c.status !== 201) throw new Error(`case creation failed for ${prefix}: ${c.status} ${c.text}`);

  const form = new FormData();
  form.append('caseId', c.json.case.caseId);
  form.append('evidenceType', 'police_report');
  form.append('file', new Blob([await readFile('/tmp/courtaccess-fixtures/police-report.pdf')], { type: 'application/pdf' }), 'police-report.pdf');
  exercisedApiRoutes.add('POST /api/evidence/upload');
  const up = await fetch(`${API}/api/evidence/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}` },
    body: form,
  });
  exercisedApiRoutes.add('POST /api/evidence/upload');
  const upJson = await up.json();

  return {
    ...user,
    caseId: c.json.case.caseId,
    evidenceId: upJson.evidence?.evidenceId,
  };
}

const firmA = await makeTenant('firm-a');
const firmB = await makeTenant('firm-b');
console.log(`firm A tenant=${firmA.user?.tenantId} case=${firmA.caseId}`);
console.log(`firm B tenant=${firmB.user?.tenantId} case=${firmB.caseId}\n`);

if (firmA.user?.tenantId === firmB.user?.tenantId) {
  results.fail(
    'SEC-TENANT-00',
    'Independent registrations must land in separate tenants',
    `both users share tenant ${firmA.user?.tenantId}`,
  );
}

// ---------------------------------------------------------------------------
// Cross-tenant access
// ---------------------------------------------------------------------------

const denied = (r) => r.status === 403 || r.status === 404;

const crossChecks = [
  ['GET', `/api/cases/${firmB.caseId}`, 'read another firm\'s case'],
  ['PATCH', `/api/cases/${firmB.caseId}`, 'modify another firm\'s case', { title: 'hijacked' }],
  ['DELETE', `/api/cases/${firmB.caseId}`, 'delete another firm\'s case'],
  ['GET', `/api/cases/${firmB.caseId}/evidence`, 'list another firm\'s evidence'],
  ['GET', `/api/evidence/${firmB.evidenceId}`, 'read another firm\'s evidence record'],
  ['DELETE', `/api/evidence/${firmB.evidenceId}`, 'delete another firm\'s evidence'],
  ['GET', `/api/timeline/${firmB.caseId}`, 'read another firm\'s timeline'],
  ['GET', `/api/cases/${firmB.caseId}/evidence-requests`, 'read another firm\'s evidence requests'],
  ['GET', `/api/charges/${firmB.caseId}`, 'read another firm\'s charges'],
  ['GET', `/api/contradiction/graph/${firmB.caseId}`, 'read another firm\'s contradiction graph'],
  ['GET', `/api/workbench/cases/${firmB.caseId}/notes`, 'read another firm\'s workbench notes'],
];

for (const [method, url, label, body] of crossChecks) {
  const res = await req(method, url, { token: firmA.token, body });
  if (denied(res)) {
    results.pass(`SEC-TENANT-${label}`, `Firm A cannot ${label}`, `HTTP ${res.status}`);
  } else if (res.status === 401) {
    results.warn(`SEC-TENANT-${label}`, `Firm A cannot ${label}`, 'HTTP 401 — route rejected the session entirely');
  } else if (res.status >= 500) {
    results.warn(
      `SEC-TENANT-${label}`,
      `Cross-tenant attempt to ${label} produced a server error`,
      `HTTP ${res.status}: ${(res.text || '').slice(0, 140)}`,
    );
  } else {
    results.fail(
      `SEC-TENANT-${label}`,
      `TENANT ISOLATION BREACH: Firm A could ${label}`,
      `HTTP ${res.status}: ${(res.text || '').slice(0, 200)}`,
      { method, url, status: res.status, body: (res.text || '').slice(0, 600) },
    );
  }
}

// Listing must never include another tenant's records.
const listA = await req('GET', '/api/cases', { token: firmA.token });
const leaked = (listA.json?.cases ?? []).filter((c) => c.caseId === firmB.caseId);
if (leaked.length === 0) {
  results.pass('SEC-TENANT-LIST', 'Case list is scoped to the caller\'s tenant', `${listA.json?.cases?.length ?? 0} cases returned, none belonging to firm B`);
} else {
  results.fail('SEC-TENANT-LIST', 'TENANT ISOLATION BREACH: case list exposed another tenant', JSON.stringify(leaked).slice(0, 300));
}

// ---------------------------------------------------------------------------
// Token handling
// ---------------------------------------------------------------------------

const tokenChecks = [
  ['garbage token', 'not-a-jwt-at-all'],
  ['well-formed JWT signed with the wrong key',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhdHRhY2tlciIsInRlbmFudElkIjoidGVuYW50LXgiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODU5NjAwMDAsImV4cCI6MTk5OTk5OTk5OX0.ZmFrZXNpZ25hdHVyZQ'],
  ['alg=none token',
    'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOiJhdHRhY2tlciIsInRlbmFudElkIjoidGVuYW50LXgiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE5OTk5OTk5OTl9.'],
];

for (const [label, token] of tokenChecks) {
  const res = await req('GET', '/api/cases', { token });
  if (res.status === 401 || res.status === 403) {
    results.pass(`SEC-TOKEN-${label}`, `Rejects ${label}`, `HTTP ${res.status}`);
  } else {
    results.fail(`SEC-TOKEN-${label}`, `AUTH BYPASS: accepted ${label}`, `HTTP ${res.status}: ${(res.text || '').slice(0, 200)}`);
  }
}

// A token belonging to a deleted/unknown subject must not authorise anything.
const meA = await req('GET', '/api/auth/me', { token: firmA.token });
if (meA.status === 200 && meA.json?.user?.tenantId === firmA.user?.tenantId) {
  results.pass('SEC-TOKEN-IDENTITY', 'Session reports the caller\'s own tenant', meA.json.user.tenantId);
} else {
  results.fail('SEC-TOKEN-IDENTITY', 'Session identity did not round-trip', `HTTP ${meA.status}`);
}

// ---------------------------------------------------------------------------
// Role-based access control
// ---------------------------------------------------------------------------

const roleProbe = [
  ['/api/admin/stats', 'admin statistics'],
  ['/api/admin/users', 'the user directory'],
  ['/api/admin/cases', 'every case in the system'],
  ['/api/security/logs', 'the security audit log'],
  ['/api/security/summary', 'the security summary'],
];

for (const [url, label] of roleProbe) {
  const res = await req('GET', url, { token: firmA.token });
  if (res.status === 403) {
    results.pass(`SEC-RBAC-${url}`, `An attorney cannot read ${label}`, 'HTTP 403');
  } else if (res.status === 404) {
    results.warn(`SEC-RBAC-${url}`, `${url} not mounted`, 'HTTP 404');
  } else if (res.status === 200) {
    results.fail(
      `SEC-RBAC-${url}`,
      `PRIVILEGE ESCALATION: an attorney could read ${label}`,
      `HTTP 200: ${(res.text || '').slice(0, 200)}`,
      { url, body: (res.text || '').slice(0, 800) },
    );
  } else {
    results.warn(`SEC-RBAC-${url}`, `Unexpected status reading ${label}`, `HTTP ${res.status}`);
  }
}

// A defendant is the least-privileged role and must not reach case management.
const defendant = await registerUser({ prefix: 'defendant', defaultRole: 'defendant' });
if (defendant.token) {
  for (const [url, label] of [
    ['/api/admin/stats', 'admin statistics'],
    [`/api/cases/${firmA.caseId}`, 'an unrelated case'],
  ]) {
    const res = await req('GET', url, { token: defendant.token });
    if (res.status === 403 || res.status === 404) {
      results.pass(`SEC-RBAC-DEFENDANT-${url}`, `A defendant cannot read ${label}`, `HTTP ${res.status}`);
    } else if (res.status === 200) {
      results.fail(`SEC-RBAC-DEFENDANT-${url}`, `PRIVILEGE ESCALATION: a defendant could read ${label}`, `HTTP 200`);
    } else {
      results.warn(`SEC-RBAC-DEFENDANT-${url}`, `Unexpected status for defendant reading ${label}`, `HTTP ${res.status}`);
    }
  }
} else {
  results.unknown('SEC-RBAC-DEFENDANT', 'Defendant role checks', `could not register a defendant: HTTP ${defendant.status}`);
}

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

const wrongPassword = await login(firmA.email, 'ObviouslyWrongPassword123!');
if (wrongPassword.status === 401 || wrongPassword.status === 403) {
  results.pass('SEC-CRED-01', 'Wrong password is rejected', `HTTP ${wrongPassword.status}`);
} else {
  results.fail('SEC-CRED-01', 'Wrong password was not rejected', `HTTP ${wrongPassword.status}`);
}

const unknownUser = await login('does-not-exist@certification.test', 'Whatever123!');
const sameShape =
  unknownUser.status === wrongPassword.status &&
  (unknownUser.raw.json?.error ?? '') === (wrongPassword.raw.json?.error ?? '');
if (sameShape) {
  results.pass(
    'SEC-CRED-02',
    'Login does not reveal whether an account exists',
    `both cases return HTTP ${unknownUser.status} with the same message`,
  );
} else {
  results.warn(
    'SEC-CRED-02',
    'Login responses differ for unknown accounts and wrong passwords',
    `unknown=${unknownUser.status}/${unknownUser.raw.json?.error} wrong=${wrongPassword.status}/${wrongPassword.raw.json?.error}`,
  );
}

// Password hashes and secrets must never appear in a response body.
const meBody = meA.text ?? '';
if (/passwordHash|\$2[aby]\$|mfaSecret/i.test(meBody)) {
  results.fail('SEC-CRED-03', 'Session response leaked credential material', meBody.slice(0, 200));
} else {
  results.pass('SEC-CRED-03', 'Session response contains no credential material');
}

// ---------------------------------------------------------------------------
// Abuse controls
// ---------------------------------------------------------------------------

let loginLimited = false;
let attempts = 0;
for (let i = 0; i < 40; i++) {
  const r = await req('POST', '/api/auth/login', {
    body: { email: firmA.email, password: `wrong-${i}` },
  });
  attempts++;
  if (r.status === 429) {
    loginLimited = true;
    break;
  }
}
if (loginLimited) {
  results.pass('SEC-RATE-01', 'Repeated failed logins are throttled', `HTTP 429 after ${attempts} attempts`);
} else {
  results.fail('SEC-RATE-01', 'Failed logins are never throttled', `${attempts} consecutive wrong passwords accepted without a 429`);
}

// ---------------------------------------------------------------------------
// Injection and traversal
// ---------------------------------------------------------------------------

const injection = await req('GET', `/api/cases/${encodeURIComponent("' OR '1'='1")}`, { token: firmA.token });
if (injection.status >= 500) {
  results.warn('SEC-INJECT-01', 'SQL-style input produced a server error', `HTTP ${injection.status}`);
} else if (injection.status === 200 && injection.json?.case) {
  results.fail('SEC-INJECT-01', 'SQL-style input returned a case', `HTTP 200`);
} else {
  results.pass('SEC-INJECT-01', 'SQL-style input is handled safely', `HTTP ${injection.status}`);
}

// Path traversal through the evidence filename must not escape the tenant dir.
{
  const form = new FormData();
  form.append('caseId', firmA.caseId);
  form.append('evidenceType', 'other_document');
  form.append('file', new Blob([Buffer.from('traversal probe')], { type: 'text/plain' }), '../../../../tmp/escaped.txt');
  exercisedApiRoutes.add('POST /api/evidence/upload');
  const res = await fetch(`${API}/api/evidence/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${firmA.token}` },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  const stored = body.evidence?.s3Key ?? '';
  if (res.status === 201 && !stored.includes('..')) {
    results.pass('SEC-TRAVERSAL-01', 'Traversal sequences in filenames are neutralised', `stored as ${stored}`);
  } else if (res.status >= 400) {
    results.pass('SEC-TRAVERSAL-01', 'Traversal filename rejected', `HTTP ${res.status}`);
  } else {
    results.fail('SEC-TRAVERSAL-01', 'Traversal sequence survived into the storage key', stored);
  }
}

// ---------------------------------------------------------------------------
// Transport / response headers
// ---------------------------------------------------------------------------

const headerRes = await req('GET', '/api/health');
const h = headerRes.headers ?? {};
for (const [name, label] of [
  ['x-content-type-options', 'X-Content-Type-Options'],
  ['x-frame-options', 'X-Frame-Options'],
  ['content-security-policy', 'Content-Security-Policy'],
  ['strict-transport-security', 'Strict-Transport-Security'],
]) {
  if (h[name]) {
    results.pass(`SEC-HEADER-${label}`, `${label} is set`, h[name].slice(0, 80));
  } else {
    results.warn(`SEC-HEADER-${label}`, `${label} is absent`, 'header not present on API responses');
  }
}

// Internal error detail must not reach the client.
const errProbe = await req('POST', '/api/auth/accept-invitation', { headers: { 'content-type': 'application/json' } });
const errText = errProbe.text ?? '';
if (/prisma\.|\/workspace\/|at Object\.|node_modules/i.test(errText)) {
  results.fail(
    'SEC-LEAK-01',
    'A malformed request leaked internal implementation detail',
    errText.slice(0, 220),
    { status: errProbe.status, body: errText.slice(0, 800) },
  );
} else {
  results.pass('SEC-LEAK-01', 'Malformed request does not leak internal detail', `HTTP ${errProbe.status}`);
}

await results.write({
  // Recorded so the throttling result cannot be misread: the login limit that
  // SEC-RATE-01 measures was left at the product default. Only the
  // registration and upload limits were raised, because the suite has to
  // create several accounts in quick succession.
  rateLimitConfiguration: {
    login: 'product default (RATE_LIMIT_LOGIN_PER_MINUTE unset)',
    general: 'product default (RATE_LIMIT_GENERAL_PER_MINUTE unset)',
    register: 'raised to 500/min for test throughput',
    upload: 'raised to 500/min for test throughput',
  },
  tenants: {
    firmA: { tenantId: firmA.user?.tenantId, caseId: firmA.caseId },
    firmB: { tenantId: firmB.user?.tenantId, caseId: firmB.caseId },
  },
});
