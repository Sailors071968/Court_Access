#!/usr/bin/env tsx
// CourtAccess Master Production Program — generate canonical roadmap report

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessMasterProductionProgram } from '../src/productionGates/masterProductionProgram.ts';

const reportsDir = resolve(import.meta.dirname ?? '.', '../../reports');

function toMarkdown(report: Awaited<ReturnType<typeof assessMasterProductionProgram>>): string {
  const lines = [
    '# CourtAccess Master Production Program',
    '',
    `**Version:** ${report.version}`,
    `**Generated:** ${report.generatedAt}`,
    `**Status:** ${report.overallStatus}`,
    `**Completion:** ${report.overallCompletionPercent}% (${report.capabilitiesComplete}/${report.capabilitiesTotal} capabilities)`,
    '',
    '## Mission',
    '',
    report.mission,
    '',
    '## Release Gates',
    '',
    `| Framework | Pass | Status |`,
    `|-----------|------|--------|`,
    `| Legacy (PG-001–015) | ${report.releaseGates.legacy.pass}/${report.releaseGates.legacy.total} | ${report.releaseGates.legacy.status} |`,
    `| Version 1.0 (PG-001–020) | ${report.releaseGates.version1.pass}/${report.releaseGates.version1.total} | ${report.releaseGates.version1.status} |`,
    '',
    '## Critical Workflows',
    '',
    '| Workflow | Status |',
    '|----------|--------|',
    ...report.criticalWorkflows.map((w) => `| ${w.name} | ${w.status} |`),
    '',
    '## Phase Summary',
    '',
    '| Phase | Domain | Status | Completion |',
    '|-------|--------|--------|------------|',
    ...report.phases.map((p) => `| ${p.number}. ${p.name} | ${p.domain} | ${p.status} | ${p.completionPercent}% |`),
    '',
  ];

  if (report.topBlockers.length) {
    lines.push('## Top Blockers', '', ...report.topBlockers.map((b) => `- ${b}`), '');
  }

  lines.push('## Phase Detail', '');
  for (const p of report.phases) {
    lines.push(`### Phase ${p.number} — ${p.name} (${p.status}, ${p.completionPercent}%)`, '');
    for (const c of p.capabilities) {
      lines.push(`- [${c.status === 'PASS' ? 'x' : ' '}] ${c.name}${c.blocker ? ` — *${c.blocker}*` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const report = await assessMasterProductionProgram();

  const backlog = {
    program: 'COURTACCESS_MASTER_PRODUCTION_PROGRAM',
    version: report.version,
    updatedAt: report.generatedAt,
    overallStatus: report.overallStatus,
    completionPercent: report.overallCompletionPercent,
    phasesComplete: report.phasesComplete,
    phasesPartial: report.phasesPartial,
    phasesTotal: report.phasesTotal,
    releaseGates: report.releaseGates,
    items: report.nextRecommendedTasks.map((t, i) => ({
      id: `MPP-${String(i + 1).padStart(3, '0')}`,
      priority: t.priority,
      title: t.task,
      status: 'pending',
    })),
    completedPhases: report.phases.filter((p) => p.status === 'COMPLETE').map((p) => p.id),
    partialPhases: report.phases.filter((p) => p.status === 'PARTIAL').map((p) => ({ id: p.id, percent: p.completionPercent })),
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(resolve(reportsDir, 'MASTER_PRODUCTION_PROGRAM.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(reportsDir, 'MASTER_PRODUCTION_PROGRAM.md'), toMarkdown(report));
  await writeFile(resolve(reportsDir, 'PRODUCTION_BACKLOG.json'), JSON.stringify(backlog, null, 2));

  console.log(`Master Production Program: ${report.overallStatus}`);
  console.log(`Completion: ${report.overallCompletionPercent}% (${report.phasesComplete} complete, ${report.phasesPartial} partial, ${report.phasesNotStarted} not started)`);
  console.log(`Capabilities: ${report.capabilitiesComplete}/${report.capabilitiesTotal}`);
  console.log(`JSON: ${resolve(reportsDir, 'MASTER_PRODUCTION_PROGRAM.json')}`);
  console.log(`Markdown: ${resolve(reportsDir, 'MASTER_PRODUCTION_PROGRAM.md')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
