# Production Program 79 — Discovery Workspace & Disclosure Intelligence

> Scope: Discovery Workspace only. New this turn: a **new `DiscoveryItem` model**, a **dedicated premium Discovery Workspace page + route** (`/cases/:caseId/discovery`), and full CRUD/review backend. Brady/Giglio/Jencks are **evidence-governed candidate flags set by users — never fabricated**. Deployed and browser-verified on the public staging URL.

## 1. Updated Public Staging URL

**https://eric-collaborative-pmid-safari.trycloudflare.com** — served `/` byte-identical to rebuilt dist; Discovery Workspace verified through the external URL (`reports/screenshots/discovery/public-discovery-home.png`).

## 2. Discovery Workspace Verification Report

**Phase 1 — Home (DONE):** premium discovery center with Discovery Summary (Total, Pending Review, Completed, Brady, Giglio, Jencks, Categories), Discovery Health, search, review-status filters.

**Phase 2 — Management (DONE):** create unlimited discovery items across the full category taxonomy — police/supplemental reports, body/dash camera, 911 calls, CAD logs, crime-scene photo/video, lab/DNA/fingerprint reports, medical, autopsy, financial, phone extraction, Cellebrite, search warrants, affidavits, subpoenas, court orders, expert reports, **Brady / Giglio / Jencks**, custom.

**Phase 3 — Details (DONE):** each card shows Discovery ID, Category, Title, Source Agency, review status, Brady/Giglio/Jencks flags, notes. Received/Produced dates + hash captured on create. UNKNOWN where unsupported.

**Phase 4 — Review (DONE):** review workflow — Mark reviewed / Reopen (pending → completed, records reviewer), flag toggles. Review-status filters (pending / in_review / completed).

**Phase 5 — Intelligence (evidence-governed):** Brady/Giglio/Jencks are shown as **candidate flags** set by the reviewer; when none are set the card reads "candidates UNKNOWN" — no fabricated Brady/Giglio findings.

**Phase 6 — Search (DONE):** search by title, agency, category, notes, ID; review-status filter.

**Phases 7/8/9 — Integration (DONE):** header deep-links to **Knowledge Graph**, **Timeline**, and **Attorney Workbench**; the Workbench "Review Discovery" action now routes to this workspace.

**Phase 13 — Visual (DONE):** premium discovery cards, review-status + priority (Brady/Giglio) indicators, glass panels, dark premium theme.

## 3. Discovery API Certification (Phase 10)

Auth: all routes require Bearer JWT (`guardAuth`) + case access (`guardCaseAccess`).

| Method | Route | Service | DB tables | Runtime |
|---|---|---|---|---|
| GET | `/api/cases/:caseId/discovery` | list | DiscoveryItem | **CONNECTED** (verified 3 items) |
| POST | `/api/cases/:caseId/discovery` | create | DiscoveryItem | **CONNECTED** (verified incl. Brady/Giglio) |
| PATCH | `/api/cases/:caseId/discovery/:itemId` | update/review/flag | DiscoveryItem | **CONNECTED** (verified mark-reviewed) |

Workers/queues: none (synchronous DB CRUD). Audited via `SecurityLog` (`DISCOVERY_CREATED`, `DISCOVERY_UPDATED`).

## 4. Database Certification (Phase 11)

| Model | Key columns | Indexes | Status |
|---|---|---|---|
| `DiscoveryItem` (`discovery_items`) | title, category, sourceAgency, receivedDate, producedDate, hash, fileSize, ocrStatus, reviewStatus, reviewedBy, reviewRole, bradyFlag, giglioFlag, jencksFlag, flags[], notes, createdBy | `@@index([caseId, tenantId])`, `@@index([reviewStatus])` | ✅ (table pushed) |

Repository/KG/Timeline links are derived (discovery → graph/timeline nodes) and page-level deep-linked; no FK drift. New table created via `prisma db push`.

## 5. Browser Screenshot Gallery

`reports/screenshots/discovery/`: `discovery-home.png` (summary + review filters + 3 discovery cards w/ Brady/Giglio flags + review actions), `public-discovery-home.png` (external URL parity).

## 6. Runtime Verification Report

| Check | Result |
|---|---|
| Attorney login | ✅ |
| Open Discovery Workspace (new route) | ✅ |
| Create discovery ×3 (police/Giglio/Brady) | ✅ |
| Mark reviewed (PATCH) | ✅ reviewedBy recorded |
| List + summary | ✅ Total 3, Pending 2, Completed 1, Brady 1, Giglio 1 |
| Brady/Giglio candidate flags (user-set) | ✅ UNKNOWN when unset |
| Search + review filters | ✅ |
| Workbench / KG / Timeline deep-links | ✅ |
| Console errors | ✅ 0 |
| Backend / workers | ✅ health 200; 5 workers |

## 7. Remaining Issues (Discovery Workspace only)

- **File upload for discovery items** — items are logged with metadata + optional hash; binary upload/OCR reuses the Evidence Workspace pipeline rather than a discovery-native uploader (follow-up to link an `evidenceId`).
- **Automated Brady/Giglio/Jencks candidate detection** is not performed — flags are user-set (Constitution-compliant: no fabricated exculpatory findings).
- **Per-item → specific KG node / Timeline event pre-highlight** is a page-level deep-link (follow-up).
- 6 pre-existing backend TS errors (`resourceAuthMiddleware.ts`) remain (app runs via `tsx`).
- Public URL is an ephemeral quick-tunnel.

## 8–10. Commit / Branch / Timestamp — see response footer.
