// ============================================
// Court Access — Daily Integrity Job Runner (Phase O4)
// Orchestration-Only Integrity + Monitoring Runner
//
// Orchestrates the daily integrity verification and
// monitoring snapshot generation per tenant.
//
// This runner:
//   - Receives all entity arrays as parameters (no store access)
//   - Calls Phase 15-20 verification functions
//   - Collects PASS/FAIL results only
//   - Computes monitoring metrics via operationalMonitoringEngine
//   - Builds daily operational snapshot
//   - Does NOT send email automatically
//   - Does NOT dispatch
//   - Does NOT modify any entity
//   - Does NOT trigger escalation
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Read-only orchestration
//
// Architectural boundary:
//   - Imports verification functions from Phases 15-20
//   - Imports metric computation from operationalMonitoringEngine
//   - Type-only imports from models
//   - No store access
//   - No SES calls
//   - No anchor modifications
//   - No escalation triggering
//   - No queue modification
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of any entity
//   - No deletion
//   - Deterministic processing
//   - Binary PASS/FAIL only
// ============================================

// ---------------------------------------------------------------------------
// Imports — verification engines (read-only)
// ---------------------------------------------------------------------------

import { enforceCommunicationChainIntegrity } from './communicationLedgerEngine';
import { enforceReferentialIntegrity } from './referentialIntegrityEngine';
import { enforceTenantIsolation } from './tenantIsolationEngine';
import { enforceEvidencePacketIntegrity } from './evidencePacketEngine';
import { enforceEvidenceAnchorBindingIntegrity } from './evidenceAnchorBindingEngine';

// ---------------------------------------------------------------------------
// Imports — monitoring engine (read-only aggregation)
// ---------------------------------------------------------------------------

import {
  computeWarmupMetrics,
  computeReputationMetrics,
  computeEscalationMetrics,
  computeQueueMetrics,
  buildDailyOperationalSnapshot,
} from './operationalMonitoringEngine';

// ---------------------------------------------------------------------------
// Type-only imports — models
// ---------------------------------------------------------------------------

import type { CommunicationEntity, ResponseEntity } from '../models/CommunicationModel';
import type { AuditTraceEntry } from '../models/AuditTraceModel';
import type { ArchiveManifestEntity } from '../models/ArchiveManifestModel';
import type { EvidencePacketEntity } from '../models/EvidencePacketModel';
import type { EvidenceAnchorBindingEntity, AnchorIntegrationLookup, SignatureLookup } from '../models/EvidenceAnchorBindingModel';
import type { SendQueueEntry, WarmupSchedule } from '../models/SendQueueModel';
import type { RecipientReputationRecord, BounceEventEntity, ComplaintEventEntity } from '../models/BounceModel';
import type { EscalationDecision } from '../models/EscalationModel';
import type { ResolvedCommunication, ResolvedArtifact, ResolvedDocument } from '../models/ReferentialIntegrityModel';

import type {
  IntegrityMetrics,
  DailyOperationalSnapshot,
  WarmupMetricsInput,
} from '../models/OperationalMonitoringModel';

// ---------------------------------------------------------------------------
// Integrity Verification Input — all data needed for Phases 15-20
// ---------------------------------------------------------------------------

/**
 * All entity arrays and lookup maps needed for running
 * Phases 15-20 integrity verification.
 *
 * Caller provides everything. Runner never queries stores.
 */
export interface IntegrityVerificationInput {
  tenantId: string;
  // Phase 15/16: Communication chain
  agencyId: string;
  communicationChain: CommunicationEntity[];
  // Phase 17: Referential integrity
  responses: ResponseEntity[];
  communicationLookup: Map<string, ResolvedCommunication>;
  auditTraceEntries: AuditTraceEntry[];
  artifactLookup: Map<string, ResolvedArtifact>;
  archives: ArchiveManifestEntity[];
  documentLookup: Map<string, ResolvedDocument>;
  // Phase 19: Evidence packet
  evidencePacket: EvidencePacketEntity | null;
  // Phase 20: Evidence anchor binding
  evidenceAnchorBinding: EvidenceAnchorBindingEntity | null;
  integrationLookup: AnchorIntegrationLookup;
  signatureLookup: SignatureLookup;
}

// ---------------------------------------------------------------------------
// Daily Job Input — all data needed for the daily snapshot
// ---------------------------------------------------------------------------

/**
 * Complete input for generating a daily operational snapshot.
 * Caller provides all entity arrays and parameters.
 * No store access. No Date.now.
 */
