// ============================================
// Court Access — Court Packet Export Engine (Phase 6)
// Structured Court Packet Export Engine (CAPS-Ready)
//
// Produces deterministic, court-ready export artifacts containing:
//   - Structured Issue Index
//   - Policy Deviation Records
//   - Officer Structural Indexes (if requested)
//   - Document references
//   - Dual-hashes
//   - Scope declaration
//   - Anchor epoch
//   - Immutable core hash reference
//   - Non-interpretive declaration
//
// No UI dependencies. No React imports.
//
// Constitutional boundaries:
//   - No narrative
//   - No recommendations
//   - No interpretation
//   - No scoring
//   - No ranking
//   - No probability
//   - No intent inference
//   - No strategy recommendations
//   - Structural export only
// ============================================

import type { StructuredIssueIndexResult } from '../models/ChargeElementModel';
import type { ChargeElementEntity } from '../models/ChargeElementModel';
import type { DeviationRecord } from '../models/PolicyModel';
import type { OfficerStructuralIndexEntity } from '../models/OfficerIndexModel';
import type { DocumentEntity } from '../models/DocumentModel';
import type {
  CourtPacketExport,
  CAPSBinding,
  CAPSBoundExport,
  CourtPacketExportInput,
  ExportDocumentReference,
  ExportVerificationResult,
} from '../models/ExportModel';
import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';
import { IMMUTABLE_CORE_HASH } from '../constants/immutableCore';

// ---------------------------------------------------------------------------
// Document reference extraction — export-safe subset
// ---------------------------------------------------------------------------

/**
 * Extract export-safe document reference from a DocumentEntity.
 * Strips internal processing state (storagePath, extractedText, etc.).
 *
 * This is a pure function — same input always produces same output.
 */
function toExportDocumentReference(doc: DocumentEntity): ExportDocumentReference {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    caseId: doc.caseId,
    name: doc.name,
    type: doc.type,
    filedDate: doc.filedDate,
    pages: doc.pages,
    contentHash: doc.contentHash,
    sha3Hash: doc.sha3Hash,
  };
}

// ---------------------------------------------------------------------------
// Canonical JSON serialization — fixed key order (explicit string construction)
// ---------------------------------------------------------------------------

/**
 * Canonicalize a single ChargeElementEntity for export.
 * Key order: id, tenantId, caseId, chargeId, elementNumber, elementDescription,
 *            status, supportingDocumentIds, supportingCitationReferences,
 *            contentHash, sha3Hash
 */
function canonicalizeExportElement(e: ChargeElementEntity): string {
  return (
    '{' +
    `"id":${JSON.stringify(e.id)},` +
    `"tenantId":${JSON.stringify(e.tenantId)},` +
    `"caseId":${JSON.stringify(e.caseId)},` +
    `"chargeId":${JSON.stringify(e.chargeId)},` +
    `"elementNumber":${JSON.stringify(e.elementNumber)},` +
    `"elementDescription":${JSON.stringify(e.elementDescription)},` +
    `"status":${JSON.stringify(e.status)},` +
    `"supportingDocumentIds":${JSON.stringify(e.supportingDocumentIds)},` +
    `"supportingCitationReferences":${JSON.stringify(e.supportingCitationReferences)},` +
    `"contentHash":${JSON.stringify(e.contentHash)},` +
    `"sha3Hash":${JSON.stringify(e.sha3Hash)}` +
    '}'
  );
}

/**
 * Canonicalize a StructuredIssueIndexResult for export.
 * Key order: chargeId, elements, integrityVerified, resultContentHash, resultSha3Hash
 * Elements sorted by elementNumber ascending.
 */
function canonicalizeExportIssueIndex(idx: StructuredIssueIndexResult): string {
  // Sort elements by elementNumber ascending (deterministic)
  const sortedElements = [...idx.elements].sort(
    (a, b) => a.elementNumber - b.elementNumber
  );
  const elementsJson = sortedElements.map(canonicalizeExportElement);

  return (
    '{' +
    `"chargeId":${JSON.stringify(idx.chargeId)},` +
    `"elements":[${elementsJson.join(',')}],` +
    `"integrityVerified":${JSON.stringify(idx.integrityVerified)},` +
    `"resultContentHash":${JSON.stringify(idx.resultContentHash)},` +
    `"resultSha3Hash":${JSON.stringify(idx.resultSha3Hash)}` +
    '}'
  );
}

/**
 * Canonicalize a DeviationRecord for export.
 * Key order: id, tenantId, caseId, documentId, policyChunkId,
 *            policyReference, reportReference, deviationDetected,
 *            comparisonHash, comparisonSha3Hash,
 *            normalizedPolicyText, normalizedReportText,
 *            comparedAt, integrityVerified
 */
