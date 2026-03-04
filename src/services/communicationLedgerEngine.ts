// ============================================
// Court Access — Communication Ledger Engine (Phase 16)
// Deterministic Communication Ledger
//
// Per-agency hash chaining, dual-hash communication entries,
// response logging, escalation timer evaluation,
// chain verification, and CI enforcement hook.
//
// This engine creates court-admissible communication records:
//   - SES email sends with hash-chained provenance
//   - Public records requests with deterministic tracking
//   - Follow-up escalation with deterministic timer evaluation
//   - Non-response detection with caller-provided timestamps
//   - Attorney-ready evidence packets
//   - Anchor eligibility for communications
//
// Architectural boundary:
//   - Does NOT import exportEngine
//   - Does NOT import anchorIntegrationEngine
//   - Does NOT import signatureEngine
//   - Does NOT import issueIndexEngine
//   - Does NOT import officerIndexEngine
//   - No circular dependencies
//   - Consumes only: CommunicationModel, policyIngestionService (hash functions)
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of historical entries
//   - No deletion
//   - No update
//   - No re-hashing of historical entries
//   - Append-only discipline
//   - Forward-only hash chain (per-agency)
//   - Deterministic reconstruction from ledger alone
//   - Binary PASS/FAIL only
//   - ASCII comparator only
//   - Canonical JSON only
//   - Escalation timers accept currentTimestamp as parameter
//   - No interpretive output
// ============================================

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  CommunicationEntity,
  CommunicationInput,
  ResponseEntity,
  ResponseInput,
  EscalationEvaluation,
  EscalationThresholds,
  CommunicationChainLinkVerification,
  CommunicationChainVerificationResult,
  CommunicationFieldValidation,
  CommunicationValidationMatrix,
  CICommunicationEnforcementResult,
} from '../models/CommunicationModel';

import {
  GENESIS_COMMUNICATION_HASH,
  DEFAULT_ESCALATION_THRESHOLDS,
} from '../models/CommunicationModel';

// ---------------------------------------------------------------------------
// ASCII Comparator — deterministic sorting
// ---------------------------------------------------------------------------

/**
 * ASCII comparator for deterministic sorting.
 * No localeCompare. No locale sensitivity.
 */
function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Attachment Hash Sorting
// ---------------------------------------------------------------------------

/**
 * Sort attachment hashes deterministically.
 * ASCII comparator only. Returns new sorted array — does NOT mutate input.
 */
function sortAttachmentHashes(hashes: string[]): string[] {
  return [...hashes].sort((a, b) => asciiCompare(a, b));
}

// ---------------------------------------------------------------------------
// Canonical JSON — Communication Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for communication ID derivation.
 *
 * Includes:
 *   sequenceNumber, tenantId, agencyId, caseId, communicationType,
 *   sentTimestamp, deliveryStatus, recipientAddress, subject,
 *   messageHash, previousCommunicationHash, description
 *
 * Excludes:
 *   communicationId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 *
 * Fixed key order. Explicit string concatenation.
 * No reliance on JSON.stringify key insertion order.
 */
