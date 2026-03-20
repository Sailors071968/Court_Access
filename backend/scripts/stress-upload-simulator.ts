// ============================================================================
// Scale Validation — Staggered Upload Simulator
//
// Simulates realistic attorney upload patterns against the running backend.
// Reads a manifest from generate-stress-dataset.ts and enqueues evidence
// items via the API with configurable stagger delays.
//
// Usage:
//   npx tsx backend/scripts/stress-upload-simulator.ts --manifest stress-data/manifest-level1.json
//   npx tsx backend/scripts/stress-upload-simulator.ts --manifest stress-data/manifest-level2.json --stagger 600
//   npx tsx backend/scripts/stress-upload-simulator.ts --manifest stress-data/manifest-level3.json --stagger 1800 --soak
//
// Options:
//   --manifest <path>   Path to dataset manifest JSON
//   --stagger <seconds> Delay between case uploads (default: 600 = 10 min)
//   --soak              Enable continuous soak mode (Level 3 — loops for 48+ hours)
//   --api-url <url>     Backend API URL (default: http://localhost:3001)
//   --token <jwt>       Auth JWT token for API calls
//   --dry-run           Print what would happen without sending requests
// ============================================================================

import * as fs from 'node:fs';
import * as crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManifestEvidence {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sizeMB: number;
  category: string;
  description: string;
  pageCount?: number;
  durationMinutes?: number;
  textContent: string;
}

interface ManifestCase {
  caseId: string;
  caseName: string;
  tenantId: string;
  evidence: ManifestEvidence[];
  totalSizeMB: number;
  totalSizeGB: number;
  evidenceCount: number;
}

interface Manifest {
  level: number;
  cases: ManifestCase[];
  totalSizeGB: number;
  totalEvidenceCount: number;
  generatedAt: string;
}

interface UploadStats {
  caseId: string;
  caseName: string;
  evidenceUploaded: number;
  evidenceFailed: number;
  totalMB: number;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  errors: string[];
}

interface RunReport {
  level: number;
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  caseStats: UploadStats[];
  totalEvidenceUploaded: number;
  totalEvidenceFailed: number;
  totalMBUploaded: number;
}

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

async function apiPost(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data, error: res.ok ? undefined : JSON.stringify(data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, data: null, error: msg };
  }
}

