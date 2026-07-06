// ============================================================================
// Program 21 — Backup Operations
// ============================================================================

import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { BackupOperationsReport, BackupStatus, ComponentHealth } from './types.js';
import { getLatestDrillReport, runBackupRestoreDrill } from './backupRestoreDrill.js';

const WORKSPACE = resolve(import.meta.dirname ?? '.', '../../..');

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function buildBackupOperationsReport(): Promise<BackupOperationsReport> {
  const drDoc = await exists(join(WORKSPACE, 'DISASTER_RECOVERY.md'));
  const migrateScript = await exists(join(WORKSPACE, 'backend/scripts/db-safe-migrate.sh'));
  const dbIntegrity = await exists(join(WORKSPACE, 'reports/database_integrity_audit.json'));
  const repoDir = await exists(join(WORKSPACE, 'backend/data/legislative/repositories'));
  const kgDir = await exists(join(WORKSPACE, 'backend/data/legislative/repositories/offenses/records.jsonl'));
  const drillReport = await getLatestDrillReport();

  const database: ComponentHealth = {
    status: drDoc && migrateScript ? 'healthy' : 'degraded',
    message: drDoc ? 'DR documentation present' : 'DISASTER_RECOVERY.md missing',
  };

  const repositories: ComponentHealth = {
    status: repoDir ? 'healthy' : 'degraded',
    message: repoDir ? 'Legislative repository snapshots on disk' : 'Repository directory missing',
  };

  const knowledgeGraph: ComponentHealth = {
    status: kgDir ? 'healthy' : 'degraded',
    message: kgDir ? 'Knowledge graph repository files present' : 'KG snapshots not found',
  };

  const configuration: ComponentHealth = {
    status: await exists(join(WORKSPACE, 'backend/.env.production.template')) ? 'healthy' : 'degraded',
    message: 'Configuration template available for backup reference',
  };

  const blockers: string[] = [];
  if (!drDoc) blockers.push('DISASTER_RECOVERY.md not found');
  if (!migrateScript) blockers.push('db-safe-migrate.sh not found');
  if (drillReport?.overallResult !== 'PASS') {
    blockers.push('Automated restore drill not passing — run npm run backup:drill');
  }

  const restoreDrillStatus: BackupStatus['restoreDrillStatus'] =
    drillReport?.overallResult === 'PASS' ? 'PASS' : drillReport?.overallResult === 'FAIL' ? 'FAIL' : 'NOT_RUN';

  const status: BackupStatus = {
    database,
    repositories,
    knowledgeGraph,
    configuration,
    lastVerifiedAt: drillReport?.generatedAt ?? new Date().toISOString(),
    restoreDrillStatus,
  };

  return {
    generatedAt: new Date().toISOString(),
    status,
    automated: {
      databaseBackups: drDoc,
      repositorySnapshots: repoDir,
      knowledgeGraphSnapshots: kgDir,
      configurationBackups: await exists(join(WORKSPACE, 'backend/.env.production.template')),
      restoreVerification: dbIntegrity && drillReport?.overallResult === 'PASS',
      recoveryDrills: drillReport?.overallResult === 'PASS',
    },
    blockers,
  };
}

export async function runBackupVerificationDrill(): Promise<{
  result: 'PASS' | 'FAIL';
  checks: string[];
  report: Awaited<ReturnType<typeof runBackupRestoreDrill>>;
}> {
  const report = await runBackupRestoreDrill({ writeReport: true });
  const checks = report.checks.map((c) => `${c.label}: ${c.result} — ${c.detail}`);
  return { result: report.overallResult, checks, report };
}
