# Production performance review — Program 177

Analysis only. Figures marked **[MEASURED]** were taken in this workspace during
the Programs 161–168 rehearsals. Everything else is derived from reading code
and is labelled as such. Nothing was measured against production, and no load
test has ever been run against this application.

---

## The finding that matters most

**The timeline pipeline's two timeouts are inconsistent by two orders of
magnitude, and for Case 001 that means the timeline will be built from a
fraction of the evidence.**

Three constants, from three files:

| Constant | Value | Location |
|---|---|---|
| `MAX_EVIDENCE_PER_RUN` | **200** | `timeline/timelineReconstructionService.ts:108` |
| `PIPELINE_TIMEOUT_MS` | **5 minutes** | `timelineReconstructionService.ts:105` |
| `EXTRACTION_TIMEOUT_MS` | **60 seconds per item** | `services/evidenceTextExtractionService.ts:24` |

Evidence is processed **sequentially** in a `for` loop (`:225`), with the
pipeline deadline checked before each item (`:227`).

The arithmetic does not work. 200 items at up to 60 seconds each is up to 200
minutes of work against a 5-minute budget. **Five documents that each hit their
extraction timeout consume the entire pipeline budget**, and the remaining 195
are skipped. Even at a well-behaved 2 seconds per item, 5 minutes covers roughly
150 items — under the 200 cap, so the timeout binds before the cap does in
almost every realistic case.

The behaviour is honest about it. Both limits push a warning
(`:205-208`, `:228-231`) and the run reports what it processed. Nothing is
fabricated. But the warning says remaining evidence *"will be processed on next
pipeline run"* — and in the certified deployment configuration **there is no
next run**.

`reconstructTimeline` has exactly three callers:

| Caller | Runs in this deployment |
|---|---|
| `certification/certificationRun.ts:149` — inline, once per certification | **Yes** |
| `workers/timelineProcessingWorker.ts:50` — BullMQ | **No** — `DISABLE_WORKERS=true` |
| `POST /api/timeline/rebuild/:caseId` — manual | Only if a human calls it |

With workers disabled, a capped or timed-out run is never automatically retried.
The timeline stays partial until someone notices the warning and calls the
rebuild endpoint — repeatedly, since each run re-processes from the start of the
same unordered `findMany` (`:169`) rather than resuming from where it stopped.

**Recommendation before Case 001.** Not a redesign — a decision and a
measurement. Run the certification against a representative subset first and
record how long a single evidence item actually takes. Then either raise
`PIPELINE_TIMEOUT_MS` to match the corpus, or call the rebuild endpoint until
the warnings stop, and verify the timeline event count is stable between runs.
Do not read the first certification report's timeline counts as complete without
checking `warnings[]`.

---

## Database

### Sequential queries inside loops

The pattern `for (const x of xs) { await prisma… }` appears in at least 20
modules, including several on the Case 001 path: `certificationImport.ts`,
`certificationRoutes.ts`, `chargingService.ts`, `calcrimEngine.ts`,
`timelineReconstructionService.ts`, `evidenceGapDetectionService.ts`.

Some of it is inherent — ingesting files one at a time is not obviously wrong,
and ordering matters in places. But `extractIndexedText` (`:135-152`) issues one
`findMany` per evidence item inside the sequential loop, so a 200-item run makes
200 round trips that could be one query grouped by `evidenceId`.

**Impact:** on a local socket a round trip is well under a millisecond and this
barely registers. If `DATABASE_URL` points at RDS across an availability zone,
each round trip is 1–3 ms, and 200 sequential trips become 200–600 ms of pure
latency inside a budget that is already too tight. **Whether the database is
local or remote is UNKNOWN**, and it changes this from negligible to material.

### Connection pool is unconfigured

`lib/prisma.ts:12` constructs `new PrismaClient()` with only a `log` option. The
pool size is Prisma's default — `num_cpus * 2 + 1` — and no `connection_limit`
is set in the URL. For a single fork-mode process this is fine. It would need
attention before cluster mode, where each worker opens its own pool and the
total can exceed PostgreSQL's `max_connections`.

### Indexing looks deliberate

484 indexes across 116 tables **[MEASURED]**, including composite indexes on
`(tenantId, caseId, documentId)` and similar. This is not an afterthought. No
obvious missing index on the hot paths I read.

---

## Memory

| Measurement | Value |
|---|---|
| Resident at idle under PM2 | **~275 MB [MEASURED]** |
| Heap ceiling | Node default, ~4 GB on a 64-bit host |
| Configured PM2 ceiling | **None** |

The deep health check compares heap against the V8 ceiling rather than
`heapTotal` (`observability/deepHealthCheck.ts:187`), with a comment explaining
that the naive version reported healthy processes as unhealthy. That is correct
and worth preserving.

**Risk:** no `max_memory_restart` under PM2. A leak or a pathological document
grows until the kernel OOM-killer intervenes, which is abrupt, leaves no
diagnostic, and looks identical to a crash.

**Uploads do not buffer.** `evidenceDirectUpload.ts:669-670` streams to disk via
`pipeline(req.stream, writeStream)`, so a 10 GB video does not become 10 GB of
heap. This is the single most important memory decision in the codebase and it
was made correctly.

---

## Bundle size

