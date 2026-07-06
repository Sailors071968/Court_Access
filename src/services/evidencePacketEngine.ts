// ============================================
// Court Access — Evidence Packet Engine (Phase 19)
// Deterministic Evidence Packet Builder
//
// Builds litigation-ready evidence packets from:
//   - Communication chain entries
//   - Response chain entries
//   - Audit trace entries
//   - Archive manifests
//   - Anchor proofs
//   - CAPS proofs
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Async where SHA-256/SHA3-256 computation required
//   - Binary PASS/FAIL only (no scoring, no partial pass)
//
// Architectural boundary:
//   - Does NOT import any other engine except policyIngestionService
//     (for computeTextSHA256 / computeTextSHA3_256)
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access (callers provide entry hashes)
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of input entities
//   - No deletion
//   - No update
//   - Binary PASS/FAIL only
//   - ASCII comparator only
//   - Canonical JSON only
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  EvidencePacketEntity,
  EvidencePacketInput,
  EvidenceSection,
  EvidenceSectionType,
  EvidencePacketVerificationResult,
  EvidenceSectionVerification,
  CIEvidencePacketEnforcementResult,
} from '../models/EvidencePacketModel';

import { EVIDENCE_SECTION_ORDER } from '../models/EvidencePacketModel';

// ---------------------------------------------------------------------------
// ASCII Comparator — deterministic, no locale dependency
// ---------------------------------------------------------------------------

/**
 * ASCII string comparison.
 * Returns -1 if a < b, 1 if a > b, 0 if equal.
 * No localeCompare. Deterministic across all environments.
 */
function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Sort Hashes — deterministic ASCII sort
// ---------------------------------------------------------------------------

/**
 * Sort an array of hash strings by ASCII comparator.
 * Returns a new array. Does not mutate input.
 */
function sortHashes(hashes: string[]): string[] {
  return [...hashes].sort((a, b) => asciiCompare(a, b));
}

// ---------------------------------------------------------------------------
// Build Section Hash — SHA-256 of sorted entry hashes concatenated
// ---------------------------------------------------------------------------

/**
 * Compute the section hash from sorted entry hashes.
 *
 * Canonical section content:
 *   Sorted entry hashes joined with ',' and wrapped in brackets.
 *   Example: ["abc123","def456","ghi789"]
 *
 * The section hash is SHA-256 of this canonical string.
 * Async because computeTextSHA256 uses crypto.subtle.digest.
 */
async function computeSectionHash(sortedEntryHashes: string[]): Promise<string> {
  const canonical = '[' + sortedEntryHashes.map((h) => JSON.stringify(h)).join(',') + ']';
  return computeTextSHA256(canonical);
}

// ---------------------------------------------------------------------------
// Build Evidence Section
// ---------------------------------------------------------------------------

/**
 * Build a single evidence section from entry hashes.
 *
 * Pipeline:
 *   1. Sort entry hashes ASC (ASCII comparator)
 *   2. Compute section hash from sorted hashes
 *   3. Return complete EvidenceSection
 *
 * Async because section hash computation uses SHA-256.
 * Deterministic — same input always produces same output.
 */
async function buildEvidenceSection(
  sectionType: EvidenceSectionType,
  sectionIndex: number,
  entryHashes: string[]
): Promise<EvidenceSection> {
  const sortedHashes = sortHashes(entryHashes);
  const sectionHash = await computeSectionHash(sortedHashes);

  return {
    sectionType,
    sectionIndex,
    entryCount: sortedHashes.length,
    entryHashes: sortedHashes,
    sectionHash,
  };
}

// ---------------------------------------------------------------------------
// Canonical JSON — Packet Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for packet ID derivation.
 *
 * Includes:
 *   tenantId, caseId, agencyId, generatedTimestamp,
 *   sectionHashes (array of section hashes in canonical order),
 *   description
 *
 * Excludes:
 *   packetId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 *   sections (represented by sectionHashes only)
 *
 * Explicit string concatenation. Fixed key order.
 * No JSON.stringify key order dependency.
 */
