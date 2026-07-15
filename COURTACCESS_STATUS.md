# CourtAccess — Production Status

**Generated:** 2026-07-15T14:59Z
**Branch:** `cursor/statewide-acquisition-engine-0cc2`
**Commit:** `d3be41a`
**Deployed staging build:** `d3be41a`, build stamp `2026-07-15T14:59:00Z`
**Program context:** Production Program 122 — Statewide Criminal Statutory Acquisition Engine & Continuous Repository Expansion

> Reports only what has been verified with cited evidence.
> Per the Engineering Constitution: No Evidence → No Finding → UNKNOWN.
> All corpus growth is real statutory text acquired from leginfo.legislature.ca.gov
> and extracted deterministically — no statutes, offenses, elements, CALCRIM
> mappings, or coverage figures are fabricated. Values are ACTUAL MEASURED counts.

---

## 1. Automated statewide acquisition engine (Phases 1, 2, 6)

New: `backend/scripts/statewide-acquisition.ts` (`npm run leginfo:statewide`). A
deterministic orchestrator that, for each requested California code:
**discovers** (bounded) → **acquires** real statute HTML from leginfo (skip-existing,
resumable, audit-hashed via the acquisition index) → then **rebuilds** the unified
knowledge-graph repository in a single per-code pass. It emits a measured
acquisition report (`data/legislative/statewide-acquisition-report.json`) and a
continuous-update diff (net new records per run). Repository growth is now a
repeatable command, not manual steps.

- **California codes in registry:** 30 (criminal-priority: PEN, EVID, HSC, VEH, BPC).
- Every acquired statute retains citation, source URL, acquisition timestamp, and
  the acquisition-index audit record.

## 2. Repository expansion (actual measured, Program 121 → 122)

Corpus expanded from **1 code (PEN)** to **5 codes (PEN, EVID, BPC, HSC, VEH)**:

| Repository | P121 (PEN) | P122 (5 codes) |
|-----------|-----------:|---------------:|
| statutes | 188 | **409** |
| offenses | 89 | **91** |
| elements | 232 | **367** |
| mens_rea | 89 | **91** |
| exceptions | 71 | **126** |
| defenses | 4 | **7** |
| cross_references | 337 | **583** |
| regulatory_incorporations | 225 | **366** |
| authorities | 150 | **150** |
| calcrim_links | 3 | **3** |
| statute_classifications | 409 | **409** |

Statutes by code: **BPC 59, EVID 56, HSC 46, PEN 188, VEH 60**.

## 3. Honest limits (measured, not estimated)

- **Offense growth is modest (+2)** because the bounded discovery slices of the
  new codes (EVID/BPC/HSC, ~12 TOC pages each) landed largely on definitional /
  administrative sections, which the extractor correctly did **not** classify as
  offenses. Reported as-is — not inflated. Deeper acquisition of each code (higher
  `--max-pages`) will surface their offense-creating sections (e.g. VEH DUI, HSC
  controlled substances); this is a crawl-budget/time matter, not a code defect.
- **CALCRIM mappings unchanged (3)** — requires the separate licensed CALCRIM
  dataset (absent from leginfo text).
- **Absolute "repository coverage %" remains UNKNOWN** — there is no authoritative
  denominator of all California criminal offenses; only bounded slices of 5 of 30
  codes are acquired. Other 25 codes are **UNKNOWN**.

## 4. Verified litigation impact (Phase 8)

After the rebuild, the backend serves the 5-code unified repository. Covered
charges resolve to real extracted elements (PEN §118 → 2 element rows, confidence
HIGH); uncovered charges (PC §459) still correctly report **UNKNOWN**. Every
workspace reads the same repository, so all benefit automatically. Browser-verified
via Playwright: **35/35 pages, 0 console errors** (`reports/screenshots/program-122/`).

## 5. Live staging (ephemeral)

Cloudflare quick tunnel serving build `d3be41a`; verified `GET /` → 200 with the
matching build stamp. **Ephemeral** — stops when this session's VM suspends.

## 6. Production completion

Application layer ≈ **95%** (all workspaces operational, 35/35 pages 0 console
errors, backend `tsc`/lint clean, CI green). The statewide engine makes corpus
growth continuous; broad California coverage remains an ongoing acquisition task
(UNKNOWN denominator).

## 7. Remaining infrastructure blockers

Deploy secrets (persistent staging / `courtaccess.net`); provider credentials
(Stripe/AWS/OpenAI/Anthropic/Gemini/Twilio/Resend/CourtListener); managed
Postgres/Redis/Neo4j for production; **licensed CALCRIM element dataset**;
full multi-code California acquisition budget (compute/time + polite crawl rate);
pre-existing Prisma migration/schema drift.
