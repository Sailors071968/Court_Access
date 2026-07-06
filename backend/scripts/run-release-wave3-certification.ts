#!/usr/bin/env tsx
/**
 * Release Wave 3 — Production Blocker Elimination certification runner.
 * Evidence-backed PASS/FAIL/UNKNOWN per blocker. No fabricated completion.
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const repoRoot = resolve(root, '..');
const reportsDir = resolve(repoRoot, 'reports');

interface BlockerResult {
  id: string;
  name: string;
  priority: string;
  result: 'PASS' | 'FAIL' | 'UNKNOWN';
  evidence: string[];
  notes?: string;
}

function runScript(cmd: string, cwd = root): { exitCode: number; output: string } {
  const r = spawnSync(cmd, { shell: true, cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return { exitCode: r.status ?? 1, output: (r.stdout ?? '') + (r.stderr ?? '') };
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function checkServerHooks(): BlockerResult {
  const serverPath = resolve(root, 'src/server.ts');
  const src = readFileSync(serverPath, 'utf8');
  const authOn = /app\.addHook\(['"]onRequest['"],\s*authenticationHook\)/.test(src);
  const csrfOn = /app\.addHook\(['"]onRequest['"],\s*csrfProtectionHook\)/.test(src);
  const authCommented = src.includes("//  app.addHook('onRequest', authenticationHook)");
  const csrfCommented = src.includes("// app.addHook('onRequest', csrfProtectionHook)");
  const pass = authOn && csrfOn && !authCommented && !csrfCommented;
  return {
    id: 'BLOCKER-3',
    name: 'Authentication',
    priority: 'CRITICAL',
    result: pass ? 'PASS' : 'FAIL',
    evidence: [serverPath, 'reports/SECURITY_CERTIFICATION_BLOCKER3.json'],
  };
}

function checkCollaboration(): BlockerResult {
  const membershipPath = resolve(root, 'src/membership/universalMembership.ts');
  const src = readFileSync(membershipPath, 'utf8');
  const unlimited = /DELEGATED_USER_LIMIT:\s*number\s*\|\s*null\s*=\s*null/.test(src);
  return {
    id: 'BLOCKER-4',
    name: 'Unlimited case collaboration',
    priority: 'CRITICAL',
    result: unlimited ? 'PASS' : 'FAIL',
    evidence: [membershipPath, 'reports/COLLABORATION_CERTIFICATION_BLOCKER4.json'],
    notes: unlimited ? 'DELEGATED_USER_LIMIT=null' : 'Delegate limit still enforced',
  };
}

function checkRedaction(): BlockerResult {
  const servicePath = resolve(root, 'src/membership/redactionService.ts');
  const uiPath = resolve(repoRoot, 'src/pages/redaction/DocumentRedactionPage.tsx');
  const hasVersioning = existsSync(servicePath);
  const hasUi = existsSync(uiPath);
  const src = hasUi ? readFileSync(uiPath, 'utf8') : '';
  const hasRectangle = src.includes('handleMouseDown') && src.includes('handleSearchRedact');
  const hasBurnIn = /burn.?in|renderRedacted|applyRedaction/i.test(
    readFileSync(servicePath, 'utf8') + src,
  );
  const pass = hasVersioning && hasUi && hasRectangle && hasBurnIn;
  return {
    id: 'BLOCKER-5',
    name: 'Document redaction',
    priority: 'CRITICAL',
    result: pass ? 'PASS' : 'FAIL',
    evidence: [servicePath, uiPath],
    notes: pass
      ? undefined
      : `Missing: ${!hasBurnIn ? 'burn-in rendering, ' : ''}${!hasRectangle ? 'rectangle/search UI' : 'versioning/UI present but burn-in/PII pipeline incomplete'}`,
  };
}

function checkExports(): BlockerResult {
  const exportPath = resolve(root, 'src/workbench/exportService.ts');
  const src = readFileSync(exportPath, 'utf8');
  const hasJson = src.includes('generateWorkbenchExport');
  const hasPdf = /pdf|PDFDocument|puppeteer/i.test(src);
  const hasWord = /docx|wordprocessingml/i.test(src);
  return {
    id: 'BLOCKER-10',
    name: 'Export system',
    priority: 'HIGH',
    result: hasPdf && hasWord ? 'PASS' : 'FAIL',
    evidence: [exportPath],
    notes: hasJson ? 'JSON exports only; PDF/Word not implemented' : 'Export service missing',
  };
}

function checkCaKnowledge(): BlockerResult {
  const coveragePath = resolve(repoRoot, 'reports/LEGISLATIVE_COVERAGE.json');
  const coverage = readJson(coveragePath);
  let pct = 0;
  if (coverage && typeof coverage.overallCoveragePercent === 'number') {
    pct = coverage.overallCoveragePercent;
  } else if (coverage && typeof coverage.coveragePercent === 'number') {
    pct = coverage.coveragePercent;
  }
  const pass = pct >= 50;
  return {
    id: 'BLOCKER-6',
    name: 'California knowledge platform',
    priority: 'CRITICAL',
    result: pass ? 'PASS' : pct > 0 ? 'FAIL' : 'UNKNOWN',
    evidence: existsSync(coveragePath) ? [coveragePath] : ['No coverage report found'],
    notes: pct > 0 ? `Coverage ~${pct}%` : 'Coverage metrics not generated',
  };
}

function checkStripe(): BlockerResult {
  const stripeReport = readJson(resolve(reportsDir, 'stripe/PRODUCTION_CERTIFICATION.json'));
  if (!stripeReport) {
    return {
      id: 'BLOCKER-7',
      name: 'Stripe production certification',
      priority: 'CRITICAL',
      result: 'UNKNOWN',
      evidence: ['reports/stripe/PRODUCTION_CERTIFICATION.json'],
      notes: 'Run npm run billing:certify with STRIPE_SECRET_KEY',
    };
  }
  return {
    id: 'BLOCKER-7',
    name: 'Stripe production certification',
    priority: 'CRITICAL',
    result: stripeReport.overallResult === 'PASS' ? 'PASS' : 'FAIL',
    evidence: ['reports/stripe/PRODUCTION_CERTIFICATION.json'],
    notes: String(stripeReport.overallResult ?? 'UNKNOWN'),
  };
}

function checkDeployment(): BlockerResult {
  const certPath = resolve(reportsDir, 'DEPLOYMENT_READINESS_CERTIFICATE.json');
  const cert = readJson(certPath);
  if (!cert) {
    return {
      id: 'BLOCKER-1',
      name: 'Greenfield deployment',
      priority: 'CRITICAL',
      result: 'UNKNOWN',
      evidence: ['scripts/v1-deployment-readiness-certificate.sh'],
      notes: 'EC2 Phases 0–2 not executed from cloud agent',
    };
  }
  const readiness = cert.readiness ?? cert.overallResult;
  return {
    id: 'BLOCKER-1',
    name: 'Greenfield deployment',
    priority: 'CRITICAL',
    result: readiness === 'PASS' ? 'PASS' : 'FAIL',
    evidence: [certPath, 'scripts/v1-greenfield-preflight.sh'],
    notes: readiness !== 'PASS' ? `Preflight readiness: ${readiness}` : undefined,
  };
}

function checkAttorneyE2E(): BlockerResult {
  const e2ePath = resolve(reportsDir, 'ATTORNEY_E2E_CERTIFICATION.json');
  const e2e = readJson(e2ePath);
  if (!e2e) {
    return {
      id: 'BLOCKER-2',
      name: 'Attorney end-to-end certification',
      priority: 'CRITICAL',
      result: 'UNKNOWN',
      evidence: ['No ATTORNEY_E2E_CERTIFICATION.json'],
      notes: 'Requires deployed V1 stack with PostgreSQL',
    };
  }
  return {
    id: 'BLOCKER-2',
    name: 'Attorney end-to-end certification',
    priority: 'CRITICAL',
    result: e2e.overallResult === 'PASS' ? 'PASS' : 'FAIL',
    evidence: [e2ePath],
  };
}

function checkPublicWebsite(): BlockerResult {
  const verifyPath = resolve(reportsDir, 'PRODUCTION_WEBSITE_VERIFY.json');
  const verify = readJson(verifyPath);
  if (!verify) return { id: 'BLOCKER-8', name: 'Public website', priority: 'HIGH', result: 'UNKNOWN', evidence: [verifyPath] };
  const pass = verify.overallResult === 'PASS' || verify.status === 'PASS';
  return {
    id: 'BLOCKER-8',
    name: 'Public website',
    priority: 'HIGH',
    result: pass ? 'PASS' : 'FAIL',
    evidence: [verifyPath],
  };
}

function checkV1Certification(blockers: BlockerResult[]): BlockerResult {
  const critical = ['BLOCKER-1', 'BLOCKER-2', 'BLOCKER-3', 'BLOCKER-7'];
  const criticalPass = critical.every((id) => blockers.find((b) => b.id === id)?.result === 'PASS');
  return {
    id: 'BLOCKER-12',
    name: 'Version 1.0 certification',
    priority: 'CRITICAL',
    result: criticalPass ? 'PASS' : 'FAIL',
    evidence: ['reports/VERSION_1_0_CERTIFICATION.json'],
    notes: criticalPass ? 'All critical blockers PASS' : 'Critical blockers incomplete',
  };
}

async function main() {
  console.log('==> Release Wave 3 certification');

  // Run sub-certifications
  const subScripts = [
    'tsx scripts/run-security-certification.ts',
    'tsx scripts/run-collaboration-certification.ts',
    'tsx scripts/run-attorney-e2e-certification.ts',
  ];
  for (const cmd of subScripts) {
    const { exitCode, output } = runScript(cmd, root);
    console.log(`[${exitCode === 0 ? 'PASS' : 'FAIL'}] ${cmd.split(' ').slice(0, 3).join(' ')}`);
    if (exitCode !== 0 && output) console.log(output.slice(-500));
  }

  const blockers: BlockerResult[] = [
    checkDeployment(),
    checkAttorneyE2E(),
    checkServerHooks(),
    checkCollaboration(),
    checkRedaction(),
    checkCaKnowledge(),
    checkStripe(),
    checkPublicWebsite(),
    {
      id: 'BLOCKER-9',
      name: 'Client experience',
      priority: 'HIGH',
      result: 'FAIL',
      evidence: ['reports/MASTER_PRODUCTION_COMPLETION_ASSESSMENT.md'],
      notes: 'Onboarding partial; portal pages incomplete (~52%)',
    },
    checkExports(),
    {
      id: 'BLOCKER-11',
      name: 'Production operations',
      priority: 'HIGH',
      result: 'PARTIAL' as never,
      evidence: ['backend/src/productionOperations/'],
      notes: 'Dashboards exist; live production verification pending',
    },
    checkV1Certification([]),
  ];

  // Fix BLOCKER-11 result type
  const ops = blockers.find((b) => b.id === 'BLOCKER-11');
  if (ops) ops.result = 'FAIL';

  // Recompute BLOCKER-12 with full list
  const b12 = blockers.find((b) => b.id === 'BLOCKER-12');
  if (b12) {
    const critical = ['BLOCKER-1', 'BLOCKER-2', 'BLOCKER-3', 'BLOCKER-7'];
    const criticalPass = critical.every((id) => blockers.find((b) => b.id === id)?.result === 'PASS');
    b12.result = criticalPass ? 'PASS' : 'FAIL';
    b12.notes = criticalPass ? 'All critical blockers PASS' : 'Critical blockers incomplete';
  }

  const passCount = blockers.filter((b) => b.result === 'PASS').length;
  const failCount = blockers.filter((b) => b.result === 'FAIL').length;
  const unknownCount = blockers.filter((b) => b.result === 'UNKNOWN').length;

  const report = {
    directive: 'CourtAccess V1.0 Release Wave 3 — Production Blocker Elimination',
    generatedAt: new Date().toISOString(),
    overallResult: failCount === 0 && unknownCount === 0 ? 'PASS' : 'NOT_READY',
    version10Certified: false,
    deploymentRecommendation: 'HOLD',
    summary: { pass: passCount, fail: failCount, unknown: unknownCount, total: blockers.length },
    blockers,
    remainingBacklog: blockers
      .filter((b) => b.result !== 'PASS')
      .map((b) => ({ id: b.id, name: b.name, result: b.result, notes: b.notes })),
    riskAssessment: [
      'BLK-001: No EC2 greenfield execution evidence',
      'BLK-002: Attorney E2E workflow not certified on deployed V1',
      'BLK-005: Document redaction lacks burn-in and automatic PII pipeline',
      'BLK-006: California legal coverage substantially below target',
      'BLK-010: PDF/Word export not implemented',
    ],
  };

  const outJson = resolve(reportsDir, 'VERSION_1_0_CERTIFICATION.json');
  const outMd = resolve(reportsDir, 'VERSION_1_0_CERTIFICATION.md');
  writeFileSync(outJson, JSON.stringify(report, null, 2));

  const md = [
    '# CourtAccess Version 1.0 Certification',
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Overall:** ${report.overallResult}`,
    `**Version 1.0 Certified:** ${report.version10Certified ? 'YES' : 'NO'}`,
    `**Deployment Recommendation:** ${report.deploymentRecommendation}`,
    '',
    `| PASS | FAIL | UNKNOWN |`,
    `|------|------|---------|`,
    `| ${passCount} | ${failCount} | ${unknownCount} |`,
    '',
    '## Blocker Results',
    '',
    '| Blocker | Result | Notes |',
    '|---------|--------|-------|',
    ...blockers.map((b) => `| ${b.id} ${b.name} | **${b.result}** | ${b.notes ?? ''} |`),
    '',
    '## Remaining Backlog',
    '',
    ...report.remainingBacklog.map((b) => `- **${b.id}** (${b.result}): ${b.name}${b.notes ? ` — ${b.notes}` : ''}`),
  ].join('\n');
  writeFileSync(outMd, md);

  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Report: ${outJson}`);
  process.exit(report.overallResult === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
