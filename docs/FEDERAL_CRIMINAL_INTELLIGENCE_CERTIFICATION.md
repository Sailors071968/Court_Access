# Federal Criminal Intelligence Certification (Program 45)

**Objective:** construct a complete Federal Criminal Intelligence Platform (U.S. Code,
FRCrP, FRE, Sentencing Guidelines, Pattern Jury Instructions, federal case law,
authorities, cross-references, knowledge graph, integrity, evidence/citation mapping).

**Result: NOT CONSTRUCTED. Federal coverage = 0 (measured).**
Per the Engineering Constitution — **no fabricated coverage percentages; evidence
only; UNKNOWN preferred over unsupported conclusions.** This certification documents
the true current state and the concrete engineering required; it builds no fake
platform and reports no invented coverage.

**Generated:** 2026-07-06.

---

## 1. Current federal coverage (evidence)

| Federal source | Coverage | Evidence |
|----------------|----------|----------|
| United States Code (e.g., Title 18) | **0** | no federal data dir; `data/legislative/raw` = `PEN/` only |
| Federal Rules of Criminal Procedure | **0** | no source/parser in repo |
| Federal Rules of Evidence | **0** | no source/parser in repo |
| Federal Sentencing Guidelines | **0** | none |
| Federal Pattern Jury Instructions | **0** | none |
| Federal Case Law | **0** | none |
| Federal Authorities / Cross-refs | **0** | none |

**Total federal records: 0.** (Consistent with Programs 38 and 44.)

---

## 2. Why zero — the engine is California-only (evidence)

The existing legislative ingestion engine is hard-wired to California `leginfo`:

- `acquisition.ts`: `import { fetchLeginfoPage }`, `CORPUS_PREFIX = 'leginfo'`, session `leginfo-acquire-<code>`
- `htmlParsers.ts` / `leginfoUrls.ts`: parse the CA `leginfo` `tocCode` HTML structure
- `legislativeIngestService.ts`: `source: 'leginfo.legislature.ca.gov'`
- `caCodes.ts`: `CALIFORNIA_CODES`, `getCriminalPriorityCodes` (PEN/EVID/HSC/VEH/BPC)

There is **no federal source connector and no federal document parser**. The CA engine
cannot ingest federal sources as-is — federal law lives on different systems with
different document formats.

---

## 3. Feasibility (evidence — sources are reachable)

Probed from this environment:

| Source | Status | Best ingestion format |
|--------|--------|-----------------------|
| `uscode.house.gov` | **HTTP 200** | **USLM XML** bulk releases (structured) |
| `govinfo.gov` | **HTTP 200** | govinfo bulk-data / API (USLM XML for USC, PDF/XML for rules) |
| `ussc.gov/guidelines` | **HTTP 200** | HTML/PDF (Sentencing Guidelines) |

Acquisition is **feasible**; the blocker is missing federal connectors/parsers, not
network access.

---

## 4. What IS reusable (evidence)

- The **typed repository layer is source-agnostic** — `createRepositories(dir)` writes
  JSONL repositories (statutes, offenses, elements, authorities, cross_references,
  calcrim_links, etc.) that a federal pipeline could populate the same way PEN does.
- The **content-hashing + audit + coverage-report** machinery is reusable across sources.
- The **DB-audit-non-fatal fix** (Program 44) means a federal pipeline can run offline too.

So a federal platform reuses ~the storage/integrity half; the **acquisition + parsing
half must be built new**.

---

## 5. Required engineering (to actually construct this)

1. **Federal source adapters** (mirror `leginfoHttp`/`leginfoUrls` per source):
   - USC → **govinfo USLM XML** (Title 18 first: federal crimes) — structured, parseable.
   - FRCrP / FRE → govinfo (rules) XML/PDF.
   - USSG → ussc.gov (HTML/PDF) with a chapter/§ parser.
   - Pattern Jury Instructions → circuit sources (PDF).
   - Federal case law / authorities → a citation source (e.g., CourtListener API).
2. **Federal parsers** producing the same repository record shapes (offense, element,
   authority, cross-reference, jury-instruction link).
3. **Federal code registry** (analog of `caCodes.ts`) + discovery for USC titles/sections.
4. **Knowledge-graph + cross-reference/authority validation** over federal records.
5. **Coverage report + SHA-256 integrity** (reuse existing machinery).

This is a **greenfield connector/parser effort per source** — not a config change to the
CA engine.

---

## 6. Completion (measured, not estimated)

| Dimension | Measured |
|-----------|----------|
| Federal statutes ingested | **0** |
| Federal rules / guidelines / jury instructions | **0** |
| Federal case law / authorities | **0** |
| Federal source connectors in code | **0** |
| Federal sources reachable (feasibility) | uscode.house.gov, govinfo.gov, ussc.gov = **HTTP 200** |
| Reusable storage/integrity layer | ✅ present (source-agnostic repositories) |

**Federal Criminal Intelligence Certification: DENIED — 0% built.**
No federal platform exists; none was fabricated. The path is clear (sources reachable,
storage layer reusable) but the federal acquisition + parsing connectors are unbuilt.
No coverage percentage is invented.

---

## 7. Reproduce

```bash
cd backend
ls data/legislative/raw                      # PEN only → federal = 0
rg -li "uscode|govinfo|federal.*statute|USLM" src   # no federal ingestion code
rg -n "leginfo|CALIFORNIA_CODES|tocCode" src/legislative/*.ts   # engine is CA-only
curl -s -o /dev/null -w "%{http_code}\n" https://uscode.house.gov/   # 200 → reachable
```
