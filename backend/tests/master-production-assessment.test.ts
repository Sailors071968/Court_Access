import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSESSMENT_VERSION, runMasterProductionAssessment } from '../src/productionGates/masterProductionAssessment.ts';

test('ASSESSMENT_VERSION is 1.0', () => {
  assert.equal(ASSESSMENT_VERSION, '1.0');
});

test('runMasterProductionAssessment returns 25 programs and objective completion', async () => {
  const report = await runMasterProductionAssessment();
  assert.equal(report.assessment, 'COURTACCESS_MASTER_PRODUCTION_ASSESSMENT');
  assert.equal(report.version, '1.0');
  assert.equal(report.programs.length, 25);
  assert.ok(report.summary.totalCapabilities >= 180);
  assert.equal(
    report.summary.overallCompletionPercent,
    Math.round((report.summary.verifiedCapabilities / report.summary.totalCapabilities) * 1000) / 10,
  );
  assert.equal(report.formula, 'Completion % = Verified Capabilities ÷ Total Planned Capabilities');
});
