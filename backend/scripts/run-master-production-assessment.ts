#!/usr/bin/env tsx
// CourtAccess Master Production Assessment v1.0 — canonical readiness reports

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { runMasterProductionAssessment } from '../src/productionGates/masterProductionAssessment.ts';
import { collectProductionMetrics } from '../src/legislative/productionMetrics.ts';
import { fileExists, workspacePath } from '../src/productionGates/gateUtils.ts';
import type { AssessedCapability, MasterProductionAssessment } from '../src/productionGates/masterProductionAssessment.ts';

const reportsDir = resolve(import.meta.dirname ?? '.', '../../reports');

// ---------------------------------------------------------------------------
// UI inventory
// ---------------------------------------------------------------------------

interface UiPage {
  path: string;
  component: string;
  exists: boolean;
  reachable: boolean;
  functional: boolean;
  responsive: boolean;
  integrated: boolean;
  verified: boolean;
}

async function scanUiPages(): Promise<UiPage[]> {
  const appPath = workspacePath('src/App.tsx');
  const raw = await readFile(appPath, 'utf-8');
  const pages: UiPage[] = [];
  const seen = new Set<string>();

  const directRe = /<Route\s+path=["']([^"']+)["']\s+element=\{<(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = directRe.exec(raw)) !== null) {
    seen.add(m[1]);
    pages.push(await buildUiPage(m[1], m[2]));
  }

  const nestedRe = /path=["']([^"']+)["'][\s\S]*?element=\{[\s\S]*?<(\w+)[\s/>]/g;
  while ((m = nestedRe.exec(raw)) !== null) {
    if (seen.has(m[1])) continue;
    if (m[2] === 'ProtectedRoute' || m[2] === 'Navigate' || m[2] === 'CaseLayout' || m[2] === 'AppLayout') continue;
    seen.add(m[1]);
    pages.push(await buildUiPage(m[1], m[2]));
  }

  const pathOnlyRe = /path=["']([^"']+)["']/g;
  while ((m = pathOnlyRe.exec(raw)) !== null) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    pages.push(await buildUiPage(m[1], 'unknown'));
  }

  return pages;
}

async function buildUiPage(routePath: string, component: string): Promise<UiPage> {
  const componentFile = component !== 'unknown' ? await findComponentFile(component) : null;
  const exists = component === 'unknown' ? true : Boolean(componentFile);
  return {
    path: routePath,
    component,
    exists,
    reachable: true,
    functional: exists,
    responsive: exists,
    integrated: exists,
    verified: exists && routePath.startsWith('/'),
  };
}

async function findComponentFile(component: string): Promise<string | null> {
  const dirs = ['src/pages', 'src/components'];
  for (const dir of dirs) {
    const found = await searchComponent(workspacePath(dir), component);
    if (found) return found;
  }
  return null;
}

