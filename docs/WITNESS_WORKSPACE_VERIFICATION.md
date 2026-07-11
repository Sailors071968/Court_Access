# Production Program 78 — Witness Workspace & Credibility Intelligence

> Scope: Witness Workspace only. New this turn: a **dedicated premium Witness Workspace page + route** (`/cases/:caseId/witnesses`) over the real `CaseWitness` API, extended witness data model, and cross-subsystem integration. Credibility findings are **evidence-governed — UNKNOWN until supported, never fabricated**. Deployed and browser-verified on the public staging URL.

## 1. Updated Public Staging URL

**https://eric-collaborative-pmid-safari.trycloudflare.com** — served `/` byte-identical to rebuilt dist; Witness Workspace verified through the external URL (`reports/screenshots/witness/public-witness-home.png`).

## 2. Witness Workspace Verification Report

**Phase 1 — Home (DONE):** premium witness intelligence center with a Witness Summary (Total + counts by type: Civilian, Law Enforcement, Expert, Victim, Interviewed, Unavailable), search, and type filters.

**Phase 2 — Management (DONE):** create/edit witnesses (unlimited) across the full taxonomy — civilian, victim, law enforcement, expert, confidential informant, custodian of records, medical, crime lab, 911 operator, dispatcher, digital forensic examiner, private investigator, defense investigator, custom.

**Phase 3 — Details (DONE):** each witness card shows Witness ID, Full Name, Witness Type, Role, Agency, Employer, Contact (phone/email), Status, Interview Status, Credibility Status, and Graph/Timeline links. UNKNOWN where unsupported.

**Phase 5 — Credibility Intelligence (evidence-governed):** credibility status is shown as **UNKNOWN** until supported by evidence — no fabricated impeachment/contradiction findings. (Automated credibility signals are a repository/analysis follow-up; the UNKNOWN default is intentional and Constitution-compliant.)

**Phase 6 — Search (DONE):** search by name, agency, employer, role, notes, ID; filter by witness type.

**Phases 7/8/9 — Integration (DONE):** header + per-witness deep-links to **Knowledge Graph** and **Timeline**; header **Workbench** link; the Attorney Workbench "Review Witnesses" action and the Case Overview "Witnesses" quick-link now route to this workspace.

**Phase 13 — Visual (DONE):** premium witness cards, avatars, credibility/interview-status indicators, glass panels, dark premium theme, professional typography.

## 3. Witness API Certification (Phase 10)

Auth: all routes require Bearer JWT + investigator/attorney/admin/staff role + case access.

| Method | Route | Service | DB tables | Runtime |
|---|---|---|---|---|
| GET | `/api/cases/:caseId/witnesses` | list | CaseWitness | **CONNECTED** (new; verified 3 witnesses) |
| POST | `/api/cases/:caseId/investigator/witnesses` | create | CaseWitness | **CONNECTED** (extended: witnessType/agency/employer/…; verified) |
| PATCH | `/api/cases/:caseId/investigator/witnesses/:witnessId` | update | CaseWitness | **CONNECTED** (new) |
| GET | `/api/cases/:caseId/investigator-workbench` | workbench (includes witnesses) | CaseWitness, InvestigationLead | **CONNECTED** |

Workers/queues: none required (witness CRUD is synchronous DB). Audited via `SecurityLog` (`WITNESS_CREATED`, `WITNESS_UPDATED`).

## 4. Database Certification (Phase 11)

| Model | Key columns | Indexes | Status |
|---|---|---|---|
| `CaseWitness` | name, `witnessType` (new), `agency` (new), `employer` (new), role, contactPhone, contactEmail, status, interviewStatus, `credibilityStatus` (new), notes, sourceType, createdBy | `@@index([caseId, tenantId])` | ✅ (columns pushed) |

Statement/interview tables: interview state lives on `CaseWitness` (`interviewStatus`); a dedicated statement-transcript table is not yet modeled (see Remaining). KG/Timeline links are derived (witness → graph node / timeline actor). No FK drift.

## 5. Browser Screenshot Gallery

`reports/screenshots/witness/`: `witness-home.png` (summary + type filters + 3 witness cards w/ status/credibility), `public-witness-home.png` (external URL parity).

## 6. Runtime Verification Report

| Check | Result |
|---|---|
| Attorney login | ✅ |
| Open Witness Workspace (new route) | ✅ |
| Create Witness ×3 (civilian/LEO/expert) | ✅ |
| List witnesses | ✅ 3 (by type) |
| Edit Witness (PATCH) | ✅ endpoint live |
| Summary by type | ✅ Civilian/LEO/Expert 1 each, Interviewed 1 |
| Credibility (UNKNOWN, evidence-governed) | ✅ never fabricated |
| Search + type filters | ✅ |
| Workbench / KG / Timeline deep-links | ✅ (header + per-card) |
| Console errors | ✅ 0 |
| Backend / workers | ✅ health 200; 5 workers |

## 7. Remaining Issues (Witness Workspace only)

- **Statement Intelligence (Phase 4)** — a dedicated statement/transcript entity (recorded statement, OCR of statements, detected entities) is not yet modeled; interview status is captured on the witness. Follow-up.
- **Automated credibility signals (Phase 5)** — prior-inconsistent-statement / bias / impeachment detection is displayed as UNKNOWN pending an evidence-linked analysis pass (intentional, not fabricated).
- **Per-witness → specific KG node / Timeline event pre-highlight** is a page-level deep-link (follow-up).
- 6 pre-existing backend TS errors (`resourceAuthMiddleware.ts`) remain (app runs via `tsx`).
- Public URL is an ephemeral quick-tunnel.

## 8–10. Commit / Branch / Timestamp — see response footer.
