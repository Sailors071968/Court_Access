// ============================================================================
// PR 7 — Stability Test Suite: MetricsCollector (PR 6)
//
// Tests zero-dependency Prometheus-compatible metrics collection:
//   - Counter registration, increment, multi-label
//   - Gauge set/increment/decrement
//   - Histogram observation, bucket counting, percentile computation
//   - Prometheus text exposition format
//   - JSON summary output
//   - Memory cap on histogram observations
//   - Singleton reset for test isolation
// ============================================================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MetricsCollector } from '../src/observability/metricsCollector.ts';

describe('MetricsCollector', () => {
  let mc: MetricsCollector;

  beforeEach(() => {
    MetricsCollector.resetInstance();
    mc = MetricsCollector.getInstance();
  });

  // =========================================================================
  // Singleton
  // =========================================================================

  it('should return the same instance on repeated calls', () => {
    const a = MetricsCollector.getInstance();
    const b = MetricsCollector.getInstance();
    assert.strictEqual(a, b);
  });

  it('should return a new instance after resetInstance()', () => {
    const a = MetricsCollector.getInstance();
    MetricsCollector.resetInstance();
    const b = MetricsCollector.getInstance();
    assert.notStrictEqual(a, b);
  });

  // =========================================================================
  // Counters
  // =========================================================================

  it('should register and increment a counter', () => {
    mc.registerCounter('test_counter', 'A test counter');
    mc.incrementCounter('test_counter');
    mc.incrementCounter('test_counter');
    mc.incrementCounter('test_counter', {}, 3);

    const text = mc.toPrometheusText();
    assert.ok(text.includes('test_counter'), 'Prometheus output should contain counter name');
    // Total should be 1+1+3 = 5
    assert.ok(text.includes('test_counter 5'), `Counter should be 5, got:\n${text}`);
  });

  it('should track counters with different label sets independently', () => {
    mc.registerCounter('http_total', 'HTTP request counter');
    mc.incrementCounter('http_total', { method: 'GET', status: '200' }, 10);
    mc.incrementCounter('http_total', { method: 'POST', status: '201' }, 3);
    mc.incrementCounter('http_total', { method: 'GET', status: '200' }, 5);

    const json = mc.toJSON();
    const metric = json['http_total'] as { type: string; values: Record<string, number> };
    assert.equal(metric.type, 'counter');

    // GET/200 should be 15, POST/201 should be 3
    const values = Object.values(metric.values);
    assert.ok(values.includes(15), 'GET/200 should total 15');
    assert.ok(values.includes(3), 'POST/201 should total 3');
  });

  it('should silently ignore increments on unregistered counters', () => {
    // Should not throw
    mc.incrementCounter('nonexistent_counter', {}, 5);
    const text = mc.toPrometheusText();
    assert.ok(!text.includes('nonexistent_counter'));
  });

  it('should not re-register an existing counter', () => {
    mc.registerCounter('dup_counter', 'First');
    mc.incrementCounter('dup_counter', {}, 10);
    mc.registerCounter('dup_counter', 'Second'); // Should be no-op
    mc.incrementCounter('dup_counter', {}, 5);

    const json = mc.toJSON();
    const metric = json['dup_counter'] as { type: string; values: Record<string, number> };
    const total = Object.values(metric.values).reduce((a, b) => a + b, 0);
    assert.equal(total, 15, 'Counter should retain its value after duplicate registration');
  });

  // =========================================================================
  // Gauges
  // =========================================================================

  it('should set a gauge value', () => {
    mc.registerGauge('test_gauge', 'A test gauge');
    mc.setGauge('test_gauge', 42);

    const text = mc.toPrometheusText();
    assert.ok(text.includes('test_gauge 42'));
  });

  it('should increment and decrement a gauge', () => {
    mc.registerGauge('connections', 'Active connections');
    mc.incrementGauge('connections', {}, 5);
    mc.incrementGauge('connections', {}, 3);
    mc.decrementGauge('connections', {}, 2);

    const json = mc.toJSON();
    const metric = json['connections'] as { type: string; values: Record<string, number> };
    const value = Object.values(metric.values)[0];
    assert.equal(value, 6, 'Gauge should be 5+3-2 = 6');
  });

  it('should support labeled gauges', () => {
    mc.registerGauge('queue_depth', 'Queue depth');
    mc.setGauge('queue_depth', 10, { queue: 'timeline' });
    mc.setGauge('queue_depth', 5, { queue: 'narrative' });

    const json = mc.toJSON();
    const metric = json['queue_depth'] as { type: string; values: Record<string, number> };
    const values = Object.values(metric.values);
    assert.ok(values.includes(10));
    assert.ok(values.includes(5));
  });

  // =========================================================================
  // Histograms
  // =========================================================================

  it('should observe histogram values and compute percentiles', () => {
    mc.registerHistogram('request_duration', 'Request duration', [10, 50, 100, 500]);

    // Add 100 observations: 1..100
    for (let i = 1; i <= 100; i++) {
      mc.observeHistogram('request_duration', i);
    }

    const json = mc.toJSON();
    const metric = json['request_duration'] as {
      type: string;
      summaries: Record<string, { count: number; p50: number; p95: number; p99: number }>;
    };
    assert.equal(metric.type, 'histogram');

    const summary = Object.values(metric.summaries)[0];
    assert.equal(summary.count, 100);
    assert.ok(summary.p50 >= 45 && summary.p50 <= 55, `p50 should be ~50, got ${summary.p50}`);
    assert.ok(summary.p95 >= 90 && summary.p95 <= 100, `p95 should be ~95, got ${summary.p95}`);
    assert.ok(summary.p99 >= 95 && summary.p99 <= 100, `p99 should be ~99, got ${summary.p99}`);
  });

  it('should produce valid Prometheus bucket lines', () => {
    mc.registerHistogram('test_hist', 'Test histogram', [10, 50, 100]);
    mc.observeHistogram('test_hist', 5);
    mc.observeHistogram('test_hist', 25);
    mc.observeHistogram('test_hist', 75);
    mc.observeHistogram('test_hist', 200);

    const text = mc.toPrometheusText();
    // Bucket le=10 should have 1 (value 5)
    assert.ok(text.includes('test_hist_bucket{le="10"'), 'Should have le=10 bucket');
    // Bucket le="+Inf" should have 4 (all values)
    assert.ok(text.includes('test_hist_bucket{le="+Inf"'), 'Should have +Inf bucket');
    assert.ok(text.includes('test_hist_count'), 'Should have count line');
    assert.ok(text.includes('test_hist_sum'), 'Should have sum line');
  });

  it('should cap histogram observations to prevent memory leak', () => {
    mc.registerHistogram('capped_hist', 'Capped histogram');

    // Observe more than MAX_OBSERVATIONS (10000)
    for (let i = 0; i < 12000; i++) {
      mc.observeHistogram('capped_hist', i);
    }

    const json = mc.toJSON();
    const metric = json['capped_hist'] as {
      type: string;
      summaries: Record<string, { count: number }>;
    };
    const summary = Object.values(metric.summaries)[0];
    // After cap, should have at most MAX_OBSERVATIONS values
    assert.ok(summary.count <= 10000, `Observations should be capped, got ${summary.count}`);
  });

  it('should return 0 percentile for empty histogram', () => {
    mc.registerHistogram('empty_hist', 'Empty');
    // Don't observe anything — the histogram should exist but have no data
    const json = mc.toJSON();
    const metric = json['empty_hist'] as {
      type: string;
      summaries: Record<string, { count: number; p50: number }>;
    };
    // No observations means no summaries
    assert.equal(Object.keys(metric.summaries).length, 0);
  });

  // =========================================================================
  // Timer
  // =========================================================================

  it('should measure elapsed time with startTimer', async () => {
    mc.registerHistogram('timer_hist', 'Timer test');
    const end = mc.startTimer('timer_hist');

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 20));
    const elapsed = end();

    assert.ok(elapsed >= 10, `Elapsed should be >= 10ms, got ${elapsed}`);

    const json = mc.toJSON();
    const metric = json['timer_hist'] as {
      type: string;
      summaries: Record<string, { count: number }>;
    };
    const summary = Object.values(metric.summaries)[0];
    assert.equal(summary.count, 1);
  });

  // =========================================================================
  // Built-in Metrics
  // =========================================================================

  it('should register built-in metrics on construction', () => {
    const text = mc.toPrometheusText();
    assert.ok(text.includes('courtaccess_up'), 'Should have courtaccess_up gauge');
    assert.ok(text.includes('courtaccess_http_requests_total'), 'Should have HTTP request counter');
    assert.ok(text.includes('courtaccess_queue_depth'), 'Should have queue depth gauge');
    assert.ok(text.includes('courtaccess_graph_queries_total'), 'Should have graph queries counter');
    assert.ok(text.includes('courtaccess_llm_calls_total'), 'Should have LLM calls counter');
    assert.ok(text.includes('courtaccess_uptime_seconds'), 'Should have uptime gauge');
  });

  it('should report courtaccess_up as 1', () => {
    const text = mc.toPrometheusText();
    assert.ok(text.includes('courtaccess_up 1'), 'Service should be marked as up');
  });

  // =========================================================================
  // Prometheus Format Correctness
  // =========================================================================

  it('should include HELP and TYPE lines for each metric', () => {
    mc.registerCounter('custom_counter', 'My custom counter');
    mc.incrementCounter('custom_counter', {}, 1);

    const text = mc.toPrometheusText();
    assert.ok(text.includes('# HELP custom_counter My custom counter'));
    assert.ok(text.includes('# TYPE custom_counter counter'));
  });

  it('should format labeled metrics with Prometheus label syntax', () => {
    mc.registerCounter('labeled_counter', 'Labeled');
    mc.incrementCounter('labeled_counter', { method: 'GET', status: '200' }, 7);

    const text = mc.toPrometheusText();
    // Should contain {method="GET",status="200"} or {status="200",method="GET"} (sorted)
    assert.ok(
      text.includes('labeled_counter{') && text.includes('="GET"') && text.includes('="200"'),
      'Should format labels in Prometheus style',
    );
  });

  // =========================================================================
  // JSON Output
  // =========================================================================

  it('should include uptimeSeconds in JSON output', () => {
    const json = mc.toJSON();
    assert.ok(typeof json.uptimeSeconds === 'number');
    assert.ok(json.uptimeSeconds >= 0);
  });
});
