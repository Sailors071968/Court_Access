// ============================================
// Court Access — Issue Index Engine (Phase 4)
// Structured Issue Index Engine (CALCRIM Layer)
//
// Mechanically maps charges to statutory elements
// and structured evidence references.
// No UI dependencies. No React imports.
//
// Constitutional boundaries (Phase 5 — Structured Element Mapping):
//   - No strength scores
//   - No probabilities
//   - No element ranking
//   - No intent inference
//   - No strategy recommendations
//   - No outcome predictions
//   - Binary structural mapping only
// ============================================

import type {
  ChargeElementEntity,
  ElementStatus,
  StructuredIssueIndexResult,
  IssueIndexInput,
  ElementInput,
} from '../models/ChargeElementModel';
import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

// ---------------------------------------------------------------------------
// Status determination — explicit structural conditions
// ---------------------------------------------------------------------------

/**
 * Determine element status from structural conditions.
 *
 * Rules (deterministic, no interpretation):
 *   1. If no supporting citations AND no conflicting citations → NotFound
 *   2. If conflicting citations exist → Disputed
 *   3. If supporting citations exist but are incomplete
 *      (supporting exists AND at least one document reference is missing) → Unclear
 *   4. If at least one supporting citation exists AND no conflicts → Established
 *
 * "Incomplete" is defined as:
 *   - supportingCitationReferences is non-empty BUT supportingDocumentIds is empty
 *   - This means citations reference elements but no source documents back them
 *
 * This is placeholder logic per Phase 4 directive.
 * No confidence levels. No strength percentages.
 * No likelihood. No risk ratings.
 *
 * This is a pure function — same input always produces same output.
 */
export function determineElementStatus(input: ElementInput): ElementStatus {
  const hasSupportingCitations = input.supportingCitationReferences.length > 0;
  const hasSupportingDocuments = input.supportingDocumentIds.length > 0;
  const hasConflictingCitations = input.conflictingCitationReferences.length > 0;

  // Rule 1: No citations at all → NotFound
  if (!hasSupportingCitations && !hasConflictingCitations) {
    return 'NotFound';
  }

  // Rule 2: Conflicting citations → Disputed
  if (hasConflictingCitations) {
    return 'Disputed';
  }

  // Rule 3: Citations exist but no documents back them → Unclear
  if (hasSupportingCitations && !hasSupportingDocuments) {
    return 'Unclear';
  }

  // Rule 4: Supporting citations with document backing → Established
  return 'Established';
}

// ---------------------------------------------------------------------------
// Canonical JSON serialization — fixed key order
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for a ChargeElementEntity.
 * Key order is FIXED and DOCUMENTED:
 *   1. "tenantId"
 *   2. "caseId"
 *   3. "chargeId"
 *   4. "elementNumber"
 *   5. "elementDescription"
 *   6. "status"
 *   7. "supportingDocumentIds" (sorted)
 *   8. "supportingCitationReferences" (sorted)
 *
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 * Uses JSON.stringify on individual values for RFC 8259 escaping.
 *
 * This is a pure function — same input always produces same output.
 */
function canonicalizeElement(
  tenantId: string,
  caseId: string,
  chargeId: string,
  elementNumber: number,
  elementDescription: string,
  status: ElementStatus,
  sortedDocumentIds: string[],
  sortedCitationReferences: string[]
): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(tenantId)},` +
    `"caseId":${JSON.stringify(caseId)},` +
    `"chargeId":${JSON.stringify(chargeId)},` +
    `"elementNumber":${JSON.stringify(elementNumber)},` +
    `"elementDescription":${JSON.stringify(elementDescription)},` +
    `"status":${JSON.stringify(status)},` +
    `"supportingDocumentIds":${JSON.stringify(sortedDocumentIds)},` +
    `"supportingCitationReferences":${JSON.stringify(sortedCitationReferences)}` +
    '}'
  );
}

/**
 * Canonical JSON serialization for a StructuredIssueIndexResult.
 * Key order is FIXED and DOCUMENTED:
 *   1. "chargeId"
 *   2. "elements" — array of canonical element JSON (sorted by elementNumber)
 *
 * Each element within the array uses its own canonical serialization.
 * The array is constructed from pre-sorted elements.
 *
 * This is a pure function — same input always produces same output.
 */
function canonicalizeIssueIndex(
  chargeId: string,
  canonicalElements: string[]
): string {
  return (
    '{' +
    `"chargeId":${JSON.stringify(chargeId)},` +
    `"elements":[${canonicalElements.join(',')}]` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// ID generation — deterministic from identity fields ONLY
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic element ID from identity fields only.
 *
 * ID is derived from SHA-256 of canonical string:
 *   {"tenantId":"...","caseId":"...","chargeId":"...","elementNumber":N}
 *
 * Key order is FIXED: tenantId, caseId, chargeId, elementNumber.
 * Does NOT include: status, description, supporting references.
 *
 * Rationale: Element identity is determined by WHERE it exists
 * (tenant, case, charge, element number), not by WHAT it contains.
 * Content may change (status updates, new citations) without
 * changing the element's identity.
 *
 * This is a pure function — same input always produces same output.
 */
function canonicalizeElementIdentity(
  tenantId: string,
  caseId: string,
  chargeId: string,
  elementNumber: number
): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(tenantId)},` +
    `"caseId":${JSON.stringify(caseId)},` +
    `"chargeId":${JSON.stringify(chargeId)},` +
    `"elementNumber":${JSON.stringify(elementNumber)}` +
    '}'
  );
}

/**
 * Derive a deterministic element ID from identity fields.
 * Computes SHA-256 of canonical identity JSON, then extracts 16 hex chars.
 *
 * This is a pure function — same input always produces same output.
 */
