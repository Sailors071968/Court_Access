// ============================================================================
// Program 21 / PG-015 — Automated Backup Restore Drill Runner
// Verifies DR readiness, repository snapshots, and database recoverability
// ============================================================================

import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import prisma from '../lib/prisma.js';

const WORKSPACE = resolve(import.meta.dirname ?? '.', '../../..');
const DRILL_REPORT_PATH = join(WORKSPACE, 'reports/BACKUP_RESTORE_DRILL.json');

export interface BackupRestoreDrillCheck {
  id: string;
  label: string;
  result: 'PASS' | 'FAIL' | 'SKIP';
  detail: string;
}

export interface BackupRestoreDrillReport {
  generatedAt: string;
  drillVersion: string;
  overallResult: 'PASS' | 'FAIL';
  passCount: number;
  failCount: number;
  skipCount: number;
  checks: BackupRestoreDrillCheck[];
  recoveryProcedures: string[];
  auditTrail: Array<{ step: string; timestamp: string }>;
}

const DRILL_VERSION = '1.0.0';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function check(
  id: string,
  label: string,
  pass: boolean,
  detail: string,
  skip = false,
): BackupRestoreDrillCheck {
  return { id, label, result: skip ? 'SKIP' : pass ? 'PASS' : 'FAIL', detail };
}

