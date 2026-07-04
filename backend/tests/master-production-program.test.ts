import assert from 'node:assert/strict';
import test from 'node:test';
import { assessMasterProductionProgram } from '../src/productionGates/masterProductionProgram.js';
import { MASTER_PRODUCTION_PHASES } from '../src/productionGates/phaseDefinitions.js';

test('master production program defines 22 phases', () => {
  assert.equal(MASTER_PRODUCTION_PHASES.length, 22);
  assert.equal(MASTER_PRODUCTION_PHASES[0].id, 'PHASE-01');
  assert.equal(MASTER_PRODUCTION_PHASES[21].id, 'PHASE-22');
});

test('assessMasterProductionProgram returns structured report', async () => {
  const report = await assessMasterProductionProgram();
  assert.equal(report.program, 'COURTACCESS_MASTER_PRODUCTION_PROGRAM');
  assert.equal(report.phases.length, 22);
  assert.ok(report.capabilitiesTotal > 0);
  assert.ok(['PRODUCTION_READY', 'NOT_READY', 'RELEASE_CANDIDATE'].includes(report.overallStatus));
  for (const phase of report.phases) {
    assert.ok(phase.capabilities.length > 0);
    assert.ok(['COMPLETE', 'PARTIAL', 'NOT_STARTED'].includes(phase.status));
  }
});
