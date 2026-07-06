// ============================================
// Domain U — Attorney Intelligence Engine tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma.js';
import { analyzeElementsForCharge } from '../src/intelligence/elementAnalysis.js';
import { generateAttorneyReport } from '../src/intelligence/reportGenerator.js';
import { collectUnknowns } from '../src/intelligence/unknownManagement.js';
import { buildCaseIntelligence } from '../src/intelligence/caseIntelligenceOrchestrator.js';
import type { ElementRecord } from '../src/legislative/knowledgeGraph/types.js';
import { INTELLIGENCE_VERSION } from '../src/intelligence/types.js';

const TEST_PREFIX = 'intel-test-';

function mockElement(id: string, label: string): ElementRecord {
  return {
    id,
    sourceStatuteId: 'stat-1',
    offenseId: 'off-1',
    label: { value: label, confidence: 'HIGH' },
    description: { value: `Description for ${label}`, confidence: 'HIGH' },
    required: true,
    audit: {
      extractedAt: new Date().toISOString(),
      extractorVersion: 'test',
      sourceStatuteId: 'stat-1',
      sourceUrl: 'https://test',
      contentHash: 'abc',
      parseStatus: 'success',
    },
  };
}

describe('Attorney Intelligence — element analysis', () => {
  it('marks element unsatisfied when no evidence maps', () => {
    const matrix = analyzeElementsForCharge({
      chargeId: 'ch-1',
      code: 'PEN',
      section: '459.',
      elements: [mockElement('el-1', 'unlawful entry')],
      evidence: [{ evidenceId: 'ev-1', fileName: 'report.pdf', evidenceType: 'police_report', processingStatus: 'analyzed' }],
      claims: [],
      validations: [],
      timelineEvents: [],
    });
    assert.equal(matrix.rows.length, 1);
    assert.equal(matrix.rows[0].status, 'unsatisfied');
    assert.ok(matrix.rows[0].missingEvidenceReason);
  });

  it('marks element satisfied when claim validation supports with evidence', () => {
    const matrix = analyzeElementsForCharge({
      chargeId: 'ch-1',
      code: 'PEN',
      section: '459.',
      elements: [mockElement('el-1', 'unlawful entry building')],
      evidence: [{ evidenceId: 'ev-1', fileName: 'report.pdf', evidenceType: 'police_report', processingStatus: 'analyzed' }],
      claims: [{ claimId: 'cl-1', claimText: 'Suspect made unlawful entry into building', evidenceId: 'ev-1' }],
      validations: [{
        claimId: 'cl-1',
        status: 'supported',
        supportingEvidenceIds: ['ev-1'],
        contradictingEvidenceIds: [],
        reasoning: 'Police report supports',
      }],
      timelineEvents: [],
    });
    assert.equal(matrix.rows[0].status, 'satisfied');
    assert.equal(matrix.rows[0].supportingEvidence.length, 1);
  });

  it('never marks satisfied without evidence reference', () => {
    const matrix = analyzeElementsForCharge({
      chargeId: 'ch-1',
      code: 'PEN',
      section: '459.',
      elements: [mockElement('el-1', 'intent to steal')],
      evidence: [],
      claims: [],
      validations: [],
      timelineEvents: [],
    });
    assert.notEqual(matrix.rows[0].status, 'satisfied');
  });
});

describe('Attorney Intelligence — report generator', () => {
  it('generates report sections only from structured data', () => {
    const report = generateAttorneyReport({
      generatedAt: new Date().toISOString(),
      intelligenceVersion: INTELLIGENCE_VERSION,
      caseId: 'case-1',
      tenantId: 'tenant-1',
      caseOverview: {
        caseId: 'case-1',
        tenantId: 'tenant-1',
        title: 'Test Case',
        caseNumber: 'CR-001',
        status: 'active',
        phase: 'pretrial',
        client: null,
        charges: [{ id: 'c1', code: 'PEN', section: '459.', title: 'Burglary', victim: 'State' }],
        evidenceCount: 1,
        timelineEventCount: 0,
        claimCount: 0,
        witnessCount: 0,
      },
      offenseAnalysis: [],
      elementMatrices: [],
      evidenceSummary: { total: 1, byType: {}, processingPending: 0, findings: [] },
      authorityMatrix: [],
      timelineSummary: { eventCount: 0, conflictCount: 0, findings: [] },
      contradictionAnalysis: [],
      unknowns: collectUnknowns([], [], ['Test unknown']),
      riskFactors: [],
      recommendedInvestigation: ['Obtain bodycam'],
      recommendedMotions: [],
      calcrimAnalysis: [],
      auditTrail: [],
    });

    assert.ok(report.sections.length >= 3);
    assert.ok(report.reproducibilityHash);
    const unknownSection = report.sections.find((s) => s.id === 'unknowns');
    assert.ok(unknownSection?.sentences.some((s) => s.text.includes('UNKNOWN')));
    for (const section of report.sections) {
      for (const sentence of section.sentences) {
        assert.ok(sentence.citations.length > 0, 'Every sentence must have citations');
      }
    }
  });
});

describe('Attorney Intelligence — case orchestrator', () => {
  let tenantId = '';
  let userId = '';
  let caseId = '';

  before(async () => {
    tenantId = `${TEST_PREFIX}${randomUUID().slice(0, 8)}`;
    userId = randomUUID();
    caseId = randomUUID();

    await prisma.organization.create({ data: { id: tenantId, name: 'Intel Test Firm', orgType: 'law_firm' } });
    await prisma.user.create({
      data: {
        id: userId,
        email: `${TEST_PREFIX}${randomUUID().slice(0, 8)}@cert.courtaccess.test`,
        name: 'Intel Test',
        passwordHash: await bcrypt.hash('Test123!', 10),
        role: 'attorney',
        tenantId,
      },
    });
    await prisma.criminalCase.create({
      data: {
        caseId,
        tenantId,
        ownerId: userId,
        title: 'People v. Test',
        caseNumber: `INT-${randomUUID().slice(0, 6)}`,
        jurisdiction: 'LA County',
        caseType: 'felony',
      },
    });
    await prisma.charge.create({
      data: { caseId, code: 'PEN', section: '459', title: 'Burglary', victim: 'State' },
    });
  });

  after(async () => {
    await prisma.charge.deleteMany({ where: { caseId } }).catch(() => undefined);
    await prisma.criminalCase.deleteMany({ where: { caseId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    await prisma.organization.deleteMany({ where: { id: tenantId } }).catch(() => undefined);
  });

  it('builds case intelligence with unknowns when repository missing', async () => {
    const intelligence = await buildCaseIntelligence(caseId, tenantId);
    assert.ok(intelligence);
    assert.equal(intelligence!.caseId, caseId);
    assert.equal(intelligence!.intelligenceVersion, INTELLIGENCE_VERSION);
    assert.ok(intelligence!.unknowns.all.length > 0);
    assert.ok(intelligence!.elementMatrices.length >= 1);
    console.log(`Intelligence: ${intelligence!.unknowns.all.length} unknowns, ${intelligence!.riskFactors.length} risks`);
  });
});
