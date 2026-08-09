// ============================================================================
// New Inmate Intelligence System — domain types.
//
// The centre of this file is MatchEvidence. Every identity decision carries one,
// because a wrong merge conflates two people's arrest histories and "the system
// decided" is not an acceptable account of how that happened. An administrator
// reviewing a merge must be able to see the score, the reasons behind it, the
// documents it came from, and what disagreed — without reading the code.
// ============================================================================

// ---------------------------------------------------------------------------
// Parsed and normalized records
// ---------------------------------------------------------------------------

/** A row exactly as a parser found it. Keys are the source's own headers. */
export type RawRecord = Record<string, string>;

/** A row after normalization. Every parser converges on this before matching. */
export interface NormalizedRecord {
  first: string;
  last: string;
  middle?: string;
  suffix?: string;
  /** ISO date, or undefined when absent or unparseable. */
  dateOfBirth?: string;
  sex?: Sex;
  race?: string;
  facility: string;
  externalBookingId?: string;
  /** The facility's own identifier for the PERSON — an SO or inmate number.
   *  Distinct from externalBookingId, which identifies the booking. The strongest
   *  identity evidence available when a roster supplies it. */
  externalPersonId?: string;
  /** ISO datetime. Required: a booking without a date is not a booking. */
  bookedAt: string;
  releasedAt?: string;
  arrestingAgency?: string;
  bailAmountCents?: bigint;
  housingLocation?: string;
  charges: NormalizedCharge[];
}

export interface NormalizedCharge {
  statuteCode?: string;
  statuteSection?: string;
  description?: string;
  severity: ChargeSeverity;
  counts: number;
  bailAmountCents?: bigint;
  rawText: string;
}

export type Sex = 'M' | 'F' | 'X' | 'unknown';
export type ChargeSeverity = 'felony' | 'misdemeanor' | 'infraction' | 'unknown';

// ---------------------------------------------------------------------------
// The Evidence Confidence Model
// ---------------------------------------------------------------------------

/**
 * How an identity decision was reached.
 *
 * `humanReviewRequired` is deliberately not derived from `confidence` alone. A
 * near-DOB match can score respectably and still need a person to look at it,
 * because a transposed birth year and two different people with a common name
 * produce the same shape of evidence. The tier decides; the score describes.
 */
export interface MatchEvidence {
  /** 0–100. Descriptive, not the gate. */
  confidence: number;
  tier: MatchTier;
  /** Every signal that contributed, in the order it was evaluated. */
  reasons: MatchReason[];
  /** Anything that disagreed with the conclusion. Empty is meaningful. */
  conflicts: MatchConflict[];
  /** The documents this decision rests on. */
  sourceDocuments: SourceDocument[];
  /** Ingestion record ids, so the raw rows can be re-read. */
  sourceRecordIds: string[];
  /** Other inmates that were considered and why they lost. */
  rejectedCandidates: RejectedCandidate[];
  humanReviewRequired: boolean;
  /** Why review is or is not required, in a sentence an administrator reads. */
  reviewRationale: string;
  decidedAt: string;
  /** Version of the resolution rules, so old decisions stay interpretable
   *  after the tiers change. */
  resolverVersion: string;
  /** Version of the merge policy that produced the action. Separate from the
   *  resolver, because scoring and deciding change independently. */
  mergePolicyVersion?: string;
  /** The named policy rule that fired, so a decision traces to one line of
   *  mergePolicy.ts rather than to a score. */
  policyRule?: string;
  /** Which blocking keys found the chosen candidate — for auditing recall. */
  foundBy?: string[];
  /** True when a blocking key hit its cap, so the candidate set may be
   *  incomplete and a missed match is possible. */
  candidateSetTruncated?: boolean;
}

/**
 * Ordered strongest to weakest. The tier is what determines whether a decision
 * is applied automatically, so the order is load-bearing rather than cosmetic.
 */
export type MatchTier =
  /** Same facility and the facility's own booking id. The same booking. */
  | 'exact_booking'
  /** The facility's own PERSON identifier matched. Stronger than name and date
   *  of birth together, because the jail assigns it and it is stable. */
  | 'external_person_id'
  /** Normalized last, first and date of birth all match. */
  | 'exact_identity'
  /** Date of birth and last name match; first name within edit distance. */
  | 'near_name'
  /** Names match; date of birth differs in a way typing explains. Never auto-merged. */
  | 'near_dob'
  /** Nothing matched. A new person. */
  | 'none';

export interface MatchReason {
  /** Stable identifier, e.g. `dob_exact`, `last_name_exact`. */
  code: string;
  /** What it means, for a reader rather than a log parser. */
  detail: string;
  /** Contribution to the score. Negative signals are conflicts, not reasons. */
  weight: number;
}

export interface MatchConflict {
  code: string;
  detail: string;
  /** The value on the existing record and the one in the incoming row. */
  existing?: string;
  incoming?: string;
  /** Whether this alone should stop an automatic decision. */
  blocking: boolean;
}