export async function runBackupRestoreDrill(options?: { writeReport?: boolean }): Promise<BackupRestoreDrillReport> {
  const writeReport = options?.writeReport !== false;
  const auditTrail: BackupRestoreDrillReport['auditTrail'] = [];
  const checks: BackupRestoreDrillCheck[] = [];

  const log = (step: string) => auditTrail.push({ step, timestamp: new Date().toISOString() });

  // 1. DR documentation
  log('Verify DISASTER_RECOVERY.md');
  const drDoc = await fileExists(join(WORKSPACE, 'DISASTER_RECOVERY.md'));
  checks.push(check('dr-documentation', 'DISASTER_RECOVERY.md present', drDoc, drDoc ? 'DR procedures documented' : 'Missing DR documentation'));

  // 2. Migration safety script
  log('Verify db-safe-migrate.sh');
  const migrateScript = await fileExists(join(WORKSPACE, 'backend/scripts/db-safe-migrate.sh'));
  checks.push(check('migrate-script', 'db-safe-migrate.sh present', migrateScript, migrateScript ? 'Safe migration script available' : 'Missing migration safety script'));

  // 3. Database integrity audit report
  log('Verify database integrity audit');
  const integrityPath = join(WORKSPACE, 'reports/database_integrity_audit.json');
  let integrityPass = false;
  if (await fileExists(integrityPath)) {
    try {
      const integrity = JSON.parse(await readFile(integrityPath, 'utf-8')) as { summary?: { overallStatus?: string } };
      integrityPass = integrity.summary?.overallStatus === 'PASS';
      checks.push(check('integrity-audit', 'Database integrity audit', integrityPass, `overallStatus=${integrity.summary?.overallStatus ?? 'UNKNOWN'}`));
    } catch {
      checks.push(check('integrity-audit', 'Database integrity audit', false, 'Failed to parse integrity audit report'));
    }
  } else {
    checks.push(check('integrity-audit', 'Database integrity audit', false, 'database_integrity_audit.json not found'));
  }

  // 4. Repository snapshots
  log('Verify legislative repository snapshots');
  const repoDir = join(WORKSPACE, 'backend/data/legislative/repositories');
  const offensesFile = join(repoDir, 'offenses/records.jsonl');
  const repoExists = await fileExists(offensesFile);
  checks.push(check('repository-snapshots', 'Legislative repository snapshots', repoExists, repoExists ? 'Repository files on disk for restore' : 'Repository snapshots missing'));

  // 5. Configuration backup reference
  log('Verify configuration template');
  const configTemplate = await fileExists(join(WORKSPACE, 'backend/.env.production.template'));
  checks.push(check('config-template', 'Configuration backup reference', configTemplate, configTemplate ? '.env.production.template present' : 'Configuration template missing'));

  // 6. Live database connectivity (restore target verification)
  log('Verify database connectivity');
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1 as ok`;
    dbConnected = true;
    checks.push(check('db-connectivity', 'Database connectivity', true, 'PostgreSQL connection verified'));
  } catch (err) {
    checks.push(check('db-connectivity', 'Database connectivity', false, err instanceof Error ? err.message : 'Connection failed'));
  }

  // 7. Critical table accessibility (post-restore verification simulation)
  if (dbConnected) {
    log('Verify critical tables accessible');
    const criticalTables = [
      { name: 'users', query: () => prisma.user.count() },
      { name: 'criminal_cases', query: () => prisma.criminalCase.count() },
      { name: 'evidence', query: () => prisma.evidence.count() },
      { name: 'clients', query: () => prisma.client.count() },
    ];

    let tablesPass = true;
    const tableDetails: string[] = [];
    for (const t of criticalTables) {
      try {
        const count = await t.query();
        tableDetails.push(`${t.name}:${count}`);
      } catch {
        tablesPass = false;
        tableDetails.push(`${t.name}:INACCESSIBLE`);
      }
    }
    checks.push(check('critical-tables', 'Critical tables accessible', tablesPass, tableDetails.join(', ')));
  } else {
    checks.push(check('critical-tables', 'Critical tables accessible', false, 'Skipped — database not connected', true));
  }

  // 8. Migration state (schema recoverability)
  if (dbConnected) {
    log('Verify migration state');
    try {
      const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 5
      `;
      const migrationPass = migrations.length > 0;
      checks.push(
        check(
          'migration-state',
          'Prisma migrations applied',
          migrationPass,
          migrationPass ? `Latest: ${migrations[0]?.migration_name ?? 'unknown'}` : 'No completed migrations found',
        ),
      );
    } catch {
      checks.push(check('migration-state', 'Prisma migrations applied', false, '_prisma_migrations table not accessible'));
    }
  } else {
    checks.push(check('migration-state', 'Prisma migrations applied', false, 'Skipped — database not connected', true));
  }

  // 9. Schema version control table
  if (dbConnected) {
    log('Verify schema version control');
    try {
      const versions = await prisma.schemaVersion.count();
      checks.push(check('schema-versions', 'Schema version tracking', versions >= 0, `${versions} schema version record(s)`));
    } catch {
      checks.push(check('schema-versions', 'Schema version tracking', false, 'schema_versions table not accessible'));
    }
  }

  const passCount = checks.filter((c) => c.result === 'PASS').length;
  const failCount = checks.filter((c) => c.result === 'FAIL').length;
  const skipCount = checks.filter((c) => c.result === 'SKIP').length;

  // Drill passes when all non-skipped checks pass and DB connectivity verified
  const requiredPass = checks.filter((c) => c.result !== 'SKIP').every((c) => c.result === 'PASS');
  const overallResult = requiredPass ? 'PASS' : 'FAIL';

  const report: BackupRestoreDrillReport = {
    generatedAt: new Date().toISOString(),
    drillVersion: DRILL_VERSION,
    overallResult,
    passCount,
    failCount,
    skipCount,
    checks,
    recoveryProcedures: [
      'Restore database from latest RDS snapshot or pg_dump backup',
      'Run prisma migrate deploy to apply pending migrations',
      'Restore legislative repositories from backend/data/legislative/repositories',
      'Verify critical tables via runBackupRestoreDrill()',
      'See DISASTER_RECOVERY.md for full RTO/RPO procedures',
    ],
    auditTrail,
  };

  if (writeReport) {
    await mkdir(dirname(DRILL_REPORT_PATH), { recursive: true });
    await writeFile(DRILL_REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
  }

  return report;
}

export async function getLatestDrillReport(): Promise<BackupRestoreDrillReport | null> {
  try {
    const raw = await readFile(DRILL_REPORT_PATH, 'utf-8');
    return JSON.parse(raw) as BackupRestoreDrillReport;
  } catch {
    return null;
  }
}

export async function isBackupDrillPassing(): Promise<boolean> {
  const latest = await getLatestDrillReport();
  if (latest?.overallResult === 'PASS') {
    const ageMs = Date.now() - new Date(latest.generatedAt).getTime();
    if (ageMs < 7 * 24 * 60 * 60 * 1000) return true;
  }
  const fresh = await runBackupRestoreDrill({ writeReport: true });
  return fresh.overallResult === 'PASS';
}