export interface DailyJobInput {
  tenantId: string;
  snapshotDate: string;                  // YYYY-MM-DD, caller-provided
  generatedTimestamp: string;            // ISO 8601, caller-provided
  // Integrity verification input
  integrity: IntegrityVerificationInput;
  // Warmup metrics input
  warmupInput: WarmupMetricsInput;
  warmupSchedule: WarmupSchedule;
  // Reputation data
  reputationRecords: RecipientReputationRecord[];
  bounceEvents: BounceEventEntity[];
  complaintEvents: ComplaintEventEntity[];
  // Escalation decisions (from escalation runner)
  escalationDecisions: EscalationDecision[];
  // Queue entries
  queueEntries: SendQueueEntry[];
}

// ---------------------------------------------------------------------------
// Run Integrity Verification — Phases 15-20
// ---------------------------------------------------------------------------

/**
 * Run all integrity verification checks (Phases 15-20).
 *
 * Calls each enforcement function and collects PASS/FAIL only.
 * Does NOT re-run crypto independently — uses existing engine functions.
 *
 * Async because some verification functions use crypto.subtle.digest.
 * Deterministic — same inputs always produce same result.
 */
export async function runIntegrityVerification(
  input: IntegrityVerificationInput
): Promise<IntegrityMetrics> {
  // Phase 15/16: Communication chain integrity
  const commChainResult = await enforceCommunicationChainIntegrity(
    input.agencyId,
    input.communicationChain
  );

  // Phase 17: Referential integrity
  const refIntegrityResult = enforceReferentialIntegrity(
    input.responses,
    input.communicationLookup,
    input.auditTraceEntries,
    input.artifactLookup,
    input.archives,
    input.documentLookup
  );

  // Phase 18: Tenant isolation
  const tenantIsolationResult = enforceTenantIsolation(
    input.tenantId,
    input.communicationChain,
    input.responses,
    input.auditTraceEntries,
    input.archives,
    input.artifactLookup,
    input.documentLookup
  );

  // Phase 19: Evidence packet verification
  let evidencePacketStatus: 'PASS' | 'FAIL' = 'PASS';
  if (input.evidencePacket !== null) {
    const packetResult = await enforceEvidencePacketIntegrity(input.evidencePacket);
    evidencePacketStatus = packetResult.result;
  }

  // Phase 20: Evidence anchor binding verification
  let anchorBindingStatus: 'PASS' | 'FAIL' = 'PASS';
  if (input.evidenceAnchorBinding !== null) {
    const bindingResult = await enforceEvidenceAnchorBindingIntegrity(
      input.evidenceAnchorBinding,
      input.integrationLookup,
      input.signatureLookup
    );
    anchorBindingStatus = bindingResult.result;
  }

  return {
    communicationChainStatus: commChainResult.result,
    referentialIntegrityStatus: refIntegrityResult.result,
    tenantIsolationStatus: tenantIsolationResult.result,
    evidencePacketVerificationStatus: evidencePacketStatus,
    anchorBindingStatus,
  };
}

// ---------------------------------------------------------------------------
// Run Daily Integrity Job
// ---------------------------------------------------------------------------

/**
 * Run the complete daily integrity and monitoring job for a single tenant.
 *
 * Sequence:
 *   1. Run integrity verification (Phases 15-20) → IntegrityMetrics
 *   2. Compute warmup metrics → WarmupUtilizationMetrics
 *   3. Compute reputation metrics → ReputationMetrics
 *   4. Compute escalation metrics → EscalationMetrics
 *   5. Compute queue metrics → QueueMetrics
 *   6. Build daily operational snapshot
 *
 * No email. No dispatch. No mutation. No escalation triggering.
 * Pure aggregation + verification only.
 *
 * Async because integrity verification uses crypto.subtle.digest.
 * Deterministic — same inputs always produce same output.
 */
export async function runDailyIntegrityJob(
  input: DailyJobInput
): Promise<DailyOperationalSnapshot> {
  // 1. Integrity verification
  const integrity = await runIntegrityVerification(input.integrity);

  // 2. Warmup metrics
  const warmup = computeWarmupMetrics(input.warmupInput, input.warmupSchedule);

  // 3. Reputation metrics
  const reputation = computeReputationMetrics(
    input.reputationRecords,
    input.bounceEvents,
    input.complaintEvents
  );

  // 4. Escalation metrics
  const escalation = computeEscalationMetrics(input.escalationDecisions);

  // 5. Queue metrics
  const queue = computeQueueMetrics(input.queueEntries, input.snapshotDate);

  // 6. Build snapshot
  return buildDailyOperationalSnapshot(
    input.tenantId,
    input.snapshotDate,
    input.generatedTimestamp,
    warmup,
    reputation,
    escalation,
    queue,
    integrity
  );
}
