# Product roadmap to public beta — Program 178

Assumes deployment has completed successfully. Excludes deployment,
infrastructure and certification, which are covered in `deploy/`. This is about
the product a criminal defence attorney would actually use.

Every item cites evidence. Where something is a judgement about product
readiness rather than a code fact, it is marked **[JUDGEMENT]** so it can be
argued with.

---

## CRITICAL — public beta is not defensible without these

### C1 · Safari is unverified, and the primary user is on a Mac

All 116 browser checks ran on Chromium. The upload portal's folder selection
uses `webkitdirectory`, whose behaviour differs across engines, and the
documented fallback — **Select Discovery** with multi-file selection — has never
been exercised in Safari either.

**Why critical:** the first real user is intended to drag discovery from Finder
in Safari. A public beta of a legal platform where the upload does not work in
Safari is not a beta, it is an outage with an audience. No command on a server
settles this; it needs a person with a Mac.

### C2 · Nothing spoken in a recording is searchable

Speech-to-text is not implemented — confirmed across `backend/src`. Audio and
video are stored, and their durations measured via ffprobe
(`certification/mediaProbe.ts`), and that is all.

**Why critical [JUDGEMENT]:** this is a product-claim problem more than an
engineering one. Program 145 named "Audio processing" and "Transcript line
numbering" in the pipeline; Program 150 promised traceability to "video
timestamp" and "audio timestamp". A jail call or a bodycam recording is often
where the case actually turns. Either implement it or state plainly, in the
interface, that media is stored but not transcribed — because an attorney who
searches for a phrase, finds nothing, and concludes it was never said has been
misled by silence.

The platform's own constitution requires UNKNOWN rather than a false negative.
An empty search result is currently indistinguishable from a genuine absence.

### C3 · The timeline can be silently partial

`timelineReconstructionService.ts` caps at 200 evidence items
(`:108`) with a 5-minute total budget (`:105`) against a 60-second per-item
extraction timeout (`evidenceTextExtractionService.ts:24`). Evidence is
processed sequentially. With `DISABLE_WORKERS=true` the only automatic caller is
the single inline run during certification (`certificationRun.ts:149`), so a
capped run is never retried unless a human calls
`POST /api/timeline/rebuild/:caseId`.

**Why critical:** the run does warn (`:205-208`, `:228-231`), so nothing is
fabricated. But the warnings live in `warnings[]` on the result, and a dashboard
showing "47 timeline events" beside no visible caveat invites an attorney to
believe that is the whole timeline. **A partial timeline presented as complete is
the single most dangerous output this platform can produce.**

Minimum fix: surface incompleteness in the interface wherever a timeline is
displayed, not just in the result payload. Full analysis in
[`deploy/PERFORMANCE.md`](deploy/PERFORMANCE.md).

### C4 · Email does not send

`SMTP_HOST` and `SES_REGION` are read (`security/authMiddleware.ts:868-877`)
but no provider is verified as configured, and no certification suite has ever
exercised email with real credentials.

**Why critical:** without it, password reset does not work, and user invitations
do not arrive. Both are on the path for every user who is not the Administrator,
which is every user a beta would add. A beta with no invitations is a
single-user demo.

---

## HIGH — needed for a beta that does not embarrass

### H1 · Session behaviour under a missing signing key

Covered in `deploy/SECURITY_REVIEW.md` S1 and `deploy/HARDENING.md` H1. Listed
here because the *user-visible* consequence is a product problem: users are
signed out at unpredictable times with no explanation. During a beta, that is
indistinguishable from the product being broken, and it generates support load
nobody can diagnose from the logs.

### H2 · Billing is inert

Stripe variables are read across `billing/` but nothing has ever run against
real credentials. Subscriptions, trials, renewals and the Administrative
Operations Center's revenue figures all depend on it.

**[JUDGEMENT]:** acceptable for a closed beta with invited users and no payment.
Not acceptable the moment anyone is asked for a card. Decide which beta this is
before launching it, because the Administrative Operations Center will otherwise
display revenue widgets backed by nothing — which the constitution prohibits.

### H3 · 164 TypeScript errors under `tsc --noEmit`

The bundle is produced by esbuild, which does not typecheck, so these do not
prevent the build and are not runtime failures. Runtime behaviour is covered by
116 browser checks and the endpoint tests.

**[JUDGEMENT]:** not a beta blocker, but it means the type system is not
currently a safety net. Every future change ships without that check. The count
should be driven down before the codebase takes on new contributors, or it will
grow monotonically.

### H4 · No load testing has ever been performed

Never, by anyone. Concurrent users, concurrent uploads, and behaviour under a
full corpus are all UNKNOWN. Programs 151 and 153 called for stress testing at
10,000 documents and 100 videos; that was never run.

**Why high, not critical:** a beta with a handful of invited attorneys will not
find the limits. It becomes critical the moment usage is not hand-counted.

### H5 · Video is stored, not analysed

No transcoding, no scene detection, no analysis — storage and duration only. The
absence of ffmpeg on the host would further reduce this to storage alone, with
durations reported as unknown.

Combined with C2, the honest current description is: **media is retained and
inventoried, not understood.** Say so in the interface.

### H6 · Recovery from an interrupted upload is untested

Chunks assemble under `CERTIFICATION_STAGING_DIR`, default
`/var/tmp/courtaccess-certification-staging` (`certification/uploadPortal.ts:21`).
Resume across a process restart has never been tested, `/var/tmp` is not
guaranteed to survive a reboot on every distribution, and nothing prunes
abandoned partial uploads.

