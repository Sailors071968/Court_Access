// ============================================
// Program 2 — Organization domain tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma.js';
import {
  createInvitation,
  acceptInvitation,
  createOffice,
  createPracticeGroup,
  firmWideSearch,
  getFirmAnalytics,
  verifyTenantAccess,
  advanceOnboarding,
} from '../src/organizations/organizationService.js';
import { validateMemberRole, validateOrgType, isOrgAdmin } from '../src/organizations/organizationTypes.js';

const PREFIX = 'org-test-';

describe('Organization types', () => {
  it('validates org types and member roles', () => {
    assert.equal(validateOrgType('law_firm'), true);
    assert.equal(validateOrgType('invalid'), false);
    assert.equal(validateMemberRole('attorney'), true);
    assert.equal(validateMemberRole('defendant'), false);
  });

  it('identifies org admins', () => {
    assert.equal(isOrgAdmin('admin'), true);
    assert.equal(isOrgAdmin('attorney', 'admin'), true);
    assert.equal(isOrgAdmin('staff'), false);
  });
});

describe('Multi-tenant organization platform', () => {
  let firmA = '';
  let firmB = '';
  let adminA = '';
  let adminB = '';
  let clientA = '';

  before(async () => {
    firmA = `${PREFIX}a-${randomUUID().slice(0, 8)}`;
    firmB = `${PREFIX}b-${randomUUID().slice(0, 8)}`;
    adminA = randomUUID();
    adminB = randomUUID();

    await prisma.organization.create({ data: { id: firmA, name: 'Firm Alpha', orgType: 'law_firm' } });
    await prisma.organization.create({ data: { id: firmB, name: 'Firm Beta', orgType: 'law_firm' } });

    await prisma.user.create({
      data: {
        id: adminA,
        email: `${PREFIX}${randomUUID().slice(0, 8)}@alpha.test`,
        name: 'Alpha Admin',
        passwordHash: await bcrypt.hash('Test123!', 10),
        role: 'admin',
        tenantId: firmA,
      },
    });
    await prisma.user.create({
      data: {
        id: adminB,
        email: `${PREFIX}${randomUUID().slice(0, 8)}@beta.test`,
        name: 'Beta Admin',
        passwordHash: await bcrypt.hash('Test123!', 10),
        role: 'admin',
        tenantId: firmB,
      },
    });

    await prisma.organizationMember.create({
      data: { organizationId: firmA, userId: adminA, role: 'admin', status: 'active' },
    });
    await prisma.organizationMember.create({
      data: { organizationId: firmB, userId: adminB, role: 'admin', status: 'active' },
    });

    const client = await prisma.client.create({
      data: { tenantId: firmA, ownerId: adminA, firstName: 'Alice', lastName: 'Defendant', status: 'active' },
    });
    clientA = client.clientId;
  });

  after(async () => {
    await prisma.organizationInvitation.deleteMany({ where: { organizationId: { in: [firmA, firmB] } } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [firmA, firmB] } } }).catch(() => undefined);
    await prisma.client.deleteMany({ where: { tenantId: { in: [firmA, firmB] } } }).catch(() => undefined);
    await prisma.organizationOffice.deleteMany({ where: { organizationId: { in: [firmA, firmB] } } }).catch(() => undefined);
    await prisma.practiceGroup.deleteMany({ where: { organizationId: { in: [firmA, firmB] } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [adminA, adminB] } } }).catch(() => undefined);
    await prisma.organization.deleteMany({ where: { id: { in: [firmA, firmB] } } }).catch(() => undefined);
  });

  it('creates offices and practice groups within tenant', async () => {
    const office = await createOffice(firmA, { name: 'Downtown LA', city: 'Los Angeles', isPrimary: true });
    const group = await createPracticeGroup(firmA, { name: 'Felony Defense', practiceArea: 'felony', officeId: office.officeId });
    assert.equal(office.organizationId, firmA);
    assert.equal(group.organizationId, firmA);
  });

  it('completes organization onboarding', async () => {
    const org = await advanceOnboarding(firmA, {
      step: 'complete',
      profile: { name: 'Alpha Criminal Defense', tagline: 'Evidence-governed defense' },
    });
    assert.equal(org.onboardingStep, 'complete');
    assert.ok(org.onboardingCompletedAt);
  });

  it('enforces cross-tenant isolation', async () => {
    const allowed = await verifyTenantAccess(firmA, firmB);
    assert.equal(allowed, false);

    const crossQuery = await prisma.client.findFirst({
      where: { clientId: clientA, tenantId: firmB },
    });
    assert.equal(crossQuery, null);
  });

  it('firm-wide search scoped to tenant', async () => {
    const results = await firmWideSearch(firmA, 'Alice');
    assert.ok(results.clients.length >= 1);
    const otherResults = await firmWideSearch(firmB, 'Alice');
    assert.equal(otherResults.clients.length, 0);
  });

  it('returns firm analytics for tenant', async () => {
    const analytics = await getFirmAnalytics(firmA);
    assert.ok(analytics.members >= 1);
    assert.ok(analytics.clients >= 1);
  });

  it('creates and accepts invitation into existing org', async () => {
    const inviteEmail = `${PREFIX}invite-${randomUUID().slice(0, 6)}@alpha.test`;
    const { invitation } = await createInvitation(firmA, adminA, { email: inviteEmail, role: 'investigator' });
    assert.equal(invitation.status, 'pending');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await prisma.organizationInvitation.update({
      where: { invitationId: invitation.invitationId },
      data: { tokenHash },
    });

    const user = await acceptInvitation(rawToken, 'Invited Investigator', 'SecurePass1!');
    assert.equal(user.tenantId, firmA);
    assert.equal(user.role, 'investigator');

    const member = await prisma.organizationMember.findUnique({ where: { userId: user.id } });
    assert.equal(member?.organizationId, firmA);

    await prisma.organizationMember.delete({ where: { userId: user.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  });
});
