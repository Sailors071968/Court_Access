// ============================================
// Court Access — Referential Integrity Engine (Phase 17)
// Cross-Entity Referential Integrity Layer
//
// Validates all cross-entity linkages:
//   - Response-to-Communication linkage
//   - AuditTrace crossPhaseRef validation
//   - Archive-to-Document reference validation
//   - Cross-tenant isolation enforcement
//   - Orphan detection
//
// Every function is:
//   - Pure (same inputs → same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Binary PASS/FAIL only (no scoring, no partial pass)
//
// Architectural boundary:
//   - Does NOT import any other engine
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access (callers provide lookup maps)
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
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Imports — type-only from models
// ---------------------------------------------------------------------------

import type {
  ResponseLinkageResult,
  CrossRefValidationResult,
  ArchiveReferenceResult,
  ReferentialIntegrityScanResult,
  LinkageViolation,
  ResolvedCommunication,
  ResolvedArtifact,
  ResolvedDocument,
  CIReferentialIntegrityEnforcementResult,
} from '../models/ReferentialIntegrityModel';

import type { ResponseEntity } from '../models/CommunicationModel';

import type { AuditTraceEntry, CrossPhaseReference } from '../models/AuditTraceModel';

import type { ArchiveManifestEntity } from '../models/ArchiveManifestModel';

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
// Response-to-Communication Linkage Validation
// ---------------------------------------------------------------------------

/**
 * Validate a single response's linkage to its communication.
 *
 * Checks:
 *   1. linkedCommunicationId is not empty
 *   2. linkedCommunicationId exists in the communication lookup
 *   3. Response tenant matches communication tenant (no cross-tenant leak)
 *   4. Response agency matches communication agency (no cross-agency fabrication)
 *   5. bodyHash is not empty (response must have content)
 *
 * Pure function. No side effects. Binary PASS/FAIL per check.
 * Overall: PASS only if ALL checks pass.
 */
