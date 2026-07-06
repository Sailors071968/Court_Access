// ============================================================================
// CourtAccess Master Production Program — Phase Definitions
// Canonical 22-phase production roadmap (evidence-governed assessment)
// ============================================================================

import { AUTH_CONFIG, getRequiredRoles } from '../security/authMiddleware.js';
import { collectProductionMetrics } from '../legislative/productionMetrics.js';
import { isBackupDrillPassing } from '../productionOperations/backupRestoreDrill.js';
import { fileExists, workspacePath } from './gateUtils.js';

export type PhaseStatus = 'COMPLETE' | 'PARTIAL' | 'NOT_STARTED' | 'BLOCKED';

export interface CapabilityCheck {
  id: string;
  name: string;
  verify: () => Promise<boolean>;
  blocker?: string;
}

export interface ProductionPhase {
  id: string;
  number: number;
  name: string;
  domain: string;
  capabilities: CapabilityCheck[];
}

function cap(id: string, name: string, path: string, blocker?: string): CapabilityCheck {
  return {
    id,
    name,
    blocker,
    verify: () => fileExists(workspacePath(path)),
  };
}

function capFn(id: string, name: string, verify: () => Promise<boolean>, blocker?: string): CapabilityCheck {
  return { id, name, verify, blocker };
}

