// ============================================
// Court Access — Tenant Isolation Engine (Phase 18)
// Tenant Isolation Verification Layer
//
// System-wide containment validator.
// Proves that no entity from Tenant A appears anywhere
// in Tenant B structures.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Binary PASS/FAIL only (no scoring, no partial pass)
//   - Containment-only (no hash recomputation, no crypto)
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Does NOT import anchorEngine
//   - Does NOT import archiveService
//   - Does NOT import communicationLedgerEngine
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access (callers provide entity arrays and lookup maps)
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
  TenantIsolationViolation,
  DomainIsolationResult,
  TenantIsolationScanResult,
  CITenantIsolationEnforcementResult,
} from '../models/TenantIsolationModel';

import type { CommunicationEntity, ResponseEntity } from '../models/CommunicationModel';

import type { AuditTraceEntry } from '../models/AuditTraceModel';

import type { ArchiveManifestEntity } from '../models/ArchiveManifestModel';

import type { ResolvedArtifact, ResolvedDocument } from '../models/ReferentialIntegrityModel';

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
// 1. Communication Isolation
// ---------------------------------------------------------------------------

/**
 * Verify every communication entity belongs to the expected tenant.
 *
 * Checks: communication.tenantId === tenantId for every entry.
 * Pure function. No side effects. Binary PASS/FAIL.
 */
export function checkCommunicationIsolation(
  tenantId: string,
  communications: CommunicationEntity[]
): { result: DomainIsolationResult; violations: TenantIsolationViolation[] } {
  const violations: TenantIsolationViolation[] = [];
  let foreignEntities = 0;

  for (let i = 0; i < communications.length; i++) {
    const comm = communications[i];
    if (comm.tenantId !== tenantId) {
      foreignEntities++;
      violations.push({
        violationType: 'FOREIGN_COMMUNICATION',
        entityId: comm.communicationId,
        entityTenantId: comm.tenantId,
        expectedTenantId: tenantId,
        description: 'Communication entity tenantId does not match expected tenant',
      });
    }
  }

  return {
    result: {
      domain: 'COMMUNICATION',
      totalEntities: communications.length,
      foreignEntities,
      overallResult: foreignEntities === 0 ? 'PASS' : 'FAIL',
    },
    violations,
  };
}

// ---------------------------------------------------------------------------
// 2. Response Isolation
// ---------------------------------------------------------------------------

/**
 * Verify every response entity belongs to the expected tenant.
 *
 * Checks: response.tenantId === tenantId for every entry.
 * Pure function. No side effects. Binary PASS/FAIL.
 */
export function checkResponseIsolation(
  tenantId: string,
  responses: ResponseEntity[]
): { result: DomainIsolationResult; violations: TenantIsolationViolation[] } {
  const violations: TenantIsolationViolation[] = [];
  let foreignEntities = 0;

  for (let i = 0; i < responses.length; i++) {
    const resp = responses[i];
    if (resp.tenantId !== tenantId) {
      foreignEntities++;
      violations.push({
        violationType: 'FOREIGN_RESPONSE',
        entityId: resp.responseId,
        entityTenantId: resp.tenantId,
        expectedTenantId: tenantId,
        description: 'Response entity tenantId does not match expected tenant',
      });
    }
  }

  return {
    result: {
      domain: 'RESPONSE',
      totalEntities: responses.length,
      foreignEntities,
      overallResult: foreignEntities === 0 ? 'PASS' : 'FAIL',
    },
    violations,
  };
}

// ---------------------------------------------------------------------------
// 3. Archive Isolation
// ---------------------------------------------------------------------------

/**
 * Verify every archive manifest belongs to the expected tenant,
 * AND every document referenced by each archive belongs to the expected tenant.
 *
 * Two-level check:
 *   a) archive.tenantId === tenantId
 *   b) For every documentId in archive, resolved document tenantId === tenantId
 *
 * Pure function. No side effects. Binary PASS/FAIL.
 */
export function checkArchiveIsolation(
  tenantId: string,
  archives: ArchiveManifestEntity[],
  documentLookup: Map<string, ResolvedDocument>
): { result: DomainIsolationResult; violations: TenantIsolationViolation[] } {
  const violations: TenantIsolationViolation[] = [];
  let foreignEntities = 0;
  let totalChecks = 0;

  for (let i = 0; i < archives.length; i++) {
    const archive = archives[i];
    totalChecks++;

    // Level 1: archive manifest tenant
    if (archive.tenantId !== tenantId) {
      foreignEntities++;
      violations.push({
        violationType: 'FOREIGN_ARCHIVE_DOCUMENT',
        entityId: archive.archiveId,
        entityTenantId: archive.tenantId,
        expectedTenantId: tenantId,
        description: 'Archive manifest tenantId does not match expected tenant',
      });
    }

    // Level 2: every document inside archive
    const docIds = archive.documentIds;
    for (let j = 0; j < docIds.length; j++) {
      const docId = docIds[j];
      const resolved = documentLookup.get(docId);
      totalChecks++;

      if (resolved !== undefined && resolved.tenantId !== tenantId) {
        foreignEntities++;
        violations.push({
          violationType: 'FOREIGN_ARCHIVE_DOCUMENT',
          entityId: docId,
          entityTenantId: resolved.tenantId,
          expectedTenantId: tenantId,
          description:
            'Document referenced by archive belongs to different tenant',
        });
      }
    }
  }

  return {
    result: {
      domain: 'ARCHIVE',
      totalEntities: totalChecks,
      foreignEntities,
      overallResult: foreignEntities === 0 ? 'PASS' : 'FAIL',
    },
    violations,
  };
}

