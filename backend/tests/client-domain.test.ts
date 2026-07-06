// ============================================
// Domain C — Client domain tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma.js';
import {
  validateClientStatus,
  validateRetentionStatus,
  validateCommunicationPreference,
  formatClientName,
  CLIENT_STATUSES,
  RETENTION_STATUSES,
} from '../src/clients/clientTypes.js';

const TEST_PREFIX = 'client-test-';

describe('Client domain validation', () => {
  it('validates client statuses', () => {
    for (const s of CLIENT_STATUSES) {
      assert.equal(validateClientStatus(s), true);
    }
    assert.equal(validateClientStatus('invalid'), false);
  });

  it('validates retention statuses', () => {
    for (const s of RETENTION_STATUSES) {
      assert.equal(validateRetentionStatus(s), true);
    }
    assert.equal(validateRetentionStatus('unknown'), false);
  });

  it('validates communication preferences', () => {
    assert.equal(validateCommunicationPreference('email'), true);
    assert.equal(validateCommunicationPreference('fax'), false);
  });

  it('formats client display name', () => {
    assert.equal(formatClientName({ firstName: 'Jane', lastName: 'Doe', middleName: 'M' }), 'Jane M Doe');
    assert.equal(formatClientName({ firstName: 'John', lastName: 'Smith' }), 'John Smith');
  });
});

describe('Client CRUD (database)', () => {
  let tenantId = '';
  let userId = '';
  let clientId = '';

  before(async () => {
    tenantId = `${TEST_PREFIX}${randomUUID().slice(0, 8)}`;
    userId = randomUUID();
    await prisma.organization.create({
      data: { id: tenantId, name: 'Test Law Firm', orgType: 'law_firm' },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `${TEST_PREFIX}${randomUUID().slice(0, 8)}@cert.courtaccess.test`,
        name: 'Client Test Attorney',
        passwordHash: await bcrypt.hash('Test123!', 10),
        role: 'attorney',
        tenantId,
      },
    });
  });

  after(async () => {
    if (clientId) {
      await prisma.criminalCase.deleteMany({ where: { clientId } }).catch(() => undefined);
      await prisma.client.deleteMany({ where: { clientId } }).catch(() => undefined);
    }
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    await prisma.organization.deleteMany({ where: { id: tenantId } }).catch(() => undefined);
  });

  it('creates client with tenant isolation', async () => {
    const client = await prisma.client.create({
      data: {
        tenantId,
        ownerId: userId,
        firstName: 'Test',
        lastName: 'Client',
        email: 'test.client@example.com',
        status: 'intake',
        retentionStatus: 'pending',
        alternateContacts: [{ name: 'Spouse', relationship: 'spouse', phone: '555-0100' }],
        emergencyContacts: [{ name: 'Parent', relationship: 'parent', phone: '555-0101' }],
        addressHistory: [{ line1: '123 Main St', city: 'Los Angeles', state: 'CA', zip: '90001' }],
      },
    });
    clientId = client.clientId;
    assert.equal(client.tenantId, tenantId);
    assert.equal(client.status, 'intake');
  });

  it('links case to client within tenant', async () => {
    const caseRecord = await prisma.criminalCase.create({
      data: {
        tenantId,
        ownerId: userId,
        clientId,
        title: 'People v. Test Client',
        caseNumber: `TEST-${randomUUID().slice(0, 6)}`,
        jurisdiction: 'Los Angeles County',
        caseType: 'felony',
      },
    });
    assert.equal(caseRecord.clientId, clientId);

    const withCases = await prisma.client.findFirst({
      where: { clientId, tenantId },
      include: { cases: true },
    });
    assert.equal(withCases?.cases.length, 1);
  });

  it('enforces tenant isolation on client query', async () => {
    const otherTenant = `${TEST_PREFIX}other-${randomUUID().slice(0, 6)}`;
    const found = await prisma.client.findFirst({
      where: { clientId, tenantId: otherTenant },
    });
    assert.equal(found, null);
  });

  it('soft deletes client', async () => {
    await prisma.client.update({
      where: { clientId },
      data: { deletedAt: new Date(), status: 'closed' },
    });
    const found = await prisma.client.findFirst({
      where: { clientId, tenantId, deletedAt: null },
    });
    assert.equal(found, null);
  });
});
