// ============================================
// PG-015 — Backup Restore Drill tests
// ============================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runBackupRestoreDrill, getLatestDrillReport } from '../src/productionOperations/backupRestoreDrill.js';

const REPORT_PATH = resolve(import.meta.dirname ?? '.', '../../reports/BACKUP_RESTORE_DRILL.json');

describe('Backup Restore Drill (PG-015)', () => {
  it('runs drill and writes report artifact', async () => {
    const report = await runBackupRestoreDrill({ writeReport: true });
    assert.ok(report.drillVersion);
    assert.equal(report.overallResult, 'PASS');
    assert.ok(report.passCount >= 8);
    assert.equal(report.failCount, 0);

    await access(REPORT_PATH);
    const latest = await getLatestDrillReport();
    assert.equal(latest?.overallResult, 'PASS');
  });

  it('verifies all required checks present', async () => {
    const report = await runBackupRestoreDrill({ writeReport: false });
    const ids = report.checks.map((c) => c.id);
    assert.ok(ids.includes('dr-documentation'));
    assert.ok(ids.includes('db-connectivity'));
    assert.ok(ids.includes('critical-tables'));
    assert.ok(ids.includes('migration-state'));
  });
});
