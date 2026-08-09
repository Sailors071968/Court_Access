#!/usr/bin/env node
// Create or reset the administrator on a fresh deployment.
//
// Registration goes through the same route a customer uses, so the account is
// built by the application rather than written into the database by hand. Only
// the role is set directly, because nothing in the product grants it.
//
//   cd /var/www/courtaccess-v1
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<20+ chars>' API_URL=http://127.0.0.1:3100 \
//     node --env-file=.env bootstrap-admin.mjs
//
// The script does two things through two different channels — it registers over
// HTTP and promotes over the database — so it only works if both channels reach
// the same database. That is not automatic, and it is the failure this file goes
// out of its way to prevent:
//
//   node --env-file does NOT override a variable already present in the
//   environment. An operator who exported DATABASE_URL to run psql (which the
//   runbook tells them to do) leaves that value in the shell. The registration
//   then lands in the API's database while the promotion runs against the
//   operator's, the promotion fails or silently updates nothing, and the account
//   is left as an attorney. Sign-in works, so the deployment looks finished —
//   and then every administrative route answers 403.
//
// So the connection is built from the --env-file file itself rather than from
// process.env, and the database actually in use is printed.

import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const API = process.env.API_URL ?? 'http://127.0.0.1:3001';
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME ?? 'CourtAccess Administrator';

if (!email || !password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set.');
  console.error('  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=\'<20+ chars>\' node --env-file=.env bootstrap-admin.mjs');
  process.exit(1);
}
if (password.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Which database?
// ---------------------------------------------------------------------------

/**
 * The DATABASE_URL the service itself uses, read from the env file rather than
 * from the environment.
 *
 * Deliberately parsed here instead of trusting `process.env.DATABASE_URL`: Node
 * will have left an ambient value untouched, and an ambient value is the one that
 * points at the wrong database.
 */
function urlFromEnvFile() {
  // Whichever --env-file was passed; otherwise .env beside the script's cwd,
  // which is the documented layout.
  const flag = process.argv.find((a) => a.startsWith('--env-file'));
  const explicit = flag?.includes('=') ? flag.split('=').slice(1).join('=') : undefined;
  const candidates = [explicit, process.env.ENV_FILE, '.env'].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const text = readFileSync(resolve(candidate), 'utf8');
      for (const line of text.split('\n')) {
        const match = /^\s*DATABASE_URL\s*=\s*(.*)\s*$/.exec(line);
        if (match) {
          return { url: match[1].trim().replace(/^["']|["']$/g, ''), source: resolve(candidate) };
        }
      }
    } catch {
      // Not readable; try the next candidate.
    }
  }
  return null;
}

/** Host and database name only, so a log line never carries the password. */
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
    // Loud, because this is the condition that used to produce a silent attorney.
    console.log(`  note:   the environment also has DATABASE_URL set, pointing at ${describe(fromEnv)}.`);
    console.log('          The file wins here. Node would have done the opposite — --env-file does not');
    console.log('          override an existing variable — which is why this script reads the file directly.');
  }
}
console.log(`API:      ${API}`);

// Constructed explicitly rather than from process.env, so the client cannot be
// pointed somewhere else by the shell.
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

// ---------------------------------------------------------------------------
// The API must be reachable, and must be using this same database.
// ---------------------------------------------------------------------------

let health;
try {
  const res = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(10_000) });
  health = res.ok;
} catch (err) {
  health = false;
  console.error(`The API at ${API} did not answer: ${err.message}`);
}
if (!health) {
  console.error('Registration goes through the running service, so it must be up first.');
  console.error('If the service listens on a different port, set API_URL to match PORT in .env.');
  await prisma.$disconnect();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Create or promote
// ---------------------------------------------------------------------------

const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });

if (existing) {
  // Reset the role rather than the password: password reset goes through the
  // application so the hash is produced the same way every other one is.
  await prisma.user.update({
    where: { id: existing.id },
    data: { role: 'admin', emailVerifiedAt: new Date() },
  });
  console.log(`${email} already exists (was ${existing.role}); role set to admin.`);
  console.log('To change the password, use the reset flow in the application.');
} else {
  const res = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, defaultRole: 'attorney', termsAccepted: true, privacyAccepted: true }),
  });
  if (!res.ok) {
    console.error(`Registration failed: HTTP ${res.status} ${await res.text()}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  // The account the API just made must be visible on this connection. If it is
  // not, the two channels are looking at different databases, and continuing
  // would leave a registered non-administrator behind — which is precisely the
  // state that looks like a finished deployment and answers 403 to every
  // administrative route.
  const created = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!created) {
    console.error('');
    console.error(`Registration succeeded at ${API}, but no such user is visible in ${describe(databaseUrl)}.`);
    console.error('The service and this script are connected to different databases.');
    console.error('');
    console.error('The account now exists in the service\'s database WITHOUT the admin role.');
    console.error('Point this script at the same DATABASE_URL the service uses and run it again;');
    console.error('it will find the existing account and promote it.');
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: created.id },
    data: { role: 'admin', emailVerifiedAt: new Date() },
  });
  console.log(`Administrator created: ${email}`);
}

// ---------------------------------------------------------------------------
// Prove it, rather than assuming
// ---------------------------------------------------------------------------

const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await login.json().catch(() => ({}));

if (login.ok && data.user?.role === 'admin') {
  console.log('Verified: the account signs in and the service reports its role as admin.');
} else {
  console.error('');
  console.error(`Sign-in check failed: HTTP ${login.status}, role reported as ${data.user?.role ?? '<none>'}.`);
  if (login.ok && data.user?.role && data.user.role !== 'admin') {
    // The specific diagnosis, because "role is not admin" after a successful
    // promotion has exactly one cause.
    console.error('The promotion was written, but the service does not see it — so the service is');
    console.error(`reading a different database from ${describe(databaseUrl)}.`);
    console.error('Compare DATABASE_URL in the service\'s .env with the one printed above.');
  }
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.$disconnect();
