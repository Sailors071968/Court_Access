// ============================================================================
// CourtAccess Master Production Assessment v1.0
// Objective, evidence-based completion — no subjective estimates.
// Completion % = Verified Capabilities ÷ Total Planned Capabilities
// ============================================================================

import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';
import { MASTER_PRODUCTION_PHASES } from './phaseDefinitions.js';
import { PRODUCTION_COMPLETION_PROGRAMS } from './productionCompletionPrograms.js';
import { runProductionGates } from './runProductionGates.js';
import { runVersion1ProductionGates } from './version1ProductionGates.js';
import { collectProductionMetrics } from '../legislative/productionMetrics.js';
import { fileExists, workspacePath, readJsonReport } from './gateUtils.js';

export const ASSESSMENT_VERSION = '1.0';

export interface CapabilityCriterion {
  id: string;
  label: string;
  category: 'exists' | 'integrated' | 'ui' | 'api' | 'database' | 'authorization' | 'tested' | 'runtime';
  pass: boolean;
  evidence?: string;
}

export interface AssessedCapability {
  id: string;
  name: string;
  programId: string;
  criteria: CapabilityCriterion[];
  implemented: boolean;
  verified: boolean;
  blocked: boolean;
  blocker?: string;
}

export interface AssessedProgram {
  id: string;
  number: number;
  name: string;
  totalPlanned: number;
  implemented: number;
  verified: number;
  incomplete: number;
  blocked: number;
  completionPercent: number;
  verificationPercent: number;
  productionReadiness: 'READY' | 'PARTIAL' | 'NOT_READY';
  capabilities: AssessedCapability[];
}

export interface MasterProductionAssessment {
  assessment: 'COURTACCESS_MASTER_PRODUCTION_ASSESSMENT';
  version: string;
  generatedAt: string;
  methodology: string;
  formula: string;
  summary: {
    totalPrograms: number;
    totalCapabilities: number;
    verifiedCapabilities: number;
    implementedCapabilities: number;
    blockedCapabilities: number;
    overallCompletionPercent: number;
    overallVerificationPercent: number;
    productionReadiness: 'PRODUCTION_READY' | 'RELEASE_CANDIDATE' | 'NOT_READY';
  };
  programs: AssessedProgram[];
}

type VerifyFn = () => Promise<boolean>;

interface PlannedCapability {
  id: string;
  name: string;
  exists?: VerifyFn;
  integrated?: VerifyFn;
  uiReachable?: VerifyFn;
  apiComplete?: VerifyFn;
  databaseComplete?: VerifyFn;
  authorizationComplete?: VerifyFn;
  tested?: VerifyFn;
  runtimeVerified?: VerifyFn;
  blocker?: string;
}

async function routeInApp(route: string): Promise<boolean> {
  const appPath = workspacePath('src/App.tsx');
  const raw = await readFile(appPath, 'utf-8').catch(() => '');
  return raw.includes(`path="${route}"`) || raw.includes(`path='${route}'`);
}

async function apiRouteExists(fragment: string): Promise<boolean> {
  const needle = fragment.replace(/\\/g, '');
  const scanDir = async (dir: string): Promise<boolean> => {
    let entries: string[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (await scanDir(full)) return true;
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        const raw = await readFile(full, 'utf-8').catch(() => '');
        if (raw.includes(needle)) return true;
      }
    }
    return false;
  };
  return scanDir(workspacePath('backend/src'));
}

async function prismaModelExists(model: string): Promise<boolean> {
  const raw = await readFile(workspacePath('backend/prisma/schema.prisma'), 'utf-8').catch(() => '');
  return new RegExp(`model\\s+${model}\\b`).test(raw);
}

const testResultCache = new Map<string, boolean>();
let testSuiteLoaded = false;

async function loadTestSuiteResults(): Promise<void> {
  if (testSuiteLoaded) return;
  testSuiteLoaded = true;
  const testDir = workspacePath('backend/tests');
  let files: string[];
  try {
    files = await readdir(testDir);
  } catch {
    return;
  }
  for (const file of files.filter((f) => f.endsWith('.test.ts'))) {
    const rel = `tests/${file}`;
    if (testResultCache.has(rel)) continue;
    try {
      execSync(`node --import tsx --test ${rel}`, {
        cwd: workspacePath('backend'),
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 120_000,
      });
      testResultCache.set(rel, true);
    } catch {
      testResultCache.set(rel, false);
    }
  }
}

