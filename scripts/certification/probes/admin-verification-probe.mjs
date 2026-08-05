#!/usr/bin/env node
// Re-checks the admin console after the authorization and query repairs:
// a real admin must get working data, and a public signup must be refused.

import { req, registerUser } from '../lib/harness.mjs';
import { PrismaClient } from '../../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();

// Promote one account to admin directly in the database — registration never
// hands out the admin role, which is itself the correct behaviour.
const adminUser = await registerUser({ prefix: 'real-admin', defaultRole: 'attorney' });
await prisma.user.update({ where: { id: adminUser.user.userId }, data: { role: 'admin' } });
const adminLogin = await req('POST', '/api/auth/login', {
  body: { email: adminUser.email, password: adminUser.password },
});
const adminToken = adminLogin.json.accessToken;

console.log('--- as a genuine admin ---');
for (const url of ['/api/admin/stats', '/api/admin/users', '/api/admin/cases']) {
  const r = await req('GET', url, { token: adminToken });
  const body = JSON.stringify(r.json ?? r.text ?? '').slice(0, 200);
  console.log(`  ${url.padEnd(20)} HTTP ${r.status}  ${body}`);
}

console.log('\n--- as a public signup (family_member -> staff) ---');
const outsider = await registerUser({ prefix: 'outsider', defaultRole: 'family_member' });
for (const url of [
  '/api/admin/stats',
  '/api/admin/users',
  '/api/admin/cases',
  '/api/cpra/dashboard',
  '/api/operations/dashboard',
  '/api/policy-pipeline/stats',
]) {
  const r = await req('GET', url, { token: outsider.token });
  console.log(`  ${url.padEnd(30)} HTTP ${r.status}`);
}

await prisma.$disconnect();
