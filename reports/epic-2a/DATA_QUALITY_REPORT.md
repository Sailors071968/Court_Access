# Epic 2A — Data Quality Report

**Date:** 2026-07-04  
**Scope:** California criminal statute extraction requirements vs. current capability

---

## Required Fields (Per Constitutional Standard)

Every extracted statute record must contain:

| Field | Required | Current Support | Gap |
|-------|----------|-----------------|-----|
| Code | ✓ | `NormalizedDocument` has no `code` field | **Schema gap** — only `corpusName` (e.g. `penal_code`) |
| Section | ✓ | No `section` field | **Schema gap** |
| Title | ✓ | `title` field exists | ✅ Supported |
| Full statutory text | ✓ | `content` field exists | ✅ Supported (if source provides it) |
| Hierarchy | ✓ | No division/chapter/part fields | **Schema gap** |
| Source URL | ✓ | `source` is generic string | ⚠️ Partial — no URL validation |
| Retrieval timestamp | ✓ | `createdAt` on insert | ⚠️ Records fetch time, not retrieval time |
| Content hash | ✓ | `contentHash` SHA-256 | ✅ Supported |
| Effective date | When available | Not modeled | **Schema gap** |
| Audit metadata | ✓ | `corpus_ingestion_log` batch records | ⚠️ Batch-level only, not per-statute |

---

## Extraction Accuracy

| Metric | Measured Value | Method |
|--------|----------------|--------|
| Leginfo sections extracted | **0** | DB query: `legal_documents` count = 0 |
| Statute parse success rate | **N/A** | No HTML parser exists |
| Field completeness rate | **N/A** | No source acquisition |
| Silent discard rate | **Unknown** | No extraction pipeline to audit |
| Parsing ambiguity log | **None** | No ambiguity detection |

---

## NormalizedDocument Schema Analysis

Current canonical record (`backend/src/ingestion/types.ts`):

```typescript
interface NormalizedDocument {
  id: string;
  tenantId: string;
  title: string;
  content: string;
  jurisdiction: string;
  documentType: CorpusType;  // includes 'statute'
  source: string;
  version: string;
  corpusName: string;
  sourceFile: string;
  contentHash: string;
  corpusVersion?: string;
  documentVersion?: string;
  supersededBy?: string;
}
```

**Missing for production statute records:**
- `code` (e.g. "PC", "EC", "VEH")
- `section` (e.g. "459", "1538.5")
- `subdivision` (e.g. "(a)", "(b)(1)")
- `hierarchy` (division → chapter → article → section)
- `sourceUrl` (leginfo canonical URL)
- `retrievedAt` (acquisition timestamp)
- `effectiveDate` / `operativeDate`
- `amendedDate`
- `crossReferences[]`
- `extractionConfidence`
- `parseWarnings[]`

---

## Proposed StatuteRecord Schema (Target)

```typescript
interface StatuteRecord {
  // Identity
  code: string;           // "PC"
  section: string;        // "459"
  subdivision?: string;   // "(a)"
  
  // Content
  title: string;
  fullText: string;
  hierarchy: {
    division?: string;
    chapter?: string;
    article?: string;
    part?: string;
  };
  
  // Provenance (constitutional requirement)
  sourceUrl: string;
  retrievedAt: string;    // ISO 8601
  contentHash: string;    // SHA-256 of fullText
  
  // Legal metadata
  effectiveDate?: string;
  operativeDate?: string;
  crossReferences?: string[];
  
  // Extraction audit
  extractionVersion: string;
  extractionConfidence: number;  // 0-1
  parseWarnings: string[];
  rejected: boolean;
  rejectionReason?: string;
}
```

---

## Data Silently Discarded?

| Stage | Discard mechanism | Audited? |
|-------|-------------------|----------|
| Parse failures | Parser throws → batch fails | ✅ `corpus_ingestion_log` |
| Duplicate content | `duplicateDetector.ts` hash match → skip | ✅ Logged as skipped |
| Invalid corpus type | Falls back to `policy` type | ⚠️ **Silent misclassification possible** |
| HTML parse errors | N/A — no HTML parser | — |
| Ambiguous section boundaries | N/A | — |
| Non-criminal codes | N/A — no code filter | — |

**Risk:** `resolveDocumentType()` in `normalizer.ts` falls back to corpus name, then defaults to `'policy'` if unrecognized — potential silent misclassification.

---

## Parsing Ambiguities (Anticipated for Leginfo)

Based on leginfo.legislature.ca.gov structure, these will require explicit handling:

1. **Section vs. subdivision** — `(a)`, `(b)(1)`, `(2)` nesting
2. **Operative vs. effective dates** — delayed operative clauses
3. **Incorporated regulations** — offenses created via cross-reference to CCR
4. **Repealed/renumbered sections** — historical vs. current text
5. **Penalty provisions** — may be in separate sections from offense definition
6. **Definitions** — Penal Code § scope definitions affecting mens rea
7. **HTML rendering artifacts** — navigation chrome mixed with statute text

**Current status:** None of these are handled. No parser exists.

---

## Test Corpus Quality

`backend/scripts/generate-test-corpus.ts` generates synthetic records with:
- Random titles
- Lorem-style content
- `documentType: 'statute'` for ~20% of records

**This is throughput testing only — not legal accuracy validation.**

---

## Verification Commands

```bash
# Confirm empty production statute data
sudo -u postgres psql -d courtaccess -c 'SELECT COUNT(*) FROM legal_documents;'
sudo -u postgres psql -d courtaccess -c 'SELECT COUNT(*) FROM corpus_registry;'

# Run ingestion quality tests (synthetic data)
cd backend && node --import tsx --test tests/ingestion.test.ts
# Result: 29/29 pass, 50k records in 0.2s (dry-run, no DB insert)

# Governance pipeline tests
cd backend && node --import tsx --test tests/governance.test.ts
```

---

## Data Quality Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Schema completeness | 3/10 | Generic document model, no statute-specific fields |
| Provenance tracking | 4/10 | Hash + source file, no URL/timestamp per record |
| Extraction accuracy | 0/10 | No leginfo extraction |
| Audit trail | 6/10 | Batch logs exist; per-record audit missing |
| Silent discard prevention | 5/10 | Dedup logged; type fallback silent |
| **Overall** | **3.6/10** | Infrastructure only |
