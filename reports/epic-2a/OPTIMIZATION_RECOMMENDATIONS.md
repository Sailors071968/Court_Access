# Epic 2A — Bottleneck Analysis & Optimization Recommendations

**Date:** 2026-07-04

---

## Bottleneck Priority Matrix

| # | Bottleneck | Category | Blocks | Fix Complexity |
|---|------------|----------|--------|----------------|
| 1 | No leginfo acquisition | Source | Entire Epic 2A | High |
| 2 | No HTML statute parser | Parse | Data quality | High |
| 3 | Generic document schema | Schema | Offense linking | Medium |
| 4 | No legal extraction engine | Extract | Offense discovery | High |
| 5 | Governance API not mounted | Ops | Production triggers | Low |
| 6 | CLI mock inserter | Ops | CLI ingestion | Low |
| 7 | Graph indexer not wired | Index | Authority graph | Medium |
| 8 | Static CALCRIM data | Coverage | Element matching | Medium |
| 9 | Frontend search stubs | UX | Attorney statute lookup | Low |
| 10 | No coverage analytics | Ops | Progress visibility | Medium |

---

## Optimization Recommendations

### Tier 0 — Enable Pipeline (Required Before Any Performance Work)

| ID | Recommendation | Rationale |
|----|---------------|-----------|
| 2A-001 | Implement leginfo code discovery (TOC enumeration) | Cannot ingest what we cannot find |
| 2A-002 | Implement respectful HTTP acquisition with `crawlerSafetyService` | Constitutional: respect source access patterns |
| 2A-003 | Build HTML statute parser for leginfo page structure | Core extraction capability |
| 2A-004 | Extend schema with `StatuteRecord` fields (code, section, hierarchy, sourceUrl) | Data quality requirements |
| 2A-005 | Mount governance API in `server.ts` | Production operability |

### Tier 1 — Correctness & Auditability

| ID | Recommendation | Rationale |
|----|---------------|-----------|
| 2A-006 | Per-record extraction audit log (not just batch) | Constitutional: no silent discard |
| 2A-007 | Parse ambiguity detection + rejection queue | UNKNOWN over fabrication |
| 2A-008 | Schema validation before insert | Reject incomplete records |
| 2A-009 | Source URL + retrieval timestamp on every record | Provenance chain |
| 2A-010 | Criminal-code filter (PC, EC, H&S, VEH first) | Focus coverage |

### Tier 2 — Legal Extraction

| ID | Recommendation | Rationale |
|----|---------------|-----------|
| 2A-011 | Offense discovery from statute text | Attorney question: "What offense is this?" |
| 2A-012 | Mens rea / penalty / exception extractors | Element analysis |
| 2A-013 | Cross-reference resolver | Authority relationships |
| 2A-014 | CALCRIM instruction linker | Jury instruction mapping |
| 2A-015 | Wire graph indexer post-ingest | Authority graph |

### Tier 3 — Performance (After Tier 0–1)

| ID | Recommendation | Expected Gain | Correctness Risk |
|----|---------------|---------------|------------------|
| 2A-016 | Section-level checkpoint/resume | Fault tolerance | None |
| 2A-017 | Content-hash incremental sync | Skip 90%+ on re-run | None if hash covers full text |
| 2A-018 | Parallel acquisition (rate-limited) | 2–4× acquisition | Low if 1 req/sec/domain enforced |
| 2A-019 | PostgreSQL COPY bulk insert | 5–10× write speed | None |
| 2A-020 | TOC structure cache | Faster discovery | None |

### Tier 4 — Integration & Analytics

| ID | Recommendation | Rationale |
|----|---------------|-----------|
| 2A-021 | Coverage analytics dashboard | Measure completion % |
| 2A-022 | Replace `searchService.ts` stubs with `legal_documents` query | Attorney statute lookup |
| 2A-023 | Auto-update offense/element repositories on ingest | Repository integration |
| 2A-024 | Incremental delta reports | Audit history |

---

## What NOT To Do

1. **Do not increase scrape rate beyond leginfo access patterns** — risks IP block, violates constitutional compliance
2. **Do not skip validation for speed** — silent discard violates engineering constitution
3. **Do not use AI to fabricate statute text** — extraction only from authoritative source
4. **Do not optimize JSONL ingest** — already fast; bottleneck is acquisition
5. **Do not merge policy and legislative pipelines** — share infrastructure, separate domain logic

---

## Shared Infrastructure Reuse Plan

```
crawlerSafetyService.ts  ──┬── Policy crawl (existing)
                           └── Leginfo crawl (new)

ingestionStateRepository.ts ──┬── File ingest (existing)
                            └── Section crawl checkpoint (new)

corpusVersioning.ts ────────┬── Corpus versions (existing)
                            └── Statute edition tracking (new)

BullMQ queueManager.ts ─────┬── Evidence workers (existing)
                            └── Leginfo crawl workers (new)
```

---

## Success Metrics (Post-Implementation)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Penal Code coverage | 100% sections | `coverage_analytics.penal_code.percent` |
| Field completeness | 100% required fields | Data quality audit |
| Extraction accuracy | >99% on sample audit | Manual review of 100 random sections |
| Parse rejection rate | <2% | `extraction_rejections / total_attempts` |
| Incremental sync time | <10 min for delta | Re-run after initial load |
| Source provenance | 100% records have URL + hash | DB query |
| CALCRIM linkage | 100% criminal offenses | Coverage report |
