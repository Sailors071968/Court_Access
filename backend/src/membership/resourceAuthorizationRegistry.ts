// ============================================================================
// Release Wave 1 — Resource authorization route registry
// Canonical list of route modules with 7-level permission enforcement.
// ============================================================================

export const AUTHORIZED_ROUTE_MODULES = [
  'backend/src/evidence/caseRoutes.ts',
  'backend/src/evidence/evidenceRoutes.ts',
  'backend/src/charges/chargeRoutes.ts',
  'backend/src/clients/clientRoutes.ts',
  'backend/src/communications/messagingRoutes.ts',
  'backend/src/investigator/investigatorRoutes.ts',
  'backend/src/workbench/workbenchRoutes.ts',
  'backend/src/intelligence/intelligenceRoutes.ts',
  'backend/src/routes/calcrimRoutes.ts',
  'backend/src/membership/membershipRoutes.ts',
  'backend/src/communications/hearingRoutes.ts',
  'backend/src/organizations/organizationRoutes.ts',
] as const;

export const ENFORCED_RESOURCE_SCOPES = [
  'organization',
  'office',
  'case',
  'charge',
  'document',
  'ocr',
  'evidence',
  'timeline',
  'witness',
  'lead',
  'report',
  'authority',
  'calcrim',
  'communications',
  'notes',
  'billing',
  'dashboard',
] as const;
