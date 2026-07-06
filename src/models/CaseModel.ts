// ============================================
// Court Access — Canonical Case Model (Phase 1)
// Central domain object. All case-related entities
// are defined here with strict typing.
// ============================================

// ---------------------------------------------------------------------------
// Case lifecycle
// ---------------------------------------------------------------------------

/** Deterministic case phase — no implicit transitions. */
export type CasePhase =
  | 'intake'
  | 'preliminary'
  | 'pretrial'
  | 'trial'
  | 'sentencing'
  | 'appeal'
  | 'closed';

/** High-level case status. */
export type CaseStatus = 'active' | 'pending' | 'closed' | 'archived';

// ---------------------------------------------------------------------------
// Charges
// ---------------------------------------------------------------------------

/** Evidence status for individual charge elements. */
export type EvidenceStatus = 'established' | 'disputed' | 'weak' | 'unclear';

/** A single provable element within a charge (e.g. CALCRIM element). */
export interface ChargeElement {
  number: number;
  description: string;
  status: EvidenceStatus;
  details: string;
}

/** A criminal charge with CALCRIM element breakdown. */
export interface ChargeEntity {
  id: string;
  code: string;
  title: string;
  degree: string | null;
  calcrimNumber: string | null;
  elements: ChargeElement[];
  potentialSentence: string | null;
  enhancement: string | null;
}

// ---------------------------------------------------------------------------
// Expert Witnesses
// ---------------------------------------------------------------------------

export type ExpertRecommendation = 'recommended' | 'consider';

/** An expert witness recommendation attached to a case. */
export interface ExpertEntity {
  id: string;
  title: string;
  recommendation: ExpertRecommendation;
  reason: string;
  costRange: string;
}

// ---------------------------------------------------------------------------
// Motions
// ---------------------------------------------------------------------------

export type MotionPriority = 'high' | 'medium' | 'low';

/** A motion recommendation attached to a case. */
export interface MotionEntity {
  id: string;
  title: string;
  code: string | null;
  priority: MotionPriority;
  description: string;
}

// ---------------------------------------------------------------------------
// Activity / Audit Log
// ---------------------------------------------------------------------------

export type ActivityType = 'document' | 'hearing' | 'analysis' | 'motion' | 'system';

/** A single activity/audit-log entry. */
export interface ActivityEntry {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  actionLabel: string | null;
  actionUrl: string | null;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** A user-facing notification derived from activity. */
export interface NotificationEntry {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  actionLabel: string | null;
  actionUrl: string | null;
}

// ---------------------------------------------------------------------------
// Investigative Tasks
// ---------------------------------------------------------------------------

export type TaskPriority = 'high' | 'medium' | 'standard';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/** An investigative task assigned within a case. */
export interface InvestigativeTaskEntity {
  id: string;
  number: number;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
}

// ---------------------------------------------------------------------------
// Case Entity — the central domain object
// ---------------------------------------------------------------------------

/**
 * Canonical Case entity.
 * Everything in Court Access revolves around this object.
 * All fields are explicit — no optional fields with implicit undefined.
 */
export interface CaseEntity {
  id: string;
  tenantId: string;
  caseNumber: string;
  title: string;
  status: CaseStatus;
  phase: CasePhase;
  jurisdiction: string;
  court: string;
  judge: string;
  department: string;
  nextHearing: string | null;
  nextHearingLocation: string | null;
  assignedAttorneyId: string | null;
  assignedInvestigatorId: string | null;
  documentsCount: number;
  chargesCount: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Backward-compatible aliases (consumed by types/index.ts)
// ---------------------------------------------------------------------------

/** @deprecated Use CaseEntity */
export type Case = CaseEntity;
/** @deprecated Use ChargeEntity */
export type Charge = ChargeEntity;
/** @deprecated Use ExpertEntity */
export type Expert = ExpertEntity;
/** @deprecated Use MotionEntity */
export type Motion = MotionEntity;
/** @deprecated Use ActivityEntry */
export type ActivityItem = ActivityEntry;
/** @deprecated Use NotificationEntry */
export type Notification = NotificationEntry;
/** @deprecated Use InvestigativeTaskEntity */
export type InvestigativeTask = InvestigativeTaskEntity;