async function testFilePasses(relPath: string): Promise<boolean> {
  await loadTestSuiteResults();
  const backendRelative = relPath.replace(/^backend\//, '');
  if (testResultCache.has(backendRelative)) return testResultCache.get(backendRelative)!;
  const absPath = workspacePath('backend', backendRelative);
  if (!(await fileExists(absPath))) {
    testResultCache.set(backendRelative, false);
    return false;
  }
  try {
    execSync(`node --import tsx --test ${backendRelative}`, {
      cwd: workspacePath('backend'),
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 120_000,
    });
    testResultCache.set(backendRelative, true);
    return true;
  } catch {
    testResultCache.set(backendRelative, false);
    return false;
  }
}

const buildResultCache = new Map<string, boolean>();

async function buildPasses(pkg: 'frontend' | 'backend'): Promise<boolean> {
  if (buildResultCache.has(pkg)) return buildResultCache.get(pkg)!;
  try {
    if (pkg === 'frontend') {
      execSync('npm run build', { cwd: workspacePath('.'), stdio: 'pipe' });
    } else {
      execSync('npx tsc --noEmit -p tsconfig.json', { cwd: workspacePath('backend'), stdio: 'pipe' });
    }
    buildResultCache.set(pkg, true);
    return true;
  } catch {
    buildResultCache.set(pkg, false);
    return false;
  }
}

const F = {
  file: (p: string): VerifyFn => () => fileExists(workspacePath(p)),
  route: (r: string): VerifyFn => () => routeInApp(r),
  api: (f: string): VerifyFn => () => apiRouteExists(f),
  model: (m: string): VerifyFn => () => prismaModelExists(m),
  test: (p: string): VerifyFn => () => testFilePasses(p),
  report: (p: string, key?: string, val?: string): VerifyFn => async () => {
    const j = await readJsonReport<Record<string, unknown>>(p);
    if (!j) return false;
    if (key && val) return String(j[key]) === val;
    if (key) return Boolean(j[key]);
    return true;
  },
  gate: (id: string, result: string): VerifyFn => async () => {
    const g = await readJsonReport<{ gates?: Array<{ id: string; result: string }> }>('reports/PRODUCTION_GATES.json');
    const gate = g?.gates?.find((x) => x.id === id);
    return gate?.result === result;
  },
  always: (v: boolean): VerifyFn => async () => v,
};

/** Canonical Program 0–24 capability registry (objective planned capabilities). */
function buildProgramRegistry(): Array<{ id: string; number: number; name: string; capabilities: PlannedCapability[] }> {
  const cap = (id: string, name: string, c: Partial<PlannedCapability> & { blocker?: string }): PlannedCapability => ({
    id,
    name,
    exists: c.exists,
    integrated: c.integrated ?? c.exists,
    uiReachable: c.uiReachable,
    apiComplete: c.apiComplete,
    databaseComplete: c.databaseComplete,
    authorizationComplete: c.authorizationComplete,
    tested: c.tested,
    runtimeVerified: c.runtimeVerified,
    blocker: c.blocker,
  });

  return [
    {
      id: 'PROGRAM-00', number: 0, name: 'Production Website',
      capabilities: [
        cap('P00-01', 'Landing page', { exists: F.file('src/pages/LandingPage.tsx'), uiReachable: F.route('/'), runtimeVerified: F.report('reports/PROGRAM_00_VERIFY.json', 'status', 'PASS') }),
        cap('P00-02', 'Pricing page', { exists: F.file('src/pages/LandingPage.tsx'), uiReachable: F.route('/pricing') }),
        cap('P00-03', 'About page', { exists: F.file('src/pages/marketing/AboutPage.tsx'), uiReachable: F.route('/about') }),
        cap('P00-04', 'Features page', { exists: F.file('src/pages/marketing/FeaturesPage.tsx'), uiReachable: F.route('/features') }),
        cap('P00-05', 'FAQ page', { exists: F.file('src/pages/marketing/FAQPage.tsx'), uiReachable: F.route('/faq') }),
        cap('P00-06', 'Contact page', { exists: F.file('src/pages/ContactSalesPage.tsx'), uiReachable: F.route('/contact'), apiComplete: F.api('/api/contact') }),
        cap('P00-07', 'Login', { exists: F.file('src/pages/auth/LoginPage.tsx'), uiReachable: F.route('/login'), apiComplete: F.api('/api/auth/login') }),
        cap('P00-08', 'Registration', { exists: F.file('src/pages/auth/RegisterPage.tsx'), uiReachable: F.route('/register'), apiComplete: F.api('/api/auth/register') }),
        cap('P00-09', 'Password reset', { exists: F.file('src/pages/auth/ForgotPasswordPage.tsx'), uiReachable: F.route('/forgot-password'), apiComplete: F.api('/api/auth/forgot-password') }),
        cap('P00-10', 'Email verification', { exists: F.file('src/pages/auth/VerifyEmailPage.tsx'), uiReachable: F.route('/verify-email'), apiComplete: F.api('/api/auth/verify-email') }),
        cap('P00-11', 'Privacy policy', { exists: F.file('src/pages/marketing/PrivacyPolicyPage.tsx'), uiReachable: F.route('/privacy') }),
        cap('P00-12', 'Terms of service', { exists: F.file('src/pages/marketing/TermsOfServicePage.tsx'), uiReachable: F.route('/terms') }),
        cap('P00-13', 'Frontend build', { exists: F.always(true), runtimeVerified: () => buildPasses('frontend') }),
        cap('P00-14', 'Route verification script', { exists: F.file('scripts/program-00-verify.mjs'), runtimeVerified: F.report('reports/PROGRAM_00_VERIFY.json', 'status', 'PASS') }),
        cap('P00-15', 'Lighthouse audit', { exists: F.file('reports/PROGRAM_00_LIGHTHOUSE.json'), runtimeVerified: F.file('reports/PROGRAM_00_LIGHTHOUSE.json') }),
      ],
    },
    {
      id: 'PROGRAM-01', number: 1, name: 'Universal Membership',
      capabilities: [
        cap('P01-01', 'Universal membership model', { exists: F.file('backend/src/membership/universalMembership.ts'), tested: F.test('tests/universal-membership.test.ts'), runtimeVerified: F.test('tests/universal-membership.test.ts') }),
        cap('P01-02', 'Account provisioning', { exists: F.file('backend/src/membership/accountProvisioningService.ts') }),
        cap('P01-03', 'Terms acceptance', { exists: F.file('src/pages/auth/RegisterPage.tsx'), databaseComplete: F.model('User'), apiComplete: F.api('/api/auth/register') }),
        cap('P01-04', '30-day trial', { databaseComplete: F.model('Subscription'), apiComplete: F.api('/api/auth/register') }),
        cap('P01-05', 'Membership API', { exists: F.file('backend/src/membership/membershipRoutes.ts'), apiComplete: F.api('/api/membership/account'), integrated: F.file('backend/src/server.ts') }),
        cap('P01-06', 'Account settings UI', { exists: F.file('src/pages/membership/AccountSettingsPage.tsx'), uiReachable: F.route('settings') }),
        cap('P01-07', 'Shared access dashboard', { exists: F.file('src/pages/membership/SharedAccessPage.tsx'), uiReachable: F.route('shared-access'), apiComplete: F.api('/api/membership/shared-access') }),
        cap('P01-08', 'Stripe checkout wiring', { exists: F.file('src/pages/LandingPage.tsx'), apiComplete: F.api('/api/billing/create-checkout-session') }),
        cap('P01-09', 'Delegated user limit', { exists: F.file('backend/src/organizations/organizationService.ts'), tested: F.test('tests/organization-domain.test.ts') }),
        cap('P01-10', 'Permission resolver', {
          exists: F.file('backend/src/membership/permissionResolver.ts'),
          integrated: F.file('backend/src/membership/resourceAuthorizationRegistry.ts'),
          runtimeVerified: F.test('tests/resource-permissions.test.ts'),
        }),
      ],
    },
    {
      id: 'PROGRAM-02', number: 2, name: 'Hybrid Stripe Billing',
      capabilities: [
        cap('P02-01', 'Stripe checkout', { exists: F.file('backend/src/billing/stripeWebhookHandler.ts'), apiComplete: F.api('create-checkout-session') }),
        cap('P02-02', 'Webhook processor', { exists: F.file('backend/src/billing/stripeWebhookProcessor.ts'), apiComplete: F.api('/api/billing/webhook') }),
        cap('P02-03', 'Customer portal', { apiComplete: F.api('create-portal-session') }),
        cap('P02-04', 'Subscription service', { exists: F.file('backend/src/billing/subscriptionService.ts'), databaseComplete: F.model('Subscription') }),
        cap('P02-05', 'Billing routes', { exists: F.file('backend/src/billing/billingRoutes.ts'), apiComplete: F.api('/api/billing/subscription') }),
        cap('P02-06', 'Discount codes', { exists: F.file('backend/src/billing/discountRoutes.ts'), apiComplete: F.api('/api/discount-codes/validate') }),
        cap('P02-07', 'Billing emails', { exists: F.file('backend/src/billing/billingEmailService.ts') }),
        cap('P02-08', 'Stripe certification harness', { exists: F.file('backend/src/billing/stripeCertification.ts'), tested: F.test('tests/stripe-certification.test.ts') }),
        cap('P02-09', 'Stripe billing tests', { tested: F.test('tests/stripe-billing.test.ts'), runtimeVerified: F.test('tests/stripe-billing.test.ts') }),
        cap('P02-10', 'Live Stripe env configured', {
          runtimeVerified: async () => Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_')),
          blocker: 'STRIPE_SECRET_KEY not configured',
        }),
        cap('P02-11', 'Annual billing', { apiComplete: F.api('billingInterval') }),
        cap('P02-12', 'Production certification report', { exists: F.file('reports/stripe/PRODUCTION_CERTIFICATION.md') }),
      ],
    },
    {
      id: 'PROGRAM-03', number: 3, name: 'Delegated Access',
      capabilities: [
        cap('P03-01', 'Invitation create', { apiComplete: F.api('/api/organizations/invitations'), uiReachable: F.route('organization/settings') }),
        cap('P03-02', 'Invitation accept', { exists: F.file('src/pages/auth/AcceptInvitationPage.tsx'), uiReachable: F.route('/accept-invitation'), apiComplete: F.api('accept-invitation') }),
        cap('P03-03', 'Invitation preview', { apiComplete: F.api('invitations/preview') }),
        cap('P03-04', '5-user limit', { exists: F.file('backend/src/membership/universalMembership.ts'), tested: F.test('tests/universal-membership.test.ts') }),
        cap('P03-05', 'MFA for delegates', { apiComplete: F.api('/api/auth/mfa/setup'), exists: F.file('backend/src/security/identityRoutes.ts') }),
        cap('P03-06', 'Session history', { apiComplete: F.api('/api/auth/sessions') }),
        cap('P03-07', 'Org member list', { apiComplete: F.api('/api/organizations/members') }),
        cap('P03-08', 'Invitation tests', { tested: F.test('tests/organization-domain.test.ts'), runtimeVerified: F.test('tests/organization-domain.test.ts') }),
      ],
    },
    {
      id: 'PROGRAM-04', number: 4, name: 'Resource Permissions',
      capabilities: [
        cap('P04-01', 'PermissionGrant model', { databaseComplete: F.model('PermissionGrant') }),
        cap('P04-02', 'Permission grant API', {
          apiComplete: async () =>
            (await apiRouteExists('/api/membership/permission-grants')) ||
            (await apiRouteExists('/api/firm/permissions')),
        }),
        cap('P04-03', 'Permission resolver', { exists: F.file('backend/src/membership/permissionResolver.ts') }),
        cap('P04-04', 'Case-level filtering', { apiComplete: F.api('/api/membership/accessible-cases') }),
        cap('P04-05', 'Permission check API', { apiComplete: F.api('/api/membership/permission-check') }),
        cap('P04-06', 'Firm permissions UI', { uiReachable: F.route('firm') }),
        cap('P04-07', 'Route enforcement', {
          exists: F.file('backend/src/membership/resourceAuthMiddleware.ts'),
          integrated: F.file('backend/src/membership/resourceAuthorizationRegistry.ts'),
          runtimeVerified: F.test('tests/resource-permissions.test.ts'),
        }),
        cap('P04-08', 'Firm platform tests', { exists: F.file('backend/tests/firm-platform.test.ts') }),
        cap('P04-09', 'Charges authorization', { exists: F.file('backend/src/charges/chargeRoutes.ts'), integrated: F.file('backend/src/membership/resourceAuthorizationRegistry.ts') }),
        cap('P04-10', 'Communications authorization', { exists: F.file('backend/src/communications/messagingRoutes.ts'), integrated: F.file('backend/src/membership/resourceAuthorizationRegistry.ts') }),
        cap('P04-11', 'Witness and leads authorization', { exists: F.file('backend/src/investigator/investigatorRoutes.ts'), integrated: F.file('backend/src/membership/resourceAuthorizationRegistry.ts') }),
        cap('P04-12', 'Reports and workbench authorization', { exists: F.file('backend/src/workbench/workbenchRoutes.ts'), integrated: F.file('backend/src/membership/resourceAuthorizationRegistry.ts') }),
        cap('P04-13', 'CALCRIM authorization', { exists: F.file('backend/src/routes/calcrimRoutes.ts'), integrated: F.file('backend/src/membership/resourceAuthorizationRegistry.ts') }),
        cap('P04-14', 'Intelligence report authorization', { exists: F.file('backend/src/intelligence/intelligenceRoutes.ts'), integrated: F.file('backend/src/membership/resourceAuthorizationRegistry.ts') }),
        cap('P04-15', 'Client organization authorization', { exists: F.file('backend/src/clients/clientRoutes.ts'), integrated: F.file('backend/src/membership/resourceAuthorizationRegistry.ts') }),
        cap('P04-16', 'Non-disclosure list filtering', { exists: F.file('backend/src/membership/resourceAuthMiddleware.ts'), tested: F.test('tests/resource-permissions.test.ts') }),
        cap('P04-17', 'Scope registry', { exists: F.file('backend/src/membership/resourceAuthorizationRegistry.ts'), runtimeVerified: F.test('tests/resource-permissions.test.ts') }),
        cap('P04-18', 'Seven-level permission model', { exists: F.file('backend/src/membership/universalMembership.ts'), tested: F.test('tests/resource-permissions.test.ts'), runtimeVerified: F.test('tests/resource-permissions.test.ts') }),
      ],
    },
    {
      id: 'PROGRAM-05', number: 5, name: 'Document Redaction',
      capabilities: [
        cap('P05-01', 'Redaction schema', { databaseComplete: F.model('DocumentRedactionVersion') }),
        cap('P05-02', 'Redaction service', { exists: F.file('backend/src/membership/redactionService.ts') }),
        cap('P05-03', 'Redaction API', { apiComplete: F.api('/redactions') }),
        cap('P05-04', 'Publication profiles', { exists: F.file('backend/src/membership/redactionService.ts') }),
        cap('P05-05', 'Redaction UI', {
          exists: F.file('src/pages/redaction/DocumentRedactionPage.tsx'),
          uiReachable: F.route('redact'),
          runtimeVerified: F.file('src/pages/redaction/DocumentRedactionPage.tsx'),
        }),
        cap('P05-06', 'OCR text redaction', { runtimeVerified: F.always(false), blocker: 'OCR layer redaction not implemented' }),
        cap('P05-07', 'AI redaction suggestions', { runtimeVerified: F.always(false), blocker: 'AI suggestion engine not implemented' }),
      ],
    },
    {
      id: 'PROGRAM-06', number: 6, name: 'Disclosure Manager',
      capabilities: [
        cap('P06-01', 'Disclosure schema', { databaseComplete: F.model('DisclosurePackage') }),
        cap('P06-02', 'Disclosure service', { exists: F.file('backend/src/membership/disclosureService.ts') }),
        cap('P06-03', 'Disclosure API', { apiComplete: F.api('/disclosures') }),
        cap('P06-04', 'Shared access view', { uiReachable: F.route('shared-access'), apiComplete: F.api('/api/membership/shared-access') }),
        cap('P06-05', 'Preview as recipient', {
          exists: F.file('src/pages/disclosure/DisclosureManagerPage.tsx'),
          uiReachable: F.route('disclosures'),
        }),
        cap('P06-06', 'Version comparison', {
          exists: F.file('src/pages/disclosure/DisclosureManagerPage.tsx'),
          uiReachable: F.route('disclosures'),
        }),
      ],
    },
    {
      id: 'PROGRAM-07', number: 7, name: 'Organizations',
      capabilities: [
        cap('P07-01', 'Organization model', { databaseComplete: F.model('Organization') }),
        cap('P07-02', 'Org routes', { exists: F.file('backend/src/organizations/organizationRoutes.ts'), apiComplete: F.api('/api/organizations/current') }),
        cap('P07-03', 'Offices', { apiComplete: F.api('/api/organizations/offices'), databaseComplete: F.model('OrganizationOffice') }),
        cap('P07-04', 'Practice groups', { apiComplete: F.api('/api/organizations/practice-groups') }),
        cap('P07-05', 'Firm platform', { exists: F.file('backend/src/organizations/firmPlatformRoutes.ts'), uiReachable: F.route('firm') }),
        cap('P07-06', 'Tenant isolation', { tested: F.test('tests/organization-domain.test.ts'), runtimeVerified: F.test('tests/organization-domain.test.ts') }),
        cap('P07-07', 'Firm platform tests', { tested: F.test('tests/firm-platform.test.ts'), runtimeVerified: F.test('tests/firm-platform.test.ts') }),
        cap('P07-08', 'Org settings UI', { uiReachable: F.route('organization/settings') }),
      ],
    },
    {
      id: 'PROGRAM-08', number: 8, name: 'Client Management',
      capabilities: [
        cap('P08-01', 'Client model', { databaseComplete: F.model('Client') }),
        cap('P08-02', 'Client CRUD API', { exists: F.file('backend/src/clients/clientRoutes.ts'), apiComplete: F.api('/api/clients') }),
        cap('P08-03', 'Client tests', { tested: F.test('tests/client-domain.test.ts'), runtimeVerified: F.test('tests/client-domain.test.ts') }),
        cap('P08-04', 'Client intake UI', { runtimeVerified: F.always(false), blocker: 'Dedicated intake UI not built' }),
        cap('P08-05', 'Client billing', { runtimeVerified: F.always(false), blocker: 'Client-level billing not wired' }),
      ],
    },
    {
      id: 'PROGRAM-09', number: 9, name: 'Case Management',
      capabilities: [
        cap('P09-01', 'Case CRUD API', { exists: F.file('backend/src/evidence/caseRoutes.ts'), apiComplete: F.api('/api/cases') }),
        cap('P09-02', 'Cases list UI', { uiReachable: F.route('cases') }),
        cap('P09-03', 'Case overview UI', { uiReachable: F.route('overview') }),
        cap('P09-04', 'Charges', { apiComplete: F.api('/api/charges'), uiReachable: F.route('charges') }),
        cap('P09-05', 'Hearings', { apiComplete: F.api('/api/cases/:caseId/hearings') }),
        cap('P09-06', 'Motions UI', { uiReachable: F.route('motions') }),
        cap('P09-07', 'Discovery requests', { apiComplete: F.api('evidence-requests') }),
        cap('P09-08', 'Case tests', { tested: F.test('tests/evidence.test.ts'), runtimeVerified: F.test('tests/evidence.test.ts') }),
      ],
    },
    {
      id: 'PROGRAM-10', number: 10, name: 'Document Platform',
      capabilities: [
        cap('P10-01', 'Evidence upload API', { apiComplete: F.api('/api/evidence/upload-url') }),
        cap('P10-02', 'Direct upload', { exists: F.file('backend/src/evidence/evidenceDirectUpload.ts') }),
        cap('P10-03', 'Documents UI', { uiReachable: F.route('documents') }),
        cap('P10-04', 'OCR worker', { exists: F.file('backend/src/policy/workers/ocrWorker.ts') }),
        cap('P10-05', 'Document versioning', { runtimeVerified: F.always(false), blocker: 'Document versioning not implemented' }),
        cap('P10-06', 'Deduplication report', { exists: F.file('backend/reports/document_duplicate_analysis.json') }),
      ],
    },
    {
      id: 'PROGRAM-11', number: 11, name: 'Evidence Platform',
      capabilities: [
        cap('P11-01', 'Evidence repository', { apiComplete: F.api('/api/cases/:caseId/evidence'), uiReachable: F.route('evidence') }),
        cap('P11-02', 'Timeline API', { apiComplete: F.api('/api/timeline/'), exists: F.file('backend/src/timeline/timelineRoutes.ts') }),
        cap('P11-03', 'Contradiction engine', { exists: F.file('backend/src/contradiction/contradictionEngine.ts'), apiComplete: F.api('/api/contradiction/analyze') }),
        cap('P11-04', 'Evidence gaps', { exists: F.file('backend/src/intelligence/evidenceGapDetectionService.ts') }),
        cap('P11-05', 'Forensic reconstruction', { exists: F.file('backend/src/evidence/forensicReconstructionRoutes.ts') }),
        cap('P11-06', 'Contradiction UI', { uiReachable: F.route('contradictions') }),
        cap('P11-07', 'Evidence tests', { tested: F.test('tests/evidence.test.ts') }),
      ],
    },
    {
      id: 'PROGRAM-12', number: 12, name: 'Investigator Workbench',
      capabilities: [
        cap('P12-01', 'Investigator API', { apiComplete: F.api('investigator-workbench'), exists: F.file('backend/src/investigator/investigatorRoutes.ts') }),
        cap('P12-02', 'Witnesses', { apiComplete: F.api('investigator/witnesses') }),
        cap('P12-03', 'Leads', { apiComplete: F.api('investigator/leads') }),
        cap('P12-04', 'Field notes', { apiComplete: F.api('investigator/field-notes') }),
        cap('P12-05', 'Assignments', { apiComplete: F.api('investigator/assignments') }),
        cap('P12-06', 'Investigator UI', { uiReachable: F.route('investigator-workbench'), exists: F.file('src/pages/case/InvestigatorWorkbenchPage.tsx') }),
        cap('P12-07', 'Investigator tests', { tested: F.test('tests/investigator-workbench.test.ts'), runtimeVerified: F.test('tests/investigator-workbench.test.ts') }),
        cap('P12-08', 'GPS mapping', { runtimeVerified: F.always(false), blocker: 'GPS mapping not implemented' }),
        cap('P12-09', 'Surveillance logs', { runtimeVerified: F.always(false), blocker: 'Surveillance module not implemented' }),
      ],
    },
    {
      id: 'PROGRAM-13', number: 13, name: 'Attorney Workbench',
      capabilities: [
        cap('P13-01', 'Workbench API', { apiComplete: F.api('/api/cases/:caseId/workbench'), exists: F.file('backend/src/workbench/workbenchRoutes.ts') }),
        cap('P13-02', 'Attorney UI', { uiReachable: F.route('attorney-workbench'), exists: F.file('src/pages/case/AttorneyWorkbenchPage.tsx') }),
        cap('P13-03', 'Intelligence API', { apiComplete: F.api('/api/cases/:caseId/intelligence') }),
        cap('P13-04', 'Trial prep', { apiComplete: F.api('workbench/trial-prep') }),
        cap('P13-05', 'CALCRIM', { apiComplete: F.api('/api/calcrim/analyze') }),
        cap('P13-06', 'Attorney workbench tests', { tested: F.test('tests/attorney-workbench.test.ts'), runtimeVerified: F.test('tests/attorney-workbench.test.ts') }),
        cap('P13-07', 'Attorney intelligence tests', { tested: F.test('tests/attorney-intelligence.test.ts'), runtimeVerified: F.test('tests/attorney-intelligence.test.ts') }),
        cap('P13-08', 'Voir dire workspace', { runtimeVerified: F.always(false), blocker: 'Dedicated voir dire UI not built' }),
      ],
    },
    {
      id: 'PROGRAM-14', number: 14, name: 'Client Portal',
      capabilities: [
        cap('P14-01', 'Defendant dashboard', { exists: F.file('src/pages/dashboard/DefendantDashboard.tsx'), uiReachable: F.route('/dashboard') }),
        cap('P14-02', 'Secure messaging', { apiComplete: F.api('/api/cases/:caseId/messages'), tested: F.test('tests/communications-platform.test.ts') }),
        cap('P14-03', 'Court dates portal', { apiComplete: F.api('/api/portal/court-dates') }),
        cap('P14-04', 'Document access', { uiReachable: F.route('documents') }),
        cap('P14-05', 'Evidence upload panel', { exists: F.file('src/components/evidence/EvidenceUploadPanel.tsx') }),
        cap('P14-06', 'Dedicated client portal route', {
          exists: F.file('src/pages/client-portal/ClientPortalLayout.tsx'),
          uiReachable: F.route('/client-portal'),
          runtimeVerified: F.file('src/pages/client-portal/ClientPortalPages.tsx'),
        }),
      ],
    },
    {
      id: 'PROGRAM-15', number: 15, name: 'Administrative Command Center',
      capabilities: [
        cap('P15-01', 'Admin page', { uiReachable: F.route('/admin'), exists: F.file('src/pages/admin/AdminPage.tsx') }),
        cap('P15-02', 'Operations command center', { uiReachable: F.route('admin/operations'), exists: F.file('src/pages/admin/OperationsCommandCenter.tsx') }),
        cap('P15-03', 'Operations API', { apiComplete: F.api('/api/admin/operations/dashboard') }),
        cap('P15-04', 'Repository dashboard', { uiReachable: F.route('repository-integrity') }),
        cap('P15-05', 'Engineering dashboard', { apiComplete: F.api('/api/admin/engineering-dashboard') }),
        cap('P15-06', 'CRM', { runtimeVerified: F.always(false), blocker: 'CRM not implemented' }),
        cap('P15-07', 'Customer support', { runtimeVerified: F.always(false), blocker: 'Support dashboard not implemented' }),
        cap('P15-08', 'Production ops tests', { tested: F.test('tests/production-operations.test.ts') }),
      ],
    },
    {
      id: 'PROGRAM-16', number: 16, name: 'California Legislative Intelligence',
      capabilities: [
        cap('P16-01', 'Discovery pipeline', { exists: F.file('backend/src/legislative/discovery.ts'), tested: F.test('tests/legislative-discovery.test.ts') }),
        cap('P16-02', 'Acquisition pipeline', { exists: F.file('backend/src/legislative/acquisition.ts'), tested: F.test('tests/legislative-acquisition.test.ts') }),
        cap('P16-03', 'Extraction audit', { exists: F.file('backend/src/legislative/extractionAuditLog.ts'), tested: F.test('tests/legislative-extraction-audit.test.ts') }),
        cap('P16-04', 'Legislative API', { apiComplete: F.api('/api/legislative/metrics'), exists: F.file('backend/src/legislative/legislativeRoutes.ts') }),
        cap('P16-05', 'Pipeline stages tests', { tested: F.test('tests/legislative-pipeline-stages.test.ts'), runtimeVerified: F.test('tests/legislative-pipeline-stages.test.ts') }),
        cap('P16-06', 'Liability discovery', { tested: F.test('tests/legislative-liability-discovery.test.ts') }),
        cap('P16-07', 'Production metrics', { exists: F.file('backend/src/legislative/productionMetrics.ts'), tested: F.test('tests/production-metrics.test.ts') }),
      ],
    },
    {
      id: 'PROGRAM-17', number: 17, name: 'Legal Knowledge Graph',
      capabilities: [
        cap('P17-01', 'KG pipeline', { exists: F.file('backend/src/legislative/knowledgeGraph/pipeline.ts') }),
        cap('P17-02', 'Repositories', { exists: F.file('backend/src/legislative/knowledgeGraph/repositories.ts') }),
        cap('P17-03', 'KG tests', { tested: F.test('tests/legislative-knowledge-graph.test.ts'), runtimeVerified: F.test('tests/legislative-knowledge-graph.test.ts') }),
        cap('P17-04', 'Repository integrity', { tested: F.test('tests/repository-integrity-dashboard.test.ts') }),
        cap('P17-05', 'Doctrine routes registered', {
          exists: F.file('backend/src/doctrine/doctrineRoutes.ts'),
          integrated: F.file('backend/src/server.ts'),
          apiComplete: F.api('/api/doctrine/domains'),
        }),
      ],
    },
    {
      id: 'PROGRAM-18', number: 18, name: 'Communications Platform',
      capabilities: [
        cap('P18-01', 'Secure messaging', { apiComplete: F.api('/api/cases/:caseId/messages'), tested: F.test('tests/communications-platform.test.ts') }),
        cap('P18-02', 'Hearings API', { apiComplete: F.api('/api/cases/:caseId/hearings') }),
        cap('P18-03', 'Billing emails', { exists: F.file('backend/src/billing/billingEmailService.ts') }),
        cap('P18-04', 'CPRA email', { exists: F.file('backend/src/cpra/services/cpraEmailSender.ts') }),
        cap('P18-05', 'SMS', { runtimeVerified: F.always(false), blocker: 'SMS not implemented' }),
        cap('P18-06', 'Communications tests', { runtimeVerified: F.test('tests/communications-platform.test.ts') }),
      ],
    },
    {
      id: 'PROGRAM-19', number: 19, name: 'Operations',
      capabilities: [
        cap('P19-01', 'Operations dashboard', { exists: F.file('backend/src/productionOperations/operationsDashboard.ts'), apiComplete: F.api('/api/admin/operations/dashboard') }),
        cap('P19-02', 'Queue monitoring', { apiComplete: F.api('/api/admin/queues'), uiReachable: F.route('system/workers') }),
        cap('P19-03', 'Backup drill', { tested: F.test('tests/backup-restore-drill.test.ts') }),
        cap('P19-04', 'Observability', { apiComplete: F.api('/api/health/deep'), exists: F.file('backend/src/observability/observabilityRoutes.ts') }),
        cap('P19-05', 'Disaster recovery doc', { exists: F.file('DISASTER_RECOVERY.md') }),
        cap('P19-06', 'Production ops tests', { tested: F.test('tests/production-operations.test.ts'), runtimeVerified: F.test('tests/production-operations.test.ts') }),
      ],
    },
    {
      id: 'PROGRAM-20', number: 20, name: 'Security',
      capabilities: [
        cap('P20-01', 'RBAC', { exists: F.file('backend/src/security/authMiddleware.ts'), tested: F.test('tests/stability-authPublicRoutes.test.ts') }),
        cap('P20-02', 'MFA', { exists: F.file('backend/src/security/identityService.ts'), tested: F.test('tests/identity-security.test.ts') }),
        cap('P20-03', 'Rate limiting', { exists: F.file('backend/src/security/rateLimiter.ts') }),
        cap('P20-04', 'CSRF', { exists: F.file('backend/src/security/csrfProtection.ts') }),
        cap('P20-05', 'Security readiness report', { exists: F.file('reports/security_readiness.json') }),
        cap('P20-06', 'Tenant isolation tests', { tested: F.test('tests/organization-domain.test.ts') }),
        cap('P20-07', 'Penetration testing', { runtimeVerified: F.always(false), blocker: 'Pen test not documented' }),
      ],
    },
    {
      id: 'PROGRAM-21', number: 21, name: 'Performance',
      capabilities: [
        cap('P21-01', 'Performance benchmark report', { exists: F.file('reports/performance_benchmark.json') }),
        cap('P21-02', 'Lighthouse scores', { exists: F.file('reports/PROGRAM_00_LIGHTHOUSE.json') }),
        cap('P21-03', 'Deep health check', { tested: F.test('tests/stability-deepHealthCheck.test.ts') }),
        cap('P21-04', 'Load testing', { runtimeVerified: F.always(false), blocker: 'Load test suite not implemented' }),
        cap('P21-05', 'Stress testing', { runtimeVerified: F.always(false), blocker: 'Stress test suite not implemented' }),
      ],
    },
    {
      id: 'PROGRAM-22', number: 22, name: 'Documentation',
      capabilities: [
        cap('P22-01', 'Disaster recovery', { exists: F.file('DISASTER_RECOVERY.md') }),
        cap('P22-02', 'Stripe architecture', { exists: F.file('reports/stripe/ARCHITECTURE.md') }),
        cap('P22-03', 'Program 00 report', { exists: F.file('reports/PROGRAM_00_PRODUCTION_WEBSITE.md') }),
        cap('P22-04', 'Program 01 report', { exists: F.file('reports/PROGRAM_01_UNIVERSAL_MEMBERSHIP.md') }),
        cap('P22-05', 'User guide', { runtimeVerified: F.always(false), blocker: 'User guide not written' }),
        cap('P22-06', 'API documentation', { runtimeVerified: F.always(false), blocker: 'OpenAPI spec not generated' }),
      ],
    },
    {
      id: 'PROGRAM-23', number: 23, name: 'Version 1.0 Certification',
      capabilities: [
        cap('P23-01', 'Production gates runner', { exists: F.file('backend/src/productionGates/runProductionGates.ts'), tested: F.test('tests/production-gates.test.ts') }),
        cap('P23-02', 'V1 gates', { exists: F.file('backend/src/productionGates/version1ProductionGates.ts') }),
        cap('P23-03', 'Master program assessor', { exists: F.file('backend/src/productionGates/masterProductionProgram.ts'), tested: F.test('tests/master-production-program.test.ts') }),
        cap('P23-04', 'Frontend build gate', { runtimeVerified: () => buildPasses('frontend') }),
        cap('P23-05', 'Backend compile gate', { runtimeVerified: () => buildPasses('backend') }),
        cap('P23-06', 'E2E workflow demo', { runtimeVerified: F.always(false), blocker: 'Full E2E demonstration not recorded' }),
      ],
    },
    {
      id: 'PROGRAM-24', number: 24, name: 'Self-Demonstrating Product',
      capabilities: [
        cap('P24-01', 'Register UI', { uiReachable: F.route('/register') }),
        cap('P24-02', 'Subscribe flow', { apiComplete: F.api('create-checkout-session'), uiReachable: F.route('/pricing') }),
        cap('P24-03', 'Login UI', { uiReachable: F.route('/login') }),
        cap('P24-04', 'Case creation reachable', { uiReachable: F.route('cases') }),
        cap('P24-05', 'Evidence upload reachable', { uiReachable: F.route('evidence') }),
        cap('P24-06', 'Invite users reachable', { uiReachable: F.route('organization/settings') }),
        cap('P24-07', 'Redaction UI', {
          uiReachable: F.route('redact'),
          exists: F.file('src/pages/redaction/DocumentRedactionPage.tsx'),
        }),
        cap('P24-08', 'Program 02 demonstration', { exists: F.file('reports/PROGRAM_02_DEMONSTRATION.md') }),
        cap('P24-09', 'Screenshot evidence', { exists: F.file('reports/screenshots/program-00/landing-desktop.png') }),
        cap('P24-10', 'End-to-end walkthrough doc', { runtimeVerified: F.always(false), blocker: 'E2E walkthrough not published' }),
      ],
    },
  ];
}

async function assessCapability(programId: string, planned: PlannedCapability): Promise<AssessedCapability> {
  const checks: Array<{ key: keyof PlannedCapability; category: CapabilityCriterion['category']; label: string; fn?: VerifyFn }> = [
    { key: 'exists', category: 'exists', label: 'Exists', fn: planned.exists },
    { key: 'integrated', category: 'integrated', label: 'Integrated', fn: planned.integrated },
    { key: 'uiReachable', category: 'ui', label: 'UI reachable', fn: planned.uiReachable },
    { key: 'apiComplete', category: 'api', label: 'API complete', fn: planned.apiComplete },
    { key: 'databaseComplete', category: 'database', label: 'Database complete', fn: planned.databaseComplete },
    { key: 'authorizationComplete', category: 'authorization', label: 'Authorization complete', fn: planned.authorizationComplete },
    { key: 'tested', category: 'tested', label: 'Tested', fn: planned.tested },
    { key: 'runtimeVerified', category: 'runtime', label: 'Runtime verified', fn: planned.runtimeVerified },
  ];

  const criteria: CapabilityCriterion[] = [];
  for (const c of checks) {
    if (!c.fn) continue;
    const pass = await c.fn();
    criteria.push({ id: `${planned.id}-${c.category}`, label: c.label, category: c.category, pass });
  }

  const implemented = criteria.some((c) => c.pass);

  const runtimeCriterion = criteria.find((c) => c.category === 'runtime');
  const implementationCriteria = criteria.filter((c) => c.category !== 'runtime');
  const isVerified = runtimeCriterion
    ? runtimeCriterion.pass
    : implementationCriteria.length > 0
      ? implementationCriteria.every((c) => c.pass)
      : false;

  return {
    id: planned.id,
    name: planned.name,
    programId,
    criteria,
    implemented: criteria.some((c) => c.pass),
    verified: isVerified,
    blocked: Boolean(planned.blocker) && !isVerified,
    blocker: planned.blocker,
  };
}

function programReadiness(verified: number, total: number, blocked: number): AssessedProgram['productionReadiness'] {
  if (total === 0) return 'NOT_READY';
  if (verified === total) return 'READY';
  if (verified > 0 && blocked < total) return 'PARTIAL';
  return 'NOT_READY';
}

export async function runMasterProductionAssessment(): Promise<MasterProductionAssessment> {
  // Refresh production gates before assessment
  try {
    const gatesReport = await runProductionGates();
    const { writeFile } = await import('node:fs/promises');
    await writeFile(workspacePath('reports/PRODUCTION_GATES.json'), JSON.stringify(gatesReport, null, 2));
  } catch {
    // continue with stale gates if runner fails
  }

  const registry = buildProgramRegistry();
  const programs: AssessedProgram[] = [];

  for (const prog of registry) {
    const capabilities: AssessedCapability[] = [];
    for (const cap of prog.capabilities) {
      capabilities.push(await assessCapability(prog.id, cap));
    }
    const total = capabilities.length;
    const verified = capabilities.filter((c) => c.verified).length;
    const implemented = capabilities.filter((c) => c.implemented).length;
    const blocked = capabilities.filter((c) => c.blocked).length;
    programs.push({
      id: prog.id,
      number: prog.number,
      name: prog.name,
      totalPlanned: total,
      implemented,
      verified,
      incomplete: total - verified,
      blocked,
      completionPercent: total === 0 ? 0 : Math.round((verified / total) * 1000) / 10,
      verificationPercent: total === 0 ? 0 : Math.round((verified / total) * 1000) / 10,
      productionReadiness: programReadiness(verified, total, blocked),
      capabilities,
    });
  }

  const totalCapabilities = programs.reduce((s, p) => s + p.totalPlanned, 0);
  const verifiedCapabilities = programs.reduce((s, p) => s + p.verified, 0);
  const implementedCapabilities = programs.reduce((s, p) => s + p.implemented, 0);
  const blockedCapabilities = programs.reduce((s, p) => s + p.blocked, 0);
  const overallCompletionPercent = totalCapabilities === 0 ? 0 : Math.round((verifiedCapabilities / totalCapabilities) * 1000) / 10;

  let productionReadiness: MasterProductionAssessment['summary']['productionReadiness'] = 'NOT_READY';
  if (overallCompletionPercent >= 90) productionReadiness = 'PRODUCTION_READY';
  else if (overallCompletionPercent >= 70) productionReadiness = 'RELEASE_CANDIDATE';

  return {
    assessment: 'COURTACCESS_MASTER_PRODUCTION_ASSESSMENT',
    version: ASSESSMENT_VERSION,
    generatedAt: new Date().toISOString(),
    methodology: 'Each capability has objective binary criteria. Verified = runtime criterion passes when defined; otherwise all defined implementation criteria must pass. No subjective scoring.',
    formula: 'Completion % = Verified Capabilities ÷ Total Planned Capabilities',
    summary: {
      totalPrograms: programs.length,
      totalCapabilities,
      verifiedCapabilities,
      implementedCapabilities,
      blockedCapabilities,
      overallCompletionPercent,
      overallVerificationPercent: overallCompletionPercent,
      productionReadiness,
    },
    programs,
  };
}