function canonicalizeExportDeviation(d: DeviationRecord): string {
  return (
    '{' +
    `"id":${JSON.stringify(d.id)},` +
    `"tenantId":${JSON.stringify(d.tenantId)},` +
    `"caseId":${JSON.stringify(d.caseId)},` +
    `"documentId":${JSON.stringify(d.documentId)},` +
    `"policyChunkId":${JSON.stringify(d.policyChunkId)},` +
    `"policyReference":${JSON.stringify(d.policyReference)},` +
    `"reportReference":${JSON.stringify(d.reportReference)},` +
    `"deviationDetected":${JSON.stringify(d.deviationDetected)},` +
    `"comparisonHash":${JSON.stringify(d.comparisonHash)},` +
    `"comparisonSha3Hash":${JSON.stringify(d.comparisonSha3Hash)},` +
    `"normalizedPolicyText":${JSON.stringify(d.normalizedPolicyText)},` +
    `"normalizedReportText":${JSON.stringify(d.normalizedReportText)},` +
    `"comparedAt":${JSON.stringify(d.comparedAt)},` +
    `"integrityVerified":${JSON.stringify(d.integrityVerified)}` +
    '}'
  );
}

/**
 * Canonicalize an OfficerStructuralIndexEntity for export.
 * Key order: id, tenantId, officerIdentifier, documentCount,
 *            phraseFrequency (sorted keys), firstSeen, lastSeen,
 *            contentHash, sha3Hash
 */
function canonicalizeExportOfficerIndex(o: OfficerStructuralIndexEntity): string {
  // Sort phrase keys via deterministic ASCII comparator
  const sortedPhraseKeys = Object.keys(o.phraseFrequency).sort(
    (a, b) => a < b ? -1 : a > b ? 1 : 0
  );
  const phraseEntries = sortedPhraseKeys.map(
    (key) => `${JSON.stringify(key)}:${JSON.stringify(o.phraseFrequency[key])}`
  );
  const phraseJson = `{${phraseEntries.join(',')}}`;

  return (
    '{' +
    `"id":${JSON.stringify(o.id)},` +
    `"tenantId":${JSON.stringify(o.tenantId)},` +
    `"officerIdentifier":${JSON.stringify(o.officerIdentifier)},` +
    `"documentCount":${JSON.stringify(o.documentCount)},` +
    `"phraseFrequency":${phraseJson},` +
    `"firstSeen":${JSON.stringify(o.firstSeen)},` +
    `"lastSeen":${JSON.stringify(o.lastSeen)},` +
    `"contentHash":${JSON.stringify(o.contentHash)},` +
    `"sha3Hash":${JSON.stringify(o.sha3Hash)}` +
    '}'
  );
}

/**
 * Canonicalize an ExportDocumentReference for export.
 * Key order: id, tenantId, caseId, name, type, filedDate, pages,
 *            contentHash, sha3Hash
 */
function canonicalizeExportDocumentRef(d: ExportDocumentReference): string {
  return (
    '{' +
    `"id":${JSON.stringify(d.id)},` +
    `"tenantId":${JSON.stringify(d.tenantId)},` +
    `"caseId":${JSON.stringify(d.caseId)},` +
    `"name":${JSON.stringify(d.name)},` +
    `"type":${JSON.stringify(d.type)},` +
    `"filedDate":${JSON.stringify(d.filedDate)},` +
    `"pages":${JSON.stringify(d.pages)},` +
    `"contentHash":${JSON.stringify(d.contentHash)},` +
    `"sha3Hash":${JSON.stringify(d.sha3Hash)}` +
    '}'
  );
}

/**
 * Canonicalize the full CourtPacketExport to JSON.
 *
 * Key order is FIXED and matches the directive exactly:
 *   1. "version"
 *   2. "tenantId"
 *   3. "caseId"
 *   4. "structuredIssueIndex"
 *   5. "policyDeviationRecords"
 *   6. "officerStructuralIndexes"
 *   7. "documentReferences"
 *   8. "scopeHash"
 *   9. "immutableCoreHash"
 *  10. "anchorEpoch"
 *  11. "nonInterpretiveDeclaration"
 *
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 *
 * All arrays are pre-sorted before canonicalization.
 *
 * This is a pure function — same input always produces same output.
 */
