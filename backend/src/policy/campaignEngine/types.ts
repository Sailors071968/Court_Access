// ============================================
// Court Access — Campaign Engine Types
// Type definitions for policy acquisition campaigns.
// ============================================

// ---------------------------------------------------------------------------
// Policy Request Status
// ---------------------------------------------------------------------------

export type PolicyRequestStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'responded'
  | 'documents_received'
  | 'denied'
  | 'no_response';

export const ALL_REQUEST_STATUSES: PolicyRequestStatus[] = [
  'pending',
  'sent',
  'delivered',
  'responded',
  'documents_received',
  'denied',
  'no_response',
];

// ---------------------------------------------------------------------------
// Policy Request Record (mirrors Prisma model)
// ---------------------------------------------------------------------------

export interface PolicyRequestRecord {
  id: string;
  agencyId: string;
  requestSentAt: Date;
  responseAt: Date | null;
  status: PolicyRequestStatus;
  trackingId: string;
  sesMessageId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Campaign Filter
// ---------------------------------------------------------------------------

export interface CampaignFilter {
  agencyId?: string;
  status?: PolicyRequestStatus;
  county?: string;
  agencyType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Paginated Result
// ---------------------------------------------------------------------------

export interface PaginatedRequestResult {
  requests: PolicyRequestRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Campaign Stats
// ---------------------------------------------------------------------------

export interface CampaignStats {
  totalRequests: number;
  byStatus: Record<string, number>;
  sentToday: number;
  sentThisHour: number;
  responseRate: number;
}

// ---------------------------------------------------------------------------
// Send Campaign Input
// ---------------------------------------------------------------------------

export interface SendCampaignInput {
  /** Filter agencies to send to — if empty, sends to all with recordsEmail */
  county?: string;
  agencyType?: string;
  /** If true, only send to agencies that haven't been contacted yet */
  onlyNew?: boolean;
}

// ---------------------------------------------------------------------------
// Send Result
// ---------------------------------------------------------------------------

export interface SendResult {
  agencyId: string;
  agencyName: string;
  trackingId: string;
  success: boolean;
  error?: string;
  sesMessageId?: string;
}

// ---------------------------------------------------------------------------
// Campaign Batch Result
// ---------------------------------------------------------------------------

export interface CampaignBatchResult {
  totalTargeted: number;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
  results: SendResult[];
}

// ---------------------------------------------------------------------------
// Rate Limit Config
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  maxPerHour: number;
  maxPerBatch: number;
  delayBetweenMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxPerHour: 50,
  maxPerBatch: 25,
  delayBetweenMs: 2000, // 2 seconds between emails
};
