// ============================================================================
// Startup configuration validation.
//
// Runs before the HTTP server binds. Its job is to turn the failures that
// otherwise appear later — and somewhere unhelpful — into one report at boot
// that names the variable and the remedy.
//
// The design rule is that a FAIL must describe something that genuinely breaks
// production, because every FAIL is a new way for the service to refuse to
// start. A validator that is wrong about what is required is itself an outage.
// Anything survivable is a WARNING and the server continues.
//
// Outside production every FAIL is downgraded to a WARNING, so running tests
// or a local server does not require a full production environment.
// ============================================================================

import { accessSync, constants, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type Level = 'PASS' | 'WARNING' | 'FAIL';

export interface CheckResult {
  name: string;
  level: Level;
  message: string;
  remedy?: string;
}

export interface ValidationReport {
  overall: Level;
  checks: CheckResult[];
  production: boolean;
}

/** The published fallback in server.ts — using it in production is not a secret. */
const COOKIE_SECRET_FALLBACK = 'court-access-cookie-secret-change-in-production';

/** The bundle is compiled with --target=node22. */
const MIN_NODE_MAJOR = 22;

/** Shortest secret worth calling a secret. */
const MIN_SECRET_LENGTH = 32;

const pass = (name: string, message: string): CheckResult => ({ name, level: 'PASS', message });
const warn = (name: string, message: string, remedy?: string): CheckResult => ({
  name, level: 'WARNING', message, remedy,
});
const fail = (name: string, message: string, remedy: string): CheckResult => ({
  name, level: 'FAIL', message, remedy,
});

/**
 * A secret is checked for presence and length only. Its value is never read
 * into a message, and never logged.
 */
function checkSecret(name: string, value: string | undefined): CheckResult {
  if (!value) {
    return fail(name, 'not set', `Set ${name} to a random value of at least ${MIN_SECRET_LENGTH} characters.`);
  }
  if (value.length < MIN_SECRET_LENGTH) {
    return warn(name, `set, but only ${value.length} characters`, `Use at least ${MIN_SECRET_LENGTH} characters.`);
  }
  return pass(name, `set (${value.length} characters)`);
}

/**
 * Permission bits say nothing about ACLs or a read-only mount, so write a probe
 * file instead of reading the mode.
 */
function checkWritable(name: string, dir: string | undefined, fallback: string): CheckResult {
  const target = resolve(dir || fallback);
  const label = dir ? target : `${target} (default)`;

  try {
    statSync(target);
  } catch {
    return warn(name, `${label} does not exist yet`, 'It will be created on first use. Confirm the parent is writable.');
  }

  try {
    accessSync(target, constants.W_OK);
    const probe = join(target, `.write-probe-${process.pid}`);
    writeFileSync(probe, '');
    unlinkSync(probe);
  } catch {
    return fail(name, `${label} is not writable`, `Grant write access to the user this service runs as.`);
  }

  return pass(name, `${label} writable`);
}

export function validateEnvironment(): ValidationReport {
  const env = process.env;
  const production = env.NODE_ENV === 'production';
  const checks: CheckResult[] = [];

  // -- Runtime ---------------------------------------------------------------
  const major = Number(process.versions.node.split('.')[0]);
  checks.push(
    major >= MIN_NODE_MAJOR
      ? pass('node version', `v${process.versions.node}`)
      : fail(
          'node version',
          `v${process.versions.node}, but the bundle targets node${MIN_NODE_MAJOR}`,
          `Upgrade Node to ${MIN_NODE_MAJOR} or later, or rebuild with a lower --target.`,
        ),
  );

  checks.push(
    production
      ? pass('NODE_ENV', 'production')
      : warn(
          'NODE_ENV',
          `"${env.NODE_ENV ?? '<unset>'}" — cookies will be set without the secure flag`,
          'Set NODE_ENV=production on a production host.',
        ),
  );

  // -- Secrets ---------------------------------------------------------------
  checks.push(checkSecret('DATABASE_URL', env.DATABASE_URL));
  checks.push(checkSecret('JWT_SECRET', env.JWT_SECRET));
  checks.push(checkSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET));

  if (!env.COOKIE_SECRET) {
    checks.push(fail('COOKIE_SECRET', 'not set', 'Set COOKIE_SECRET. The fallback is a constant published in this repository.'));
  } else if (env.COOKIE_SECRET === COOKIE_SECRET_FALLBACK) {
    checks.push(fail('COOKIE_SECRET', 'set to the published fallback', 'Replace it with a random value.'));
  } else {
    checks.push(pass('COOKIE_SECRET', `set (${env.COOKIE_SECRET.length} characters)`));
  }

  // -- Network ---------------------------------------------------------------
  const port = Number(env.PORT ?? NaN);
  if (!env.PORT) {
    checks.push(warn('PORT', 'not set — defaults to 3001', 'nginx proxies to 3000. Set PORT=3000 or every request returns 502.'));
  } else if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    checks.push(fail('PORT', `"${env.PORT}" is not a valid port`, 'Set PORT to an integer between 1 and 65535.'));
  } else {
    checks.push(pass('PORT', String(port)));
  }

  checks.push(
    env.HOST === '127.0.0.1'
      ? pass('HOST', '127.0.0.1')
      : warn(
          'HOST',
          `${env.HOST ?? '0.0.0.0 (default)'} — the API is reachable without going through nginx`,
          'Set HOST=127.0.0.1 when nginx is the only client.',
        ),
  );

  // -- Storage ---------------------------------------------------------------
  const uploads = checkWritable(
    'EVIDENCE_UPLOAD_DIR',
    env.EVIDENCE_UPLOAD_DIR,
    '/var/www/courtaccess/uploads/evidence',
  );
  checks.push(uploads);

  // The default lives inside the application directory, which a deployment
  // replaces. Uploaded discovery would be destroyed by the next release.
  if (!env.EVIDENCE_UPLOAD_DIR && production) {
    checks.push(
      fail(
        'EVIDENCE_UPLOAD_DIR',
        'not set — evidence defaults inside the application directory',
        'Set EVIDENCE_UPLOAD_DIR to a path outside the release, e.g. /var/lib/courtaccess/evidence. ' +
          'Note the name: EVIDENCE_STORAGE_DIR is not read by this application.',
      ),
    );
  }

  checks.push(
    checkWritable('CERTIFICATION_STAGING_DIR', env.CERTIFICATION_STAGING_DIR, '/var/tmp/courtaccess-certification-staging'),
  );

  // -- Background processing -------------------------------------------------
  // Redis being unreachable is fine. Redis being unreachable while five workers
  // are trying to reach it is the problem, so the two are checked together.
  checks.push(
    env.DISABLE_WORKERS === 'true'
      ? pass('workers', 'disabled by DISABLE_WORKERS — queue features unavailable')
      : warn(
          'workers',
          'enabled — they require Redis',
          'If Redis is not deployed, set DISABLE_WORKERS=true to stop five workers retrying a connection they will never get.',
        ),
  );

  const failed = checks.filter((c) => c.level === 'FAIL');
  const warned = checks.filter((c) => c.level === 'WARNING');

  // Outside production nothing is fatal, so a developer is not forced to
  // populate a production environment to run the server.
  const overall: Level =
    failed.length > 0 && production ? 'FAIL' : warned.length > 0 || failed.length > 0 ? 'WARNING' : 'PASS';

  return { overall, checks, production };
}

export function printValidationReport(report: ValidationReport): void {
  console.log('[Startup] Validating configuration...');

  for (const c of report.checks) {
    const level = report.production || c.level !== 'FAIL' ? c.level : 'WARNING';
    console.log(`  ${level.padEnd(8)} ${c.name.padEnd(28)} ${c.message}`);
    if (c.remedy && level !== 'PASS') {
      console.log(`           ${''.padEnd(28)} -> ${c.remedy}`);
    }
  }

  const failed = report.checks.filter((c) => c.level === 'FAIL').length;
  const warned = report.checks.filter((c) => c.level === 'WARNING').length;

  if (report.overall === 'FAIL') {
    console.error(`[Startup] FAILED — ${failed} fatal, ${warned} warnings. Server will not start.`);
  } else if (!report.production && failed > 0) {
    console.warn(
      `[Startup] ${failed} check(s) would be fatal in production, ${warned} warnings. ` +
        'Continuing because NODE_ENV is not production.',
    );
  } else {
    console.log(`[Startup] Configuration OK — ${warned} warning(s).`);
  }
}
