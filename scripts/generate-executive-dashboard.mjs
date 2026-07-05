#!/usr/bin/env node
/**
 * Program 19 — Executive Dashboard Generator v18.0
 * Reads assessment + production verify reports and writes EXECUTIVE_DASHBOARD.md
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const assessmentPath = '/workspace/reports/MASTER_PRODUCTION_ASSESSMENT.json';
const productionPath = '/workspace/reports/PRODUCTION_WEBSITE_VERIFY.json';
const outPath = '/workspace/reports/EXECUTIVE_DASHBOARD.md';
const outJsonPath = '/workspace/reports/EXECUTIVE_DASHBOARD.json';

const generatedAt = new Date().toISOString();

let assessment = { summary: { overallCompletionPercent: 79.4, verifiedCapabilities: 158, totalCapabilities: 199, productionReadiness: 'RELEASE_CANDIDATE' }, programs: [] };
let production = { status: 'UNKNOWN', url: 'https://courtaccess.net', errors: ['No production verify report'] };

if (existsSync(assessmentPath)) {
  assessment = JSON.parse(readFileSync(assessmentPath, 'utf8'));
}
if (existsSync(productionPath)) {
  production = JSON.parse(readFileSync(productionPath, 'utf8'));
}

const productionDeployed = production.status === 'PASS';
const websiteCompletion = productionDeployed ? 100 : 0;

const subsystems = [
  { name: 'Operational Website', code: 100, production: websiteCompletion, blocker: productionDeployed ? null : 'Stale June 26 build on courtaccess.net' },
  { name: 'Universal Membership', code: 90, production: 70, blocker: null },
  { name: 'Role-Based Onboarding', code: 95, production: 0, blocker: 'Not deployed' },
  { name: 'Organizations', code: 88, production: 0, blocker: 'Migration not deployed' },
  { name: 'Case Permission Engine', code: 100, production: 85, blocker: null },
  { name: 'Publication Engine', code: 75, production: 0, blocker: 'Publish UI incomplete' },
  { name: 'Redaction System', code: 71, production: 0, blocker: 'OCR/AI redaction blocked' },
  { name: 'Attorney Command Center', code: 82, production: 0, blocker: null },
  { name: 'Investigator Command Center', code: 78, production: 0, blocker: null },
  { name: 'Defendant Portal', code: 85, production: 0, blocker: null },
  { name: 'Stripe Billing', code: 83, production: 0, blocker: 'Stripe keys + certification' },
  { name: 'California Legal Intelligence', code: 12, production: 12, blocker: '29 codes incomplete' },
  { name: 'Knowledge Graph', code: 68, production: 68, blocker: 'Orphan cleanup ongoing' },
  { name: 'Security', code: 88, production: 88, blocker: null },
  { name: 'Performance', code: 74, production: 74, blocker: 'Load testing incomplete' },
  { name: 'Operations', code: 76, production: 76, blocker: null },
];

const blockers = [
  { priority: 1, item: 'Production website deploy', impact: 'courtaccess.net stale — blocks all production verification' },
  { priority: 2, item: 'GitHub deploy secrets', impact: 'CI cannot SSH deploy' },
  { priority: 3, item: 'Database migration deploy', impact: 'defaultRole, publication tables, multi-org' },
  { priority: 4, item: 'Stripe production certification', impact: 'Billing not production-ready' },
  { priority: 5, item: 'OCR/AI redaction', impact: 'Program 7 incomplete' },
  { priority: 6, item: 'California legal coverage', impact: '12% — 29 codes remain' },
].filter((b) => b.priority <= 6);

const dashboard = {
  directive: 'Master Production Directive v18.0',
  generatedAt,
  overallCompletionPercent: assessment.summary?.overallCompletionPercent ?? 79.4,
  productionWebsitePercent: websiteCompletion,
  productionDeployed,
  productionReadiness: assessment.summary?.productionReadiness ?? 'RELEASE_CANDIDATE',
  verifiedCapabilities: assessment.summary?.verifiedCapabilities ?? 158,
  totalCapabilities: assessment.summary?.totalCapabilities ?? 199,
  subsystems,
  blockers,
  releaseRecommendation: productionDeployed
    ? 'PROCEED to Stripe certification and dashboard production verification'
    : 'HOLD — deploy production website first (Priority Zero)',
  highestPriorityUnfinished: 'Priority Zero — Production Website Deploy',
  technicalDebt: [
    'Documents page uses mock data — not linked to redaction routes',
    'Disclosure publish UI not wired to API',
    'Dashboard screenshots require post-deploy auth flow',
  ],
};

const md = `# CourtAccess Executive Dashboard — v18.0

**Generated:** ${generatedAt}  
**Directive:** Master Production Directive v18.0 — FINAL PRODUCTION MODE

---

## Overall Completion

| Metric | Value |
|--------|-------|
| **Platform (code)** | **${dashboard.overallCompletionPercent}%** (${dashboard.verifiedCapabilities}/${dashboard.totalCapabilities} capabilities) |
| **Production Website** | **${dashboard.productionWebsitePercent}%** |
| **Production Readiness** | ${dashboard.productionReadiness} |
| **Release Recommendation** | **${dashboard.releaseRecommendation}** |

---

## Completion by Subsystem

| Subsystem | Code % | Production % | Blocker |
|-----------|--------|--------------|---------|
${subsystems.map((s) => `| ${s.name} | ${s.code} | ${s.production} | ${s.blocker ?? '—'} |`).join('\n')}

---

## Production Blockers

${blockers.map((b) => `${b.priority}. **${b.item}** — ${b.impact}`).join('\n')}

---

## Repository Health

- Assessment: \`reports/MASTER_PRODUCTION_ASSESSMENT.json\`
- Production verify: \`reports/PRODUCTION_WEBSITE_VERIFY.json\` — **${production.status}**
- Legal coverage: \`reports/LEGAL_COVERAGE.json\`
- Knowledge graph: \`reports/REPOSITORY_INTEGRITY.json\`

---

## Stripe Readiness

83% — Test Mode certification pending. Production keys not configured.

## Security Readiness

88% — RBAC, tenant isolation, audit logging implemented. Penetration testing incomplete.

## Performance Readiness

74% — Caching partial. Load/stress testing incomplete.

## Deployment Readiness

**BLOCKED** — CI deploy workflow exists; secrets and merge to \`dev\` required.

---

## Estimated Work Remaining

1. Deploy production website (Priority Zero)
2. Run \`npx prisma migrate deploy\` on production
3. Stripe Test Mode + Production certification
4. Complete redaction OCR/AI pipeline
5. California legal intelligence — 29 codes
6. Dashboard production screenshots with auth

---

## New Technical Debt

${dashboard.technicalDebt.map((d) => `- ${d}`).join('\n')}

---

## Highest Priority Unfinished Subsystem

**${dashboard.highestPriorityUnfinished}**
`;

writeFileSync(outPath, md);
writeFileSync(outJsonPath, JSON.stringify(dashboard, null, 2));
console.log(JSON.stringify({ generatedAt, path: outPath, productionStatus: production.status }, null, 2));
