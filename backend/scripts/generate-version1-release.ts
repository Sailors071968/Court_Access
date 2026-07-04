#!/usr/bin/env tsx
// Program 1 — Generate Version 1.0 release artifacts

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { runVersion1ProductionGates } from '../src/productionGates/version1ProductionGates.ts';

const reportsDir = resolve(import.meta.dirname ?? '.', '../../reports');

async function main() {
  const gates = await runVersion1ProductionGates();

  const checklist = {
    program: 'VERSION_1.0_RELEASE',
    version: '9.0',
    generatedAt: gates.generatedAt,
    releaseCandidate: gates.overallResult !== 'READY',
    overallResult: gates.overallResult,
    gatesPass: gates.passCount,
    gatesPartial: gates.partialCount,
    gatesFail: gates.failCount,
    gatesTotal: gates.gates.length,
    completionPercent: Math.round((gates.passCount / gates.gates.length) * 1000) / 10,
    deploymentBlocked: gates.deploymentBlocked,
    blockers: gates.blockers,
    checklist: gates.gates.map((g) => ({
      id: g.id,
      name: g.name,
      program: g.program,
      status: g.result,
      checks: `${g.checks.pass}/${g.checks.total}`,
      blockers: g.blockers,
    })),
    criticalWorkflows: [
      { id: 'WF-001', name: 'Attorney case intelligence', status: gates.gates.find((g) => g.id === 'PG-010')?.result ?? 'UNKNOWN' },
      { id: 'WF-002', name: 'Attorney workbench', status: gates.gates.find((g) => g.id === 'PG-011')?.result ?? 'UNKNOWN' },
      { id: 'WF-003', name: 'Investigator workbench', status: gates.gates.find((g) => g.id === 'PG-012')?.result ?? 'UNKNOWN' },
      { id: 'WF-004', name: 'Billing lifecycle', status: gates.gates.find((g) => g.id === 'PG-001')?.result ?? 'UNKNOWN' },
      { id: 'WF-005', name: 'Backup & recovery', status: gates.gates.find((g) => g.id === 'PG-016')?.result ?? 'UNKNOWN' },
    ],
  };

  const featureRegistry = {
    program: 'VERSION_1.0_FEATURE_REGISTRY',
    version: '9.0',
    generatedAt: gates.generatedAt,
    features: [
      { id: 'F-001', domain: 'Authentication', feature: 'Login/Register/Password Reset', gate: 'PG-002', status: gates.gates.find((g) => g.id === 'PG-002')?.result },
      { id: 'F-002', domain: 'Client', feature: 'Client CRUD', gate: 'PG-004', status: gates.gates.find((g) => g.id === 'PG-004')?.result },
      { id: 'F-003', domain: 'Case', feature: 'Case Management', gate: 'PG-005', status: gates.gates.find((g) => g.id === 'PG-005')?.result },
      { id: 'F-004', domain: 'Evidence', feature: 'Evidence Platform', gate: 'PG-007', status: gates.gates.find((g) => g.id === 'PG-007')?.result },
      { id: 'F-005', domain: 'Legislative', feature: 'CA Legal Intelligence', gate: 'PG-008', status: gates.gates.find((g) => g.id === 'PG-008')?.result },
      { id: 'F-006', domain: 'Intelligence', feature: 'Attorney Intelligence Engine', gate: 'PG-010', status: gates.gates.find((g) => g.id === 'PG-010')?.result },
      { id: 'F-007', domain: 'Workbench', feature: 'Attorney Workbench', gate: 'PG-011', status: gates.gates.find((g) => g.id === 'PG-011')?.result },
      { id: 'F-008', domain: 'Workbench', feature: 'Investigator Workbench', gate: 'PG-012', status: gates.gates.find((g) => g.id === 'PG-012')?.result },
      { id: 'F-009', domain: 'Billing', feature: 'Stripe Billing', gate: 'PG-001', status: gates.gates.find((g) => g.id === 'PG-001')?.result },
      { id: 'F-010', domain: 'Operations', feature: 'Admin Command Center', gate: 'PG-013', status: gates.gates.find((g) => g.id === 'PG-013')?.result },
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(resolve(reportsDir, 'VERSION_1.0_RELEASE_CHECKLIST.json'), JSON.stringify(checklist, null, 2));
  await writeFile(resolve(reportsDir, 'FEATURE_REGISTRY.json'), JSON.stringify(featureRegistry, null, 2));
  await writeFile(resolve(reportsDir, 'VERSION_1.0_GATES.json'), JSON.stringify(gates, null, 2));

  console.log(`Version 1.0 Gates: ${gates.overallResult} (${gates.passCount}/${gates.gates.length} PASS)`);
  console.log(`Checklist: ${resolve(reportsDir, 'VERSION_1.0_RELEASE_CHECKLIST.json')}`);
  console.log(`Feature Registry: ${resolve(reportsDir, 'FEATURE_REGISTRY.json')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