export interface SourceDocument {
  batchId: string;
  filename: string;
  sha256: string;
  sourceType: string;
  rosterDate?: string;
  lineNumber?: number;
}

export interface RejectedCandidate {
  inmateId: string;
  name: string;
  confidence: number;
  /** Why this candidate was not chosen. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Resolution results
// ---------------------------------------------------------------------------

export type ResolutionOutcome =
  | 'new_inmate'
  | 'matched'
  | 'duplicate'
  | 'needs_review'
  | 'failed';

export interface ResolutionResult {
  outcome: ResolutionOutcome;
  /** Set for matched, duplicate, and needs_review (the candidate). */
  inmateId?: string;
  evidence: MatchEvidence;
}

/** A candidate row loaded from the repository for comparison. */
export interface InmateCandidate {
  inmateId: string;
  canonicalFirst: string;
  canonicalLast: string;
  canonicalMiddle?: string | null;
  suffix?: string | null;
  dateOfBirth?: Date | null;
  sex?: string | null;
  race?: string | null;
  bookingCount: number;
}

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

/** How a run was started. The engine behaves identically for all of them; this
 *  exists so the origin is recorded, not so the engine can branch on it. */
export type IngestionTrigger = 'manual' | 'cli' | 'timer' | 'queue';

export interface IngestionRequest {
  filePath: string;
  facility: string;
  trigger: IngestionTrigger;
  /** full_population | incremental. Departures can only be inferred from a
   *  source that lists everyone in custody. */
  rosterKind?: 'full_population' | 'incremental';
  /** Parse, normalize and resolve, then report without writing. */
  dryRun: boolean;
  rosterDate?: string;
  /** The administrator responsible, when there is one. */
  userId?: string;
  /**
   * Progress reporting, for a caller that is showing a live status.
   *
   * Optional and fire-and-forget: an import must not fail because whoever was
   * watching it stopped watching. The stages are the ones an operator recognises
   * from the dashboard rather than the internal steps.
   */
  onStage?: (stage: IngestionStage, detail?: { processed?: number; total?: number }) => void;
}

/** The stages an operator sees while an import runs. */
export type IngestionStage =
  | 'parsing'
  | 'normalizing'
  | 'matching'
  | 'saving'
  | 'concluding'
  | 'complete';

export interface IngestionOutcome {
  batchId: string | null;
  dryRun: boolean;
  status: 'completed' | 'failed';
  sourceType: string;
  sourceSha256: string;
  counts: IngestionCounts;
  issues: IngestionIssue[];
  /** Present on a dry run: what would have been written. */
  preview?: ResolutionPreview[];
  extractionStats?: ExtractionStats;
  failureReason?: string;
  durationMs: number;
}

export interface IngestionCounts {
  total: number;
  newInmates: number;
  matched: number;
  duplicates: number;
  needsReview: number;
  failed: number;
  /** Cross-source disagreements recorded by this run. */
  conflicts?: number;
  /** Bookings a full-population roster stopped listing. */
  departures?: number;
  watchListHits?: number;
}

export interface IngestionIssue {
  lineNumber?: number;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

export interface ResolutionPreview {
  lineNumber: number;
  name: string;
  dateOfBirth?: string;
  outcome: ResolutionOutcome;
  confidence: number;
  tier: MatchTier;
  humanReviewRequired: boolean;
  reviewRationale: string;
}

/** Recorded per batch. An OCR page that yields nothing is indistinguishable
 *  from a genuinely blank page unless the counts are kept. */
export interface ExtractionStats {
  pageCount?: number;
  charactersPerPage?: number[];
  emptyPages?: number[];
  ocrUsed: boolean;
  /** Rows the parser produced but could not turn into a booking. */
  unparseableLines: number;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Per-facility description of a roster's shape. Jail exports differ per
 * facility and change without notice, so the parser is driven by one of these
 * rather than by hardcoded column positions: an unrecognised header set fails
 * the batch naming the unmapped columns, instead of importing nulls.
 */
export interface ColumnMap {
  facility: string;
  label: string;
  /** Canonical field → the source headers that mean it, case-insensitive. */
  fields: Partial<Record<CanonicalField, string[]>>;
  /** Date formats to try, in order. `iso` means Date.parse is acceptable. */
  dateFormats: DateFormat[];
  /** How names appear when they arrive in one column. */
  nameOrder: 'last_first' | 'first_last';
  /** Separator between multiple charges in a single cell. */
  chargeSeparator?: string;
}

export type CanonicalField =
  | 'fullName' | 'first' | 'last' | 'middle' | 'suffix'
  | 'dateOfBirth' | 'sex' | 'race'
  | 'externalBookingId' | 'externalPersonId' | 'bookedAt' | 'releasedAt'
  | 'arrestingAgency' | 'bailAmount' | 'housingLocation'
  | 'charges';

export type DateFormat = 'iso' | 'mm/dd/yyyy' | 'dd/mm/yyyy' | 'yyyy-mm-dd' | 'mm-dd-yyyy';

export interface ParseResult {
  records: RawRecord[];
  stats: ExtractionStats;
  issues: IngestionIssue[];
}
