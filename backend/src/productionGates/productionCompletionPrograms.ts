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
    id: 'PROGRAM-02',
    number: 2,
    name: 'Organizations & Multi-Tenant Law Firm Platform',
    capabilities: [
      { id: 'P02-01', name: 'Law firm management', path: 'backend/src/organizations/organizationRoutes.ts' },
      { id: 'P02-02', name: 'Multiple offices', path: 'backend/src/organizations/organizationService.ts' },
      { id: 'P02-03', name: 'Practice groups', path: 'backend/src/organizations/organizationService.ts' },
      { id: 'P02-04', name: 'Member invitations', path: 'backend/src/organizations/organizationService.ts' },
      { id: 'P02-05', name: 'Organization onboarding', path: 'backend/src/organizations/organizationService.ts' },
      { id: 'P02-06', name: 'Branding & settings', path: 'backend/src/organizations/organizationRoutes.ts' },
      { id: 'P02-07', name: 'Firm analytics', path: 'backend/src/organizations/organizationService.ts' },
      { id: 'P02-08', name: 'Firm-wide search', path: 'backend/src/organizations/organizationService.ts' },
      { id: 'P02-09', name: 'Organization audit logs', path: 'backend/src/organizations/organizationService.ts' },
      { id: 'P02-10', name: 'Tenant administration UI', path: 'src/pages/organization/OrganizationSettingsPage.tsx' },
      { id: 'P02-11', name: 'Cross-tenant isolation tests', path: 'backend/tests/organization-domain.test.ts' },
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