| Artifact | Size | Note |
|---|---|---|
| `dist/index.js` | **2,118,331 bytes [MEASURED]** | Server-side; size affects startup only |
| `dist/public/assets/index-*.js` | **1,637,754 bytes, 382,610 gzipped [MEASURED]** | Shipped to every browser |
| `dist/public/assets/index-*.css` | 56,321 bytes | |

The frontend bundle is a **single chunk with no code splitting** — Vite warns
about it explicitly at build time. Every user downloads the entire application,
including the Administrator-only certification portal, on first load.

**Compounding this**, two nginx observations from the production audit:

- **No gzip on JavaScript.** The bundle is served at its full 1.6 MB rather than
  383 kB. A 4× penalty on every cold load, and the fix is one nginx directive.
- **No `Cache-Control` on static assets** — only `ETag`. Every navigation
  revalidates. Correct, but a round trip that could be avoided.

Both are nginx configuration, not application changes, and both are worth
including in the Stage F2 edit that already has to raise
`client_max_body_size`.

---

## Upload throughput

| | |
|---|---|
| Chunk size | 8 MB (`certification/uploadPortal.ts:24`) |
| Per-file cap | 500 MB (`evidenceDirectUpload.ts:43`) |
| nginx limit | **1 MB — rejects every chunk today** |
| Buffering | Streamed to disk, not buffered |

With `client_max_body_size 64m` and `proxy_request_buffering off`, throughput
should be bounded by network and disk rather than by the application, since
nothing accumulates in memory. **This has never been measured** — no upload has
ever traversed the production nginx.

The 8 MB chunk size is a reasonable choice: large enough to amortise per-request
overhead, small enough that a failed chunk is cheap to retry.

---

## OCR and text extraction

Sequential, one item at a time, with a 60-second per-item timeout. No
parallelism. On a multi-core host this leaves most of the CPU idle while a
single document is processed.

**This is the dominant cost in the Case 001 path**, and it is the reason the
5-minute pipeline budget is unrealistic. Extraction is CPU-bound and
embarrassingly parallel — different documents share no state.

**Not recommending a change before deployment.** Introducing concurrency to the
extraction loop is a real behaviour change with real risk, and this program is
scoped to identification. But it is the first thing to look at for Version 1.1,
and a concurrency of 4 would plausibly bring a 200-item run inside the existing
budget without touching the timeouts.

---

## AI requests

Serialised, no timeout, no retry, no concurrency control. Fully covered in
[`OPENAI_INTEGRATION.md`](OPENAI_INTEGRATION.md). The performance-relevant part:
**a hung OpenAI connection holds its request indefinitely**, and with it a
database connection from the pool. Under a provider incident this is how the
pool gets exhausted.

---

## Caching

| Layer | Present |
|---|---|
| Statutory retrieval | **Yes** — `LAW_CACHE_MAX_AGE_MS`, default 24 h (`law/lawService.ts:52`) |
| Outbound politeness | **Yes** — `LEGINFO_MIN_GAP_MS`, default 400 ms (`law/officialLawSource.ts:194`) |
| HTTP responses | None |
| Static assets | `ETag` only, no `Cache-Control` |
| Query results | None |

The statutory cache is the one that matters, because leginfo is a public service
being asked for the same handful of Penal Code sections repeatedly, and it is
present and configurable.

---

## Expected throughput

**Stated with low confidence.** No load test has been run against this
application, by me or anyone else, and these are derived from measured startup
and per-operation behaviour rather than observed under concurrency.

| Operation | Estimate | Basis |
|---|---|---|
| Cold start to first `200` | **1.3 s [MEASURED]** | Direct measurement |
| Reload downtime, fork mode | **~2.2 s [MEASURED]** | Direct measurement |
| `/api/health` | Thousands/sec | Returns a literal, no I/O |
| Authenticated reads | Untested under load | Single-process, pooled |
| Concurrent users | **UNKNOWN** | Never tested |
| Upload throughput | **UNKNOWN** | Never traversed production nginx |
| Timeline over 200 items | **Will not complete in one run** | Arithmetic above |

For the intended near-term use — one Administrator uploading Case 001 — none of
the concurrency unknowns matter. They matter before public beta, and they should
not be guessed at then either.

---

## Recommendations

### Before deployment

**P1 · Enable gzip for JavaScript in nginx.** One directive, 4× reduction on the
largest asset. Fold into the Stage F2 edit.

**P2 · Add `Cache-Control` for hashed static assets.** Filenames are
content-hashed, so `immutable` with a long max-age is safe. Also Stage F2.

**P3 · Set `max_memory_restart` under PM2.** A clean logged restart instead of
an OOM kill.

### Before Case 001

**P4 · Measure one evidence item end to end**, then decide whether
`PIPELINE_TIMEOUT_MS` is adequate for the corpus. This is the difference between
a complete timeline and a partial one.

**P5 · Check `warnings[]` on the certification result** before treating any
count as complete. The pipeline reports truthfully; nothing forces you to read
it.

### Version 1.1

**P6 · Parallelise text extraction** with a bounded concurrency. The largest
single win available, and the reason the 5-minute budget currently fails.

**P7 · Batch `extractIndexedText`** into one grouped query rather than one per
item — material only if the database turns out to be remote.

**P8 · Code-split the frontend.** Route-level splitting would keep the
Administrator certification portal out of every user's first load.

**P9 · Make the pipeline resumable.** Ordering the `findMany` and recording a
high-water mark would let repeated runs make progress instead of re-processing
the same first 200 items.
