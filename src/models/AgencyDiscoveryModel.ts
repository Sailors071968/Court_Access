// ============================================
// Court Access — Agency Discovery Model (Phase O6)
// Controlled Agency Acquisition Crawler
//
// Defines types for the discovery + validation + manual
// activation pipeline for California law enforcement
// and public agencies.
//
// This is discovery infrastructure, not outreach automation:
//   - Discovers agencies from public sources
//   - Validates structural format (not deliverability)
//   - Queues candidates for manual review
//   - Requires human approval before activation
//   - Logs acquisition events immutably
//   - Does NOT auto-activate agencies
//   - Does NOT auto-send
//   - Does NOT bypass O1-O5 protections
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of historical entries
//   - No deletion (rejected stays archived)
//   - Append-only discipline
//   - Deterministic processing
//   - Two-pass hash derivation
// ============================================

// ---------------------------------------------------------------------------
// Validation Status
// ---------------------------------------------------------------------------

/**
 * Structural validation status for a discovered agency candidate.
 *
 * UNVALIDATED — not yet checked
 * VALID       — passes structural validation rules
 * INVALID     — fails one or more structural validation rules
 */
export type ValidationStatus = 'UNVALIDATED' | 'VALID' | 'INVALID';

// ---------------------------------------------------------------------------
// Review Status
// ---------------------------------------------------------------------------

/**
 * Manual review status for a discovered agency candidate.
 *
 * PENDING  — awaiting human review
 * APPROVED — human approved for activation
 * REJECTED — human rejected (archived, never deleted)
 */
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// ---------------------------------------------------------------------------
// Discovered Agency Candidate
// ---------------------------------------------------------------------------

/**
 * A discovered agency candidate from public sources.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical (excludes candidateId, sha256, sha3_256) → candidateId
 *   Pass 2: full canonical (includes candidateId, excludes sha256, sha3_256) → dual-hash
 *
 * All candidates start as PENDING review.
 * Never auto-approved. Never auto-activated.
 * Rejected candidates stay archived — never deleted.
 */