// ---------------------------------------------------------------------------
// 4. Audit Trace Isolation
// ---------------------------------------------------------------------------

/**
 * Verify every audit trace entry belongs to the expected tenant,
 * AND every cross-phase reference artifact belongs to the expected tenant.
 *
 * Two-level check:
 *   a) entry.tenantId === tenantId
 *   b) For every crossPhaseRef, resolved artifact tenantId === tenantId
 *
 * Pure function. No side effects. Binary PASS/FAIL.
 */
export function checkAuditTraceIsolation(
  tenantId: string,
  auditTraces: AuditTraceEntry[],
  artifactLookup: Map<string, ResolvedArtifact>
): { result: DomainIsolationResult; violations: TenantIsolationViolation[] } {
  const violations: TenantIsolationViolation[] = [];
  let foreignEntities = 0;
  let totalChecks = 0;

  for (let i = 0; i < auditTraces.length; i++) {
    const entry = auditTraces[i];
    totalChecks++;

    // Level 1: trace entry tenant
    if (entry.tenantId !== tenantId) {
      foreignEntities++;
      violations.push({
        violationType: 'FOREIGN_TRACE_REFERENCE',
        entityId: entry.traceId,
        entityTenantId: entry.tenantId,
        expectedTenantId: tenantId,
        description: 'Audit trace entry tenantId does not match expected tenant',
      });
    }

    // Level 2: every crossPhaseRef artifact
    const refs = entry.crossPhaseRefs;
    for (let j = 0; j < refs.length; j++) {
      const ref = refs[j];
      const resolved = artifactLookup.get(ref.artifactId);
      totalChecks++;

      if (resolved !== undefined && resolved.tenantId !== tenantId) {
        foreignEntities++;
        violations.push({
          violationType: 'FOREIGN_TRACE_REFERENCE',
          entityId: ref.artifactId,
          entityTenantId: resolved.tenantId,
          expectedTenantId: tenantId,
          description:
            'Cross-phase reference artifact belongs to different tenant',
        });
      }
    }
  }

  return {
    result: {
      domain: 'AUDIT_TRACE',
      totalEntities: totalChecks,
      foreignEntities,
      overallResult: foreignEntities === 0 ? 'PASS' : 'FAIL',
    },
    violations,
  };
}

// ---------------------------------------------------------------------------
// 5. Artifact Lookup Isolation
// ---------------------------------------------------------------------------

/**
 * Verify every artifact in the lookup map belongs to the expected tenant.
 *
 * This catches contamination at the lookup level itself —
 * if a compromised store inserts foreign artifacts into the map,
 * this check detects it before any referential validation runs.
 *
 * Pure function. No side effects. Binary PASS/FAIL.
 */
export function checkArtifactLookupIsolation(
  tenantId: string,
  artifactLookup: Map<string, ResolvedArtifact>
): { result: DomainIsolationResult; violations: TenantIsolationViolation[] } {
  const violations: TenantIsolationViolation[] = [];
  let foreignEntities = 0;
  let totalEntities = 0;

  artifactLookup.forEach((artifact) => {
    totalEntities++;
    if (artifact.tenantId !== tenantId) {
      foreignEntities++;
      violations.push({
        violationType: 'FOREIGN_TRACE_REFERENCE',
        entityId: artifact.artifactId,
        entityTenantId: artifact.tenantId,
        expectedTenantId: tenantId,
        description: 'Artifact in lookup map belongs to different tenant',
      });
    }
  });

  return {
    result: {
      domain: 'ARTIFACT_LOOKUP',
      totalEntities,
      foreignEntities,
      overallResult: foreignEntities === 0 ? 'PASS' : 'FAIL',
    },
    violations,
  };
}

// ---------------------------------------------------------------------------
// Full Tenant Isolation Scan
// ---------------------------------------------------------------------------

