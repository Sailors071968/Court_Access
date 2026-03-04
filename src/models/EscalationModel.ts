// ============================================
// Court Access — Escalation Model (Phase O3)
// Escalation Automation Runner
//
// Defines escalation evaluation, decision, and template
// types for deterministic follow-up automation.
//
// An escalation decision determines whether an agency
// is due for a follow-up communication based on:
//   - Communication chain history
//   - Response chain history
//   - Elapsed time since last communication
//   - Recipient reputation status
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Type-only imports from sibling models
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of historical entries
//   - No deletion
//   - No update of CommunicationLedger hashes
//   - Append-only discipline
//   - Binary PASS/FAIL only
//   - Deterministic processing
//   - No AI-generated dynamic text
// ============================================

// ---------------------------------------------------------------------------
// Imports — type-only from sibling models
// ---------------------------------------------------------------------------

import type { CommunicationEntity, CommunicationType, ResponseEntity } from './CommunicationModel';
import type { RecipientReputationStatus } from './BounceModel';

// ---------------------------------------------------------------------------
// Escalation Action — what the runner should do
// ---------------------------------------------------------------------------

/**
 * Escalation action determined by the automation engine.
 *
 * NONE              — No escalation needed (not due, or already responded)
 * CREATE_FOLLOW_UP_1 — Create first follow-up communication
 * CREATE_FOLLOW_UP_2 — Create second follow-up communication
 * CREATE_ANNUAL_UPDATE — Create annual re-request communication
 */
export type EscalationAction =
  | 'NONE'
  | 'CREATE_FOLLOW_UP_1'
  | 'CREATE_FOLLOW_UP_2'
  | 'CREATE_ANNUAL_UPDATE';

// ---------------------------------------------------------------------------
// Escalation Decision Reason
// ---------------------------------------------------------------------------

/**
 * Reason for escalation decision.
 *
 * NOT_DUE    — Timer has not elapsed
 * DUE        — Timer has elapsed, escalation required
 * RESPONDED  — Agency responded, no escalation needed
 * BLOCKED    — Recipient is HARD_BOUNCED or COMPLAINT
 */
export type EscalationDecisionReason =
  | 'NOT_DUE'
  | 'DUE'
  | 'RESPONDED'
  | 'BLOCKED';

// ---------------------------------------------------------------------------
// Escalation Evaluation Input
// ---------------------------------------------------------------------------

/**
 * Input for evaluating escalation for a single agency.
 *
 * The caller provides:
 *   - tenantId and agencyId (scope)
 *   - currentTimestamp (ISO 8601, caller-provided)
 *   - communicationChain (sorted by sequenceNumber ASC)
 *   - responseChain (all responses for this agency)
 *   - recipientReputationStatus (from bounce handler)
 */
export interface EscalationEvaluationInput {
  tenantId: string;
  agencyId: string;
  currentTimestamp: string;              // ISO 8601, caller-provided
  communicationChain: CommunicationEntity[];
  responseChain: ResponseEntity[];
  recipientReputationStatus: RecipientReputationStatus;
}

// ---------------------------------------------------------------------------
// Escalation Decision
// ---------------------------------------------------------------------------

/**
 * Result of evaluating escalation for a single agency.
 *
 * Deterministic — same inputs always produce same output.
 * No AI inference. No probability.
 */
export interface EscalationDecision {
  agencyId: string;
  lastCommunicationType: CommunicationType | null;
  lastSentTimestamp: string;             // ISO 8601 (empty string if no communications)
  elapsedDays: number;
  action: EscalationAction;
  reason: EscalationDecisionReason;
}

// ---------------------------------------------------------------------------
// Template Version — deterministic template for rendering
// ---------------------------------------------------------------------------

/**
 * A versioned communication template.
 *
 * Templates are:
 *   - Deterministic (same variables → same output)
 *   - Versioned (immutable once created)
 *   - Typed by communication type
 *   - No AI-generated content
 *   - No dynamic rewriting
 *
 * Placeholders use {{VARIABLE_NAME}} syntax.
 * All variables must be explicitly passed.
 */
export interface TemplateVersion {
  templateId: string;
  version: number;                       // Integer, monotonically increasing
  communicationType: CommunicationType;
  subject: string;                       // May contain {{PLACEHOLDER}} tokens
  body: string;                          // May contain {{PLACEHOLDER}} tokens
}

// ---------------------------------------------------------------------------
// Template Render Result
// ---------------------------------------------------------------------------

/**
 * Result of rendering a template with variables.
 * Contains the fully resolved subject and body.
 */
export interface TemplateRenderResult {
  subject: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Template Render Validation
// ---------------------------------------------------------------------------

/**
 * Result of validating template rendering.
 *
 * PASS: all placeholders resolved, no unknown variables.
 * FAIL: missing placeholders or unknown variables provided.
 */
export interface TemplateRenderValidation {
  result: 'PASS' | 'FAIL';
  missingPlaceholders: string[];         // Placeholders in template not provided in variables
  unknownVariables: string[];            // Variables provided but not in template
}

// ---------------------------------------------------------------------------
// Escalation Queue Result — result of queueing an escalation
// ---------------------------------------------------------------------------

/**
 * Result of building and queueing an escalation communication.
 * Contains the built communication entity and queue entry reference.
 */
export interface EscalationQueueResult {
  agencyId: string;
  communicationType: CommunicationType;
  communicationId: string;               // ID of the new CommunicationEntity
  queueId: string;                       // ID of the SendQueueEntry
  scheduledTimestamp: string;            // ISO 8601
}
