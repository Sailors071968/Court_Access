#!/usr/bin/env tsx
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { collectBillingReadinessMetrics } from '../src/billing/billingMetricsService.ts';

const outputPath = resolve(import.meta.dirname ?? '.', '../../reports/stripe/BILLING_READINESS.json');

async function main() {
  const metrics = await collectBillingReadinessMetrics();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(metrics, null, 2), 'utf-8');
  console.log(`Billing readiness written to ${outputPath}`);
  console.log(JSON.stringify(metrics, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
