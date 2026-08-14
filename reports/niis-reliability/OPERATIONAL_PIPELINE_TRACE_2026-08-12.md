# Operational Debug — Lifecycle Trace (2026-08-12 Sacramento PDF)

**Assignment:** Do not fix symptoms. Trace the complete lifecycle. Restore one coherent pipeline.  
**Status:** DEFECT CONFIRMED — screens were not sharing one Daily Case source of truth.

---

## Verdict

NIIS has not failed conceptually. The operational workflow was **not executing as a single pipeline**.

Three screens were reading three different things:

| Screen | What it was reading | Why it lied |
|---|---|---|
| Upload Files | `InmateImportJob` / local UI `phase` | Can show `uploading` while bytes exist or while process never started |
| Morning Operations / Ops Console | `getMorningSummary` → last **any** completed batch + batches by `startedAt` today | Emitted “No roster imported for N hours” even when today’s upload row exists |
| Today's New Inmates | `getNewInmates` **without** facility/date → global `isFirstAppearance` | Surfaced seed/demo bookings (NGUYEN, GARCIA…, booking dates 2026-08-09/10, 100% confidence) as “today” |

---

## Stage-by-stage (agent environment evidence)

Agent DB (`courtaccess_verify`) does **not** contain `SACJAILSCAN08-12-2026.pdf`.  
Trace for ops date `2026-08-12` therefore stops at stage 1 here. Production/operator environment must re-run:

```bash
cd backend && npx tsx scripts/trace-daily-case-pipeline.ts --date 2026-08-12
# or
GET /api/admin/intelligence/daily-case-pipeline?facility=sacramento&opsDate=2026-08-12
```

| Stage | Verdict (agent DB) | Tables | Evidence |
|---|---|---|---|
| 1. Upload received | **FAIL** | `inmate_roster_uploads` | No row matching 2026-08-12 / SACJAILSCAN |
| 2. Import Job created | BLOCKED | `inmate_import_jobs` | Relation **does not exist** on agent DBs — migrations behind code |
| 3. File stored | BLOCKED | — | Stopped at 1 |
| 4. Parser executed | BLOCKED | `inmate_ingestion_batches` | No batch for 2026-08-12 |
| 5. Canonical roster written | BLOCKED | `inmate_roster_snapshots` | — |
| 6. Previous certified roster loaded | BLOCKED | — | — |
| 7. Comparison executed | BLOCKED | `inmate_daily_cases` | No DailyCase for 2026-08-12 |
| 8. New inmate list generated | BLOCKED | — | — |
| 9. Morning Operations updated | **MISWIRED (code)** | — | Headline used last-batch-anywhere hoursAgo |
| 10. Today's New Inmates updated | **MISWIRED (code)** | `inmate_bookings` | Unscoped `isFirstAppearance` |
| 11. Report generated | BLOCKED | — | — |

### Seed/demo rows that were being shown as “today”

From `courtaccess_verify` (`isFirstAppearance = true`):

| Name | bookedAt | identityConfidence |
|---|---|---|
| BAKER | 2026-08-10 | 100 |
| SILVA | 2026-08-10 | 100 |
| OKAFOR | 2026-08-10 | 100 |
| SMITH | 2026-08-09 | 100 |
| WASHINGTON | 2026-08-09 | 100 |
| GARCIALOPEZ | 2026-08-09 | 100 |
| OBRIEN | 2026-08-09 | 100 |
| NGUYEN | 2026-08-09 | 100 |

These match the red-flag pattern (round confidence, old booking dates, fixture surnames).

---

## Root cause (finite)

1. **Upload completed but import never started** — UI phase `uploading` / job file stuck `pending|uploading` blocks `maybeAutoProcess`.  
2. **OR import finished but Morning Summary ignored today’s upload** — counted only completed batches with today’s `rosterDate` / `startedAt`, not `InmateRosterUpload` / DailyCase.  
3. **Today’s New Inmates never asked for DailyCase set-diff** — default API call omitted `facility` + `from`, so repository fell back to global first appearances (seed data).

In every case: **UI components out of sync because they did not share DailyCase.**

---

## Fix applied (plumbing only — no new features)

1. **`dailyCasePipeline.ts`** — single pipeline state object (flags + stage evidence).  
2. **`getNewInmates`** — requires facility + ops date; refuses unscoped history; returns empty with `No certified results available` / `Processing…` / `Awaiting comparison…` until DailyCase comparison finishes.  
3. **`NewInmates.tsx`** — always queries Sacramento + ops date; never renders fabricated rows.  
4. **`getMorningSummary` / Morning Board** — headline and counts prefer Daily Case pipeline; never claim “no roster for N hours” when today’s PDF upload exists.  
5. **API** `GET /api/admin/intelligence/daily-case-pipeline`  
6. **Trace script** `backend/scripts/trace-daily-case-pipeline.ts`

---

## Operator next step (production)

1. Open Morning Operations → confirm **Daily Case pipeline** panel shows stage verdicts for today.  
2. If blocked at “File stored” / “Parser executed” with phase uploading: resume Import Job / re-process upload (`POST /process`).  
3. Ensure yesterday’s certified snapshot exists before expecting comparison.  
4. Only after `comparisonFinished=YES` should Today’s New Inmates show real set-diff rows.  
5. Re-run corpus certification against investigator ground truth.

Until stage 7 PASSes, accuracy debates are premature — the PDF has not finished the shared pipeline.
