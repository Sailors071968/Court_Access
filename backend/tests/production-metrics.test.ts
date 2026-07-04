// ============================================
// Production metrics + governance route tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { collectProductionMetrics } from '../src/legislative/productionMetrics.ts';
import { getRequiredRoles } from '../src/security/authMiddleware.ts';

describe('Production metrics collector', () => {
  it('returns objective counts without subjective readiness score', async () => {
    const metrics = await collectProductionMetrics({
      discoveryDir: 'data/legislative/discovery',
      rawDir: 'data/legislative/raw',
      repositoryDir: 'data/legislative/repositories',
    });

    assert.ok(metrics.generatedAt);
    assert.equal(typeof metrics.californiaCodes.total, 'number');
    assert.equal(metrics.californiaCodes.total, 30);
    assert.equal(typeof metrics.sectionsDiscovered, 'number');
    assert.equal(typeof metrics.sectionsParsed, 'number');
    assert.equal(typeof metrics.criminalOffenses, 'number');
    assert.ok(['PASS', 'FAIL', 'UNKNOWN'].includes(metrics.repositoryIntegrity));
    assert.ok(!('readinessScore' in metrics));
  });

  it('includes per-repository record counts', async () => {
    const metrics = await collectProductionMetrics({
      repositoryDir: 'data/legislative/repositories',
    });
    assert.ok(metrics.repositories.statutes !== undefined);
    assert.ok(metrics.repositories.offenses !== undefined);
    assert.ok(metrics.repositories.calcrim_links !== undefined);
  });
});

describe('Governance route permissions', () => {
  it('requires admin for corpus API', () => {
    const roles = getRequiredRoles('/api/corpus/ingest');
    assert.ok(roles);
    assert.ok(roles.includes('admin'));
    assert.equal(roles.includes('defendant'), false);
  });

  it('allows attorneys to read legislative metrics', () => {
    const roles = getRequiredRoles('/api/legislative/metrics');
    assert.ok(roles);
    assert.ok(roles.includes('attorney'));
    assert.ok(roles.includes('admin'));
  });
});
