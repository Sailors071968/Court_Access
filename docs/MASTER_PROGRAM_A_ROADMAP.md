# Master Program A — Criminal Litigation OS: Engineering Review, Gap Register & Roadmaps

**Purpose:** the definitive engineering review + capability-gap register + technical /
engineering / product / innovation roadmaps + 5- and 10-year visions for turning
CourtAccess into the operating system for criminal litigation.

**Relationship to prior work (no duplication):** this consolidates and points to the
existing evidence base rather than repeating it —
`V2_CASE_INTELLIGENCE_ARCHITECTURE.md` (canonical model + graph),
`ATTORNEY_ASSISTANT_CERTIFICATION.md`, `V2_ENGINEERING_REVIEW_AND_ROADMAP.md`, and the
Program 34–53 certifications. Every capability claim is evidence-linked; every ranking
is labeled **[SUBJECTIVE]**. Engineering Constitution applies — UNKNOWN over
unsupported conclusions; nothing inflated.

**Generated:** 2026-07-06.

---

## 1. Current-state snapshot (evidence)

| Pillar | Built (verified) | Gap |
|--------|------------------|-----|
| Canonical Case Intelligence model | `buildCaseIntelligence`/`AttorneyIntelligenceReport` | not yet the sole read-path for all pages |
| Unified Knowledge Graph | engine + `evidence_graphs`/`evidence_links` | required citations/authorities not enforced; not auto-updated on ingest |
| Legal intelligence acquisition | **CA Penal Code** (90 offenses, hashed) | 28 CA codes, federal, rules, CALCRIM (4.4%), forms, appellate decisions |
| Digital twin (facts/timeline/evidence/…) | timeline+graph+evidence+claim models | entity extractors (location/vehicle/phone/financial) absent |
| Attorney workspace | flagship UI + recommendation engines | prosecution theories, voir dire; heuristic confidence |
| Investigator intelligence | workspace + gaps/tasks | auto scene-reconstruction, chain-of-custody alerts partial |
| Collaboration | permission engine + unlimited designees | invisible-boundary UX partial |
| Litigation assistant | **none** (no LLM/RAG) | build with enforced citations |
| Document auto-extraction | OCR + claim/timeline/contradiction | location/vehicle/phone/org/financial extraction absent |
| Search | global palette, 24 types, ⌘K | non-case indexes are dev-only until backend wired |
| Operations | PM2/health/metrics/rollback tooling | runtime UNVERIFIED (BLK-001); no tracing; in-memory rate limit |
| Security | auth/CSRF/JWT/MFA/upload/SQLi/audit, 22/22 | no DAST/pentest; at-rest UNKNOWN |
| Leadership dashboards | ops/engineering/repository dashboards | 6 disconnected; live metrics UNKNOWN |

---

## 2. Capability gap register (the complete list)

**Critical (block V1 GA):** BLK-001 deploy · BLK-003 migration drift (29 tables) ·
BLK-004 Stripe live cert · runtime E2E certs unexecuted (Attorney/Investigator).

**High (block "leader" status):** no litigation assistant · no constitutional-analysis
engine · federal law = 0 · CALCRIM 4.4% · entity extractors absent · graph citations
not enforced/auto-updated · judicial & prosecutor analytics not built.

**Medium:** 6 disconnected dashboards · in-memory rate limiter · no distributed tracing
· heuristic confidences (pdf/motion/extraction) · no PPTX export · service-layer
retry/timeout gap · SMS unimplemented · 1.6 MB JS bundle (no code-splitting).

---

## 3. What prevents CourtAccess from becoming the unquestioned leader

Ranked critical path (evidence-based):

1. **It is not deployed** (BLK-001) — a leader must be running and runtime-verified.
2. **Database will not deploy cleanly** (BLK-003) — 29-table migration drift.
3. **Legal corpus is one CA code** — leadership requires the full CA + federal corpus.
4. **No evidence-governed assistant** — the headline V2 differentiator is unbuilt.
5. **No constitutional/federal/jury intelligence** — depth gaps vs the vision.
6. **Runtime unproven** — OCR metrics, ops, security DAST all UNKNOWN.