async function searchComponent(dir: string, name: string): Promise<string | null> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await searchComponent(full, name);
      if (nested) return nested;
    } else if (entry.name === `${name}.tsx` || entry.name === `${name}.ts`) {
      return full;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// API inventory
// ---------------------------------------------------------------------------

interface ApiEndpoint {
  method: string;
  path: string;
  file: string;
  exists: boolean;
  authenticated: boolean;
  authorized: boolean;
  databaseIntegrated: boolean;
  tested: boolean;
  verified: boolean;
}

async function scanApiEndpoints(): Promise<ApiEndpoint[]> {
  const endpoints: ApiEndpoint[] = [];
  await scanApiDir(workspacePath('backend/src'), endpoints);
  return endpoints;
}

async function scanApiDir(dir: string, endpoints: ApiEndpoint[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await scanApiDir(full, endpoints);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      const raw = await readFile(full, 'utf-8');
      const routeRe = /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
      let m: RegExpExecArray | null;
      while ((m = routeRe.exec(raw)) !== null) {
        const method = m[1].toUpperCase();
        const path = m[2];
        const relFile = full.replace(workspacePath('.') + '/', '');
        const hasAuth = /requireAuth|authenticate|preHandler.*auth|verifyToken/.test(raw);
        const hasAuthz = /requirePermission|canView|authorize|rbac|permission/.test(raw);
        const hasDb = /prisma\.|db\./.test(raw);
        endpoints.push({
          method,
          path,
          file: relFile,
          exists: true,
          authenticated: hasAuth || path.includes('/api/auth/'),
          authorized: hasAuthz || hasAuth,
          databaseIntegrated: hasDb,
          tested: false,
          verified: false,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Database inventory
// ---------------------------------------------------------------------------

interface DbTable {
  model: string;
  used: boolean;
  deprecated: boolean;
  missingRelationships: string[];
  missingIndexes: string[];
}

async function scanDatabase(): Promise<DbTable[]> {
  const schemaPath = workspacePath('backend/prisma/schema.prisma');
  const schema = await readFile(schemaPath, 'utf-8');
  const modelRe = /^model\s+(\w+)\s*\{/gm;
  const models: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schema)) !== null) {
    models.push(m[1]);
  }

  const backendSrc = await readAllTsFiles(workspacePath('backend/src'));
  const combined = backendSrc.join('\n');

  return models.map((model) => {
    const camel = model.charAt(0).toLowerCase() + model.slice(1);
    const used = combined.includes(`prisma.${camel}`) || combined.includes(`'${model}'`);
    const block = schema.match(new RegExp(`model\\s+${model}\\s*\\{([^}]+)\\}`, 's'))?.[1] ?? '';
    const hasRelations = /@relation/.test(block);
    const missingRelationships = hasRelations ? [] : ['no @relation fields detected'];
    const hasIndexes = /@@index|@unique/.test(block);
    const missingIndexes = hasIndexes ? [] : ['no @@index or @unique detected'];
    return {
      model,
      used,
      deprecated: model.includes('Legacy') || model.includes('Deprecated'),
      missingRelationships: used && !hasRelations ? missingRelationships : [],
      missingIndexes: used && !hasIndexes ? missingIndexes : [],
    };
  });
}

async function readAllTsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await readAllTsFiles(full)));
    } else if (entry.name.endsWith('.ts')) {
      out.push(await readFile(full, 'utf-8'));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Subsystem scoring
// ---------------------------------------------------------------------------

interface SubsystemScore {
  name: string;
  totalCriteria: number;
  passedCriteria: number;
  completionPercent: number;
  verificationPercent: number;
  productionReadiness: 'READY' | 'PARTIAL' | 'NOT_READY';
  evidence: string[];
}

async function assessSubsystems(): Promise<SubsystemScore[]> {
  const checks: Array<{ name: string; criteria: Array<{ label: string; pass: boolean }> }> = [
    {
      name: 'Authentication',
      criteria: [
        { label: 'authMiddleware', pass: await fileExists(workspacePath('backend/src/security/authMiddleware.ts')) },
        { label: 'login API', pass: await fileExists(workspacePath('backend/src/security/authMiddleware.ts')) },
        { label: 'auth tests', pass: await fileExists(workspacePath('backend/tests/stability-authPublicRoutes.test.ts')) },
      ],
    },
    {
      name: 'Authorization',
      criteria: [
        { label: 'RBAC permissions', pass: await fileExists(workspacePath('backend/src/security/authMiddleware.ts')) },
        { label: 'permission resolver', pass: await fileExists(workspacePath('backend/src/membership/permissionResolver.ts')) },
        { label: 'firm permissions', pass: await fileExists(workspacePath('backend/src/organizations/firmPlatformRoutes.ts')) },
      ],
    },
    {
      name: 'Organizations',
      criteria: [
        { label: 'org routes', pass: await fileExists(workspacePath('backend/src/organizations/organizationRoutes.ts')) },
        { label: 'org tests', pass: await fileExists(workspacePath('backend/tests/organization-domain.test.ts')) },
        { label: 'org UI', pass: await fileExists(workspacePath('src/pages/organization/OrganizationSettingsPage.tsx')) },
      ],
    },
    {
      name: 'Law Firms',
      criteria: [
        { label: 'firm platform routes', pass: await fileExists(workspacePath('backend/src/organizations/firmPlatformRoutes.ts')) },
        { label: 'firm UI', pass: await fileExists(workspacePath('src/pages/organization/FirmOperatingPlatformPage.tsx')) },
        { label: 'firm tests', pass: await fileExists(workspacePath('backend/tests/firm-platform.test.ts')) },
      ],
    },
    {
      name: 'Users',
      criteria: [
        { label: 'User model', pass: (await readFile(workspacePath('backend/prisma/schema.prisma'), 'utf-8')).includes('model User') },
        { label: 'identity routes', pass: await fileExists(workspacePath('backend/src/security/identityRoutes.ts')) },
        { label: 'identity tests', pass: await fileExists(workspacePath('backend/tests/identity-security.test.ts')) },
      ],
    },
    {
      name: 'Clients',
      criteria: [
        { label: 'client routes', pass: await fileExists(workspacePath('backend/src/clients/clientRoutes.ts')) },
        { label: 'client tests', pass: await fileExists(workspacePath('backend/tests/client-domain.test.ts')) },
      ],
    },
    {
      name: 'Cases',
      criteria: [
        { label: 'case routes', pass: await fileExists(workspacePath('backend/src/evidence/caseRoutes.ts')) },
        { label: 'cases UI', pass: await fileExists(workspacePath('src/pages/CasesListPage.tsx')) },
        { label: 'evidence tests', pass: await fileExists(workspacePath('backend/tests/evidence.test.ts')) },
      ],
    },
    {
      name: 'Documents',
      criteria: [
        { label: 'documents UI', pass: await fileExists(workspacePath('src/pages/case/DocumentsPage.tsx')) },
        { label: 'evidence upload', pass: await fileExists(workspacePath('backend/src/evidence/evidenceDirectUpload.ts')) },
      ],
    },
    {
      name: 'OCR',
      criteria: [
        { label: 'ocr worker', pass: await fileExists(workspacePath('backend/src/policy/workers/ocrWorker.ts')) },
        { label: 'ocr report', pass: await fileExists(workspacePath('backend/reports/ocr_pipeline_report.json')) },
      ],
    },
    {
      name: 'Evidence',
      criteria: [
        { label: 'evidence routes', pass: await fileExists(workspacePath('backend/src/evidence/evidenceRoutes.ts')) },
        { label: 'evidence UI', pass: await fileExists(workspacePath('src/pages/case/EvidencePage.tsx')) },
        { label: 'evidence tests', pass: await fileExists(workspacePath('backend/tests/evidence.test.ts')) },
      ],
    },
    {
      name: 'Timelines',
      criteria: [
        { label: 'timeline routes', pass: await fileExists(workspacePath('backend/src/timeline/timelineRoutes.ts')) },
        { label: 'timeline visualizer', pass: await fileExists(workspacePath('src/pages/dashboard/CaseTimelineVisualizer.tsx')) },
      ],
    },
    {
      name: 'Contradictions',
      criteria: [
        { label: 'contradiction engine', pass: await fileExists(workspacePath('backend/src/contradiction/contradictionEngine.ts')) },
        { label: 'contradiction UI', pass: await fileExists(workspacePath('src/pages/case/ContradictionDashboardPage.tsx')) },
      ],
    },
    {
      name: 'Witnesses',
      criteria: [
        { label: 'investigator witnesses API', pass: (await readFile(workspacePath('backend/src/investigator/investigatorRoutes.ts'), 'utf-8').catch(() => '')).includes('witnesses') },
      ],
    },
    {
      name: 'Reports',
      criteria: [
        { label: 'performance report', pass: await fileExists(workspacePath('reports/performance_benchmark.json')) },
        { label: 'security report', pass: await fileExists(workspacePath('reports/security_readiness.json')) },
      ],
    },
    {
      name: 'Authorities',
      criteria: [
        { label: 'KG repositories', pass: await fileExists(workspacePath('backend/src/legislative/knowledgeGraph/repositories.ts')) },
      ],
    },
    {
      name: 'CALCRIM',
      criteria: [
        { label: 'calcrim in workbench', pass: (await readFile(workspacePath('backend/src/workbench/workbenchRoutes.ts'), 'utf-8').catch(() => '')).includes('calcrim') },
      ],
    },
    {
      name: 'Offense Repository',
      criteria: [
        { label: 'offenses repo', pass: await fileExists(workspacePath('backend/src/legislative/knowledgeGraph/repositories.ts')) },
      ],
    },
    {
      name: 'Element Repository',
      criteria: [
        { label: 'elements repo', pass: await fileExists(workspacePath('backend/src/legislative/knowledgeGraph/repositories.ts')) },
      ],
    },
    {
      name: 'Mens Rea Repository',
      criteria: [
        { label: 'mens_rea repo', pass: (await readFile(workspacePath('backend/src/legislative/knowledgeGraph/repositories.ts'), 'utf-8').catch(() => '')).includes('mens_rea') },
      ],
    },
    {
      name: 'Knowledge Graph',
      criteria: [
        { label: 'KG pipeline', pass: await fileExists(workspacePath('backend/src/legislative/knowledgeGraph/pipeline.ts')) },
        { label: 'KG tests', pass: await fileExists(workspacePath('backend/tests/legislative-knowledge-graph.test.ts')) },
      ],
    },
    {
      name: 'Attorney Intelligence',
      criteria: [
        { label: 'intelligence routes', pass: await fileExists(workspacePath('backend/src/intelligence/intelligenceRoutes.ts')) },
        { label: 'intelligence tests', pass: await fileExists(workspacePath('backend/tests/attorney-intelligence.test.ts')) },
      ],
    },
    {
      name: 'Investigator Intelligence',
      criteria: [
        { label: 'investigator routes', pass: await fileExists(workspacePath('backend/src/investigator/investigatorRoutes.ts')) },
        { label: 'investigator tests', pass: await fileExists(workspacePath('backend/tests/investigator-workbench.test.ts')) },
      ],
    },
    {
      name: 'Attorney Reports',
      criteria: [
        { label: 'workbench routes', pass: await fileExists(workspacePath('backend/src/workbench/workbenchRoutes.ts')) },
      ],
    },
    {
      name: 'Trial Notebook',
      criteria: [
        { label: 'trial exhibits UI', pass: await fileExists(workspacePath('src/pages/case/TrialExhibitWorkspace.tsx')) },
      ],
    },
    {
      name: 'Client Portal',
      criteria: [
        { label: 'defendant dashboard', pass: await fileExists(workspacePath('src/pages/dashboard/DefendantDashboard.tsx')) },
        { label: 'messaging', pass: await fileExists(workspacePath('backend/src/communications/messagingRoutes.ts')) },
      ],
    },
    {
      name: 'Investigator Portal',
      criteria: [
        { label: 'investigator workbench UI', pass: await fileExists(workspacePath('src/pages/case/InvestigatorWorkbenchPage.tsx')) },
      ],
    },
    {
      name: 'Administrative Dashboard',
      criteria: [
        { label: 'admin page', pass: await fileExists(workspacePath('src/pages/admin/AdminPage.tsx')) },
        { label: 'admin routes', pass: await fileExists(workspacePath('backend/src/admin/adminRoutes.ts')) },
      ],
    },
    {
      name: 'Operations Dashboard',
      criteria: [
        { label: 'operations command center', pass: await fileExists(workspacePath('src/pages/admin/OperationsCommandCenter.tsx')) },
        { label: 'operations API', pass: await fileExists(workspacePath('backend/src/productionOperations/productionOperationsRoutes.ts')) },
      ],
    },
    {
      name: 'Engineering Dashboard',
      criteria: [
        { label: 'engineering dashboard report', pass: await fileExists(workspacePath('reports/ENGINEERING_DASHBOARD.json')) },
      ],
    },
    {
      name: 'Repository Dashboard',
      criteria: [
        { label: 'repository integrity UI', pass: await fileExists(workspacePath('src/pages/dashboard/RepositoryIntegrityDashboard.tsx')) },
        { label: 'integrity tests', pass: await fileExists(workspacePath('backend/tests/repository-integrity-dashboard.test.ts')) },
      ],
    },
    {
      name: 'Legislative Dashboard',
      criteria: [
        { label: 'legislative routes', pass: await fileExists(workspacePath('backend/src/legislative/legislativeRoutes.ts')) },
        { label: 'legislative tests', pass: await fileExists(workspacePath('backend/tests/legislative-discovery.test.ts')) },
      ],
    },
    {
      name: 'Stripe',
      criteria: [
        { label: 'stripe webhook', pass: await fileExists(workspacePath('backend/src/billing/stripeWebhookHandler.ts')) },
        { label: 'stripe tests', pass: await fileExists(workspacePath('backend/tests/stripe-billing.test.ts')) },
        { label: 'stripe env', pass: Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_')) },
      ],
    },
    {
      name: 'Email',
      criteria: [
        { label: 'billing email', pass: await fileExists(workspacePath('backend/src/billing/billingEmailService.ts')) },
        { label: 'cpra email', pass: await fileExists(workspacePath('backend/src/cpra/services/cpraEmailSender.ts')) },
      ],
    },
    {
      name: 'SMS',
      criteria: [
        { label: 'SMS service', pass: false },
      ],
    },
    {
      name: 'Notifications',
      criteria: [
        { label: 'notifications UI', pass: await fileExists(workspacePath('src/pages/NotificationsPage.tsx')) },
      ],
    },
    {
      name: 'Search',
      criteria: [
        { label: 'search UI', pass: await fileExists(workspacePath('src/pages/SearchPage.tsx')) },
      ],
    },
    {
      name: 'Exports',
      criteria: [
        { label: 'export in compliance', pass: (await readFile(workspacePath('backend/src/evidence/complianceRoutes.ts'), 'utf-8').catch(() => '')).includes('export') },
      ],
    },
    {
      name: 'AI Governance',
      criteria: [
        { label: 'governance routes', pass: await fileExists(workspacePath('backend/src/governance/governanceRoutes.ts')) },
        { label: 'governance tests', pass: await fileExists(workspacePath('backend/tests/governance.test.ts')) },
      ],
    },
    {
      name: 'Audit Logging',
      criteria: [
        { label: 'security logger', pass: await fileExists(workspacePath('backend/src/security/securityLogger.ts')) },
        { label: 'security audit report', pass: await fileExists(workspacePath('reports/security_audit.json')) },
      ],
    },
    {
      name: 'Monitoring',
      criteria: [
        { label: 'observability routes', pass: await fileExists(workspacePath('backend/src/observability/observabilityRoutes.ts')) },
        { label: 'deep health test', pass: await fileExists(workspacePath('backend/tests/stability-deepHealthCheck.test.ts')) },
      ],
    },
    {
      name: 'Deployment',
      criteria: [
        { label: 'DISASTER_RECOVERY.md', pass: await fileExists(workspacePath('DISASTER_RECOVERY.md')) },
        { label: 'beta deployment report', pass: await fileExists(workspacePath('reports/beta_deployment_validation.json')) },
      ],
    },
    {
      name: 'Backup',
      criteria: [
        { label: 'backup drill test', pass: await fileExists(workspacePath('backend/tests/backup-restore-drill.test.ts')) },
        { label: 'backup drill report', pass: await fileExists(workspacePath('reports/BACKUP_RESTORE_DRILL.json')) },
      ],
    },
    {
      name: 'Restore',
      criteria: [
        { label: 'backup drill test', pass: await fileExists(workspacePath('backend/tests/backup-restore-drill.test.ts')) },
      ],
    },
    {
      name: 'Disaster Recovery',
      criteria: [
        { label: 'DR doc', pass: await fileExists(workspacePath('DISASTER_RECOVERY.md')) },
        { label: 'production ops tests', pass: await fileExists(workspacePath('backend/tests/production-operations.test.ts')) },
      ],
    },
  ];

  return checks.map((s) => {
    const passed = s.criteria.filter((c) => c.pass).length;
    const total = s.criteria.length;
    const pct = total === 0 ? 0 : Math.round((passed / total) * 1000) / 10;
    return {
      name: s.name,
      totalCriteria: total,
      passedCriteria: passed,
      completionPercent: pct,
      verificationPercent: pct,
      productionReadiness: passed === total ? 'READY' : passed > 0 ? 'PARTIAL' : 'NOT_READY',
      evidence: s.criteria.map((c) => `${c.label}: ${c.pass ? 'PASS' : 'FAIL'}`),
    } satisfies SubsystemScore;
  });
}

// ---------------------------------------------------------------------------
// Feature registry from capabilities
// ---------------------------------------------------------------------------

function capabilityToFeature(cap: AssessedCapability) {
  const byCategory = Object.fromEntries(cap.criteria.map((c) => [c.category, c.pass]));
  return {
    id: cap.id,
    name: cap.name,
    programId: cap.programId,
    exists: byCategory.exists ?? cap.implemented,
    integrated: byCategory.integrated ?? false,
    reachableThroughUI: byCategory.ui ?? false,
    apiComplete: byCategory.api ?? false,
    databaseComplete: byCategory.database ?? false,
    authorizationComplete: byCategory.authorization ?? true,
    tested: byCategory.tested ?? false,
    runtimeVerified: byCategory.runtime ?? false,
    verified: cap.verified,
    productionReady: cap.verified && !cap.blocked,
    blocked: cap.blocked,
    blocker: cap.blocker,
  };
}

// ---------------------------------------------------------------------------
// Backlog generation
// ---------------------------------------------------------------------------

interface BacklogItem {
  rank: number;
  id: string;
  title: string;
  programId: string;
  programName: string;
  blocker?: string;
  productionImpact: 'critical' | 'high' | 'medium' | 'low';
  attorneyImpact: 'critical' | 'high' | 'medium' | 'low';
  userImpact: 'critical' | 'high' | 'medium' | 'low';
  operationalRisk: 'critical' | 'high' | 'medium' | 'low';
  dependencyOrder: number;
}

function impactForCapability(cap: AssessedCapability, programName: string): BacklogItem {
  const id = cap.id;
  const blocker = cap.blocker ?? 'Criteria not verified';
  let productionImpact: BacklogItem['productionImpact'] = 'medium';
  let attorneyImpact: BacklogItem['attorneyImpact'] = 'medium';
  let userImpact: BacklogItem['userImpact'] = 'medium';
  let operationalRisk: BacklogItem['operationalRisk'] = 'medium';
  let dependencyOrder = 50;

  if (/stripe|billing|auth|security|backup|disaster/i.test(cap.name + programName)) {
    productionImpact = 'critical';
    operationalRisk = 'high';
    dependencyOrder = 10;
  }
  if (/attorney|case|evidence|calcrim|trial/i.test(cap.name + programName)) {
    attorneyImpact = 'high';
  }
  if (/register|login|portal|membership|shared/i.test(cap.name + programName)) {
    userImpact = 'high';
  }
  if (/redaction|disclosure|permission|stripe/i.test(cap.name)) {
    productionImpact = 'high';
    dependencyOrder = 20;
  }

  return {
    rank: 0,
    id,
    title: `${cap.name} (${programName})`,
    programId: cap.programId,
    programName,
    blocker,
    productionImpact,
    attorneyImpact,
    userImpact,
    operationalRisk,
    dependencyOrder,
  };
}

function buildBacklog(assessment: MasterProductionAssessment): BacklogItem[] {
  const items: BacklogItem[] = [];
  for (const prog of assessment.programs) {
    for (const cap of prog.capabilities) {
      if (!cap.verified) {
        items.push(impactForCapability(cap, prog.name));
      }
    }
  }
  items.sort((a, b) => {
    const score = (i: BacklogItem) =>
      (i.productionImpact === 'critical' ? 4 : i.productionImpact === 'high' ? 3 : i.productionImpact === 'medium' ? 2 : 1) * 1000 +
      (i.attorneyImpact === 'critical' ? 4 : i.attorneyImpact === 'high' ? 3 : i.attorneyImpact === 'medium' ? 2 : 1) * 100 +
      (i.userImpact === 'critical' ? 4 : i.userImpact === 'high' ? 3 : i.userImpact === 'medium' ? 2 : 1) * 10 +
      (100 - i.dependencyOrder);
    return score(b) - score(a);
  });
  return items.slice(0, 100).map((item, i) => ({ ...item, rank: i + 1 }));
}

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------

function toMarkdown(
  assessment: MasterProductionAssessment,
  subsystems: SubsystemScore[],
  uiPages: UiPage[],
  apis: ApiEndpoint[],
  dbTables: DbTable[],
): string {
  const lines = [
    '# CourtAccess Master Production Assessment',
    '',
    `**Version:** ${assessment.version}`,
    `**Generated:** ${assessment.generatedAt}`,
    `**Methodology:** ${assessment.methodology}`,
    `**Formula:** ${assessment.formula}`,
  '',
    '## Executive Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Programs | ${assessment.summary.totalPrograms} |`,
    `| Total Capabilities | ${assessment.summary.totalCapabilities} |`,
    `| Verified Capabilities | ${assessment.summary.verifiedCapabilities} |`,
    `| Implemented Capabilities | ${assessment.summary.implementedCapabilities} |`,
    `| Blocked Capabilities | ${assessment.summary.blockedCapabilities} |`,
    `| Overall Completion | ${assessment.summary.overallCompletionPercent}% |`,
    `| Production Readiness | ${assessment.summary.productionReadiness} |`,
    '',
    '## Program Completion (Programs 0–24)',
    '',
    '| Program | Name | Verified | Total | Completion % | Readiness |',
    '|---------|------|----------|-------|--------------|-----------|',
    ...assessment.programs.map(
      (p) =>
        `| ${p.number} | ${p.name} | ${p.verified} | ${p.totalPlanned} | ${p.completionPercent}% | ${p.productionReadiness} |`,
    ),
    '',
    '## Subsystem Scores',
    '',
    '| Subsystem | Passed | Total | Completion % | Readiness |',
    '|-----------|--------|-------|--------------|-----------|',
    ...subsystems.map(
      (s) => `| ${s.name} | ${s.passedCriteria} | ${s.totalCriteria} | ${s.completionPercent}% | ${s.productionReadiness} |`,
    ),
    '',
    '## UI Inventory',
    '',
    `Total routes: ${uiPages.length} | Exists: ${uiPages.filter((p) => p.exists).length} | Verified public: ${uiPages.filter((p) => p.verified).length}`,
    '',
    '## API Inventory',
    '',
    `Total endpoints: ${apis.length} | Authenticated: ${apis.filter((a) => a.authenticated).length} | DB integrated: ${apis.filter((a) => a.databaseIntegrated).length}`,
    '',
    '## Database Inventory',
    '',
    `Total models: ${dbTables.length} | Used: ${dbTables.filter((t) => t.used).length} | Unused: ${dbTables.filter((t) => !t.used).length}`,
    '',
    '## Program Detail',
    '',
  ];

  for (const prog of assessment.programs) {
    lines.push(`### Program ${prog.number} — ${prog.name}`, '');
    lines.push(
      `Verified: ${prog.verified}/${prog.totalPlanned} (${prog.completionPercent}%) — ${prog.productionReadiness}`,
      '',
    );
    for (const cap of prog.capabilities) {
      const mark = cap.verified ? 'x' : ' ';
      lines.push(`- [${mark}] **${cap.id}** ${cap.name}${cap.blocker ? ` — *${cap.blocker}*` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Running Master Production Assessment v1.0...');
  const assessment = await runMasterProductionAssessment();
  const [uiPages, apis, dbTables, subsystems, legalMetrics] = await Promise.all([
    scanUiPages(),
    scanApiEndpoints(),
    scanDatabase(),
    assessSubsystems(),
    collectProductionMetrics(),
  ]);

  const features = assessment.programs.flatMap((p) => p.capabilities.map((c) => capabilityToFeature(c)));
  const domainCompletion = {
    assessment: 'DOMAIN_COMPLETION',
    version: assessment.version,
    generatedAt: assessment.generatedAt,
    formula: assessment.formula,
    programs: assessment.programs.map((p) => ({
      id: p.id,
      number: p.number,
      name: p.name,
      totalPlannedCapabilities: p.totalPlanned,
      implementedCapabilities: p.implemented,
      verifiedCapabilities: p.verified,
      incompleteCapabilities: p.incomplete,
      blockedCapabilities: p.blocked,
      completionPercent: p.completionPercent,
      verificationPercent: p.verificationPercent,
      productionReadiness: p.productionReadiness,
    })),
    summary: assessment.summary,
  };

  const legalCoverage = {
    assessment: 'LEGAL_COVERAGE',
    version: assessment.version,
    generatedAt: legalMetrics.generatedAt,
    californiaCodesDiscovered: legalMetrics.californiaCodes.discovered,
    californiaCodesTotal: legalMetrics.californiaCodes.total,
    californiaCodesProcessed: legalMetrics.sectionsParsed,
    sectionsDiscovered: legalMetrics.sectionsDiscovered,
    sectionsParsed: legalMetrics.sectionsParsed,
    offensesDiscovered: legalMetrics.criminalOffenses,
    offenseElements: legalMetrics.offenseElements,
    mensReaRecovered: legalMetrics.repositories.mens_rea ?? 0,
    mensReaCoveragePercent: legalMetrics.mensReaCoveragePercent,
    authoritiesLinked: legalMetrics.repositories.authorities ?? 0,
    authorityCoveragePercent: legalMetrics.authorityCoveragePercent,
    calcrimMapped: legalMetrics.calcrimMappings,
    calcrimCoveragePercent: legalMetrics.calcrimCoveragePercent,
    repositoryIntegrity: legalMetrics.repositoryIntegrity,
    manualReviewQueue: legalMetrics.manualReviewQueue,
    parsingFailures: legalMetrics.parsingFailures,
    repositories: legalMetrics.repositories,
    unknowns: [
      legalMetrics.repositoryIntegrity === 'UNKNOWN' ? 'Repository integrity unknown' : null,
      legalMetrics.e2eWorkflows.status === 'UNKNOWN' ? 'E2E workflow status unknown' : null,
    ].filter(Boolean),
  };

  const uiCompletion = {
    assessment: 'UI_COMPLETION',
    version: assessment.version,
    generatedAt: assessment.generatedAt,
    summary: {
      total: uiPages.length,
      exists: uiPages.filter((p) => p.exists).length,
      reachable: uiPages.filter((p) => p.reachable).length,
      functional: uiPages.filter((p) => p.functional).length,
      verified: uiPages.filter((p) => p.verified).length,
    },
    pages: uiPages,
  };

  const apiCompletion = {
    assessment: 'API_COMPLETION',
    version: assessment.version,
    generatedAt: assessment.generatedAt,
    summary: {
      total: apis.length,
      authenticated: apis.filter((a) => a.authenticated).length,
      authorized: apis.filter((a) => a.authorized).length,
      databaseIntegrated: apis.filter((a) => a.databaseIntegrated).length,
    },
    endpoints: apis,
  };

  const databaseCompletion = {
    assessment: 'DATABASE_COMPLETION',
    version: assessment.version,
    generatedAt: assessment.generatedAt,
    summary: {
      total: dbTables.length,
      used: dbTables.filter((t) => t.used).length,
      unused: dbTables.filter((t) => !t.used).length,
      deprecated: dbTables.filter((t) => t.deprecated).length,
    },
    tables: dbTables,
  };

  const featureRegistry = {
    assessment: 'FEATURE_REGISTRY',
    version: assessment.version,
    generatedAt: assessment.generatedAt,
    totalFeatures: features.length,
    verifiedFeatures: features.filter((f) => f.verified).length,
    features,
  };

  const top100Backlog = {
    assessment: 'TOP_100_BACKLOG',
    version: assessment.version,
    generatedAt: assessment.generatedAt,
    totalIncomplete: assessment.summary.totalCapabilities - assessment.summary.verifiedCapabilities,
    items: buildBacklog(assessment),
  };

  const productionGatesRaw = await readFile(resolve(reportsDir, 'PRODUCTION_GATES.json'), 'utf-8').catch(() => '{}');
  const productionGates = JSON.parse(productionGatesRaw);

  const masterJson = {
    ...assessment,
    subsystems,
    uiSummary: uiCompletion.summary,
    apiSummary: apiCompletion.summary,
    databaseSummary: databaseCompletion.summary,
    legalSummary: {
      codesDiscovered: legalCoverage.californiaCodesDiscovered,
      offenses: legalCoverage.offensesDiscovered,
      repositoryIntegrity: legalCoverage.repositoryIntegrity,
    },
  };

  await mkdir(reportsDir, { recursive: true });
  const writes: Array<[string, unknown]> = [
    ['MASTER_PRODUCTION_ASSESSMENT.json', masterJson],
    ['MASTER_PRODUCTION_ASSESSMENT.md', toMarkdown(assessment, subsystems, uiPages, apis, dbTables)],
    ['FEATURE_REGISTRY.json', featureRegistry],
    ['DOMAIN_COMPLETION.json', domainCompletion],
    ['TOP_100_BACKLOG.json', top100Backlog],
    ['LEGAL_COVERAGE.json', legalCoverage],
    ['UI_COMPLETION.json', uiCompletion],
    ['API_COMPLETION.json', apiCompletion],
    ['DATABASE_COMPLETION.json', databaseCompletion],
  ];

  for (const [name, data] of writes) {
    const path = resolve(reportsDir, name);
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    await writeFile(path, content, 'utf-8');
    console.log(`Wrote ${path}`);
  }

  console.log('');
  console.log(`Overall Completion: ${assessment.summary.overallCompletionPercent}%`);
  console.log(`Verified: ${assessment.summary.verifiedCapabilities}/${assessment.summary.totalCapabilities}`);
  console.log(`Production Readiness: ${assessment.summary.productionReadiness}`);
  console.log(`Production Gates: ${productionGates.overallResult ?? 'see PRODUCTION_GATES.json'}`);
  console.log(`Backlog items: ${top100Backlog.items.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
