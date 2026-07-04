# Epic 2A — Canonical Legislative Pipeline

## Pipeline Flow

```
California Legislature
        │
        ▼
Legislative Discovery          backend/src/legislative/discovery.ts
        │
        ▼
Acquisition                    backend/src/legislative/acquisition.ts
        │
        ▼
Normalization                  backend/src/legislative/normalization.ts
        │
        ▼
Classification                 backend/src/legislative/liabilityDiscovery/classificationEngine.ts
        │
        ▼
Legal Extraction               backend/src/legislative/knowledgeGraph/intelligenceExtractor.ts
        │
        ▼
Knowledge Graph                backend/src/legislative/knowledgeGraph/types.ts
        │
        ▼
Canonical Repositories         backend/src/legislative/knowledgeGraph/repositories.ts
        │
        ▼
Attorney Intelligence          backend/src/legislative/attorneyIntelligence.ts
```

## Stage Details

| Stage | Module | Input | Output |
|-------|--------|-------|--------|
| Discovery | `discovery.ts` | CA code TOC | Discovery manifest + section URLs |
| Acquisition | `acquisition.ts` | Manifest sections | Raw HTML + acquisition index |
| Normalization | `normalization.ts` | Raw HTML | `NormalizedStatute` (canonical text) |
| Classification | `classificationEngine.ts` | `StatuteRecord` | `StatuteClassificationRecord` |
| Legal Extraction | `intelligenceExtractor.ts` | `StatuteRecord` | `CriminalKnowledgeBundle` |
| Knowledge Graph | `pipeline.ts` | Bundle + classification | JSONL repositories |
| Attorney Intelligence | `attorneyIntelligence.ts` | Repositories | Composed attorney view |

## Orchestration

`pipelineStages.ts` runs per-statute processing:

1. **Normalization** — strip HTML, decode entities, parse hierarchy/subdivisions
2. **Legal Extraction** — offenses, elements, mens rea, cross-refs, CALCRIM
3. **Classification** — criminal liability discovery, priority scoring

`knowledgeGraph/pipeline.ts` orchestrates batch processing with audit logging and repository updates.

## CLI

```bash
npm run leginfo:discover -- --code PEN
npm run leginfo:acquire  -- --code PEN
npm run leginfo:process  -- --code PEN    # runs full pipeline
npm run leginfo:classify -- --code PEN    # alias with liability metrics
```

## API

| Endpoint | Role | Purpose |
|----------|------|---------|
| `GET /api/legislative/intelligence/:code/:section` | attorney | Full attorney intelligence view |
| `GET /api/legislative/classifications/:code/:section` | attorney | Classification record |
| `GET /api/legislative/statutes/:code/:section` | attorney | Statute record |
| `GET /api/legislative/liability` | attorney | Liability discovery metrics |
| `GET /api/legislative/audit` | admin | Extraction audit log |

## Constitutional Rules

- No Citation → No Evidence
- No Evidence → No Finding
- No Finding → UNKNOWN
- Every output traces to source statute, URL, and audit metadata
