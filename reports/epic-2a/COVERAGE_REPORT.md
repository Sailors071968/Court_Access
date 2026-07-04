# Epic 2A — Coverage Report

**Date:** 2026-07-04  
**Scope:** Offense discovery, CALCRIM, authority relationships

---

## Offense Discovery Coverage

### Explicit Criminal Offenses

| Source | Coverage | Method |
|--------|----------|--------|
| Penal Code sections | **0%** | No leginfo ingestion |
| Health & Safety drug offenses | **0%** | No ingestion |
| Vehicle Code DUI/traffic | **0%** | No ingestion |
| Per-case charges (manual) | ✅ API works | `POST /api/charges` — E2E verified |

### Offense Types Not Discoverable Today

| Type | Status | Gap |
|------|--------|-----|
| Explicit criminal offenses | ❌ | No statute text to parse |
| Incorporated regulations (CCR) | ❌ | No cross-ref resolver |
| Penalty provisions | ❌ | No penalty parser |
| Mens rea language | ❌ | No NLP extraction |
| Exceptions/affirmative defenses | ❌ | No exception parser |
| Definitions (PC § scope) | ❌ | No definition linker |
| Cross-references | ❌ | No xref graph |
| CALCRIM relationships | ⚠️ Static only | 2 mappings in `calcrimMapping.ts` |
| Authority relationships | ⚠️ Regex only | `graphEntityExtractor.ts` test-only |

---

## CALCRIM Coverage

### Static Data Inventory

| File | Crimes Covered | CALCRIM Numbers |
|------|----------------|-----------------|
| `calcrimElements.ts` | 6 | burglary, robbery, assault, theft, DUI, narcotics_possession |
| `calcrimMapping.ts` | 2 | PC 459 → CALCRIM 1700, PC 484 → CALCRIM 1800 |
| `calcrimService.ts` | 1 | PC 459 burglary only |

### CALCRIM API

```
GET /api/calcrim/analyze/:caseId
```

- Analyzes case evidence against static element definitions
- E2E verified as part of case workflow
- **Not connected to ingested statute text**

### Coverage Gap

California Judicial Council publishes 700+ CALCRIM instructions. CourtAccess covers **<1%**.

---

## Authority Relationship Coverage

### Graph Layer (Neo4j — Test Only)

| Relationship | Extractor | Production Status |
|--------------|-----------|-------------------|
| `REFERENCES` | `graphRelationshipBuilder.ts` | Test only |
| `VIOLATES` | `graphRelationshipBuilder.ts` | Test only |
| `SUPPORTS` | `graphRelationshipBuilder.ts` | Test only |
| Statute → Offense | — | **Not implemented** |
| Statute → CALCRIM | — | **Not implemented** |
| Statute → Element | — | **Not implemented** |

### Doctrine Layer (In-Memory)

| Source | Coverage | Notes |
|--------|----------|-------|
| POST LD rules | 12 seed files | Cite PC sections but not linked to statute repo |
| Doctrine compliance API | ✅ E2E verified | Analyzes evidence text, not statute DB |

---

## Repository Integration Status

| Repository | Auto-Updated by Ingestion? | Current State |
|------------|---------------------------|---------------|
| Statute Repository (`legal_documents`) | ✅ If file provided | **Empty (0 records)** |
| Offense Repository | ❌ Not modeled | Manual charges only |
| Element Repository | ❌ Not modeled | Static CALCRIM elements |
| Mens Rea Repository | ❌ Not modeled | — |
| Authority Repository | ❌ Not modeled | — |
| CALCRIM mappings | ❌ | 2 static entries |
| Completion metrics | ❌ | No coverage analytics |
| Coverage analytics | ❌ Policy only | `policy_gap_analysis.json` |

---

## Frontend Search Coverage

`src/services/searchService.ts` returns **3 hardcoded statutes**:

- PC 459 (Burglary)
- PC 1538.5 (Motion to Suppress)
- H&S 11350 (Possession of Controlled Substance)

**Does not query `legal_documents` table.**

---

## Incremental Update Capability

| Capability | Status | Implementation |
|------------|--------|----------------|
| Detect changed statutes | ❌ | No source polling |
| Download only changed content | ❌ | No acquisition |
| Content hash comparison | ✅ | `duplicateDetector.ts` ready |
| Repository delta updates | ⚠️ | `corpusVersioning.ts` exists, unused |
| Audit history | ⚠️ | Batch logs only |
| Rebuild affected repos only | ❌ | No dependency graph |

---

## Coverage Score by Domain

| Domain | Coverage | Target |
|--------|----------|--------|
| Penal Code sections | 0% | 100% |
| Evidence Code (criminal) | 0% | 100% |
| CALCRIM instructions | <1% | 100% criminal-relevant |
| Offense elements | <1% | Per CALCRIM |
| Cross-references | 0% | Full graph |
| Mens rea extraction | 0% | Per offense |
| **Overall criminal law coverage** | **<0.5%** | 100% |

---

## Criminal Code Priority List (Recommended Ingestion Order)

1. **Penal Code** — Core felonies/misdemeanors
2. **Evidence Code** — Admissibility, suppression
3. **Health & Safety Code** — Drug offenses (Division 10)
4. **Vehicle Code** — DUI, hit-and-run
5. **Business & Professions Code** — Licensing crimes
6. **Welfare & Institutions Code** — Juvenile, commitment
7. **Constitution Article I** — Search/seizure, due process

---

## Verification Evidence

```bash
# Confirm zero statute coverage in DB
sudo -u postgres psql -d courtaccess -c "SELECT COUNT(*) FROM legal_documents WHERE \"documentType\" = 'statute';"

# Count static CALCRIM crimes
grep -c 'code:' backend/src/data/calcrimElements.ts

# List CALCRIM mappings
cat backend/src/data/calcrimMapping.ts
```
