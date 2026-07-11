# Master Program 11 — Performance & Scalability

> Measured against the running staging server + production build. Real numbers only; metrics that need a headless browser or a running queue are marked UNKNOWN. One bottleneck was optimized and re-measured.

## Measured metrics

| Metric | Result | Method |
|--------|--------|--------|
| **Startup time** | ~13–14s (boot + schema-integrity assert + route registration + worker init) | server log timestamps |
| **API latency** | health p50 **1ms**; cases p50 3ms / p95 14ms; search p50 8ms / p95 15ms | 15 sequential probes each |
| **Concurrency** | 50 parallel `/health` → all completed, total 76ms, p50 13ms, **p95 21ms** | 50-thread load |
| **Memory** | backend node RSS **62 MB** | `ps` on the node process |
| **CPU** | ~0% idle (spikes only during analysis) | `ps` |
| **Database — hot query** | `criminal_cases` by tenant → **Index Scan** (0.016ms, 2 buffers) — optimal | `EXPLAIN ANALYZE` |
| **Database — search query** | `evidence_chunks ILIKE '%…%'` → **Seq Scan** (expected; leading-wildcard can't use b-tree) | `EXPLAIN` |
| **OCR throughput** | small text file: upload → extract → chunk **inline, ~58ms** | evidence upload timing |
| **Bundle size (before)** | single JS chunk **1.65 MB** (400 KB gzip) — flagged bottleneck | `vite build` |
| **Bundle size (after opt)** | main **856 KB** (185 KB gzip) + split vendor chunks | `vite build` |

## Optimization performed (automatic) — bundle code-splitting

`vite.config.ts` `build.rollupOptions.output.manualChunks` splits vendor libraries into cacheable chunks:

| Chunk | Size | gzip |
|-------|------|------|
| **index (app)** | **856 KB** (was 1.65 MB) | 185 KB |
| vendor-three (3D) | 527 KB | 135 KB |
| vendor-react | 143 KB | 46 KB |
| vendor-icons | 58 KB | 11 KB |
| vendor-router | 38 KB | 14 KB |
| vendor | 27 KB | 9 KB |
| vendor-state | 3 KB | 1 KB |

**Result:** main app chunk **−48%** (1.65 MB → 856 KB). Heavy Three.js (527 KB) isolated into its own chunk (cached across deploys; only the 3D exhibit route needs it). Third-party code no longer re-downloaded on every app change.

## Query-plan finding + recommendation

`evidence_chunks` substring search is a **Seq Scan** (correct for `ILIKE '%term%'`). At scale, add a `pg_trgm` GIN index (or Postgres full-text `tsvector`) to make chunk search index-backed. Deferred (requires an extension + migration) — documented, not silently skipped.

## UNKNOWN (not measurable here / never fabricated)

- **Queue throughput** — no BullMQ worker is running in staging (extraction is inline); throughput UNKNOWN until Redis-queued workers are exercised.
- **React rendering** — component render profiling needs a headless browser + React Profiler; not run in this environment.
- **Lazy loading** — manualChunks isolates vendors, but route-level `React.lazy` for the heavy 3D `ExhibitViewer` is a further win (recommended; not yet applied to avoid an App.tsx refactor this pass).
- **Large-case / high-concurrency-user** performance — measured up to 50 concurrent `/health`; a full k6/artillery load profile against authenticated heavy endpoints (workbench/graph) with a large seeded case is the next step.
- **Caching** — CourtListener client has a 5-min TTL cache (verified in the provider layer); app-level HTTP caching headers not yet audited.

## Verdict

**PASS (measured) with targeted optimization.** Latency is low (single-digit ms p50), memory lean (62 MB), the hottest DB query is index-backed, and the flagged bundle bottleneck was cut ~48% via code-splitting and re-verified. Remaining items (trigram search index, React.lazy for 3D, full load test, queue throughput) are documented with concrete next steps rather than fabricated numbers.
