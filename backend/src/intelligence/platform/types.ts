// ============================================================================
// The intelligence platform — contracts.
//
// NIIS is an evidence-governed platform, and identity resolution is one engine
// running on it. The chain is one-directional:
//
//   Source document → Source record → Observation → Evidence → Intelligence
//                                                                   ↓
//                                                    Person / Booking / Charge
//
// Observations state what a source said and never conclude. Engines conclude and
// never invent observations. Reports read intelligence and never create facts.
//
// The contract below is what makes a new engine additive: an engine declares a
// name and version, consumes an evidence context, and returns findings. It does
// not write to the repository, does not merge anything, and does not decide
// whether its own conclusions are applied. Recording, disposition, review and
// supersession belong to the platform.
// ============================================================================

/** Open vocabulary. A new engine introduces a new value, not a migration. */
export type IntelligenceType =
  | 'identity_candidate'
  | 'source_conflict'
  | 'change'
  | 'watch_list_hit'
  | 'repeat_offender'
  | 'facility_movement'
  | 'booking_pattern'
  | 'bail_anomaly'
  | 'court_anomaly'
  | 'release_pattern'
  | (string & {});

/** How much attention a finding warrants. Not the same as confidence: a certain
 *  finding can be uninteresting, and an uncertain one can be urgent. */
export type Severity = 'info' | 'notable' | 'significant' | 'critical';

/**
 * What has happened to a finding.
 *
 * `proposed` means the repository was not changed. `auto_applied` means it was,
 * under the engine's own rules, and the item records that it happened rather than
 * implying it. The distinction is the whole point of the disposition field: it is
 * how a reviewer knows whether they are approving something or auditing it.
 */
export type Disposition =
  | 'proposed'
  | 'auto_applied'
  | 'accepted'
  | 'rejected'
  | 'deferred'
  | 'superseded'
  | 'expired';

/** What a finding is about. Polymorphic because engines reason about different
 *  things — a person, a booking, a roster, a pair of observations. */
export type SubjectKind =
  | 'person'
  | 'booking'
  | 'observation'
  | 'import_record'
  | 'batch'
  | 'roster'
  | 'watch_list_entry';

/**
 * The version bundle carried by every finding.
 *
 * Enough to answer "what would this conclusion be under today's rules" without
 * guessing. Each component is recorded separately because they change
 * independently: a parser fix and a scoring change are different reprocessing
 * scopes.
 */
export interface AlgorithmVersions {
  engineVersion: string;
  ruleVersion?: string;
  confidenceVersion?: string;
  parserProfileId?: string;
  parserVersion?: string;
  normalizationVersion?: string;
  nameKeyVersion?: string;
}

/**
 * One conclusion, as an engine returns it.
 *
 * An engine returns findings; it does not persist them. Keeping persistence out
 * of the engine is what allows the same engine to run live, in a reprocessing
 * run, or in a dry run, with no branch inside it.
 */
export interface IntelligenceFinding {
  type: IntelligenceType;
  severity: Severity;
  subjectKind: SubjectKind;
  subjectId?: string;
  relatedKind?: SubjectKind;
  relatedId?: string;

  confidence: number;
  /** The named rule that produced it. A finding must trace to a rule, not a score. */
  rule?: string;
  /** Plain language, for a reviewer. Never a code. */
  explanation: string;

  /** Whether the engine's rules require a person before anything is applied. */
  reviewRequired: boolean;
  /** What the engine did, not what it would like to happen. */
  disposition: Extract<Disposition, 'proposed' | 'auto_applied'>;

  /** Observation ids this rests on, so evidence can be re-read. */
  evidenceObservationIds: string[];
  /** Anything else consumed — import records, documents, prior findings. */
  inputs?: Record<string, unknown>;
  /** The finding itself, when there is no typed detail table. */
  payload?: Record<string, unknown>;
  /** The typed row carrying the detail, when one exists. */
  detail?: { table: string; id: string };
}

/**
 * What an engine is given.
 *
 * Deliberately observations and ids rather than resolved entities. An engine that
 * consumes already-merged people cannot explain a merge, because the merge
 * happened before it looked — which is the reason identity resolution now
 * consumes an observation set and returns a recommendation.
 */
export interface EvidenceContext {
  /** The run this execution belongs to. Absent for live ingestion. */
  runId?: string;
  batchId?: string;
  /** Versions in force, so an engine stamps rather than invents them. */
  versions: Omit<AlgorithmVersions, 'engineVersion'>;
  /** Observation ids in scope. An engine may load what it needs from them. */
  observationIds?: string[];
  /** Whether the platform will persist the findings. A dry run still produces
   *  identical findings — the engine does not know the difference. */
  dryRun: boolean;
}

/**
 * An intelligence engine.
 *
 * The whole contract. A new engine implements this, registers itself, and needs
 * no schema change: `IntelligenceType` is an open string and the finding carries
 * a free-form payload.
 */
export interface IntelligenceEngine {
  /** Stable identifier, used in queries and in the audit trail. */
  readonly name: string;
  /** Bumped when the engine's conclusions could change. Recorded on every item. */
  readonly version: string;
  /** What it concludes about, for documentation and for the engine registry. */
  readonly produces: IntelligenceType[];
  /** One-line statement of what the engine is for. */
  readonly description: string;

  /**
   * Draw conclusions from evidence.
   *
   * Must be a pure function of the context and the repository state it reads. It
   * must not write, must not merge, and must not branch on `dryRun` — the
   * platform decides what happens to a finding.
   */
  analyse(context: EvidenceContext): Promise<IntelligenceFinding[]>;
}

/** What a reviewer sees. Assembled by the platform, never reconstructed by hand. */
export interface ReviewPacket {
  itemId: string;
  type: IntelligenceType;
  severity: Severity;
  confidence: number;
  rule?: string;
  explanation: string;
  disposition: Disposition;
  engine: string;
  engineVersion: string;
  versions: AlgorithmVersions;
  /** The observations behind it, resolved to what each source actually said. */
  evidence: {
    observationId: string;
    sourceType: string;
    rosterDate?: string;
    sourcePage?: number | null;
    sourceRow?: number | null;
    document?: { filename: string; sha256: string };
    stated: Record<string, unknown>;
  }[];
  /** Conflicting statements, already identified rather than left to be spotted. */
  conflicts?: Record<string, unknown>[];
  /** What the engine recommends, and what it did not do. */
  recommendation: string;
  /** The item's own history. */
  history: { action: string; actorId?: string | null; note?: string | null; at: string }[];
  createdAt: string;
}
