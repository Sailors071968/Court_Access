// ============================================================================
// PR 6 — Observability Layer: Metrics Collector
//
// Lightweight, zero-dependency metrics collection for Court Access.
// Tracks counters, gauges, and histograms in-memory, exposed via
// a Prometheus-compatible /metrics endpoint.
//
// No external Prometheus client library needed — we emit text/plain
// in the OpenMetrics exposition format.
//
// Tracked metrics:
//   - Queue depth per queue name
//   - Worker job duration (p50, p95, p99)
//   - Graph query duration (p50, p95, p99)
//   - LLM call latency and token usage
//   - HTTP request count and latency
//   - Error rate by category
//   - Active connections (DB, Redis, Neo4j)
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricLabels {
  [key: string]: string;
}

interface CounterEntry {
  type: 'counter';
  help: string;
  values: Map<string, number>; // labelKey → value
}

interface GaugeEntry {
  type: 'gauge';
  help: string;
  values: Map<string, number>;
}

interface HistogramEntry {
  type: 'histogram';
  help: string;
  buckets: number[];
  observations: Map<string, number[]>; // labelKey → raw values (capped)
}

type MetricEntry = CounterEntry | GaugeEntry | HistogramEntry;

// ---------------------------------------------------------------------------
// Label Serialization
// ---------------------------------------------------------------------------

function labelKey(labels: MetricLabels): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',') || '__default__';
}

// ---------------------------------------------------------------------------
// Default Histogram Buckets
// ---------------------------------------------------------------------------

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const MAX_OBSERVATIONS = 10000; // Cap per label set to prevent memory leak

// ---------------------------------------------------------------------------
// Metrics Collector (Singleton)
// ---------------------------------------------------------------------------

export class MetricsCollector {
  private static instance: MetricsCollector | null = null;
  private readonly metrics = new Map<string, MetricEntry>();
  private readonly startTime = Date.now();

  private constructor() {
    // Register built-in metrics
    this.registerGauge('courtaccess_up', 'Whether the service is up (1=up, 0=down)');
    this.setGauge('courtaccess_up', 1);

    this.registerCounter('courtaccess_http_requests_total', 'Total HTTP requests');
    this.registerHistogram('courtaccess_http_request_duration_ms', 'HTTP request duration in milliseconds');
    this.registerCounter('courtaccess_errors_total', 'Total errors by category');

    // Queue metrics
    this.registerGauge('courtaccess_queue_depth', 'Current queue depth by queue name');
    this.registerGauge('courtaccess_queue_active', 'Active jobs per queue');
    this.registerCounter('courtaccess_queue_completed_total', 'Total completed queue jobs');
    this.registerCounter('courtaccess_queue_failed_total', 'Total failed queue jobs');
    this.registerHistogram('courtaccess_worker_job_duration_ms', 'Worker job duration in milliseconds');
    this.registerCounter('courtaccess_worker_timeouts_total', 'Total job timeouts by worker');
    this.registerCounter('courtaccess_worker_stalled_total', 'Total stalled jobs by worker');

    // Graph metrics
    this.registerHistogram('courtaccess_graph_query_duration_ms', 'Neo4j graph query duration in milliseconds');
    this.registerCounter('courtaccess_graph_queries_total', 'Total graph queries');
    this.registerCounter('courtaccess_graph_tenant_violations', 'Tenant isolation violations detected');

    // LLM metrics
    this.registerHistogram('courtaccess_llm_latency_ms', 'LLM API call latency in milliseconds');
    this.registerCounter('courtaccess_llm_calls_total', 'Total LLM API calls');
    this.registerCounter('courtaccess_llm_tokens_total', 'Total LLM tokens used');

    // Connection gauges
    this.registerGauge('courtaccess_db_connections', 'Active database connections');
    this.registerGauge('courtaccess_redis_connected', 'Redis connection status (1=connected, 0=disconnected)');
    this.registerGauge('courtaccess_neo4j_connected', 'Neo4j connection status (1=connected, 0=disconnected)');
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /** Reset singleton (for testing) */
  static resetInstance(): void {
    MetricsCollector.instance = null;
  }

  // =========================================================================
  // Registration
  // =========================================================================

  registerCounter(name: string, help: string): void {
    if (this.metrics.has(name)) return;
    this.metrics.set(name, { type: 'counter', help, values: new Map() });
  }

  registerGauge(name: string, help: string): void {
    if (this.metrics.has(name)) return;
    this.metrics.set(name, { type: 'gauge', help, values: new Map() });
  }

  registerHistogram(
    name: string,
    help: string,
    buckets: number[] = DEFAULT_BUCKETS,
  ): void {
    if (this.metrics.has(name)) return;
    this.metrics.set(name, {
      type: 'histogram',
      help,
      buckets: [...buckets].sort((a, b) => a - b),
      observations: new Map(),
    });
  }

  // =========================================================================
  // Counter Operations
  // =========================================================================

  incrementCounter(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') return;
    const key = labelKey(labels);
    metric.values.set(key, (metric.values.get(key) ?? 0) + value);
  }

  // =========================================================================
  // Gauge Operations
  // =========================================================================

  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') return;
    const key = labelKey(labels);
    metric.values.set(key, value);
  }

