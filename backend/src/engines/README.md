# Evidence Intelligence Architecture — Phase 116

## Overview

Phase 116 transforms Court Access from a document repository into a **case analysis platform** with structured evidence extraction, cross-document correlation, timeline enrichment, and conflict detection.

## Worker Pipeline

```
Upload
  |
  v
document-processing (Phase 115)
  |
  v
entity-indexing (Phase 116)
  |  - Extract persons, dates, locations, phones, case numbers, agencies
  |  - Update cross-document entity index
  |  - Enrich case timeline from document events
  |
  v
transcript-parsing (Phase 115/116)
  |  - Parse court reporter / multi-column / line-numbered formats
  |  - Track recurring speakers
  |  - Extract key testimony (confessions, contradictions, evidence mentions)
  |  - Store classified statements
  |
  v
timeline-generation (Phase 115/116)
  |  - Generate chronological case timeline
  |  - Detect events from transcripts + documents
  |  - Store enriched case events
  |
  v
conflict-detection (Phase 116)
     - Compare timeline events across documents
     - Detect entity discrepancies
     - Identify testimony contradictions
     - Store evidence conflicts with confidence scores
```

## Database Schema (Phase 116 additions)

### DocumentEntity
Stores extracted entities from each document.
- `documentId`, `caseId`, `entityType`, `entityValue`, `confidence`, `sourceContext`

### EntityIndex
Cross-document entity index for searching entities across all case documents.
- `entityType`, `entityValue`, `normalizedValue`, `documentId`, `caseId`
- Unique constraint: `(entityType, normalizedValue, documentId)`

### CaseEvent
Enriched timeline events extracted from documents and transcripts.
- `caseId`, `timestamp`, `eventType`, `sourceDocumentId`, `description`, `confidence`

### TranscriptStatement
Key testimony statements classified by type.
- `transcriptId`, `caseId`, `speaker`, `lineNumber`, `statementText`, `statementType`, `confidence`
- Statement types: `confession`, `contradiction`, `timeline_ref`, `evidence_mention`, `key_testimony`

### EvidenceConflict
Detected contradictions across evidence sources.
- `caseId`, `entity`, `documentA`, `documentB`, `description`, `conflictType`, `confidence`
- Conflict types: `contradiction`, `timeline_mismatch`, `entity_discrepancy`

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/cases/:id/entities` | GET | Extracted entities grouped by type |
| `/api/cases/:id/timeline` | GET | Enriched chronological timeline |
| `/api/cases/:id/conflicts` | GET | Detected evidence conflicts |
| `/api/cases/:id/statements` | GET | Key testimony statements |
| `/api/cases/:id/entity-search` | GET | Search entities across documents |

## Engines

| Engine | File | Purpose |
|---|---|---|
| Document Intelligence | `documentIntelligenceEngine.js` | Entity extraction + cross-document indexing |
| Timeline Enrichment | `timelineEnrichmentEngine.js` | Event detection from documents + transcripts |
| Transcript Intelligence | `transcriptIntelligenceEngine.js` | Speaker tracking + testimony classification |
| Conflict Detection | `conflictDetectionEngine.js` | Cross-document contradiction identification |
| AI Evidence Analysis | `aiEvidenceAnalysis.js` | Structured LLM prompt preparation (Phase 117) |

## Performance Safeguards

- Max upload size: 100MB
- Worker timeout: 120 seconds per job
- Job retry: 3 attempts with exponential backoff
- Workers use BullMQ concurrency limits to prevent event loop blocking
- Entity indexing: max 10 jobs/minute
- Conflict detection: max 3 jobs/minute

## AI Pipeline (Phase 117 Preparation)

`aiEvidenceAnalysis.js` prepares structured prompts for:
- **Case Summary Generation** — Comprehensive case overview from extracted data
- **Contradiction Explanation** — Analysis of detected conflicts with legal significance
- **Timeline Narrative** — Flowing chronological narrative from events
- **Evidence Strength Scoring** — Assessment of evidence completeness and gaps

LLM integration will be connected in Phase 117.
