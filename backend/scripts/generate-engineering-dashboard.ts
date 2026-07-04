#!/usr/bin/env tsx
// Writes Mission 8 engineering dashboard to reports/ENGINEERING_DASHBOARD.json

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { generateEngineeringDashboard } from '../src/legislative/engineeringDashboard.ts';

const outputPath = resolve(import.meta.dirname ?? '.', '../../reports/ENGINEERING_DASHBOARD.json');

async function main() {
  const dashboard = await generateEngineeringDashboard();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(dashboard, null, 2), 'utf-8');
  console.log(`Engineering dashboard written to ${outputPath}`);
  console.log(JSON.stringify(dashboard, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
