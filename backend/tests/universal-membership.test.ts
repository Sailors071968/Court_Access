// ============================================================================
// Program 1 — Universal Membership tests
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DELEGATED_USER_LIMIT,
  normalizePlanId,
  getUniversalPlan,
  mapSubscriptionStatusForClient,
  permissionSatisfies,
  UNIVERSAL_PLATFORM_CAPABILITIES,
} from '../src/membership/universalMembership.js';

describe('Program 1 — Universal Membership Model', () => {
  it('every subscriber gets all platform capabilities', () => {
    assert.ok(UNIVERSAL_PLATFORM_CAPABILITIES.includes('document_redaction'));
    assert.ok(UNIVERSAL_PLATFORM_CAPABILITIES.includes('attorney_workbench'));
    assert.equal(UNIVERSAL_PLATFORM_CAPABILITIES.length >= 15, true);
  });

  it('delegated user limit is 5', () => {
    assert.equal(DELEGATED_USER_LIMIT, 5);
  });

  it('normalizes legacy plan IDs', () => {
    assert.equal(normalizePlanId('STARTER'), 'INDIVIDUAL');
    assert.equal(normalizePlanId('LITIGATION_INTELLIGENCE_PRO'), 'PROFESSIONAL');
  });

  it('returns universal plan by ID', () => {
    const plan = getUniversalPlan('STANDARD');
    assert.equal(plan?.name, 'Standard');
    assert.equal(plan?.priceCentsMonthly, 7900);
  });

  it('maps trialing status for client', () => {
    assert.equal(mapSubscriptionStatusForClient('trialing'), 'trial');
    assert.equal(mapSubscriptionStatusForClient('active'), 'active');
  });

  it('evaluates permission levels', () => {
    assert.equal(permissionSatisfies('admin', 'view'), true);
    assert.equal(permissionSatisfies('view', 'edit'), false);
    assert.equal(permissionSatisfies('edit', 'edit'), true);
  });
});
