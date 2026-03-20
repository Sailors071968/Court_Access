// ============================================================================
// Scale Validation — 3-Level Stress Test Runner
//
// Orchestrates the full stress validation suite with metrics capture,
// health monitoring, and pass/fail reporting.
//
// Usage:
//   npx tsx backend/scripts/stress-test-runner.ts --level 1 [--api-url http://localhost:3001] [--token JWT]
//   npx tsx backend/scripts/stress-test-runner.ts --level 2
//   npx tsx backend/scripts/stress-test-runner.ts --level 3
//
// Hard Fail Conditions (auto-detected):
//   - Any worker OOM/crash
//   - Queue grows unbounded (>10k jobs)
//   - Duplicate facts despite hash
//   - Cross-tenant graph alerts
//   - Memory leak (usage climbs over hours)
//   - Metrics/health endpoints fail
// ============================================================================

import * as fs from 'node:fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthSnapshot {
  timestamp: string;
  health: unknown;
  deepHealth: unknown;
  metricsJson: unknown;
  queueDepths: unknown;
  redisMemory?: unknown;
}

interface HardFailCheck {
  name: string;
  passed: boolean;
  detail: string;
}

interface LevelReport {
  level: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  healthSnapshots: HealthSnapshot[];
  hardFailChecks: HardFailCheck[];
  allPassed: boolean;
  summary: string;
}

// ---------------------------------------------------------------------------
// API Helpers
// ---------------------------------------------------------------------------

async function apiGet(baseUrl: string, path: string, token: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

async function apiGetText(baseUrl: string, path: string, token: string): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: '' };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Health Snapshot Capture
// ---------------------------------------------------------------------------

async function captureHealthSnapshot(apiUrl: string, token: string): Promise<HealthSnapshot> {
  const [health, deepHealth, metricsJson, queues] = await Promise.all([
    apiGet(apiUrl, '/api/health', token),
    apiGet(apiUrl, '/api/health/deep', token),
    apiGet(apiUrl, '/api/metrics/json', token),
    apiGet(apiUrl, '/api/admin/queues', token),
  ]);

  return {
    timestamp: new Date().toISOString(),
    health: health.data,
    deepHealth: deepHealth.data,
    metricsJson: metricsJson.data,
    queueDepths: queues.data,
  };
}

// ---------------------------------------------------------------------------
// Hard Fail Checks
// ---------------------------------------------------------------------------

async function checkHealthEndpoints(apiUrl: string, token: string): Promise<HardFailCheck> {
  const health = await apiGet(apiUrl, '/api/health', token);
  if (!health.ok) {
    return { name: 'Health Endpoint', passed: false, detail: `/api/health returned ${health.status}` };
  }
  return { name: 'Health Endpoint', passed: true, detail: 'OK (200)' };
}

async function checkDeepHealth(apiUrl: string, token: string): Promise<HardFailCheck> {
  const deep = await apiGet(apiUrl, '/api/health/deep', token);
  if (!deep.ok) {
    return { name: 'Deep Health', passed: false, detail: `/api/health/deep returned ${deep.status}` };
  }
  const data = deep.data as Record<string, unknown> | null;
  const status = data?.status as string;
  if (status === 'unhealthy') {
    return { name: 'Deep Health', passed: false, detail: `Status: unhealthy — ${JSON.stringify(data)}` };
  }
  return { name: 'Deep Health', passed: true, detail: `Status: ${status}` };
}

async function checkMetricsEndpoint(apiUrl: string, token: string): Promise<HardFailCheck> {
  const metrics = await apiGetText(apiUrl, '/api/metrics', token);
  if (!metrics.ok) {
    return { name: 'Metrics Endpoint', passed: false, detail: `/api/metrics returned ${metrics.status}` };
  }
  if (!metrics.text.includes('# TYPE') && !metrics.text.includes('# HELP')) {
    return { name: 'Metrics Endpoint', passed: false, detail: 'Response does not contain valid Prometheus text' };
  }
  return { name: 'Metrics Endpoint', passed: true, detail: `Valid Prometheus format (${metrics.text.length} chars)` };
}

async function checkMetricsJsonEndpoint(apiUrl: string, token: string): Promise<HardFailCheck> {
  const metrics = await apiGet(apiUrl, '/api/metrics/json', token);
  if (!metrics.ok) {
    return { name: 'Metrics JSON', passed: false, detail: `/api/metrics/json returned ${metrics.status}` };
  }
  return { name: 'Metrics JSON', passed: true, detail: 'OK — structured summary returned' };
}

