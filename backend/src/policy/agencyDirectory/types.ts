// ============================================
// Court Access — Agency Directory Types
// Canonical type definitions for the policy acquisition system.
// ============================================

// ---------------------------------------------------------------------------
// Agency Types
// ---------------------------------------------------------------------------

export type AgencyType =
  | 'Police'
  | 'Sheriff'
  | 'State'
  | 'TaskForce'
  | 'Probation'
  | 'Corrections'
  | 'District_Attorney'
  | 'University'
  | 'Transit';

// ---------------------------------------------------------------------------
// Agency Record
// ---------------------------------------------------------------------------

export interface AgencyRecord {
  id: string;
  agencyName: string;
  agencyType: AgencyType;
  county: string;
  city: string | null;
  recordsEmail: string | null;
  recordsRequestUrl: string | null;
  phoneNumber: string | null;
  website: string | null;
  policyUrl: string | null;
  lastRequestSent: Date | null;
  lastResponse: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Create / Update Inputs
// ---------------------------------------------------------------------------

export interface CreateAgencyInput {
  agencyName: string;
  agencyType: AgencyType;
  county: string;
  city?: string;
  recordsEmail?: string;
  recordsRequestUrl?: string;
  phoneNumber?: string;
  website?: string;
  policyUrl?: string;
  notes?: string;
}

export interface UpdateAgencyInput {
  agencyName?: string;
  agencyType?: AgencyType;
  county?: string;
  city?: string | null;
  recordsEmail?: string | null;
  recordsRequestUrl?: string | null;
  phoneNumber?: string | null;
  website?: string | null;
  policyUrl?: string | null;
  lastRequestSent?: Date | null;
  lastResponse?: Date | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Query Filters
// ---------------------------------------------------------------------------

export interface AgencyFilter {
  county?: string;
  agencyType?: AgencyType;
  search?: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Paginated Result
// ---------------------------------------------------------------------------

export interface PaginatedAgencyResult {
  agencies: AgencyRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Agency Stats
// ---------------------------------------------------------------------------

export interface AgencyStats {
  total: number;
  byType: Record<string, number>;
  byCounty: Array<{ county: string; count: number }>;
  withEmail: number;
  withWebsite: number;
  withPolicyUrl: number;
}

// ---------------------------------------------------------------------------
// Seed Agency (pre-database shape)
// ---------------------------------------------------------------------------

export interface SeedAgency {
  agencyName: string;
  agencyType: AgencyType;
  county: string;
  city?: string;
  recordsEmail?: string;
  recordsRequestUrl?: string;
  phoneNumber?: string;
  website?: string;
  policyUrl?: string;
}
