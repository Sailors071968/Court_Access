// ============================================================================
// Case Analysis API tests
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

describe('case analysis route registration', () => {
  const source = readFileSync(caseRoutesPath, 'utf-8');

  it('should expose GET /api/cases/:caseId/analysis', () => {
    assert.ok(source.includes('/api/cases/:caseId/analysis'));
    assert.ok(source.includes('buildCaseAnalysisResponse'));
  });

  it('should expose GET /api/cases/:caseId/recommendations', () => {
    assert.ok(source.includes('/api/cases/:caseId/recommendations'));
  });
});

describe('case analysis service structure', async () => {
  const { buildCaseAnalysisResponse } = await import(
    '../src/services/caseAnalysisApiService.ts'
  );

  it('should export buildCaseAnalysisResponse', () => {
    assert.equal(typeof buildCaseAnalysisResponse, 'function');
  });
});
