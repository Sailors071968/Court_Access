#!/usr/bin/env node
// Program 144, Phase 10 — defendant and family access.
//
// A defendant and a family member see the case through a portal. What they may
// see is narrower than what the defence team sees, and a family member's
// access is narrower still. This suite measures what each role can actually
// reach, rather than what the role table says it should.

import { readFile } from 'node:fs/promises';
import { Results, req, registerUser, login, API, exercisedApiRoutes } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('PORTAL_PERMISSIONS_CERTIFICATION', 'Program 144 — Defendant and Family Access');

// The defence team and their case.
const attorney = await registerUser({ prefix: 'portal-atty', defaultRole: 'attorney' });
const attorneySession = await login(attorney.email, attorney.password);
const attorneyToken = attorneySession.token;

const created = await req('POST', '/api/cases', {
  token: attorneyToken,
  body: {
    title: 'People v. Doe — portal certification',
    caseNumber: `PORT-${Date.now()}`,
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
const caseId = created.json.case.caseId;

const form = new FormData();
form.append('caseId', caseId);
form.append('evidenceType', 'police_report');
form.append('file', new Blob([await readFile('/tmp/courtaccess-fixtures/police-report.pdf')], { type: 'application/pdf' }), 'police-report.pdf');
exercisedApiRoutes.add('POST /api/evidence/upload');
await fetch(`${API}/api/evidence/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${attorneyToken}` },
  body: form,
});
await new Promise((r) => setTimeout(r, 4000));

// The portal roles.
const defendant = await registerUser({ prefix: 'portal-def', defaultRole: 'criminal_defendant' });
const family = await registerUser({ prefix: 'portal-fam', defaultRole: 'family_member' });

const roleOf = (u) => JSON.parse(Buffer.from(u.token.split('.')[1], 'base64').toString()).role;
const defendantRole = roleOf(defendant);
const familyRole = roleOf(family);

console.log(`attorney tenant  ${attorney.user.tenantId}`);
console.log(`defendant role   ${defendantRole}`);
console.log(`family role      ${familyRole}\n`);

// ---------------------------------------------------------------------------
// Registration must place each role correctly
// ---------------------------------------------------------------------------

defendantRole === 'defendant'
  ? results.pass('PORT-01', 'A criminal defendant registers into the least-privileged role', `platform role "${defendantRole}"`)
  : results.fail('PORT-01', 'A criminal defendant did not receive the defendant role', `got "${defendantRole}"`);

// A family member supports a defendant; they are not a member of a law firm.
familyRole === 'defendant'
  ? results.pass(
      'PORT-02',
      'A family member registers into a portal role, not a law-firm role',
      `platform role "${familyRole}"`,
    )
  : results.fail(
      'PORT-02',
      'A family member receives a law-firm role',
      `platform role "${familyRole}" — this is the role held by paralegals and office administrators, ` +
        'and it carries firm-wide client and organisation access',
    );

// ---------------------------------------------------------------------------
// Neither may reach the defence team's case
// ---------------------------------------------------------------------------

const CASE_VIEWS = [
  ['the case record', `/api/cases/${caseId}`],
  ['its evidence', `/api/cases/${caseId}/evidence`],
  ['the attorney workbench', `/api/cases/${caseId}/workbench`],
  ['the timeline', `/api/timeline/${caseId}/events`],
  ['compliance findings', `/api/compliance/findings/${caseId}`],
];

for (const [who, token] of [['defendant', defendant.token], ['family member', family.token]]) {
  const reached = [];
  for (const [label, url] of CASE_VIEWS) {
    const res = await req('GET', url, { token, timeoutMs: 30000 });
    if (res.status === 200 && (res.text ?? '').includes(caseId)) reached.push(label);
  }
  reached.length === 0
    ? results.pass(
        `PORT-03-${who}`,
        `An unconnected ${who} cannot reach the defence team's case`,
        `${CASE_VIEWS.length} views probed, all refused`,
      )
    : results.fail(
        `PORT-03-${who}`,
        `An unconnected ${who} reached the defence team's case`,
        reached.join(', '),
      );
}

// ---------------------------------------------------------------------------
// Firm-level surfaces must not be reachable from a portal role
// ---------------------------------------------------------------------------

const FIRM_SURFACES = [
  ['the client list', '/api/clients'],
  ['organisation members', '/api/organizations/members'],
  ['the firm platform', '/api/firm/overview'],
  ['organisation offices', '/api/organizations/offices'],
];

for (const [who, token] of [['defendant', defendant.token], ['family member', family.token]]) {
  const reached = [];
  for (const [label, url] of FIRM_SURFACES) {
    const res = await req('GET', url, { token, timeoutMs: 30000 });
    if (res.status === 200) reached.push(`${label} (HTTP 200)`);
  }
  reached.length === 0
    ? results.pass(
        `PORT-04-${who}`,
        `A ${who} cannot reach firm-level surfaces`,
        `${FIRM_SURFACES.length} probed, all refused`,
      )
    : results.fail(
        `PORT-04-${who}`,
        `A ${who} can reach firm-level surfaces`,
        reached.join(', '),
      );
}

// ---------------------------------------------------------------------------
// Administration must be closed to both
// ---------------------------------------------------------------------------

for (const [who, token] of [['defendant', defendant.token], ['family member', family.token]]) {
  const admin = await req('GET', '/api/admin/users', { token });
  admin.status === 403
    ? results.pass(`PORT-05-${who}`, `A ${who} cannot read the user directory`, 'HTTP 403')
    : results.fail(`PORT-05-${who}`, `A ${who} reached the user directory`, `HTTP ${admin.status}`);
}

// ---------------------------------------------------------------------------
// The portal itself must work for the people it is for
// ---------------------------------------------------------------------------

const PORTAL_VIEWS = [
  ['court dates', '/api/portal/court-dates'],
  ['the session', '/api/auth/me'],
  ['onboarding', '/api/membership/onboarding'],
];

for (const [who, token] of [['defendant', defendant.token], ['family member', family.token]]) {
  const failures = [];
  for (const [label, url] of PORTAL_VIEWS) {
    const res = await req('GET', url, { token, timeoutMs: 30000 });
    if (res.status >= 500 || res.status === 0) failures.push(`${label} → HTTP ${res.status}`);
  }
  failures.length === 0
    ? results.pass(`PORT-06-${who}`, `The portal surfaces answer a ${who} without error`, `${PORTAL_VIEWS.length} probed`)
    : results.fail(`PORT-06-${who}`, `Portal surfaces errored for a ${who}`, failures.join(', '));
}

// A defendant account is linked to a client record so a firm can share with it.
const defendantUser = await prisma.user.findUnique({
  where: { id: defendant.user.userId },
  select: { clientId: true, defaultRole: true, role: true },
});
defendantUser?.clientId
  ? results.pass(
      'PORT-07',
      'A defendant account is linked to a client record it can be shared with',
      `clientId ${defendantUser.clientId}`,
    )
  : results.fail(
      'PORT-07',
      'A defendant account has no client record',
      'a firm has nothing to attach shared documents to',
    );

// ---------------------------------------------------------------------------
// Redaction: what a portal user sees must be the published version
// ---------------------------------------------------------------------------

const disclosure = await req('GET', `/api/cases/${caseId}/disclosures`, { token: attorneyToken, timeoutMs: 30000 });
if (disclosure.status === 200) {
  results.pass('PORT-08', 'The disclosure surface is available to the defence team', `HTTP ${disclosure.status}`);
} else if (disclosure.status === 404) {
  results.unknown(
    'PORT-08',
    'Redacted disclosure could not be certified',
    'no disclosure endpoint is mounted, so publishing a redacted document to the portal cannot be exercised end to end',
  );
} else {
  results.warn('PORT-08', 'Unexpected disclosure response', `HTTP ${disclosure.status}`);
}

await results.write({
  caseId,
  defendantRole,
  familyRole,
});
await prisma.$disconnect();
