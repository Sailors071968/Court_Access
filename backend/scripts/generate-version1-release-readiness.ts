#!/usr/bin/env tsx
// Sprint 20 — Version 1.0 Release Readiness Report

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { runMasterProductionAssessment } from '../src/productionGates/masterProductionAssessment.ts';

const reportsDir = resolve(import.meta.dirname ?? '.', '../../reports');

async function loadJson<T>(name: string): Promise<T | null> {
  try {
    const raw = await readFile(resolve(reportsDir, name), 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toMarkdown(report: Awaited<ReturnType<typeof runMasterProductionAssessment>>, backlog: { items: Array<{ rank: number; title: string; blocker?: string }> }): string {
  const notReady = report.programs.filter((p) => p.productionReadiness !== 'READY');
  return [
    '# CourtAccess Version 1.0 Release Readiness',
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Overall Completion:** ${report.summary.overallCompletionPercent}%`,
    `**Verified:** ${report.summary.verifiedCapabilities}/${report.summary.totalCapabilities}`,
    `**Production Readiness:** ${report.summary.productionReadiness}`,
    '',
    '## Programs Not READY',
    '',
    '| Program | Completion | Blocked |',
    '|---------|------------|---------|',
    ...notReady.map((p) => `| ${p.name} | ${p.completionPercent}% | ${p.blocked} |`),
    '',
    '## Critical Blockers (Top 15)',
    '',
    ...backlog.items.slice(0, 15).map((i) => `${i.rank}. **${i.title}** — ${i.blocker ?? 'Incomplete'}`),
    '',
    '## Recommended Implementation Order',
    '',
    '1. Resource permission enforcement (Programs 1, 4)',
    '2. Document redaction + disclosure UI (Programs 5, 6)',
    '3. Client portal + membership E2E (Programs 14, 6)',
    '4. Stripe live certification (Program 2)',
    '5. E2E demonstrations + documentation (Programs 23, 24, 22)',
    '6. Attorney/Investigator workbench completion (Programs 12, 13)',
    '7. Admin command center (Program 15)',
    '8. California legal intelligence expansion (Programs 16, 17)',
    '',
    '## Remaining Risks',
    '',
    `- ${report.summary.blockedCapabilities} capabilities explicitly blocked`,
    `- ${notReady.length} programs not at READY`,
    '- Stripe live env and DB migrations required for full gate PASS',
    '- Load/stress testing not yet implemented',
    '',
    '## Regenerate',
    '',
    '```bash',
    'cd backend && npm run master:assessment && npm run v1:readiness',
    '```',
    '',
  ].join('\n');
}

async function main() {
  const assessment = await runMasterProductionAssessment();
  const backlog = (await loadJson<{ items: Array<{ rank: number; title: string; blocker?: string; productionImpact: string }> }>('TOP_100_BACKLOG.json')) ?? { items: [] };
  const gates = await loadJson<{ overallResult?: string; deploymentBlocked?: boolean }>('PRODUCTION_GATES.json');

  const report = {
    assessment: 'VERSION_1_RELEASE_READINESS',
    version: '1.0',
    generatedAt: assessment.generatedAt,
    currentCompletion: assessment.summary.overallCompletionPercent,
    verifiedCapabilities: assessment.summary.verifiedCapabilities,
    totalCapabilities: assessment.summary.totalCapabilities,
    productionReadiness: assessment.summary.productionReadiness,
    productionGates: gates?.overallResult ?? 'UNKNOWN',
    deploymentBlocked: gates?.deploymentBlocked ?? true,
    programsReady: assessment.programs.filter((p) => p.productionReadiness === 'READY').length,
    programsPartial: assessment.programs.filter((p) => p.productionReadiness === 'PARTIAL').length,
    programsNotReady: assessment.programs.filter((p) => p.productionReadiness === 'NOT_READY').length,
    criticalBlockers: backlog.items.filter((i) => i.productionImpact === 'critical').slice(0, 20),
    topBacklog: backlog.items.slice(0, 25),
    remainingRisks: [
      'Stripe live certification pending',
      'E2E demonstrations not recorded',
      'Load/stress testing not implemented',
      'SMS communications not implemented',
    ],
    recommendedOrder: [
      'Resource permissions',
      'Redaction + disclosure',
      'Client portal + membership',
      'Stripe certification',
      'E2E demos',
      'Workbench completion',
      'Admin command center',
      'Legal intelligence expansion',
    ],
    programSummary: assessment.programs.map((p) => ({
      id: p.id,
      name: p.name,
      completionPercent: p.completionPercent,
      productionReadiness: p.productionReadiness,
      blocked: p.blocked,
    })),
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(resolve(reportsDir, 'VERSION_1_RELEASE_READINESS.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(reportsDir, 'VERSION_1_RELEASE_READINESS.md'), toMarkdown(assessment, backlog));

  // Refresh canonical assessment artifacts
  await writeFile(resolve(reportsDir, 'MASTER_PRODUCTION_ASSESSMENT.json'), JSON.stringify(assessment, null, 2));

  console.log(`Release Readiness: ${report.productionReadiness} (${report.currentCompletion}%)`);
  console.log(`Programs READY: ${report.programsReady}/25`);
  console.log(`Wrote ${resolve(reportsDir, 'VERSION_1_RELEASE_READINESS.json')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
