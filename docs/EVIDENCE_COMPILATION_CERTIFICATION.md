# Evidence Compilation Certification (Program 46)

**Objective:** transform uploaded evidence into structured knowledge, where **no
extracted information may exist without traceable evidence**, and every extraction
carries evidence citation, confidence, audit record, repository source, and
human-review status.

**Method:** static audit of the extraction pipeline + Prisma models. Runtime
compilation (actual extracted records) requires uploaded evidence + OCR + DB + Redis,
which are unavailable here → runtime output is **UNKNOWN** (not fabricated).

**Generated:** 2026-07-06.

---

## 1. The core invariant — "no information without traceable evidence"

✅ **ENFORCED at the schema level for claims.**
`NarrativeClaim.evidenceId` is a **required** column (not nullable), and the extractor
writes it from `job.evidenceId` (`claimExtractionWorker.ts`). A narrative claim
**cannot be persisted without an evidence citation.** `ClaimValidation` carries
`supportingEvidenceIds` / `contradictingEvidenceIds` (citation arrays).

---

## 2. Compilation coverage (evidence)

| Requested output | Backing model / worker | Citation | Confidence | Status |
|------------------|------------------------|:--------:|:----------:|--------|
| Facts / Statements / Admissions | `NarrativeClaim` (subject/action/object) via `claimExtractionWorker` | ✅ `evidenceId` (required) | ✅ | **PASS** |
| Timeline events | `NormalizedClaimEvent`, `TimelineEvent` | ✅ (claimId→evidenceId) | ✅ | **PASS** |
| Contradictions | `ClaimValidation.status='contradicted'` + `contradictingEvidenceIds`; `impeachmentDetectionWorker` | ✅ | ✅ | **PASS** |
| Unknowns | `ClaimValidation.status='unverified'`; claims default subject `Unknown` (conf 0.3) | ✅ | ✅ | **PASS** |
| Impeachment | `ImpeachmentCandidate` | ✅ | ✅ | **PASS** |
| Evidence links / Knowledge-graph updates | `evidence_graphs`, `evidence_links`, `narrativeGraphIntegration` | ✅ | ✅ | **PASS** |
| Charges / Authorities | legislative repositories (PEN — Program 44) | ✅ (contentHash) | ✅ | **PASS (PEN)** |
| Witnesses | investigator `createWitness` (manual) + claim subjects | ✅ | partial | **PARTIAL** |
| **Locations / Vehicles / Phone numbers / Financial transactions / Organizations** | **no dedicated extractor** — these are Knowledge-Graph node *types* but nothing extracts them from evidence | — | — | **GAP** |

---

## 3. Required per-extraction fields (evidence)

| Field | Present? | Evidence |
|-------|:--------:|----------|
| Evidence citation | ✅ | `NarrativeClaim.evidenceId` (required); `ClaimValidation.*EvidenceIds` |
| Confidence | ✅ | `confidence Float` on `NarrativeClaim`, `NormalizedClaimEvent`, `ClaimValidation`, `ImpeachmentCandidate`, `EvidenceEvent` |
| Audit record | ✅ | `createdAt`/`updatedAt` on all; `extraction-audit.jsonl`; `ComplianceAuditTrail` |
| Repository source | ⚠️ partial | `EvidenceEvent.sourceType` (bodycam/dashcam/…) present; **not inlined on `NarrativeClaim`** (source via `evidenceId` relation) |
| Human-review status | ⚠️ partial | `ComplianceReviewQueue.reviewStatus` + `ClaimValidation.status` exist; **not inlined on `NarrativeClaim`** |

---

## 4. Gaps & risks

1. **No structured-entity extractors** for locations, vehicles, phone numbers,
   financial transactions, organizations, VIN/license plates. These appear as
   Knowledge-Graph node *types* but no worker extracts them from evidence text →
   those graph nodes would currently only come from manual entry.
2. **Extraction is heuristic**, not ML NER — `claimExtractionWorker` uses
   subject/action pattern matching with heuristic confidence; quality is unmeasured.
3. **Repository-source & review-status are not inlined** on `NarrativeClaim` — they
   exist via relations (`evidenceId` → evidence.sourceType; `ClaimValidation.status`;
   `ComplianceReviewQueue`). To satisfy the program's per-record requirement strictly,
   add `sourceType` and `reviewStatus` columns to `NarrativeClaim`.
   *(Deferred: adding columns now would compound the un-migrated schema drift from
   Program 36/BLK-003 — do it in the reconcile migration.)*
4. **Runtime compilation not executed** — actual compiled records, counts, and
   confidence distributions are **UNKNOWN** without a deployed stack + uploaded evidence.

---

## 5. Completion (measured, not estimated)

| Dimension | Status |
|-----------|--------|
| Traceability invariant (no claim without `evidenceId`) | ✅ enforced (schema-required) |
| Facts/statements/timeline/contradictions/unknowns/impeachment/KG extraction | ✅ implemented + traceable |
| Charges/authorities compilation | ✅ (PEN, Program 44) |
| Structured entity extraction (location/vehicle/phone/financial/org) | ❌ not implemented |
| Repository-source & review-status inlined per extraction | ⚠️ via relations, not per-record columns |
| Runtime compiled output | **UNKNOWN** (no live stack) |

**Evidence Compilation Certification: CONDITIONAL PASS on traceability & core
extraction; DENIED on completeness.**
The compiler enforces the central constitutional invariant — **every extracted claim
is bound to a required evidence citation, with confidence and audit** — and produces
facts, timeline events, contradictions, unknowns, impeachment, and graph updates.
**Not complete:** structured-entity extractors (locations/vehicles/phones/financial/
orgs) are absent, source/review are relational rather than per-record, and runtime
output is UNKNOWN.

---

## 6. Recommended work

1. Build entity extractors (location/vehicle/phone/financial/org) writing traceable
   graph nodes (each with `evidenceId`, confidence, sourceType, reviewStatus).
2. In the BLK-003 reconcile migration, add `sourceType` + `reviewStatus` columns to
   `NarrativeClaim` so all five fields are inlined per extraction.
3. Capture runtime compilation metrics on a deployed stack (counts, confidence
   distribution, review backlog) — evidence, not estimate.

## 7. Reproduce

```bash
cd backend
rg -n "evidenceId +String$|evidenceId +String\b" prisma/schema.prisma   # required citation
rg -n "^model (NarrativeClaim|ClaimValidation|ImpeachmentCandidate|ComplianceReviewQueue)" prisma/schema.prisma
rg -n "triggerEvidenceId: job.evidenceId|confidence" src/narrative/claimExtractionWorker.ts
rg -rn "extractLocation|extractVehicle|phoneNumber|financialTransaction" src   # empty → entity-extractor gap
```
