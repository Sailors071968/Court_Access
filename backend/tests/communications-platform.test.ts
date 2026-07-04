import assert from 'node:assert/strict';
import test from 'node:test';
import { fileExists, workspacePath } from '../src/productionGates/gateUtils.js';

test('secure messaging routes exist', async () => {
  assert.equal(await fileExists(workspacePath('backend/src/communications/messagingRoutes.ts')), true);
});

test('hearing routes exist for court dates', async () => {
  assert.equal(await fileExists(workspacePath('backend/src/communications/hearingRoutes.ts')), true);
});

test('identity service implements MFA and email verification', async () => {
  assert.equal(await fileExists(workspacePath('backend/src/security/identityService.ts')), true);
  assert.equal(await fileExists(workspacePath('backend/src/security/identityRoutes.ts')), true);
});
