#!/usr/bin/env node
// Create or reset the administrator on a fresh deployment.
//
// Registration goes through the same route a customer uses, so the account is
// built by the application rather than written into the database by hand. Only
// the role is set directly, because nothing in the product grants it.
//
//   docker compose exec api node /app/deploy/bootstrap-admin.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = process.env.API_URL ?? 'http://127.0.0.1:3001';
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME ?? 'CourtAccess Administrator';

if (!email || !password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set. See deploy/.env.example.');
  process.exit(1);
}
if (password.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters.');
  process.exit(1);
}

const existing = await prisma.user.findUnique({ where: { email } });

if (existing) {
  // Reset the role rather than the password: password reset goes through the
  // application so the hash is produced the same way every other one is.
  await prisma.user.update({ where: { email }, data: { role: 'admin', emailVerifiedAt: new Date() } });
  console.log(`${email} already exists; role set to admin.`);
  console.log('To change the password, use the reset flow in the application.');
} else {
  const res = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, defaultRole: 'attorney', termsAccepted: true, privacyAccepted: true }),
  });
  if (!res.ok) {
    console.error(`Registration failed: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  await prisma.user.update({ where: { email }, data: { role: 'admin', emailVerifiedAt: new Date() } });
  console.log(`Administrator created: ${email}`);
}

// Prove it works rather than assuming.
const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await login.json().catch(() => ({}));

if (login.ok && data.user?.role === 'admin') {
  console.log('Verified: the account signs in and holds the admin role.');
} else {
  console.error(`Sign-in check failed: HTTP ${login.status}. The account exists but could not be verified.`);
  process.exit(1);
}

await prisma.$disconnect();
