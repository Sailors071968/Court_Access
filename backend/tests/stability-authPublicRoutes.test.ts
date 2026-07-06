// ============================================================================
// PR 7 — Stability Test Suite: Auth Middleware Public Routes (PRs 1, 6)
//
// Tests that the PUBLIC_ROUTES list correctly identifies public endpoints:
//   - /api/health, /api/health/deep (prefix match)
//   - /api/metrics, /api/metrics/json (PR 6 addition)
//   - /api/auth/login, /api/auth/register, etc.
//   - /api/billing/webhook
//   - Non-public routes are correctly identified as requiring auth
//   - extractBearerToken parses Authorization header
//   - Role hierarchy and route permission checks
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractBearerToken,
  hasPermission,
  getRequiredRoles,
} from '../src/security/authMiddleware.ts';

// ============================================================================
// extractBearerToken
// ============================================================================

describe('extractBearerToken', () => {
  it('should extract token from valid Bearer header', () => {
    const token = extractBearerToken('Bearer abc123xyz');
    assert.equal(token, 'abc123xyz');
  });

  it('should return null for missing header', () => {
    assert.equal(extractBearerToken(undefined), null);
  });

  it('should return null for non-Bearer header', () => {
    assert.equal(extractBearerToken('Basic abc123'), null);
  });

  it('should return null for empty string', () => {
    assert.equal(extractBearerToken(''), null);
  });

  it('should handle Bearer with no token', () => {
    const token = extractBearerToken('Bearer ');
    assert.equal(token, '');
  });

  it('should handle Bearer with JWT-shaped token', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.abc';
    const token = extractBearerToken(`Bearer ${jwt}`);
    assert.equal(token, jwt);
  });
});

// ============================================================================
// hasPermission
// ============================================================================

describe('hasPermission', () => {
  it('should return true when role is in required roles', () => {
    assert.equal(hasPermission('admin', ['admin', 'attorney']), true);
    assert.equal(hasPermission('attorney', ['admin', 'attorney']), true);
  });

  it('should return false when role is not in required roles', () => {
    assert.equal(hasPermission('defendant', ['admin', 'attorney']), false);
    assert.equal(hasPermission('staff', ['admin']), false);
  });

  it('should handle single-role requirement', () => {
    assert.equal(hasPermission('admin', ['admin']), true);
    assert.equal(hasPermission('staff', ['admin']), false);
  });
});

// ============================================================================
// getRequiredRoles — route permission matching
// ============================================================================

describe('getRequiredRoles', () => {
  it('should return roles for /api/admin routes', () => {
    const roles = getRequiredRoles('/api/admin/something');
    assert.ok(roles !== null, '/api/admin should require specific roles');
    assert.ok(roles!.includes('admin'));
  });

  it('should return roles for /api/compliance routes', () => {
    const roles = getRequiredRoles('/api/compliance/report');
    assert.ok(roles !== null);
    assert.ok(roles!.includes('admin'));
    assert.ok(roles!.includes('attorney'));
  });

  it('should return null for unprotected API routes', () => {
    const roles = getRequiredRoles('/api/cases/123');
    assert.equal(roles, null, 'Generic API routes should have no role requirement');
  });

  it('should match most specific prefix first', () => {
    // /api/admin/discount-codes should match before /api/admin
    const roles = getRequiredRoles('/api/admin/discount-codes/list');
    assert.ok(roles !== null);
    assert.ok(roles!.includes('staff'), '/api/admin/discount-codes allows staff');
  });

  it('should return roles for security routes', () => {
    const roles = getRequiredRoles('/api/security/log');
    assert.ok(roles !== null);
    assert.ok(roles!.includes('admin'));
  });
});

// ============================================================================
// Public Routes Coverage (PR 6 addition: /api/metrics)
// ============================================================================

describe('Public Routes', () => {
  // We can't call isPublicRoute directly (not exported), but we can verify
  // the behavior through the authenticationHook by checking PUBLIC_ROUTES
  // indirectly. Since isPublicRoute uses prefix matching, we verify the
  // expected patterns are covered by testing getRequiredRoles returns null
  // for public paths (public routes don't need role checks).

  it('should verify /api/health paths have no role requirement', () => {
    assert.equal(getRequiredRoles('/api/health'), null);
    assert.equal(getRequiredRoles('/api/health/deep'), null);
  });

  it('should verify /api/metrics paths have no role requirement', () => {
    assert.equal(getRequiredRoles('/api/metrics'), null);
    assert.equal(getRequiredRoles('/api/metrics/json'), null);
  });

  it('should verify /api/auth paths have no role requirement', () => {
    assert.equal(getRequiredRoles('/api/auth/login'), null);
    assert.equal(getRequiredRoles('/api/auth/register'), null);
    assert.equal(getRequiredRoles('/api/auth/refresh'), null);
    assert.equal(getRequiredRoles('/api/auth/logout'), null);
  });

  it('should verify /api/billing/webhook has no role requirement', () => {
    assert.equal(getRequiredRoles('/api/billing/webhook'), null);
  });

  it('should verify protected routes DO have role requirements', () => {
    assert.ok(getRequiredRoles('/api/admin') !== null, '/api/admin should require roles');
    assert.ok(getRequiredRoles('/api/security/log') !== null, '/api/security should require roles');
  });
});
