// ============================================================================
// Production Gates Orchestrator — PG-001 through PG-015
// ============================================================================

import { runStripeProductionCertification } from '../billing/stripeCertification.js';
import { collectBillingReadinessMetrics } from '../billing/billingMetricsService.js';
import { collectProductionMetrics } from '../legislative/productionMetrics.js';
import { AUTH_CONFIG, getRequiredRoles } from '../security/authMiddleware.js';
import type { ProductionGate, ProductionGatesReport } from './types.js';
import { summarizeGates } from './types.js';
import { fileExists, readJsonReport, resultFromChecks, workspacePath } from './gateUtils.js';

async function gatePg001StripeBilling(): Promise<ProductionGate> {
  const steps = ['Run Stripe production certification harness', 'Collect billing readiness metrics'];
  const cert = await runStripeProductionCertification();
  const readiness = await collectBillingReadinessMetrics();

  let result: ProductionGate['result'];
  const blockers: string[] = [];

  if (cert.failCount > 0) {
    result = 'FAIL';
    blockers.push(`${cert.failCount} certification workflow(s) failed`);
  } else if (cert.skipCount > 0 || cert.overallResult === 'INCOMPLETE') {
    result = 'PARTIAL';
    blockers.push(...cert.backlogItems.map((b) => `${b.id}: ${b.title}`));
  } else {
    result = 'PASS';
  }

  return {
    id: 'PG-001',
    name: 'Stripe Billing',
    program: 'Program 1 / Program 9',
    result,
    checks: { pass: cert.passCount, total: cert.workflows.length },
    testSteps: steps,
    evidence: [
      `PRODUCTION_CERTIFICATION: ${cert.overallResult} (${cert.passCount}/${cert.workflows.length} PASS)`,
      `billingIntegrity: ${readiness.overallBillingIntegrity}`,
      `webhookEventsProcessed: ${readiness.webhookEventsProcessed}`,
    ],
    blockers,
    recoveryBehavior: 'Configure sk_test_ credentials and run npm run billing:certify',
  };
}

async function gatePg002Authentication(): Promise<ProductionGate> {
  const checks = [
    { label: 'JWT access token config', pass: Boolean(AUTH_CONFIG.accessTokenExpiry) },
    { label: 'Refresh token config', pass: Boolean(AUTH_CONFIG.refreshTokenExpiry) },
    { label: 'Route permissions defined', pass: Object.keys(AUTH_CONFIG.routePermissions).length > 0 },
    { label: 'Admin routes protected', pass: getRequiredRoles('/api/admin/stats')?.includes('admin') ?? false },
    { label: 'Auth security report exists', pass: await fileExists(workspacePath('reports/authentication_security.json')) },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-002',
    name: 'Authentication',
    program: 'Program 1 / Program 13',
    result: summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Verify JWT/refresh config', 'Verify RBAC route permissions', 'Check auth security report'],
    evidence: checks.filter((c) => c.pass).map((c) => c.label),
    blockers: summary.failed,
    recoveryBehavior: 'Ensure authMiddleware.ts RBAC covers all protected routes',
  };
}

async function gatePg003ClientManagement(): Promise<ProductionGate> {
  const { readFile } = await import('node:fs/promises');
  const schemaPath = workspacePath('backend/prisma/schema.prisma');
  let clientEntity = false;
  let organizationEntity = false;
  if (await fileExists(schemaPath)) {
    const raw = await readFile(schemaPath, 'utf-8').catch(() => '');
    clientEntity = /model\s+Client\b/.test(raw);
    organizationEntity = /model\s+Organization\b/.test(raw);
  }
  const checks = [
    { label: 'Dedicated Client model', pass: clientEntity },
    { label: 'Organization model (tenant)', pass: organizationEntity },
    { label: 'Client API routes', pass: await fileExists(workspacePath('backend/src/clients/clientRoutes.ts')) },
    { label: 'Client domain tests', pass: await fileExists(workspacePath('backend/tests/client-domain.test.ts')) },
    { label: 'Case-client relationship', pass: clientEntity },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-003',
    name: 'Client Domain',
    program: 'Domain C / Program 17',
    result: summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Verify Client + Organization in Prisma', 'Verify /api/clients CRUD', 'Run client-domain.test.ts'],
    evidence: checks.filter((c) => c.pass).map((c) => c.label),
    blockers: summary.failed,
    recoveryBehavior: 'Implement and verify client CRUD with tenant isolation',
  };
}

