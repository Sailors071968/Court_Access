#!/usr/bin/env tsx
// Program 1 — Generate PRODUCTION_GATES report artifacts

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { runProductionGates } from '../src/productionGates/runProductionGates.ts';
import type { ProductionGatesReport } from '../src/productionGates/types.ts';

const jsonPath = resolve(import.meta.dirname ?? '.', '../../reports/PRODUCTION_GATES.json');
const mdPath = resolve(import.meta.dirname ?? '.', '../../reports/PRODUCTION_GATES.md');

function toMarkdown(report: ProductionGatesReport): string {
  const lines = [
    '# Production Gates Report — Master Production Program v4.0',
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Overall:** ${report.overallResult} (${report.passCount} PASS / ${report.failCount} FAIL / ${report.partialCount} PARTIAL / ${report.skipCount} SKIP)`,
    `**Deployment Blocked:** ${report.deploymentBlocked ? 'YES' : 'NO'}`,
    '',
    '## Gate Summary',
    '',
    '| Gate | Name | Result | Checks |',
    '|------|------|--------|--------|',
  ];

  for (const g of report.gates) {
    lines.push(`| ${g.id} | ${g.name} | ${g.result} | ${g.checks.pass}/${g.checks.total} |`);
  }

  if (report.blockers.length) {
    lines.push('', '## Blockers', '');
    report.blockers.forEach((b) => lines.push(`- ${b}`));
  }

  lines.push('', '## Detailed Results', '');
  for (const g of report.gates) {
    lines.push(`### ${g.id} — ${g.name} — ${g.result}`, '');
    lines.push('**Test steps:**');
    g.testSteps.forEach((s) => lines.push(`- ${s}`));
    if (g.evidence.length) {
      lines.push('', '**Evidence:**', ...g.evidence.map((e) => `- ${e}`));
    }
    if (g.blockers.length) {
      lines.push('', '**Blockers:**', ...g.blockers.map((b) => `- ${b}`));
    }
    lines.push('', `**Recovery:** ${g.recoveryBehavior}`, '');
  }

  return lines.join('\n');
}

async function main() {
  const report = await runProductionGates();
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  await writeFile(mdPath, toMarkdown(report), 'utf-8');
  console.log(`Production Gates: ${report.overallResult} (${report.passCount}/${report.gates.length} PASS)`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (report.deploymentBlocked) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