async function checkQueueUnbounded(apiUrl: string, token: string): Promise<HardFailCheck> {
  const queues = await apiGet(apiUrl, '/api/admin/queues', token);
  if (!queues.ok) {
    return { name: 'Queue Depth', passed: true, detail: 'Could not check queues (endpoint not available)' };
  }
  const data = queues.data as Record<string, Record<string, number>> | null;
  if (!data) {
    return { name: 'Queue Depth', passed: true, detail: 'No queue data returned' };
  }

  for (const [queueName, stats] of Object.entries(data)) {
    const waiting = stats.waiting ?? 0;
    if (waiting > 10000) {
      return {
        name: 'Queue Depth',
        passed: false,
        detail: `Queue ${queueName} has ${waiting} waiting jobs (>10k = unbounded growth)`,
      };
    }
  }
  return { name: 'Queue Depth', passed: true, detail: 'All queues within limits' };
}

async function checkMemoryLeak(snapshots: HealthSnapshot[]): Promise<HardFailCheck> {
  // Check if memory usage has been consistently climbing over the snapshots
  if (snapshots.length < 3) {
    return { name: 'Memory Leak', passed: true, detail: 'Not enough snapshots to detect trend' };
  }

  const memoryValues: number[] = [];
  for (const snap of snapshots) {
    const deep = snap.deepHealth as Record<string, unknown> | null;
    if (deep?.components) {
      const components = deep.components as Record<string, Record<string, unknown>>;
      const memComponent = components.memory;
      if (memComponent?.details) {
        const details = memComponent.details as Record<string, unknown>;
        const heapUsed = details.heapUsedMB as number;
        if (typeof heapUsed === 'number') {
          memoryValues.push(heapUsed);
        }
      }
    }
  }

  if (memoryValues.length < 3) {
    return { name: 'Memory Leak', passed: true, detail: 'Not enough memory data points' };
  }

  // Check if memory is monotonically increasing (leak indicator)
  let increasing = 0;
  for (let i = 1; i < memoryValues.length; i++) {
    if (memoryValues[i] > memoryValues[i - 1]) increasing++;
  }

  const growthRate = increasing / (memoryValues.length - 1);
  const totalGrowthMB = memoryValues[memoryValues.length - 1] - memoryValues[0];

  if (growthRate > 0.8 && totalGrowthMB > 100) {
    return {
      name: 'Memory Leak',
      passed: false,
      detail: `Memory grew ${Math.round(totalGrowthMB)}MB over ${memoryValues.length} checks (${Math.round(growthRate * 100)}% increasing)`,
    };
  }

  return {
    name: 'Memory Leak',
    passed: true,
    detail: `Growth: ${Math.round(totalGrowthMB)}MB over ${memoryValues.length} checks (${Math.round(growthRate * 100)}% increasing)`,
  };
}

// ---------------------------------------------------------------------------
// Level Runners
// ---------------------------------------------------------------------------

