// ============================================================================
// PR 7 — Stability Test Suite: Structured Logger (PR 6)
//
// Tests structured JSON logging with AsyncLocalStorage correlation IDs:
//   - Log level filtering (debug < info < warn < error)
//   - Correlation ID isolation via AsyncLocalStorage (no bleed between contexts)
//   - JSON vs human-readable output modes
//   - Log entry structure (timestamp, level, service, component, message, data)
//   - runWithCorrelationId scoping
//   - Deprecated setCorrelationId is a no-op
// ============================================================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  StructuredLogger,
  getCorrelationId,
  setCorrelationId,
  clearCorrelationId,
  runWithCorrelationId,
} from '../src/observability/structuredLogger.ts';

// ---------------------------------------------------------------------------
// Helpers — capture console output
// ---------------------------------------------------------------------------

function captureConsole(fn: () => void): { logs: string[]; warns: string[]; errors: string[] } {
  const logs: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];

  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args: unknown[]) => logs.push(args.map(String).join(' '));
  console.warn = (...args: unknown[]) => warns.push(args.map(String).join(' '));
  console.error = (...args: unknown[]) => errors.push(args.map(String).join(' '));

  try {
    fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }

  return { logs, warns, errors };
}

// ============================================================================
// Tests
// ============================================================================

describe('StructuredLogger', () => {
  // =========================================================================
  // Log Level Filtering
  // =========================================================================

  describe('level filtering', () => {
    it('should suppress debug when minLevel is info', () => {
      const logger = new StructuredLogger({ minLevel: 'info', jsonOutput: false });
      const output = captureConsole(() => {
        logger.debug('test', 'This should not appear');
        logger.info('test', 'This should appear');
      });

      assert.equal(output.logs.length, 1, 'Only info should appear');
      assert.ok(output.logs[0].includes('This should appear'));
    });

    it('should suppress info and debug when minLevel is warn', () => {
      const logger = new StructuredLogger({ minLevel: 'warn', jsonOutput: false });
      const output = captureConsole(() => {
        logger.debug('test', 'debug msg');
        logger.info('test', 'info msg');
        logger.warn('test', 'warn msg');
        logger.error('test', 'error msg');
      });

      assert.equal(output.logs.length, 0, 'No debug/info logs');
      assert.equal(output.warns.length, 1, 'One warn');
      assert.equal(output.errors.length, 1, 'One error');
    });

    it('should emit all levels when minLevel is debug', () => {
      const logger = new StructuredLogger({ minLevel: 'debug', jsonOutput: false });
      const output = captureConsole(() => {
        logger.debug('test', 'debug msg');
        logger.info('test', 'info msg');
        logger.warn('test', 'warn msg');
        logger.error('test', 'error msg');
      });

      assert.equal(output.logs.length, 2, 'debug + info go to console.log');
      assert.equal(output.warns.length, 1, 'warn goes to console.warn');
      assert.equal(output.errors.length, 1, 'error goes to console.error');
    });

    it('should only emit errors when minLevel is error', () => {
      const logger = new StructuredLogger({ minLevel: 'error', jsonOutput: false });
      const output = captureConsole(() => {
        logger.debug('test', 'debug');
        logger.info('test', 'info');
        logger.warn('test', 'warn');
        logger.error('test', 'error');
      });

      assert.equal(output.logs.length, 0);
      assert.equal(output.warns.length, 0);
      assert.equal(output.errors.length, 1);
    });
  });

  // =========================================================================
  // JSON Output
  // =========================================================================

  describe('JSON output', () => {
    it('should emit valid JSON when jsonOutput is true', () => {
      const logger = new StructuredLogger({ jsonOutput: true, minLevel: 'info' });
      const output = captureConsole(() => {
        logger.info('worker', 'Job completed', { jobId: '123' });
      });

      assert.equal(output.logs.length, 1);
      const parsed = JSON.parse(output.logs[0]);
      assert.equal(parsed.level, 'info');
      assert.equal(parsed.component, 'worker');
      assert.equal(parsed.message, 'Job completed');
      assert.equal(parsed.data.jobId, '123');
      assert.ok(parsed.timestamp, 'Should have timestamp');
      assert.ok(parsed.service, 'Should have service name');
    });

    it('should include ISO 8601 timestamp', () => {
      const logger = new StructuredLogger({ jsonOutput: true, minLevel: 'info' });
      const output = captureConsole(() => {
        logger.info('test', 'timestamp check');
      });

      const parsed = JSON.parse(output.logs[0]);
      // Verify it's a valid ISO date
      const date = new Date(parsed.timestamp);
      assert.ok(!isNaN(date.getTime()), 'Timestamp should be valid ISO date');
    });

    it('should not include data field when no data provided', () => {
      const logger = new StructuredLogger({ jsonOutput: true, minLevel: 'info' });
      const output = captureConsole(() => {
        logger.info('test', 'no data');
      });

      const parsed = JSON.parse(output.logs[0]);
      assert.equal(parsed.data, undefined, 'data field should be absent');
    });

    it('should not include data field when data is empty object', () => {
      const logger = new StructuredLogger({ jsonOutput: true, minLevel: 'info' });
      const output = captureConsole(() => {
        logger.info('test', 'empty data', {});
      });

      const parsed = JSON.parse(output.logs[0]);
      assert.equal(parsed.data, undefined, 'Empty data should be omitted');
    });

    it('should route errors to console.error in JSON mode', () => {
      const logger = new StructuredLogger({ jsonOutput: true, minLevel: 'error' });
      const output = captureConsole(() => {
        logger.error('graph', 'Query failed', { error: 'timeout' });
      });

      assert.equal(output.errors.length, 1);
      const parsed = JSON.parse(output.errors[0]);
      assert.equal(parsed.level, 'error');
    });

    it('should route warnings to console.warn in JSON mode', () => {
      const logger = new StructuredLogger({ jsonOutput: true, minLevel: 'warn' });
      const output = captureConsole(() => {
        logger.warn('security', 'Rate limit approaching');
      });

      assert.equal(output.warns.length, 1);
      const parsed = JSON.parse(output.warns[0]);
      assert.equal(parsed.level, 'warn');
    });
  });

  // =========================================================================
  // Human-Readable Output
  // =========================================================================

  describe('human-readable output', () => {
    it('should include component and level in human-readable format', () => {
      const logger = new StructuredLogger({ jsonOutput: false, minLevel: 'info' });
      const output = captureConsole(() => {
        logger.info('worker', 'Processing complete');
      });

      assert.equal(output.logs.length, 1);
      assert.ok(output.logs[0].includes('[INFO ]') || output.logs[0].includes('[INFO]'));
      assert.ok(output.logs[0].includes('[worker]'));
      assert.ok(output.logs[0].includes('Processing complete'));
    });
  });

  // =========================================================================
  // Configuration
  // =========================================================================

  describe('configuration', () => {
    it('should use default service name when not specified', () => {
      const logger = new StructuredLogger({ jsonOutput: true, minLevel: 'info' });
      const output = captureConsole(() => {
        logger.info('test', 'config check');
      });

      const parsed = JSON.parse(output.logs[0]);
      assert.equal(parsed.service, 'court-access-backend');
    });

    it('should use custom service name when specified', () => {
      const logger = new StructuredLogger({ service: 'test-service', jsonOutput: true, minLevel: 'info' });
      const output = captureConsole(() => {
        logger.info('test', 'custom service');
      });

      const parsed = JSON.parse(output.logs[0]);
      assert.equal(parsed.service, 'test-service');
    });

    it('should expose config via getConfig()', () => {
      const logger = new StructuredLogger({ service: 'my-svc', minLevel: 'warn', jsonOutput: true });
      const config = logger.getConfig();
      assert.equal(config.service, 'my-svc');
      assert.equal(config.minLevel, 'warn');
      assert.equal(config.jsonOutput, true);
    });
  });
});

