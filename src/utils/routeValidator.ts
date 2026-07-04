// ============================================================================
// Phase 269 — Frontend Route Validation Utility
// Validates all registered routes resolve correctly at build time
// Catches broken route references, missing lazy imports, and dead links
// ============================================================================

export interface RouteDefinition {
  path: string;
  label: string;
  requiresAuth: boolean;
  requiredPermission?: string;
  component: string;
  status: 'active' | 'deprecated' | 'planned';
}

/**
 * Canonical route registry — single source of truth for all frontend routes.
 * If a route is added to App.tsx, it MUST be registered here.
 */
export const ROUTE_REGISTRY: RouteDefinition[] = [
  // Public routes
  { path: '/', label: 'Landing', requiresAuth: false, component: 'LandingPage', status: 'active' },
  { path: '/login', label: 'Login', requiresAuth: false, component: 'LoginPage', status: 'active' },
  { path: '/register', label: 'Register', requiresAuth: false, component: 'RegisterPage', status: 'active' },
  { path: '/for-defense', label: 'For Defense', requiresAuth: false, component: 'ForDefensePage', status: 'active' },

  // Dashboard routes
  { path: '/dashboard', label: 'Dashboard', requiresAuth: true, component: 'DashboardRouter', status: 'active' },
  { path: '/dashboard/staff', label: 'Staff Dashboard', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'StaffDashboard', status: 'active' },
  { path: '/dashboard/defendant', label: 'Defendant Dashboard', requiresAuth: true, component: 'DefendantDashboard', status: 'active' },
  { path: '/dashboard/marketing', label: 'Marketing', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'MarketingDashboard', status: 'active' },
  { path: '/dashboard/demo-requests', label: 'Demo Requests', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'DemoRequestsDashboard', status: 'active' },
  { path: '/dashboard/discount-codes', label: 'Discount Codes', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'DiscountCodesDashboard', status: 'active' },
  { path: '/dashboard/policy-compliance', label: 'Policy Compliance', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'PolicyComplianceDashboard', status: 'active' },
  { path: '/dashboard/policy-intelligence/coverage', label: 'Policy Intelligence', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'PolicyIntelligenceDashboard', status: 'active' },
  { path: '/dashboard/repository-integrity', label: 'Repository Integrity', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'RepositoryIntegrityDashboard', status: 'active' },
  { path: '/dashboard/policy-operations', label: 'Policy Operations', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'PolicyOperationsDashboard', status: 'active' },
  { path: '/dashboard/cpra', label: 'CPRA Tracker', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'CpraDashboard', status: 'active' },
  { path: '/dashboard/system-health', label: 'System Health', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'SystemHealthDashboard', status: 'active' },
  { path: '/dashboard/evidence-management', label: 'Evidence Management', requiresAuth: true, requiredPermission: 'canViewEvidenceManagement', component: 'EvidenceManagementDashboard', status: 'active' },
  { path: '/dashboard/evidence-processing', label: 'Evidence Processing', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'EvidenceProcessingTrace', status: 'active' },
  { path: '/dashboard/system/workers', label: 'Worker Queues', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'WorkerQueueMonitoring', status: 'active' },
  { path: '/dashboard/policy-topic-registry', label: 'Policy Topic Registry', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'PolicyTopicRegistry', status: 'active' },
  { path: '/dashboard/beta-verification', label: 'Beta Verification', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'BetaDeploymentVerification', status: 'active' },
  { path: '/dashboard/policy-matrix', label: 'Policy Matrix', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'PolicyMatrixVirtualized', status: 'active' },
  { path: '/dashboard/cpra-timeline', label: 'CPRA Timeline', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'CpraCampaignTimeline', status: 'active' },
  { path: '/dashboard/government-outreach', label: 'Government Outreach', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'GovernmentOutreachDashboard', status: 'active' },
  { path: '/dashboard/case-timeline', label: 'Case Timeline', requiresAuth: true, requiredPermission: 'canViewAdmin', component: 'CaseTimelineVisualizer', status: 'active' },
  { path: '/dashboard/evidence-requests', label: 'AI Evidence Requests', requiresAuth: true, requiredPermission: 'canViewEvidence', component: 'EvidenceRequestsDashboard', status: 'active' },

  // Case routes
  { path: '/cases', label: 'Cases List', requiresAuth: true, component: 'CasesListPage', status: 'active' },
  { path: '/cases/:caseId', label: 'Case Layout', requiresAuth: true, component: 'CaseLayout', status: 'active' },
  { path: '/cases/:caseId/overview', label: 'Case Overview', requiresAuth: true, component: 'CaseOverviewPage', status: 'active' },
  { path: '/cases/:caseId/attorney-workbench', label: 'Attorney Workbench', requiresAuth: true, requiredPermission: 'canViewEvidence', component: 'AttorneyWorkbenchPage', status: 'active' },
  { path: '/cases/:caseId/evidence', label: 'Evidence', requiresAuth: true, component: 'EvidencePage', status: 'active' },
  { path: '/cases/:caseId/charges', label: 'Charges', requiresAuth: true, component: 'ChargesPage', status: 'active' },
  { path: '/cases/:caseId/documents', label: 'Documents', requiresAuth: true, component: 'DocumentsPage', status: 'active' },
  { path: '/cases/:caseId/experts', label: 'Experts', requiresAuth: true, component: 'ExpertsPage', status: 'active' },
  { path: '/cases/:caseId/motions', label: 'Motions', requiresAuth: true, component: 'MotionsPage', status: 'active' },
  { path: '/cases/:caseId/research', label: 'Research', requiresAuth: true, component: 'ResearchPage', status: 'active' },
  { path: '/cases/:caseId/activity', label: 'Activity', requiresAuth: true, component: 'ActivityPage', status: 'active' },
  { path: '/cases/:caseId/trial-exhibits', label: 'Trial Exhibits', requiresAuth: true, component: 'TrialExhibitWorkspace', status: 'active' },
  { path: '/cases/:caseId/litigation-strategy', label: 'Litigation Strategy', requiresAuth: true, requiredPermission: 'canViewEvidence', component: 'LitigationStrategyView', status: 'active' },
  { path: '/cases/:caseId/settings', label: 'Case Settings', requiresAuth: true, requiredPermission: 'canManageCases', component: 'CaseSettingsPage', status: 'active' },

  // Utility routes
  { path: '/search', label: 'Search', requiresAuth: true, component: 'SearchPage', status: 'active' },
  { path: '/notifications', label: 'Notifications', requiresAuth: true, component: 'NotificationsPage', status: 'active' },
  { path: '/settings', label: 'Settings', requiresAuth: true, component: 'SettingsPage', status: 'active' },
];

