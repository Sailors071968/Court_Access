# Master Program 7 — California Criminal Repository Certification

> Continued criminal-first acquisition via the Criminal Liability Discovery Engine (Program 68A). Coverage is expanded by targeting **criminal-bearing** codes, not by sequentially crawling administrative codes (the engine's founding principle). Every acquired section is SHA-256 hash-verified.

## Coverage (measured)

- **Codes ingested: 9** — PEN, VEH, HSC, BPC, WIC, FGC, LAB, PRC, GOV
- **Sections: 569** — **100% hash-verified (569/569)**
- **Offenses: 140** · classified sections: 559 · known-criminal: 187

| Code | Name | Sections | Offenses |
|------|------|----------|----------|
| PEN | Penal Code | 201 | 94 |
| VEH | Vehicle Code | 314 | 14 |
| HSC | Health & Safety Code | 18 | 15 |
| BPC | Business & Professions Code | 8 | 7 |
| WIC | Welfare & Institutions Code | 5 | 3 |
| FGC | Fish & Game Code | 8 | 2 |
| LAB | Labor Code | 5 | 4 |
| PRC | Public Resources Code | 5 | 0 |
| GOV | Government Code | 5 | 1 |

Full dashboard: `backend/data/legislative/repositories/criminal-liability-dashboard.md`.

## Repository-backed criminal intelligence (auxiliary repositories)

The program's required cross-cutting artifacts are extracted + hash-stamped during processing:

| Repository | Records | Covers |
|------------|---------|--------|
| offenses | 140 | criminal offenses |
| elements | 754 | offense elements |
| mens_rea | 140 | mental-state requirements |
| statute_classifications | 559 | includes `criminal_enhancement` / `criminal_penalty` (enhancements + sentencing) |
| exceptions | 209 | exceptions / immunities |
| defenses | 9 | statutory defenses |
| cross_references | 893 | cross references |
| regulatory_incorporations | 470 | incorporated regulations |
| calcrim_links | 5 | CALCRIM mappings |
| authorities | 377 | cited authorities |

## Hash Report

- **100% (569/569)** statute sections carry a SHA-256 `contentHash`. Provenance (original leginfo URL + retrieval timestamp) preserved on every record. Integrity re-verifiable via the repository index + `criminalLiabilityRegistry` hash fields.

## Gap Report — remaining codes (18 of 27)

The remaining requested codes are **not yet ingested**. Per the criminal-first architecture, they fall into two groups:

- **Criminal-bearing (next acquisition candidates — add seeds + `discover-criminal`):** Food & Agricultural Code (animal/pesticide crimes), Education Code, Military & Veterans Code, Harbors & Navigation Code, Streets & Highways Code, Public Utilities Code, Water Code (§13387 criminal), Insurance Code (fraud), Corporations Code (securities crimes), Revenue & Taxation Code (tax evasion), Unemployment Insurance Code (fraud), Financial Code.
- **Primarily civil/procedural (few/no criminal offenses — intentionally deferred):** Civil Code, Code of Civil Procedure, Commercial Code, Evidence Code, Family Code, Probate Code.

**Rationale (honest):** ingesting *every section* of civil/administrative codes contradicts the Criminal Liability Discovery Engine's design (Program 68A), which the platform adopted to avoid crawling millions of non-criminal statutes. Criminal-bearing codes are extended by adding curated seed sections to `backend/src/legislative/criminalSeeds.ts`, then running `npm run leginfo:discover-criminal -- --code <CODE> --acquire --process`. Cross-reference expansion (`leginfo:expand-criminal`) then grows coverage outward from confirmed offenses.

## This pass

Added criminal seeds for **WIC, FGC, LAB, PRC, GOV** and acquired + processed them: **+28 sections, +10 offenses, +20 likely-criminal**, taking coverage from 4 → **9 codes**, 130 → **140 offenses**, all hash-verified.

## Verdict

**PARTIAL / ON-TRACK.** 9 codes repository-backed with 100% hash verification and all criminal cross-cutting repositories (enhancements, sentencing, defenses, exceptions, cross-references, incorporated regulations, CALCRIM) populated. Full 27-code coverage is achievable by iterating the documented seed → acquire → process → expand loop on the criminal-bearing codes; civil/procedural codes are deferred by design, not omitted by error.
