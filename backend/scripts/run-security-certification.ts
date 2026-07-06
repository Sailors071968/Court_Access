#!/usr/bin/env tsx
/**
 * Blocker 3 — Security certification (repository + unit tests).
 * Verifies authenticationHook and csrfProtectionHook are registered in server.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const serverPath = resolve(root, 'src/server.ts');
const outPath = resolve(root, '../reports/SECURITY_CERTIFICATION_BLOCKER3.json');

interface Check {
  name: string;
  result: 'PASS' | 'FAIL' | 'UNKNOWN';
  evidence: string;
}

const checks: Check[] = [];
const serverSrc = readFileSync(serverPath, 'utf8');

function check(name: string, pass: boolean, evidence: string) {
  checks.push({ name, result: pass ? 'PASS' : 'FAIL', evidence });
}

check(
  'authenticationHook registered',
  /app\.addHook\(['"]onRequest['"],\s*authenticationHook\)/.test(serverSrc),
  serverPath,
);
check(
  'csrfProtectionHook registered',
  /app\.addHook\(['"]onRequest['"],\s*csrfProtectionHook\)/.test(serverSrc),
  serverPath,
);
check(
  'authenticationHook not commented out',
  !serverSrc.includes('//  app.addHook(\'onRequest\', authenticationHook)'),
  serverPath,
);
check(
  'csrfProtectionHook not commented out',
  !serverSrc.includes('// app.addHook(\'onRequest\', csrfProtectionHook)'),
  serverPath,
);

let testExit = 1;
try {
  execSync('node --import tsx --test tests/stability-authPublicRoutes.test.ts tests/identity-security.test.ts', {
    cwd: root,
    stdio: 'pipe',
  });
  testExit = 0;
  check('security unit tests', true, 'stability-authPublicRoutes + identity-security');
} catch (e) {
  check('security unit tests', false, String(e instanceof Error ? e.message : e));
}

const failCount = checks.filter((c) => c.result === 'FAIL').length;
const report = {
  blocker: 'BLOCKER-3-AUTHENTICATION',
  generatedAt: new Date().toISOString(),
  overallResult: failCount === 0 && testExit === 0 ? 'PASS' : 'FAIL',
  checks,
  testExitCode: testExit,
};

writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(failCount === 0 && testExit === 0 ? 0 : 1);
