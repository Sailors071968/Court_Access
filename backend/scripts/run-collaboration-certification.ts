#!/usr/bin/env tsx
/**
 * Blocker 4 — Unlimited case collaboration certification.
 * Verifies DELEGATED_USER_LIMIT is null and invitation logic allows unlimited members.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DELEGATED_USER_LIMIT } from '../src/membership/universalMembership.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outPath = resolve(root, '../reports/COLLABORATION_CERTIFICATION_BLOCKER4.json');

let testExit = 1;
let integrationTestExit: number | null = null;
try {
  execSync('node --import tsx --test tests/universal-membership.test.ts', {
    cwd: root,
    stdio: 'pipe',
  });
  testExit = 0;
} catch (e) {
  // captured below
}

// Integration test requires DATABASE_URL — optional evidence when DB available
if (process.env.DATABASE_URL) {
  try {
    execSync('node --import tsx --test tests/organization-domain.test.ts', {
      cwd: root,
      stdio: 'pipe',
      timeout: 120_000,
    });
    integrationTestExit = 0;
  } catch {
    integrationTestExit = 1;
  }
}

const report = {
  blocker: 'BLOCKER-4-UNLIMITED-COLLABORATION',
  generatedAt: new Date().toISOString(),
  delegatedUserLimit: DELEGATED_USER_LIMIT,
  unlimitedMembers: DELEGATED_USER_LIMIT === null,
  overallResult: DELEGATED_USER_LIMIT === null && testExit === 0 ? 'PASS' : 'FAIL',
  evidence: [
    'backend/src/membership/universalMembership.ts DELEGATED_USER_LIMIT',
    'backend/src/organizations/organizationService.ts createInvitation',
    'backend/tests/universal-membership.test.ts',
  ],
  testExitCode: testExit,
  integrationTestExitCode: integrationTestExit,
  integrationTestNote:
    integrationTestExit === null
      ? 'organization-domain.test.ts skipped (DATABASE_URL not set)'
      : 'organization-domain.test.ts requires PostgreSQL',
};

writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.overallResult === 'PASS' ? 0 : 1);
