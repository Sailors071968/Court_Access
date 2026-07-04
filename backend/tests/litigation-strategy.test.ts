// ============================================================================
// Litigation Strategy API tests
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const caseRoutesPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/evidence/caseRoutes.ts',
);

describe('litigation strategy route registration', () => {
  const source = readFileSync(caseRoutesPath, 'utf-8');

  it('should expose GET /api/cases/:caseId/litigation-strategy', () => {
    assert.ok(source.includes('/api/cases/:caseId/litigation-strategy'));
    assert.ok(source.includes('buildLitigationStrategyResponse'));
  });

  it('should require authentication', () => {
    assert.ok(source.includes('Authentication required'));
  });
});

describe('litigation strategy service structure', async () => {
  const { buildLitigationStrategyResponse } = await import(
    '../src/services/litigationStrategyApiService.ts'
  );

  it('should export buildLitigationStrategyResponse', () => {
    assert.equal(typeof buildLitigationStrategyResponse, 'function');
  });
});
