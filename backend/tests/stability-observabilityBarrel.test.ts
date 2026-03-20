// ============================================================================
// PR 7 — Stability Test Suite: Observability Barrel Exports (PR 6)
//
// Verifies that the observability/index.ts barrel file re-exports all
// expected public API symbols from the observability layer.
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import everything from the barrel file
import * as observability from '../src/observability/index.ts';

describe('Observability Barrel Exports', () => {
  it('should export MetricsCollector class', () => {
    assert.equal(typeof observability.MetricsCollector, 'function');
  });

  it('should export metrics singleton', () => {
    assert.ok(observability.metrics, 'metrics singleton should be defined');
    assert.ok(typeof observability.metrics.incrementCounter === 'function');
    assert.ok(typeof observability.metrics.toPrometheusText === 'function');
  });

  it('should export StructuredLogger class', () => {
    assert.equal(typeof observability.StructuredLogger, 'function');
  });

  it('should export logger singleton', () => {
    assert.ok(observability.logger, 'logger singleton should be defined');
    assert.ok(typeof observability.logger.info === 'function');
    assert.ok(typeof observability.logger.error === 'function');
    assert.ok(typeof observability.logger.warn === 'function');
    assert.ok(typeof observability.logger.debug === 'function');
  });

  it('should export correlation ID functions', () => {
    assert.equal(typeof observability.setCorrelationId, 'function');
    assert.equal(typeof observability.getCorrelationId, 'function');
    assert.equal(typeof observability.clearCorrelationId, 'function');
    assert.equal(typeof observability.runWithCorrelationId, 'function');
  });

  it('should export runDeepHealthCheck function', () => {
    assert.equal(typeof observability.runDeepHealthCheck, 'function');
  });

  it('should export registerObservabilityRoutes function', () => {
    assert.equal(typeof observability.registerObservabilityRoutes, 'function');
  });
});
