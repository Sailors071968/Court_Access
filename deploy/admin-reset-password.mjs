#!/usr/bin/env node
// Create the first administrator, or reset a known administrator's password.
//
// This is the lockout recovery tool. It always sets (or resets) the password to
// the value you pass — unlike bootstrap-admin.mjs historically, which promoted
// an existing account but left its password untouched.
//
//   cd /var/www/courtaccess-v1   # or wherever the running release lives
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<12+ chars>' API_URL=http://127.0.0.1:3100 \
//     node --env-file=.env admin-reset-password.mjs
//
// Optional:
//   ADMIN_NAME='CourtAccess Administrator'
//   ADMIN_INIT=1          # refuse to run if any admin already exists (first-time only)
//
// DATABASE_URL is read from the --env-file itself, not from the ambient
// environment. Node's --env-file does not override variables already set in the
// shell; reading the file directly is what keeps this pointed at the same
// database the running service uses.

import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const BCRYPT_SALT_ROUNDS = 12;
const API = process.env.API_URL ?? 'http://127.0.0.1:3100';
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME ?? 'CourtAccess Administrator';
const initOnly = process.env.ADMIN_INIT === '1' || process.env.ADMIN_INIT === 'true';

if (!email || !password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set.');
  console.error('  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=\'<12+ chars>\' \\');
  console.error('    node --env-file=.env admin-reset-password.mjs');
  process.exit(1);
}
if (password.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters.');
  process.exit(1);
}

/**
 * Resolve the env file path.
 *
 * Node consumes `--env-file=...` before the script runs: it does not appear in
 * `process.argv`, only in `process.execArgv`. And `--env-file` does not override
 * a DATABASE_URL already present in the ambient environment — so we must read
 * the file ourselves rather than trusting `process.env.DATABASE_URL`.
 */
function envFileCandidates() {
  const fromExec = [];
  for (let i = 0; i < process.execArgv.length; i += 1) {
    const arg = process.execArgv[i];
    if (arg.startsWith('--env-file=')) {
      fromExec.push(arg.slice('--env-file='.length));
    } else if (arg === '--env-file' && process.execArgv[i + 1]) {
      fromExec.push(process.execArgv[i + 1]);
    }
  }
  for (let i = 0; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg.startsWith('--env-file=')) {
      fromExec.push(arg.slice('--env-file='.length));
    } else if (arg === '--env-file' && process.argv[i + 1]) {
      fromExec.push(process.argv[i + 1]);
    }
  }
  return [...fromExec, process.env.ENV_FILE, '.env'].filter(Boolean);
}

function urlFromEnvFile() {
  for (const candidate of envFileCandidates()) {
    try {
      const text = readFileSync(resolve(candidate), 'utf8');
      for (const line of text.split('\n')) {
        const match = /^\s*DATABASE_URL\s*=\s*(.*)\s*$/.exec(line);
        if (match) {
          return { url: match[1].trim().replace(/^["']|["']$/g, ''), source: resolve(candidate) };
        }
      }
    } catch {
      // try next
    }
  }
  return null;
}

function describe(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
  } catch {
    return '<unparseable DATABASE_URL>';
  }
}

const fromFile = urlFromEnvFile();
const fromEnv = process.env.DATABASE_URL;
const databaseUrl = fromFile?.url ?? fromEnv;

if (!databaseUrl) {
  console.error('No DATABASE_URL. Pass --env-file=.env, or set DATABASE_URL.');
  process.exit(1);
}

console.log(`Database: ${describe(databaseUrl)}`);
if (fromFile) {
  console.log(`  from:   ${basename(fromFile.source)}`);
  if (fromEnv && fromEnv !== fromFile.url) {
    console.log(`  note:   ambient DATABASE_URL points at ${describe(fromEnv)}; the file wins.`);
  }
}
console.log(`API:      ${API}`);
console.log(`Account:  ${email}`);

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

let health = false;
try {
  const res = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(10_000) });
  health = res.ok;
} catch (err) {
  console.error(`The API at ${API} did not answer: ${err.message}`);
}
if (!health) {
  console.error('The running service must be up so the password can be verified through /api/auth/login.');
  await prisma.$disconnect();
  process.exit(1);
}

if (initOnly) {
  const anyAdmin = await prisma.user.findFirst({ where: { role: 'admin' }, select: { email: true } });
  if (anyAdmin) {
    console.error(`ADMIN_INIT=1 refused: an administrator already exists (${anyAdmin.email}).`);
    console.error('Omit ADMIN_INIT to reset a specific account.');
    await prisma.$disconnect();
    process.exit(1);
  }
}

const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
const existing = await prisma.user.findUnique({
  where: { email },
  select: { id: true, role: true, mfaEnabled: true },
});

if (existing) {
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      passwordHash,
      role: 'admin',
      emailVerifiedAt: new Date(),
      mfaEnabled: false,
      name,
    },
  });
  console.log(`Reset: ${email} (was role=${existing.role}, mfa=${existing.mfaEnabled}) → admin, MFA off, password set.`);
} else {
  const tenantId = `tenant-${randomUUID()}`;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'admin',
        tenantId,
        emailVerifiedAt: now,
        mfaEnabled: false,
      },
    });
    // Mirror what /api/auth/register creates so the account is usable end to end.
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
  console.log(`Created administrator: ${email}`);
}

// Hash fingerprint only — never print the password back from the script once set.
const fingerprint = createHash('sha256').update(password).digest('hex').slice(0, 12);
console.log(`Password fingerprint (sha256[:12]): ${fingerprint}`);

const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await login.json().catch(() => ({}));

if (login.ok && data.user?.role === 'admin' && !data.mfaRequired) {
  console.log('Verified: /api/auth/login returns role=admin and MFA is not required.');
  console.log(`  userId: ${data.user.userId ?? data.user.id}`);
} else {
  console.error('');
  console.error(`Sign-in check failed: HTTP ${login.status}, role=${data.user?.role ?? '<none>'}, mfaRequired=${Boolean(data.mfaRequired)}`);
  if (login.ok && data.user?.role && data.user.role !== 'admin') {
    console.error('The write landed, but the service does not see role=admin — different databases.');
    console.error(`Compare the service .env DATABASE_URL with ${describe(databaseUrl)}.`);
  }
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.$disconnect();
console.log('Done. Sign in with the ADMIN_EMAIL / ADMIN_PASSWORD you passed.');