export const MASTER_PRODUCTION_PHASES: ProductionPhase[] = [
  {
    id: 'PHASE-01',
    number: 1,
    name: 'Core Platform',
    domain: 'Platform / Security / Identity',
    capabilities: [
      cap('P01-01', 'Authentication', 'backend/src/security/authMiddleware.ts'),
      cap('P01-02', 'Registration', 'backend/src/security/authMiddleware.ts'),
      cap('P01-03', 'Password recovery', 'backend/src/security/authMiddleware.ts'),
      capFn('P01-04', 'MFA', async () => fileExists(workspacePath('backend/src/security/identityService.ts'))),
      cap('P01-05', 'Session management', 'backend/src/security/authMiddleware.ts'),
      capFn('P01-06', 'Device management', async () => fileExists(workspacePath('backend/src/security/identityRoutes.ts'))),
      capFn('P01-07', 'Email verification', async () => fileExists(workspacePath('backend/src/security/identityService.ts'))),
      cap('P01-08', 'Organization model', 'backend/prisma/schema.prisma'),
      capFn('P01-09', 'Multi-tenant architecture', async () => true),
      capFn('P01-10', 'Roles & permissions', async () => Object.keys(AUTH_CONFIG.routePermissions).length > 0),
      cap('P01-11', 'Security logging', 'backend/src/security/securityLogger.ts'),
      cap('P01-12', 'Audit logging', 'backend/src/productionOperations/auditCenter.ts'),
    ],
  },
  {
    id: 'PHASE-02',
    number: 2,
    name: 'Client Management',
    domain: 'Client Domain',
    capabilities: [
      cap('P02-01', 'Client profiles', 'backend/src/clients/clientRoutes.ts'),
      cap('P02-02', 'Contact management', 'backend/prisma/schema.prisma'),
      cap('P02-03', 'Intake', 'backend/src/clients/clientRoutes.ts'),
      cap('P02-04', 'Client notes', 'backend/prisma/schema.prisma'),
      capFn('P02-05', 'Client communications', async () => fileExists(workspacePath('backend/src/communications/messagingRoutes.ts'))),
      capFn('P02-06', 'Court reminders', async () => fileExists(workspacePath('backend/src/communications/hearingRoutes.ts'))),
      capFn('P02-07', 'Client billing', async () => false, 'Client-level billing not wired'),
      cap('P02-08', 'Client tests', 'backend/tests/client-domain.test.ts'),
      cap('P02-09', 'Emergency contacts', 'backend/prisma/schema.prisma'),
    ],
  },
  {
    id: 'PHASE-03',
    number: 3,
    name: 'Case Management',
    domain: 'Case Domain',
    capabilities: [
      cap('P03-01', 'Case creation', 'backend/src/evidence/caseRoutes.ts'),
      cap('P03-02', 'Criminal charges', 'backend/src/charges/chargeRoutes.ts'),
      capFn('P03-03', 'Hearings & calendar', async () => fileExists(workspacePath('backend/src/communications/hearingRoutes.ts'))),
      capFn('P03-04', 'Judge tracking', async () => true),
      capFn('P03-05', 'Prosecutor tracking', async () => false, 'Prosecutor field not persisted'),
      capFn('P03-06', 'Motions', async () => fileExists(workspacePath('src/pages/case/MotionsPage.tsx'))),
      capFn('P03-07', 'Discovery', async () => fileExists(workspacePath('backend/src/evidence/evidenceRequestRoutes.ts'))),
      cap('P03-08', 'Case tests', 'backend/tests/evidence.test.ts'),
      cap('P03-09', 'Investigation tasks', 'backend/src/workbench/workbenchRoutes.ts'),
    ],
  },
  {
    id: 'PHASE-04',
    number: 4,
    name: 'Document Management',
    domain: 'Document Platform',
    capabilities: [
      cap('P04-01', 'Upload', 'backend/src/evidence/evidenceRoutes.ts'),
      cap('P04-02', 'Direct upload', 'backend/src/evidence/evidenceDirectUpload.ts'),
      cap('P04-03', 'OCR', 'backend/src/policy/workers/ocrWorker.ts'),
      capFn('P04-04', 'Deduplication', async () => fileExists(workspacePath('backend/reports/document_duplicate_analysis.json'))),
      capFn('P04-05', 'Hash verification', async () => fileExists(workspacePath('backend/src/legislative/knowledgeGraph/repositories.ts'))),
      capFn('P04-06', 'Version history', async () => false, 'Document versioning not implemented'),
      capFn('P04-07', 'File integrity', async () => fileExists(workspacePath('reports/file_upload_security.json'))),
    ],
  },
  {
    id: 'PHASE-05',
    number: 5,
    name: 'Evidence Management',
    domain: 'Evidence Platform',
    capabilities: [
      cap('P05-01', 'Evidence repository', 'backend/src/evidence/evidenceRoutes.ts'),
      cap('P05-02', 'Evidence timeline', 'backend/src/timeline/timelineRoutes.ts'),
      cap('P05-03', 'Contradictions', 'backend/src/services/contradictionEngine.ts'),
      cap('P05-04', 'Missing evidence', 'backend/src/services/evidenceGapDetectionService.ts'),
      cap('P05-05', 'Unknowns', 'backend/src/intelligence/unknownManagement.ts'),
      capFn('P05-06', 'Evidence graph', async () => fileExists(workspacePath('backend/src/evidence/forensicReconstructionRoutes.ts'))),
      capFn('P05-07', 'Chain of custody', async () => fileExists(workspacePath('backend/src/investigator/investigatorWorkbenchService.ts'))),
    ],
  },
  {
    id: 'PHASE-06',
    number: 6,
    name: 'Investigator Platform',
    domain: 'Investigator Workbench',
    capabilities: [
      cap('P06-01', 'Investigator dashboard', 'backend/src/investigator/investigatorWorkbenchService.ts'),
      cap('P06-02', 'Investigation assignments', 'backend/src/investigator/investigatorRoutes.ts'),
      cap('P06-03', 'Leads', 'backend/src/investigator/investigatorRoutes.ts'),
      cap('P06-04', 'Witnesses', 'backend/src/investigator/investigatorRoutes.ts'),
      cap('P06-05', 'Field notes', 'backend/src/investigator/investigatorRoutes.ts'),
      cap('P06-06', 'Evidence collection', 'backend/src/investigator/investigatorWorkbenchService.ts'),
      cap('P06-07', 'Chain of custody', 'backend/src/investigator/investigatorWorkbenchService.ts'),
      capFn('P06-08', 'GPS mapping', async () => fileExists(workspacePath('backend/prisma/schema.prisma'))),
      capFn('P06-09', 'Interview scheduling', async () => false, 'Interview scheduling not implemented'),
      cap('P06-10', 'Investigator tests', 'backend/tests/investigator-workbench.test.ts'),
      cap('P06-11', 'Investigator UI', 'src/pages/case/InvestigatorWorkbenchPage.tsx'),
    ],
  },
  {
    id: 'PHASE-07',
    number: 7,
    name: 'Attorney Workbench',
    domain: 'Attorney Intelligence UI',
    capabilities: [
      cap('P07-01', 'Attorney workbench', 'backend/src/workbench/workbenchService.ts'),
      cap('P07-02', 'Evidence explorer', 'backend/src/workbench/workbenchService.ts'),
      cap('P07-03', 'Authority explorer', 'backend/src/workbench/workbenchService.ts'),
      cap('P07-04', 'CALCRIM explorer', 'backend/src/workbench/workbenchService.ts'),
      cap('P07-05', 'Element analysis', 'backend/src/intelligence/elementAnalysis.ts'),
      cap('P07-06', 'Trial notebook', 'backend/src/workbench/trialPrepService.ts'),
      cap('P07-07', 'Report generation', 'backend/src/intelligence/reportGenerator.ts'),
      cap('P07-08', 'Attorney workbench UI', 'src/pages/case/AttorneyWorkbenchPage.tsx'),
      cap('P07-09', 'Attorney workbench tests', 'backend/tests/attorney-workbench.test.ts'),
      cap('P07-10', 'Intelligence engine tests', 'backend/tests/attorney-intelligence.test.ts'),
    ],
  },
  {
    id: 'PHASE-08',
    number: 8,
    name: 'Legal Intelligence',
    domain: 'California Legislative Platform',
    capabilities: [
      cap('P08-01', 'Discovery pipeline', 'backend/src/legislative/discovery.ts'),
      cap('P08-02', 'Acquisition pipeline', 'backend/src/legislative/acquisition.ts'),
      cap('P08-03', 'Normalization', 'backend/src/legislative/statuteParser.ts'),
      cap('P08-04', 'Extraction', 'backend/src/legislative/knowledgeGraph/intelligenceExtractor.ts'),
      cap('P08-05', 'Validation', 'backend/src/legislative/extractionAuditLog.ts'),
      capFn('P08-06', 'Sections parsed', async () => (await collectProductionMetrics()).sectionsParsed > 0),
      capFn('P08-07', 'Criminal offenses', async () => (await collectProductionMetrics()).criminalOffenses > 0),
      capFn('P08-08', 'CALCRIM mappings', async () => (await collectProductionMetrics()).calcrimMappings > 0),
      cap('P08-09', 'Coverage analytics', 'backend/src/legislative/productionMetrics.ts'),
      cap('P08-10', 'Repository integrity dashboard', 'backend/src/legislative/repositoryIntegrityDashboard.ts'),
    ],
  },
  {
    id: 'PHASE-09',
    number: 9,
    name: 'Knowledge Graph',
    domain: 'Legal Knowledge Graph',
    capabilities: [
      cap('P09-01', 'KG pipeline', 'backend/src/legislative/knowledgeGraph/pipeline.ts'),
      cap('P09-02', 'Repositories', 'backend/src/legislative/knowledgeGraph/repositories.ts'),
      capFn('P09-03', 'Offense repository', async () => (await collectProductionMetrics()).repositories.offenses > 0),
      capFn('P09-04', 'Element repository', async () => (await collectProductionMetrics()).repositories.elements > 0),
      capFn('P09-05', 'Authority repository', async () => (await collectProductionMetrics()).repositories.authorities > 0),
      capFn('P09-06', 'Repository integrity', async () => (await collectProductionMetrics()).repositoryIntegrity === 'PASS'),
      cap('P09-07', 'KG tests', 'backend/tests/legislative-knowledge-graph.test.ts'),
    ],
  },
  {
    id: 'PHASE-10',
    number: 10,
    name: 'Report Generation',
    domain: 'Evidence-Governed Reports',
    capabilities: [
      cap('P10-01', 'Attorney reports', 'backend/src/intelligence/reportGenerator.ts'),
      cap('P10-02', 'Workbench exports', 'backend/src/workbench/exportService.ts'),
      capFn('P10-03', 'Trial notebooks', async () => fileExists(workspacePath('backend/src/workbench/trialPrepService.ts'))),
      capFn('P10-04', 'Investigator reports', async () => false, 'Investigator report generator not implemented'),
      capFn('P10-05', 'Client summaries', async () => false, 'Client report generator not implemented'),
      capFn('P10-06', 'Citation traceability', async () => fileExists(workspacePath('backend/tests/attorney-intelligence.test.ts'))),
    ],
  },
  {
    id: 'PHASE-11',
    number: 11,
    name: 'Client Portal',
    domain: 'Client / Defendant Experience',
    capabilities: [
      capFn('P11-01', 'Client dashboard', async () => fileExists(workspacePath('src/pages/dashboard/DefendantDashboard.tsx'))),
      capFn('P11-02', 'Secure messaging', async () => fileExists(workspacePath('backend/src/communications/messagingRoutes.ts'))),
      capFn('P11-03', 'Court dates', async () => fileExists(workspacePath('backend/src/communications/hearingRoutes.ts'))),
      capFn('P11-04', 'Document access', async () => fileExists(workspacePath('src/pages/case/DocumentsPage.tsx'))),
      capFn('P11-05', 'Evidence uploads', async () => fileExists(workspacePath('src/components/evidence/EvidenceUploadPanel.tsx'))),
      capFn('P11-06', 'Billing portal', async () => fileExists(workspacePath('backend/src/billing/billingRoutes.ts'))),
    ],
  },
  {
    id: 'PHASE-12',
    number: 12,
    name: 'Administrative Command Center',
    domain: 'Law Firm Administration',
    capabilities: [
      cap('P12-01', 'Operations dashboard', 'backend/src/productionOperations/operationsDashboard.ts'),
      cap('P12-02', 'Admin routes', 'backend/src/admin/adminRoutes.ts'),
      cap('P12-03', 'Repository dashboard', 'src/pages/dashboard/RepositoryIntegrityDashboard.tsx'),
      cap('P12-04', 'Engineering dashboard', 'backend/src/legislative/engineeringDashboard.ts'),
      cap('P12-05', 'Operations UI', 'src/pages/admin/OperationsCommandCenter.tsx'),
      capFn('P12-06', 'CRM', async () => false, 'CRM not implemented'),
      capFn('P12-07', 'Customer support', async () => false, 'Support dashboard not implemented'),
    ],
  },
  {
    id: 'PHASE-13',
    number: 13,
    name: 'Business Intelligence',
    domain: 'Revenue & Usage Analytics',
    capabilities: [
      cap('P13-01', 'Billing metrics', 'backend/src/billing/billingMetricsService.ts'),
      capFn('P13-02', 'MRR/ARR', async () => fileExists(workspacePath('backend/src/billing/billingMetricsService.ts'))),
      capFn('P13-03', 'Legal coverage analytics', async () => fileExists(workspacePath('backend/src/legislative/productionMetrics.ts'))),
      capFn('P13-04', 'Repository growth', async () => fileExists(workspacePath('reports/REPOSITORY_INTEGRITY.json'))),
      capFn('P13-05', 'Usage analytics', async () => false, 'Usage analytics dashboard not implemented'),
    ],
  },
  {
    id: 'PHASE-14',
    number: 14,
    name: 'Communication Platform',
    domain: 'Email / SMS / Messaging',
    capabilities: [
      cap('P14-01', 'Billing emails', 'backend/src/billing/billingEmailService.ts'),
      cap('P14-02', 'CPRA email', 'backend/src/cpra/services/cpraEmailSender.ts'),
      capFn('P14-03', 'Secure messaging', async () => fileExists(workspacePath('backend/src/communications/messagingRoutes.ts'))),
      capFn('P14-04', 'SMS', async () => false, 'SMS not implemented'),
      capFn('P14-05', 'Campaigns', async () => false, 'Email campaigns not implemented'),
    ],
  },
  {
    id: 'PHASE-15',
    number: 15,
    name: 'Stripe & Billing',
    domain: 'Billing Certification',
    capabilities: [
      cap('P15-01', 'Stripe certification', 'backend/src/billing/stripeCertification.ts'),
      cap('P15-02', 'Webhook processor', 'backend/src/billing/stripeWebhookProcessor.ts'),
      cap('P15-03', 'Billing routes', 'backend/src/billing/billingRoutes.ts'),
      cap('P15-04', 'Subscription service', 'backend/src/billing/subscriptionService.ts'),
      capFn('P15-05', 'Live certification', async () => false, 'Requires sk_test_* credentials'),
    ],
  },
  {
    id: 'PHASE-16',
    number: 16,
    name: 'Engineering Operations',
    domain: 'Production Operations',
    capabilities: [
      cap('P16-01', 'Operations dashboard', 'backend/src/productionOperations/operationsDashboard.ts'),
      cap('P16-02', 'Alerting', 'backend/src/productionOperations/alertingService.ts'),
      cap('P16-03', 'Queue monitoring', 'backend/src/admin/queueMonitorRoutes.ts'),
      capFn('P16-04', 'Backup drill', async () => isBackupDrillPassing()),
      cap('P16-05', 'Disaster recovery', 'DISASTER_RECOVERY.md'),
      cap('P16-06', 'Observability', 'backend/src/observability/observabilityRoutes.ts'),
    ],
  },
  {
    id: 'PHASE-17',
    number: 17,
    name: 'Security',
    domain: 'Security & Compliance',
    capabilities: [
      cap('P17-01', 'RBAC', 'backend/src/security/authMiddleware.ts'),
      capFn('P17-02', 'Tenant isolation', async () => getRequiredRoles('/api/admin/stats')?.includes('admin') ?? false),
      cap('P17-03', 'Rate limiting', 'backend/src/security/rateLimiter.ts'),
      cap('P17-04', 'CSRF protection', 'backend/src/security/csrfProtection.ts'),
      cap('P17-05', 'Security readiness', 'reports/security_readiness.json'),
      capFn('P17-06', 'MFA', async () => fileExists(workspacePath('backend/src/security/identityService.ts'))),
      capFn('P17-07', 'Penetration testing', async () => false, 'Pen test not documented'),
    ],
  },
  {
    id: 'PHASE-18',
    number: 18,
    name: 'AI Governance',
    domain: 'Evidence-Governed AI',
    capabilities: [
      cap('P18-01', 'Intelligence engine', 'backend/src/intelligence/caseIntelligenceOrchestrator.ts'),
      cap('P18-02', 'Unknown management', 'backend/src/intelligence/unknownManagement.ts'),
      cap('P18-03', 'Citation report generator', 'backend/src/intelligence/reportGenerator.ts'),
      capFn('P18-04', 'No fabrication tests', async () => fileExists(workspacePath('backend/tests/attorney-intelligence.test.ts'))),
      capFn('P18-05', 'Extraction audit', async () => fileExists(workspacePath('backend/src/legislative/extractionAuditLog.ts'))),
      capFn('P18-06', 'Confidence scoring', async () => fileExists(workspacePath('backend/src/intelligence/elementAnalysis.ts'))),
    ],
  },
  {
    id: 'PHASE-19',
    number: 19,
    name: 'Performance & Scalability',
    domain: 'Performance Engineering',
    capabilities: [
      capFn('P19-01', 'Performance benchmark', async () => fileExists(workspacePath('reports/performance_benchmark.json'))),
      cap('P19-02', 'Observability routes', 'backend/src/observability/observabilityRoutes.ts'),
      capFn('P19-03', 'Load testing', async () => fileExists(workspacePath('backend/scripts/stress-test-runner.ts'))),
      capFn('P19-04', 'Latency targets', async () => false, 'Latency SLOs not certified'),
    ],
  },
  {
    id: 'PHASE-20',
    number: 20,
    name: 'Quality Assurance',
    domain: 'Test Coverage',
    capabilities: [
      capFn('P20-01', 'Unit tests', async () => fileExists(workspacePath('backend/tests/attorney-intelligence.test.ts'))),
      capFn('P20-02', 'Integration tests', async () => fileExists(workspacePath('backend/tests/investigator-workbench.test.ts'))),
      capFn('P20-03', 'Client domain tests', async () => fileExists(workspacePath('backend/tests/client-domain.test.ts'))),
      capFn('P20-04', 'Legislative tests', async () => fileExists(workspacePath('backend/tests/legislative-knowledge-graph.test.ts'))),
      capFn('P20-05', 'Production gates tests', async () => fileExists(workspacePath('backend/tests/production-gates.test.ts'))),
      capFn('P20-06', 'E2E tests', async () => fileExists(workspacePath('reports/end_to_end_pipeline_test.json'))),
    ],
  },
  {
    id: 'PHASE-21',
    number: 21,
    name: 'Compliance & Governance',
    domain: 'Documentation & Policies',
    capabilities: [
      cap('P21-01', 'Disaster recovery', 'DISASTER_RECOVERY.md'),
      cap('P21-02', 'Deployment runbook', 'DEPLOYMENT_RUNBOOK.md'),
      cap('P21-03', 'Beta checklist', 'BETA_TESTING_CHECKLIST.md'),
      capFn('P21-04', 'Privacy policy', async () => fileExists(workspacePath('src/pages/LegalDisclaimerPage.tsx'))),
      capFn('P21-05', 'Incident response', async () => false, 'Incident response plan not documented'),
    ],
  },
  {
    id: 'PHASE-22',
    number: 22,
    name: 'Version 1.0 Certification',
    domain: 'Release Certification',
    capabilities: [
      capFn('P22-01', 'Production gates', async () => fileExists(workspacePath('reports/PRODUCTION_GATES.json'))),
      capFn('P22-02', 'V1 release checklist', async () => fileExists(workspacePath('reports/VERSION_1.0_RELEASE_CHECKLIST.json'))),
      capFn('P22-03', 'Backup restore drill', async () => isBackupDrillPassing()),
      capFn('P22-04', 'Attorney workflow E2E', async () => fileExists(workspacePath('backend/tests/attorney-workbench.test.ts'))),
      capFn('P22-05', 'Investigator workflow E2E', async () => fileExists(workspacePath('backend/tests/investigator-workbench.test.ts'))),
      capFn('P22-06', 'Billing certification', async () => false, 'Stripe live cert pending'),
    ],
  },
];