/**
 * Run a complete tenant isolation scan across all entity domains.
 *
 * Validates:
 *   1. All communications belong to tenantId
 *   2. All responses belong to tenantId
 *   3. All archives + their documents belong to tenantId
 *   4. All audit trace entries + their cross-phase refs belong to tenantId
 *   5. All artifacts in lookup map belong to tenantId
 *
 * Aggregates all violations into a single result.
 * Violations sorted deterministically by violationType ASC then entityId ASC.
 * Overall: PASS only if zero violations across all domains.
 *
 * Pure function. No side effects. Deterministic.
 * Binary PASS/FAIL only.
 */
export function runTenantIsolationScan(
  tenantId: string,
  communications: CommunicationEntity[],
  responses: ResponseEntity[],
  auditTraces: AuditTraceEntry[],
  archives: ArchiveManifestEntity[],
  artifactLookup: Map<string, ResolvedArtifact>,
  documentLookup: Map<string, ResolvedDocument>
): TenantIsolationScanResult {
  // Domain 1: Communication isolation
  const commResult = checkCommunicationIsolation(tenantId, communications);

  // Domain 2: Response isolation
  const respResult = checkResponseIsolation(tenantId, responses);

  // Domain 3: Archive isolation (manifest + document references)
  const archiveResult = checkArchiveIsolation(tenantId, archives, documentLookup);

  // Domain 4: Audit trace isolation (entries + cross-phase refs)
  const traceResult = checkAuditTraceIsolation(tenantId, auditTraces, artifactLookup);

  // Domain 5: Artifact lookup isolation
  const artifactResult = checkArtifactLookupIsolation(tenantId, artifactLookup);

  // Aggregate violations
  const allViolations: TenantIsolationViolation[] = [];
  for (let i = 0; i < commResult.violations.length; i++) {
    allViolations.push(commResult.violations[i]);
  }
  for (let i = 0; i < respResult.violations.length; i++) {
    allViolations.push(respResult.violations[i]);
  }
  for (let i = 0; i < archiveResult.violations.length; i++) {
    allViolations.push(archiveResult.violations[i]);
  }
  for (let i = 0; i < traceResult.violations.length; i++) {
    allViolations.push(traceResult.violations[i]);
  }
  for (let i = 0; i < artifactResult.violations.length; i++) {
    allViolations.push(artifactResult.violations[i]);
  }

  // Sort violations deterministically: by violationType ASC, then entityId ASC
  allViolations.sort((a, b) => {
    const typeCmp = asciiCompare(a.violationType, b.violationType);
    if (typeCmp !== 0) return typeCmp;
    return asciiCompare(a.entityId, b.entityId);
  });

  const totalChecks =
    commResult.result.totalEntities +
    respResult.result.totalEntities +
    archiveResult.result.totalEntities +
    traceResult.result.totalEntities +
    artifactResult.result.totalEntities;

  const totalViolations = allViolations.length;

  return {
    tenantId,
    communicationIsolation: commResult.result,
    responseIsolation: respResult.result,
    archiveIsolation: archiveResult.result,
    auditTraceIsolation: traceResult.result,
    artifactLookupIsolation: artifactResult.result,
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
 * CI enforcement hook for tenant isolation.
 *
 * Binary PASS/FAIL only.
 * If FAIL, build MUST be blocked.
 * No soft pass. No warning-only mode. No bypass.
 *
 * Deterministic — same inputs always produce same output.
 */
export function enforceTenantIsolation(
  tenantId: string,
  communications: CommunicationEntity[],
  responses: ResponseEntity[],
  auditTraces: AuditTraceEntry[],
  archives: ArchiveManifestEntity[],
  artifactLookup: Map<string, ResolvedArtifact>,
  documentLookup: Map<string, ResolvedDocument>
): CITenantIsolationEnforcementResult {
  const scanResult = runTenantIsolationScan(
    tenantId,
    communications,
    responses,
    auditTraces,
    archives,
    artifactLookup,
    documentLookup
  );

  // Count violations by type
  let foreignCommunications = 0;
  let foreignResponses = 0;
  let foreignArchiveDocuments = 0;
  let foreignTraceReferences = 0;

  for (let i = 0; i < scanResult.violations.length; i++) {
    const v = scanResult.violations[i];
    if (v.violationType === 'FOREIGN_COMMUNICATION') foreignCommunications++;
    else if (v.violationType === 'FOREIGN_RESPONSE') foreignResponses++;
    else if (v.violationType === 'FOREIGN_ARCHIVE_DOCUMENT') foreignArchiveDocuments++;
    else if (v.violationType === 'FOREIGN_TRACE_REFERENCE') foreignTraceReferences++;
  }

  return {
    result: scanResult.overallResult,
    foreignCommunications,
    foreignResponses,
    foreignArchiveDocuments,
    foreignTraceReferences,
    totalChecks: scanResult.totalChecks,
    totalViolations: scanResult.totalViolations,
  };
}
