#!/usr/bin/env tsx
/**
 * Continuous Operational Validation — record today's manual ground truth.
 *
 * Do not wait for the historical 08/09→08/10 benchmark. Every morning:
 *   1. NIIS produces the Operational New Inmate Report (PDF compare).
 *   2. Administrator completes the manual comparison.
 *   3. This script diffs NIIS vs the manual list → Engineering Certification
 *      Report + Learning Queue items (defects).
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/record-daily-ground-truth.ts \
 *     --date 2026-08-11 \
 *     --gold /path/to/manual-new-inmates.md \
 *     [--facility sacramento]
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import prisma from '../src/lib/prisma.js';
import { getNewInmates } from '../src/intelligence/inmates/repository.js';
import { recordEngineeringCertification } from '../src/intelligence/inmates/engineeringCertification.js';
import { consecutivePassStreak } from '../src/intelligence/inmates/learningQueue.js';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function normalizeName(name: string): string {
  return name.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

function loadGold(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\d+\.\s*/, '').trim())
    .filter((l) => l && !l.startsWith('#') && l.includes(','))
    .map(normalizeName);
}

function nextDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function priorDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const started = Date.now();
  const facility = arg('facility', 'sacramento')!;
  const opsDate = arg('date');
  const goldPath = arg('gold');
  if (!opsDate || !goldPath) {
    console.error('Usage: record-daily-ground-truth.ts --date YYYY-MM-DD --gold <file> [--facility sacramento]');
    process.exit(2);
  }
  if (!existsSync(goldPath)) {
    console.error(`Gold list not found: ${goldPath}`);
    process.exit(2);
  }

  const gold = loadGold(goldPath);
  const goldSet = new Set(gold);
  const to = nextDate(opsDate);
  const prior = priorDate(opsDate);

  const reported = await getNewInmates({
    facility,
    from: opsDate,
    to,
    limit: 5000,
    offset: 0,
  });
  const niisNames = reported.results.map((r) => normalizeName(r.name));
  const niisSet = new Set(niisNames);

  const tp = gold.filter((n) => niisSet.has(n));
  const fn = gold.filter((n) => !niisSet.has(n));
  const fp = niisNames.filter((n) => !goldSet.has(n));
  const precision = tp.length + fp.length === 0 ? 0 : tp.length / (tp.length + fp.length);
  const recall = tp.length + fn.length === 0 ? 0 : tp.length / (tp.length + fn.length);
  const pass = fn.length === 0 && fp.length === 0 && gold.length > 0;

  const reportDir = resolve(import.meta.dirname, '../../reports/niis-reliability');
  mkdirSync(reportDir, { recursive: true });

  // Preserve this day's gold list into the continuous regression tree.
  const dayDir = resolve(import.meta.dirname, `../../fixtures/sacramento/validation/days/${opsDate}`);
  mkdirSync(dayDir, { recursive: true });
  writeFileSync(join(dayDir, 'ground-truth-new.md'), readFileSync(goldPath));

  const cert = await recordEngineeringCertification({
    facility,
    priorDate: prior,
    currentDate: opsDate,
    priorInmateCount: null,
    currentInmateCount: null,
    newInmates: niisNames.length,
    existingInmates: null,
    returningInmates: null,
    reviewRequired: null,
    reconcileOk: null,
    precision,
    recall,
    potentialClientsFound: tp.length,
    potentialClientsMissed: fn.length,
    processingTimeMs: Date.now() - started,
    status: pass ? 'pass' : 'fail',
    misses: fn.map((name) => ({
      name,
      stage: 'Report generation',
      rule: 'manual ground truth vs getNewInmates',
      evidence: 'Absent from NIIS new-inmate report for ops date',
      why: 'Engineering defect — entered Learning Queue',
    })),
    extras: fp.map((name) => ({
      name,
      stage: 'Report generation',
      rule: 'manual ground truth vs getNewInmates',
      evidence: 'Present in NIIS report but not in manual list',
      why: 'Engineering defect — entered Learning Queue',
    })),
    reportDir,
  });

  writeFileSync(
    join(dayDir, 'niis-certification.json'),
    JSON.stringify({
      opsDate,
      prior,
      pass,
      goldCount: gold.length,
      niisCount: niisNames.length,
      tp: tp.length,
      fp: fp.length,
      fn: fn.length,
      precision,
      recall,
      certificationId: cert.certificationId,
    }, null, 2),
  );

  const streak = await consecutivePassStreak(facility);

  console.log(`Ops date: ${opsDate}`);
  console.log(`Gold (manual): ${gold.length}  NIIS: ${niisNames.length}`);
  console.log(`TP=${tp.length} FP=${fp.length} FN=${fn.length}`);
  console.log(`Precision=${(precision * 100).toFixed(1)}% Recall=${(recall * 100).toFixed(1)}%`);
  console.log(`Potential New Clients Found=${tp.length} Missed=${fn.length}`);
  console.log(`Status: ${pass ? 'PASS' : 'FAIL'}  certificationId=${cert.certificationId}`);
  console.log(`Consecutive PASS streak: ${streak.streak}/${streak.required}  productionReady=${streak.productionReady}`);
  console.log(`Day folder: ${dayDir}`);

  await prisma.$disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
