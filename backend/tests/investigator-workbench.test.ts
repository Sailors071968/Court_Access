// ============================================
// Program 12 — Investigator Workbench tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma.js';
import { buildInvestigatorWorkbench } from '../src/investigator/investigatorWorkbenchService.js';
import { INVESTIGATOR_WORKBENCH_VERSION } from '../src/investigator/types.js';

const TEST_PREFIX = 'inv-wb-';

describe('Investigator Workbench', () => {
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
        name: 'Investigator Test',
        passwordHash: await bcrypt.hash('test', 4),
        role: 'investigator',
        tenantId,
      },
    });

    await prisma.criminalCase.create({
      data: {
        caseId,
        tenantId,
        ownerId: userId,
        title: 'Investigator Test Case',
        caseNumber: `${TEST_PREFIX}${Date.now()}`,
        jurisdiction: 'CA',
        caseType: 'felony',
      },
    });
  });

  after(async () => {
    await prisma.fieldNote.deleteMany({ where: { caseId } });
    await prisma.investigationLead.deleteMany({ where: { caseId } });
    await prisma.caseWitness.deleteMany({ where: { caseId } });
    await prisma.investigationAssignment.deleteMany({ where: { caseId } });
    await prisma.investigationTask.deleteMany({ where: { caseId } });
    await prisma.criminalCase.deleteMany({ where: { caseId } });
    await prisma.user.deleteMany({ where: { tenantId } });
  });

  it('builds investigator workbench with dashboard metrics', async () => {
    const wb = await buildInvestigatorWorkbench(caseId, tenantId);
    assert.ok(wb);
    assert.equal(wb.version, INVESTIGATOR_WORKBENCH_VERSION);
    assert.equal(wb.dashboard.caseTitle, 'Investigator Test Case');
    assert.ok(Array.isArray(wb.unknowns));
  });

  it('supports witnesses, leads, field notes, and assignments', async () => {
    await prisma.caseWitness.create({
      data: { caseId, tenantId, name: 'Jane Doe', role: 'eyewitness', createdBy: userId },
    });
    await prisma.investigationLead.create({
      data: { caseId, tenantId, title: 'Follow up on surveillance', createdBy: userId },
    });
    await prisma.fieldNote.create({
      data: { caseId, tenantId, userId, content: 'Scene observation at Main St', noteType: 'scene' },
    });
    await prisma.investigationAssignment.create({
      data: { caseId, tenantId, investigatorId: userId, assignedBy: userId },
    });

    const wb = await buildInvestigatorWorkbench(caseId, tenantId);
    assert.equal(wb!.witnesses.length, 1);
    assert.equal(wb!.leads.length, 1);
    assert.equal(wb!.fieldNotes.length, 1);
    assert.equal(wb!.assignments.length, 1);
    assert.equal(wb!.dashboard.witnessCount, 1);
  });

  it('never fabricates witness data without source', async () => {
    const wb = await buildInvestigatorWorkbench(caseId, tenantId);
    for (const w of wb!.witnesses) {
      if (w.sourceType === 'timeline') {
        assert.ok(w.citations.length > 0, 'Timeline-derived witnesses must have citations');
      }
    }
  });
});