Resolving 1–3 makes it shippable; 4–6 make it differentiated. Until then, "unquestioned
leader" is **[SUBJECTIVE] and not supported** — the honest status is *strong pre-1.0*.

---

## 4. Competitive comparison (measurable vs subjective)

**Measurable capabilities** (verified): unified case-intelligence model; knowledge-graph
engine; evidence-governed extraction with required citations; hash-verified statute/
offense repositories (CA PEN); OCR pipeline with queues/retries; courtroom presentation
with audience modes; global command-palette search.

| vs category | Measurable edge | Measurable deficit |
|-------------|-----------------|--------------------|
| Traditional case management | integrated intelligence model + graph | not deployed; no billing cert |
| Evidence management | citation-enforced extraction + chain of custody | OCR metrics unverified; no ASR |
| Litigation support | timeline/graph/presentation engines | no PPTX; heuristic confidences |
| Legal research | hash-verified repositories | single CA code; no federal/case-law breadth |
| AI legal assistants | (none) | **no assistant at all** |

**[SUBJECTIVE] judgment:** architecturally more *integrated* than typical siloed tools;
**not** ahead of mature legal-research or AI-assistant products on shipped breadth.

---

## 5. Technical roadmap
- Reconcile migration drift (Prisma diff + shadow DB); enforce graph-node citation schema.
- `useCaseGraph` single read-path; refactor pages off direct `caseApi` calls.
- Auto-graph ingestion pipeline (upload → timeline/graph/repos/unknowns/contradictions).
- Entity extractors (location/vehicle/phone/org/financial) with `evidenceId` + confidence.
- Replace heuristic confidences with measured metrics or UNKNOWN.

## 6. Engineering roadmap
- Deploy V1 greenfield + verify gate; runtime certifications; dry-run rollback.
- Redis-backed rate limiting; OpenTelemetry tracing; `npm audit` + SAST/DAST in CI;
  disaster-recovery + automated backups; zero-downtime deploy; migration-verify gate.
- Bundle code-splitting; performance budget (Lighthouse).

## 7. Product roadmap
- Complete CA criminal codes (EVID/HSC/VEH/BPC/WIC) → federal → rules/forms/CALCRIM.
- Litigation assistant (RAG w/ enforced citations + refusal).
- Judicial & prosecutor evidence-backed profiles (observed vs inferred, labeled).
- Collaboration invisible-boundary polish; per-role optimized dashboards.
- Daily-use ergonomics: pinned cases, session restoration, multi-monitor, smart notifications.

## 8. Innovation roadmap
- Provable citation coverage + zero-hallucination assistant evaluation harness.
- Continuous-improvement loop measuring parser accuracy, unknown-reduction, coverage growth (no estimates).
- Litigation Digital Twin: living, auto-synchronized case model; scene reconstruction.

## 9. Five-year vision
Ship V1 GA (Y1) → intelligence depth: federal + constitutional + assistant (Y2) →
scale + measured analytics + multi-region (Y3) → multi-state + treatises/rules breadth
(Y4) → open platform + ML improvement loop (Y5). (Mirrors `V2_ENGINEERING_REVIEW_AND_ROADMAP.md` §4.)

## 10. Ten-year vision
- The **canonical evidence-governed criminal-litigation graph** across states + federal,
  continuously acquired (versioned/hashed/audited).
- An assistant that is **provably non-hallucinating** (every answer citation-bound or refused).
- Digital twins for every case; courtroom-ready output on demand.
- An open ecosystem (APIs, integrations) where CourtAccess is the **system of record**
  for criminal-defense intelligence. **[SUBJECTIVE] aspiration** — stated as vision, not fact.

---

## 11. Verdict

Master Program A's vision is **coherent and largely specified**; the **foundation is
real** (canonical intelligence model, graph engine, unified UI, CA Penal Code corpus,
static security), but the platform is **pre-1.0, undeployed, single-code, assistant-less**.
The roadmaps above define the path; no comparison or completion figure is inflated, and
every leadership claim is labeled subjective. UNKNOWN remains preferred over unsupported
conclusion throughout.
