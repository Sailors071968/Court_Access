# CourtAccess NIIS — Version 1.1  
# Continuous Inmate Intelligence Directive

**Status:** SEALED as product mission (2026-08-14)  
**Supersedes for V1.1 scope:** morning-only comparison as the sole mission  
**Does not waive:** Operational Lock release discipline, Zero Fabrication, evidence preservation  

---

## Mission Statement

The mission of NIIS is no longer merely to compare two daily jail rosters.

The mission is:

> Identify every newly booked Sacramento County inmate as quickly and accurately as possible while maintaining a complete, evidence-backed historical record.

Nothing takes precedence over this objective.

---

## Primary Objective

The first responsibility of NIIS is to discover **every** newly booked inmate.

Not some.  
Not most.  
**Every one.**

Every subsystem shall exist solely to improve one or more of:

| Metric | Meaning |
|---|---|
| Recall | Miss nothing that is truly NEW |
| Precision | Label nothing NEW that is not |
| Speed | Discover and surface opportunity while it is still actionable |
| Explainability | Every classification and recommendation cites evidence |
| Operational efficiency | Minimal human review; maximum automatic correct decisions |

---

## Two Operational Modes

NIIS shall operate in two **independent** modes.

### Mode 1 — Daily Certification

Every morning:

```text
Yesterday Certified PDF
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
        ↓
Certification
```

This produces the **permanent historical record**.

### Mode 2 — Continuous Booking Intelligence

Immediately after morning certification completes:

NIIS continuously monitors newly available booking information.

Every configurable interval (for example every 2–5 minutes, or another interval appropriate for the operational source and its availability), it shall:

1. Discover newly booked inmates  
2. Compare against today's certified roster  
3. Compare against live discoveries already recorded today  
4. Create Live Booking Events  
5. Notify operators  

The continuous monitor **supplements—but does not replace**—the certified daily workflow.

---

## Authoritative Sources

The hierarchy shall always be:

| Level | Source | Role |
|---|---|---|
| **1** | Certified Daily PDF | **Authoritative.** Determines **NEW**. |
| **2** | Official Sacramento Sheriff booking information | Operational enrichment. **Never** determines NEW by itself. Only supplements. |
| **3** | CSV Import | Supplemental intelligence (bail, arrest location, booking metadata, charge details, history). **Never** overrides certified comparison. |

---

## Continuous Event Engine

Instead of only thinking in terms of rosters, NIIS shall maintain an **Event Repository**.

Each event contains at least:

- booking timestamp  
- discovery timestamp  
- discovery source  
- evidence  
- enrichment status  
- certification status  

---

## New Daily Object — Daily Intelligence Case

Replace the current Daily Case with **Daily Intelligence Case**, containing:

- Certified PDF  
- Previous Certified PDF  
- Canonical Roster  
- Comparison Results  
- Live Discoveries  
- Sheriff Enrichment  
- CSV Enrichment  
- Certification Package  
- Operational Metrics  
- Evidence Package  

**Every page in NIIS reads from this object.**

---

## Operational Dashboard

The Morning Dashboard becomes:

| Panel | Meaning |
|---|---|
| Certified Today | Number of newly identified inmates (Mode 1) |
| Live Since Certification | New inmates discovered after the morning report (Mode 2) |
| Pending Review | Operational exceptions |
| Pending Enrichment | Booking pages not yet retrieved |
| Operational Trust Score | Evidence-backed confidence |
| Automatic Classification Rate | Percentage requiring no human review |

---

## Business Intelligence — Two Separate Evaluations

Every inmate receives **two completely separate** evaluations.

### 1. Operational Classification (objective)

- NEW  
- EXISTING  
- RETURNING  
- REVIEW  

Never influenced by business rules.

### 2. Business Opportunity Classification (subjective)

Determined by configurable business rules.

Example shape:

- Priority: ★★★★★  
- Reason: High bail · Commercial bond · No hold · Court tomorrow  

Every recommendation must explain itself.

---

## Configurable Charge Intelligence

No criminal charge shall be hard-coded.

Administrators shall define charges as: preferred · undesirable · prohibited · low priority · high priority.

Each charge shall contain (all editable):