// ============================================================================
// Correlation ID — AsyncLocalStorage
// ============================================================================

describe('Correlation ID (AsyncLocalStorage)', () => {
  it('should return undefined when no correlation ID is set', () => {
    assert.equal(getCorrelationId(), undefined);
  });

  it('should scope correlation ID within runWithCorrelationId', () => {
    const result = runWithCorrelationId('req-123', () => {
      return getCorrelationId();
    });
    assert.equal(result, 'req-123');
  });

  it('should clear correlation ID after runWithCorrelationId exits', () => {
    runWithCorrelationId('req-456', () => {
      assert.equal(getCorrelationId(), 'req-456');
    });
    assert.equal(getCorrelationId(), undefined, 'Should be undefined outside runWithCorrelationId');
  });

  it('should support nested correlation IDs (inner overrides outer)', () => {
    runWithCorrelationId('outer', () => {
      assert.equal(getCorrelationId(), 'outer');
      runWithCorrelationId('inner', () => {
        assert.equal(getCorrelationId(), 'inner');
      });
      assert.equal(getCorrelationId(), 'outer', 'Should restore outer after inner exits');
    });
  });

  it('should isolate correlation IDs across concurrent async contexts', async () => {
    const results: string[] = [];

    const task1 = runWithCorrelationId('req-A', async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      results.push(`task1:${getCorrelationId()}`);
    });

    const task2 = runWithCorrelationId('req-B', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      results.push(`task2:${getCorrelationId()}`);
    });

    await Promise.all([task1, task2]);

    assert.ok(results.includes('task1:req-A'), 'Task 1 should see req-A');
    assert.ok(results.includes('task2:req-B'), 'Task 2 should see req-B');
  });

  it('should include correlation ID in JSON log output', () => {
    const logger = new StructuredLogger({ jsonOutput: true, minLevel: 'info' });
    const output = captureConsole(() => {
      runWithCorrelationId('corr-789', () => {
        logger.info('test', 'with correlation');
      });
    });

    const parsed = JSON.parse(output.logs[0]);
    assert.equal(parsed.correlationId, 'corr-789');
  });

  it('should not include correlationId field when no ID is set', () => {
    const logger = new StructuredLogger({ jsonOutput: true, minLevel: 'info' });
    const output = captureConsole(() => {
      logger.info('test', 'no correlation');
    });

    const parsed = JSON.parse(output.logs[0]);
    assert.equal(parsed.correlationId, undefined);
  });

  it('setCorrelationId should be a deprecated no-op', () => {
    setCorrelationId('should-not-work');
    assert.equal(getCorrelationId(), undefined, 'setCorrelationId is deprecated and should not set anything');
  });

  it('clearCorrelationId should be a no-op', () => {
    runWithCorrelationId('test-clear', () => {
      clearCorrelationId();
      // Inside the context, the ID should still be available
      assert.equal(getCorrelationId(), 'test-clear', 'clearCorrelationId should be a no-op');
    });
  });
});
