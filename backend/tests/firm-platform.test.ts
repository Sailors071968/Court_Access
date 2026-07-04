// ============================================
// Program 2 — Law Firm Operating Platform tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma.js';
import {
  createDepartment,
  assignClientTeam,
  runConflictCheck,
  createKnowledgeAsset,
  createOrgTask,
  sendInternalMessage,
  grantPermission,
  getExpandedFirmAnalytics,
  seedCaliforniaOffices,
  upsertPersonnelProfile,
} from '../src/organizations/firmPlatformService.js';

const PREFIX = 'firm-platform-';

describe('Law Firm Operating Platform', () => {
  let tenantId = '';
  let userId = '';
  let clientId = '';

  before(async () => {
    tenantId = `${PREFIX}${randomUUID().slice(0, 8)}`;
    userId = randomUUID();
    await prisma.organization.create({ data: { id: tenantId, name: 'Platform Test Firm', orgType: 'law_firm' } });
    await prisma.user.create({
      data: {
        id: userId,
        email: `${PREFIX}${randomUUID().slice(0, 8)}@test.courtaccess.test`,
        name: 'Firm Admin',
        passwordHash: await bcrypt.hash('Test123!', 10),
        role: 'admin',
        tenantId,
      },
    });
    await prisma.organizationMember.create({ data: { organizationId: tenantId, userId, role: 'admin', personnelType: 'attorney' } });
    const client = await prisma.client.create({
      data: { tenantId, ownerId: userId, firstName: 'Conflict', lastName: 'TestClient', status: 'active' },
    });
    clientId = client.clientId;
  });

  after(async () => {
    await prisma.conflictRecord.deleteMany({ where: { tenantId } }).catch(() => undefined);
    await prisma.knowledgeAsset.deleteMany({ where: { tenantId } }).catch(() => undefined);
    await prisma.orgTask.deleteMany({ where: { tenantId } }).catch(() => undefined);
    await prisma.orgInternalMessage.deleteMany({ where: { organizationId: tenantId } }).catch(() => undefined);
    await prisma.clientTeamAssignment.deleteMany({ where: { tenantId } }).catch(() => undefined);
    await prisma.permissionGrant.deleteMany({ where: { organizationId: tenantId } }).catch(() => undefined);
    await prisma.personnelProfile.deleteMany({ where: { organizationId: tenantId } }).catch(() => undefined);
    await prisma.organizationDepartment.deleteMany({ where: { organizationId: tenantId } }).catch(() => undefined);
    await prisma.organizationOffice.deleteMany({ where: { organizationId: tenantId } }).catch(() => undefined);
    await prisma.client.deleteMany({ where: { tenantId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({ where: { organizationId: tenantId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    await prisma.organization.deleteMany({ where: { id: tenantId } }).catch(() => undefined);
  });

  it('seeds California multi-office branches', async () => {
    const offices = await seedCaliforniaOffices(tenantId);
    assert.ok(offices.length >= 4);
    const cities = offices.map((o) => o.city);
    assert.ok(cities.includes('Sacramento'));
    assert.ok(cities.includes('Los Angeles'));
  });

  it('creates departments and personnel profiles', async () => {
    const office = await prisma.organizationOffice.findFirst({ where: { organizationId: tenantId } });
    assert.ok(office);
    const dept = await createDepartment(tenantId, { name: 'Criminal Defense', officeId: office!.officeId });
    const profile = await upsertPersonnelProfile(tenantId, userId, {
      personnelType: 'attorney',
      jobTitle: 'Managing Partner',
      barNumber: 'CA-12345',
      certifications: [{ name: 'Trial Advocacy', issuer: 'NACDL' }],
    });
    assert.equal(profile.personnelType, 'attorney');
    assert.equal(dept.name, 'Criminal Defense');
  });

  it('assigns client team with primary attorney and office', async () => {
    const office = await prisma.organizationOffice.findFirst({ where: { organizationId: tenantId } });
    const assignment = await assignClientTeam(tenantId, clientId, {
      primaryAttorneyId: userId,
      officeId: office?.officeId,
    });
    assert.equal(assignment.primaryAttorneyId, userId);
  });

  it('runs conflict detection for existing client name', async () => {
    const result = await runConflictCheck(tenantId, { name: 'Conflict' });
    assert.ok(result.conflicts.length >= 1);
    assert.equal(result.clientMatches, 1);
  });

  it('supports collaboration: messages, tasks, knowledge', async () => {
    const msg = await sendInternalMessage(tenantId, userId, { body: 'Team standup at 9am', channel: 'team' });
    const task = await createOrgTask(tenantId, userId, { title: 'Review discovery', taskType: 'case' });
    const asset = await createKnowledgeAsset(tenantId, userId, { assetType: 'motion', title: 'Motion to Suppress Template', body: 'Template body' });
    assert.ok(msg.messageId);
    assert.ok(task.taskId);
    assert.ok(asset.assetId);
  });

  it('grants office-level permissions', async () => {
    const grant = await grantPermission(tenantId, userId, { userId, scope: 'office', permission: 'admin' });
    assert.equal(grant.scope, 'office');
  });

  it('returns expanded firm analytics with office breakdown', async () => {
    const analytics = await getExpandedFirmAnalytics(tenantId);
    assert.ok(analytics.activeCases >= 0);
    assert.ok(Array.isArray(analytics.officeStats));
    assert.ok(analytics.officeStats.length >= 4);
  });
});
