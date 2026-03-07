// ============================================
// Court Access — Collaboration Model (Phase 19: Collaboration System)
// Multi-user case collaboration with roles, annotations, comments, and activity history.
// ============================================

// ---------------------------------------------------------------------------
// Collaborator Roles
// ---------------------------------------------------------------------------

export type CollaboratorRole = 'attorney' | 'investigator' | 'researcher';

export const COLLABORATOR_ROLE_LABELS: Record<CollaboratorRole, string> = {
  attorney: 'Attorney',
  investigator: 'Investigator',
  researcher: 'Researcher',
};

export const COLLABORATOR_ROLE_PERMISSIONS: Record<CollaboratorRole, string[]> = {
  attorney: ['view', 'upload', 'annotate', 'comment', 'export', 'share', 'manage'],
  investigator: ['view', 'upload', 'annotate', 'comment', 'export'],
  researcher: ['view', 'annotate', 'comment'],
};

// ---------------------------------------------------------------------------
// Case Collaborator
// ---------------------------------------------------------------------------

export interface CaseCollaborator {
  collaboratorId: string;
  caseId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: CollaboratorRole;
  addedBy: string;
  addedAt: string;
  lastAccessedAt: string | null;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Evidence Annotation
// ---------------------------------------------------------------------------

export type AnnotationType = 'highlight' | 'note' | 'flag' | 'question' | 'important';

export interface EvidenceAnnotation {
  annotationId: string;
  evidenceId: string;
  caseId: string;
  userId: string;
  userName: string;
  annotationType: AnnotationType;
  content: string;
  pageNumber: number | null;
  positionX: number | null;
  positionY: number | null;
  timestampInMedia: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export const ANNOTATION_TYPE_LABELS: Record<AnnotationType, string> = {
  highlight: 'Highlight',
  note: 'Note',
  flag: 'Flag',
  question: 'Question',
  important: 'Important',
};

// ---------------------------------------------------------------------------
// Comment Thread
// ---------------------------------------------------------------------------

export interface CommentThread {
  threadId: string;
  caseId: string;
  evidenceId: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  subject: string;
  comments: Comment[];
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface Comment {
  commentId: string;
  threadId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  isEdited: boolean;
}

// ---------------------------------------------------------------------------
// Activity History
// ---------------------------------------------------------------------------

export type ActivityAction =
  | 'case_created'
  | 'case_updated'
  | 'collaborator_added'
  | 'collaborator_removed'
  | 'evidence_uploaded'
  | 'evidence_processed'
  | 'evidence_viewed'
  | 'annotation_created'
  | 'annotation_deleted'
  | 'comment_posted'
  | 'thread_resolved'
  | 'export_generated'
  | 'search_performed';

export interface ActivityEntry {
  activityId: string;
  caseId: string;
  userId: string;
  userName: string;
  action: ActivityAction;
  description: string;
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  case_created: 'Created case',
  case_updated: 'Updated case',
  collaborator_added: 'Added collaborator',
  collaborator_removed: 'Removed collaborator',
  evidence_uploaded: 'Uploaded evidence',
  evidence_processed: 'Evidence processed',
  evidence_viewed: 'Viewed evidence',
  annotation_created: 'Created annotation',
  annotation_deleted: 'Deleted annotation',
  comment_posted: 'Posted comment',
  thread_resolved: 'Resolved thread',
  export_generated: 'Generated export',
  search_performed: 'Performed search',
};

// ---------------------------------------------------------------------------
// Beta Invite
// ---------------------------------------------------------------------------

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface BetaInvite {
  inviteId: string;
  email: string;
  invitedBy: string;
  role: CollaboratorRole;
  status: InviteStatus;
  inviteCode: string;
  createdAt: string;
  acceptedAt: string | null;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Beta User Limits
// ---------------------------------------------------------------------------

export interface BetaUserLimits {
  maxCases: number;
  maxEvidencePerCase: number;
  maxStorageMB: number;
  maxCollaboratorsPerCase: number;
  allowedFeatures: string[];
}

export const DEFAULT_BETA_LIMITS: BetaUserLimits = {
  maxCases: 5,
  maxEvidencePerCase: 50,
  maxStorageMB: 500,
  maxCollaboratorsPerCase: 3,
  allowedFeatures: [
    'upload',
    'document_analysis',
    'audio_transcription',
    'search',
    'timeline',
    'annotations',
    'comments',
    'export',
  ],
};