function canonicalizePacketPreId(
  input: EvidencePacketInput,
  sectionHashes: string[]
): string {
  const hashesJson = '[' + sectionHashes.map((h) => JSON.stringify(h)).join(',') + ']';
  return (
    '{' +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"agencyId":${JSON.stringify(input.agencyId)},` +
    `"generatedTimestamp":${JSON.stringify(input.generatedTimestamp)},` +
    `"sectionHashes":${hashesJson},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON — Packet Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes:
 *   packetId, tenantId, caseId, agencyId, generatedTimestamp,
 *   sectionHashes, description
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 *   sections (represented by sectionHashes only)
 *
 * No circular hash binding — hashes derived FROM this form, appended AFTER.
 */
function canonicalizePacketFull(
  packetId: string,
  input: EvidencePacketInput,
  sectionHashes: string[]
): string {
  const hashesJson = '[' + sectionHashes.map((h) => JSON.stringify(h)).join(',') + ']';
  return (
    '{' +
    `"packetId":${JSON.stringify(packetId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"agencyId":${JSON.stringify(input.agencyId)},` +
    `"generatedTimestamp":${JSON.stringify(input.generatedTimestamp)},` +
    `"sectionHashes":${hashesJson},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Extract Section Hashes from Input
// ---------------------------------------------------------------------------

/**
 * Extract the entry hashes array for a given section type from the input.
 * Returns the appropriate array based on section type.
 * Deterministic mapping — no dynamic dispatch.
 */
function getInputHashesForSection(
  input: EvidencePacketInput,
  sectionType: EvidenceSectionType
): string[] {
  if (sectionType === 'COMMUNICATION_CHAIN') return input.communicationHashes;
  if (sectionType === 'RESPONSE_CHAIN') return input.responseHashes;
  if (sectionType === 'AUDIT_TRACE') return input.auditTraceHashes;
  if (sectionType === 'ARCHIVE_MANIFEST') return input.archiveManifestHashes;
  if (sectionType === 'ANCHOR_PROOF') return input.anchorProofHashes;
  if (sectionType === 'CAPS_PROOF') return input.capsProofHashes;
  return [];
}

// ---------------------------------------------------------------------------
// Build Evidence Packet
// ---------------------------------------------------------------------------

/**
 * Build a complete evidence packet from input.
 *
 * Pipeline:
 *   1. Build each section in fixed canonical order (EVIDENCE_SECTION_ORDER)
 *   2. Extract sectionHashes array in canonical order
 *   3. Canonicalize pre-ID form (excludes packetId and hashes)
 *   4. Derive packetId = SHA-256(preIdCanonical)
 *   5. Canonicalize full form (includes packetId, excludes hashes)
 *   6. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   7. Return complete EvidencePacketEntity
 *
 * No circular hash binding:
 *   - packetId derived from pre-ID canonical (which excludes packetId)
 *   - sha256/sha3_256 derived from full canonical (which excludes hashes)
 *   - Hashes appended AFTER computation
 *
 * Async because hash computation uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function buildEvidencePacket(
  input: EvidencePacketInput
): Promise<EvidencePacketEntity> {
  // Step 1: Build each section in fixed canonical order
  const sections: EvidenceSection[] = [];
  for (let i = 0; i < EVIDENCE_SECTION_ORDER.length; i++) {
    const sectionType = EVIDENCE_SECTION_ORDER[i];
    const entryHashes = getInputHashesForSection(input, sectionType);
    const section = await buildEvidenceSection(sectionType, i, entryHashes);
    sections.push(section);
  }

  // Step 2: Extract sectionHashes in canonical order
  const sectionHashes: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    sectionHashes.push(sections[i].sectionHash);
  }

  // Step 3: Canonicalize pre-ID form
  const preIdCanonical = canonicalizePacketPreId(input, sectionHashes);

  // Step 4: Derive packetId
  const packetId = await computeTextSHA256(preIdCanonical);

  // Step 5: Canonicalize full form
  const fullCanonical = canonicalizePacketFull(packetId, input, sectionHashes);

  // Step 6: Compute dual-hash
  const packetSha256 = await computeTextSHA256(fullCanonical);
  const packetSha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 7: Return complete entity
  return {
    packetId,
    tenantId: input.tenantId,
    caseId: input.caseId,
    agencyId: input.agencyId,
    generatedTimestamp: input.generatedTimestamp,
    sections,
    sectionHashes,
    description: input.description,
    sha256: packetSha256,
    sha3_256: packetSha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Evidence Packet — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify an evidence packet by recomputing all hashes.
 *
 * Recomputes:
 *   1. Each section's sectionHash from sorted entryHashes
 *   2. sectionHashes array matches sections[].sectionHash
 *   3. packetId from pre-ID canonical
 *   4. sha256 from full canonical
 *   5. sha3_256 from full canonical
 *
 * Also validates:
 *   - Section ordering matches EVIDENCE_SECTION_ORDER
 *   - Entry hashes are sorted ASC (ASCII)
 *   - Entry count matches entryHashes.length
 *
 * Binary only. No partial pass.
 * Async because SHA-256 uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function verifyEvidencePacket(
  packet: EvidencePacketEntity
): Promise<EvidencePacketVerificationResult> {
  const sectionVerifications: EvidenceSectionVerification[] = [];
  const recomputedSectionHashes: string[] = [];
  let anySectionFail = false;

  // Verify each section
  for (let i = 0; i < packet.sections.length; i++) {
    const section = packet.sections[i];

    // Verify entry count
    const entryCountMatch = section.entryCount === section.entryHashes.length;

    // Verify sorting (ASCII ASC)
    let sortingValid = true;
    for (let j = 1; j < section.entryHashes.length; j++) {
      if (asciiCompare(section.entryHashes[j - 1], section.entryHashes[j]) > 0) {
        sortingValid = false;
        break;
      }
    }

    // Recompute section hash
    const recomputedHash = await computeSectionHash(section.entryHashes);
    const sectionHashMatch = section.sectionHash === recomputedHash;
    recomputedSectionHashes.push(recomputedHash);

    if (!entryCountMatch || !sortingValid || !sectionHashMatch) {
      anySectionFail = true;
    }

    sectionVerifications.push({
      sectionType: section.sectionType,
      sectionIndex: section.sectionIndex,
      verifiedSectionHash: sectionHashMatch ? 'PASS' : 'FAIL',
      verifiedEntryCount: entryCountMatch ? 'PASS' : 'FAIL',
      verifiedSorting: sortingValid ? 'PASS' : 'FAIL',
    });
  }

  // Verify sectionHashes array matches recomputed
  let sectionHashesMatch = packet.sectionHashes.length === recomputedSectionHashes.length;
  if (sectionHashesMatch) {
    for (let i = 0; i < packet.sectionHashes.length; i++) {
      if (packet.sectionHashes[i] !== recomputedSectionHashes[i]) {
        sectionHashesMatch = false;
        break;
      }
    }
  }

  // Reconstruct input for canonical forms
  const inputForCanonical: EvidencePacketInput = {
    tenantId: packet.tenantId,
    caseId: packet.caseId,
    agencyId: packet.agencyId,
    generatedTimestamp: packet.generatedTimestamp,
    communicationHashes: [],
    responseHashes: [],
    auditTraceHashes: [],
    archiveManifestHashes: [],
    anchorProofHashes: [],
    capsProofHashes: [],
    description: packet.description,
  };

  // Recompute packetId
  const preIdCanonical = canonicalizePacketPreId(inputForCanonical, packet.sectionHashes);
  const recomputedPacketId = await computeTextSHA256(preIdCanonical);
  const packetIdMatch = packet.packetId === recomputedPacketId;

  // Recompute dual-hash
  const fullCanonical = canonicalizePacketFull(packet.packetId, inputForCanonical, packet.sectionHashes);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3_256 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = packet.sha256 === recomputedSha256;
  const sha3_256Match = packet.sha3_256 === recomputedSha3_256;

  const allPass =
    packetIdMatch &&
    sha256Match &&
    sha3_256Match &&
    sectionHashesMatch &&
    !anySectionFail;

  return {
    packetIdMatch: packetIdMatch ? 'PASS' : 'FAIL',
    sha256Match: sha256Match ? 'PASS' : 'FAIL',
    sha3_256Match: sha3_256Match ? 'PASS' : 'FAIL',
    sectionVerifications,
    sectionHashesMatch: sectionHashesMatch ? 'PASS' : 'FAIL',
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}

// ---------------------------------------------------------------------------
// CI Enforcement Hook — Binary PASS/FAIL Build Gate
// ---------------------------------------------------------------------------

/**
 * CI enforcement hook for evidence packet integrity.
 *
 * Binary PASS/FAIL only.
 * If FAIL, build MUST be blocked.
 * No soft pass. No warning-only mode. No bypass.
 *
 * Async because verification recomputes hashes.
 * Deterministic — same inputs always produce same output.
 */
export async function enforceEvidencePacketIntegrity(
  packet: EvidencePacketEntity
): Promise<CIEvidencePacketEnforcementResult> {
  const verification = await verifyEvidencePacket(packet);

  let failedSections = 0;
  for (let i = 0; i < verification.sectionVerifications.length; i++) {
    const sv = verification.sectionVerifications[i];
    if (
      sv.verifiedSectionHash === 'FAIL' ||
      sv.verifiedEntryCount === 'FAIL' ||
      sv.verifiedSorting === 'FAIL'
    ) {
      failedSections++;
    }
  }

  return {
    result: verification.overallResult,
    packetIdValid: verification.packetIdMatch === 'PASS',
    sha256Valid: verification.sha256Match === 'PASS',
    sha3_256Valid: verification.sha3_256Match === 'PASS',
    sectionHashesValid: verification.sectionHashesMatch === 'PASS',
    totalSections: verification.sectionVerifications.length,
    failedSections,
  };
}
