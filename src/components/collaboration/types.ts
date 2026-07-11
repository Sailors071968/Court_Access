// =============================================================================
// CourtAccess — Collaboration types (Program 32)
// UI models only. Authorization is delegated to the existing permission engine
// (membershipApi.createPermissionGrant + ROLE_PERMISSIONS) — never duplicated here.
// =============================================================================

export type CollaboratorRole =
  | 'lead_attorney'
  | 'co_counsel'
  | 'attorney'
  | 'investigator'
  | 'paralegal'
  | 'legal_assistant'
  | 'office_admin'
  | 'client'
  | 'defendant'
  | 'expert'
  | 'consultant'
  | 'researcher'
  | 'secretary'
  | 'family'
  | 'admin';

export interface Collaborator {
  userId: string;
  name: string;
  role: CollaboratorRole;
  /** Custom role label (future-ready) — overrides the ROLE_LABELS mapping. */
  customRole?: string;
  avatarUrl?: string | null;
  email?: string;
  online?: boolean;
  typing?: boolean;
  status?: 'active' | 'suspended' | 'removed';
  /** Permission strings from the permission engine (scope:permission). */
  permissions?: string[];
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  at: string;
  mentions?: string[];
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target?: string;
  at: string;
  type?: 'comment' | 'task' | 'evidence' | 'approval' | 'request' | 'system';
}

export const ROLE_LABELS: Record<CollaboratorRole, string> = {
  lead_attorney: 'Lead Attorney',
  co_counsel: 'Co-Counsel',
  attorney: 'Attorney',
  investigator: 'Investigator',
  paralegal: 'Paralegal',
  legal_assistant: 'Legal Assistant',
  office_admin: 'Office Administrator',
  client: 'Client',
  defendant: 'Defendant',
  expert: 'Expert Witness',
  consultant: 'Consultant',
  researcher: 'Researcher',
  secretary: 'Secretary',
  family: 'Family',
  admin: 'Administrator',
};
