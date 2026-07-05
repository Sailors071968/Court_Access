// ============================================
// Court Access — Unified Type Re-exports (Phase 1)
// All domain types are now defined in canonical models.
// This file re-exports for backward compatibility.
// ============================================

// ---------------------------------------------------------------------------
// Canonical Model Re-exports — Case Domain
// ---------------------------------------------------------------------------

export type {
  CaseEntity,
  Case,
  CaseStatus,
  CasePhase,
  EvidenceStatus,
  ChargeElement,
  ChargeEntity,
  Charge,
  ExpertRecommendation,
  ExpertEntity,
  Expert,
  MotionPriority,
  MotionEntity,
  Motion,
  ActivityType,
  ActivityEntry,
  ActivityItem,
  NotificationEntry,
  Notification,
  TaskPriority,
  TaskStatus,
  InvestigativeTaskEntity,
  InvestigativeTask,
} from '../models/CaseModel';

// ---------------------------------------------------------------------------
// Canonical Model Re-exports — Document Domain
// ---------------------------------------------------------------------------

export type {
  DocumentType,
  DocumentAnalysisStatus,
  ExtractionStatus,
  AIAnalysisStatus,
  DocumentEntity,
  CaseDocument,
} from '../models/DocumentModel';

// ---------------------------------------------------------------------------
// Canonical Model Re-exports — Agency Domain
// ---------------------------------------------------------------------------

export type {
  AgencyTier,
  AgencyEntity,
} from '../models/AgencyModel';

// ---------------------------------------------------------------------------
// Canonical Model Re-exports — Intelligence Domain
// ---------------------------------------------------------------------------

export type {
  IntelligenceSeverity,
  SignalCategory,
  IntelligenceSignal,
  ElementCoverageMap,
  IntelligenceSnapshot,
  RiskScoreResult,
  RiskFactor,
  ProsecutionAnalysisResult,
  ProsecutionVulnerability,
  StrengthSummary,
  DefenseInsight,
  SearchResult,
} from '../models/IntelligenceModel';

// ---------------------------------------------------------------------------
// Auth & RBAC (remain here — not domain models)
// ---------------------------------------------------------------------------

export type UserRole = 'investigator' | 'attorney' | 'admin' | 'staff' | 'defendant';

export type DefaultRole =
  | 'attorney'
  | 'criminal_investigator'
  | 'criminal_defendant'
  | 'paralegal'
  | 'secretary'
  | 'expert_witness'
  | 'family_member'
  | 'law_office_administrator'
  | 'other';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  defaultRole?: DefaultRole;
  avatar?: string;
  phone?: string;
}

export interface RolePermissions {
  canViewCharges: boolean;
  canViewEvidence: boolean;
  canViewExperts: boolean;
  canViewMotions: boolean;
  canViewResearch: boolean;
  canViewActivity: boolean;
  canViewDocuments: boolean;
  canUploadDocuments: boolean;
  canManageCases: boolean;
  canViewAdmin: boolean;
  canViewEvidenceManagement: boolean;
  canViewTasks: boolean;
  canViewSettings: boolean;
}

// ---------------------------------------------------------------------------
// Notification Settings (UI-only, not a domain model)
// ---------------------------------------------------------------------------

export interface NotificationSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  courtDateReminders: {
    oneWeek: boolean;
    twentyFourHours: boolean;
    twoHours: boolean;
  };
  newDocumentAlerts: boolean;
  aiAnalysisUpdates: boolean;
  phone: string;
  email: string;
}

// ---------------------------------------------------------------------------
// AI Analysis (legacy — prefer IntelligenceModel types)
// ---------------------------------------------------------------------------

export interface AIAnalysis {
  impactOnDefense: string;
  daStrategy: string;
  elementsBreakdown: import('../models/CaseModel').ChargeElement[];
  recommendedActions: string[];
}
