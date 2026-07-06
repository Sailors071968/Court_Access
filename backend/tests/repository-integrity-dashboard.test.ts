// ============================================
// Epic H — Repository Integrity Dashboard tests
// ============================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateRepositoryIntegrityDashboard } from '../src/legislative/repositoryIntegrityDashboard.js';
import { REPOSITORY_NAMES } from '../src/legislative/knowledgeGraph/repositories.js';

describe('Repository Integrity Dashboard', () => {
  it('generates dashboard with all repositories', async () => {
    const dashboard = await generateRepositoryIntegrityDashboard();
    assert.ok(dashboard.generatedAt);
    assert.equal(dashboard.repositories.length, REPOSITORY_NAMES.length);
    assert.ok(['PASS', 'FAIL', 'PARTIAL'].includes(dashboard.overallIntegrity));
    assert.ok(dashboard.coverageAnalytics.sectionsParsed >= 0);
    assert.ok(dashboard.knowledgeGraph.repositoriesTotal === REPOSITORY_NAMES.length);
  });

  it('reports integrity status per repository', async () => {
    const dashboard = await generateRepositoryIntegrityDashboard();
    for (const repo of dashboard.repositories) {
      assert.ok(repo.displayName);
      assert.ok(['PASS', 'FAIL', 'UNKNOWN'].includes(repo.integrity));
      assert.ok(repo.integrityDetail);
      assert.ok(typeof repo.completionPercent === 'number');
    }
    const statutes = dashboard.repositories.find((r) => r.name === 'statutes');
    assert.ok(statutes);
    assert.equal(statutes!.integrity, 'PASS');
  });

  it('surfaces global unknowns without fabrication', async () => {
    const dashboard = await generateRepositoryIntegrityDashboard();
    assert.ok(Array.isArray(dashboard.globalUnknowns));
    for (const u of dashboard.globalUnknowns) {
      assert.ok(u.length > 0);
    }
  });
});
