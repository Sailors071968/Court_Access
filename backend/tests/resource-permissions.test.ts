// ============================================================================
// Release Wave 1 — Resource permission enforcement tests
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { permissionSatisfies, PERMISSION_LEVELS, RESOURCE_SCOPES } from '../src/membership/universalMembership.js';
import { filterByAccessibleCases } from '../src/membership/permissionResolver.js';
import {
  AUTHORIZED_ROUTE_MODULES,
  ENFORCED_RESOURCE_SCOPES,
} from '../src/membership/resourceAuthorizationRegistry.js';
import { workspacePath, fileExists } from '../src/productionGates/gateUtils.js';

describe('Release Wave 1 — Resource Permissions', () => {
  it('defines Program 5A permission levels (10 actionable + none + admin alias)', () => {
    assert.deepEqual([...PERMISSION_LEVELS], [
      'none', 'view', 'comment', 'upload', 'edit', 'approve',
      'publish', 'export', 'share', 'delete', 'administer', 'admin',
    ]);
  });

  it('defines expanded resource scopes including Program 5A hierarchy', () => {
    assert.ok(RESOURCE_SCOPES.includes('case'));
    assert.ok(RESOURCE_SCOPES.includes('folder'));
    assert.ok(RESOURCE_SCOPES.includes('knowledge_graph'));
    assert.ok(RESOURCE_SCOPES.includes('data_result'));
    assert.ok(RESOURCE_SCOPES.includes('workspace'));
    assert.equal(ENFORCED_RESOURCE_SCOPES.length, 17);
  });

  it('enforces permission hierarchy', () => {
    assert.equal(permissionSatisfies('none', 'view'), false);
    assert.equal(permissionSatisfies('view', 'view'), true);
    assert.equal(permissionSatisfies('upload', 'edit'), false);
    assert.equal(permissionSatisfies('approve', 'edit'), true);
    assert.equal(permissionSatisfies('admin', 'approve'), true);
  });

  it('filters case lists for non-disclosure', () => {
    const items = [
      { caseId: 'a', title: 'A' },
      { caseId: 'b', title: 'B' },
      { caseId: 'c', title: 'C' },
    ];
    const filtered = filterByAccessibleCases(items, ['a', 'c']);
    assert.equal(filtered.length, 2);
    assert.ok(!filtered.some((i) => i.caseId === 'b'));
  });

  it('resource auth middleware exports guards', async () => {
    const mod = await import('../src/membership/resourceAuthMiddleware.js');
    assert.equal(typeof mod.requireCaseAccess, 'function');
    assert.equal(typeof mod.requireScopeAccess, 'function');
    assert.equal(typeof mod.guardCaseAccess, 'function');
    assert.equal(typeof mod.sanitizeClientCases, 'function');
    assert.equal(typeof mod.filterAuthorizedCaseItems, 'function');
  });

  it('authorized route modules exist and use guardCaseAccess or guardScopeAccess', async () => {
    for (const mod of AUTHORIZED_ROUTE_MODULES) {
      assert.equal(await fileExists(workspacePath(mod)), true, `${mod} missing`);
      const raw = await readFile(workspacePath(mod), 'utf-8');
      const usesAuth =
        raw.includes('guardCaseAccess') ||
        raw.includes('guardScopeAccess') ||
        raw.includes('requireCaseAccess') ||
        raw.includes('buildAuthorizedCaseFilter') ||
        raw.includes('requireOrgContext') ||
        raw.includes('guardMessagingAccess');
      assert.equal(usesAuth, true, `${mod} missing authorization integration`);
    }
  });

  it('charge routes require authentication', async () => {
    const raw = await readFile(workspacePath('backend/src/charges/chargeRoutes.ts'), 'utf-8');
    assert.ok(raw.includes('guardAuth'));
    assert.ok(raw.includes('guardCaseAccess'));
    assert.ok(!raw.includes('fastify.post("/api/charges", async (req, res)'));
  });

  it('messaging routes use 403 not 404 for unauthorized access', async () => {
    const raw = await readFile(workspacePath('backend/src/communications/messagingRoutes.ts'), 'utf-8');
    assert.ok(raw.includes('sendForbidden'));
    assert.ok(!raw.includes("reply.code(404).send({ error: 'Case not found' })"));
  });

  it('client list does not leak case counts', async () => {
    const raw = await readFile(workspacePath('backend/src/clients/clientRoutes.ts'), 'utf-8');
    assert.ok(!raw.includes('_count: { select: { cases: true } }'));
    assert.ok(raw.includes('sanitizeClientCases'));
  });
});