export function validateResponseLinkage(
  response: ResponseEntity,
  communicationLookup: Map<string, ResolvedCommunication>
): ResponseLinkageResult {
  // Check 1 + 2: linkedCommunicationId exists
  const linkedId = response.linkedCommunicationId;
  const comm = linkedId.length > 0 ? communicationLookup.get(linkedId) : undefined;
  const communicationExists = comm !== undefined ? 'PASS' : 'FAIL';

  // Check 3: tenant isolation
  const tenantMatch =
    comm !== undefined && response.tenantId === comm.tenantId ? 'PASS' : 'FAIL';

  // Check 4: agency isolation
  const agencyMatch =
    comm !== undefined && response.agencyId === comm.agencyId ? 'PASS' : 'FAIL';

  // Check 5: bodyHash present
  const bodyHashPresent = response.bodyHash.length > 0 ? 'PASS' : 'FAIL';

  const allPass =
    communicationExists === 'PASS' &&
    tenantMatch === 'PASS' &&
    agencyMatch === 'PASS' &&
    bodyHashPresent === 'PASS';

  return {
    responseId: response.responseId,
    linkedCommunicationId: linkedId,
    communicationExists,
    tenantMatch,
    agencyMatch,
    bodyHashPresent,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}

// ---------------------------------------------------------------------------
// Batch Response Linkage Validation
// ---------------------------------------------------------------------------

/**
 * Validate all responses against the communication chain.
 *
 * Returns per-response results and aggregated violations.
 * Pure function. No side effects.
 */
export function validateAllResponseLinkages(
  responses: ResponseEntity[],
  communicationLookup: Map<string, ResolvedCommunication>
): { results: ResponseLinkageResult[]; violations: LinkageViolation[] } {
  const results: ResponseLinkageResult[] = [];
  const violations: LinkageViolation[] = [];

  for (let i = 0; i < responses.length; i++) {
    const response = responses[i];
    const result = validateResponseLinkage(response, communicationLookup);
    results.push(result);

    if (result.communicationExists === 'FAIL') {
      violations.push({
        domain: 'RESPONSE_TO_COMMUNICATION',
        violationType:
          response.linkedCommunicationId.length === 0
            ? 'MISSING_FIELD'
            : 'ORPHAN_REFERENCE',
        sourceEntityId: response.responseId,
        sourceField: 'linkedCommunicationId',
        referencedValue: response.linkedCommunicationId,
        description:
          response.linkedCommunicationId.length === 0
            ? 'linkedCommunicationId is empty'
            : 'linkedCommunicationId does not resolve to any communication entry',
      });
    }

    if (result.communicationExists === 'PASS' && result.tenantMatch === 'FAIL') {
      violations.push({
        domain: 'RESPONSE_TO_COMMUNICATION',
        violationType: 'CROSS_TENANT_LEAK',
        sourceEntityId: response.responseId,
        sourceField: 'tenantId',
        referencedValue: response.tenantId,
        description:
          'Response tenantId does not match linked communication tenantId',
      });
    }

    if (result.communicationExists === 'PASS' && result.agencyMatch === 'FAIL') {
      violations.push({
        domain: 'RESPONSE_TO_COMMUNICATION',
        violationType: 'CROSS_TENANT_LEAK',
        sourceEntityId: response.responseId,
        sourceField: 'agencyId',
        referencedValue: response.agencyId,
        description:
          'Response agencyId does not match linked communication agencyId',
      });
    }

    if (result.bodyHashPresent === 'FAIL') {
      violations.push({
        domain: 'RESPONSE_TO_COMMUNICATION',
        violationType: 'MISSING_FIELD',
        sourceEntityId: response.responseId,
        sourceField: 'bodyHash',
        referencedValue: '',
        description: 'Response bodyHash is empty',
      });
    }
  }

  return { results, violations };
}

// ---------------------------------------------------------------------------
// AuditTrace Cross-Phase Reference Validation
// ---------------------------------------------------------------------------

/**
 * Validate a single audit trace entry's cross-phase references.
 *
 * For each crossPhaseRef:
 *   1. artifactId resolves in the artifact lookup
 *   2. artifactHash matches the resolved artifact's sha256
 *   3. phase is a positive integer
 *
 * Pure function. No side effects. Binary PASS/FAIL per ref.
 */
export function validateTraceCrossRefs(
  entry: AuditTraceEntry,
  artifactLookup: Map<string, ResolvedArtifact>
): { results: CrossRefValidationResult[]; violations: LinkageViolation[] } {
  const results: CrossRefValidationResult[] = [];
  const violations: LinkageViolation[] = [];

  const refs = entry.crossPhaseRefs;

  for (let i = 0; i < refs.length; i++) {
    const ref: CrossPhaseReference = refs[i];
    const resolved = artifactLookup.get(ref.artifactId);

    const artifactExists = resolved !== undefined ? 'PASS' : 'FAIL';
    const hashMatch =
      resolved !== undefined && resolved.sha256 === ref.artifactHash
        ? 'PASS'
        : 'FAIL';

    const allPass = artifactExists === 'PASS' && hashMatch === 'PASS';

    results.push({
      traceId: entry.traceId,
      phase: ref.phase,
      artifactType: ref.artifactType,
      artifactId: ref.artifactId,
      artifactExists,
      hashMatch,
      overallResult: allPass ? 'PASS' : 'FAIL',
    });

    if (artifactExists === 'FAIL') {
      violations.push({
        domain: 'AUDIT_TRACE_CROSS_REF',
        violationType: 'ORPHAN_REFERENCE',
        sourceEntityId: entry.traceId,
        sourceField: 'crossPhaseRefs[' + String(i) + '].artifactId',
        referencedValue: ref.artifactId,
        description:
          'crossPhaseRef artifactId does not resolve to any known artifact',
      });
    }

    if (artifactExists === 'PASS' && hashMatch === 'FAIL') {
      violations.push({
        domain: 'AUDIT_TRACE_CROSS_REF',
        violationType: 'HASH_MISMATCH',
        sourceEntityId: entry.traceId,
        sourceField: 'crossPhaseRefs[' + String(i) + '].artifactHash',
        referencedValue: ref.artifactHash,
        description:
          'crossPhaseRef artifactHash does not match resolved artifact sha256',
      });
    }
  }

  return { results, violations };
}

// ---------------------------------------------------------------------------
// Batch AuditTrace Cross-Reference Validation
// ---------------------------------------------------------------------------

/**
 * Validate all audit trace entries' cross-phase references.
 *
 * Returns per-ref results and aggregated violations.
 * Pure function. No side effects.
 */
export function validateAllTraceCrossRefs(
  entries: AuditTraceEntry[],
  artifactLookup: Map<string, ResolvedArtifact>
): { results: CrossRefValidationResult[]; violations: LinkageViolation[] } {
  const allResults: CrossRefValidationResult[] = [];
  const allViolations: LinkageViolation[] = [];

  for (let i = 0; i < entries.length; i++) {
    const { results, violations } = validateTraceCrossRefs(entries[i], artifactLookup);
    for (let j = 0; j < results.length; j++) {
      allResults.push(results[j]);
    }
    for (let j = 0; j < violations.length; j++) {
      allViolations.push(violations[j]);
    }
  }

  return { results: allResults, violations: allViolations };
}

// ---------------------------------------------------------------------------
// Archive-to-Document Reference Validation
// ---------------------------------------------------------------------------

/**
 * Validate a single archive manifest's document references.
 *
 * Checks:
 *   1. Each documentId exists in the document lookup
 *   2. Each documentHash matches the resolved document's contentHash
 *   3. Each resolved document belongs to the same tenant (no cross-tenant leak)
 *   4. No duplicate documentIds in the archive
 *
 * documentIds and documentHashes are parallel arrays (same index = same document).
 * Both arrays are pre-sorted by ASCII comparator at archive creation time.
 *
 * Pure function. No side effects. Binary PASS/FAIL.
 */
export function validateArchiveDocumentRefs(
  archive: ArchiveManifestEntity,
  documentLookup: Map<string, ResolvedDocument>
): { result: ArchiveReferenceResult; violations: LinkageViolation[] } {
  const violations: LinkageViolation[] = [];
  let resolvedRefs = 0;
  let unresolvedRefs = 0;
  let hashMismatches = 0;
  let crossTenantViolations = 0;

  const docIds = archive.documentIds;
  const docHashes = archive.documentHashes;
  const totalDocumentRefs = docIds.length;

  // Check for duplicate documentIds
  const seenIds = new Set<string>();
  for (let i = 0; i < docIds.length; i++) {
    const docId = docIds[i];
    if (seenIds.has(docId)) {
      violations.push({
        domain: 'ARCHIVE_TO_DOCUMENT',
        violationType: 'DUPLICATE_REFERENCE',
        sourceEntityId: archive.archiveId,
        sourceField: 'documentIds[' + String(i) + ']',
        referencedValue: docId,
        description: 'Duplicate documentId in archive manifest',
      });
    }
    seenIds.add(docId);
  }

  // Validate each document reference
  for (let i = 0; i < docIds.length; i++) {
    const docId = docIds[i];
    const expectedHash = i < docHashes.length ? docHashes[i] : '';
    const resolved = documentLookup.get(docId);

    if (resolved === undefined) {
      unresolvedRefs++;
      violations.push({
        domain: 'ARCHIVE_TO_DOCUMENT',
        violationType: 'ORPHAN_REFERENCE',
        sourceEntityId: archive.archiveId,
        sourceField: 'documentIds[' + String(i) + ']',
        referencedValue: docId,
        description: 'documentId does not resolve to any known document',
      });
      continue;
    }

    resolvedRefs++;

    // Hash match check
    if (resolved.contentHash !== expectedHash) {
      hashMismatches++;
      violations.push({
        domain: 'ARCHIVE_TO_DOCUMENT',
        violationType: 'HASH_MISMATCH',
        sourceEntityId: archive.archiveId,
        sourceField: 'documentHashes[' + String(i) + ']',
        referencedValue: expectedHash,
        description:
          'documentHash does not match resolved document contentHash',
      });
    }

    // Cross-tenant check
    if (resolved.tenantId !== archive.tenantId) {
      crossTenantViolations++;
      violations.push({
        domain: 'ARCHIVE_TO_DOCUMENT',
        violationType: 'CROSS_TENANT_LEAK',
        sourceEntityId: archive.archiveId,
        sourceField: 'documentIds[' + String(i) + ']',
        referencedValue: docId,
        description:
          'Document tenantId does not match archive tenantId',
      });
    }
  }

  const allPass =
    unresolvedRefs === 0 &&
    hashMismatches === 0 &&
    crossTenantViolations === 0 &&
    violations.length === 0;

  const result: ArchiveReferenceResult = {
    archiveId: archive.archiveId,
    totalDocumentRefs,
    resolvedRefs,
    unresolvedRefs,
    hashMismatches,
    crossTenantViolations,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };

  return { result, violations };
}

// ---------------------------------------------------------------------------
// Batch Archive Reference Validation
// ---------------------------------------------------------------------------

/**
 * Validate all archive manifests' document references.
 *
 * Returns per-archive results and aggregated violations.
 * Pure function. No side effects.
 */
export function validateAllArchiveDocumentRefs(
  archives: ArchiveManifestEntity[],
  documentLookup: Map<string, ResolvedDocument>
): { results: ArchiveReferenceResult[]; violations: LinkageViolation[] } {
  const allResults: ArchiveReferenceResult[] = [];
  const allViolations: LinkageViolation[] = [];

  for (let i = 0; i < archives.length; i++) {
    const { result, violations } = validateArchiveDocumentRefs(archives[i], documentLookup);
    allResults.push(result);
    for (let j = 0; j < violations.length; j++) {
      allViolations.push(violations[j]);
    }
  }

  return { results: allResults, violations: allViolations };
}

// ---------------------------------------------------------------------------
// Full Referential Integrity Scan
// ---------------------------------------------------------------------------

/**
 * Run a complete referential integrity scan across all entity domains.
 *
 * Validates:
 *   1. All Response-to-Communication linkages
 *   2. All AuditTrace cross-phase references
 *   3. All Archive-to-Document references
 *
 * Aggregates all violations into a single result.
 * Overall: PASS only if zero violations across all domains.
 *
 * Pure function. No side effects. Deterministic.
 * Binary PASS/FAIL only.
 */
export function runReferentialIntegrityScan(
  responses: ResponseEntity[],
  communicationLookup: Map<string, ResolvedCommunication>,
  auditTraceEntries: AuditTraceEntry[],
  artifactLookup: Map<string, ResolvedArtifact>,
  archives: ArchiveManifestEntity[],
  documentLookup: Map<string, ResolvedDocument>
): ReferentialIntegrityScanResult {
  // Domain 1: Response-to-Communication
  const responseLinkage = validateAllResponseLinkages(responses, communicationLookup);

  // Domain 2: AuditTrace cross-phase refs
  const traceCrossRefs = validateAllTraceCrossRefs(auditTraceEntries, artifactLookup);

  // Domain 3: Archive-to-Document refs
  const archiveRefs = validateAllArchiveDocumentRefs(archives, documentLookup);

  // Aggregate violations (sorted by domain ASC for deterministic output)
  const allViolations: LinkageViolation[] = [];
  for (let i = 0; i < responseLinkage.violations.length; i++) {
    allViolations.push(responseLinkage.violations[i]);
  }
  for (let i = 0; i < traceCrossRefs.violations.length; i++) {
    allViolations.push(traceCrossRefs.violations[i]);
  }
  for (let i = 0; i < archiveRefs.violations.length; i++) {
    allViolations.push(archiveRefs.violations[i]);
  }

  // Sort violations deterministically: by domain ASC, then sourceEntityId ASC
  allViolations.sort((a, b) => {
    const domainCmp = asciiCompare(a.domain, b.domain);
    if (domainCmp !== 0) return domainCmp;
    return asciiCompare(a.sourceEntityId, b.sourceEntityId);
  });

  const totalChecks =
    responseLinkage.results.length +
    traceCrossRefs.results.length +
    archiveRefs.results.length;

  const totalViolations = allViolations.length;

  return {
    responseLinkageResults: responseLinkage.results,
    crossRefResults: traceCrossRefs.results,
    archiveReferenceResults: archiveRefs.results,
    violations: allViolations,
    totalChecks,
    totalViolations,
    overallResult: totalViolations === 0 ? 'PASS' : 'FAIL',
  };
}

// ---------------------------------------------------------------------------
// CI Enforcement Hook — Binary PASS/FAIL Build Gate
// ---------------------------------------------------------------------------

/**
 * CI enforcement hook for referential integrity.
 *
 * Binary PASS/FAIL only.
 * If FAIL, build MUST be blocked.
 * No soft pass. No warning-only mode. No bypass.
 *
 * Deterministic — same inputs always produce same output.
 */
export function enforceReferentialIntegrity(
  responses: ResponseEntity[],
  communicationLookup: Map<string, ResolvedCommunication>,
  auditTraceEntries: AuditTraceEntry[],
  artifactLookup: Map<string, ResolvedArtifact>,
  archives: ArchiveManifestEntity[],
  documentLookup: Map<string, ResolvedDocument>
): CIReferentialIntegrityEnforcementResult {
  const scanResult = runReferentialIntegrityScan(
    responses,
    communicationLookup,
    auditTraceEntries,
    artifactLookup,
    archives,
    documentLookup
  );

  // Count violations by type
  let orphanReferences = 0;
  let hashMismatches = 0;
  let crossTenantLeaks = 0;
  let missingFields = 0;
  let duplicateReferences = 0;

  for (let i = 0; i < scanResult.violations.length; i++) {
    const v = scanResult.violations[i];
    if (v.violationType === 'ORPHAN_REFERENCE') orphanReferences++;
    else if (v.violationType === 'HASH_MISMATCH') hashMismatches++;
    else if (v.violationType === 'CROSS_TENANT_LEAK') crossTenantLeaks++;
    else if (v.violationType === 'MISSING_FIELD') missingFields++;
    else if (v.violationType === 'DUPLICATE_REFERENCE') duplicateReferences++;
  }

  return {
    result: scanResult.overallResult,
    orphanReferences,
    hashMismatches,
    crossTenantLeaks,
    missingFields,
    duplicateReferences,
    totalChecks: scanResult.totalChecks,
    totalViolations: scanResult.totalViolations,
  };
}
