#!/usr/bin/env tsx
// Epic H — Generate Repository Integrity Dashboard report

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { generateRepositoryIntegrityDashboard } from '../src/legislative/repositoryIntegrityDashboard.ts';

const outputPath = resolve(import.meta.dirname ?? '.', '../../reports/REPOSITORY_INTEGRITY.json');

async function main() {
  const dashboard = await generateRepositoryIntegrityDashboard();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(dashboard, null, 2), 'utf-8');
  console.log(`Repository Integrity: ${dashboard.overallIntegrity} (${dashboard.overallCompletionPercent}% completion)`);
  console.log(`Repositories: ${dashboard.knowledgeGraph.repositoriesHealthy}/${dashboard.knowledgeGraph.repositoriesTotal} healthy`);
  console.log(`Report: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
