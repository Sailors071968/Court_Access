// ============================================================================
// Doctrine Service — Constitutional compliance tests
// Ensures no fabricated legal conclusions are returned on API failure.
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const doctrineServicePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/services/doctrineService.ts',
);

describe('doctrineService constitutional compliance', () => {
  const source = readFileSync(doctrineServicePath, 'utf-8');

  it('should not contain fabricated demo compliance results', () => {
    assert.ok(!source.includes('DEMO_COMPLIANCE_RESULT'), 'DEMO_COMPLIANCE_RESULT must be removed');
    assert.ok(!source.includes('DEMO_STATUS'), 'DEMO_STATUS must be removed');
    assert.ok(!source.includes('demo data fallback'), 'demo data fallback comment must be removed');
  });

  it('should not silently return fabricated violations on API failure', () => {
    assert.ok(!source.includes('DEMO_COMPLIANCE_RESULT'), 'must not reference demo compliance');
    assert.ok(!source.includes('using demo data'), 'must not reference demo data messages');
    assert.ok(source.includes('throw new DoctrineApiError'), 'must throw on API errors');
  });

  it('should export DoctrineApiError for UI UNKNOWN handling', () => {
    assert.ok(source.includes('export class DoctrineApiError'), 'DoctrineApiError must be exported');
  });
});

describe('server doctrine route registration', () => {
  const serverPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/server.ts',
  );
  const source = readFileSync(serverPath, 'utf-8');

  it('should register doctrine routes', () => {
    assert.ok(source.includes('registerDoctrineRoutes'), 'server must import and call registerDoctrineRoutes');
  });

  it('should enable authentication hook', () => {
    assert.ok(source.includes("app.addHook('onRequest', authenticationHook)"), 'authenticationHook must be enabled');
    assert.ok(!source.includes('//  app.addHook'), 'authenticationHook must not be commented out');
  });
});