async function apiGet(
  baseUrl: string,
  path: string,
  token: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

// ---------------------------------------------------------------------------
// Upload Logic
// ---------------------------------------------------------------------------

async function uploadCase(
  manifest: ManifestCase,
  apiUrl: string,
  token: string,
  dryRun: boolean,
): Promise<UploadStats> {
  const stats: UploadStats = {
    caseId: manifest.caseId,
    caseName: manifest.caseName,
    evidenceUploaded: 0,
    evidenceFailed: 0,
    totalMB: 0,
    startTime: Date.now(),
    errors: [],
  };

  console.log(`\n[Upload] Starting case: ${manifest.caseName}`);
  console.log(`  Evidence items: ${manifest.evidenceCount}`);
  console.log(`  Total size: ${manifest.totalSizeGB} GB`);
  console.log(`  Tenant: ${manifest.tenantId}`);

  // Step 1: Create the case via API
  if (!dryRun) {
    const createRes = await apiPost(apiUrl, '/api/cases', {
      name: manifest.caseName,
      description: `Stress test case — ${manifest.totalSizeGB} GB of evidence`,
      caseNumber: `STRESS-${Date.now()}`,
    }, token);

    if (!createRes.ok) {
      console.error(`  [FAIL] Could not create case: ${createRes.error}`);
      stats.errors.push(`Case creation failed: ${createRes.error}`);
      stats.endTime = Date.now();
      stats.durationMs = stats.endTime - stats.startTime;
      return stats;
    }
    console.log(`  [OK] Case created`);
  }

  // Step 2: Upload evidence items with small delays (simulating attorney uploads)
  for (let i = 0; i < manifest.evidence.length; i++) {
    const item = manifest.evidence[i];
    const progress = `[${i + 1}/${manifest.evidence.length}]`;

    if (dryRun) {
      console.log(`  ${progress} [DRY-RUN] Would upload: ${item.fileName} (${item.sizeMB} MB, ${item.category})`);
      stats.evidenceUploaded++;
      stats.totalMB += item.sizeMB;
      continue;
    }

    try {
      // Step 2a: Request presigned upload URL
      const uploadUrlRes = await apiPost(apiUrl, '/api/evidence/upload-url', {
        fileName: item.fileName,
        mimeType: item.mimeType,
        fileSize: item.sizeBytes,
      }, token);

      if (!uploadUrlRes.ok) {
        console.error(`  ${progress} [FAIL] Upload URL request failed: ${uploadUrlRes.error}`);
        stats.evidenceFailed++;
        stats.errors.push(`${item.fileName}: upload-url failed — ${uploadUrlRes.error}`);
        continue;
      }

      // Step 2b: Register the evidence record
      const registerRes = await apiPost(apiUrl, '/api/evidence', {
        caseId: manifest.caseId,
        fileName: item.fileName,
        mimeType: item.mimeType,
        fileSize: item.sizeBytes,
        fileKey: `stress-test/${manifest.tenantId}/${crypto.randomUUID()}/${item.fileName}`,
        description: item.description,
      }, token);

      if (!registerRes.ok) {
        console.error(`  ${progress} [FAIL] Evidence register failed: ${registerRes.error}`);
        stats.evidenceFailed++;
        stats.errors.push(`${item.fileName}: register failed — ${registerRes.error}`);
        continue;
      }

      stats.evidenceUploaded++;
      stats.totalMB += item.sizeMB;

      if (i % 10 === 0) {
        console.log(`  ${progress} Uploaded: ${item.fileName} (${item.sizeMB} MB)`);
      }

      // Small delay between uploads (100-500ms) to simulate real typing/clicking
      await sleep(100 + Math.random() * 400);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stats.evidenceFailed++;
      stats.errors.push(`${item.fileName}: ${msg}`);
    }
  }

  stats.endTime = Date.now();
  stats.durationMs = stats.endTime - stats.startTime;

  console.log(`\n  [DONE] Case ${manifest.caseName}:`);
  console.log(`    Uploaded: ${stats.evidenceUploaded}/${manifest.evidenceCount}`);
  console.log(`    Failed: ${stats.evidenceFailed}`);
  console.log(`    Total: ${Math.round(stats.totalMB)} MB`);
  console.log(`    Duration: ${Math.round((stats.durationMs) / 1000)}s`);

  return stats;
}

// ---------------------------------------------------------------------------
// Metrics Snapshot
// ---------------------------------------------------------------------------

async function captureMetrics(apiUrl: string, token: string): Promise<void> {
  console.log('\n[Metrics] Capturing health and queue status...');

  // Health check
  const health = await apiGet(apiUrl, '/api/health', token);
  console.log(`  /api/health: ${health.ok ? 'OK' : 'FAIL'} (${health.status})`);

  // Deep health
  const deepHealth = await apiGet(apiUrl, '/api/health/deep', token);
  if (deepHealth.ok) {
    const data = deepHealth.data as Record<string, unknown>;
    console.log(`  /api/health/deep: status=${data.status}`);
  }

  // Metrics JSON
  const metrics = await apiGet(apiUrl, '/api/metrics/json', token);
  if (metrics.ok) {
    const data = metrics.data as Record<string, unknown>;
    console.log(`  /api/metrics/json: ${JSON.stringify(data).slice(0, 200)}...`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);

  const manifestIdx = args.indexOf('--manifest');
  const staggerIdx = args.indexOf('--stagger');
  const apiUrlIdx = args.indexOf('--api-url');
  const tokenIdx = args.indexOf('--token');
  const dryRun = args.includes('--dry-run');
  const soak = args.includes('--soak');

  const manifestPath = manifestIdx >= 0 ? args[manifestIdx + 1] : '';
  const staggerSeconds = staggerIdx >= 0 ? parseInt(args[staggerIdx + 1], 10) : 600;
  const apiUrl = apiUrlIdx >= 0 ? args[apiUrlIdx + 1] : 'http://localhost:3001';
  const token = tokenIdx >= 0 ? args[tokenIdx + 1] : process.env.STRESS_TEST_TOKEN || '';

  if (!manifestPath || !fs.existsSync(manifestPath)) {
    console.error('Usage: npx tsx backend/scripts/stress-upload-simulator.ts --manifest <path>');
    console.error('  --stagger <seconds>  Delay between case uploads (default: 600)');
    console.error('  --api-url <url>      Backend URL (default: http://localhost:3001)');
    console.error('  --token <jwt>        Auth token');
    console.error('  --dry-run            Simulate without API calls');
    console.error('  --soak               Continuous mode for Level 3');
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  console.log('========================================');
  console.log(`Stress Upload Simulator — Level ${manifest.level}`);
  console.log('========================================');
  console.log(`Cases: ${manifest.cases.length}`);
  console.log(`Total evidence: ${manifest.totalEvidenceCount}`);
  console.log(`Total size: ${manifest.totalSizeGB} GB`);
  console.log(`Stagger: ${staggerSeconds}s between cases`);
  console.log(`API: ${apiUrl}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Soak: ${soak}`);
  console.log('');

  const report: RunReport = {
    level: manifest.level,
    startedAt: new Date().toISOString(),
    caseStats: [],
    totalEvidenceUploaded: 0,
    totalEvidenceFailed: 0,
    totalMBUploaded: 0,
  };

  // Verify API is reachable
  if (!dryRun) {
    const healthCheck = await apiGet(apiUrl, '/api/health', token);
    if (!healthCheck.ok) {
      console.error(`[FATAL] API not reachable at ${apiUrl}/api/health (status: ${healthCheck.status})`);
      process.exit(1);
    }
    console.log('[OK] API is reachable\n');
  }

  const runOnce = async () => {
    for (let i = 0; i < manifest.cases.length; i++) {
      const caseManifest = manifest.cases[i];

      // Capture metrics before each case
      if (!dryRun) {
        await captureMetrics(apiUrl, token);
      }

      const stats = await uploadCase(caseManifest, apiUrl, token, dryRun);
      report.caseStats.push(stats);
      report.totalEvidenceUploaded += stats.evidenceUploaded;
      report.totalEvidenceFailed += stats.evidenceFailed;
      report.totalMBUploaded += stats.totalMB;

      // Stagger between cases
      if (i < manifest.cases.length - 1) {
        console.log(`\n[Stagger] Waiting ${staggerSeconds}s before next case...`);
        await sleep(staggerSeconds * 1000);
      }
    }

    // Final metrics capture
    if (!dryRun) {
      await captureMetrics(apiUrl, token);
    }
  };

  if (soak) {
    // Soak mode: loop continuously
    let iteration = 0;
    const soakStartTime = Date.now();
    const SOAK_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours

    while (Date.now() - soakStartTime < SOAK_DURATION_MS) {
      iteration++;
      console.log(`\n\n${'='.repeat(60)}`);
      console.log(`SOAK ITERATION ${iteration} — ${new Date().toISOString()}`);
      console.log(`Elapsed: ${Math.round((Date.now() - soakStartTime) / 1000 / 60)} minutes`);
      console.log(`${'='.repeat(60)}`);
      await runOnce();
      console.log(`\n[Soak] Iteration ${iteration} complete. Waiting 60s before next...`);
      await sleep(60_000);
    }
  } else {
    await runOnce();
  }

  report.completedAt = new Date().toISOString();
  report.totalDurationMs = new Date(report.completedAt).getTime() - new Date(report.startedAt).getTime();

  // Write report
  const reportDir = 'stress-data';
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = `${reportDir}/upload-report-level${manifest.level}-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n========================================');
  console.log('Upload Simulation Complete');
  console.log('========================================');
  console.log(`Level: ${manifest.level}`);
  console.log(`Duration: ${Math.round((report.totalDurationMs) / 1000)}s`);
  console.log(`Evidence uploaded: ${report.totalEvidenceUploaded}`);
  console.log(`Evidence failed: ${report.totalEvidenceFailed}`);
  console.log(`Total MB: ${Math.round(report.totalMBUploaded)}`);
  console.log(`Report: ${reportPath}`);

  if (report.totalEvidenceFailed > 0) {
    console.log('\n[ERRORS]');
    for (const cs of report.caseStats) {
      for (const err of cs.errors) {
        console.log(`  - ${err}`);
      }
    }
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