function canonicalizeCourtPacketExport(
  version: string,
  tenantId: string,
  caseId: string,
  sortedIssueIndexes: StructuredIssueIndexResult[],
  sortedDeviationRecords: DeviationRecord[],
  sortedOfficerIndexes: OfficerStructuralIndexEntity[],
  sortedDocumentRefs: ExportDocumentReference[],
  scopeHash: string,
  immutableCoreHash: string,
  anchorEpoch: number
): string {
  const issueIndexJson = sortedIssueIndexes.map(canonicalizeExportIssueIndex);
  const deviationJson = sortedDeviationRecords.map(canonicalizeExportDeviation);
  const officerJson = sortedOfficerIndexes.map(canonicalizeExportOfficerIndex);
  const docRefJson = sortedDocumentRefs.map(canonicalizeExportDocumentRef);

  return (
    '{' +
    `"version":${JSON.stringify(version)},` +
    `"tenantId":${JSON.stringify(tenantId)},` +
    `"caseId":${JSON.stringify(caseId)},` +
    `"structuredIssueIndex":[${issueIndexJson.join(',')}],` +
    `"policyDeviationRecords":[${deviationJson.join(',')}],` +
    `"officerStructuralIndexes":[${officerJson.join(',')}],` +
    `"documentReferences":[${docRefJson.join(',')}],` +
    `"scopeHash":${JSON.stringify(scopeHash)},` +
    `"immutableCoreHash":${JSON.stringify(immutableCoreHash)},` +
    `"anchorEpoch":${JSON.stringify(anchorEpoch)},` +
    `"nonInterpretiveDeclaration":true` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Court Packet Export Construction Pipeline
// ---------------------------------------------------------------------------

/**
 * Build a CAPS-bound court packet export.
 *
 * Pipeline:
 *   1. Sort all arrays deterministically
 *   2. Extract export-safe document references
 *   3. Build canonical JSON (without scopeHash and immutableCoreHash — placeholder first pass)
 *   4. Compute dual-hash of canonical JSON
 *   5. Rebuild canonical JSON with real hashes
 *   6. Re-compute dual-hash of final canonical JSON (self-referencing)
 *   7. Build CourtPacketExport entity
 *   8. Build CAPSBinding
 *   9. Return CAPSBoundExport
 *
 * Constitutional constraints:
 *   - All arrays sorted before export (deterministic ASCII comparator)
 *   - No Date.now(). No runtime timestamps. No random UUIDs.
 *   - No object serialization without canonicalization.
 *   - Explicit string construction for canonical JSON.
 *   - No narrative. No recommendations. No interpretation.
 */
export async function buildCourtPacketExport(
  input: CourtPacketExportInput
): Promise<CAPSBoundExport> {
  // Step 1: Sort all arrays deterministically

  // Issue indexes sorted by chargeId (deterministic ASCII comparator)
  const sortedIssueIndexes = [...input.structuredIssueIndex].sort(
    (a, b) => a.chargeId < b.chargeId ? -1 : a.chargeId > b.chargeId ? 1 : 0
  );

  // Deviation records sorted by id (deterministic ASCII comparator)
  const sortedDeviationRecords = [...input.policyDeviationRecords].sort(
    (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );

  // Officer indexes sorted by officerIdentifier (deterministic ASCII comparator)
  const sortedOfficerIndexes = [...input.officerStructuralIndexes].sort(
    (a, b) => a.officerIdentifier < b.officerIdentifier ? -1 : a.officerIdentifier > b.officerIdentifier ? 1 : 0
  );

  // Step 2: Extract and sort document references
  const documentRefs = input.documents.map(toExportDocumentReference);
  const sortedDocumentRefs = documentRefs.sort(
    (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );

  // Step 3: immutableCoreHash sourced from static constant (not computed from payload)
  const immutableCoreHash = IMMUTABLE_CORE_HASH;

  // Step 4: Build canonical JSON with immutableCoreHash but empty scopeHash to compute scope
  const firstPassCanonical = canonicalizeCourtPacketExport(
    '1.0',
    input.tenantId,
    input.caseId,
    sortedIssueIndexes,
    sortedDeviationRecords,
    sortedOfficerIndexes,
    sortedDocumentRefs,
    '',  // scopeHash placeholder
    immutableCoreHash,
    input.anchorEpoch
  );

  // Step 5: Compute scopeHash from first pass canonical JSON
  const scopeHash = await computeTextSHA256(firstPassCanonical);

  // Step 6: Rebuild canonical JSON with real scopeHash
  const finalCanonical = canonicalizeCourtPacketExport(
    '1.0',
    input.tenantId,
    input.caseId,
    sortedIssueIndexes,
    sortedDeviationRecords,
    sortedOfficerIndexes,
    sortedDocumentRefs,
    scopeHash,
    immutableCoreHash,
    input.anchorEpoch
  );

  // Step 7: Compute dual-hash of final canonical JSON (for CAPS binding)
  const capsSha256 = await computeTextSHA256(finalCanonical);
  const capsSha3 = computeTextSHA3_256(finalCanonical);

  // Step 8: Build CourtPacketExport entity
  const exportArtifact: CourtPacketExport = {
    version: '1.0',
    tenantId: input.tenantId,
    caseId: input.caseId,
    structuredIssueIndex: sortedIssueIndexes,
    policyDeviationRecords: sortedDeviationRecords,
    officerStructuralIndexes: sortedOfficerIndexes,
    documentReferences: sortedDocumentRefs,
    scopeHash,
    immutableCoreHash,
    anchorEpoch: input.anchorEpoch,
    nonInterpretiveDeclaration: true,
  };

  // Step 9: Build CAPSBinding
  const caps: CAPSBinding = {
    sha256: capsSha256,
    sha3_256: capsSha3,
    scopeHash,
    nonInterpretiveDeclaration: true,
    anchorEpoch: input.anchorEpoch,
  };

  // Step 10: Return CAPSBoundExport
  return {
    export: exportArtifact,
    caps,
  };
}

// ---------------------------------------------------------------------------
// Export Integrity Verification
// ---------------------------------------------------------------------------

/**
 * Verify the integrity of a court packet export.
 *
 * Re-computes the canonical JSON serialization from the export entity,
 * then re-hashes and compares to the CAPS binding hashes.
 *
 * Returns verified: true ONLY if BOTH hashes match.
 * Does NOT auto-correct hashes. Never modifies the entity.
 *
 * This is a pure function — same input always produces same output.
 */
export async function verifyExportIntegrity(
  bound: CAPSBoundExport
): Promise<ExportVerificationResult> {
  const exp = bound.export;

  // Sort arrays in the same deterministic order as construction

  const sortedIssueIndexes = [...exp.structuredIssueIndex].sort(
    (a, b) => a.chargeId < b.chargeId ? -1 : a.chargeId > b.chargeId ? 1 : 0
  );

  const sortedDeviationRecords = [...exp.policyDeviationRecords].sort(
    (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );

  const sortedOfficerIndexes = [...exp.officerStructuralIndexes].sort(
    (a, b) => a.officerIdentifier < b.officerIdentifier ? -1 : a.officerIdentifier > b.officerIdentifier ? 1 : 0
  );

  const sortedDocumentRefs = [...exp.documentReferences].sort(
    (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );

  // Rebuild canonical JSON
  const canonical = canonicalizeCourtPacketExport(
    exp.version,
    exp.tenantId,
    exp.caseId,
    sortedIssueIndexes,
    sortedDeviationRecords,
    sortedOfficerIndexes,
    sortedDocumentRefs,
    exp.scopeHash,
    exp.immutableCoreHash,
    exp.anchorEpoch
  );

  // Re-hash
  const computedSha256 = await computeTextSHA256(canonical);
  const computedSha3 = computeTextSHA3_256(canonical);

  return {
    verified: computedSha256 === bound.caps.sha256 && computedSha3 === bound.caps.sha3_256,
    computedSha256,
    computedSha3,
  };
}

// ---------------------------------------------------------------------------
// Deterministic PDF Export (minimal layout)
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic plain-text representation of the court packet.
 * This serves as the basis for a minimal PDF export.
 *
 * Layout is intentionally minimal — determinism is the priority, not styling.
 * No narrative. No recommendations. No interpretation.
 *
 * The output is a deterministic string — same input always produces same output.
 */
export function generateExportPlainText(
  bound: CAPSBoundExport
): string {
  const exp = bound.export;
  const lines: string[] = [];

  // Header
  lines.push('========================================');
  lines.push('COURT ACCESS — STRUCTURED COURT PACKET');
  lines.push('========================================');
  lines.push('');
  lines.push('NON-INTERPRETIVE DECLARATION: This document contains');
  lines.push('structural data only. No narrative, recommendations,');
  lines.push('interpretation, scoring, ranking, or probability');
  lines.push('assessments are included.');
  lines.push('');
  lines.push(`Version: ${exp.version}`);
  lines.push(`Tenant ID: ${exp.tenantId}`);
  lines.push(`Case ID: ${exp.caseId}`);
  lines.push(`Anchor Epoch: ${exp.anchorEpoch}`);
  lines.push('');

  // Structured Issue Index
  lines.push('----------------------------------------');
  lines.push('STRUCTURED ISSUE INDEX');
  lines.push('----------------------------------------');

  // Sort by chargeId for deterministic output
  const sortedIndexes = [...exp.structuredIssueIndex].sort(
    (a, b) => a.chargeId < b.chargeId ? -1 : a.chargeId > b.chargeId ? 1 : 0
  );

  for (const idx of sortedIndexes) {
    lines.push('');
    lines.push(`Charge ID: ${idx.chargeId}`);
    lines.push(`Result Content Hash: ${idx.resultContentHash}`);
    lines.push(`Result SHA3 Hash: ${idx.resultSha3Hash}`);

    // Sort elements by elementNumber
    const sortedElements = [...idx.elements].sort(
      (a, b) => a.elementNumber - b.elementNumber
    );

    for (const elem of sortedElements) {
      lines.push(`  Element ${elem.elementNumber}: ${elem.elementDescription}`);
      lines.push(`    Status: ${elem.status}`);
      lines.push(`    Supporting Documents: ${elem.supportingDocumentIds.join(', ') || '(none)'}`);
      lines.push(`    Supporting Citations: ${elem.supportingCitationReferences.join(', ') || '(none)'}`);
      lines.push(`    Content Hash: ${elem.contentHash}`);
    }
  }

  // Policy Deviation Records
  lines.push('');
  lines.push('----------------------------------------');
  lines.push('POLICY DEVIATION RECORDS');
  lines.push('----------------------------------------');

  // Sort by id for deterministic output
  const sortedDeviations = [...exp.policyDeviationRecords].sort(
    (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );

  for (const dev of sortedDeviations) {
    lines.push('');
    lines.push(`Record ID: ${dev.id}`);
    lines.push(`Policy Reference: ${dev.policyReference}`);
    lines.push(`Report Reference: ${dev.reportReference}`);
    lines.push(`Deviation Detected: ${dev.deviationDetected}`);
    lines.push(`Comparison Hash: ${dev.comparisonHash}`);
  }

  // Officer Structural Indexes
  if (exp.officerStructuralIndexes.length > 0) {
    lines.push('');
    lines.push('----------------------------------------');
    lines.push('OFFICER STRUCTURAL INDEXES');
    lines.push('----------------------------------------');

    // Sort by officerIdentifier for deterministic output
    const sortedOfficers = [...exp.officerStructuralIndexes].sort(
      (a, b) => a.officerIdentifier < b.officerIdentifier ? -1 : a.officerIdentifier > b.officerIdentifier ? 1 : 0
    );

    for (const off of sortedOfficers) {
      lines.push('');
      lines.push(`Officer: ${off.officerIdentifier}`);
      lines.push(`Document Count: ${off.documentCount}`);
      lines.push(`First Seen: ${off.firstSeen}`);
      lines.push(`Last Seen: ${off.lastSeen}`);

      // Sort phrase keys via deterministic ASCII comparator
      const sortedPhraseKeys = Object.keys(off.phraseFrequency).sort(
        (a, b) => a < b ? -1 : a > b ? 1 : 0
      );
      if (sortedPhraseKeys.length > 0) {
        lines.push('  Phrase Frequency:');
        for (const key of sortedPhraseKeys) {
          lines.push(`    "${key}": ${off.phraseFrequency[key]}`);
        }
      }
      lines.push(`Content Hash: ${off.contentHash}`);
    }
  }

  // Document References
  lines.push('');
  lines.push('----------------------------------------');
  lines.push('DOCUMENT REFERENCES');
  lines.push('----------------------------------------');

  // Sort by id for deterministic output
  const sortedDocs = [...exp.documentReferences].sort(
    (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );

  for (const doc of sortedDocs) {
    lines.push('');
    lines.push(`Document ID: ${doc.id}`);
    lines.push(`Name: ${doc.name}`);
    lines.push(`Type: ${doc.type}`);
    lines.push(`Filed Date: ${doc.filedDate}`);
    lines.push(`Pages: ${doc.pages}`);
    lines.push(`Content Hash: ${doc.contentHash}`);
  }

  // CAPS Binding
  lines.push('');
  lines.push('----------------------------------------');
  lines.push('CRYPTOGRAPHIC AUDIT PROOF (CAPS)');
  lines.push('----------------------------------------');
  lines.push('');
  lines.push(`SHA-256: ${bound.caps.sha256}`);
  lines.push(`SHA3-256: ${bound.caps.sha3_256}`);
  lines.push(`Scope Hash: ${bound.caps.scopeHash}`);
  lines.push(`Anchor Epoch: ${bound.caps.anchorEpoch}`);
  lines.push(`Non-Interpretive Declaration: ${bound.caps.nonInterpretiveDeclaration}`);
  lines.push('');
  lines.push('========================================');
  lines.push('END OF COURT PACKET');
  lines.push('========================================');

  return lines.join('\n');
}
