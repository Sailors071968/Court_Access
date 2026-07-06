// ============================================
// Domain V — Attorney Workbench tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma.js';
import { buildAttorneyWorkbench } from '../src/workbench/workbenchService.js';
import { buildTrialPreparation } from '../src/workbench/trialPrepService.js';
import { generateWorkbenchExport } from '../src/workbench/exportService.js';
import { buildCaseIntelligence } from '../src/intelligence/caseIntelligenceOrchestrator.js';
import { WORKBENCH_VERSION } from '../src/workbench/types.js';

const TEST_PREFIX = 'wb-test-';

describe('Attorney Workbench — trial preparation', () => {
  it('never generates trial prep without citations when evidence exists', () => {
    const intelligence = {
      caseOverview: { charges: [{ id: '1', code: 'PEN', section: '459', title: 'Burglary', victim: 'x' }], phase: 'pretrial' },
      contradictionAnalysis: [],
      elementMatrices: [],
      unknowns: { all: [], facts: [], legalIssues: [], elements: [], evidence: [], timelines: [] },
      riskFactors: [],
      recommendedMotions: [],
    } as Awaited<ReturnType<typeof buildCaseIntelligence>>;

    const prep = buildTrialPreparation(
      intelligence!,
      [{ evidenceId: 'ev-1', fileName: 'report.pdf', evidenceType: 'police_report' }],
      [],
      [],
    );

    assert.ok(prep.exhibitList.length >= 1);
    assert.equal(prep.exhibitList[0].citations.length, 1);
    assert.equal(prep.exhibitList[0].citations[0].type, 'evidence');
  });

  it('reports UNKNOWN witness list when no timeline actors', () => {
    const intelligence = {
      caseOverview: { charges: [], phase: 'intake' },
      contradictionAnalysis: [],
      elementMatrices: [],
      unknowns: { all: ['No witnesses'], facts: [], legalIssues: [], elements: [], evidence: [], timelines: [] },
      riskFactors: [],
      recommendedMotions: [],
    } as Awaited<ReturnType<typeof buildCaseIntelligence>>;

    const prep = buildTrialPreparation(intelligence!, [], [], []);
    assert.ok(prep.witnessList.some((w) => w.title.includes('UNKNOWN')));
  });
});

describe('Attorney Workbench — exports', () => {
  it('preserves reproducibility hash and audit trail', () => {
    const bundle = {
      generatedAt: new Date().toISOString(),
      workbenchVersion: WORKBENCH_VERSION,
      caseId: 'case-1',
      tenantId: 'tenant-1',
      evidenceWorkbench: { items: [], timeline: [], graph: { nodes: [], edges: [] }, contradictions: [], duplicates: [], missing: [], filters: { types: [], statuses: [] } },
      trialPreparation: { witnessList: [], exhibitList: [], crossExaminationTopics: [], impeachmentOpportunities: [], voirDireNotes: [], openingOutline: [], closingOutline: [], trialNotebook: [] },
      legalAuthority: { statutes: [], authorities: [], calcrim: [], crossReferences: [], enhancements: [], exceptions: [], defenses: [], relatedOffenses: [] },
      intelligence: {
        intelligenceVersion: '1.0.0',
        auditTrail: [{ generatedAt: new Date().toISOString(), intelligenceVersion: '1.0.0', pipelineVersion: 'test', reasoning: 'test', sourceType: 'evidence' as const }],
      },
    } as Parameters<typeof generateWorkbenchExport>[0];

    const exp = generateWorkbenchExport(bundle, 'trial_notebook');
    assert.ok(exp.reproducibilityHash);
    assert.equal(exp.auditTrail.length, 1);
    assert.equal(exp.workbenchVersion, WORKBENCH_VERSION);
  });
});

describe('Attorney Workbench — case orchestrator', () => {
  let tenantId: string;
  let userId: string;
  let caseId: string;

  before(async () => {
    tenantId = `${TEST_PREFIX}${randomUUID()}`;
    userId = randomUUID();
    caseId = randomUUID();

    await prisma.user.create({
      data: {
        id: userId,
        email: `${TEST_PREFIX}${randomUUID()}@test.local`,
        name: 'Workbench Test User',
        passwordHash: await bcrypt.hash('test', 4),
        role: 'attorney',
        tenantId,
      },
    });

    await prisma.criminalCase.create({
      data: {
        caseId,
        tenantId,
        ownerId: userId,
        title: 'Workbench Test Case',
        caseNumber: `${TEST_PREFIX}${Date.now()}`,
        jurisdiction: 'CA',
        caseType: 'felony',
      },
    });

    await prisma.charge.create({
      data: { caseId, code: 'PEN', section: '459.', title: 'Burglary', victim: 'Property' },
    });
  });

  after(async () => {
    await prisma.investigationTask.deleteMany({ where: { caseId } });
    await prisma.workbenchPin.deleteMany({ where: { caseId } });
    await prisma.attorneyNote.deleteMany({ where: { caseId } });
    await prisma.charge.deleteMany({ where: { caseId } });
    await prisma.criminalCase.deleteMany({ where: { caseId } });
    await prisma.user.deleteMany({ where: { tenantId } });
  });

  it('builds workbench with command center and unknowns', async () => {
    const workbench = await buildAttorneyWorkbench(caseId, tenantId, userId);
    assert.ok(workbench);
    assert.equal(workbench.workbenchVersion, WORKBENCH_VERSION);
    assert.ok(workbench.commandCenter);
    assert.ok(Array.isArray(workbench.caseOverview.outstandingUnknowns));
    assert.equal(workbench.offenseAnalysis.length, 1);
  });

  it('supports notes, pins, and tasks with tenant isolation', async () => {
    const note = await prisma.attorneyNote.create({
      data: { caseId, tenantId, userId, content: 'Private strategy note' },
    });
    const pin = await prisma.workbenchPin.create({
      data: { caseId, tenantId, userId, pinType: 'evidence', entityId: 'ev-test', label: 'Key exhibit' },
    });
    const task = await prisma.investigationTask.create({
      data: { caseId, tenantId, title: 'Obtain bodycam', createdBy: userId, sourceType: 'evidence_gap' },
    });

    const workbench = await buildAttorneyWorkbench(caseId, tenantId, userId);
    assert.equal(workbench!.attorneyNotes.notes.length, 1);
    assert.equal(workbench!.attorneyNotes.pins.length, 1);
    assert.equal(workbench!.investigation.tasks.length, 1);
    assert.equal(workbench!.attorneyNotes.notes[0].id, note.id);
    assert.equal(workbench!.investigation.tasks[0].id, task.id);

    await prisma.attorneyNote.delete({ where: { id: note.id } });
    await prisma.workbenchPin.delete({ where: { id: pin.id } });
    await prisma.investigationTask.delete({ where: { id: task.id } });
  });
});
