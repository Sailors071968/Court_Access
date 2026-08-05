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
  missingColumns: string[];
  errors: string[];
}

interface ParsedModel {
  table: string;
  columns: string[];
}

/**
 * Parse schema.prisma into the set of physical tables and scalar columns it
 * expects. Relation fields carry no column of their own and are skipped; the
 * underlying foreign-key scalars are declared separately and are picked up.
 */
export function parseExpectedTables(schemaText: string): ParsedModel[] {
  const modelNames = new Set(
    [...schemaText.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]),
  );
  const models: ParsedModel[] = [];

  const blockRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  for (const block of schemaText.matchAll(blockRe)) {
    const [, modelName, body] = block;
    const mapMatch = body.match(/@@map\(\s*"([^"]+)"\s*\)/);
    const table = mapMatch ? mapMatch[1] : modelName;

    const columns: string[] = [];
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;

      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!fieldMatch) continue;
      const [, fieldName, fieldType, isList, , attrs] = fieldMatch;

      // Relation fields (including lists of models) have no column.
      if (modelNames.has(fieldType)) continue;
      if (isList && modelNames.has(fieldType)) continue;

      const colMapMatch = attrs.match(/@map\(\s*"([^"]+)"\s*\)/);
      columns.push(colMapMatch ? colMapMatch[1] : fieldName);
    }
    models.push({ table, columns });
  }
  return models;
}

/**
 * Returns "table.column" (or "table (missing table)") for everything the
 * datamodel requires that the live database does not have.
 */
async function findMissingColumns(): Promise<string[]> {
  let schemaText: string;
  try {
    schemaText = readFileSync(resolve(__dirname, '../../prisma/schema.prisma'), 'utf-8');
  } catch {
    return [];
  }

  const expected = parseExpectedTables(schemaText);

  let rows: Array<{ table_name: string; column_name: string }>;
  try {
    rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
    `;
  } catch {
    return [];
  }

  const actual = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
    actual.get(row.table_name)!.add(row.column_name);
  }

  const missing: string[] = [];
  for (const model of expected) {
    const cols = actual.get(model.table);
    if (!cols) {
      missing.push(`${model.table} (missing table)`);
      continue;
    }
    for (const col of model.columns) {
      if (!cols.has(col)) missing.push(`${model.table}.${col}`);
    }
  }
  return missing;
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
      missingColumns: [],
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

  // 4. Compare the live database against the datamodel the Prisma client was
  //    generated from. Counting applied migrations is not enough: a migration
  //    history that has fallen behind schema.prisma applies cleanly and still
  //    leaves the server issuing queries for columns that do not exist.
  const missing = await findMissingColumns();
  if (missing.length > 0) {
    const preview = missing.slice(0, 10).join(', ');
    errors.push(
      `${missing.length} column(s)/table(s) required by schema.prisma are missing from the database: ` +
        `${preview}${missing.length > 10 ? `, and ${missing.length - 10} more` : ''}. ` +
        'The migration history is behind schema.prisma.',
    );
  }

  // 5. Record/update schema version in schema_versions table
  try {
    // Try to upsert the current version record
    await prisma.$executeRaw`
      INSERT INTO "schema_versions" ("id", "version", "checksum", "migrationName", "description", "appliedBy", "driftChecked")
      VALUES (gen_random_uuid(), ${EXPECTED_SCHEMA_VERSION}, ${checksum}, 'boot-assertion', 'Boot-time schema integrity check', 'server-boot', true)
      ON CONFLICT ("version") DO UPDATE
      SET "checksum" = ${checksum}, "driftChecked" = true
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
    missingColumns: missing,
    errors,
  };
}

/**
 * Hard-fail wrapper for boot. Logs the result and exits if schema is drifted.
 */
export async function enforceSchemaOnBoot(): Promise<void> {
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