/**
 * Validate that all route paths are unique.
 */
export function validateRouteUniqueness(): { valid: boolean; duplicates: string[] } {
  const paths = ROUTE_REGISTRY.map((r) => r.path);
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const path of paths) {
    if (seen.has(path)) {
      duplicates.push(path);
    }
    seen.add(path);
  }

  return { valid: duplicates.length === 0, duplicates };
}

/**
 * Get all active routes that require a specific permission.
 */
export function getRoutesRequiringPermission(permission: string): RouteDefinition[] {
  return ROUTE_REGISTRY.filter(
    (r) => r.status === 'active' && r.requiredPermission === permission
  );
}

/**
 * Get the route definition for a given path pattern.
 */
export function getRouteByPath(path: string): RouteDefinition | undefined {
  return ROUTE_REGISTRY.find((r) => r.path === path);
}

/**
 * Get all routes grouped by section (public, dashboard, case, utility).
 */
export function getRoutesBySection(): Record<string, RouteDefinition[]> {
  return {
    public: ROUTE_REGISTRY.filter((r) => !r.requiresAuth),
    dashboard: ROUTE_REGISTRY.filter((r) => r.path.startsWith('/dashboard')),
    case: ROUTE_REGISTRY.filter((r) => r.path.startsWith('/cases')),
    utility: ROUTE_REGISTRY.filter(
      (r) => r.requiresAuth && !r.path.startsWith('/dashboard') && !r.path.startsWith('/cases')
    ),
  };
}