export interface DiscoveredAgencyCandidate {
  candidateId: string;                       // SHA-256 of canonical pre-ID form (64 hex chars)
  sourceUrl: string;                         // URL where agency was discovered
  agencyName: string;                        // Official agency name
  departmentType: string;                    // Police, Sheriff, DA, etc.
  emailAddress: string | null;               // Discovered email (structural validation only)
  mailingAddress: string | null;             // Discovered mailing address
  phoneNumber: string | null;                // Discovered phone number
  county: string | null;                     // California county
  discoveryTimestamp: string;                // ISO 8601, caller-provided
  validationStatus: ValidationStatus;
  reviewStatus: ReviewStatus;
  sha256: string;                            // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                          // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Discovered Agency Candidate Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new discovered agency candidate.
 *
 * The caller provides all fields except:
 *   - candidateId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 */
export interface DiscoveredAgencyCandidateInput {
  sourceUrl: string;
  agencyName: string;
  departmentType: string;
  emailAddress: string | null;
  mailingAddress: string | null;
  phoneNumber: string | null;
  county: string | null;
  discoveryTimestamp: string;
  validationStatus: ValidationStatus;
  reviewStatus: ReviewStatus;
}

// ---------------------------------------------------------------------------
// Agency Activation Record
// ---------------------------------------------------------------------------

/**
 * Immutable record of agency activation after manual approval.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical → activationId
 *   Pass 2: full canonical → dual-hash
 *
 * Created only when human approves a candidate.
 * Never auto-created. Never deleted.
 */
export interface AgencyActivationRecord {
  activationId: string;                      // SHA-256 of canonical pre-ID form
  candidateId: string;                       // Reference to DiscoveredAgencyCandidate
  approvedByUserId: string;                  // Human who approved
  activationTimestamp: string;               // ISO 8601, caller-provided
  sha256: string;                            // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                          // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Agency Activation Record Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new agency activation record.
 */
export interface AgencyActivationRecordInput {
  candidateId: string;
  approvedByUserId: string;
  activationTimestamp: string;
}

// ---------------------------------------------------------------------------
// Raw Agency Data
// ---------------------------------------------------------------------------

/**
 * Raw data extracted from a public source before processing.
 * Intermediate representation — not persisted directly.
 */
export interface RawAgencyData {
  agencyName: string;
  departmentType: string;
  emailAddress: string | null;
  mailingAddress: string | null;
  phoneNumber: string | null;
  county: string | null;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Review Queue Entry
// ---------------------------------------------------------------------------

/**
 * Entry in the manual review queue.
 * Wraps a candidate with queue metadata.
 */
export interface ReviewQueueEntry {
  candidateId: string;
  agencyName: string;
  departmentType: string;
  emailAddress: string | null;
  county: string | null;
  validationStatus: ValidationStatus;
  reviewStatus: ReviewStatus;
  discoveryTimestamp: string;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Acquisition Event Entity — immutable ledger record
// ---------------------------------------------------------------------------

/**
 * Immutable record of a discovery acquisition event.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical → acquisitionEventId
 *   Pass 2: full canonical → dual-hash
 *
 * Logs discovery events — not activation events.
 * Append-only — no update, no delete.
 */
export interface AcquisitionEventEntity {
  acquisitionEventId: string;                // SHA-256 of canonical pre-ID form
  candidateId: string;
  sourceUrl: string;
  discoveryTimestamp: string;
  sha256: string;                            // Dual-hash: SHA-256
  sha3_256: string;                          // Dual-hash: SHA3-256
}

// ---------------------------------------------------------------------------
// Acquisition Event Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new acquisition event entity.
 */
export interface AcquisitionEventInput {
  candidateId: string;
  sourceUrl: string;
  discoveryTimestamp: string;
}

// ---------------------------------------------------------------------------
// Crawler Rate Limit Configuration
// ---------------------------------------------------------------------------

/**
 * Rate limiting configuration for the crawler.
 * All values positive integers.
 */
export interface CrawlerRateLimitConfig {
  maxRequestsPerMinute: number;              // Maximum requests per minute (global)
  maxRequestsPerDomain: number;              // Maximum requests per domain per run
  delayBetweenRequestsMs: number;            // Delay between sequential requests (ms)
}

// ---------------------------------------------------------------------------
// Default Rate Limit Configuration
// ---------------------------------------------------------------------------

/**
 * Conservative default rate limits.
 */
export const DEFAULT_CRAWLER_RATE_LIMITS: CrawlerRateLimitConfig = {
  maxRequestsPerMinute: 10,
  maxRequestsPerDomain: 5,
  delayBetweenRequestsMs: 6000,              // 1 request per 6 seconds
};

// ---------------------------------------------------------------------------
// California Counties — reference list for validation
// ---------------------------------------------------------------------------

/**
 * Complete list of California counties for structural validation.
 * ASCII-sorted. Used for exact match validation only.
 */
export const CALIFORNIA_COUNTIES: readonly string[] = [
  'Alameda',
  'Alpine',
  'Amador',
  'Butte',
  'Calaveras',
  'Colusa',
  'Contra Costa',
  'Del Norte',
  'El Dorado',
  'Fresno',
  'Glenn',
  'Humboldt',
  'Imperial',
  'Inyo',
  'Kern',
  'Kings',
  'Lake',
  'Lassen',
  'Los Angeles',
  'Madera',
  'Marin',
  'Mariposa',
  'Mendocino',
  'Merced',
  'Modoc',
  'Mono',
  'Monterey',
  'Napa',
  'Nevada',
  'Orange',
  'Placer',
  'Plumas',
  'Riverside',
  'Sacramento',
  'San Benito',
  'San Bernardino',
  'San Diego',
  'San Francisco',
  'San Joaquin',
  'San Luis Obispo',
  'San Mateo',
  'Santa Barbara',
  'Santa Clara',
  'Santa Cruz',
  'Shasta',
  'Sierra',
  'Siskiyou',
  'Solano',
  'Sonoma',
  'Stanislaus',
  'Sutter',
  'Tehama',
  'Trinity',
  'Tulare',
  'Tuolumne',
  'Ventura',
  'Yolo',
  'Yuba',
];
