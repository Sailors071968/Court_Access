// ============================================================================
// Program 21 — Change Management
// ============================================================================

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ChangeManagementReport, ChangeRecord } from './types.js';

const WORKSPACE = resolve(import.meta.dirname ?? '.', '../../..');

async function listMigrations(): Promise<ChangeRecord[]> {
  const migrationsDir = join(WORKSPACE, 'backend/prisma/migrations');
  const records: ChangeRecord[] = [];
  try {
    const dirs = await readdir(migrationsDir);
    for (const dir of dirs) {
      if (dir === 'migration_lock.toml') continue;
      const sqlPath = join(migrationsDir, dir, 'migration.sql');
      try {
        const info = await stat(join(migrationsDir, dir));
        records.push({
          id: dir,
          type: 'migration',
          version: dir.split('_')[0],
          description: dir.replace(/^\d+_/, '').replace(/_/g, ' '),
          timestamp: info.mtime.toISOString(),
          path: `backend/prisma/migrations/${dir}/migration.sql`,
        });
      } catch {
        // skip non-migration dirs
      }
    }
  } catch {
    // no migrations
  }
  return records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function buildChangeManagementReport(): Promise<ChangeManagementReport> {
  const migrations = await listMigrations();

  let appVersion = '1.0.0';
  try {
    const pkg = JSON.parse(await readFile(join(WORKSPACE, 'backend/package.json'), 'utf-8')) as { version?: string };
    appVersion = pkg.version ?? appVersion;
  } catch {
    // default version
  }

  const releases: ChangeRecord[] = [
    {
      id: 'release-current',
      type: 'release',
      version: appVersion,
      description: `CourtAccess backend v${appVersion}`,
      timestamp: new Date().toISOString(),
      path: 'backend/package.json',
    },
  ];

  const schemaHistory: ChangeRecord[] = migrations.filter((m) => m.description.includes('schema') || m.description.includes('persistence'));

  const deployments: ChangeRecord[] = [
    {
      id: 'deploy-procedure',
      type: 'deployment',
      description: 'Production deployment via git push + db-safe-migrate.sh deploy',
      timestamp: new Date().toISOString(),
      path: 'backend/scripts/db-safe-migrate.sh',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    releases,
    migrations,
    schemaHistory,
    deployments,
    rollbackProcedures: [
      'Restore database from latest RDS snapshot or pg_dump backup',
      'Revert application to previous container image / git tag',
      'Run prisma migrate resolve if migration partially applied',
      'Verify production gates: npm run gates:run',
      'See DISASTER_RECOVERY.md for full RTO/RPO procedures',
    ],
  };
}
