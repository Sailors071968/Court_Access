# NIIS Pipeline Observability Requirement

**Source:** Master Engineering Directive v2.0  
**Status:** Binding requirement · delivered incrementally with each pipeline stage  

## Requirement

When any stage fails, an operator must identify **within seconds, without reading application logs**:

1. The exact stage that failed  
2. The reason it failed  
3. The supporting evidence  

## Stage contract

Every pipeline stage emits a uniform record:

| Field | Notes |
|---|---|
| `stage` | upload · storage · parsing · canonical_roster · comparison · enrichment · reporting · alerting |
| `status` | not_started · running · ok · failed · skipped |
| `startedAt` / `finishedAt` | ISO-8601 UTC |
| `durationMs` | measured, not estimated |
| `counts` | stage-appropriate (bytes, rows, NEW/EXISTING/…, alerts) |
| `identifiers` | jobId · jobFileId · uploadId · batchId · caseId |
| `failureReason` | operator-readable, never blank on failure |
| `evidenceRef` | stored path / hash / report id |

## Per-stage minimum

| Stage | Must expose |
|---|---|
| Upload | accepted, bytes in flight, HTTP outcome, failure reason |
| Storage | bytes stored, stored path, sha256, durability confirmed |
| Parsing | rows read, parser profile + version, confidence, warnings |
| Canonical roster | rows canonicalized, identity decisions, unresolved count |
| Comparison | executed, NEW / EXISTING / RETURNING / REVIEW counts |
| Enrichment | queued, retrieved, failed, latency (never blocks identification) |
| Reporting | report generated, printable artifact reference |
| Alerting | emitted, suppressed, delivery outcome |

## Zero Fabrication interaction

An unmeasured value is reported as `UNKNOWN`. Never substitute a default, an average, or an optimistic assumption.

## Current status

| Item | State |
|---|---|
| Upload/storage stage trace (INC-001 instrumentation) | Implemented in the ingestion fix (`INC-001` JSON transitions) — **not yet running in production** |
| Remaining stages | To be delivered with their respective v2.0 work, after INC-001A / INC-001 close |

First operator-visible milestone: after the ingestion fix is deployed, upload failures must surface stage + reason + evidence without shell access.