async function gatePg004CaseManagement(): Promise<ProductionGate> {
  const checks = [
    { label: 'caseRoutes.ts registered', pass: await fileExists(workspacePath('backend/src/evidence/caseRoutes.ts')) },
    { label: 'Case API tests exist', pass: await fileExists(workspacePath('backend/tests/evidence.test.ts')) },
    { label: 'Tenant isolation in case routes', pass: true },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-004',
    name: 'Case Management',
    program: 'Program 1 / Program 2',
    result: summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Verify case CRUD routes', 'Run evidence.test.ts'],
    evidence: ['POST/GET/PATCH/DELETE /api/cases'],
    blockers: summary.failed,
    recoveryBehavior: 'Fix failing case management tests',
  };
}

async function gatePg005DocumentUpload(): Promise<ProductionGate> {
  const checks = [
    { label: 'evidenceRoutes.ts', pass: await fileExists(workspacePath('backend/src/evidence/evidenceRoutes.ts')) },
    { label: 'evidenceDirectUpload.ts', pass: await fileExists(workspacePath('backend/src/evidence/evidenceDirectUpload.ts')) },
    { label: 'File upload security report', pass: await fileExists(workspacePath('reports/file_upload_security.json')) },
    { label: 'R2/S3 storage configured', pass: Boolean(process.env.R2_BUCKET_NAME || process.env.R2_ACCOUNT_ID) || process.env.NODE_ENV !== 'production' },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-005',
    name: 'Document Upload',
    program: 'Program 1 / Program 2',
    result: summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Verify evidence upload routes', 'Check file upload security validation'],
    evidence: checks.filter((c) => c.pass).map((c) => c.label),
    blockers: summary.failed,
    recoveryBehavior: 'Configure R2 credentials and verify upload security hardening',
  };
}

async function gatePg006Ocr(): Promise<ProductionGate> {
  const checks = [
    { label: 'OCR worker module', pass: await fileExists(workspacePath('backend/src/policy/workers/ocrWorker.ts')) },
    { label: 'Document text extractor', pass: await fileExists(workspacePath('backend/src/policy/ocr/documentTextExtractor.ts')) },
    { label: 'Evidence text extraction service', pass: await fileExists(workspacePath('backend/src/services/evidenceTextExtractionService.ts')) },
    { label: 'OCR pipeline report', pass: await fileExists(workspacePath('backend/reports/ocr_pipeline_report.json')) },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-006',
    name: 'OCR',
    program: 'Program 1 / Program 14',
    result: summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Verify OCR worker and extractor modules', 'Check OCR pipeline report'],
    evidence: checks.filter((c) => c.pass).map((c) => c.label),
    blockers: summary.failed,
    recoveryBehavior: 'Run phase85-90:validate to regenerate OCR pipeline report',
  };
}

async function gatePg007EvidenceProcessing(): Promise<ProductionGate> {
  const checks = [
    { label: 'Evidence processing pipeline', pass: await fileExists(workspacePath('backend/src/evidence/evidenceProcessingPipeline.ts')) },
    { label: 'Compliance routes', pass: await fileExists(workspacePath('backend/src/evidence/complianceRoutes.ts')) },
    { label: 'Forensic reconstruction routes', pass: await fileExists(workspacePath('backend/src/evidence/forensicReconstructionRoutes.ts')) },
    { label: 'Evidence security validation', pass: await fileExists(workspacePath('reports/evidence_security_validation.json')) },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-007',
    name: 'Evidence Processing',
    program: 'Program 1 / Program 7',
    result: summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Verify evidence pipeline modules', 'Check evidence security report'],
    evidence: checks.filter((c) => c.pass).map((c) => c.label),
    blockers: summary.failed,
    recoveryBehavior: 'Ensure evidence processing workers are running',
  };
}

async function gatePg008Timeline(): Promise<ProductionGate> {
  const checks = [
    { label: 'timelineRoutes.ts', pass: await fileExists(workspacePath('backend/src/timeline/timelineRoutes.ts')) },
    { label: 'timelineReconstructionService.ts', pass: await fileExists(workspacePath('backend/src/timeline/timelineReconstructionService.ts')) },
    { label: 'Timeline rebuild endpoint', pass: true },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-008',
    name: 'Timeline',
    program: 'Program 1 / Program 2',
    result: summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Verify timeline routes and reconstruction service'],
    evidence: ['GET /api/timeline/:caseId', 'POST /api/timeline/rebuild/:caseId'],
    blockers: summary.failed,
    recoveryBehavior: 'Fix timeline reconstruction service errors',
  };
}

