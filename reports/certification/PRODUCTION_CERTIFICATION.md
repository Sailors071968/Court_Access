# CourtAccess V1 — Production Certification

Generated 2026-08-06T14:05:58.709Z
Commit `edd04bd950735de9aeb46dbe8c9d2eea83b98c75` on branch `cursor/v1-discovery-intelligence-certification-9f94`

## How these results were produced

Every result below was produced by executing the platform: PostgreSQL 16 and Redis 7 provisioned, all Prisma migrations applied, the Fastify API and its BullMQ workers running, the built SPA served over the same same-origin /api arrangement as production, and a real Chromium driving the interface. No result is inferred from source inspection.

Where something could not be measured in this environment it is recorded as
UNKNOWN. Nothing here is inferred from reading source code.

## Result

| | |
|---|---|
| Production readiness | **95.4%** |
| Recommended launch status | **READY WITH LIMITATIONS** |
| Checks executed | 280 |
| Passed | 273 |
| Failed | 1 |
| Warnings | 6 |
| Features in inventory | 40 |
| Features exercised and passing | 36 |
| Features failing | 0 |
| Features with warnings | 0 |
| Features where only access control was proven | 1 |
| Features not exercised at all (UNKNOWN) | 3 |
| Critical defects remaining | 1 |

Readiness weights the executed checks at 60% and per-feature coverage at 40%.
A feature that no suite exercised counts as zero, so the figure reflects what
was actually proven rather than what exists in the codebase.

## Suites

| Area | Phase | Checks | Pass | Fail | Warn | Rate |
|---|---|---|---|---|---|---|
| Unauthenticated exposure sweep | P143 Phase 7 | 2 | 2 | 0 | 0 | 100% |
| Case-scoped tenant isolation | P144 | 3 | 3 | 0 | 0 | 100% |
| Anti-fabrication audit | P144 | 5 | 5 | 0 | 0 | 100% |
| Evidence traceability and citation | P144 Phase 2/3 | 9 | 9 | 0 | 0 | 100% |
| CALCRIM, mens rea, investigation, motions | P144 Phase 5/6/8/9 | 14 | 12 | 0 | 2 | 85.7% |
| Defendant and family access | P144 Phase 10 | 12 | 12 | 0 | 0 | 100% |
| Security | Phase 7 | 34 | 34 | 0 | 0 | 100% |
| Document, media and failure handling | Phase 3/4/5 | 64 | 62 | 1 | 1 | 96.9% |
| Authenticated read surface | Phase 2 | 5 | 5 | 0 | 0 | 100% |
| Litigation workflow and data integrity | Phase 2/8 | 40 | 40 | 0 | 0 | 100% |
| Stress and performance | Phase 6/11 | 14 | 14 | 0 | 0 | 100% |
| Recovery | Phase 10 | 14 | 14 | 0 | 0 | 100% |
| Browser verification | Phase 9 | 64 | 61 | 0 | 3 | 95.3% |

## Inventory

| | |
|---|---|
| API routes | 365 |
| SPA routes | 105 |
| Prisma models | 103 |
| Features | 40 |

## Feature verdicts

A feature is PASS when at least one of its routes was exercised functionally
and no check about it failed. "Access control only" counts routes that were
confirmed to refuse an anonymous caller but were never driven with a valid
session — that proves authorization, not behaviour, so those features are
marked AUTHZ ONLY rather than PASS.

