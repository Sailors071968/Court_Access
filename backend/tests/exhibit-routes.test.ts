// ============================================================================
// Exhibit routes registration tests
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/server.ts',
);

describe('exhibit route registration', () => {
  const source = readFileSync(serverPath, 'utf-8');

  it('should register exhibit routes in server', () => {
    assert.ok(source.includes('registerExhibitRoutes'));
  });
});

describe('exhibit routes module', async () => {
  const { registerExhibitRoutes } = await import('../src/exhibits/exhibitRoutes.ts');

  it('should export registerExhibitRoutes', () => {
    assert.equal(typeof registerExhibitRoutes, 'function');
  });
});