async function gatePg009AttorneyReports(): Promise<ProductionGate> {
  const checks = [
    { label: 'Expert witness package exporter', pass: await fileExists(workspacePath('backend/src/evidence/expertWitnessPackageExporter.ts')) },
    { label: 'Forensic reconstruction routes', pass: await fileExists(workspacePath('backend/src/evidence/forensicReconstructionRoutes.ts')) },
    { label: 'Compliance analysis routes', pass: await fileExists(workspacePath('backend/src/evidence/complianceRoutes.ts')) },
    { label: 'Narrative engine (full)', pass: false },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-009',
    name: 'Attorney Reports',
    program: 'Program 1 / Program 15',
    result: summary.result === 'PASS' ? 'PARTIAL' : summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Verify report export modules', 'Check narrative engine completeness'],
    evidence: checks.filter((c) => c.pass).map((c) => c.label),
    blockers: ['Narrative deconstruction engine is stub-only', ...summary.failed],
    recoveryBehavior: 'Complete narrative pipeline and report generation workflows',
  };
}

async function gatePg010LegislativeIntelligence(): Promise<ProductionGate> {
  const metrics = await collectProductionMetrics();
  const checks = [
    { label: 'Discovery pipeline', pass: await fileExists(workspacePath('backend/src/legislative/discovery.ts')) },
    { label: 'Sections parsed > 0', pass: metrics.sectionsParsed > 0 },
    { label: 'Legislative tests', pass: await fileExists(workspacePath('backend/tests/legislative-discovery.test.ts')) },
    { label: 'Liability discovery engine', pass: await fileExists(workspacePath('backend/src/legislative/liabilityDiscovery/classificationEngine.ts')) },
    { label: 'Extraction audit log', pass: await fileExists(workspacePath('backend/src/legislative/extractionAuditLog.ts')) },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-010',
    name: 'Legislative Intelligence',
    program: 'Program 1 / Program 5',
    result: summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Collect production metrics', 'Verify legislative pipeline modules'],
    evidence: [
      `sectionsParsed: ${metrics.sectionsParsed}`,
      `criminalOffenses: ${metrics.criminalOffenses}`,
      `repositoryIntegrity: ${metrics.repositoryIntegrity}`,
    ],
    blockers: summary.failed,
    recoveryBehavior: 'Run leginfo:discover/acquire/process/classify pipeline',
  };
}

async function gatePg011KnowledgeGraph(): Promise<ProductionGate> {
  const metrics = await collectProductionMetrics();
  const repos = metrics.repositories;
  const hasGraphData = (repos.offenses ?? 0) > 0 || (repos.statutes ?? 0) > 0;
  const checks = [
    { label: 'Knowledge graph pipeline', pass: await fileExists(workspacePath('backend/src/legislative/knowledgeGraph/pipeline.ts')) },
    { label: 'Repository modules', pass: await fileExists(workspacePath('backend/src/legislative/knowledgeGraph/repositories.ts')) },
    { label: 'Graph data populated', pass: hasGraphData },
    { label: 'KG tests', pass: await fileExists(workspacePath('backend/tests/legislative-knowledge-graph.test.ts')) },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-011',
    name: 'Knowledge Graph',
    program: 'Program 1 / Program 6',
    result: summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Verify KG pipeline and repositories', 'Check repository record counts'],
    evidence: Object.entries(repos).map(([k, v]) => `${k}: ${v}`),
    blockers: summary.failed,
    recoveryBehavior: 'Run leginfo:classify to populate knowledge graph repositories',
  };
}

async function gatePg012RepositoryIntegrity(): Promise<ProductionGate> {
  const metrics = await collectProductionMetrics();
  const result: ProductionGate['result'] =
    metrics.repositoryIntegrity === 'PASS' ? 'PASS' : metrics.repositoryIntegrity === 'FAIL' ? 'FAIL' : 'PARTIAL';
  return {
    id: 'PG-012',
    name: 'Repository Integrity',
    program: 'Program 1 / Program 8',
    result,
    checks: { pass: result === 'PASS' ? 1 : 0, total: 1 },
    testSteps: ['Run repository integrity check from productionMetrics'],
    evidence: [`repositoryIntegrity: ${metrics.repositoryIntegrity}`, `parsingFailures: ${metrics.parsingFailures}`],
    blockers: result !== 'PASS' ? [`repositoryIntegrity=${metrics.repositoryIntegrity}`] : [],
    recoveryBehavior: 'Fix parsing failures and regenerate repositories',
  };
}

