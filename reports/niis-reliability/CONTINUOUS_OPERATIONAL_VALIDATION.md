# Continuous Operational Validation

**Status:** Binding.  
**Mindset:** NIIS is an **operational system**, not a software project.

## One job

Every morning:

> Produce the exact list of every newly booked Sacramento County inmate before anyone else can use it.

Everything else (repository, watch lists, intelligence, CSV enrichment, dashboards) exists to support that job.

## Do not wait on history

The **08/09 → 08/10** pair (67 names) remains the historical certification benchmark.

NIIS shall **not** wait for that historical validation before improving. Beginning immediately, **every daily Sacramento PDF pair** is a production validation dataset:

1. Yesterday’s PDF = baseline  
2. Today’s PDF = current roster  
3. NIIS generates the New Inmate Report  
4. Administrator performs the normal manual comparison  
5. Manual comparison = **official ground truth for that day**  
6. NIIS discrepancies = **engineering defects** (Learning Queue)

Continuous improvement until sustained **100% Recall** and **100% Precision**.

## Two morning reports

### 1. Operational Report (staff / revenue)

What staff use to contact prospective clients:

- New inmates  
- Prior Sacramento bookings / booking history  
- Bail, housing (when known; CSV may enrich later)  
- Intelligence notes  

Generated immediately after PDF comparison.

### 2. Engineering Certification Report (admin / developers only)

How NIIS earns trust:

- Total inmates processed  
- Reconciliation (New+Existing+Returning+Review = N)  
- Missing / Extra inmates  
- Precision / Recall  
- **Potential New Clients Found**  
- **Potential New Clients Missed**  
- Root causes  
- PASS / FAIL  

Artifacts: `ENGINEERING_CERTIFICATION_REPORT.md` + Learning Queue rows.

## Learning Queue

| Date | Inmate | Error Type | Root Cause | Status |
|---|---|---|---|---|
| 2026-08-11 | JANE DOE | missed_new | identity | open |
| 2026-08-11 | JOHN SMITH | false_new | parser | fixed |

**Rule: No discrepancy is ever forgotten.**  
Once fixed, the case becomes a permanent regression test under `fixtures/sacramento/validation/days/YYYY-MM-DD/`.

APIs (admin only):

- `GET /api/admin/intelligence/learning-queue`  
- `PATCH /api/admin/intelligence/learning-queue/:itemId`  
- `GET /api/admin/intelligence/certifications` (includes consecutive PASS streak)

## Record today’s manual truth (every morning)

```bash
cd backend
npx tsx scripts/record-daily-ground-truth.ts \
  --date 2026-08-11 \
  --gold /path/to/manual-new-inmates.md
```

Diffs NIIS vs manual list → engineering cert + Learning Queue + day folder.

## Production readiness standard

Not certified because of one good day.

Certify after sustained reliability, default:

| Requirement | Target |
|---|---|
| Consecutive Sacramento daily comparisons | **10** PASSes |
| Missed new inmates | **0** each day |
| False new inmates | **0** each day |
| Unexplained reconciliation failures | **0** each day |

Override streak length with `SAC_CONSECUTIVE_PASS_REQUIRED`.

## Historical benchmark (still required)

`fixtures/sacramento/validation/` — 08/09 + 08/10 + 67 names — remains the gold-standard regression anchor. Attach PDFs when available; do not block daily learning on them.
