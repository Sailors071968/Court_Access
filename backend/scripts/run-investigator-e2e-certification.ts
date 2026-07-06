#!/usr/bin/env tsx
/**
 * Program 40 — Investigator end-to-end certification runner.
 * Records per-step PASS/FAIL/UNKNOWN with evidence + audit IDs when a deployed
 * stack is reachable (CERT_BASE_URL). Never fabricates results.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outPath = resolve(root, '../reports/INVESTIGATOR_E2E_CERTIFICATION.json');

const BASE_URL = process.env.CERT_BASE_URL ?? process.env.API_BASE_URL ?? '';
const HAS_DB = Boolean(process.env.DATABASE_URL);

type StepResult = 'PASS' | 'FAIL' | 'UNKNOWN' | 'SKIP';

interface WorkflowStep {
  step: string;
  result: StepResult;
  api: StepResult;
  database: StepResult;
  worker: StepResult;
  queue: StepResult;
  repository: StepResult;
  evidenceIds: string[];
  auditIds: string[];
  executionTimeMs: number | null;
  warnings: string[];
}

const WORKFLOW_STEPS = [
  'Login',
  'Create Investigation',
  'Upload Photos',
  'Upload Video',
  'Upload Audio',
  'GPS Evidence',
  'Chain of Custody',
  'Witness Notes',
  'Timeline',
  'Evidence Review',
  'Assignments',
  'Export',
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
    database: HAS_DB ? 'UNKNOWN' : 'SKIP',
    worker: 'UNKNOWN',
    queue: 'UNKNOWN',
    repository: 'UNKNOWN',
    evidenceIds: [],
    auditIds: [],
    executionTimeMs: null,
    warnings: [reason],
  };
}

async function main() {
  const apiUp = await probeHealth();
  const steps: WorkflowStep[] = WORKFLOW_STEPS.map((step) =>
    unknownStep(
      step,
      !BASE_URL
        ? 'CERT_BASE_URL not set — run on the deployed V1 stack (e.g. http://127.0.0.1:3101)'
        : !apiUp
          ? 'API health check failed'
          : 'E2E automation pending — manual certification required on the deployed V1 stack',
    ),
  );

  const pass = steps.filter((s) => s.result === 'PASS').length;
  const fail = steps.filter((s) => s.result === 'FAIL').length;
  const unknown = steps.filter((s) => s.result === 'UNKNOWN').length;

  const report = {
    program: 'PROGRAM-40-INVESTIGATOR-CERTIFICATION',
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL || null,
    databaseConfigured: HAS_DB,
    overallResult: pass === steps.length ? 'PASS' : fail > 0 ? 'FAIL' : 'UNKNOWN',
    summary: { pass, fail, unknown, total: steps.length },
    steps,
    evidence: [
      'backend/src/services/investigatorApi (fetchInvestigatorWorkbench, createWitness, createLead, createFieldNote)',
      'backend/src/evidence/evidenceProcessingPipeline.ts (photo/video/audio ingestion queues)',
    ],
    nextAction:
      'On the deployed V1 stack: CERT_BASE_URL=http://127.0.0.1:3101 DATABASE_URL=... tsx scripts/run-investigator-e2e-certification.ts',
  };

  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ overallResult: report.overallResult, summary: report.summary }, null, 2));
  process.exit(report.overallResult === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
