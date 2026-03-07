// ============================================
// Court Access — Collaboration Service (Phase 19: Collaboration System)
// Multi-user case collaboration: roles, annotations, comments, activity history.
//
// Features:
//   - Add/remove collaborators with role-based access
//   - Create/list annotations on evidence
//   - Comment threads with replies
//   - Activity feed for case history
//
// All operations are tenant-isolated.
// ============================================

import type {
  CaseCollaborator,
  CollaboratorRole,
  EvidenceAnnotation,
  AnnotationType,
  CommentThread,
  Comment,
  ActivityEntry,
  ActivityAction,
  BetaInvite,
  InviteStatus,
} from '../models/CollaborationModel';
import { COLLABORATOR_ROLE_PERMISSIONS } from '../models/CollaborationModel';

// ---------------------------------------------------------------------------
// ID Generation
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

// ---------------------------------------------------------------------------
// Collaborator Management
// ---------------------------------------------------------------------------

export function addCollaborator(
  caseId: string,
  userId: string,
  userName: string,
  userEmail: string,
  role: CollaboratorRole,
  addedBy: string
): CaseCollaborator {
  return {
    collaboratorId: generateId('collab'),
    caseId,
    userId,
    userName,
    userEmail,
    role,
    addedBy,
    addedAt: new Date().toISOString(),
    lastAccessedAt: null,
    isActive: true,
  };
}

export function removeCollaborator(
  collaborator: CaseCollaborator
): CaseCollaborator {
  return {
    ...collaborator,
    isActive: false,
  };
}

export function updateCollaboratorRole(
  collaborator: CaseCollaborator,
  newRole: CollaboratorRole
): CaseCollaborator {
  return {
    ...collaborator,
    role: newRole,
  };
}

export function hasPermission(
  role: CollaboratorRole,
  permission: string
): boolean {
  return COLLABORATOR_ROLE_PERMISSIONS[role].includes(permission);
}

export function getCollaboratorsForCase(
  collaborators: CaseCollaborator[],
  caseId: string
): CaseCollaborator[] {
  return collaborators.filter((c) => c.caseId === caseId && c.isActive);
}

// ---------------------------------------------------------------------------
// Annotation Management
// ---------------------------------------------------------------------------

export function createAnnotation(
  evidenceId: string,
  caseId: string,
  userId: string,
  userName: string,
  annotationType: AnnotationType,
  content: string,
  options: {
    pageNumber?: number;
    positionX?: number;
    positionY?: number;
    timestampInMedia?: number;
  } = {}
): EvidenceAnnotation {
  return {
    annotationId: generateId('ann'),
    evidenceId,
    caseId,
    userId,
    userName,
    annotationType,
    content,
    pageNumber: options.pageNumber ?? null,
    positionX: options.positionX ?? null,
    positionY: options.positionY ?? null,
    timestampInMedia: options.timestampInMedia ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
}

export function updateAnnotation(
  annotation: EvidenceAnnotation,
  newContent: string
): EvidenceAnnotation {
  return {
    ...annotation,
    content: newContent,
    updatedAt: new Date().toISOString(),
  };
}

export function getAnnotationsForEvidence(
  annotations: EvidenceAnnotation[],
  evidenceId: string
): EvidenceAnnotation[] {
  return annotations
    .filter((a) => a.evidenceId === evidenceId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// ---------------------------------------------------------------------------
// Comment Threads
// ---------------------------------------------------------------------------

export function createCommentThread(
  caseId: string,
  createdBy: string,
  createdByName: string,
  subject: string,
  initialComment: string,
  evidenceId: string | null = null
): CommentThread {
  const threadId = generateId('thread');
  const comment: Comment = {
    commentId: generateId('comment'),
    threadId,
    userId: createdBy,
    userName: createdByName,
    content: initialComment,
    createdAt: new Date().toISOString(),
    editedAt: null,
    isEdited: false,
  };

  return {
    threadId,
    caseId,
    evidenceId,
    createdBy,
    createdByName,
    createdAt: new Date().toISOString(),
    subject,
    comments: [comment],
    isResolved: false,
    resolvedAt: null,
    resolvedBy: null,
  };
}

export function addReply(
  thread: CommentThread,
  userId: string,
  userName: string,
  content: string
): CommentThread {
  const comment: Comment = {
    commentId: generateId('comment'),
    threadId: thread.threadId,
    userId,
    userName,
    content,
    createdAt: new Date().toISOString(),
    editedAt: null,
    isEdited: false,
  };

  return {
    ...thread,
    comments: [...thread.comments, comment],
  };
}

export function resolveThread(
  thread: CommentThread,
  resolvedBy: string
): CommentThread {
  return {
    ...thread,
    isResolved: true,
    resolvedAt: new Date().toISOString(),
    resolvedBy,
  };
}

export function getThreadsForCase(
  threads: CommentThread[],
  caseId: string,
  unresolvedOnly: boolean = false
): CommentThread[] {
  let filtered = threads.filter((t) => t.caseId === caseId);
  if (unresolvedOnly) {
    filtered = filtered.filter((t) => !t.isResolved);
  }
  return filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ---------------------------------------------------------------------------
// Activity History
// ---------------------------------------------------------------------------

export function logActivity(
  caseId: string,
  userId: string,
  userName: string,
  action: ActivityAction,
  description: string,
  targetId: string | null = null,
  targetType: string | null = null,
  metadata: Record<string, unknown> = {}
): ActivityEntry {
  return {
    activityId: generateId('activity'),
    caseId,
    userId,
    userName,
    action,
    description,
    targetId,
    targetType,
    metadata,
    timestamp: new Date().toISOString(),
  };
}

export function getActivityForCase(
  activities: ActivityEntry[],
  caseId: string,
  limit: number = 50
): ActivityEntry[] {
  return activities
    .filter((a) => a.caseId === caseId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Beta Invite Management
// ---------------------------------------------------------------------------

export function createBetaInvite(
  email: string,
  invitedBy: string,
  role: CollaboratorRole,
  expiresInDays: number = 7
): BetaInvite {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
  const inviteCode = `CA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  return {
    inviteId: generateId('invite'),
    email,
    invitedBy,
    role,
    status: 'pending' as InviteStatus,
    inviteCode,
    createdAt: now.toISOString(),
    acceptedAt: null,
    expiresAt: expiresAt.toISOString(),
  };
}

export function acceptInvite(invite: BetaInvite): BetaInvite {
  if (invite.status !== 'pending') return invite;
  if (new Date(invite.expiresAt) < new Date()) {
    return { ...invite, status: 'expired' as InviteStatus };
  }
  return {
    ...invite,
    status: 'accepted' as InviteStatus,
    acceptedAt: new Date().toISOString(),
  };
}

export function revokeInvite(invite: BetaInvite): BetaInvite {
  return {
    ...invite,
    status: 'revoked' as InviteStatus,
  };
}
