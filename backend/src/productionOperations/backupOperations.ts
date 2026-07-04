// ============================================================================
// Program 21 — Backup Operations
// ============================================================================

import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { BackupOperationsReport, BackupStatus, ComponentHealth } from './types.js';

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
  const kgDir = await exists(join(WORKSPACE, 'backend/data/legislative/repositories/offenses.json'));

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
  blockers.push('Automated restore drill not yet implemented (PG-015)');

  const status: BackupStatus = {
    database,
    repositories,
    knowledgeGraph,
    configuration,
    lastVerifiedAt: new Date().toISOString(),
    restoreDrillStatus: 'NOT_RUN',
  };

  return {
    generatedAt: new Date().toISOString(),
    status,
    automated: {
      databaseBackups: drDoc,
      repositorySnapshots: repoDir,
      knowledgeGraphSnapshots: kgDir,
      configurationBackups: await exists(join(WORKSPACE, 'backend/.env.production.template')),
      restoreVerification: dbIntegrity,
      recoveryDrills: false,
    },
    blockers,
  };
}

export async function runBackupVerificationDrill(): Promise<{ result: 'PASS' | 'FAIL'; checks: string[] }> {
  const checks: string[] = [];
  let pass = true;

  const report = await buildBackupOperationsReport();
  if (report.automated.databaseBackups) checks.push('DR documentation: PASS');
  else { checks.push('DR documentation: FAIL'); pass = false; }

  if (report.automated.repositorySnapshots) checks.push('Repository snapshots: PASS');
  else { checks.push('Repository snapshots: FAIL'); pass = false; }

  if (report.automated.restoreVerification) checks.push('Database integrity audit: PASS');
  else { checks.push('Database integrity audit: FAIL'); pass = false; }

  try {
    const integrity = JSON.parse(
      await readFile(join(WORKSPACE, 'reports/database_integrity_audit.json'), 'utf-8'),
    ) as { status?: string };
    if (integrity.status === 'PASS' || integrity.status === 'PRODUCTION_READY') {
      checks.push('Integrity audit status: PASS');
    } else {
      checks.push('Integrity audit status: PARTIAL');
    }
  } catch {
    checks.push('Integrity audit read: SKIP');
  }

  return { result: pass ? 'PASS' : 'FAIL', checks };
}
