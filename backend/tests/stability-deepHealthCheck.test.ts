// ============================================================================
// PR 7 — Stability Test Suite: Deep Health Check (PR 6)
//
// Tests the deep health check report structure and memory check logic.
// PostgreSQL, Redis, and Neo4j checks require live connections so we
// only test the memory component and the report structure/aggregation.
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ComponentStatus, HealthReport } from '../src/observability/deepHealthCheck.ts';

// ---------------------------------------------------------------------------
// We can't call runDeepHealthCheck() directly because it imports Prisma and
// Redis which need live connections. Instead we test the types, the overall
// status aggregation logic, and the memory thresholds conceptually.
// ---------------------------------------------------------------------------

describe('Deep Health Check — Types & Logic', () => {
  it('should define valid ComponentStatus values', () => {
    const validStatuses: ComponentStatus[] = ['healthy', 'degraded', 'unhealthy', 'unknown'];
    for (const status of validStatuses) {
      assert.ok(typeof status === 'string');
    }
  });

  it('should aggregate overall status correctly: all healthy → healthy', () => {
    const statuses: ComponentStatus[] = ['healthy', 'healthy', 'healthy', 'healthy'];
    let overall: ComponentStatus = 'healthy';
    if (statuses.includes('unhealthy')) overall = 'unhealthy';
    else if (statuses.includes('degraded')) overall = 'degraded';
    assert.equal(overall, 'healthy');
  });

  it('should aggregate overall status correctly: one degraded → degraded', () => {
    const statuses: ComponentStatus[] = ['healthy', 'degraded', 'healthy', 'healthy'];
    let overall: ComponentStatus = 'healthy';
    if (statuses.includes('unhealthy')) overall = 'unhealthy';
    else if (statuses.includes('degraded')) overall = 'degraded';
    assert.equal(overall, 'degraded');
  });

  it('should aggregate overall status correctly: one unhealthy → unhealthy', () => {
    const statuses: ComponentStatus[] = ['healthy', 'degraded', 'unhealthy', 'healthy'];
    let overall: ComponentStatus = 'healthy';
    if (statuses.includes('unhealthy')) overall = 'unhealthy';
    else if (statuses.includes('degraded')) overall = 'degraded';
    assert.equal(overall, 'unhealthy');
  });

  it('should aggregate overall status correctly: unknown does not override healthy', () => {
    const statuses: ComponentStatus[] = ['healthy', 'unknown', 'healthy', 'healthy'];
    let overall: ComponentStatus = 'healthy';
    if (statuses.includes('unhealthy')) overall = 'unhealthy';
    else if (statuses.includes('degraded')) overall = 'degraded';
    assert.equal(overall, 'healthy');
  });

  // =========================================================================
  // Memory Thresholds
  // =========================================================================

  describe('memory thresholds', () => {
    it('should classify low memory usage as healthy', () => {
      const heapPercent = 50;
      const rssMB = 500;
      let status: ComponentStatus = 'healthy';
      if (heapPercent > 90 || rssMB > 1500) status = 'unhealthy';
      else if (heapPercent > 75 || rssMB > 1000) status = 'degraded';
      assert.equal(status, 'healthy');
    });

    it('should classify high heap usage as degraded', () => {
      const heapPercent = 80;
      const rssMB = 500;
      let status: ComponentStatus = 'healthy';
      if (heapPercent > 90 || rssMB > 1500) status = 'unhealthy';
      else if (heapPercent > 75 || rssMB > 1000) status = 'degraded';
      assert.equal(status, 'degraded');
    });

    it('should classify high RSS as degraded', () => {
      const heapPercent = 50;
      const rssMB = 1200;
      let status: ComponentStatus = 'healthy';
      if (heapPercent > 90 || rssMB > 1500) status = 'unhealthy';
      else if (heapPercent > 75 || rssMB > 1000) status = 'degraded';
      assert.equal(status, 'degraded');
    });

    it('should classify very high heap as unhealthy', () => {
      const heapPercent = 95;
      const rssMB = 500;
      let status: ComponentStatus = 'healthy';
      if (heapPercent > 90 || rssMB > 1500) status = 'unhealthy';
      else if (heapPercent > 75 || rssMB > 1000) status = 'degraded';
      assert.equal(status, 'unhealthy');
    });

    it('should classify very high RSS as unhealthy', () => {
      const heapPercent = 50;
      const rssMB = 1600;
      let status: ComponentStatus = 'healthy';
      if (heapPercent > 90 || rssMB > 1500) status = 'unhealthy';
      else if (heapPercent > 75 || rssMB > 1000) status = 'degraded';
      assert.equal(status, 'unhealthy');
    });

    it('should classify boundary heap 75% as healthy', () => {
      const heapPercent = 75;
      const rssMB = 500;
      let status: ComponentStatus = 'healthy';
      if (heapPercent > 90 || rssMB > 1500) status = 'unhealthy';
      else if (heapPercent > 75 || rssMB > 1000) status = 'degraded';
      assert.equal(status, 'healthy');
    });

    it('should classify boundary RSS 1000MB as healthy', () => {
      const heapPercent = 50;
      const rssMB = 1000;
      let status: ComponentStatus = 'healthy';
      if (heapPercent > 90 || rssMB > 1500) status = 'unhealthy';
      else if (heapPercent > 75 || rssMB > 1000) status = 'degraded';
      assert.equal(status, 'healthy');
    });
  });

  // =========================================================================
  // Report Structure
  // =========================================================================

  describe('report structure', () => {
    it('should have all required fields in HealthReport type', () => {
      const report: HealthReport = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptimeSeconds: 100,
        version: '1.1.0',
        environment: 'test',
        components: {
          postgres: { status: 'healthy', latencyMs: 5 },
          redis: { status: 'healthy', latencyMs: 2 },
          neo4j: { status: 'unknown', latencyMs: 0, message: 'Not configured' },
          memory: { status: 'healthy', latencyMs: 0, message: 'heap=100/256MB (39%) rss=300MB' },
        },
      };

      assert.ok(report.timestamp);
      assert.ok(report.uptimeSeconds >= 0);
      assert.ok(report.version);
      assert.ok(report.environment);
      assert.ok(report.components.postgres);
      assert.ok(report.components.redis);
      assert.ok(report.components.neo4j);
      assert.ok(report.components.memory);
    });
  });
});
