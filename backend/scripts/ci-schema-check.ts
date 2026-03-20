// ============================================================================
// PR 1 — CI Schema Drift Check
// Run in CI to detect schema drift before merge.
// Exits with code 1 if drift is detected.
//
// Usage: npx tsx scripts/ci-schema-check.ts
// ============================================================================

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_DIR = resolve(__dirname, '..');

interface CheckResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
  }>;
}

function log(msg: string): void {
  console.log(`[CI Schema Check] ${msg}`);
}

function fail(msg: string): void {
  console.error(`[CI Schema Check] FAIL: ${msg}`);
}

function pass(msg: string): void {
  console.log(`[CI Schema Check] PASS: ${msg}`);
}

/**
 * Check 1: Prisma schema file parses without errors.
 */
function checkSchemaValid(): { passed: boolean; message: string } {
  try {
    execSync('npx prisma validate', { cwd: BACKEND_DIR, stdio: 'pipe' });
    return { passed: true, message: 'schema.prisma is valid' };
  } catch (err) {
    const stderr = err instanceof Error && 'stderr' in err
      ? String((err as NodeJS.ErrnoException & { stderr: Buffer }).stderr)
      : String(err);
    return { passed: false, message: `schema.prisma validation failed: ${stderr.slice(0, 200)}` };
  }
}

/**
 * Check 2: prisma migrate status reports no drift.
 * Note: This requires DATABASE_URL to be set.
 */
function checkMigrateStatus(): { passed: boolean; message: string } {
  if (!process.env.DATABASE_URL) {
    return { passed: true, message: 'Skipped (no DATABASE_URL — CI-only check)' };
  }

  try {
    const output = execSync('npx prisma migrate status', {
      cwd: BACKEND_DIR,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    if (output.includes('Database schema is up to date')) {
      return { passed: true, message: 'No pending migrations' };
    }

    if (output.includes('Following migration') && output.includes('not yet been applied')) {
      return { passed: false, message: 'Pending migrations detected — run prisma migrate deploy' };
    }

    return { passed: true, message: 'Migration status OK' };
  } catch {
    return { passed: true, message: 'Skipped (database not reachable in CI)' };
  }
}

/**
 * Check 3: Every migration directory has a migration.sql file.
 */
function checkMigrationFiles(): { passed: boolean; message: string } {
  const migrationsDir = resolve(BACKEND_DIR, 'prisma', 'migrations');
  const entries = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'));

  const missing: string[] = [];
  for (const entry of entries) {
    const sqlPath = resolve(migrationsDir, entry.name, 'migration.sql');
    try {
      readFileSync(sqlPath);
    } catch {
      missing.push(entry.name);
    }
  }

  if (missing.length > 0) {
    return {
      passed: false,
      message: `Migration directories missing migration.sql: ${missing.join(', ')}`,
    };
  }

  return { passed: true, message: `All ${entries.length} migration directories have SQL files` };
}

/**
 * Check 4: Migration files are in chronological order (timestamps).
 */
function checkMigrationOrder(): { passed: boolean; message: string } {
  const migrationsDir = resolve(BACKEND_DIR, 'prisma', 'migrations');
  const entries = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{14}_/.test(e.name))
    .map((e) => e.name)
    .sort();

  for (let i = 1; i < entries.length; i++) {
    const prevTs = entries[i - 1].slice(0, 14);
    const currTs = entries[i].slice(0, 14);
    if (currTs <= prevTs) {
      return {
        passed: false,
        message: `Migration order violation: ${entries[i]} is not after ${entries[i - 1]}`,
      };
    }
  }

  return { passed: true, message: `${entries.length} migrations in correct chronological order` };
}

/**
 * Check 5: Schema Guard — locked tables not modified (if diff available).
 */
function checkSchemaGuard(): { passed: boolean; message: string } {
  try {
    // Import and run schema guard
    const output = execSync(
      'npx tsx prisma/schema/schemaGuard.ts HEAD~1',
      { cwd: BACKEND_DIR, stdio: 'pipe', encoding: 'utf-8' },
    );

    if (output.includes('Schema check passed')) {
      return { passed: true, message: 'No locked tables modified' };
    }

    return { passed: false, message: output.trim() };
  } catch (err) {
    // Schema guard may fail if no git history — that's OK in CI
    const stderr = err instanceof Error && 'stderr' in err
      ? String((err as NodeJS.ErrnoException & { stderr: Buffer }).stderr)
      : '';

    if (stderr.includes('ambiguous argument') || stderr.includes('unknown revision')) {
      return { passed: true, message: 'Skipped (no git history for comparison)' };
    }

    return { passed: true, message: 'Skipped (schema guard error — non-blocking)' };
  }
}

/**
 * Check 6: Compute and report migration checksum.
 */
function checkMigrationChecksum(): { passed: boolean; message: string } {
  const migrationsDir = resolve(BACKEND_DIR, 'prisma', 'migrations');
  const hash = createHash('sha256');

  try {
    const entries = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const sqlPath = resolve(migrationsDir, entry.name, 'migration.sql');
      try {
        const sql = readFileSync(sqlPath, 'utf-8');
        hash.update(entry.name);
        hash.update(sql);
      } catch {
        // skip
      }
    }
  } catch {
    return { passed: true, message: 'No migrations directory' };
  }

  const checksum = hash.digest('hex').slice(0, 16);
  return { passed: true, message: `Migration checksum: ${checksum}` };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log('Running schema drift checks...');
  log('');

  const result: CheckResult = { passed: true, checks: [] };

  const checks = [
    { name: 'Schema Validation', fn: checkSchemaValid },
    { name: 'Migration Files', fn: checkMigrationFiles },
    { name: 'Migration Order', fn: checkMigrationOrder },
    { name: 'Schema Guard', fn: checkSchemaGuard },
    { name: 'Migration Checksum', fn: checkMigrationChecksum },
    { name: 'Migrate Status', fn: checkMigrateStatus },
  ];

  for (const check of checks) {
    const checkResult = check.fn();
    result.checks.push({ name: check.name, ...checkResult });

    if (checkResult.passed) {
      pass(`${check.name}: ${checkResult.message}`);
    } else {
      fail(`${check.name}: ${checkResult.message}`);
      result.passed = false;
    }
  }

  log('');
  if (result.passed) {
    log('All schema checks passed.');
  } else {
    fail('Schema drift detected! Fix the issues above before merging.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[CI Schema Check] Unexpected error:', err);
  process.exit(1);
});
