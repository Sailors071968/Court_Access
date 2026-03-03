// ============================================
// Court Access — Unified Type Definitions
// ============================================

// --- Roles ---
export type UserRole = 'investigator' | 'attorney' | 'admin' | 'staff';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
}

// --- Cases ---
export type CaseStatus = 'active' | 'closed' | 'pending' | 'archived';

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  status: CaseStatus;
  jurisdiction: string;
  court: string;
  judge: string;
  department: string;
  nextHearing?: string;
  nextHearingLocation?: string;
  documentsCount: number;
  chargesCount: number;
  createdAt: string;
  updatedAt: string;
}

// --- Charges ---
export type EvidenceStatus = 'established' | 'disputed' | 'weak' | 'unclear';

export interface ChargeElement {
  number: number;
  description: string;
  status: EvidenceStatus;
  details: string;
}

export interface Charge {
  id: string;
  code: string;
  title: string;
  degree?: string;
  calcrimNumber?: string;
  elements: ChargeElement[];
  potentialSentence?: string;
  enhancement?: string;
}

// --- Evidence / Documents ---
export type DocumentType =
  | 'defense_motion'
  | 'charging_document'
  | 'transcript'
  | 'prosecution_motion'
  | 'court_order'
  | 'defense_filing'
  | 'other';

export type AIAnalysisStatus = 'analyzed' | 'analyzing' | 'pending' | 'failed';

export interface CaseDocument {
  id: string;
  name: string;
  type: DocumentType;
  filedDate: string;
  pages: number;
  aiStatus: AIAnalysisStatus;
  fileSize?: string;
  fileType?: string;
}

// --- Experts ---
export type ExpertRecommendation = 'recommended' | 'consider';

export interface Expert {
  id: string;
  title: string;
  recommendation: ExpertRecommendation;
  reason: string;
  costRange: string;
}

// --- Motions ---
export type MotionPriority = 'high' | 'medium' | 'low';

export interface Motion {
  id: string;
  title: string;
  code?: string;
  priority: MotionPriority;
  description: string;
}

// --- Activity ---
export type ActivityType = 'document' | 'hearing' | 'analysis' | 'motion' | 'system';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  actionLabel?: string;
  actionUrl?: string;
}

// --- Notifications ---
export interface Notification {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  actionLabel?: string;
  actionUrl?: string;
}

// --- Investigative Tasks ---
export type TaskPriority = 'high' | 'medium' | 'standard';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface InvestigativeTask {
  id: string;
  number: number;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
}

// --- AI Insights ---
export interface DefenseInsight {
  id: string;
  content: string;
}

export interface AIAnalysis {
  impactOnDefense: string;
  daStrategy: string;
  elementsBreakdown: ChargeElement[];
  recommendedActions: string[];
}

// --- Search ---
export interface SearchResult {
  id: string;
  type: 'case' | 'document' | 'statute';
  title: string;
  description: string;
  url: string;
}

// --- Notification Settings ---
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

// --- RBAC ---
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
  canViewTasks: boolean;
  canViewSettings: boolean;
}
