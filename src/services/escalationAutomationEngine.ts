// ============================================
// Court Access — Escalation Automation Engine (Phase O3)
// Deterministic Follow-Up Engine
//
// Evaluates communication chains per agency and determines
// whether escalation is due. Connects Phases 16 + O1 + O2
// into a functioning automation system.
//
// This engine:
//   - Evaluates escalation timing deterministically
//   - Selects the next communication type
//   - Builds a new CommunicationEntity (Phase 16 compliant)
//   - Queues it via Phase O1 scheduler
//   - Never bypasses warm-up gates
//   - Never sends directly
//   - Never improvises content
//   - Never mutates existing ledger entries
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Binary PASS/FAIL where applicable
//
// Architectural boundary:
//   - Does NOT import anchorEngine
//   - Does NOT import signatureEngine
//   - Does NOT import sesDispatchService
//   - Does NOT make SES calls
//   - Only imports:
//     - communicationLedgerEngine (buildCommunicationEntry, evaluateEscalation)
//     - sesWarmupSchedulerEngine (buildSendQueueEntry)
//     - policyIngestionService (computeTextSHA256 for messageHash)
//     - Model types
//   - No circular dependencies
//   - No store access (callers provide all data)
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of input entities
//   - No deletion
//   - No update of CommunicationLedger hashes
//   - Binary PASS/FAIL only
//   - Deterministic processing
//   - No AI-generated dynamic text
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256 } from './policyIngestionService';
import { buildCommunicationEntry, evaluateEscalation } from './communicationLedgerEngine';
import { buildSendQueueEntry } from './sesWarmupSchedulerEngine';

import type {
  CommunicationEntity,
  CommunicationInput,
  CommunicationType,
  ResponseEntity,
  EscalationThresholds,
} from '../models/CommunicationModel';

import { DEFAULT_ESCALATION_THRESHOLDS } from '../models/CommunicationModel';

import type {
  EscalationEvaluationInput,
  EscalationDecision,
  EscalationAction,
  EscalationDecisionReason,
  EscalationQueueResult,
  TemplateRenderResult,
} from '../models/EscalationModel';

import type { RecipientReputationStatus } from '../models/BounceModel';

import type { SendQueueEntry, SendQueueEntryInput } from '../models/SendQueueModel';

// ---------------------------------------------------------------------------
// MS per day constant
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86400000;

// ---------------------------------------------------------------------------
// Compute Elapsed Days — deterministic
// ---------------------------------------------------------------------------

/**
 * Compute integer elapsed days between two ISO 8601 timestamps.
 * Uses Date.parse (constitutional: no Date.now, no new Date).
 * Returns 0 if timestamps are invalid or current < sent.
 */
