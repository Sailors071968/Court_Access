#!/usr/bin/env tsx
// Writes objective production metrics to reports/PRODUCTION_METRICS.json

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { collectProductionMetrics } from '../src/legislative/productionMetrics.ts';

const outputPath = resolve(import.meta.dirname ?? '.', '../../reports/PRODUCTION_METRICS.json');

async function main() {
  const metrics = await collectProductionMetrics();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(metrics, null, 2), 'utf-8');
  console.log(`Production metrics written to ${outputPath}`);
  console.log(JSON.stringify(metrics, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
