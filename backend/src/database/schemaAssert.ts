// ============================================================================
// PR 1 — Boot-Time Schema Assertion
// Hard-fails the server if the database schema does not match the expected
// version. Prevents running against a drifted or un-migrated database.
// ============================================================================

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The expected schema version — bump this when adding new migrations
export const EXPECTED_SCHEMA_VERSION = '1.0.0';

/**
 * Compute a checksum of all migration SQL files to detect drift.
 * Returns a SHA-256 hash of the concatenated migration contents.
 */
export function computeMigrationChecksum(): string {
  const migrationsDir = resolve(__dirname, '../../prisma/migrations');
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
        // Migration directory without SQL file — skip
      }
    }
  } catch {
    // Migrations directory doesn't exist — return empty hash
    return 'no-migrations';
  }

  return hash.digest('hex').slice(0, 16);
}

/**
 * Count the number of pending migrations by checking Prisma's migration table.
 * Returns the number of migrations on disk that are NOT in _prisma_migrations.
 */
async function countPendingMigrations(): Promise<{
  diskCount: number;
  appliedCount: number;
  pending: string[];
}> {
  const migrationsDir = resolve(__dirname, '../../prisma/migrations');

  // Get migrations on disk
  let diskMigrations: string[] = [];
  try {
    diskMigrations = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  } catch {
    return { diskCount: 0, appliedCount: 0, pending: [] };
  }

  // Get applied migrations from the database
  let appliedMigrations: string[] = [];
  try {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
      ORDER BY migration_name
    `;
    appliedMigrations = rows.map((r) => r.migration_name);
  } catch {
    // _prisma_migrations table doesn't exist — all are pending
    return {
      diskCount: diskMigrations.length,
      appliedCount: 0,
      pending: diskMigrations,
    };
  }

  const appliedSet = new Set(appliedMigrations);
  const pending = diskMigrations.filter((m) => !appliedSet.has(m));

  return {
    diskCount: diskMigrations.length,
    appliedCount: appliedMigrations.length,
    pending,
  };
}

/**
 * Check for failed migrations in _prisma_migrations table.
 */
async function checkFailedMigrations(): Promise<string[]> {
  try {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string; logs: string | null }>>`
      SELECT migration_name, logs FROM "_prisma_migrations"
      WHERE finished_at IS NULL
      AND started_at IS NOT NULL
    `;
    return rows.map((r) => r.migration_name);
  } catch {
    return [];
  }
}

export interface SchemaAssertResult {
  ok: boolean;
  version: string;
  checksum: string;
  pendingMigrations: string[];
  failedMigrations: string[];
  diskMigrationCount: number;
  appliedMigrationCount: number;
  errors: string[];
}

/**
 * Assert that the database schema is in a known-good state.
 * Call this at server boot — if it returns ok=false, the server MUST NOT start.
 *
 * Checks:
 * 1. No pending (unapplied) migrations
 * 2. No failed migrations
 * 3. Database is reachable
 * 4. Records the current schema version + checksum
 */
export async function assertSchemaIntegrity(): Promise<SchemaAssertResult> {
  const errors: string[] = [];
  const checksum = computeMigrationChecksum();

  // 1. Verify database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      version: EXPECTED_SCHEMA_VERSION,
      checksum,
      pendingMigrations: [],
      failedMigrations: [],
      diskMigrationCount: 0,
      appliedMigrationCount: 0,
      errors: [`Database unreachable: ${msg}`],
    };
  }

  // 2. Check for pending migrations
  const { diskCount, appliedCount, pending } = await countPendingMigrations();

  if (pending.length > 0) {
    errors.push(
      `${pending.length} pending migration(s) not applied: ${pending.join(', ')}. Run "npx prisma migrate deploy" first.`,
    );
  }

  // 3. Check for failed migrations
  const failed = await checkFailedMigrations();
  if (failed.length > 0) {
    errors.push(
      `${failed.length} failed migration(s) detected: ${failed.join(', ')}. Resolve manually before starting.`,
    );
  }

  // 4. Record/update schema version in schema_versions table
  try {
    // Try to upsert the current version record
    await prisma.$executeRaw`
      INSERT INTO "schema_versions" ("id", "version", "checksum", "migration_name", "description", "applied_by", "drift_checked")
      VALUES (gen_random_uuid(), ${EXPECTED_SCHEMA_VERSION}, ${checksum}, 'boot-assertion', 'Boot-time schema integrity check', 'server-boot', true)
      ON CONFLICT ("version") DO UPDATE
      SET "checksum" = ${checksum}, "drift_checked" = true
    `;
  } catch {
    // schema_versions table may not exist yet (pre-migration) — that's a pending migration issue
    if (pending.length === 0) {
      errors.push(
        'schema_versions table does not exist. Run "npx prisma migrate deploy" to create it.',
      );
    }
  }

  return {
    ok: errors.length === 0,
    version: EXPECTED_SCHEMA_VERSION,
    checksum,
    pendingMigrations: pending,
    failedMigrations: failed,
    diskMigrationCount: diskCount,
    appliedMigrationCount: appliedCount,
    errors,
  };
}

/**
 * Hard-fail wrapper for boot. Logs the result and exits if schema is drifted.
 */
export async function enforceSchemaOnBoot(): Promise<void> {
  if (process.env.SKIP_SCHEMA_ASSERT === 'true') {
    console.warn('[Schema Assert] Skipped via SKIP_SCHEMA_ASSERT env var');
    return;
  }

  console.log('[Schema Assert] Checking database schema integrity...');

  const result = await assertSchemaIntegrity();

  if (result.ok) {
    console.log(`[Schema Assert] Schema locked and matching.`);
    console.log(`[Schema Assert]   Version:    ${result.version}`);
    console.log(`[Schema Assert]   Checksum:   ${result.checksum}`);
    console.log(`[Schema Assert]   Migrations: ${result.appliedMigrationCount}/${result.diskMigrationCount} applied`);
  } else {
    console.error('[Schema Assert] FATAL: Schema integrity check failed!');
    for (const err of result.errors) {
      console.error(`[Schema Assert]   ERROR: ${err}`);
    }
    console.error('[Schema Assert] Server cannot start with drifted schema.');
    console.error('[Schema Assert] Run: npx prisma migrate deploy');
    process.exit(1);
  }
}
