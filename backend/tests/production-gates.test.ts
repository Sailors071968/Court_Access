// ============================================
// Program 1 — Production Gates tests
// ============================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runProductionGates } from '../src/productionGates/runProductionGates.js';
import { summarizeGates } from '../src/productionGates/types.js';

const REQUIRED_GATES = [
  'PG-001',
  'PG-002',
  'PG-003',
  'PG-004',
  'PG-005',
  'PG-006',
  'PG-007',
  'PG-008',
  'PG-009',
  'PG-010',
  'PG-011',
  'PG-012',
  'PG-013',
  'PG-014',
  'PG-015',
];

describe('Production Gates', () => {
  it('runs all 15 production gates', async () => {
    const report = await runProductionGates();

    assert.ok(report.generatedAt);
    assert.equal(report.version, '4.0');
    assert.equal(report.gates.length, 15);

    for (const id of REQUIRED_GATES) {
      const gate = report.gates.find((g) => g.id === id);
      assert.ok(gate, `Missing gate: ${id}`);
      assert.ok(['PASS', 'FAIL', 'PARTIAL', 'SKIP'].includes(gate!.result));
      assert.ok(gate!.testSteps.length > 0);
    }

    const summary = summarizeGates(report.gates);
    assert.equal(summary.passCount + summary.failCount + summary.partialCount + summary.skipCount, 15);
    assert.equal(report.overallResult, summary.overallResult);
    assert.equal(report.deploymentBlocked, summary.deploymentBlocked);

    console.log(
      `Gates: ${report.passCount} PASS, ${report.failCount} FAIL, ${report.partialCount} PARTIAL, ${report.skipCount} SKIP`,
    );
  });

  it('blocks deployment when any gate is not PASS', async () => {
    const report = await runProductionGates();
    const allPass = report.gates.every((g) => g.result === 'PASS');
    assert.equal(report.deploymentBlocked, !allPass);
    if (!allPass) {
      assert.equal(report.overallResult, 'NOT_READY');
      assert.ok(report.blockers.length > 0);
    }
  });
});