- Priority Score  
- Preferred  
- Bondable  
- Business Notes  
- Risk Notes  
- Operational Notes  

---

## Live Enrichment

Immediately after a NEW inmate is identified, retrieve and store permanently:

booking page · charges · bail · housing · court · release information · warrants · custody status  

Store: HTML · PDF snapshot · SHA256 · retrieval timestamp.

Evidence is permanent.

---

## Historical Intelligence

Every newly discovered inmate shall automatically search:

historical bookings · prior arrests · prior bonds · prior charges · prior investigations · repeat-customer history  

Linked by **XREF**, not Booking Number.

---

## Priority Queue

Instead of only “67 NEW”, NIIS displays value tiers, e.g.:

```text
67 NEW
★★★★★  7
★★★★  12
★★★   21
★★    18
★      9
```

Operators begin with highest value.

---

## Alert Engine

During business hours, new bookings generate **immediate** alerts (high bail, repeat customer, watch list, specific charge / area / court / investigator).

Alerts never wait until tomorrow.

---

## Investigator Workspace

Sorted by:

1. Lowest confidence first  
2. Highest business value first  

Every click becomes training data. The Learning Queue grows automatically.

---

## Certification

Every morning, a human investigator compares NIIS versus ground truth.

Every discrepancy is: categorized · explained · stored forever · added as regression.

---

## Zero Fabrication — Permanent Rule

NIIS shall never fabricate: names · charges · confidence · dates · statistics · operational summaries.

If evidence is insufficient: display **UNKNOWN**. Never invent.

---

## Opportunity Timeline (V1.1 addition)

For every newly discovered inmate, track:

| Milestone | Purpose |
|---|---|
| Booking time | When the jail recorded the booking |
| Discovery time | When NIIS first saw it |
| First alert time | When operators were notified |
| First staff review | When a human opened the case |
| First client contact | Outreach start |
| Bond posted (if applicable) | Commercial outcome |
| Disposition | client · declined · ineligible · released · etc. |

Dashboard questions this enables:

- Average time from booking → discovery  
- Average time from discovery → first contact  
- Opportunities still awaiting outreach  
- Opportunities lost to delayed discovery  
- Trends by hour of day / day of week  

This keeps NIIS aligned with the business mission: not only identifying inmates, but helping the team **respond** while opportunity remains actionable—under a complete auditable history.

---

## Release Policy

No release shall be approved because: it compiles · tests pass · parser succeeds.

Release requires:

- Replay certification  
- No regression  
- Operational acceptance  
- **Production verification**  

---

## Version 1.1 Exit Criteria

NIIS Version 1.1 succeeds when all are true:

| # | Criterion |
|---|---|
| 1 | Morning report certified |
| 2 | Live monitoring operational |
| 3 | Zero missed inmates |
| 4 | Zero false new inmates |
| 5 | Continuous discovery |
| 6 | Business prioritization |
| 7 | Historical intelligence |
| 8 | Automatic enrichment |
| 9 | Minimal human review |
| 10 | Complete evidence preservation |

---

## Binding sequencing (non-negotiable)

V1.1 Mode 2 and all new surfaces in this directive are **product intent**.

They are **not** an instruction to bypass open production incidents.

| Order | Gate | Status (as of seal) |
|---|---|---|
| 0 | **INC-001A** — correct build running in production | OPEN |
| 1 | **INC-001** — Upload → bytes → parser → roster → comparison → New Inmates → Morning Ops → Report (real Sacramento PDF, production evidence) | OPEN until 001A + evidence |
| 2 | **INC-002** — CSV / uploaded queue drain | Blocked on 001 |
| 3 | Mode 1 hardening to V1.1 exit criteria (recall/precision on certified path) | After ingestion reliable |
| 4 | Mode 2 continuous monitor + Event Repository + Daily Intelligence Case | After Mode 1 production-certified |
| 5 | Business prioritization · Opportunity Timeline · alerts · enrichment | After Mode 2 skeleton trustworthy |

**No Mode 2 / BI / enrichment feature work while production still runs a build that cannot store Import Job PDF bytes.**

Evidence drives engineering. This directive defines *what* to build next—only after release proves *what* is running.
