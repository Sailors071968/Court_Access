#!/usr/bin/env node
// Phase 1 — Feature inventory.
// Builds the certification inventory from the real code: every API route
// registered in the backend, every SPA route in App.tsx, every Prisma model,
// and every BullMQ queue. Written to reports/certification/FEATURE_INVENTORY.json.

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectApiRoutes, collectSpaRoutes } from './lib/routeInventory.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(ROOT, 'reports/certification');

// Maps a URL prefix onto the product-level feature it belongs to, so the
// route table can be rolled up into the feature list used for certification.
// Order matters: the first pattern to match wins, so case-scoped sub-features
// have to be listed before the general /api/cases prefix or the workbench,
// evidence and charge endpoints all collapse into Case Management.
const FEATURE_MAP = [
  [/^\/api\/cases\/:caseId\/workbench/, 'Attorney Workbench'],
  [/^\/api\/cases\/:caseId\/investigator/, 'Investigator Workbench'],
  [/^\/api\/cases\/:caseId\/evidence-requests/, 'Evidence Gap Detection'],
  [/^\/api\/cases\/:caseId\/evidence/, 'Evidence Repository'],
  [/^\/api\/cases\/:caseId\/charges/, 'Charges & Mens Rea'],
  [/^\/api\/cases\/:caseId\/timeline/, 'Timeline'],
  [/^\/api\/cases\/:caseId\/contradictions/, 'Contradictions'],
  [/^\/api\/cases\/:caseId\/narrative/, 'Narrative Analysis'],
  [/^\/api\/cases\/:caseId\/exhibits|^\/api\/cases\/:caseId\/trial/, 'Trial Exhibits'],
  [/^\/api\/cases\/:caseId\/motions/, 'Motion Intelligence'],
  [/^\/api\/cases\/:caseId\/(strategy|litigation)/, 'Litigation Strategy'],
  [/^\/api\/cases\/:caseId\/(documents|disclosure|redaction)/, 'Documents & Disclosure'],
  [/^\/api\/cases\/:caseId\/(clients?|hearings|messages)/, 'Client Domain'],
  [/^\/api\/auth\/(login|register|logout|refresh|me)/, 'Authentication'],
  [/^\/api\/auth\/(forgot-password|reset-password)/, 'Password Reset'],
  [/^\/api\/auth\/(verify-email|mfa)/, 'Identity & MFA'],
  [/^\/api\/auth\/csrf/, 'CSRF Protection'],
  [/^\/api\/identity/, 'Identity & MFA'],
  [/^\/api\/membership/, 'Membership & Onboarding'],
  [/^\/api\/organizations?/, 'Organizations'],
  [/^\/api\/firm/, 'Firm Operating Platform'],
  [/^\/api\/cases/, 'Case Management'],
  [/^\/api\/clients/, 'Client Domain'],
  [/^\/api\/evidence-requests/, 'Evidence Gap Detection'],
  [/^\/api\/evidence/, 'Evidence Repository'],
  [/^\/api\/timeline/, 'Timeline'],
  [/^\/api\/contradiction/, 'Contradictions'],
  [/^\/api\/calcrim/, 'CALCRIM'],
  [/^\/api\/charges/, 'Charges & Mens Rea'],
  [/^\/api\/doctrine/, 'Doctrine Intelligence'],
  [/^\/api\/legislative/, 'Legislative Intelligence'],
  [/^\/api\/governance/, 'Corpus Governance'],
  [/^\/api\/intelligence/, 'Narrative Analysis'],
  [/^\/api\/narrative/, 'Narrative Analysis'],
  [/^\/api\/workbench/, 'Attorney Workbench'],
  [/^\/api\/investigator/, 'Investigator Workbench'],
  [/^\/api\/compliance/, 'Compliance Analysis'],
  [/^\/api\/forensic/, 'Forensic Reconstruction'],
  [/^\/api\/billing/, 'Billing & Stripe'],
  [/^\/api\/discount-codes/, 'Discount Codes'],
  [/^\/api\/admin\/discount-codes/, 'Discount Codes'],
  [/^\/api\/admin\/queues/, 'Queue Monitoring'],
  [/^\/api\/admin/, 'Administration'],
  [/^\/api\/security/, 'Security Logging'],
  [/^\/api\/policy-pipeline/, 'Policy Acquisition Pipeline'],
  [/^\/api\/policy-intelligence/, 'Policy Intelligence'],
  [/^\/api\/operations/, 'Operations Console'],
  [/^\/api\/cpra/, 'CPRA'],
  [/^\/api\/messaging|^\/api\/messages/, 'Messaging'],
  [/^\/api\/hearings/, 'Hearings & Court Dates'],
  [/^\/api\/contact/, 'Marketing & Contact'],
  [/^\/api\/marketing/, 'Marketing & Contact'],
  [/^\/api\/production-gates/, 'Production Gates'],
  [/^\/api\/production-operations/, 'Production Operations'],
  [/^\/api\/health|^\/api\/metrics/, 'Observability'],
  [/^\/api\/jobs/, 'Job Processing'],
  [/^\/api\/exhibits|^\/api\/trial-exhibits/, 'Trial Exhibits'],
  [/^\/api\/usage/, 'Usage Metering'],
  [/^\/api\/notifications/, 'Notifications'],
  [/^\/api\/search/, 'Search'],
];

