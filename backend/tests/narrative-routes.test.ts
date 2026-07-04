// ============================================================================
// Narrative routes tests
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const narrativeRoutesPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/narrative/narrativeRoutes.ts',
);

describe('narrative route registration', () => {
  const source = readFileSync(narrativeRoutesPath, 'utf-8');

  it('should query narrative claims from prisma', () => {
    assert.ok(source.includes('narrativeClaim.findMany'));
    assert.ok(!source.includes('claims: []'));
  });

  it('should enqueue narrative processing on analyze', () => {
    assert.ok(source.includes('enqueueNarrativeProcessing'));
  });

  it('should require authentication', () => {
    assert.ok(source.includes('Authentication required'));
  });
});
