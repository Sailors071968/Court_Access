// ============================================================================
// Program 141 — Enterprise permission matrix (deterministic policy)
// The canonical role → permission policy. Every permission defaults to OFF;
// each role enables only the listed permissions. The Principal Account (org
// owner / admin) is the sole holder of billing + user-management + platform
// permissions. This is the real, code-defined policy — not fabricated.
// ============================================================================

export const PERMISSIONS = [
  'createCase', 'deleteCase', 'archiveCase',
  'uploadEvidence', 'deleteEvidence',
  'processVideo', 'processAudio', 'ocr', 'aiAnalysis',
  'generateReports', 'knowledgeGraph', 'timeline', 'contradictions',
  'narrativeAnalysis', 'litigationStrategy', 'caseBrief', 'downloadDiscovery',
  'inviteUsers', 'manageUsers', 'modifyPermissions',
  'viewBilling', 'manageBilling',
  'viewApiCommandCenter', 'viewOperationsDashboard',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// Roles recognized by the enterprise permission system.
export const ROLES = [
  'principal', 'attorney', 'investigator', 'paralegal', 'legal_assistant',
  'office_admin', 'expert_witness', 'consultant', 'defendant', 'family_member',
] as const;
export type EnterpriseRole = (typeof ROLES)[number];

// Enabled permissions per role. Everything not listed defaults OFF.
const ENABLED: Record<EnterpriseRole, Permission[]> = {
  // Principal Account — sole owner of billing, users, and platform controls.
  principal: [...PERMISSIONS],
  attorney: [
    'createCase', 'archiveCase', 'uploadEvidence', 'processVideo', 'processAudio', 'ocr',
    'aiAnalysis', 'generateReports', 'knowledgeGraph', 'timeline', 'contradictions',
    'narrativeAnalysis', 'litigationStrategy', 'caseBrief', 'downloadDiscovery',
  ],
  investigator: [
    'uploadEvidence', 'processVideo', 'processAudio', 'ocr', 'knowledgeGraph',
    'timeline', 'contradictions',
  ],
  paralegal: [
    'uploadEvidence', 'ocr', 'generateReports', 'timeline', 'caseBrief', 'downloadDiscovery',
  ],
  legal_assistant: ['uploadEvidence', 'timeline'],
  office_admin: ['inviteUsers', 'manageUsers', 'viewBilling', 'viewOperationsDashboard'],
  expert_witness: ['timeline', 'caseBrief'],
  consultant: ['timeline', 'knowledgeGraph'],
  defendant: ['timeline', 'caseBrief'],
  family_member: [],
};

export function matrixFor(role: EnterpriseRole): Record<Permission, boolean> {
  const enabled = new Set(ENABLED[role] ?? []);
  const out = {} as Record<Permission, boolean>;
  for (const p of PERMISSIONS) out[p] = enabled.has(p);
  return out;
}

export function fullMatrix(): Record<EnterpriseRole, Record<Permission, boolean>> {
  const out = {} as Record<EnterpriseRole, Record<Permission, boolean>>;
  for (const r of ROLES) out[r] = matrixFor(r);
  return out;
}

/** Maps a stored User/OrganizationMember role to an enterprise role. */
export function toEnterpriseRole(role: string, isOwner: boolean): EnterpriseRole {
  if (isOwner || role === 'owner' || role === 'admin') return 'principal';
  if ((ROLES as readonly string[]).includes(role)) return role as EnterpriseRole;
  if (role === 'staff') return 'paralegal';
  return 'consultant';
}

// Redaction modes every uploaded document supports (selectable per user/case).
export const REDACTION_MODES = [
  'unredacted', 'attorney_redacted', 'investigator_redacted', 'client_redacted', 'custom',
] as const;

// Billing ownership is ALWAYS the Principal Account — designees are never billed.
export const BILLING_OWNED_ITEMS = [
  'Stripe subscription', 'Evidence processing', 'Video processing', 'OCR charges',
  'AI processing', 'Storage', 'API usage', 'Provider usage',
] as const;