function featureFor(url) {
  for (const [re, name] of FEATURE_MAP) if (re.test(url)) return name;
  return 'Unclassified';
}

async function collectPrismaModels() {
  const text = await readFile(path.join(ROOT, 'backend/prisma/schema.prisma'), 'utf8');
  return [...text.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
}

async function collectQueues() {
  const text = await readFile(
    path.join(ROOT, 'backend/src/workers/startPipelineWorkers.ts'),
    'utf8',
  ).catch(() => '');
  return [...text.matchAll(/['"`]([a-z0-9-]+(?:-processing|-analysis|-queue))['"`]/gi)].map((m) => m[1]);
}

const apiRoutes = await collectApiRoutes(path.join(ROOT, 'backend/src'));
const spaRoutes = await collectSpaRoutes(path.join(ROOT, 'src/App.tsx'));
const models = await collectPrismaModels();
const queues = [...new Set(await collectQueues())];

const features = new Map();
for (const r of apiRoutes) {
  const name = featureFor(r.url);
  if (!features.has(name)) features.set(name, { feature: name, apiRoutes: [], spaRoutes: [] });
  features.get(name).apiRoutes.push(`${r.method} ${r.url}`);
}

// Attribute SPA routes to features by matching path keywords to feature names.
const SPA_FEATURE_MAP = [
  [/^\/(login|register|verify-email|accept-invitation)/, 'Authentication'],
  [/^\/(forgot-password|reset-password)/, 'Password Reset'],
  [/^\/onboarding/, 'Membership & Onboarding'],
  [/^\/organization/, 'Organizations'],
  [/^\/firm/, 'Firm Operating Platform'],
  [/^\/client-portal/, 'Client Domain'],
  [/evidence/, 'Evidence Repository'],
  [/timeline/, 'Timeline'],
  [/contradiction/, 'Contradictions'],
  [/charges/, 'Charges & Mens Rea'],
  [/narrative/, 'Narrative Analysis'],
  [/attorney-workbench/, 'Attorney Workbench'],
  [/investigator-workbench/, 'Investigator Workbench'],
  [/litigation-strategy/, 'Litigation Strategy'],
  [/trial-exhibits|exhibits/, 'Trial Exhibits'],
  [/motions/, 'Motion Intelligence'],
  [/^\/cases/, 'Case Management'],
  [/^\/admin/, 'Administration'],
  [/cpra/, 'CPRA'],
  [/policy/, 'Policy Intelligence'],
  [/^\/dashboard/, 'Dashboards'],
  [/^\/settings|^\/shared-access/, 'Settings & Shared Access'],
  [/^\/notifications/, 'Notifications'],
  [/^\/search/, 'Search'],
  [/^\/pricing/, 'Billing & Stripe'],
];

for (const r of spaRoutes) {
  let name = 'Marketing & Public Site';
  for (const [re, n] of SPA_FEATURE_MAP) {
    if (re.test(r.path)) {
      name = n;
      break;
    }
  }
  if (!features.has(name)) features.set(name, { feature: name, apiRoutes: [], spaRoutes: [] });
  features.get(name).spaRoutes.push(`${r.path} -> ${r.component}`);
}

const inventory = {
  generatedAt: new Date().toISOString(),
  method: 'Static extraction from backend/src route registrations and src/App.tsx <Route> elements',
  totals: {
    apiRoutes: apiRoutes.length,
    spaRoutes: spaRoutes.length,
    prismaModels: models.length,
    bullmqQueues: queues.length,
    features: features.size,
  },
  features: [...features.values()]
    .map((f) => ({ ...f, apiRouteCount: f.apiRoutes.length, spaRouteCount: f.spaRoutes.length }))
    .sort((a, b) => a.feature.localeCompare(b.feature)),
  apiRoutes,
  spaRoutes,
  prismaModels: models,
  bullmqQueues: queues,
};

await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, 'FEATURE_INVENTORY.json'), JSON.stringify(inventory, null, 2));

console.log(`API routes:     ${apiRoutes.length}`);
console.log(`SPA routes:     ${spaRoutes.length}`);
console.log(`Prisma models:  ${models.length}`);
console.log(`BullMQ queues:  ${queues.length}`);
console.log(`Features:       ${features.size}`);
console.log(`\nWrote ${path.join(OUT_DIR, 'FEATURE_INVENTORY.json')}`);
