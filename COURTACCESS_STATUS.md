# CourtAccess — Status

Last updated by Production Program 150 (Defence Strategy and Litigation Intelligence).

Every figure below was produced by executing the platform: PostgreSQL 16 and
Redis 7 provisioned, all Prisma migrations applied, the Fastify API and its
BullMQ workers running, the built SPA served over the same same-origin `/api`
arrangement as production, and a real Chromium driving the interface. Nothing
here is inferred from reading source.

Reproduce with `bash scripts/certification/run-all.sh`.

## Where the platform stands

| | |
|---|---|
| Checks executed | 662 |
| Passed | 630 |
| Failed | 0 |
| Warnings | 19 |
| Not measurable here | 13 |
| Engineering pass rate | 95.2% |
| **Release gate** | **NOT READY** |

**The gate is blocked by two things, and neither is an engineering defect.**

No attorney-authorized case has been processed. All twenty certification
corpora are synthetic fixtures created by the test suites. Real-discovery
certification is the one test that exercises the material this platform exists
to handle, and it has not been run — Cases 001, 002 and 003 have never been
uploaded. The portal is built, browser verified and waiting.

Legal coverage is no longer what it was. Program 147 replaced the
hand-maintained offence repository with retrieval from the Legislature's own
publication, so all 29 California codes are now reachable on demand rather than
the four Penal Code sections that had been typed in. What remains thin is
CALCRIM: seven verified instruction correspondences, with every other charge
returning UNKNOWN. The gate's repository criterion still reflects the older
measurement and will clear as instruction mapping is extended.

Every other gate criterion passes: zero critical defects across 662 checks,
zero broken navigation, zero broken permissions or authentication, zero broken
upload pipelines, zero broken traceability, browser verified and stress tested.

Live at **Admin → Production Readiness**, where the gate is evaluated from the
suite results rather than asserted, so the page cannot claim readiness while a
criterion beneath it says otherwise.

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
| Document, media and failure handling (64 fixtures) | 64 | 63 | 0 |
| Litigation workflow and data integrity | 40 | 40 | 0 |
| Stress and performance | 14 | 14 | 0 |
| Recovery | 14 | 14 | 0 |
| Browser verification | 64 | 61 | 0 |
| Gold Standard certification framework | 27 | 27 | 0 |
| Gold Standard browser verification | 17 | 17 | 0 |
| Upload portal API | 22 | 22 | 0 |
| Upload portal browser verification | 21 | 21 | 0 |
| Upload stress | 12 | 10 | 0 |
| Session renewal | 17 | 17 | 0 |
| Production audit | 21 | 20 | 0 |
| Legal knowledge coverage | 22 | 0 | 0 |
| Official California law engine | 37 | 37 | 0 |
| Charging documents | 34 | 34 | 0 |
| Charging documents browser | 17 | 17 | 0 |
| Charge lifecycle | 36 | 36 | 0 |
| Complaint workspace browser | 23 | 23 | 0 |
| Defence strategy and motion intelligence | 30 | 30 | 0 |
| Strategy workspace browser | 15 | 15 | 0 |
| Static statutory dependencies | 7 | 5 | 0 |
| Statutory intelligence browser | 12 | 12 | 0 |
| Executive readiness dashboard | 12 | 12 | 0 |

The legal knowledge suite records no passes by design: every check reports how
thin a repository is, and there is nothing there to pass.

## California law