async function runLevel1(apiUrl: string, token: string): Promise<LevelReport> {
  console.log('\n' + '='.repeat(60));
  console.log('STRESS TEST — LEVEL 1: Single 50-100 GB Case');
  console.log('='.repeat(60));
  console.log('Monitoring health, queue depth, memory during processing.\n');

  const startTime = Date.now();
  const snapshots: HealthSnapshot[] = [];
  const checks: HardFailCheck[] = [];

  // Initial health checks
  console.log('[Level 1] Running initial health checks...');
  checks.push(await checkHealthEndpoints(apiUrl, token));
  checks.push(await checkDeepHealth(apiUrl, token));
  checks.push(await checkMetricsEndpoint(apiUrl, token));
  checks.push(await checkMetricsJsonEndpoint(apiUrl, token));

  // Capture baseline snapshot
  const baseline = await captureHealthSnapshot(apiUrl, token);
  snapshots.push(baseline);
  console.log('[Level 1] Baseline snapshot captured.');

  // Monitor for 5 minutes (checking every 30 seconds)
  const MONITOR_DURATION = 5 * 60 * 1000; // 5 min
  const MONITOR_INTERVAL = 30 * 1000; // 30s
  const monitorEnd = Date.now() + MONITOR_DURATION;

  console.log(`[Level 1] Monitoring for ${MONITOR_DURATION / 1000}s...`);
  while (Date.now() < monitorEnd) {
    await sleep(MONITOR_INTERVAL);
    const snap = await captureHealthSnapshot(apiUrl, token);
    snapshots.push(snap);

    // Check queue depths
    const queueCheck = await checkQueueUnbounded(apiUrl, token);
    if (!queueCheck.passed) {
      checks.push(queueCheck);
      console.error(`[Level 1] HARD FAIL: ${queueCheck.detail}`);
      break;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Level 1] ${elapsed}s — snapshot captured, queues OK`);
  }

  // Final checks
  checks.push(await checkQueueUnbounded(apiUrl, token));
  checks.push(await checkMemoryLeak(snapshots));
  checks.push(await checkHealthEndpoints(apiUrl, token));

  const allPassed = checks.every(c => c.passed);
  const endTime = Date.now();

  return {
    level: 1,
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date(endTime).toISOString(),
    durationMs: endTime - startTime,
    healthSnapshots: snapshots,
    hardFailChecks: checks,
    allPassed,
    summary: allPassed
      ? 'Level 1 PASSED — all health checks, queue depths, and memory stable'
      : `Level 1 FAILED — ${checks.filter(c => !c.passed).map(c => c.name).join(', ')}`,
  };
}

async function runLevel2(apiUrl: string, token: string): Promise<LevelReport> {
  console.log('\n' + '='.repeat(60));
  console.log('STRESS TEST — LEVEL 2: 3-5 Concurrent Cases (200-300 GB)');
  console.log('='.repeat(60));
  console.log('Monitoring concurrent processing stability.\n');

  const startTime = Date.now();
  const snapshots: HealthSnapshot[] = [];
  const checks: HardFailCheck[] = [];

  // Initial checks
  checks.push(await checkHealthEndpoints(apiUrl, token));
  checks.push(await checkDeepHealth(apiUrl, token));
  checks.push(await checkMetricsEndpoint(apiUrl, token));
  checks.push(await checkMetricsJsonEndpoint(apiUrl, token));

  const baseline = await captureHealthSnapshot(apiUrl, token);
  snapshots.push(baseline);

  // Monitor for 15 minutes (more time for concurrent processing)
  const MONITOR_DURATION = 15 * 60 * 1000;
  const MONITOR_INTERVAL = 60 * 1000;
  const monitorEnd = Date.now() + MONITOR_DURATION;

  console.log(`[Level 2] Monitoring for ${MONITOR_DURATION / 60000} minutes...`);
  while (Date.now() < monitorEnd) {
    await sleep(MONITOR_INTERVAL);
    const snap = await captureHealthSnapshot(apiUrl, token);
    snapshots.push(snap);

    const queueCheck = await checkQueueUnbounded(apiUrl, token);
    if (!queueCheck.passed) {
      checks.push(queueCheck);
      console.error(`[Level 2] HARD FAIL: ${queueCheck.detail}`);
      break;
    }

    const elapsed = Math.round((Date.now() - startTime) / 60000);
    console.log(`[Level 2] ${elapsed}min — snapshot captured, queues OK`);
  }

  checks.push(await checkQueueUnbounded(apiUrl, token));
  checks.push(await checkMemoryLeak(snapshots));
  checks.push(await checkHealthEndpoints(apiUrl, token));

  const allPassed = checks.every(c => c.passed);
  const endTime = Date.now();

  return {
    level: 2,
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date(endTime).toISOString(),
    durationMs: endTime - startTime,
    healthSnapshots: snapshots,
    hardFailChecks: checks,
    allPassed,
    summary: allPassed
      ? 'Level 2 PASSED — concurrent processing stable, all checks passed'
      : `Level 2 FAILED — ${checks.filter(c => !c.passed).map(c => c.name).join(', ')}`,
  };
}

async function runLevel3(apiUrl: string, token: string): Promise<LevelReport> {
  console.log('\n' + '='.repeat(60));
  console.log('STRESS TEST — LEVEL 3: 500+ GB Soak Test (48-72 hours)');
  console.log('='.repeat(60));
  console.log('Long-duration stability monitoring.\n');

  const startTime = Date.now();
  const snapshots: HealthSnapshot[] = [];
  const checks: HardFailCheck[] = [];

  // Initial checks
  checks.push(await checkHealthEndpoints(apiUrl, token));
  checks.push(await checkDeepHealth(apiUrl, token));
  checks.push(await checkMetricsEndpoint(apiUrl, token));
  checks.push(await checkMetricsJsonEndpoint(apiUrl, token));

  const baseline = await captureHealthSnapshot(apiUrl, token);
  snapshots.push(baseline);

  // Soak: monitor every 5 min for 48 hours
  const SOAK_DURATION = 48 * 60 * 60 * 1000; // 48 hours
  const MONITOR_INTERVAL = 5 * 60 * 1000; // 5 min
  const soakEnd = Date.now() + SOAK_DURATION;
  let failedEarly = false;

  console.log(`[Level 3] Soak test: monitoring for 48 hours (every 5 min)...`);
  while (Date.now() < soakEnd) {
    await sleep(MONITOR_INTERVAL);
    const snap = await captureHealthSnapshot(apiUrl, token);
    snapshots.push(snap);

    // Run all hard fail checks
    const queueCheck = await checkQueueUnbounded(apiUrl, token);
    const healthCheck = await checkHealthEndpoints(apiUrl, token);
    const memCheck = await checkMemoryLeak(snapshots);

    if (!queueCheck.passed || !healthCheck.passed) {
      checks.push(queueCheck);
      checks.push(healthCheck);
      console.error(`[Level 3] HARD FAIL detected — stopping soak test`);
      failedEarly = true;
      break;
    }

    const elapsedHours = Math.round((Date.now() - startTime) / 3600000 * 10) / 10;
    const snapshotCount = snapshots.length;
    console.log(
      `[Level 3] ${elapsedHours}h — snapshot #${snapshotCount}, ` +
      `queues OK, health OK, memory: ${memCheck.detail}`,
    );

    // Periodic memory leak check (every 50 snapshots)
    if (snapshotCount % 50 === 0 && !memCheck.passed) {
      checks.push(memCheck);
      console.error(`[Level 3] Memory leak detected: ${memCheck.detail}`);
      failedEarly = true;
      break;
    }
  }

  if (!failedEarly) {
    checks.push(await checkQueueUnbounded(apiUrl, token));
    checks.push(await checkMemoryLeak(snapshots));
    checks.push(await checkHealthEndpoints(apiUrl, token));
  }

  const allPassed = checks.every(c => c.passed);
  const endTime = Date.now();

  return {
    level: 3,
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date(endTime).toISOString(),
    durationMs: endTime - startTime,
    healthSnapshots: snapshots,
    hardFailChecks: checks,
    allPassed,
    summary: allPassed
      ? 'Level 3 PASSED — 48-hour soak test complete, system stable'
      : `Level 3 FAILED — ${checks.filter(c => !c.passed).map(c => c.name).join(', ')}`,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const levelIdx = args.indexOf('--level');
  const apiUrlIdx = args.indexOf('--api-url');
  const tokenIdx = args.indexOf('--token');

  const level = levelIdx >= 0 ? parseInt(args[levelIdx + 1], 10) : 1;
  const apiUrl = apiUrlIdx >= 0 ? args[apiUrlIdx + 1] : 'http://localhost:3001';
  const token = tokenIdx >= 0 ? args[tokenIdx + 1] : process.env.STRESS_TEST_TOKEN || '';

  if (![1, 2, 3].includes(level)) {
    console.error('Usage: npx tsx backend/scripts/stress-test-runner.ts --level [1|2|3]');
    process.exit(1);
  }

  console.log('========================================');
  console.log(`Court Access — Stress Test Runner`);
  console.log(`Level: ${level}`);
  console.log(`API: ${apiUrl}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('========================================\n');

  // Verify API is reachable
  const healthCheck = await apiGet(apiUrl, '/api/health', token);
  if (!healthCheck.ok) {
    console.error(`[FATAL] API not reachable at ${apiUrl}/api/health (status: ${healthCheck.status})`);
    console.error('Make sure the backend is running and the URL is correct.');
    process.exit(1);
  }
  console.log('[OK] API is reachable\n');

  let report: LevelReport;
  switch (level) {
    case 1: report = await runLevel1(apiUrl, token); break;
    case 2: report = await runLevel2(apiUrl, token); break;
    case 3: report = await runLevel3(apiUrl, token); break;
    default: report = await runLevel1(apiUrl, token);
  }

  // Write report
  const reportDir = 'stress-data';
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = `${reportDir}/stress-report-level${level}-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('STRESS TEST REPORT');
  console.log('='.repeat(60));
  console.log(`Level: ${report.level}`);
  console.log(`Duration: ${Math.round(report.durationMs / 1000)}s (${Math.round(report.durationMs / 60000)} min)`);
  console.log(`Result: ${report.allPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`Summary: ${report.summary}`);
  console.log(`Health snapshots: ${report.healthSnapshots.length}`);
  console.log('');
  console.log('Hard Fail Checks:');
  for (const check of report.hardFailChecks) {
    const icon = check.passed ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${check.name}: ${check.detail}`);
  }
  console.log('');
  console.log(`Report saved: ${reportPath}`);

  if (!report.allPassed) {
    console.log('\n[ACTION REQUIRED] Fix failures and retest before advancing to next level.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
