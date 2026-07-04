// ============================================
// Program 21 — Production Operations tests
// ============================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildOperationsDashboard, buildSystemHealthAdapter } from '../src/productionOperations/operationsDashboard.js';
import { queryAuditCenter } from '../src/productionOperations/auditCenter.js';
import { buildChangeManagementReport } from '../src/productionOperations/changeManagement.js';
import { buildBackupOperationsReport, runBackupVerificationDrill } from '../src/productionOperations/backupOperations.js';
import { evaluateOperationsAlerts } from '../src/productionOperations/alertingService.js';

describe('Production Operations', () => {
  it('builds unified operations dashboard', async () => {
    const dashboard = await buildOperationsDashboard();
    assert.ok(dashboard.generatedAt);
    assert.ok(dashboard.productionGates.gates.length >= 15);
    assert.ok(['healthy', 'degraded', 'unhealthy', 'unknown'].includes(dashboard.overallStatus));
    assert.ok(dashboard.observability);
    assert.ok(Array.isArray(dashboard.alerts));
    console.log(`Dashboard: ${dashboard.overallStatus}, ${dashboard.alerts.length} alerts`);
  });

  it('builds system health adapter for legacy frontend', async () => {
    const health = await buildSystemHealthAdapter();
    assert.ok(health.lastRefreshed);
    assert.ok(Array.isArray(health.workerQueues));
    assert.ok(health.operationsDashboard);
  });

  it('queries audit center', async () => {
    const result = await queryAuditCenter({ limit: 10 });
    assert.ok(result.generatedAt);
    assert.ok(Array.isArray(result.records));
  });

  it('builds change management report', async () => {
    const report = await buildChangeManagementReport();
    assert.ok(report.migrations.length > 0);
    assert.ok(report.rollbackProcedures.length > 0);
  });

  it('builds backup operations report', async () => {
    const report = await buildBackupOperationsReport();
    assert.ok(report.status.database);
    assert.ok(report.automated);
  });

  it('runs backup verification drill', async () => {
    const drill = await runBackupVerificationDrill();
    assert.ok(['PASS', 'FAIL'].includes(drill.result));
    assert.ok(drill.checks.length > 0);
  });

  it('evaluates alerting rules', async () => {
    const dashboard = await buildOperationsDashboard();
    const alerts = evaluateOperationsAlerts(
      dashboard,
      {
        overallBillingIntegrity: 'FAIL',
        webhookEventsLast24h: 0,
        stripeConfigured: true,
        emailSync: 'NOT_IMPLEMENTED',
      } as never,
      { repositoryIntegrity: 'FAIL', parsingFailures: 5 } as never,
    );
    assert.ok(alerts.length > 0);
    assert.ok(alerts.some((a) => a.category === 'stripe' || a.category === 'repository'));
  });
});