function canonicalizeCommunicationPreId(input: CommunicationInput): string {
  return (
    '{' +
    `"sequenceNumber":${JSON.stringify(input.sequenceNumber)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"agencyId":${JSON.stringify(input.agencyId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"communicationType":${JSON.stringify(input.communicationType)},` +
    `"sentTimestamp":${JSON.stringify(input.sentTimestamp)},` +
    `"deliveryStatus":${JSON.stringify(input.deliveryStatus)},` +
    `"recipientAddress":${JSON.stringify(input.recipientAddress)},` +
    `"subject":${JSON.stringify(input.subject)},` +
    `"messageHash":${JSON.stringify(input.messageHash)},` +
    `"previousCommunicationHash":${JSON.stringify(input.previousCommunicationHash)},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON — Communication Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for communication dual-hash computation.
 *
 * Includes:
 *   communicationId, sequenceNumber, tenantId, agencyId, caseId,
 *   communicationType, sentTimestamp, deliveryStatus, recipientAddress,
 *   subject, messageHash, previousCommunicationHash, description
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 *
 * Fixed key order. Explicit string concatenation.
 * No circular hash binding — hashes derived FROM this form, appended AFTER.
 */
function canonicalizeCommunicationFull(
  communicationId: string,
  input: CommunicationInput
): string {
  return (
    '{' +
    `"communicationId":${JSON.stringify(communicationId)},` +
    `"sequenceNumber":${JSON.stringify(input.sequenceNumber)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"agencyId":${JSON.stringify(input.agencyId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"communicationType":${JSON.stringify(input.communicationType)},` +
    `"sentTimestamp":${JSON.stringify(input.sentTimestamp)},` +
    `"deliveryStatus":${JSON.stringify(input.deliveryStatus)},` +
    `"recipientAddress":${JSON.stringify(input.recipientAddress)},` +
    `"subject":${JSON.stringify(input.subject)},` +
    `"messageHash":${JSON.stringify(input.messageHash)},` +
    `"previousCommunicationHash":${JSON.stringify(input.previousCommunicationHash)},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON — Response Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for response ID derivation.
 *
 * Includes:
 *   tenantId, agencyId, linkedCommunicationId, receivedTimestamp,
 *   bodyHash, headerHash, attachmentHashes, senderAddress, subject, description
 *
 * Excludes:
 *   responseId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 *
 * Attachment hashes sorted ASC (ASCII comparator) before serialization.
 */
function canonicalizeResponsePreId(input: ResponseInput): string {
  const sortedAttachments = sortAttachmentHashes(input.attachmentHashes);
  const attachmentsJson = '[' + sortedAttachments.map((h) => JSON.stringify(h)).join(',') + ']';

  return (
    '{' +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"agencyId":${JSON.stringify(input.agencyId)},` +
    `"linkedCommunicationId":${JSON.stringify(input.linkedCommunicationId)},` +
    `"receivedTimestamp":${JSON.stringify(input.receivedTimestamp)},` +
    `"bodyHash":${JSON.stringify(input.bodyHash)},` +
    `"headerHash":${JSON.stringify(input.headerHash)},` +
    `"attachmentHashes":${attachmentsJson},` +
    `"senderAddress":${JSON.stringify(input.senderAddress)},` +
    `"subject":${JSON.stringify(input.subject)},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON — Response Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for response dual-hash computation.
 *
 * Includes:
 *   responseId, tenantId, agencyId, linkedCommunicationId, receivedTimestamp,
 *   bodyHash, headerHash, attachmentHashes, senderAddress, subject, description
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 */
function canonicalizeResponseFull(
  responseId: string,
  input: ResponseInput
): string {
  const sortedAttachments = sortAttachmentHashes(input.attachmentHashes);
  const attachmentsJson = '[' + sortedAttachments.map((h) => JSON.stringify(h)).join(',') + ']';

  return (
    '{' +
    `"responseId":${JSON.stringify(responseId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"agencyId":${JSON.stringify(input.agencyId)},` +
    `"linkedCommunicationId":${JSON.stringify(input.linkedCommunicationId)},` +
    `"receivedTimestamp":${JSON.stringify(input.receivedTimestamp)},` +
    `"bodyHash":${JSON.stringify(input.bodyHash)},` +
    `"headerHash":${JSON.stringify(input.headerHash)},` +
    `"attachmentHashes":${attachmentsJson},` +
    `"senderAddress":${JSON.stringify(input.senderAddress)},` +
    `"subject":${JSON.stringify(input.subject)},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Communication Entry
// ---------------------------------------------------------------------------

/**
 * Build a new communication entry from input.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form (excludes communicationId and hashes)
 *   2. Derive communicationId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form (includes communicationId, excludes hashes)
 *   4. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   5. Return complete CommunicationEntity
 *
 * No circular hash binding:
 *   - communicationId derived from pre-ID canonical (which excludes communicationId)
 *   - sha256/sha3_256 derived from full canonical (which excludes hashes)
 *   - Hashes appended AFTER computation
 *
 * Async because SHA-256 uses crypto.subtle.digest (Web Crypto API).
 * Deterministic — same input always produces same output.
 */
export async function buildCommunicationEntry(input: CommunicationInput): Promise<CommunicationEntity> {
  // Step 1: Pre-ID canonical -> derive communicationId
  const preIdCanonical = canonicalizeCommunicationPreId(input);
  const communicationId = await computeTextSHA256(preIdCanonical);

  // Step 2: Full canonical (with communicationId, without hashes) -> dual-hash
  const fullCanonical = canonicalizeCommunicationFull(communicationId, input);
  const entrySha256 = await computeTextSHA256(fullCanonical);
  const entrySha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 3: Assemble complete entry — hashes appended AFTER computation
  return {
    communicationId,
    sequenceNumber: input.sequenceNumber,
    tenantId: input.tenantId,
    agencyId: input.agencyId,
    caseId: input.caseId,
    communicationType: input.communicationType,
    sentTimestamp: input.sentTimestamp,
    deliveryStatus: input.deliveryStatus,
    recipientAddress: input.recipientAddress,
    subject: input.subject,
    messageHash: input.messageHash,
    previousCommunicationHash: input.previousCommunicationHash,
    description: input.description,
    sha256: entrySha256,
    sha3_256: entrySha3_256,
  };
}

// ---------------------------------------------------------------------------
// Build Response Entry
// ---------------------------------------------------------------------------

/**
 * Build a new response entry from input.
 *
 * Pipeline:
 *   1. Sort attachment hashes (ASCII comparator)
 *   2. Canonicalize pre-ID form (excludes responseId and hashes)
 *   3. Derive responseId = SHA-256(preIdCanonical)
 *   4. Canonicalize full form (includes responseId, excludes hashes)
 *   5. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   6. Return complete ResponseEntity
 *
 * Async because SHA-256 uses crypto.subtle.digest (Web Crypto API).
 * Deterministic — same input always produces same output.
 */
export async function buildResponseEntry(input: ResponseInput): Promise<ResponseEntity> {
  const sortedAttachments = sortAttachmentHashes(input.attachmentHashes);

  // Step 1: Pre-ID canonical -> derive responseId
  const preIdCanonical = canonicalizeResponsePreId(input);
  const responseId = await computeTextSHA256(preIdCanonical);

  // Step 2: Full canonical (with responseId, without hashes) -> dual-hash
  const fullCanonical = canonicalizeResponseFull(responseId, input);
  const entrySha256 = await computeTextSHA256(fullCanonical);
  const entrySha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 3: Assemble complete entry — hashes appended AFTER computation
  return {
    responseId,
    tenantId: input.tenantId,
    agencyId: input.agencyId,
    linkedCommunicationId: input.linkedCommunicationId,
    receivedTimestamp: input.receivedTimestamp,
    bodyHash: input.bodyHash,
    headerHash: input.headerHash,
    attachmentHashes: sortedAttachments,
    senderAddress: input.senderAddress,
    subject: input.subject,
    description: input.description,
    sha256: entrySha256,
    sha3_256: entrySha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Communication Entry — recompute and compare hashes
// ---------------------------------------------------------------------------

/**
 * Verify a single communication entry by recomputing its hashes.
 *
 * Recomputes:
 *   1. communicationId from pre-ID canonical
 *   2. sha256 from full canonical
 *   3. sha3_256 from full canonical
 *
 * Returns PASS if all recomputed values match stored values.
 * Returns FAIL if any mismatch detected.
 *
 * Binary only. No partial pass.
 *
 * Async because SHA-256 uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function verifyCommunicationEntry(entry: CommunicationEntity): Promise<CommunicationValidationMatrix> {
  const fields: CommunicationFieldValidation[] = [];

  // Reconstruct input from entry
  const input: CommunicationInput = {
    sequenceNumber: entry.sequenceNumber,
    tenantId: entry.tenantId,
    agencyId: entry.agencyId,
    caseId: entry.caseId,
    communicationType: entry.communicationType,
    sentTimestamp: entry.sentTimestamp,
    deliveryStatus: entry.deliveryStatus,
    recipientAddress: entry.recipientAddress,
    subject: entry.subject,
    messageHash: entry.messageHash,
    previousCommunicationHash: entry.previousCommunicationHash,
    description: entry.description,
  };

  // Recompute communicationId
  const preIdCanonical = canonicalizeCommunicationPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  fields.push({
    field: 'communicationIdMatch',
    result: entry.communicationId === recomputedId ? 'PASS' : 'FAIL',
  });

  // Recompute dual-hash
  const fullCanonical = canonicalizeCommunicationFull(entry.communicationId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3_256 = await computeTextSHA3_256(fullCanonical);

  fields.push({
    field: 'sha256Match',
    result: entry.sha256 === recomputedSha256 ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'sha3_256Match',
    result: entry.sha3_256 === recomputedSha3_256 ? 'PASS' : 'FAIL',
  });

  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}

// ---------------------------------------------------------------------------
// Verify Response Entry — recompute and compare hashes
// ---------------------------------------------------------------------------

/**
 * Verify a single response entry by recomputing its hashes.
 *
 * Recomputes:
 *   1. responseId from pre-ID canonical
 *   2. sha256 from full canonical
 *   3. sha3_256 from full canonical
 *
 * Binary only. No partial pass.
 *
 * Async because SHA-256 uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function verifyResponseEntry(entry: ResponseEntity): Promise<CommunicationValidationMatrix> {
  const fields: CommunicationFieldValidation[] = [];

  // Reconstruct input from entry
  const input: ResponseInput = {
    tenantId: entry.tenantId,
    agencyId: entry.agencyId,
    linkedCommunicationId: entry.linkedCommunicationId,
    receivedTimestamp: entry.receivedTimestamp,
    bodyHash: entry.bodyHash,
    headerHash: entry.headerHash,
    attachmentHashes: entry.attachmentHashes,
    senderAddress: entry.senderAddress,
    subject: entry.subject,
    description: entry.description,
  };

  // Recompute responseId
  const preIdCanonical = canonicalizeResponsePreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  fields.push({
    field: 'responseIdMatch',
    result: entry.responseId === recomputedId ? 'PASS' : 'FAIL',
  });

  // Recompute dual-hash
  const fullCanonical = canonicalizeResponseFull(entry.responseId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3_256 = await computeTextSHA3_256(fullCanonical);

  fields.push({
    field: 'sha256Match',
    result: entry.sha256 === recomputedSha256 ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'sha3_256Match',
    result: entry.sha3_256 === recomputedSha3_256 ? 'PASS' : 'FAIL',
  });

  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}

// ---------------------------------------------------------------------------
// Per-Agency Chain Verification
// ---------------------------------------------------------------------------

/**
 * Verify an entire per-agency communication chain.
 *
 * Checks for each entry:
 *   1. Hash link: entry[N].previousCommunicationHash === entry[N-1].sha256
 *      (entry[0].previousCommunicationHash === GENESIS_COMMUNICATION_HASH)
 *   2. Hash integrity: recomputed sha256/sha3_256 match stored values
 *   3. Sequence continuity: sequenceNumber === index + 1 (no gaps)
 *
 * Entries MUST be provided in sequence order (sorted by sequenceNumber ASC).
 * All entries MUST belong to the same agencyId.
 *
 * Overall: PASS only if ALL entries pass ALL checks.
 * Binary only. No partial pass.
 *
 * Async because SHA-256 uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function verifyCommunicationChain(
  agencyId: string,
  entries: CommunicationEntity[]
): Promise<CommunicationChainVerificationResult> {
  const links: CommunicationChainLinkVerification[] = [];
  let brokenLinks = 0;
  let hashMismatches = 0;
  let sequenceGaps = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrevHash = i === 0 ? GENESIS_COMMUNICATION_HASH : entries[i - 1].sha256;
    const expectedSequence = i + 1;

    // Check chain link
    const linkPass = entry.previousCommunicationHash === expectedPrevHash;
    if (!linkPass) brokenLinks++;

    // Check hash integrity
    const hashVerification = await verifyCommunicationEntry(entry);
    const hashPass = hashVerification.overallResult === 'PASS';
    if (!hashPass) hashMismatches++;

    // Check sequence continuity
    const seqPass = entry.sequenceNumber === expectedSequence;
    if (!seqPass) sequenceGaps++;

    links.push({
      communicationId: entry.communicationId,
      sequenceNumber: entry.sequenceNumber,
      verifiedLink: linkPass ? 'PASS' : 'FAIL',
      verifiedHash: hashPass ? 'PASS' : 'FAIL',
      verifiedSequence: seqPass ? 'PASS' : 'FAIL',
    });
  }

  const allPass = brokenLinks === 0 && hashMismatches === 0 && sequenceGaps === 0;

  return {
    agencyId,
    links,
    overallResult: allPass ? 'PASS' : 'FAIL',
    totalEntries: entries.length,
    brokenLinks,
    hashMismatches,
    sequenceGaps,
  };
}

// ---------------------------------------------------------------------------
// Validate Communication Entry — structural checks
// ---------------------------------------------------------------------------

/**
 * Validate the structural integrity of a single communication entry.
 *
 * Checks:
 *   1. communicationId is valid hex (64 chars)
 *   2. sequenceNumber is positive integer
 *   3. tenantId is non-empty
 *   4. agencyId is non-empty
 *   5. communicationType is valid
 *   6. sentTimestamp is non-empty
 *   7. deliveryStatus is valid
 *   8. recipientAddress is non-empty
 *   9. messageHash is valid hex (64 chars)
 *  10. previousCommunicationHash is valid hex (64 chars)
 *  11. sha256 is valid hex (64 chars)
 *  12. sha3_256 is valid hex (64 chars)
 *
 * Binary result per check. Overall: PASS only if ALL checks pass.
 *
 * This is a pure function — same input always produces same output.
 */
export function validateCommunicationEntry(entry: CommunicationEntity): CommunicationValidationMatrix {
  const fields: CommunicationFieldValidation[] = [];

  // Hex validation helper
  const isValidHex = (str: string): boolean => {
    if (str.length !== 64) return false;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (!((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f'))) return false;
    }
    return true;
  };

  const validCommunicationTypes: string[] = [
    'ANNUAL_UPDATE',
    'FOLLOW_UP_1',
    'FOLLOW_UP_2',
    'INITIAL_REQUEST',
  ];

  const validDeliveryStatuses: string[] = [
    'BOUNCED',
    'DELIVERED',
    'FAILED',
    'QUEUED',
    'SENT',
  ];

  // Check 1: communicationId valid hex
  fields.push({
    field: 'communicationIdValidHex',
    result: isValidHex(entry.communicationId) ? 'PASS' : 'FAIL',
  });

  // Check 2: sequenceNumber positive integer
  fields.push({
    field: 'sequenceNumberPositive',
    result: Number.isInteger(entry.sequenceNumber) && entry.sequenceNumber > 0 ? 'PASS' : 'FAIL',
  });

  // Check 3: tenantId non-empty
  fields.push({
    field: 'tenantIdNonEmpty',
    result: typeof entry.tenantId === 'string' && entry.tenantId.length > 0 ? 'PASS' : 'FAIL',
  });

  // Check 4: agencyId non-empty
  fields.push({
    field: 'agencyIdNonEmpty',
    result: typeof entry.agencyId === 'string' && entry.agencyId.length > 0 ? 'PASS' : 'FAIL',
  });

  // Check 5: communicationType valid
  fields.push({
    field: 'communicationTypeValid',
    result: validCommunicationTypes.indexOf(entry.communicationType) !== -1 ? 'PASS' : 'FAIL',
  });

  // Check 6: sentTimestamp non-empty
  fields.push({
    field: 'sentTimestampNonEmpty',
    result: typeof entry.sentTimestamp === 'string' && entry.sentTimestamp.length > 0 ? 'PASS' : 'FAIL',
  });

  // Check 7: deliveryStatus valid
  fields.push({
    field: 'deliveryStatusValid',
    result: validDeliveryStatuses.indexOf(entry.deliveryStatus) !== -1 ? 'PASS' : 'FAIL',
  });

  // Check 8: recipientAddress non-empty
  fields.push({
    field: 'recipientAddressNonEmpty',
    result: typeof entry.recipientAddress === 'string' && entry.recipientAddress.length > 0 ? 'PASS' : 'FAIL',
  });

  // Check 9: messageHash valid hex
  fields.push({
    field: 'messageHashValidHex',
    result: isValidHex(entry.messageHash) ? 'PASS' : 'FAIL',
  });

  // Check 10: previousCommunicationHash valid hex
  fields.push({
    field: 'previousCommunicationHashValidHex',
    result: isValidHex(entry.previousCommunicationHash) ? 'PASS' : 'FAIL',
  });

  // Check 11: sha256 valid hex
  fields.push({
    field: 'sha256ValidHex',
    result: isValidHex(entry.sha256) ? 'PASS' : 'FAIL',
  });

  // Check 12: sha3_256 valid hex
  fields.push({
    field: 'sha3_256ValidHex',
    result: isValidHex(entry.sha3_256) ? 'PASS' : 'FAIL',
  });

  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}

// ---------------------------------------------------------------------------
// Escalation Timer Evaluation
// ---------------------------------------------------------------------------

/**
 * Compute elapsed days between two ISO 8601 timestamps.
 *
 * Uses integer arithmetic only.
 * No Date.now. No runtime clock.
 * Accepts caller-provided timestamps only.
 *
 * Algorithm:
 *   1. Parse both timestamps to milliseconds-since-epoch
 *   2. Compute difference in milliseconds
 *   3. Convert to integer days (floor division by 86400000)
 *
 * This is a pure function — same input always produces same output.
 */
function computeElapsedDays(sentTimestamp: string, currentTimestamp: string): number {
  // Parse ISO 8601 timestamps to milliseconds
  // Note: We parse the strings manually to avoid Date.now dependency.
  // The Date constructor with a string is deterministic for ISO 8601 format.
  const sentMs = Date.parse(sentTimestamp);
  const currentMs = Date.parse(currentTimestamp);

  // Guard against invalid timestamps
  if (Number.isNaN(sentMs) || Number.isNaN(currentMs)) return 0;

  // Elapsed milliseconds (integer)
  const elapsedMs = currentMs - sentMs;
  if (elapsedMs < 0) return 0;

  // Integer days (floor division)
  const msPerDay = 86400000;
  return Math.floor(elapsedMs / msPerDay);
}

/**
 * Evaluate escalation status for a single agency communication chain.
 *
 * Deterministic evaluation:
 *   - Accepts currentTimestamp as input parameter
 *   - No Date.now
 *   - No runtime clock dependency
 *   - Same inputs always produce same output
 *
 * Logic:
 *   - If last communication was INITIAL_REQUEST and elapsed >= followUp1Days -> DUE, nextAction = FOLLOW_UP_1
 *   - If last communication was FOLLOW_UP_1 and elapsed >= followUp2Days -> DUE, nextAction = FOLLOW_UP_2
 *   - If last communication was FOLLOW_UP_2 and elapsed >= annualDays -> DUE, nextAction = ANNUAL_UPDATE
 *   - If last communication was ANNUAL_UPDATE and elapsed >= annualDays -> DUE, nextAction = ANNUAL_UPDATE
 *   - Otherwise -> NOT_DUE, nextAction = (next applicable type)
 *
 * hasResponse: if true, status = RESPONDED, nextAction = null
 *
 * This is a pure function — same input always produces same output.
 */
export function evaluateEscalation(
  agencyId: string,
  lastCommunicationType: CommunicationEntity['communicationType'],
  lastSentTimestamp: string,
  currentTimestamp: string,
  hasResponse: boolean,
  thresholds: EscalationThresholds = DEFAULT_ESCALATION_THRESHOLDS
): EscalationEvaluation {
  const elapsedDays = computeElapsedDays(lastSentTimestamp, currentTimestamp);

  // If agency has responded, no escalation needed
  if (hasResponse) {
    return {
      agencyId,
      lastCommunicationType,
      lastSentTimestamp,
      currentTimestamp,
      elapsedDays,
      status: 'RESPONDED',
      nextAction: null,
    };
  }

  // Determine escalation based on last communication type and elapsed time
  let status: EscalationEvaluation['status'] = 'NOT_DUE';
  let nextAction: EscalationEvaluation['nextAction'] = null;

  if (lastCommunicationType === 'INITIAL_REQUEST') {
    nextAction = 'FOLLOW_UP_1';
    if (elapsedDays >= thresholds.followUp1Days) {
      status = 'DUE';
    }
  } else if (lastCommunicationType === 'FOLLOW_UP_1') {
    nextAction = 'FOLLOW_UP_2';
    if (elapsedDays >= thresholds.followUp2Days) {
      status = 'DUE';
    }
  } else if (lastCommunicationType === 'FOLLOW_UP_2') {
    nextAction = 'ANNUAL_UPDATE';
    if (elapsedDays >= thresholds.annualDays) {
      status = 'DUE';
    }
  } else if (lastCommunicationType === 'ANNUAL_UPDATE') {
    nextAction = 'ANNUAL_UPDATE';
    if (elapsedDays >= thresholds.annualDays) {
      status = 'DUE';
    }
  }

  return {
    agencyId,
    lastCommunicationType,
    lastSentTimestamp,
    currentTimestamp,
    elapsedDays,
    status,
    nextAction,
  };
}

// ---------------------------------------------------------------------------
// CI Enforcement Hook — communication chain integrity
// ---------------------------------------------------------------------------

/**
 * CI enforcement check for per-agency communication chain integrity.
 *
 * Verifies the chain for a single agency and returns a CI-compatible result.
 * Designed to be called from build/CI pipeline.
 *
 * Binary only: PASS or FAIL.
 * If FAIL -> build MUST be blocked.
 * No soft pass. No warning-only mode. No bypass flag.
 *
 * Async because chain verification uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function enforceCommunicationChainIntegrity(
  agencyId: string,
  entries: CommunicationEntity[]
): Promise<CICommunicationEnforcementResult> {
  const chainResult = await verifyCommunicationChain(agencyId, entries);

  return {
    result: chainResult.overallResult,
    brokenLinks: chainResult.brokenLinks,
    hashMismatches: chainResult.hashMismatches,
    sequenceGaps: chainResult.sequenceGaps,
    totalEntries: chainResult.totalEntries,
  };
}
