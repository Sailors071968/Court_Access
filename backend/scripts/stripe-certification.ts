#!/usr/bin/env tsx
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { runStripeProductionCertification } from '../src/billing/stripeCertification.ts';

const jsonPath = resolve(import.meta.dirname ?? '.', '../../reports/stripe/PRODUCTION_CERTIFICATION.json');
const mdPath = resolve(import.meta.dirname ?? '.', '../../reports/stripe/PRODUCTION_CERTIFICATION.md');

function toMarkdown(report: Awaited<ReturnType<typeof runStripeProductionCertification>>): string {
  const lines = [
    '# Epic 1A-FINAL — Stripe Production Certification Report',
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Overall:** ${report.overallResult} (${report.passCount} PASS / ${report.failCount} FAIL / ${report.skipCount} SKIP)`,
    `**Stripe Test Mode (live API):** ${report.stripeTestMode ? 'Yes' : 'No (simulated webhooks only)'}`,
    '',
    '## Workflow Results',
    '',
    '| Workflow | Result | Mode |',
    '|----------|--------|------|',
  ];

  for (const w of report.workflows) {
    lines.push(`| ${w.workflow} | ${w.result} | ${w.mode} |`);
  }

  lines.push('', '## Detailed Results', '');
  for (const w of report.workflows) {
    lines.push(`### ${w.workflow} — ${w.result}`, '');
    lines.push('**Test steps:**');
    w.testSteps.forEach((s) => lines.push(`- ${s}`));
    if (w.stripeObjects.length) {
      lines.push('', '**Stripe objects:**', ...w.stripeObjects.map((o) => `- ${o}`));
    }
    if (w.databaseChanges.length) {
      lines.push('', '**Database changes:**', ...w.databaseChanges.map((d) => `- ${d}`));
    }
    if (w.webhookEvents.length) {
      lines.push('', '**Webhook events:**', ...w.webhookEvents.map((e) => `- ${e}`));
    }
    if (w.emailsSent.length) {
      lines.push('', '**Emails:**', ...w.emailsSent.map((e) => `- ${e}`));
    }
    lines.push('', `**Recovery:** ${w.recoveryBehavior}`);
    if (w.error) lines.push('', `**Note:** ${w.error}`);
    lines.push('');
  }

  if (report.backlogItems.length) {
    lines.push('## Outstanding Backlog', '');
    report.backlogItems.forEach((b) => lines.push(`- **${b.id}:** ${b.title} — ${b.reason}`));
  }

  return lines.join('\n');
}

async function main() {
  const report = await runStripeProductionCertification();
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  await writeFile(mdPath, toMarkdown(report), 'utf-8');
  console.log(`Certification: ${report.overallResult} (${report.passCount}/${report.workflows.length} PASS)`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (report.failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
