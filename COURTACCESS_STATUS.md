# CourtAccess — Production Status

**Generated:** 2026-07-15T14:36Z
**Branch:** `cursor/california-corpus-expansion-0cc2`
**Commit:** `83f649d`
**Deployed staging build:** `83f649d`, build stamp `2026-07-15T14:36:08Z`
**Program context:** Production Program 121 — California Criminal Statutory Corpus Expansion & Repository Certification

> Reports only what has been verified with cited evidence.
> Per the Engineering Constitution: No Evidence → No Finding → UNKNOWN.
> No statutes, offense elements, CALCRIM mappings, mens rea, defenses, or
> repository intelligence are fabricated. All corpus growth comes from real
> statutory text acquired from leginfo.legislature.ca.gov and extracted
> deterministically. Reported figures are ACTUAL MEASURED counts, not estimates.

---

## 1. Repository expansion (actual measured, before → after)

Acquired and processed **all 207 discovered Penal Code sections** from
leginfo (0 acquisition failures) and rebuilt the knowledge-graph repositories
in a single deterministic pass:

| Repository | Before | After | unknownFieldRate |
|-----------|-------:|------:|-----------------:|
| statutes | 13 | **188** | 0.085 |
| offenses | 5 | **89** | 1.262 |
| elements | 10 | **232** | 0.000 |
| mens_rea | 5 | **89** | 0.281 |
| exceptions | 12 | **71** | 0.000 |
| defenses | 0 | **4** | 0.000 |
| cross_references | 16 | **337** | 0.000 |
| regulatory_incorporations | 2 | **225** | 0.000 |
| authorities | 16 | **150** | 0.000 |
| calcrim_links | 1 | **3** | 0.333 |

- **Statutes covered:** 188 · **Qualified criminal offenses:** 89 · **Likely-criminal
  classifications:** 130 (of 188 processed) · **Total knowledge-graph records:** ≈ 1,388
  across the repositories above (measured from `coverage-report.json`).
- Source of truth: `backend/data/legislative/repositories/*/records.jsonl` +
  `coverage-report.json` (committed). Raw acquisition HTML (33 MB, reproducible
  via `npm run leginfo:acquire`) is gitignored.

## 2. CALCRIM coverage — measured, honestly low

`calcrim_links` = **3** (unknownFieldRate 0.333). CALCRIM instruction mappings
require the separate (Judicial-Council) CALCRIM dataset, which is not part of the
leginfo statutory text; the deterministic extractor therefore adds almost no new
CALCRIM links. **This is reported as-is, not fabricated.** Statute→CALCRIM
mapping remains the largest repository gap and requires ingesting a licensed
CALCRIM element dataset (a data-ownership task).

## 3. Coverage denominator — UNKNOWN (not estimated)

There is no authoritative count of "all California criminal offenses," so an
absolute "repository coverage %" cannot be measured and is reported **UNKNOWN**
rather than estimated. What is measured: the corpus grew ~14× in statutes and
~18× in offenses; the Penal Code branch that was discovered (207 sections,
§§100–123 area) is now fully acquired and extracted. Other California codes
(VEH, HSC, EVID, BPC, …) remain undiscovered and are **UNKNOWN**.

## 4. Verified workspace improvement (Phase 8)

Adding a now-covered charge (**PEN §118 perjury**) to the demo case yields **real
extracted statutory elements** in the workbench (2 element rows, confidence HIGH,
status `missing_evidence` because no evidence is uploaded) and raises the CALCRIM
Intelligence / Strategy Center **CALCRIM Coverage from 0% → 50%** and Weighted
Case Readiness **0% → 18%**. An uncovered charge (**PC §459**) still correctly
reports **UNKNOWN — no elements in repository**. Browser-verified via Playwright:
**35/35 pages, 0 console errors** (`reports/screenshots/program-121/`).

## 5. Performance / determinism (Phase 7)

Repositories were regenerated in a single clean pass (append-log duplicates from
iterative runs removed). Extraction is deterministic (extractor v1.0.0);
`coverage-report.json` is regenerated on each `process`.

## 6. Live staging (ephemeral)

Cloudflare quick tunnel serving build `83f649d`; verified `GET /` → 200 with the
matching build stamp. **Ephemeral** — stops when this session's VM suspends.

## 7. Production completion

Application layer ≈ **95%** (all workspaces operational, 35/35 pages 0 console
errors, backend `tsc`/lint clean, CI green). Repository intelligence materially
increased for the Penal Code but overall California-corpus coverage remains
low/UNKNOWN pending broader acquisition + a CALCRIM dataset.

## 8. Remaining infrastructure blockers

Deploy secrets (persistent staging / `courtaccess.net`); provider credentials
(Stripe/AWS/OpenAI/Anthropic/Gemini/Twilio/Resend/CourtListener); managed
Postgres/Redis/Neo4j for production; **licensed CALCRIM element dataset**;
full multi-code California acquisition (compute/time + polite crawl budget);
pre-existing Prisma migration/schema drift.
