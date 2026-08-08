#!/usr/bin/env node
// Checks what a self-service signup can reach. Several public-facing signup
// roles resolve to the platform role 'staff', and ROUTE_PERMISSIONS grants
// 'staff' access to the cross-tenant admin endpoints.

import { req, registerUser } from '../lib/harness.mjs';

// A separate firm whose case must not be visible to an outsider.
const victim = await registerUser({ prefix: 'victim-firm', defaultRole: 'attorney' });
const victimCase = await req('POST', '/api/cases', {
  token: victim.token,
  body: {
    title: 'Confidential matter — People v. Privileged',
    caseNumber: `VICTIM-${Date.now()}`,
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
console.log(`victim tenant ${victim.user?.tenantId} case ${victimCase.json?.case?.caseId}\n`);

const SIGNUP_ROLES = [
  'family_member',
  'interpreter',
  'consultant',
  'expert_witness',
  'other',
  'totally-made-up-role',
];

for (const role of SIGNUP_ROLES) {
  const u = await registerUser({ prefix: `esc-${role}`, defaultRole: role });
  if (!u.token) {
    console.log(`${role.padEnd(24)} registration failed (${u.status})`);
    continue;
  }
  const claims = JSON.parse(Buffer.from(u.token.split('.')[1], 'base64').toString());

  const users = await req('GET', '/api/admin/users', { token: u.token });
  const cases = await req('GET', '/api/admin/cases', { token: u.token });
  const stats = await req('GET', '/api/admin/stats', { token: u.token });

  const caseList = cases.json?.cases ?? cases.json?.data ?? [];
  const sawVictim = JSON.stringify(cases.json ?? '').includes(victimCase.json?.case?.caseId ?? '\u0000');

  console.log(
    `${role.padEnd(24)} platformRole=${String(claims.role).padEnd(10)} ` +
      `/admin/users=${users.status} /admin/cases=${cases.status} /admin/stats=${stats.status} ` +
      `casesReturned=${Array.isArray(caseList) ? caseList.length : 'n/a'} ` +
      `sawOtherTenantCase=${sawVictim}`,
  );

  if (users.status === 200) {
    const list = users.json?.users ?? users.json ?? [];
    const emails = (Array.isArray(list) ? list : []).slice(0, 3).map((x) => x.email);
    console.log(`${' '.repeat(24)} leaked user emails sample: ${JSON.stringify(emails)}`);
  }
}
