# CourtAccess — Status

Last updated by Production Program 144 (Gold Standard Certification System).

Every figure below was produced by executing the platform: PostgreSQL 16 and
Redis 7 provisioned, all Prisma migrations applied, the Fastify API and its
BullMQ workers running, the built SPA served over the same same-origin `/api`
arrangement as production, and a real Chromium driving the interface. Nothing
here is inferred from reading source.

Reproduce with `bash scripts/certification/run-all.sh`.

## Where the platform stands

| | |
|---|---|
| Checks executed | 324 |
| Passed | 317 |
| Failed | 1 |
| Warnings | 6 |
| Production readiness | 95.5% |
| Recommended launch status | READY WITH LIMITATIONS |

## Certification suites

| Suite | Checks | Pass | Fail |
|---|---|---|---|
| Unauthenticated exposure sweep | 2 | 2 | 0 |
| Security — tenant isolation, RBAC, tokens, abuse controls | 34 | 34 | 0 |
| Case-scoped tenant isolation (51 routes) | 3 | 3 | 0 |
| Authenticated read surface (188 GET endpoints) | 5 | 5 | 0 |
| Anti-fabrication audit | 5 | 5 | 0 |
| Evidence traceability and citation | 9 | 9 | 0 |
| CALCRIM, mens rea, investigation, motions | 14 | 12 | 0 |
| Defendant and family access | 12 | 12 | 0 |
| Document, media and failure handling (64 fixtures) | 64 | 62 | 1 |
| Litigation workflow and data integrity | 40 | 40 | 0 |
| Stress and performance | 14 | 14 | 0 |
| Recovery | 14 | 14 | 0 |
| Browser verification | 64 | 61 | 0 |
| Gold Standard certification framework | 27 | 27 | 0 |
| Gold Standard browser verification | 17 | 17 | 0 |

## Gold Standard Certification

An administrator-only module for certifying each release against real
attorney-authorized discovery, so validation is repeatable on the same corpora
rather than on whatever is at hand.

**Status: built, browser verified, ready to receive Case 001.**

- **Import** walks a delivery as counsel sent it — nested folders, unhelpful
  filenames, ZIPs inside the set. Archive members are inventoried
  individually. Hierarchy, filenames and modification times are preserved.
- **The originals are never modified.** Files are copied, never moved, and the
  source tree is only read. Proven by hashing the tree before and after import
  and comparing.
- **The production pipeline is the import pipeline.** `ingestEvidence` —
  validation, storage, the Evidence record, extraction — is one function. The
  multipart route is a thin wrapper over it and the importer calls the same
  function. There is no separate certification path to drift out of step.
- **Classification** separates the mixed pile into the discovery types counsel
  actually sends, judged on extracted text rather than filename, recording the
  phrases that decided it. Anything the evidence does not support is reported
  as unknown rather than guessed.
- **Runs** count what the pipeline produced and enumerate every UNKNOWN and
  every failure with its reason.
- **Regression comparison** diffs a run against the recorded baseline. Because
  the input is byte-identical, any difference is attributable to the build. A
  simulated degraded build is correctly detected.

Reached through Administration → Gold Standard Certification. Restricted to
the administrator role in the route map, again in every handler, and again in
the client route; verified refused for attorney, criminal investigator,
paralegal, law office administrator, expert witness, consultant, criminal
defendant and family member.

## Known limitations

Stated rather than implied.

- **Speech transcription does not exist.** Audio and video are stored and
  listed against the case, but nothing spoken in them is searchable. This is
  the one remaining failing check.
- **The CALCRIM instruction library covers two offences** — Penal Code 459 and
  484. Any other charged count is reported as UNKNOWN, which is correct
  behaviour but is not coverage.
- **Mens rea holds five statutes**, four of them recorded as UNKNOWN.
- **Trial exhibits and litigation strategy have no backend.** The views say so
  rather than rendering an empty state that looks like an answer.
- **ZIP discovery productions** are inventoried and listed but not expanded
  into the case automatically outside the certification importer.
- **Automatic page-orientation detection is not implemented.** A page scanned
  sideways is reported as low-confidence with the possible causes named.

## Not measurable in this environment

Recorded as UNKNOWN, not as passes.

- **Real discovery.** No attorney-authorized case files have been supplied.
  CALCRIM, mens rea and contradiction certification against actual charged
  offences remain uncertified. The framework is built and waiting.
- **Knowledge graph** — Neo4j is not configured.
- **Billing and Stripe** — no keys.
- **Object storage** — no R2/S3 credentials; uploads are held on local disk.
- **Email delivery** — no SES credentials.

## Deployment

Nothing on this branch is deployed and there is no staging URL: this
environment has no public ingress or deployment credentials. Read-only checks
show `courtaccess.net` serving a 26 June 2026 bundle with an API whose health
response predates this codebase, so production is running a build well behind
the repository and none of these repairs are live.

## Importing Case 001

1. Place the delivery on the server, unchanged, e.g.
   `/srv/courtaccess/certification/GS-001`.
2. Sign in as an administrator and open Administration → Gold Standard
   Certification → Import.
3. Enter the reference (`GS-001`) and a label, point at the folder, and
   preview. Confirm the file count matches what counsel delivered.
4. Import. The inventory shows every file with its hash, classification and
   outcome.
5. Run the certification. The first run becomes the baseline that later
   releases are measured against.
