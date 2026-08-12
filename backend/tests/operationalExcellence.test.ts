import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBusinessMetrics,
  computeOperationalTrustScore,
  evaluateMorningSla,
  extrasCountFromCertSummary,
  OPERATIONAL_PRIORITIES,
} from '../src/intelligence/inmates/operationalExcellence.js';

describe('Operational Excellence Charter', () => {
  it('keeps five fixed priorities in order', () => {
    assert.equal(OPERATIONAL_PRIORITIES.length, 5);
    assert.match(OPERATIONAL_PRIORITIES[0]!, /miss/i);
    assert.match(OPERATIONAL_PRIORITIES[1]!, /false/i);
    assert.match(OPERATIONAL_PRIORITIES[2]!, /review/i);
  });

  it('does not invent zero misses without sealed ground truth', () => {
    const open = computeBusinessMetrics({
      potentialClientsFound: 67,
      potentialClientsMissed: undefined,
      newCount: 67,
      returningCount: 0,
      falseOpportunities: null,
      groundTruthSealed: false,
    });
    assert.equal(open.potentialNewClientsIdentifiedToday, 67);
    assert.equal(open.potentialClientsMissed, null);
    assert.equal(open.falseOpportunities, null);

    const sealed = computeBusinessMetrics({
      potentialClientsFound: 67,
      potentialClientsMissed: 0,
      newCount: 67,
      returningCount: 0,
      falseOpportunities: 0,
      groundTruthSealed: true,
    });
    assert.equal(sealed.potentialClientsMissed, 0);
    assert.equal(sealed.falseOpportunities, 0);
  });

  it('scores trust higher for certified zero-defect mornings', () => {
    const trusted = computeOperationalTrustScore({
      certification: 'certified',
      reconcileOk: true,
      silentFailureCount: 0,
      potentialClientsMissed: 0,
      falseOpportunities: 0,
      automaticClassificationRatePercent: 95,
      consecutiveCertifiedDays: 10,
      openCriticalDefects: 0,
    });
    assert.ok(trusted.score != null && trusted.score >= 85);
    assert.equal(trusted.band, 'trusted');

    const unknown = computeOperationalTrustScore({
      certification: 'missing',
      reconcileOk: null,
      silentFailureCount: 0,
      potentialClientsMissed: null,
      falseOpportunities: null,
      automaticClassificationRatePercent: null,
      consecutiveCertifiedDays: 0,
      openCriticalDefects: 0,
    });
    assert.equal(unknown.band, 'unknown');
    assert.equal(unknown.score, null);
  });

  it('evaluates Morning SLA gates and refuses aspirational targets without env', () => {
    delete process.env.SAC_MORNING_SLA_MS;
    const sla = evaluateMorningSla({
      pdfAccepted: true,
      canonicalRosterGenerated: true,
      comparisonCompleted: true,
      newInmateReportAvailable: true,
      investigatorWorkspaceReady: true,
      certifiedReportPrintable: false,
      elapsedMs: 45_000,
    });
    assert.equal(sla.allGatesOk, false);
    assert.equal(sla.targetMs, null);
    assert.equal(sla.withinTarget, null);
    assert.match(sla.summary, /Certified report printable|SLA incomplete/);
  });

  it('reads false opportunities from certification summary extras', () => {
    assert.equal(extrasCountFromCertSummary({ extras: [{ name: 'A' }, { name: 'B' }] }), 2);
    assert.equal(extrasCountFromCertSummary({}), null);
  });
});