  incrementGauge(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') return;
    const key = labelKey(labels);
    metric.values.set(key, (metric.values.get(key) ?? 0) + value);
  }

  decrementGauge(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') return;
    const key = labelKey(labels);
    metric.values.set(key, (metric.values.get(key) ?? 0) - value);
  }

  // =========================================================================
  // Histogram Operations
  // =========================================================================

  observeHistogram(name: string, value: number, labels: MetricLabels = {}): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') return;
    const key = labelKey(labels);
    let observations = metric.observations.get(key);
    if (!observations) {
      observations = [];
      metric.observations.set(key, observations);
    }
    // Cap observations to prevent unbounded memory growth
    if (observations.length >= MAX_OBSERVATIONS) {
      // Keep the most recent half
      observations.splice(0, observations.length - MAX_OBSERVATIONS / 2);
    }
    observations.push(value);
  }

  // =========================================================================
  // Convenience: Timer
  // =========================================================================

  /**
   * Start a timer. Returns a function that, when called, records
   * the elapsed time to the specified histogram.
   */
  startTimer(histogramName: string, labels: MetricLabels = {}): () => number {
    const start = performance.now();
    return () => {
      const elapsed = Math.round(performance.now() - start);
      this.observeHistogram(histogramName, elapsed, labels);
      return elapsed;
    };
  }

  // =========================================================================
  // Percentile Computation
  // =========================================================================

  private computePercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(p / 100 * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // =========================================================================
  // Prometheus Exposition Format
  // =========================================================================

  /**
   * Generate Prometheus text exposition format for all metrics.
   */
  toPrometheusText(): string {
    const lines: string[] = [];
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    // Add process uptime
    lines.push('# HELP courtaccess_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE courtaccess_uptime_seconds gauge');
    lines.push(`courtaccess_uptime_seconds ${uptimeSeconds}`);
    lines.push('');

    for (const [name, metric] of this.metrics) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} ${metric.type}`);

      if (metric.type === 'counter' || metric.type === 'gauge') {
        for (const [key, value] of metric.values) {
          const labelsStr = key === '__default__' ? '' : `{${this.keyToLabels(key)}}`;
          lines.push(`${name}${labelsStr} ${value}`);
        }
      } else if (metric.type === 'histogram') {
        for (const [key, observations] of metric.observations) {
          const labelsStr = key === '__default__' ? '' : `,${this.keyToLabels(key)}`;
          const sorted = [...observations].sort((a, b) => a - b);
          const sum = observations.reduce((acc, v) => acc + v, 0);

          // Bucket counts
          for (const bucket of metric.buckets) {
            const count = sorted.filter(v => v <= bucket).length;
            lines.push(`${name}_bucket{le="${bucket}"${labelsStr}} ${count}`);
          }
          lines.push(`${name}_bucket{le="+Inf"${labelsStr}} ${observations.length}`);
          lines.push(`${name}_sum{${labelsStr.replace(/^,/, '')}} ${sum}`);
          lines.push(`${name}_count{${labelsStr.replace(/^,/, '')}} ${observations.length}`);

          // Percentiles (custom, not standard Prometheus but useful)
          const p50 = this.computePercentile(sorted, 50);
          const p95 = this.computePercentile(sorted, 95);
          const p99 = this.computePercentile(sorted, 99);
          lines.push(`${name}_p50{${labelsStr.replace(/^,/, '')}} ${p50}`);
          lines.push(`${name}_p95{${labelsStr.replace(/^,/, '')}} ${p95}`);
          lines.push(`${name}_p99{${labelsStr.replace(/^,/, '')}} ${p99}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Convert a labelKey back to Prometheus label format.
   */
  private keyToLabels(key: string): string {
    return key
      .split(',')
      .map(pair => {
        const [k, ...rest] = pair.split('=');
        return `${k}="${rest.join('=')}"`;
      })
      .join(',');
  }

  // =========================================================================
  // JSON Summary (for /api/health/metrics)
  // =========================================================================

  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };

    for (const [name, metric] of this.metrics) {
      if (metric.type === 'counter' || metric.type === 'gauge') {
        const values: Record<string, number> = {};
        for (const [key, value] of metric.values) {
          values[key] = value;
        }
        result[name] = { type: metric.type, values };
      } else if (metric.type === 'histogram') {
        const summaries: Record<string, { count: number; p50: number; p95: number; p99: number }> = {};
        for (const [key, observations] of metric.observations) {
          const sorted = [...observations].sort((a, b) => a - b);
          summaries[key] = {
            count: observations.length,
            p50: this.computePercentile(sorted, 50),
            p95: this.computePercentile(sorted, 95),
            p99: this.computePercentile(sorted, 99),
          };
        }
        result[name] = { type: 'histogram', summaries };
      }
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// Convenience Singleton Access
// ---------------------------------------------------------------------------

export const metrics = MetricsCollector.getInstance();