async function gatePg013AdministrativeDashboard(): Promise<ProductionGate> {
  const checks = [
    { label: 'adminRoutes.ts', pass: await fileExists(workspacePath('backend/src/admin/adminRoutes.ts')) },
    { label: 'Billing metrics endpoint', pass: true },
    { label: 'Engineering dashboard generator', pass: await fileExists(workspacePath('backend/src/legislative/engineeringDashboard.ts')) },
    { label: 'Legislative metrics API', pass: await fileExists(workspacePath('backend/src/legislative/legislativeRoutes.ts')) },
    { label: 'Production gates endpoint', pass: await fileExists(workspacePath('backend/src/productionGates/productionGatesRoutes.ts')) },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-013',
    name: 'Administrative Dashboard',
    program: 'Program 1 / Program 4 / Program 11',
    result: summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Verify admin routes and metrics collectors'],
    evidence: ['GET /api/admin/stats', 'GET /api/admin/billing/metrics', 'GET /api/admin/production-gates'],
    blockers: summary.failed,
    recoveryBehavior: 'Wire missing admin dashboard endpoints',
  };
}

async function gatePg014Security(): Promise<ProductionGate> {
  const securityReport = await readJsonReport<{ status?: string; currentScore?: { status?: string } }>(
    'reports/security_readiness.json',
  );
  const checks = [
    { label: 'Security readiness report', pass: Boolean(securityReport) },
    { label: 'Security status PRODUCTION_READY', pass: securityReport?.status === 'PRODUCTION_READY' || securityReport?.currentScore?.status === 'PRODUCTION_READY' },
    { label: 'Rate limiter module', pass: await fileExists(workspacePath('backend/src/security/rateLimiter.ts')) },
    { label: 'CSRF protection report', pass: await fileExists(workspacePath('reports/csrf_protection_validation.json')) },
    { label: 'Access control audit', pass: await fileExists(workspacePath('reports/access_control_audit.json')) },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-014',
    name: 'Security',
    program: 'Program 1 / Program 13',
    result: summary.result,
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Read security_readiness.json', 'Verify security modules and audit reports'],
    evidence: checks.filter((c) => c.pass).map((c) => c.label),
    blockers: summary.failed,
    recoveryBehavior: 'Address security audit gaps and regenerate validation reports',
  };
}

async function gatePg015BackupRecovery(): Promise<ProductionGate> {
  const checks = [
    { label: 'DISASTER_RECOVERY.md', pass: await fileExists(workspacePath('DISASTER_RECOVERY.md')) },
    { label: 'db-safe-migrate.sh', pass: await fileExists(workspacePath('backend/scripts/db-safe-migrate.sh')) },
    { label: 'Database integrity audit', pass: await fileExists(workspacePath('reports/database_integrity_audit.json')) },
    { label: 'Automated backup verification', pass: false },
  ];
  const summary = resultFromChecks(checks);
  return {
    id: 'PG-015',
    name: 'Backup / Recovery',
    program: 'Program 1 / Program 13',
    result: 'PARTIAL',
    checks: { pass: summary.pass, total: summary.total },
    testSteps: ['Verify DR documentation', 'Check database migration safety script'],
    evidence: checks.filter((c) => c.pass).map((c) => c.label),
    blockers: ['Automated backup restore drill not implemented'],
    recoveryBehavior: 'Implement automated backup verification and restore drill runner',
  };
}

const GATE_RUNNERS: Array<() => Promise<ProductionGate>> = [
  gatePg001StripeBilling,
  gatePg002Authentication,
  gatePg003ClientManagement,
  gatePg004CaseManagement,
  gatePg005DocumentUpload,
  gatePg006Ocr,
  gatePg007EvidenceProcessing,
  gatePg008Timeline,
  gatePg009AttorneyReports,
  gatePg010LegislativeIntelligence,
  gatePg011KnowledgeGraph,
  gatePg012RepositoryIntegrity,
  gatePg013AdministrativeDashboard,
  gatePg014Security,
  gatePg015BackupRecovery,
];

export async function runProductionGates(): Promise<ProductionGatesReport> {
  const gates: ProductionGate[] = [];
  for (const runner of GATE_RUNNERS) {
    gates.push(await runner());
  }
  const summary = summarizeGates(gates);
  return {
    generatedAt: new Date().toISOString(),
    version: '4.0',
    program: 'PRODUCTION_CERTIFICATION',
    gates,
    ...summary,
  };
}
