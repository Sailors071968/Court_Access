// ============================================================================
// Program 2A — Role-based onboarding tests
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ROLES,
  validateDefaultRole,
  resolveRoleOnboarding,
  ROLE_ONBOARDING_CONFIG,
} from '../src/membership/roleOnboarding.js';

describe('Program 2A — Role-Based Onboarding', () => {
  it('defines all 9 default registration roles', () => {
    assert.equal(DEFAULT_ROLES.length, 9);
    assert.ok(validateDefaultRole('attorney'));
    assert.ok(validateDefaultRole('criminal_defendant'));
    assert.ok(validateDefaultRole('law_office_administrator'));
    assert.equal(validateDefaultRole('invalid'), false);
  });

  it('maps attorney to law firm org and attorney platform role', () => {
    const config = resolveRoleOnboarding('attorney');
    assert.equal(config.platformRole, 'attorney');
    assert.equal(config.orgType, 'law_firm');
    assert.equal(config.personnelType, 'attorney');
    assert.ok(config.onboardingSteps.length >= 3);
  });

  it('maps criminal defendant to client portal dashboard', () => {
    const config = resolveRoleOnboarding('criminal_defendant');
    assert.equal(config.platformRole, 'defendant');
    assert.equal(config.defaultDashboard, '/client-portal');
  });

  it('does not restrict capabilities — all roles have full workflows', () => {
    for (const role of DEFAULT_ROLES) {
      const config = ROLE_ONBOARDING_CONFIG[role];
      assert.ok(config.recommendedWorkflows.length > 0, `${role} should have workflows`);
      assert.ok(config.navigationHighlights.length > 0, `${role} should have navigation`);
    }
  });

  it('falls back to other for unknown roles', () => {
    const config = resolveRoleOnboarding('unknown_role');
    assert.equal(config.defaultRole, 'other');
  });
});
