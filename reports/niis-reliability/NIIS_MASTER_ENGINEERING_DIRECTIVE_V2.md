# CourtAccess NIIS
# Master Engineering Directive v2.0
## Mission-Critical Operational Intelligence Platform

**Status:** GOVERNING DOCUMENT (sealed 2026-08-14)  
**Supersedes:** V1.1 Continuous Inmate Intelligence Directive (retained as Mode A/B detail)  
**Does not waive:** open production incidents or release verification

---

## Mission

The sole mission of NIIS is to identify **every** newly booked inmate within the supported jurisdictions as quickly, accurately, transparently, and reliably as possible, while preserving a complete evidence trail and historical intelligence repository.

Success is **not** measured by code quality, UI design, or architectural elegance. It is measured by one question:

> Did NIIS identify every newly booked inmate before our competitors did?

Every engineering decision must improve one or more of:

| Dimension | Meaning |
|---|---|
| Recall | Never miss a new inmate |
| Precision | Never falsely identify an inmate as new |
| Discovery speed | Shrink booking → discovery latency |
| Operational usefulness | Helps a human act this morning |
| Explainability | Every decision cites evidence |
| Evidence integrity | Nothing lost, nothing rewritten |

---

## Engineering Law #1

**Everything else is subordinate to inmate discovery.**

Not dashboards. Not reports. Not watchlists. Not AI. Not enrichment. Not analytics. Not APIs.

Every feature must improve inmate discovery or operational efficiency.

---

## Operational Modes

### Mode A — Certified Morning Intelligence

```text
Yesterday Certified Roster
          ↓
Today's PDF
          ↓
Canonical Rosters
          ↓
Comparison
          ↓
Certified New Inmate Report
          ↓
Evidence Package
```

Produces the **permanent certified daily record**.

### Mode B — Continuous Intelligence

```text
Continuous Monitoring
      ↓
Detect Newly Booked Inmates
      ↓
Immediate Alerts
      ↓
Background Verification
      ↓
Morning Reconciliation
```

The certified report remains **authoritative**. Live discoveries are operational intelligence **until reconciled**.

---

## Multi-Source Intelligence

Priority order:

1. Certified PDF  
2. Official Sheriff's custody information  
3. Official CSV exports  
4. Other authorized intelligence sources  

**No lower-priority source may silently override a higher-priority source.**

---

## Canonical Person Identity

NIIS shall distinguish — and never combine:

- Person  
- Booking  
- Arrest  
- Charge  
- Case  

Identity hierarchy (preferred order):

1. XREF  
2. Booking Number  
3. Name + DOB  
4. Manual review  

Every identity decision shall include an explanation.

---

## Continuous Discovery Engine

Every configurable interval (appropriate for the operational source), NIIS shall:

1. Detect newly available inmates  
2. Compare against today's certified roster  
3. Compare against today's live discoveries  
4. Prevent duplicates  
5. Generate alerts  
6. Begin enrichment  

Operates continuously during business hours.

---

## Business Intelligence Layer

Operational truth and business decisions are separate.

| Operational Classification | Business Classification |
|---|---|
| NEW | Immediate Priority |
| EXISTING | High Priority |
| RETURNING | Medium Priority |
| REVIEW | Low Priority |
| | Excluded |

**Business rules shall never influence operational classification.**

---

## Charge Intelligence Repository

Every California criminal charge shall be configurable. Each charge stores:

- Priority  
- Business desirability  
- Bond eligibility  
- Typical bail  
- Investigator notes  
- Operational notes  

**No hard-coded charge logic.**

---

## Opportunity Scoring

Every inmate receives an Opportunity Score. Factors may include: bail amount · charge severity · bond eligibility · holds · custody status · court timing · historical relationship · geographic factors · company-specific business rules.

**Every score must be explainable.**

---

## Automated Enrichment

Immediately after identifying a new inmate, retrieve and preserve (where lawfully available): current custody details · bail · charges · housing · court information · booking metadata.

Store: retrieval timestamp · evidence snapshot · source · hash · version.

**Enrichment must never delay identification.**

---

## Historical Intelligence

Automatically search: prior bookings · prior bonds · prior investigations · prior agency interactions.

Present chronological history linked to the **person**, not merely the booking.

---

## Opportunity Timeline

Track: booking time · discovery time · alert time · first review · first contact · outcome.

Measure **operational** performance, not just software performance.

---

## Operational Dashboard

Must answer immediately:

