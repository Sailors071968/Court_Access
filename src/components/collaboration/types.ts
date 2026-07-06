// =============================================================================
// CourtAccess — Collaboration types (Program 32)
// UI models only. Authorization is delegated to the existing permission engine
// (membershipApi.createPermissionGrant + ROLE_PERMISSIONS) — never duplicated here.
// =============================================================================

export type CollaboratorRole =
  | 'attorney'
  | 'secretary'
  | 'client'
  | 'investigator'
  | 'expert'
  | 'paralegal'
  | 'family'
  | 'admin';

export interface Collaborator {
  userId: string;
  name: string;
  role: CollaboratorRole;
  online?: boolean;
  typing?: boolean;
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
  attorney: 'Attorney',
  secretary: 'Secretary',
  client: 'Client',
  investigator: 'Investigator',
  expert: 'Expert',
  paralegal: 'Paralegal',
  family: 'Family',
  admin: 'Administrator',
};