Program 147 replaced the hand-maintained offence repository with retrieval from
[leginfo.legislature.ca.gov](https://leginfo.legislature.ca.gov/), the
Legislature's own publication. Coverage is no longer a function of what has
been typed in: **all 29 California codes are reachable on demand**, against the
83 hand-entered records the platform previously depended on.

Every retrieval carries its own provenance — the official URL, the legislative
note with its effective date, the section's place in the code, the retrieval
time, and a SHA-256 fingerprint of the text. The fingerprint drives everything
else: synchronisation compares it to detect amendments, and a case pins the
version it was analysed against so the analysis stays reproducible after the
law moves.

The compiler reads structure from the statute's own words — the kind of
provision, the conduct, the mental state, punishments, exceptions, defences,
defined terms and cross-references. Cross-references resolve to the code the
statute names rather than the one being read, including where the Legislature
separates the two by several clauses.

Live at **Admin → Statutory Intelligence**.

### What is still held rather than retrieved

- **CALCRIM correspondence is a verified list of seven.** The Judicial Council
  does not publish the instructions in machine-readable form, so this grows by
  verification, not retrieval. Those entries hold no statutory text — elements
  are compiled from the official source every time — and a charge outside the
  list returns UNKNOWN rather than a guessed instruction number.
- **The JSONL legislative repositories remain**, 83 records read by ten
  modules. They carry no official URL or fingerprint, so anything sourced from
  them sits outside the guarantees above. Migrating those readers to the
  discovery engine is the next step.

No module holds a hardcoded offence, statutory element or mental state any
more. The two element tables that remained were converted into what they
legitimately are — vocabulary for searching discovery — and each now names the
official section it looks for.

## Charges

Program 148 models charging documents as the sequence of filings they are
rather than as a list. The People file a complaint, amend it, file an
information, dismiss counts and renumber what is left, sever a codefendant —
and what the defendant faces today is whatever the latest filing says.

**Nothing is ever destroyed.** Superseding a document marks it and leaves its
counts exactly as the People wrote them, because the earlier pleading is the
basis of every motion already filed against it. The delete endpoint refuses and
explains why rather than returning a bare error.

- **Charge text is verbatim.** The People's wording is what a motion quotes, so
  it is never normalised or paraphrased. A normalised citation is stored beside
  it, not instead of it.
- **Every charged section resolves against the Legislature** through the
  Program 147 engine, so a count carries the official text of the statute it
  charges. A count whose section cannot be read is still recorded, with the
  reason.
- **Counts are matched across filings on the provision charged**, not the count
  number, so a count that moves from 2 to 3 is reported as renumbered rather
  than as a dismissal and an addition.
- **Changes are named in words**: counts added, counts no longer charged,
  renumbering, rewritten allegations, enhancements added and dropped, and
  defendants added, removed or severed.
- **The analysis engines follow the operative document.** When a new filing
  changes what is charged, the charge table those engines read is rebuilt from
  it, so CALCRIM and mens rea track the counts actually on file.

Charges may cite any of the 29 California codes. Live on any case under
**Charges**.

### The complaint workspace

Program 149 made charge entry a browser workflow. An attorney files a charging
document from the case itself: pick the document kind, choose the code from the
selector, enter the section and the People's wording, tick the allegations
pleaded, preview it, file it. No API call is needed at any point.

- **A draft changes nothing until it is filed.** A pleading can be built over
  several sittings without the case analysis moving underneath the person
  building it. Filing it makes it operative and rebuilds the charges every
  analysis reads.
- **An amendment can be copied from a prior filing**, carrying its counts and
  allegations forward, because amendments usually change a little and repeat
  the rest.
- **Counts carry the allegations that change exposure**: attempt, strike,
  serious and violent felony, three strikes, gang, firearm, great bodily
  injury, special circumstance, sex registration, prior convictions, drug
  weight and restitution.
- **Maximum exposure is reported as the People pleaded it and never
  calculated.** A term computed from a statute and shown as a number would be
  relied on in plea discussions.
- **A pasted charging document can be read automatically**, with confidence
  reported per field and the result presented as a proposal for review. Fields
  an attorney corrects are marked so the parser will not write over them.
- **Every manual correction is audited** with the field, both values, the
  author and the time.
- **A filing locks once the case relies on it.** It can be superseded or its
  counts dismissed, never altered, because a motion already argues against what
  it says.

A defendant and count matrix shows who is charged with what, distinguishing
charged, dismissed, severed and not charged on that count.

## Defence strategy

Program 150 organises the record into the thirty-one themes a defence lawyer
thinks in — identity, alibi, self defence, lack of intent, the Fourth
Amendment, Miranda, chain of custody, credibility and the rest. A theme appears
because a document said something, and the passage that raised it is quoted
with its source, so every entry can be checked against the original.

**It organises and does not conclude.** Nothing says a defence is available,
sound or worth running; a certification check asserts the response contains no
advisory or predictive language at all. A theme with nothing behind it is
reported as unsupported with the reason, because "nothing found on alibi" and
"we never looked" are different answers.

Motion intelligence raises the procedural and constitutional issues the record
touches, each phrased as warranting attorney review and never as advice to
file. Live on any case under **Litigation Strategy** and **Motions**.

### Two fabricated widgets removed

The staff dashboard showed five invented alerts to every user on sign-in,
naming a case that does not exist, quoting a case number nobody was assigned,
carrying fixed strings like "2 hours ago", and announcing a motion
recommendation nobody had made — all under a heading reading "Alerts & Action
Queue, sorted by urgency". A second widget showed three invented hearings and
deadlines dated February and March 2024.

Both are gone. The action centre now counts real outstanding work — evidence
that failed to process, investigation tasks outstanding, charges amended,
cases with no charging document, hearings inside a fortnight — and each entry
links to the record it is about. The schedule reads the hearing dates on the
cases and says plainly when there are none.

The Program 146 fabrication audit missed both because it looked for a named
variable holding a literal dataset, and these were written inline inside the
render. The audit now catches inline literal arrays whose content reads as a
fact about a case, verified by running it against the previous version of the
file, which it fails.

### What Program 150 did not build

Stated rather than implied. The programme asked for ten surfaces; four were
built or repaired and the rest were not reached:

- **Administrative Operations Center** — not built. The billing metrics API
  exists and returns real MRR and subscription counts, but there is no revenue,
  churn or subscriber dashboard consuming it.
- **Customer Support Console** — not built. There is no ticket model, no
  per-subscriber diagnostic view, and no support workspace.
- **Attorney War Room** — not built as specified. The existing Attorney
  Workbench covers much of it and reads real data, but it was not extended to
  the unified view the programme describes.
- **Family Dashboard** — not built as specified. Family members reach the
  client portal, which shares the defendant dashboard; the simplified
  family-specific view with suggested questions was not built.

## Gold Standard Certification

An administrator-only module for certifying each release against real
attorney-authorized discovery, so validation is repeatable on the same corpora
rather than on whatever is at hand.

**Status: built, browser verified, ready to receive Case 001.**

- **Discovery is uploaded from the administrator's own computer.** Drag a
  folder onto the page or pick one with the file dialog. No SSH, no SFTP, no
  Cyberduck, no shell, no copying files onto the server. The import step never
  asks for a path on the server, and browser verification asserts that no such
  field remains.
- **Import** walks a delivery as counsel sent it — nested folders, unhelpful
  filenames, ZIPs inside the set. Archive members are inventoried
  individually. Hierarchy, filenames and modification times from the
  operator's machine are preserved end to end.
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

### The upload portal

Files are sent in 8 MB chunks and appended into a staging tree that mirrors the
folder the operator selected, which the importer then treats exactly like a
delivery already on disk. Chunking keeps browser memory flat regardless of file
size and makes an interrupted transfer resumable.

- **Resume is derived from the bytes on disk**, not from a bookkeeping record,
  so a crash mid-upload cannot leave the two disagreeing. The browser asks what
  the server holds and sends only the remainder. A chunk offered for the wrong
  offset is refused with the true offset rather than appended in the wrong
  place, and a transfer that ends short of its declared size is rejected
  instead of being kept as a truncated file.
- **Progress** reports overall percentage, bytes transferred, speed, estimated
  time remaining and files left. Speed is measured over a sliding window, so
  the estimate reacts to a change in connection rather than averaging since the
  start. Pause, resume, cancel and retry all act on the transfer itself; retry
  re-sends only the files that failed.
- **Review before processing.** The operator sees documents, videos, audio,
  images and page counts, with estimated OCR, media and analysis time and the
  basis for the estimate stated, and must confirm before anything runs.
  Anything that could not be measured is named individually rather than
  averaged away.
- **Live processing.** Commit returns immediately and the pipeline reports its
  stage as it goes — reading the delivery, ingesting, fingerprinting the
  corpus, building repositories, complete.
- **Paths are validated** against traversal, Windows drive letters and reserved
  device names before anything is written.

Measured on this machine:

| Payload | Result |
|---|---|
| 100 MB | complete, 0.2s |
| 500 MB | complete, 1.0s at 534 MB/s |
| 1 GB | complete, 2.0s at 534 MB/s |
| 5 GB | complete, 9.0s at 595 MB/s |
| 10 GB | complete, 18.0s at 597 MB/s |
| 5 simultaneous uploads | all complete, 545 MB/s aggregate |
| 210 MB cut off at 75 MB | resumed, reassembled SHA-256 identical |
| 2,000-page PDF | uploaded, all 2,000 pages counted |

These rates are loopback on one machine and are a ceiling, not what a
solicitor's office connection will see; the figures show the portal is not the
bottleneck, not what a remote upload will take.

Reached through Administration → Gold Standard Certification. Restricted to
the administrator role in the route map, again in every handler, and again in
the client route; verified refused for attorney, criminal investigator,
paralegal, law office administrator, expert witness, consultant, criminal
defendant and family member.

## Known limitations

Stated rather than implied.

- **Speech transcription does not exist.** Audio and video are stored, listed
  against the case and measured for running time, but nothing spoken in them is
  searchable. A recording that carries no audio track, and one whose audio is
  effectively silent, are now told apart and explained separately with the
  measured peak level quoted — but a recording with ordinary audible speech is
  still only stored, not transcribed.
- **Statutory coverage is now the whole of the California codes**, retrieved on
  demand. What remains thin is CALCRIM: seven verified instruction
  correspondences, with everything else UNKNOWN.
- **The compiler is a first version.** It reads mental state, conduct and
  references out of statutory language with rules, not with a model of
  statutory construction. It is right on the sections tested and reports
  UNKNOWN where the words do not settle a question, but it has not been
  measured across the whole code.
- **Retrieval depends on a public service.** If leginfo is unreachable the
  affected sections are reported as unavailable with the reason, which is
  correct but is still an outage. Cached law continues to serve.
- **Trial exhibits and litigation strategy have no backend.** The views say so
  rather than rendering an empty state that looks like an answer.
- **ZIP discovery productions** are inventoried and listed but not expanded
  into the case automatically outside the certification importer.
- **Automatic page-orientation detection is not implemented.** A page scanned
  sideways is reported as low-confidence with the possible causes named.
- **Upload throughput has only been measured over loopback.** Behaviour over a
  real connection — high latency, packet loss, a connection that drops rather
  than one the client chooses to pause — has not been exercised. The resume
  mechanism is designed for it and works when the transfer is interrupted, but
  that is not the same as having been proven against a genuinely unreliable
  network.
- **Ingestion still caps a single non-video file at 500 MB** and a video at
  10 GB. The portal will carry larger files into staging, but ingestion refuses
  them. A discovery set containing a single document above 500 MB needs those
  limits raised before it will import.
- **A browser refresh mid-upload loses the client's place.** The bytes already
  received are kept on the server and the session survives, but the page does
  not currently re-attach to an upload in progress: the operator would reselect
  the same folder, and the transfer then resumes from what the server holds
  rather than starting over.

## Not measurable in this environment

Recorded as UNKNOWN, not as passes.

- **Real discovery.** No attorney-authorized case files have been supplied.
  CALCRIM, mens rea and contradiction certification against actual charged
  offences remain uncertified. The framework and the upload portal are built
  and waiting. **No attorney-authorized case has been processed**, by design:
  the three cases will be imported only when an administrator selects one
  through the portal.
- **A 20,000-page document and a 20-hour recording.** Neither exists here and
  neither fits the available disk. A 2,000-page PDF is measured and its pages
  counted; page counting reads the PDF page tree and duration reads the
  container header rather than decoding, so neither is expected to scale with
  size — but that has not been demonstrated at those figures.
- **Knowledge graph** — Neo4j is not configured.
- **Billing and Stripe** — no keys.
- **Object storage** — no R2/S3 credentials; uploads are held on local disk.
- **Email delivery** — no SES credentials.

## Deployment

Nothing on this branch is deployed and there is no permanent staging URL: this
environment has no public ingress or deployment credentials. Read-only checks
show `courtaccess.net` serving a 26 June 2026 bundle with an API whose health
response predates this codebase, so production is running a build well behind
the repository and none of these repairs are live.

A temporary Cloudflare tunnel has been used for hands-on review during
Programs 145 and 146. It is not a staging environment: it points at a
disposable VM, it disappears when that VM stops, and real attorney-authorized
discovery must not be uploaded through it.

## What would close the gate

1. **Upload Case 001 through the portal** at Admin → Gold Standard
   Certification → Import, on a deployment you control. Then 002 and 003. This
   is the only item that cannot be completed by engineering.
2. **Extend CALCRIM correspondence and migrate the remaining repository
   readers.** Statutory text is now retrieved rather than stored, so what is
   left is the instruction mapping and the ten modules still reading the JSONL
   repositories.
3. **Raise the ingestion size caps** if any case contains a single non-video
   document above 500 MB.

Items 1 and 2 are independent: real discovery can be certified for ingestion,
traceability and repository population while legal coverage is still thin, and
the readiness dashboard will report each separately.

## Importing Case 001

Everything happens in the browser, from the administrator's own computer.
Nothing needs to be placed on the server first.

1. Sign in as an administrator and open Administration → Gold Standard
   Certification → Import.
2. Enter the reference (`GS-001`) and a label.
3. Drag the discovery folder onto the page, or use **Select Folder** and choose
   it in the file dialog. **Select Discovery** picks individual files instead.
   Mac, Windows and Linux all work; the folder structure is preserved as it is
   on your machine.
4. Watch it upload. Pause and resume at will. If the connection drops, reselect
   the same folder — the transfer continues from what the server already holds
   rather than starting again.
5. Review what arrived: file counts by type, pages, running times and the
   estimated processing time. Confirm the totals match what counsel delivered
   before going further. **Nothing is processed until you confirm.**
6. Confirm and process. The dashboard reports each stage as it runs.
7. The inventory then shows every file with its hash, classification and
   outcome, and the certification run reports what the pipeline produced. The
   first run becomes the baseline that later releases are measured against.
