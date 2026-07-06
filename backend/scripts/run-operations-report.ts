#!/usr/bin/env tsx
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { buildOperationsDashboard } from '../src/productionOperations/operationsDashboard.ts';
import { buildChangeManagementReport } from '../src/productionOperations/changeManagement.ts';
import { buildBackupOperationsReport } from '../src/productionOperations/backupOperations.ts';

const jsonPath = resolve(import.meta.dirname ?? '.', '../../reports/OPERATIONS_DASHBOARD.json');
const mdPath = resolve(import.meta.dirname ?? '.', '../../reports/OPERATIONS_DASHBOARD.md');

function toMarkdown(dashboard: Awaited<ReturnType<typeof buildOperationsDashboard>>): string {
  const lines = [
    '# Program 21 — Production Operations Dashboard',
    '',
    `**Generated:** ${dashboard.generatedAt}`,
    `**Overall Status:** ${dashboard.overallStatus}`,
    `**Deployment Blocked:** ${dashboard.productionGates.deploymentBlocked ? 'YES' : 'NO'}`,
    '',
    '## Component Health',
    '',
    '| Component | Status | Message |',
    '|-----------|--------|---------|',
  ];

  const componentRows = [
    ['System', dashboard.systemHealth],
    ['API', dashboard.apiHealth],
    ['Database', dashboard.database],
    ['Redis', dashboard.redis],
    ['Queues', dashboard.queues],
    ['OCR Workers', dashboard.ocrWorkers],
    ['AI Workers', dashboard.aiWorkers],
    ['Legislative Pipeline', dashboard.legislativePipeline],
    ['Knowledge Graph', dashboard.knowledgeGraph],
    ['Repository Integrity', dashboard.repositoryIntegrity],
    ['Stripe', dashboard.stripeHealth],
    ['Email', dashboard.emailHealth],
    ['Storage', dashboard.storage],
  ] as const;

  for (const [name, c] of componentRows) {
    lines.push(`| ${name} | ${c.status} | ${c.message ?? ''} |`);
  }

  if (dashboard.alerts.length) {
    lines.push('', '## Active Alerts', '');
    dashboard.alerts.forEach((a) => lines.push(`- **[${a.severity}]** ${a.category}: ${a.message}`));
  }

  lines.push('', '## Observability', '');
  lines.push(`- Production gates coverage: ${dashboard.observability.productionGatesCoverage}%`);
  lines.push(`- Legislative coverage: ${dashboard.observability.legislativeCoveragePercent}%`);
  lines.push(`- Attorney workflow coverage: ${dashboard.observability.attorneyWorkflowCoveragePercent}%`);

  return lines.join('\n');
}

async function main() {
  const [dashboard, changes, backup] = await Promise.all([
    buildOperationsDashboard(),
    buildChangeManagementReport(),
    buildBackupOperationsReport(),
  ]);

  const report = { dashboard, changes, backup };
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  await writeFile(mdPath, toMarkdown(dashboard), 'utf-8');
  console.log(`Operations: ${dashboard.overallStatus} (${dashboard.alerts.length} alerts)`);
  console.log(`JSON: ${jsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