async function deriveElementId(
  tenantId: string,
  caseId: string,
  chargeId: string,
  elementNumber: number
): Promise<string> {
  const canonical = canonicalizeElementIdentity(tenantId, caseId, chargeId, elementNumber);
  const hash = await computeTextSHA256(canonical);
  return hash.slice(0, 16);
}


// ---------------------------------------------------------------------------
// Issue Index Construction Pipeline
// ---------------------------------------------------------------------------

/**
 * Construct a structured issue index for a charge.
 *
 * Pipeline:
 *   1. Sort elements by elementNumber (ascending)
 *   2. For each element:
 *      a. Sort supportingDocumentIds (ascending lexicographic)
 *      b. Sort supportingCitationReferences (ascending lexicographic)
 *      c. Determine status from structural conditions
 *      d. Canonicalize element to JSON
 *      e. Dual-hash canonical JSON (for content integrity)
 *      f. Derive deterministic ID from identity fields (tenantId+caseId+chargeId+elementNumber)
 *      g. Build ChargeElementEntity
 *   3. Canonicalize full result to JSON
 *   4. Dual-hash canonical result JSON
 *   5. Return StructuredIssueIndexResult
 *
 * Constitutional constraints:
 *   - Element IDs derived from identity fields (tenantId+caseId+chargeId+elementNumber)
 *   - Result hashes derived from canonical JSON of full content
 *   - All arrays explicitly sorted before processing
 *   - No randomness. No Date.now(). No non-deterministic branching.
 *   - Status determined by structural conditions only (no interpretation)
 */
export async function buildIssueIndex(
  input: IssueIndexInput
): Promise<StructuredIssueIndexResult> {
  // Step 1: Sort elements by elementNumber (ascending)
  const sortedInputs = [...input.elements].sort(
    (a, b) => a.elementNumber - b.elementNumber
  );

  // Step 2: Process each element
  const entities: ChargeElementEntity[] = [];
  const canonicalElements: string[] = [];

  for (const elementInput of sortedInputs) {
    // Step 2a: Sort supporting arrays (ascending lexicographic)
    const sortedDocumentIds = [...elementInput.supportingDocumentIds].sort(
      (a, b) => a.localeCompare(b)
    );
    const sortedCitationRefs = [...elementInput.supportingCitationReferences].sort(
      (a, b) => a.localeCompare(b)
    );

    // Step 2b: Determine status from structural conditions
    const status = determineElementStatus(elementInput);

    // Step 2c: Canonicalize element to JSON
    const canonical = canonicalizeElement(
      input.tenantId,
      input.caseId,
      input.chargeId,
      elementInput.elementNumber,
      elementInput.elementDescription,
      status,
      sortedDocumentIds,
      sortedCitationRefs
    );

    // Step 2d: Dual-hash canonical JSON
    const contentHash = await computeTextSHA256(canonical);
    const sha3Hash = computeTextSHA3_256(canonical);

    // Step 2e: Derive deterministic ID from identity fields ONLY
    const id = await deriveElementId(
      input.tenantId,
      input.caseId,
      input.chargeId,
      elementInput.elementNumber
    );

    // Step 2f: Build entity
    entities.push({
      id,
      tenantId: input.tenantId,
      caseId: input.caseId,
      chargeId: input.chargeId,
      elementNumber: elementInput.elementNumber,
      elementDescription: elementInput.elementDescription,
      status,
      supportingDocumentIds: sortedDocumentIds,
      supportingCitationReferences: sortedCitationRefs,
      contentHash,
      sha3Hash,
    });

    canonicalElements.push(canonical);
  }

  // Step 3: Canonicalize full result
  const resultCanonical = canonicalizeIssueIndex(input.chargeId, canonicalElements);

  // Step 4: Dual-hash canonical result
  const resultContentHash = await computeTextSHA256(resultCanonical);
  const resultSha3Hash = computeTextSHA3_256(resultCanonical);

  // Step 5: Return result
  return {
    chargeId: input.chargeId,
    elements: entities,
    integrityVerified: false,
    resultContentHash,
    resultSha3Hash,
  };
}

// ---------------------------------------------------------------------------
// Integrity verification for issue index
// ---------------------------------------------------------------------------

/**
 * Verify the integrity of a StructuredIssueIndexResult.
 *
 * Re-computes the canonical JSON serialization from the elements,
 * then re-hashes and compares to stored result hashes.
 *
 * Returns true ONLY if BOTH hashes match.
 * Does NOT auto-correct hashes.
 *
 * This is a pure function — same input always produces same output.
 */
export async function verifyIssueIndexIntegrity(
  result: StructuredIssueIndexResult
): Promise<{ verified: boolean; computedSha256: string; computedSha3: string }> {
  // Re-canonicalize each element
  const canonicalElements: string[] = [];
  for (const element of result.elements) {
    const canonical = canonicalizeElement(
      element.tenantId,
      element.caseId,
      element.chargeId,
      element.elementNumber,
      element.elementDescription,
      element.status,
      element.supportingDocumentIds,
      element.supportingCitationReferences
    );
    canonicalElements.push(canonical);
  }

  // Re-canonicalize the full result
  const resultCanonical = canonicalizeIssueIndex(result.chargeId, canonicalElements);

  // Re-hash
  const computedSha256 = await computeTextSHA256(resultCanonical);
  const computedSha3 = computeTextSHA3_256(resultCanonical);

  return {
    verified: computedSha256 === result.resultContentHash && computedSha3 === result.resultSha3Hash,
    computedSha256,
    computedSha3,
  };
}
