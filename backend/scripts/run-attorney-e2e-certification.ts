#!/usr/bin/env tsx
/**
 * Blocker 2 — Attorney end-to-end certification workflow runner.
 * Records per-step PASS/FAIL/UNKNOWN with evidence IDs when API+DB available.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outPath = resolve(root, '../reports/ATTORNEY_E2E_CERTIFICATION.json');

const BASE_URL = process.env.CERT_BASE_URL ?? process.env.API_BASE_URL ?? '';
const HAS_DB = Boolean(process.env.DATABASE_URL);

type StepResult = 'PASS' | 'FAIL' | 'UNKNOWN' | 'SKIP';

interface WorkflowStep {
  step: string;
  result: StepResult;
  api: StepResult;
  worker: StepResult;
  queue: StepResult;
  database: StepResult;
  evidenceIds: string[];
  executionTimeMs: number | null;
  warnings: string[];
}

const WORKFLOW_STEPS = [
  'Attorney Login',
  'Create Case',
  'Upload Discovery',
  'OCR',
  'Evidence Extraction',
  'Knowledge Graph',
  'Timeline',
  'Charges',
  'Contradictions',
  'Attorney Report',
  'PDF Export',
  'Word Export',
  'Case Dashboard',
  'Logout',
] as const;

async function probeHealth(): Promise<boolean> {
  if (!BASE_URL) return false;
  try {
    const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

function unknownStep(step: string, reason: string): WorkflowStep {
  return {
    step,
    result: 'UNKNOWN',
    api: 'UNKNOWN',
    worker: 'UNKNOWN',
    queue: 'UNKNOWN',
    database: HAS_DB ? 'UNKNOWN' : 'SKIP',
    evidenceIds: [],
    executionTimeMs: null,
    warnings: [reason],
  };
}

async function main() {
  const apiUp = await probeHealth();
  const steps: WorkflowStep[] = [];

  for (const step of WORKFLOW_STEPS) {
    if (!BASE_URL || !apiUp) {
      steps.push(
        unknownStep(
          step,
          !BASE_URL
            ? 'CERT_BASE_URL not set — run on deployed V1 stack (e.g. http://127.0.0.1:3101)'
            : 'API health check failed',
        ),
      );
      continue;
    }
    // Full E2E automation requires seeded credentials and case fixtures — not yet implemented
    steps.push(unknownStep(step, 'E2E automation pending — manual certification required on EC2 V1 stack'));
  }

  const passCount = steps.filter((s) => s.result === 'PASS').length;
  const failCount = steps.filter((s) => s.result === 'FAIL').length;
  const unknownCount = steps.filter((s) => s.result === 'UNKNOWN').length;

  const report = {
    blocker: 'BLOCKER-2-ATTORNEY-E2E',
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL || null,
    databaseConfigured: HAS_DB,
    overallResult: passCount === steps.length ? 'PASS' : failCount > 0 ? 'FAIL' : 'UNKNOWN',
    summary: { pass: passCount, fail: failCount, unknown: unknownCount, total: steps.length },
    steps,
    evidence: [
      'backend/src/intelligence/reportGenerator.ts',
      'backend/src/workbench/exportService.ts',
      'backend/src/evidence/evidenceDirectUpload.ts',
    ],
    nextAction:
      'On EC2 after Phase 2 verify PASS: CERT_BASE_URL=http://127.0.0.1:3101 DATABASE_URL=... tsx scripts/run-attorney-e2e-certification.ts',
  };

  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ overallResult: report.overallResult, summary: report.summary }, null, 2));
  process.exit(report.overallResult === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