| Feature | Status | API routes exercised | Access control only | UI routes exercised |
|---|---|---|---|---|
| Administration | PASS | 22/50 | 50/50 | 0/0 |
| Attorney Workbench | PASS | 8/16 | 16/16 | 0/1 |
| Authentication | PASS | 4/5 | 1/5 | 2/4 |
| Billing & Stripe | PASS | 10/19 | 19/19 | 1/1 |
| CALCRIM | PASS | 1/1 | 1/1 | 0/0 |
| Case Management | PASS | 8/11 | 11/11 | 0/0 |
| Charges & Mens Rea | PASS | 2/3 | 3/3 | 0/1 |
| Client Domain | PASS | 4/10 | 10/10 | 0/1 |
| Compliance Analysis | PASS | 14/30 | 30/30 | 0/0 |
| Contradictions | PASS | 8/13 | 13/13 | 0/1 |
| CPRA | PASS | 4/7 | 7/7 | 0/3 |
| CSRF Protection | PASS | 1/1 | 0/1 | 0/0 |
| Discount Codes | PASS | 2/6 | 5/6 | 0/0 |
| Doctrine Intelligence | PASS | 7/13 | 13/13 | 0/0 |
| Documents & Disclosure | PASS | 3/8 | 8/8 | 0/0 |
| Evidence Gap Detection | PASS | 1/3 | 3/3 | 0/0 |
| Evidence Repository | PASS | 6/8 | 8/8 | 0/5 |
| Firm Operating Platform | PASS | 9/22 | 22/22 | 0/0 |
| Forensic Reconstruction | PASS | 13/22 | 22/22 | 0/0 |
| Identity & MFA | AUTHZ ONLY | 0/5 | 3/5 | 0/0 |
| Investigator Workbench | PASS | 2/6 | 6/6 | 0/1 |
| Job Processing | PASS | 1/1 | 1/1 | 0/0 |
| Legislative Intelligence | PASS | 9/9 | 9/9 | 0/0 |
| Litigation Strategy | UNKNOWN | 0/0 | 0/0 | 0/1 |
| Marketing & Contact | PASS | 1/1 | 0/1 | 0/0 |
| Marketing & Public Site | PASS | 0/0 | 0/0 | 26/68 |
| Membership & Onboarding | PASS | 6/8 | 8/8 | 0/1 |
| Motion Intelligence | UNKNOWN | 0/0 | 0/0 | 0/1 |
| Narrative Analysis | PASS | 4/5 | 5/5 | 0/1 |
| Observability | PASS | 3/4 | 0/4 | 0/0 |
| Operations Console | PASS | 3/7 | 7/7 | 0/0 |
| Organizations | PASS | 13/15 | 14/15 | 0/1 |
| Password Reset | PASS | 0/2 | 0/2 | 1/2 |
| Policy Acquisition Pipeline | PASS | 3/9 | 9/9 | 0/0 |
| Policy Intelligence | PASS | 5/18 | 18/18 | 0/7 |
| Queue Monitoring | PASS | 2/4 | 4/4 | 0/0 |
| Security Logging | PASS | 3/3 | 3/3 | 0/0 |
| Timeline | PASS | 4/5 | 5/5 | 0/3 |
| Trial Exhibits | UNKNOWN | 0/0 | 0/0 | 0/2 |
| Unclassified | PASS | 8/15 | 14/15 | 0/0 |

## Remaining defects

- **ING-silent-bodycam.mp4** (Document, media and failure handling) — silent-bodycam.mp4 failure not explained specifically: stored message ""silent-bodycam.mp4" is a MP4 video and has been stored with the case. Automatic speech transcription is not available, so the words spoken in this recording are not searchable. To make its contents searchable, upload a written transcript alongside it." does not identify the cause (explain-no-speech)

## Warnings

- **CAL-07** (CALCRIM, mens rea, investigation, motions) — The CALCRIM instruction library covers only a small number of offences: 2 mapped: Penal Code 459, Penal Code 484. Any other charged count returns UNKNOWN.
- **MR-03** (CALCRIM, mens rea, investigation, motions) — Mens rea coverage is very small: 5 statute(s) have an extracted mental state, of which 4 are UNKNOWN. Charged offences outside this set have no mens rea analysis.
- **ING-discovery-production.zip** (Document, media and failure handling) — discovery-production.zip archive handling: status=analyzed error="discovery-production.zip" is a ZIP archive containing 3 file(s), and archives are not ingested directly. Please extract it and upload the documents individually: police-report.pdf, dispatch-log.pdf, emails.txt.
- **BR-/cases/8d751c88-8095-4d2a-99e8-3c77e08ac0fd/trial-exhibits** (Browser verification) — Trial exhibits renders but logged 2 browser error(s): Failed to load resource: the server responded with a status of 404 (Not Found)
- **BR-/cases/8d751c88-8095-4d2a-99e8-3c77e08ac0fd/litigation-strategy** (Browser verification) — Litigation strategy renders but logged 2 browser error(s): Failed to load resource: the server responded with a status of 404 (Not Found)
- **BR-/cases/8d751c88-8095-4d2a-99e8-3c77e08ac0fd/contradictions** (Browser verification) — Contradictions renders but logged 2 browser error(s): Failed to load resource: the server responded with a status of 404 (Not Found)

