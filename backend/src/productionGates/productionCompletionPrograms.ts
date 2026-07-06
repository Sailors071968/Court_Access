// ============================================================================
// CourtAccess Production Completion Programs v11.0
// Canonical 24-program roadmap (extends Master Production Program)
// ============================================================================

import { fileExists, workspacePath } from './gateUtils.js';

export interface ProgramDefinition {
  id: string;
  number: number;
  name: string;
  capabilities: Array<{ id: string; name: string; path: string }>;
}

export const PRODUCTION_COMPLETION_PROGRAMS: ProgramDefinition[] = [
  {
    id: 'PROGRAM-01',
    number: 1,
    name: 'Universal Membership Platform',
    capabilities: [
      { id: 'P01-01', name: 'Universal membership model', path: 'backend/src/membership/universalMembership.ts' },
      { id: 'P01-02', name: 'Account provisioning', path: 'backend/src/membership/accountProvisioningService.ts' },
      { id: 'P01-03', name: 'Permission resolver', path: 'backend/src/membership/permissionResolver.ts' },
      { id: 'P01-04', name: 'Membership API routes', path: 'backend/src/membership/membershipRoutes.ts' },
      { id: 'P01-05', name: 'Document redaction service', path: 'backend/src/membership/redactionService.ts' },
      { id: 'P01-06', name: 'Disclosure manager service', path: 'backend/src/membership/disclosureService.ts' },
      { id: 'P01-07', name: 'Terms acceptance at registration', path: 'src/pages/auth/RegisterPage.tsx' },
      { id: 'P01-08', name: 'Account settings UI', path: 'src/pages/membership/AccountSettingsPage.tsx' },
      { id: 'P01-09', name: 'Shared access dashboard', path: 'src/pages/membership/SharedAccessPage.tsx' },
      { id: 'P01-10', name: 'Membership API client', path: 'src/services/membershipApi.ts' },
      { id: 'P01-11', name: 'Stripe checkout wiring', path: 'src/pages/LandingPage.tsx' },
      { id: 'P01-12', name: 'Delegated user limit', path: 'backend/src/organizations/organizationService.ts' },
      { id: 'P01-13', name: 'Program 1 verification report', path: 'reports/PROGRAM_01_UNIVERSAL_MEMBERSHIP.md' },
    ],
  },
  {
    id: 'PROGRAM-00',
    number: 0,
    name: 'Production Website',
    capabilities: [
      { id: 'P00-01', name: 'Landing page', path: 'src/pages/LandingPage.tsx' },
      { id: 'P00-02', name: 'Pricing page', path: 'src/pages/LandingPage.tsx' },
      { id: 'P00-03', name: 'About page', path: 'src/pages/marketing/AboutPage.tsx' },
      { id: 'P00-04', name: 'Features page', path: 'src/pages/marketing/FeaturesPage.tsx' },
      { id: 'P00-05', name: 'FAQ page', path: 'src/pages/marketing/FAQPage.tsx' },
      { id: 'P00-06', name: 'Contact page', path: 'src/pages/ContactSalesPage.tsx' },
      { id: 'P00-07', name: 'Contact API', path: 'backend/src/marketing/contactRoutes.ts' },
      { id: 'P00-08', name: 'Login page', path: 'src/pages/auth/LoginPage.tsx' },
      { id: 'P00-09', name: 'Registration page', path: 'src/pages/auth/RegisterPage.tsx' },
      { id: 'P00-10', name: 'Password reset', path: 'src/pages/auth/ForgotPasswordPage.tsx' },
      { id: 'P00-11', name: 'Email verification', path: 'src/pages/auth/VerifyEmailPage.tsx' },
      { id: 'P00-12', name: 'Privacy policy', path: 'src/pages/marketing/PrivacyPolicyPage.tsx' },
      { id: 'P00-13', name: 'Terms of service', path: 'src/pages/marketing/TermsOfServicePage.tsx' },
      { id: 'P00-14', name: 'Public marketing layout', path: 'src/components/marketing/PublicMarketingLayout.tsx' },
      { id: 'P00-15', name: 'Website verification report', path: 'reports/PROGRAM_00_PRODUCTION_WEBSITE.md' },
    ],
  },
  {
    id: 'PROGRAM-02',
    number: 2,
    name: 'Law Firm Operating Platform',
    capabilities: [
      { id: 'P02-01', name: 'Organization profile & settings', path: 'backend/src/organizations/organizationRoutes.ts' },
      { id: 'P02-02', name: 'Multiple offices & branches', path: 'backend/src/organizations/firmPlatformService.ts' },
      { id: 'P02-03', name: 'Department management', path: 'backend/src/organizations/firmPlatformService.ts' },
      { id: 'P02-04', name: 'Practice groups', path: 'backend/src/organizations/organizationService.ts' },
      { id: 'P02-05', name: 'Personnel management', path: 'backend/src/organizations/firmPlatformService.ts' },
      { id: 'P02-06', name: 'Invitations & onboarding', path: 'backend/src/organizations/organizationService.ts' },
      { id: 'P02-07', name: 'Branding & theme', path: 'backend/src/organizations/firmPlatformService.ts' },
      { id: 'P02-08', name: 'Client team assignments', path: 'backend/src/organizations/firmPlatformService.ts' },
      { id: 'P02-09', name: 'Internal messaging & tasks', path: 'backend/src/organizations/firmPlatformService.ts' },
      { id: 'P02-10', name: 'Knowledge management', path: 'backend/src/organizations/firmPlatformService.ts' },
      { id: 'P02-11', name: 'Conflict checking', path: 'backend/src/organizations/firmPlatformService.ts' },
      { id: 'P02-12', name: 'Permissions & approvals', path: 'backend/src/organizations/firmPlatformService.ts' },
      { id: 'P02-13', name: 'Firm analytics dashboards', path: 'backend/src/organizations/firmPlatformService.ts' },
      { id: 'P02-14', name: 'Firm platform API', path: 'backend/src/organizations/firmPlatformRoutes.ts' },
      { id: 'P02-15', name: 'Firm Operating Platform UI', path: 'src/pages/organization/FirmOperatingPlatformPage.tsx' },
      { id: 'P02-16', name: 'Cross-tenant isolation tests', path: 'backend/tests/organization-domain.test.ts' },
      { id: 'P02-17', name: 'Firm platform tests', path: 'backend/tests/firm-platform.test.ts' },
      { id: 'P02-18', name: 'Visual demonstration report', path: 'reports/PROGRAM_02_DEMONSTRATION.md' },
    ],
  },
  {
    id: 'PROGRAM-23',
    number: 23,
    name: 'Litigation Intelligence',
    capabilities: [
      { id: 'P23-01', name: 'Contradiction engine', path: 'backend/src/contradiction/contradictionEngine.ts' },
      { id: 'P23-02', name: 'Evidence gap detection', path: 'backend/src/intelligence/evidenceGapDetectionService.ts' },
      { id: 'P23-03', name: 'Attorney intelligence orchestrator', path: 'backend/src/intelligence/caseIntelligenceOrchestrator.ts' },
      { id: 'P23-04', name: 'Element analysis', path: 'backend/src/intelligence/elementAnalysisService.ts' },
      { id: 'P23-05', name: 'Unknown management', path: 'backend/src/intelligence/unknownManagementService.ts' },
    ],
  },
  {
    id: 'PROGRAM-24',
    number: 24,
    name: 'CourtAccess AI Operating System',
    capabilities: [
      { id: 'P24-01', name: 'AI governance routes', path: 'backend/src/governance/governanceRoutes.ts' },
      { id: 'P24-02', name: 'Policy narrative guard', path: 'backend/src/services/policyNarrativeGuard.ts' },
      { id: 'P24-03', name: 'Citation validation', path: 'backend/src/intelligence/unknownManagementService.ts' },
      { id: 'P24-04', name: 'Confidence scoring', path: 'backend/src/intelligence/caseIntelligenceOrchestrator.ts' },
    ],
  },
];

export async function assessProductionPrograms(): Promise<{
  programs: Array<ProgramDefinition & { completionPercent: number; capabilitiesComplete: number }>;
}> {
  const programs = [];
  for (const program of PRODUCTION_COMPLETION_PROGRAMS) {
    let complete = 0;
    for (const cap of program.capabilities) {
      if (await fileExists(workspacePath(cap.path))) complete += 1;
    }
    programs.push({
      ...program,
      capabilitiesComplete: complete,
      completionPercent: Math.round((complete / program.capabilities.length) * 100),
    });
  }
  return { programs };
}