function computeElapsedDays(sentTimestamp: string, currentTimestamp: string): number {
  const sentMs = Date.parse(sentTimestamp);
  const currentMs = Date.parse(currentTimestamp);
  if (Number.isNaN(sentMs) || Number.isNaN(currentMs)) return 0;
  const elapsedMs = currentMs - sentMs;
  if (elapsedMs < 0) return 0;
  return Math.floor(elapsedMs / MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Map Escalation Status to Action
// ---------------------------------------------------------------------------

/**
 * Map Phase 16 evaluateEscalation() nextAction to EscalationAction.
 *
 * Mapping:
 *   FOLLOW_UP_1    → CREATE_FOLLOW_UP_1
 *   FOLLOW_UP_2    → CREATE_FOLLOW_UP_2
 *   ANNUAL_UPDATE  → CREATE_ANNUAL_UPDATE
 *   null / other   → NONE
 *
 * Deterministic — same input always produces same output.
 */
function mapNextActionToEscalationAction(
  nextAction: CommunicationType | null
): EscalationAction {
  if (nextAction === 'FOLLOW_UP_1') return 'CREATE_FOLLOW_UP_1';
  if (nextAction === 'FOLLOW_UP_2') return 'CREATE_FOLLOW_UP_2';
  if (nextAction === 'ANNUAL_UPDATE') return 'CREATE_ANNUAL_UPDATE';
  return 'NONE';
}

// ---------------------------------------------------------------------------
// Map EscalationAction to CommunicationType
// ---------------------------------------------------------------------------

/**
 * Map EscalationAction back to CommunicationType for building the entity.
 *
 * Only callable for non-NONE actions.
 * Returns null for NONE.
 */
function mapActionToCommunicationType(
  action: EscalationAction
): CommunicationType | null {
  if (action === 'CREATE_FOLLOW_UP_1') return 'FOLLOW_UP_1';
  if (action === 'CREATE_FOLLOW_UP_2') return 'FOLLOW_UP_2';
  if (action === 'CREATE_ANNUAL_UPDATE') return 'ANNUAL_UPDATE';
  return null;
}

// ---------------------------------------------------------------------------
// Check if Response Exists After Last Communication
// ---------------------------------------------------------------------------

/**
 * Check if any response exists that was received after the last communication.
 *
 * Uses Date.parse for ISO 8601 comparison.
 * Returns true if any response.receivedTimestamp >= lastCommunication.sentTimestamp.
 *
 * Deterministic — same inputs always produce same result.
 */
function hasResponseAfterLastCommunication(
  lastCommunication: CommunicationEntity,
  responseChain: ResponseEntity[]
): boolean {
  const lastSentMs = Date.parse(lastCommunication.sentTimestamp);
  if (Number.isNaN(lastSentMs)) return false;

  for (let i = 0; i < responseChain.length; i++) {
    const receivedMs = Date.parse(responseChain[i].receivedTimestamp);
    if (!Number.isNaN(receivedMs) && receivedMs >= lastSentMs) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Evaluate Agency Escalation
// ---------------------------------------------------------------------------

/**
 * Evaluate escalation for a single agency.
 *
 * Logic:
 *   1. If no communications exist → NONE (nothing to escalate from)
 *   2. If recipient is HARD_BOUNCED or COMPLAINT → NONE, reason BLOCKED
 *   3. Get last communication by highest sequenceNumber
 *   4. Check if any response exists after that communication
 *   5. If response exists → NONE, reason RESPONDED
 *   6. If not → call evaluateEscalation() from Phase 16
 *   7. Map result to EscalationAction
 *
 * No content generation here.
 * No direct SES calls.
 * Deterministic — same inputs always produce same output.
 */
export function evaluateAgencyEscalation(
  input: EscalationEvaluationInput,
  thresholds: EscalationThresholds = DEFAULT_ESCALATION_THRESHOLDS
): EscalationDecision {
  // No communications → nothing to escalate
  if (input.communicationChain.length === 0) {
    return {
      agencyId: input.agencyId,
      lastCommunicationType: null,
      lastSentTimestamp: '',
      elapsedDays: 0,
      action: 'NONE',
      reason: 'NOT_DUE',
    };
  }

  // Check recipient reputation — block if HARD_BOUNCED or COMPLAINT
  if (
    input.recipientReputationStatus === 'HARD_BOUNCED' ||
    input.recipientReputationStatus === 'COMPLAINT'
  ) {
    const lastComm = input.communicationChain[input.communicationChain.length - 1];
    return {
      agencyId: input.agencyId,
      lastCommunicationType: lastComm.communicationType,
      lastSentTimestamp: lastComm.sentTimestamp,
      elapsedDays: computeElapsedDays(lastComm.sentTimestamp, input.currentTimestamp),
      action: 'NONE',
      reason: 'BLOCKED',
    };
  }

  // Get last communication (highest sequenceNumber = last in sorted array)
  const lastComm = input.communicationChain[input.communicationChain.length - 1];

  // Check if any response exists after the last communication
  const hasResponse = hasResponseAfterLastCommunication(lastComm, input.responseChain);

  // Use Phase 16 evaluateEscalation()
  const escalationResult = evaluateEscalation(
    input.agencyId,
    lastComm.communicationType,
    lastComm.sentTimestamp,
    input.currentTimestamp,
    hasResponse,
    thresholds
  );

  // Map to EscalationDecision
  if (escalationResult.status === 'RESPONDED') {
    return {
      agencyId: input.agencyId,
      lastCommunicationType: lastComm.communicationType,
      lastSentTimestamp: lastComm.sentTimestamp,
      elapsedDays: escalationResult.elapsedDays,
      action: 'NONE',
      reason: 'RESPONDED',
    };
  }

  if (escalationResult.status === 'DUE') {
    const action = mapNextActionToEscalationAction(escalationResult.nextAction);
    return {
      agencyId: input.agencyId,
      lastCommunicationType: lastComm.communicationType,
      lastSentTimestamp: lastComm.sentTimestamp,
      elapsedDays: escalationResult.elapsedDays,
      action,
      reason: 'DUE',
    };
  }

  // NOT_DUE or ESCALATED
  return {
    agencyId: input.agencyId,
    lastCommunicationType: lastComm.communicationType,
    lastSentTimestamp: lastComm.sentTimestamp,
    elapsedDays: escalationResult.elapsedDays,
    action: 'NONE',
    reason: 'NOT_DUE',
  };
}

// ---------------------------------------------------------------------------
// Build Escalation Communication
// ---------------------------------------------------------------------------

/**
 * Build a new CommunicationEntity for an escalation follow-up.
 *
 * Must:
 *   - Increment sequenceNumber deterministically
 *   - Set communicationType from escalation decision
 *   - Hash canonical body using computeTextSHA256
 *   - Use Phase 16 buildCommunicationEntry()
 *   - No mutation of previous entries
 *
 * Parameters:
 *   - decision: EscalationDecision (must have action !== NONE)
 *   - renderedContent: TemplateRenderResult (subject + body from templateRenderEngine)
 *   - tenantId, caseId, recipientAddress: entity fields
 *   - previousCommunicationHash: sha256 of the last entry in the per-agency chain
 *   - currentSequenceNumber: highest sequenceNumber in the agency chain
 *   - timestamp: ISO 8601, caller-provided (sentTimestamp)
 *
 * Async because buildCommunicationEntry uses crypto.subtle.digest.
 * Deterministic — same inputs always produce same output.
 */
export async function buildEscalationCommunication(
  decision: EscalationDecision,
  renderedContent: TemplateRenderResult,
  tenantId: string,
  caseId: string,
  recipientAddress: string,
  previousCommunicationHash: string,
  currentSequenceNumber: number,
  timestamp: string
): Promise<CommunicationEntity> {
  // Determine communication type from action
  const communicationType = mapActionToCommunicationType(decision.action);
  if (communicationType === null) {
    // This should not be called with NONE action
    // Return a deterministic error entity by using INITIAL_REQUEST as fallback
    // Caller must validate decision.action !== NONE before calling
    throw new Error('buildEscalationCommunication called with NONE action');
  }

  // Compute messageHash from rendered body
  const messageHash = await computeTextSHA256(renderedContent.body);

  // Build communication input
  const input: CommunicationInput = {
    sequenceNumber: currentSequenceNumber + 1,
    tenantId,
    agencyId: decision.agencyId,
    caseId,
    communicationType,
    sentTimestamp: timestamp,
    deliveryStatus: 'QUEUED',
    recipientAddress,
    subject: renderedContent.subject,
    messageHash,
    previousCommunicationHash,
    description: 'Automated escalation follow-up',
  };

  // Use Phase 16 buildCommunicationEntry
  return buildCommunicationEntry(input);
}

// ---------------------------------------------------------------------------
// Queue Escalation Communication
// ---------------------------------------------------------------------------

/**
 * Create a SendQueueEntry for an escalation communication.
 *
 * Uses Phase O1 buildSendQueueEntry().
 * Does NOT dispatch. Queue only.
 * Scheduler controls dispatch timing and warm-up compliance.
 *
 * Async because buildSendQueueEntry uses crypto.subtle.digest.
 * Deterministic — same inputs always produce same output.
 */
export async function queueEscalationCommunication(
  communication: CommunicationEntity,
  scheduledTimestamp: string,
  createdTimestamp: string
): Promise<SendQueueEntry> {
  const queueInput: SendQueueEntryInput = {
    tenantId: communication.tenantId,
    communicationId: communication.communicationId,
    agencyId: communication.agencyId,
    recipientAddress: communication.recipientAddress,
    scheduledTimestamp,
    createdTimestamp,
    sendStatus: 'QUEUED',
  };

  return buildSendQueueEntry(queueInput);
}

// ---------------------------------------------------------------------------
// Build Escalation Queue Result
// ---------------------------------------------------------------------------

/**
 * Build the EscalationQueueResult from a communication and queue entry.
 * Pure mapping — no computation.
 */
export function buildEscalationQueueResult(
  communication: CommunicationEntity,
  queueEntry: SendQueueEntry,
  scheduledTimestamp: string
): EscalationQueueResult {
  return {
    agencyId: communication.agencyId,
    communicationType: communication.communicationType,
    communicationId: communication.communicationId,
    queueId: queueEntry.queueId,
    scheduledTimestamp,
  };
}
