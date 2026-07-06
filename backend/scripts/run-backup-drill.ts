#!/usr/bin/env tsx
// PG-015 — Automated backup restore drill runner

import { runBackupRestoreDrill } from '../src/productionOperations/backupRestoreDrill.ts';

async function main() {
  const report = await runBackupRestoreDrill({ writeReport: true });
  console.log(`Backup Restore Drill: ${report.overallResult} (${report.passCount} PASS / ${report.failCount} FAIL / ${report.skipCount} SKIP)`);
  for (const c of report.checks) {
    console.log(`  [${c.result}] ${c.label}: ${c.detail}`);
  }
  console.log(`Report: reports/BACKUP_RESTORE_DRILL.json`);
  if (report.overallResult !== 'PASS') process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
