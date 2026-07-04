# Epic 2A — Performance Report

**Date:** 2026-07-04  
**Scope:** Measured throughput of existing corpus pipeline; projected leginfo requirements

---

## Measured Performance (Existing Corpus Pipeline)

### Ingestion Test Results (Executed 2026-07-04)

```bash
cd backend && node --import tsx --test tests/ingestion.test.ts
```

| Metric | Value | Notes |
|--------|-------|-------|
| Test suites | 11 | All pass |
| Test cases | 29 | All pass |
| 50k corpus ingest (dry-run) | 0.2s | No DB insert |
| Peak memory | 47 MB | Constant during streaming |
| Throughput | ~12.4M rec/min | Synthetic JSONL, in-memory only |
| Crash recovery | ✅ Pass | Resume from checkpoint |
| Dedup protection | ✅ Pass | SHA-256 content hash |

**Caveat:** 12.4M rec/min is synthetic dry-run throughput. Real PostgreSQL insert throughput is lower.

### Historical Policy Pipeline Benchmarks

From `reports/performance_benchmark.json` (Phase 185, policy-focused):

| Scenario | Volume | Runtime | Bottleneck |
|----------|--------|---------|------------|
| Agency registry load | 500 agencies | 12s | DB queries |
| Policy ingestion | 20,000 docs | 60 min | **OCR** (~36 docs/min with 3 workers) |
| Policy classification | 20,000 docs | 16 min | CPU |
| Coverage matrix | 25,000 cells | 45s | DB queries |

**Key insight:** For policy documents, OCR is the bottleneck (5000ms avg). Statute HTML from leginfo would **not** require OCR — acquisition and parsing would dominate.

---

## Projected Leginfo Performance Requirements

### California Code Scale (Approximate)

| Code | Estimated Sections | Notes |
|------|-------------------|-------|
| Penal Code | ~1,500 | Primary criminal |
| Evidence Code | ~1,600 | Admissibility |
| Vehicle Code | ~3,000+ | DUI, traffic crimes |
| Health & Safety | ~2,000+ | Drug offenses |
| Business & Professions | ~500+ | Licensing crimes |
| **Total criminal-relevant** | **~8,000–12,000** | Subset of full leginfo |

Full leginfo contains 29 codes with 100,000+ sections — criminal pipeline should filter to relevant codes.

### Projected Throughput (Conservative Estimates)

Assuming respectful crawl at 1 req/sec (per `crawlerSafetyService.ts`):

| Stage | Rate | Full Penal Code (~1,500 sections) |
|-------|------|-----------------------------------|
| Page acquisition | 60 pages/min | ~25 minutes |
| HTML parse | 500 pages/min | ~3 minutes |
| Normalization | 10,000 records/min | <1 minute |
| DB insert (batch 500) | 5,000 records/min | <1 minute |
| Legal extraction | 100 records/min | ~15 minutes (AI-assisted) |
| **Total (serial)** | — | **~45 minutes** |

With 4 parallel acquisition workers (still 1 req/sec/domain aggregate):
- Penal Code full ingest: **~15–20 minutes**
- All criminal-relevant codes: **~2–4 hours initial load**

---

## Current Bottlenecks

| Bottleneck | Severity | Component | Impact on Legislative Pipeline |
|------------|----------|-----------|-------------------------------|
| **No source acquisition** | 🔴 Critical | Missing | Blocks entire pipeline |
| **No HTML parser** | 🔴 Critical | Missing | Cannot extract from leginfo |
| **CLI mock inserter** | 🟡 High | `cli.ts` | Standalone mode doesn't insert to DB |
| **Governance API not mounted** | 🟡 High | `governanceApi.ts` | No HTTP trigger for ingestion |
| **Graph indexer not wired** | 🟡 Medium | `graphIndexer.ts` | No post-ingest relationship building |
| **Generic schema** | 🟡 Medium | `LegalDocument` | Missing code/section/hierarchy |
| **OCR (policy only)** | 🟢 N/A | `ocrWorker.ts` | Not applicable to HTML statutes |
| **Static CALCRIM** | 🟡 Medium | `calcrimElements.ts` | Limits offense linking |

---

## Duplicate Work Identified

1. **Policy crawl infrastructure** duplicates patterns that legislative crawl will need — should share `crawlerSafetyService`, queue manager, phase reporting
2. **Two security log systems** — in-memory `securityLogger` vs. Prisma `security_logs` (unrelated but adds ops complexity)
3. **Doctrine seed data** — POST LD rules cite Penal Code sections but are not linked to `legal_documents`
4. **Frontend search stubs** — `searchService.ts` hardcodes 3 statutes instead of querying `legal_documents`

---

## Memory / CPU / Network Profile

### Corpus Loader (Measured)

| Resource | 50k dry-run | Projected 10k statutes |
|----------|-------------|------------------------|
| Memory | 47 MB peak | <100 MB (streaming) |
| CPU | Low (I/O bound) | Low-Medium (parse bound) |
| Network | File I/O only | ~10k HTTP requests initial |

### Storage

| Repository | Per-record size | 10k statutes |
|------------|-----------------|--------------|
| `legal_documents` | ~5–50 KB | 50–500 MB |
| `corpus_ingestion_log` | ~200 B/batch | <1 MB |
| Neo4j graph nodes | ~1 KB/node | ~10 MB |

---

## Performance Optimization Recommendations

| Priority | Optimization | Correctness impact | Speed gain |
|----------|-------------|-------------------|------------|
| P0 | Build leginfo acquisition | None — enables pipeline | ∞ (from zero) |
| P1 | Section-level checkpoint/resume | None | Fault tolerance |
| P1 | Content-hash incremental sync | None | Skip unchanged sections |
| P2 | Parallel acquisition (respect 1 req/sec/domain) | None if rate-limited | 2–4× |
| P2 | PostgreSQL COPY for bulk insert | None | 5–10× vs. row insert |
| P3 | Cache leginfo TOC structure | None | Faster discovery |
| P3 | Pre-filter criminal-relevant codes | None | 80% less work |

**Do NOT optimize before acquisition exists.** Current pipeline handles file ingest efficiently; the gap is source retrieval.

---

## Performance Test Commands

```bash
# Corpus pipeline throughput (synthetic)
cd backend && node --import tsx --test tests/ingestion.test.ts

# Policy benchmark reference (historical, not re-run)
cat reports/performance_benchmark.json | jq '.benchmarks[] | {name, status, metrics}'

# Redis queue depth (workers running)
redis-cli keys 'bull:*' | wc -l

# DB insert capacity (requires test file)
cd backend && npm run ingest-corpus -- --corpus penal_code --file /tmp/test.jsonl --dryRun
```