- How many new inmates today?  
- How many since certification?  
- How many awaiting review?  
- How many high-priority opportunities?  
- How many alerts generated?  
- Average discovery latency?  
- Average time to first contact?  
- Pipeline health?  

---

## Evidence Rules

Nothing is ever discarded. Preserve: PDFs · CSVs · evidence packages · reports · audit trails · classification decisions · manual overrides.

**Evidence is append-only.**

---

## Zero Fabrication Policy

Never invent: inmates · charges · dates · confidence · statistics · reports · explanations.

When evidence is insufficient: **UNKNOWN**. No exceptions.

---

## Continuous Learning

Every operator correction becomes: regression test · parser improvement · comparison improvement · business rule improvement.

The system improves through operational use.

---

## Observability (first-class requirement)

Every stage of the ingestion pipeline must expose real-time metrics and health:

| Stage | Must expose |
|---|---|
| Upload | accepted, bytes in flight, failures + reason |
| Storage | bytes stored, stored path, hash, durability confirmation |
| Parsing | started/finished, rows read, confidence, warnings |
| Canonical roster | rows canonicalized, identity decisions, unresolved |
| Comparison | executed, NEW/EXISTING/RETURNING/REVIEW counts |
| Enrichment | queued, retrieved, failed, latency |
| Reporting | generated, printable artifact reference |
| Alerting | alerts emitted, suppressed, delivery outcome |

**Requirement:** when something fails, an operator identifies the exact stage, the reason, and the supporting evidence **within seconds — without reading application logs.**

Every stage emits: timestamp · duration · counts · bytes · identifiers · failure reason.

---

## Release Policy

No release is accepted because it compiles, tests pass, or the UI works.

Release requires:

1. Production deployment verified (running commit == intended commit)  
2. Smoke tests passed  
3. Real Sacramento data processed  
4. End-to-end evidence collected  
5. No regressions  

Every deployment must generate a **Deployment Verification Report** (`production/DEPLOYMENT_VERIFICATION_REPORT_TEMPLATE.md`) confirming running commit, migrations, smoke tests, and end-to-end ingestion.

---

## Success Metrics

### Operational
Recall · Precision · False positives · False negatives · Discovery latency · Review rate · Enrichment completion

### Business
New opportunities · High-priority opportunities · Average response time · Conversion rate (if tracked) · Opportunities missed due to system latency

### System
Upload success · Parser success · Comparison success · Queue health · Worker health · API health

---

## Engineering Discipline

1. **One production incident at a time.** Do not mix parser, deployment, queue, or comparison issues.  
2. **Evidence before conclusions.** Every claim backed by logs, metrics, or reproducible tests.  
3. **No new features while a release-blocking incident is open.**  
4. **Automate a regression test for every production defect.**  
5. **Every deployment generates a deployment verification report.**

---

## Long-Term Vision

NIIS evolves into a **Criminal Intake Intelligence Platform**, not a PDF comparison tool:

- Detect new bookings continuously  
- Preserve an immutable intelligence record  
- Prioritize opportunities by configurable business rules  
- Present investigators the most actionable information first  
- Scale to additional counties without changing core architecture  

---

## Final Directive

**Stop optimizing the software in isolation. Optimize the operational workflow.**

Every engineering decision must answer:

1. Does this help us discover new inmates faster?  
2. Does this reduce the chance of missing a new inmate?  
3. Does this reduce investigator workload?  
4. Does this preserve evidence and explain every decision?  
5. Does this improve the business's ability to respond to new booking opportunities?  

If the answer to all five is **no**, the feature shall not be implemented.

---

## Current standing (as of seal)

Directive discipline #3 is active. Release-blocking incident open:

| Order | Item | Status |
|---|---|---|
| 0 | **INC-001A** — production running `b52e9aad`, not the ingestion fix | **OPEN (release-blocking)** |
| 1 | **INC-001** — real Sacramento PDF end-to-end evidence | OPEN, blocked by 001A |
| 2 | **INC-002** — uploaded CSV queue not drained | Blocked by 001 |
| 3 | Mode A hardening to recall/precision targets | After ingestion reliable |
| 4 | Mode B continuous discovery engine | After Mode A certified in production |
| 5 | Opportunity scoring · charge repository · enrichment · timeline · alerts | After Mode B trustworthy |
| — | Pipeline observability | Build incrementally **with** each stage above; INC-001 trace instrumentation is the first installment |

**No v2.0 feature implementation begins while INC-001A is open.**
