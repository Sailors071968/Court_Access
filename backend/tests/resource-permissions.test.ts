// ============================================================================
// Sprint 1 — Resource permission enforcement tests
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { permissionSatisfies, PERMISSION_LEVELS, RESOURCE_SCOPES } from '../src/membership/universalMembership.js';
import { filterByAccessibleCases } from '../src/membership/permissionResolver.js';

describe('Sprint 1 — Resource Permissions', () => {
  it('defines all seven permission levels', () => {
    assert.deepEqual([...PERMISSION_LEVELS], [
      'none', 'view', 'comment', 'upload', 'edit', 'approve', 'admin',
    ]);
  });

  it('defines resource scopes for authorization', () => {
    assert.ok(RESOURCE_SCOPES.includes('case'));
    assert.ok(RESOURCE_SCOPES.includes('document'));
    assert.ok(RESOURCE_SCOPES.includes('evidence'));
    assert.ok(RESOURCE_SCOPES.includes('billing'));
  });

  it('enforces permission hierarchy', () => {
    assert.equal(permissionSatisfies('none', 'view'), false);
    assert.equal(permissionSatisfies('view', 'view'), true);
    assert.equal(permissionSatisfies('upload', 'edit'), false);
    assert.equal(permissionSatisfies('approve', 'edit'), true);
    assert.equal(permissionSatisfies('admin', 'approve'), true);
  });

  it('filters case lists for non-disclosure (hidden resources omitted)', () => {
    const items = [
      { caseId: 'a', title: 'A' },
      { caseId: 'b', title: 'B' },
      { caseId: 'c', title: 'C' },
    ];
    const filtered = filterByAccessibleCases(items, ['a', 'c']);
    assert.equal(filtered.length, 2);
    assert.ok(!filtered.some((i) => i.caseId === 'b'));
  });

  it('resource auth middleware module exists', async () => {
    const mod = await import('../src/membership/resourceAuthMiddleware.js');
    assert.equal(typeof mod.requireCaseAccess, 'function');
    assert.equal(typeof mod.buildAuthorizedCaseFilter, 'function');
    assert.equal(typeof mod.sendForbidden, 'function');
  });
});