For a 40 GB corpus interrupted at 90%, whether resume works is the difference
between an inconvenience and a day lost.

---

## MEDIUM

### M1 · CSRF tokens are lost on every restart

`security/csrfProtection.ts:57`, in-memory, with the code's own comment saying
`production: tie to session store`. Every deployment gives active users a CSRF
rejection on their next action. Failing closed is correct; the user-visible
result is still an unexplained error.

### M2 · Rate limits reset on restart and multiply under cluster mode

`security/rateLimiter.ts:30`. Correct today with one fork-mode process. Silently
wrong if cluster mode is ever enabled.

### M3 · Evidence files are world-readable

Written with the default umask, so `0644` files in `0755` directories. For
privileged criminal discovery on a shared host, `0600`/`0700` is the right
default.

### M4 · The frontend ships as a single 1.6 MB chunk

No code splitting; Vite warns at build time. Every user downloads the
Administrator certification portal. Compounded by nginx serving it uncompressed
(383 kB gzipped, 1.6 MB as served) and without `Cache-Control`.

### M5 · No slow-query visibility

`lib/prisma.ts:13` logs errors only in production, which is the right default
for a platform whose queries contain evidence content. But there is no middle
ground, so a query that degrades from 10 ms to 4 s is invisible until a user
complains.

### M6 · `CERTIFICATION_REPORTS_DIR` defaults into `/workspace`

`certification/readinessService.ts:19`. The directory does not exist in
production; the read is caught (`:64`) and the readiness view reports no suites.
Silently empty rather than obviously broken.

### M7 · Health endpoints misreport in the shipped configuration

`/api/health` returns a literal and cannot report anything wrong.
`/api/health/deep` will report the platform **unhealthy** because Redis is
deliberately absent (`observability/deepHealthCheck.ts:108-134`, `:68-71`), and
its Neo4j check never connects to anything (`:140-168`). Full design in
[`deploy/HEALTH_AND_LOGGING.md`](deploy/HEALTH_AND_LOGGING.md).

### M8 · Queue-backed intelligence is off

With `DISABLE_WORKERS=true`, the narrative, doctrine, contradiction and video
workers do not run. The Case 001 path does not need them — contradictions come
from timeline reconstruction inline — but any feature that depends on those
queues will appear to do nothing rather than report unavailability.

---

## LOW

### L1 · Dead CSRF exemption

`/api/auth/debug-check` remains in the exempt list
(`security/csrfProtection.ts:46`) after the endpoint was removed
(`authMiddleware.ts:375-378`).

### L2 · Two logging systems in one stream

Pino for requests, `console.*` for everything else. Half JSON, half prose.

### L3 · No build identity anywhere at runtime

`/api/health` reports a hardcoded `'1.1.0'` that has never changed.
`dist/build-info.json` now carries the real commit and nothing reads it.

### L4 · `HOST` defaults to `0.0.0.0`

`server.ts:61`. Binds every interface; should be `127.0.0.1` behind nginx.

### L5 · Directory creation precedes the traversal check

`evidence/evidenceDirectUpload.ts:654-662`. No file escapes, but empty
directories can be created before the request is refused.

---

## FUTURE VERSION

### F1 · Speech-to-text with timestamped transcripts

The largest single capability gap, and the one that would most change what the
platform is worth. Promised across Programs 145, 150 and 153.

### F2 · Video analysis

Scene detection, timestamp correlation with the timeline, bodycam-specific
handling.

### F3 · Multi-instance operation

Requires Redis for rate limits and CSRF, a shared session store, and connection
pool limits. Everything currently in-memory becomes wrong at two instances.

### F4 · Object storage for evidence

`AWS_*` and `R2_*` are read but never exercised. Local disk does not survive
instance replacement, and criminal discovery should not live on one EBS volume.

### F5 · Resumable, incremental analysis

Make the timeline pipeline record a high-water mark so repeated runs make
progress instead of re-processing the same first 200 items.

### F6 · Neo4j policy graph

Driver present (`policy/pipeline/neo4jPolicyGraph.ts`), never configured, health
check is a placeholder. Either finish it or remove it.

---

## Suggested order

**Before inviting anyone:** C1, C4, and the interface honesty parts of C2 and
C3. These are the four that would make a beta user conclude the product is
broken or, worse, trust something that is incomplete.

**During a closed beta:** H1, H6, M1, M3, M7. Operational sharp edges that only
appear with real users doing real work.

**Before payment is accepted:** H2, and a decision on M8 — inert billing widgets
and features that silently do nothing are both forms of the fabrication this
platform's constitution exists to prevent.

**Before public availability:** H4, M2, F3. Everything that is correct for one
process and one user and stops being correct at scale.

---

## The single most important item

**C3, and the general problem it represents.**

This platform's entire value proposition is that findings are evidence-backed
and that absence is reported as UNKNOWN rather than as nothing. The timeline
pipeline currently produces a genuinely partial result, reports the partiality
truthfully in `warnings[]`, and then that warning has no guaranteed path to the
screen an attorney is reading.

The same shape appears in C2 — a search that finds nothing in an untranscribed
recording — and in M8, where a disabled worker makes a feature look empty rather
than unavailable.

Every one of those is the constitution being violated not by fabricating a
finding, but by **failing to surface an absence**. That is the class of defect
this product can least afford, and it is worth a deliberate pass over every
dashboard before beta asking one question of each number displayed: *if this
were incomplete, would the person reading it know?*