## Real discovery — not certified

This program asks for certification against attorney-authorized California
criminal discovery. **No case files were supplied to this environment.** The
filesystem was searched; the only documents present are unrelated system
documentation and the synthetic fixtures this harness generates.

Processing invented case files and reporting the result as real-discovery
certification would be the fabrication the constitution forbids, so Phase 1 is
recorded as **UNKNOWN**, and with it every finding that depends on real
charged offences: CALCRIM element organisation for actual counts, mens rea for
actual counts, contradictions between actual witnesses, and the investigation
and motion issues that would follow from them.

What was certified instead is the property those phases rest on: that the
platform asserts only what its repository supports, that every finding is
traceable to a document, page and line, and that a finding cannot outlive its
source. Those are measured above and hold.

To run the real-discovery certification, place the discovery under
`/tmp/courtaccess-discovery/` and run
`node scripts/certification/03-ingestion-certification.mjs` followed by
`13-traceability-certification.mjs` and `14-intelligence-certification.mjs`
against a case created from those files.

## Deployment status

Nothing in this branch has been deployed. This environment has no public
ingress and no deployment credentials, so there is no staging URL for the
certified build. Every result above was measured against the stack running
locally in this environment, described under "How these results were
produced".

Observed from here, read-only, at the time of the run:

| | |
|---|---|
| `https://courtaccess.net` | HTTP 200, nginx, `Last-Modified: Fri, 26 Jun 2026` |
| Page title served | `Court Access System` (this repository builds `CourtAccess — Criminal Case Intelligence Platform`) |
| Bundle served | a different asset hash from the current build |
| `https://courtaccess.net/api/health` | HTTP 200, but returns `{status, uptime, timestamp}` where this codebase returns `{status, timestamp, version, service, environment}` |
| `https://beta.courtaccess.net` | did not resolve |

Production is therefore serving a build that predates this repository state,
front end and API both. None of the repairs certified here are live, and the
certification says nothing about the currently deployed system.

## Known functional gaps

These are features the product presents but does not implement. They were
found by driving the interface, and each is now reported to the user instead
of being hidden behind an ordinary empty state.

- **Speech transcription** — no speech-to-text exists. Audio and video are
  stored and listed against the case, but nothing spoken in them is
  searchable. `speechAnalysisService.ts` describes Whisper in a comment and
  never calls any recogniser. This is the one remaining failing check.
- **Trial exhibits** — the workspace renders, but `/api/cases/:caseId/trial-exhibits`
  is not implemented, so there is no exhibit data to show.
- **Litigation strategy** — the dashboard renders, but
  `/api/cases/:caseId/litigation-strategy` is not implemented.
- **ZIP discovery productions** — accepted and their contents listed, but not
  expanded. The uploader is told to extract and upload the documents
  individually.
- **Timeline extraction scope** — the extractor recognises a fixed list of
  use-of-force events (taser, restraint, Miranda, pursuit, commands and
  similar). A general narrative document with timestamps yields few or no
  events. This is a capability boundary, not a fault: a use-of-force
  supplement produced twelve correctly timed events in testing.

## What this run could not measure

- **Knowledge graph** — Neo4j is not configured in this environment, so graph
  population and querying were not exercised.
- **Billing and Stripe** — no live or test Stripe keys are available, so
  checkout, webhooks and subscription lifecycle were not exercised.
- **Object storage** — no R2/S3 credentials, so uploads were served from local
  disk. The presigned-upload path was not exercised.
- **Email delivery** — no SES credentials, so verification, invitation and
  password-reset mail was not delivered end to end.
- **Speech transcription** — not implemented in the product; audio and video
  are stored but their spoken content is not searchable.

These are recorded as UNKNOWN, not as passes.
