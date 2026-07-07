# Canonical API Registry — Phase 4A

> Single source of truth for CourtAccess HTTP endpoints. **Generated deterministically** from source by `scripts/generate-api-registry.mjs` and enriched with **live runtime probing** by `scripts/probe-api-registry.mjs`. No values are estimated or fabricated; fields that cannot be resolved statically are marked accordingly. Regenerate with those scripts.

- Generated: 2026-07-07T15:43:56.016Z
- Runtime probed: 2026-07-07T15:44:21.232Z (205 GET endpoints against a live server)
- **Total endpoints: 374** across 45 route files
- Duplicate endpoints (same method+route): **0** (none)

## Method note (how each field is derived)
- **Authentication**: global `authenticationHook` (JWT) enforces auth on every route except the `PUBLIC_ROUTES` allowlist. `authenticationRequired` reflects that model.
- **Authorization guards**: detected per-handler (`guardCaseAccess`, `guardScopeAccess`, `requireDashboardAccess`, …).
- **Database tables**: Prisma models referenced directly in the handler, mapped to `@@map` table names. Tables touched transitively via services are captured in the Service→Repository mapping.
- **Runtime status**: `CONNECTED` = live server responded 2xx/401/403 (route exists); `REGISTERED` = mutating route present in code, not probed to avoid side effects; `NOT_FOUND_FOR_SEED` = registered route returned 404 for seeded params; `UNKNOWN` = unreachable during probe.

---

## 7. API Coverage Report

| Metric | Count | % |
|--------|-------|---|
| Total endpoints | 374 | 100% |
| Authentication required | 356 | 95.2% |
| Public (allowlist) | 18 | 4.8% |
| Statically mapped to a UI caller | 105 | 28.1% |
| Covered by a test reference | 17 | 4.5% |
| Runtime GET probed | 205 | — |

### Canonical runtime status (requested taxonomy)

| Status | Count | % | Definition |
|--------|-------|---|------------|
| CONNECTED | 118 | 31.6% | Route exists + responds (2xx/401/403) and is wired to a UI caller, a test, or is a public/infra route |
| PARTIALLY CONNECTED | 8 | 2.1% | Route exists but returned 404 for a seeded resource (reachable, not fully exercised) |
| UNUSED | 248 | 66.3% | Route exists/responds but no detected UI caller or test (verify dynamic callers) |
| BROKEN | 0 | 0.0% | Route returned 5xx |
| DEPRECATED | 0 | 0% | Not statically determinable — none asserted (UNKNOWN preferred) |
| UNKNOWN | 0 | 0.0% | Could not be reached during probe |

_(Raw probe codes: CONNECTED=197, REGISTERED=169, NOT_FOUND_FOR_SEED=8)_

> **UI-mapping caveat (honest):** UI callers are detected statically from `/api` string + `${API_BASE}` template literals in the frontend. Endpoints built through multi-step dynamic path construction may be under-counted; the "unused" list below is therefore **candidates requiring confirmation**, not confirmed dead endpoints.

---

## 8. Unused Endpoint Report (candidates)

257 endpoints have **no statically-detected UI caller and no test reference**. These are candidates for either UI wiring or removal (verify dynamic callers first). Full list in `unused-endpoints.json`. Top by controller:

- `cpra/autonomousCpraRoutes.ts` — 31
- `evidence/complianceRoutes.ts` — 28
- `organizations/firmPlatformRoutes.ts` — 22
- `evidence/forensicReconstructionRoutes.ts` — 21
- `policy/pipeline/policyIntelligenceRoutes.ts` — 17
- `billing/billingRoutes.ts` — 12
- `contradiction/contradictionRoutes.ts` — 11
- `membership/membershipRoutes.ts` — 10
- `doctrine/doctrineRoutes.ts` — 8
- `legislative/legislativeRoutes.ts` — 8
- `cpra/policyMatrixRoutes.ts` — 7
- `policy/pipeline/pipelineRoutes.ts` — 7
- `governance/governanceRoutes.ts` — 6
- `intelligence/intelligenceRoutes.ts` — 6
- `productionOperations/productionOperationsRoutes.ts` — 6

---

## 9. Missing Endpoint Report (frontend calls with no backend route)

Frontend code calls these paths, but no backend route matches (static match). Runtime-confirmed 404s are genuine gaps; others may be dynamic-registration/static-match limits. Full list in `missing-endpoints.json`.

| Frontend path | Called from | Runtime (live probe) |
|---------------|-------------|----------------------|
| `/api/operations/cpra-requests` | CpraCampaignTimeline.tsx | exists or static-miss (see note) |
| `/api/cpra/dashboard` | CpraDashboard.tsx | exists or static-miss (see note) |
| `/api/cpra/campaigns` | CpraDashboard.tsx | exists or static-miss (see note) |
| `/api/cpra/campaigns/*` | CpraDashboard.tsx | exists or static-miss (see note) |
| `/api/cpra/campaigns/*/launch` | CpraDashboard.tsx | exists or static-miss (see note) |
| `/api/cpra/requests/*/response` | CpraDashboard.tsx | exists or static-miss (see note) |
| `/api/cpra/overdue` | CpraDashboard.tsx | exists or static-miss (see note) |
| `/api/cpra/annual/dashboard` | CpraDashboard.tsx | exists or static-miss (see note) |
| `/api/cpra/annual/updates` | CpraDashboard.tsx | exists or static-miss (see note) |
| `/api/cpra/annual/updates/*/received` | CpraDashboard.tsx | exists or static-miss (see note) |
| `/api/cpra/annual/check` | CpraDashboard.tsx | exists or static-miss (see note) |
| `/api/cpra` | CpraDashboard.tsx | exists or static-miss (see note) |
| `/api/evidence/processing-logs` | EvidenceProcessingTrace.tsx | exists or static-miss (see note) |
| `/api/policy-intelligence/agencies` | PolicyIntelligenceDashboard.tsx | **404 confirmed missing** |
| `/api/policy-intelligence/taxonomy/seed` | PolicyIntelligenceDashboard.tsx | exists or static-miss (see note) |
| `/api/policy-intelligence` | PolicyIntelligenceDashboard.tsx | exists or static-miss (see note) |
| `/api/operations/policy-matrix` | PolicyMatrixVirtualized.tsx | exists or static-miss (see note) |
| `/api/policy-pipeline/run/*` | PolicyPipelineDashboard.tsx | exists or static-miss (see note) |
| `/api/operations/topics/registry` | PolicyTopicRegistry.tsx | exists or static-miss (see note) |
| `/api/exhibits/create-scene` | ExhibitViewer.tsx | exists or static-miss (see note) |
| `/api/exhibits/export/html` | ExhibitViewer.tsx | exists or static-miss (see note) |
| `/api/narrative/*/claims${qs` | caseApi.ts | exists or static-miss (see note) |
| `/api/narrative/*/impeachment*` | caseApi.ts | exists or static-miss (see note) |
| `/api/evidence/upload` | caseApi.ts | exists or static-miss (see note) |
| `/api/timeline/*` | caseApi.ts | exists or static-miss (see note) |
| `/api/doctrine` | doctrineService.ts | exists or static-miss (see note) |
| `/api/firm*` | firmApi.ts | exists or static-miss (see note) |

**Runtime-confirmed missing (404 on live server):** `/api/cases/:id/litigation-strategy` (LitigationStrategyView.tsx), `/api/cases/:id/trial-exhibits` (TrialExhibitWorkspace.tsx), `/api/policy-intelligence/agencies` (PolicyIntelligenceDashboard.tsx). Others (evidence/upload, timeline, cpra/*, policy-pipeline, operations) returned 200/401/403 → they **exist** and were static-match misses.

---

## 10. Integration Priority List

1. **Wire 3 runtime-confirmed missing endpoints** (or confirm the UI's graceful empty-state is intended): `litigation-strategy` (service exists: `litigationStrategyService.ts`), `trial-exhibits` (data in `TrialExhibitScene`/`exhibitRoutes`), `policy-intelligence/agencies`.
2. **Add test coverage** — only 17/374 endpoints have any test reference.
3. **Triage the 257 no-UI-caller candidates** — confirm dynamic callers or retire.

---

## 3. Frontend-to-API Mapping

105 endpoints have a detected UI caller. Enderpoints and their UI files:

| Method | Route | UI file(s) |
|--------|-------|-----------|
| GET | `/api/admin/stats` | AdminPage.tsx |
| GET | `/api/admin/users` | AdminPage.tsx |
| GET | `/api/admin/cases` | AdminPage.tsx |
| DELETE | `/api/admin/users/:userId` | AdminPage.tsx |
| DELETE | `/api/admin/cases/:caseId` | AdminPage.tsx |
| GET | `/api/billing/plans` | caseApi.ts |
| GET | `/api/billing/usage` | UsageDashboard.tsx |
| GET | `/api/discount-codes/validate` | RegisterPage.tsx |
| GET | `/api/admin/discount-codes` | DiscountCodesDashboard.tsx |
| POST | `/api/admin/discount-codes` | DiscountCodesDashboard.tsx |
| PATCH | `/api/admin/discount-codes/:codeId` | DiscountCodesDashboard.tsx |
| DELETE | `/api/admin/discount-codes/:codeId` | DiscountCodesDashboard.tsx |
| POST | `/api/discount-codes/apply` | RegisterPage.tsx |
| POST | `/api/billing/create-checkout-session` | caseApi.ts, membershipApi.ts |
| POST | `/api/billing/create-portal-session` | caseApi.ts |
| POST | `/api/contradiction/analyze/:caseId` | caseApi.ts |
| GET | `/api/contradiction/recommendations/:caseId` | caseApi.ts |
| GET | `/api/courtlistener/status` | courtListenerApi.ts |
| GET | `/api/courtlistener/search` | courtListenerApi.ts |
| POST | `/api/courtlistener/citation-lookup` | courtListenerApi.ts |
| GET | `/api/doctrine/status` | doctrineService.ts |
| GET | `/api/doctrine/search` | doctrineService.ts |
| POST | `/api/doctrine/analyze` | doctrineService.ts |
| POST | `/api/doctrine/quick-scan` | doctrineService.ts |
| POST | `/api/doctrine/seed` | doctrineService.ts |
| POST | `/api/cases` | EvidenceRequestsDashboard.tsx, caseApi.ts |
| GET | `/api/cases` | EvidenceRequestsDashboard.tsx, caseApi.ts |
| GET | `/api/cases/:caseId` | caseApi.ts |
| PATCH | `/api/cases/:caseId` | caseApi.ts |
| DELETE | `/api/cases/:caseId` | caseApi.ts |
| GET | `/api/compliance/dashboard` | PolicyComplianceDashboard.tsx |
| GET | `/api/compliance/heatmap` | PolicyComplianceDashboard.tsx |
| GET | `/api/cases/:caseId/evidence-requests` | EvidenceRequestsDashboard.tsx |
| POST | `/api/evidence-requests/:id/respond` | EvidenceRequestsDashboard.tsx |
| POST | `/api/cases/:caseId/evidence-requests/detect` | EvidenceRequestsDashboard.tsx |
| POST | `/api/evidence/upload-url` | caseApi.ts |
| POST | `/api/evidence` | caseApi.ts |
| GET | `/api/cases/:caseId/evidence` | caseApi.ts |
| GET | `/api/evidence/:evidenceId` | caseApi.ts |
| DELETE | `/api/evidence/:evidenceId` | caseApi.ts |
| GET | `/api/forensic/timeline/:caseId` | CaseTimelineVisualizer.tsx |
| GET | `/api/narrative/:caseId/contradictions` | caseApi.ts |
| POST | `/api/narrative/analyze/:caseId` | caseApi.ts |
| GET | `/api/cases/:caseId/investigator-workbench` | investigatorApi.ts |
| POST | `/api/cases/:caseId/investigator/witnesses` | investigatorApi.ts |
| POST | `/api/cases/:caseId/investigator/leads` | investigatorApi.ts |
| POST | `/api/cases/:caseId/investigator/field-notes` | investigatorApi.ts |
| POST | `/api/contact` | ContactSalesPage.tsx |
| GET | `/api/membership/account` | membershipApi.ts |
| PATCH | `/api/membership/settings` | membershipApi.ts |
| GET | `/api/membership/shared-access` | membershipApi.ts |
| POST | `/api/membership/permission-grants` | membershipApi.ts |
| GET | `/api/cases/:caseId/documents/:documentId/redactions` | membershipApi.ts |
| POST | `/api/cases/:caseId/documents/:documentId/redactions` | membershipApi.ts |
| GET | `/api/cases/:caseId/disclosures` | membershipApi.ts |
| POST | `/api/cases/:caseId/disclosures` | membershipApi.ts |
| GET | `/api/membership/onboarding` | RoleOnboardingPage.tsx |
| GET | `/api/organizations/current` | organizationApi.ts |
| PATCH | `/api/organizations/current` | organizationApi.ts |
| POST | `/api/organizations/onboarding` | organizationApi.ts |
| GET | `/api/organizations/offices` | organizationApi.ts |
| POST | `/api/organizations/offices` | organizationApi.ts |
| GET | `/api/organizations/practice-groups` | organizationApi.ts |
| POST | `/api/organizations/practice-groups` | organizationApi.ts |
| GET | `/api/organizations/members` | organizationApi.ts |
| GET | `/api/organizations/invitations` | organizationApi.ts |
| POST | `/api/organizations/invitations` | organizationApi.ts |
| GET | `/api/organizations/analytics` | organizationApi.ts |
| GET | `/api/organizations/search` | organizationApi.ts |
| GET | `/api/organizations/invitations/preview` | organizationApi.ts |
| POST | `/api/auth/accept-invitation` | organizationApi.ts |
| GET | `/api/operations/dashboard` | PolicyOperationsDashboard.tsx |
| GET | `/api/operations/topics` | PolicyTopicsViewer.tsx |
| GET | `/api/operations/topics/:agencyId` | PolicyTopicsViewer.tsx |
| GET | `/api/operations/topics/:agencyId/export/csv` | PolicyTopicsViewer.tsx |
| GET | `/api/policy-pipeline/stats` | PolicyPipelineDashboard.tsx |
| GET | `/api/policy-pipeline/agencies` | PolicyPipelineDashboard.tsx |
| GET | `/api/policy-intelligence/dashboard` | PolicyIntelligenceDashboard.tsx |
| GET | `/api/admin/operations/dashboard` | OperationsCommandCenter.tsx |
| GET | `/api/system/health` | SystemHealthDashboard.tsx |

_(105 total; truncated to 80. Full data in canonical-api-registry.json → endpoints[].uiPages.)_

---

## 4. API-to-Service Mapping

Route file → service modules imported (file-level).

| Route file | Services |
|------------|----------|
| `admin/adminRoutes.ts` | billingMetricsService.js |
| `admin/queueMonitorRoutes.ts` | — |
| `assistant/litigationAssistantRoutes.ts` | litigationAssistantService.js |
| `billing/billingRoutes.ts` | subscriptionService.js, aiCreditService.js, usageEnforcementService.js, stripeSyncService.js |
| `billing/discountRoutes.ts` | discountService.js |
| `billing/stripeWebhookHandler.ts` | — |
| `charges/chargeRoutes.ts` | — |
| `clients/clientRoutes.ts` | — |
| `communications/hearingRoutes.ts` | — |
| `communications/messagingRoutes.ts` | — |
| `contradiction/contradictionRoutes.ts` | — |
| `courtlistener/courtListenerRoutes.ts` | courtListenerService.js |
| `cpra/autonomousCpraRoutes.ts` | cpraRequestEngine.js, cpraEmailLogService.js, cpraAttachmentProcessor.js, cpraClassificationEngine.js, cpraNotificationService.js, cpraTimelineService.js |
| `cpra/policyMatrixRoutes.ts` | cpraMatrixService.js |
| `doctrine/doctrineRoutes.ts` | doctrineIngestionService.ts |
| `evidence/caseRoutes.ts` | — |
| `evidence/complianceRoutes.ts` | eventExtractionService.js, videoActionDetectionService.js, speechAnalysisService.js, officerActionTimelineService.js, complianceDashboardService.js |
| `evidence/evidenceRequestRoutes.ts` | evidenceGapDetectionService.js |
| `evidence/evidenceRoutes.ts` | — |
| `evidence/forensicReconstructionRoutes.ts` | bodycamVisionService.js, trajectoryAnalysisService.js, visibilitySimulationService.js, multiCameraSyncService.js, sceneGeometryService.js, juryVisualizationService.js |
| `governance/governanceRoutes.ts` | legislativeIngestService.ts |
| `intelligence/intelligenceRoutes.ts` | — |
| `investigator/investigatorRoutes.ts` | investigatorWorkbenchService.js |
| `legislative/legislativeRoutes.ts` | legislativeIngestService.ts |
| `marketing/contactRoutes.ts` | — |
| `membership/membershipRoutes.ts` | redactionService.js, disclosureService.js, publicationService.js |
| `observability/observabilityRoutes.ts` | — |
| `organizations/firmPlatformRoutes.ts` | organizationService.js, firmPlatformService.js |
| `organizations/organizationRoutes.ts` | organizationService.js |
| `policy/pipeline/operationsConsoleRoutes.ts` | — |
| `policy/pipeline/pipelineRoutes.ts` | — |
| `policy/pipeline/policyIntelligenceRoutes.ts` | chpPolicyImportService.js |
| `productionGates/productionGatesRoutes.ts` | — |
| `productionOperations/productionOperationsRoutes.ts` | — |
| `providers/providerRoutes.ts` | — |
| `routes/calcrimRoutes.ts` | calcrimEngine.js |
| `search/searchRoutes.ts` | searchService.js |
| `security/authMiddleware.ts` | — |
| `security/identityRoutes.ts` | identityService.js |
| `security/rateLimiter.ts` | — |
| `security/securityLogger.ts` | — |
| `server.ts` | — |
| `timeline/timelineRoutes.ts` | argumentInteractionEngine, explainableArgumentEngine, contradictionExtractionService, timelineReconstructionService.js, pipelineJobService.js, legalAnalysisEngine |
| `workbench/caseViewRoutes.ts` | workbenchService.js |
| `workbench/workbenchRoutes.ts` | workbenchService.js, exportService.js |

---

## 5. Service-to-Repository Mapping

Service module → Prisma models it accesses (→ tables via section 6).

| Service | Prisma models |
|---------|---------------|
| `accountProvisioningService.ts` | js, userAccountSettings, organization |
| `aiCreditService.ts` | js, aiCreditBalance, aiCreditUsage |
| `billingEmailService.ts` | js, user |
| `billingMetricsService.ts` | js, subscription, stripeWebhookEvent, securityLog |
| `bodycamVisionService.ts` | visionEvent |
| `chpPolicyImportService.ts` | policyTopic, policyDocument, policyCoverage, agency |
| `complianceDashboardService.ts` | complianceFinding, agency, complianceReviewQueue, evidenceLink, policyRule, crossAgencyComparison, evidenceEvent, policyEvolution, complianceAuditTrail |
| `contradictionStorageService.ts` | js, contradiction, contradictionEvent |
| `cpraAnnualUpdateService.ts` | cPRAAgencyRequest, cPRAAnnualUpdate |
| `cpraDeadlineService.ts` | cPRAAgencyRequest |
| `cpraEmailLogService.ts` | cpraEmailLog |
| `cpraNotificationService.ts` | cpraNotification |
| `cpraTimelineService.ts` | cpraTimelineEvent |
| `disclosureService.ts` | js, disclosurePackage, organizationMember, permissionGrant, criminalCase |
| `discountService.ts` | js |
| `eventExtractionService.ts` | evidenceEvent |
| `evidenceChunkingService.ts` | js, evidenceChunk |
| `evidenceGapDetectionService.ts` | js, evidenceEvent, evidence, timelineEvent, evidenceRequest |
| `factRegistryService.ts` | js, verifiedFact |
| `firmPlatformService.ts` | js, organizationDepartment, organizationMember, personnelProfile, criminalCase, client, clientTeamAssignment, orgInternalMessage, orgTask, knowledgeAsset, conflictRecord, permissionGrant, approvalRequest, evidence, organizationOffice, organization |
| `identityService.ts` | js, emailVerificationToken, user, refreshToken |
| `investigatorWorkbenchService.ts` | js, criminalCase, evidence, timelineEvent, investigationTask, investigationLead, caseWitness, investigationAssignment, fieldNote |
| `juryVisualizationService.ts` | evidenceEvent, juryVisualization |
| `legislativeIngestService.ts` | ts |
| `multiCameraSyncService.ts` | cameraSyncResult |
| `officerActionTimelineService.ts` | evidenceEvent |
| `organizationService.ts` | js, organizationMember, user, organization, organizationOffice, practiceGroup, organizationInvitation, client, criminalCase, evidence, securityLog |
| `pipelineJobService.ts` | js, processingJob |
| `publicationService.ts` | js, publicationAuditLog, documentCopy, publicationSet, publicationSetItem |
| `redactionService.ts` | js, documentRedactionVersion |
| `sceneGeometryService.ts` | sceneGeometry |
| `searchService.ts` | js, criminalCase, evidence, evidenceChunk, timelineEvent, caseMessage |
| `speechAnalysisService.ts` | evidenceEvent |
| `stripeSyncService.ts` | js, subscription |
| `subscriptionService.ts` | js, subscription |
| `timelineReconstructionService.ts` | js, evidence, evidenceEvent, timelineEvent |
| `trajectoryAnalysisService.ts` | trajectoryAnalysis |
| `usageEnforcementService.ts` | js, usageTracking |
| `videoActionDetectionService.ts` | evidenceEvent |
| `visibilitySimulationService.ts` | visibilitySimulation |
| `workbenchService.ts` | js, criminalCase, evidence, timelineEvent, narrativeClaim, impeachmentCandidate, attorneyNote, workbenchPin, investigationTask, evidenceRequest |

_(41 services touch Prisma directly; truncated to 60.)_

---

## 6. Repository-to-Database Mapping

Prisma model → physical table (`@@map`). 103 models.

| Model | Table |
|-------|-------|
| Agency | `agencies` |
| AgencyPolicyMatrix | `agency_policy_matrix` |
| AgencyPolicyStatus | `agency_policy_status` |
| AiCreditBalance | `ai_credit_balances` |
| AiCreditUsage | `ai_credit_usage` |
| ApprovalRequest | `approval_requests` |
| AttorneyNote | `attorney_notes` |
| CPRAAgencyRequest | `cpra_agency_requests` |
| CPRAAnnualUpdate | `cpra_annual_updates` |
| CPRARequestCampaign | `cpra_request_campaigns` |
| CameraSyncResult | `camera_sync_results` |
| CaseHearing | `case_hearings` |
| CaseMessage | `case_messages` |
| CaseWitness | `case_witnesses` |
| Charge | `Charge` |
| ClaimValidation | `claim_validations` |
| Client | `clients` |
| ClientTeamAssignment | `client_team_assignments` |
| ComplianceAuditTrail | `compliance_audit_trail` |
| ComplianceFinding | `compliance_findings` |
| ComplianceReviewQueue | `compliance_review_queue` |
| ConflictRecord | `conflict_records` |
| CorpusIngestionLock | `corpus_ingestion_lock` |
| CorpusIngestionLog | `corpus_ingestion_log` |
| CorpusIngestionState | `corpus_ingestion_state` |
| CorpusRegistry | `corpus_registry` |
| CpraEmailAttachment | `cpra_email_attachments` |
| CpraEmailLog | `cpra_email_log` |
| CpraNotification | `cpra_notifications` |
| CpraRequest | `cpra_requests_v2` |
| CpraRequestLog | `cpra_request_log` |
| CpraTimelineEvent | `cpra_timeline_events` |
| CriminalCase | `criminal_cases` |
| CrossAgencyComparison | `cross_agency_comparisons` |
| DemoRequest | `demo_requests` |
| DisclosurePackage | `disclosure_packages` |
| DiscountCode | `discount_codes` |
| DiscountUsage | `discount_usages` |
| DocumentCopy | `document_copies` |
| DocumentRedactionVersion | `document_redaction_versions` |
| EmailVerificationToken | `email_verification_tokens` |
| EnterpriseLicense | `enterprise_licenses` |
| Evidence | `evidence` |
| EvidenceChunk | `evidence_chunks` |
| EvidenceEvent | `evidence_events` |
| EvidenceGraph | `evidence_graphs` |
| EvidenceLink | `evidence_links` |
| EvidenceRequest | `evidence_requests` |
| EvidenceRequestResponse | `evidence_request_responses` |
| ExpertWitnessPackage | `expert_witness_packages` |
| FieldNote | `field_notes` |
| GovernmentLead | `government_leads` |
| ImpeachmentCandidate | `impeachment_candidates` |
| InvestigationAssignment | `investigation_assignments` |
| InvestigationLead | `investigation_leads` |
| InvestigationTask | `investigation_tasks` |
| JuryVisualization | `jury_visualizations` |
| KnowledgeAsset | `knowledge_assets` |
| LegalDocument | `legal_documents` |
| LegislativeExtractionAudit | `legislative_extraction_audit` |
| LineOfSightAnalysis | `line_of_sight_analyses` |
| MarketingEvent | `marketing_events` |
| NarrativeClaim | `narrative_claims` |
| NormalizedClaimEvent | `normalized_claim_events` |
| OrgInternalMessage | `org_internal_messages` |
| OrgTask | `org_tasks` |
| Organization | `organizations` |
| OrganizationDepartment | `organization_departments` |
| OrganizationInvitation | `organization_invitations` |
| OrganizationMember | `organization_members` |
| OrganizationOffice | `organization_offices` |
| PasswordResetToken | `password_reset_tokens` |
| PermissionGrant | `permission_grants` |
| PersonnelProfile | `personnel_profiles` |
| PolicyActionMapping | `policy_action_mappings` |
| PolicyCoverage | `policy_coverage` |
| PolicyDocument | `policy_documents` |
| PolicyEvolution | `policy_evolution` |
| PolicyInventory | `policy_inventory` |
| PolicyRule | `policy_rules` |
| PolicyTopic | `policy_topics` |
| PolicyTopicCoverage | `policy_topic_coverage` |
| PracticeGroup | `practice_groups` |
| ProcessingJob | `processing_jobs` |
| PublicationAuditLog | `publication_audit_logs` |
| PublicationSet | `publication_sets` |
| PublicationSetItem | `publication_set_items` |
| RefreshToken | `refresh_tokens` |
| SceneGeometry | `scene_geometries` |
| SchemaVersion | `schema_versions` |
| SecurityLog | `security_logs` |
| StripeWebhookEvent | `stripe_webhook_events` |
| Subscription | `subscriptions` |
| TimelineEvent | `timeline_events` |
| TrajectoryAnalysis | `trajectory_analyses` |
| TrialExhibitScene | `trial_exhibit_scenes` |
| UsageTracking | `usage_tracking` |
| User | `users` |
| UserAccountSettings | `user_account_settings` |
| VerifiedFact | `verified_facts` |
| VisibilitySimulation | `visibility_simulations` |
| VisionEvent | `vision_events` |
| WorkbenchPin | `workbench_pins` |

---

## 2. API Dependency Graph

Each endpoint → { authz guards, DB tables (direct), queues }. Full graph in the JSON.

| Method | Route | Authz | Tables (direct) | Queues |
|--------|-------|-------|-----------------|--------|
| GET | `/api/admin/billing/metrics` | (role/route-permission only) | - | - |
| GET | `/api/admin/stats` | (role/route-permission only) | - | - |
| GET | `/api/admin/users` | (role/route-permission only) | - | - |
| GET | `/api/admin/cases` | (role/route-permission only) | - | - |
| DELETE | `/api/admin/users/:userId` | (role/route-permission only) | - | - |
| DELETE | `/api/admin/cases/:caseId` | (role/route-permission only) | - | - |
| DELETE | `/api/admin/evidence/:evidenceId` | (role/route-permission only) | - | - |
| GET | `/api/admin/queues` | (role/route-permission only) | - | (file-level) getQueueHealth |
| GET | `/api/admin/queues/:queueName` | (role/route-permission only) | - | (file-level) getQueueHealth |
| POST | `/api/admin/queues/:queueName/retry-all` | (role/route-permission only) | - | (file-level) getQueueHealth |
| POST | `/api/admin/queues/:queueName/clean` | (role/route-permission only) | - | (file-level) getQueueHealth |
| POST | `/api/cases/:caseId/assistant` | guardCaseAccess | - | - |
| GET | `/api/billing/plans` | (role/route-permission only) | - | - |
| GET | `/api/billing/plans/:planId` | (role/route-permission only) | - | - |
| GET | `/api/billing/subscription` | (role/route-permission only) | - | - |
| POST | `/api/billing/subscription` | (role/route-permission only) | - | - |
| GET | `/api/billing/credits` | (role/route-permission only) | - | - |
| GET | `/api/billing/credits/history` | (role/route-permission only) | - | - |
| GET | `/api/billing/credits/by-type` | (role/route-permission only) | - | - |
| GET | `/api/billing/credits/costs` | (role/route-permission only) | - | - |
| POST | `/api/billing/credits/calculate` | (role/route-permission only) | - | - |
| POST | `/api/billing/credits/deduct` | (role/route-permission only) | - | - |
| GET | `/api/billing/credit-packs` | (role/route-permission only) | - | - |
| POST | `/api/billing/credit-packs/purchase` | (role/route-permission only) | - | - |
| GET | `/api/billing/usage` | (role/route-permission only) | - | - |
| POST | `/api/billing/usage/check-pages` | (role/route-permission only) | - | - |
| POST | `/api/billing/usage/check-credits` | (role/route-permission only) | - | - |
| POST | `/api/billing/usage/record-upload` | (role/route-permission only) | - | - |
| GET | `/api/discount-codes/validate` | - | - | - |
| GET | `/api/admin/discount-codes` | (role/route-permission only) | - | - |
| POST | `/api/admin/discount-codes` | (role/route-permission only) | - | - |
| PATCH | `/api/admin/discount-codes/:codeId` | (role/route-permission only) | - | - |
| DELETE | `/api/admin/discount-codes/:codeId` | (role/route-permission only) | - | - |
| POST | `/api/discount-codes/apply` | (role/route-permission only) | - | - |
| POST | `/api/billing/create-checkout-session` | (role/route-permission only) | users | - |
| GET | `/api/billing/checkout-status/:sessionId` | (role/route-permission only) | - | - |
| POST | `/api/billing/create-portal-session` | (role/route-permission only) | subscriptions | - |
| POST | `/api/charges` | guardCaseAccess | Charge | - |
| GET | `/api/charges/:caseId` | guardCaseAccess | Charge | - |
| DELETE | `/api/charges/:id` | guardCaseAccess | Charge | - |
| POST | `/api/clients` | guardScopeAccess | clients | - |
| GET | `/api/clients` | guardScopeAccess | clients | - |
| GET | `/api/clients/:clientId` | (role/route-permission only) | clients | - |
| PATCH | `/api/clients/:clientId` | (role/route-permission only) | clients | - |
| DELETE | `/api/clients/:clientId` | (role/route-permission only) | clients | - |
| GET | `/api/cases/:caseId/hearings` | guardCaseAccess | case_hearings | - |
| POST | `/api/cases/:caseId/hearings` | guardCaseAccess | case_hearings | - |
| GET | `/api/portal/court-dates` | (role/route-permission only) | users,criminal_cases,case_hearings | - |
| GET | `/api/cases/:caseId/messages` | (role/route-permission only) | case_messages | - |
| POST | `/api/cases/:caseId/messages` | (role/route-permission only) | case_messages | - |
| PATCH | `/api/cases/:caseId/messages/:messageId/read` | (role/route-permission only) | case_messages | - |
| GET | `/api/contradiction/status` | (role/route-permission only) | - | - |
| GET | `/api/contradiction/ontology` | (role/route-permission only) | - | - |
| GET | `/api/contradiction/ontology/:category` | (role/route-permission only) | - | - |
| GET | `/api/contradiction/ontology/event/:eventTypeId` | (role/route-permission only) | - | - |
| POST | `/api/contradiction/extract` | (role/route-permission only) | - | - |
| GET | `/api/contradiction/events/:caseId` | (role/route-permission only) | - | - |
| POST | `/api/contradiction/timeline/:caseId` | (role/route-permission only) | - | - |
| POST | `/api/contradiction/video/process` | (role/route-permission only) | - | - |
| POST | `/api/contradiction/video/bodycam-gaps` | (role/route-permission only) | - | - |
| POST | `/api/contradiction/analyze/:caseId` | (role/route-permission only) | - | - |
| GET | `/api/contradiction/graph/:caseId` | (role/route-permission only) | - | - |
| GET | `/api/contradiction/graph/:caseId/cypher` | (role/route-permission only) | - | - |
| GET | `/api/contradiction/recommendations/:caseId` | (role/route-permission only) | - | - |
| GET | `/api/courtlistener/status` | (role/route-permission only) | - | - |
| GET | `/api/courtlistener/search` | (role/route-permission only) | - | - |
| GET | `/api/courtlistener/opinions/:id` | (role/route-permission only) | - | - |
| GET | `/api/courtlistener/dockets/:id` | (role/route-permission only) | - | - |
| POST | `/api/courtlistener/citation-lookup` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/send` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/send-batch` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/send-all-missing` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/follow-up/:requestId` | (role/route-permission only) | - | - |
| GET | `/api/admin/cpra/progress` | (role/route-permission only) | - | - |
| GET | `/api/admin/cpra/emails/:agencyId` | (role/route-permission only) | - | - |
| GET | `/api/admin/cpra/emails/conversation/:requestId` | (role/route-permission only) | - | - |
| GET | `/api/admin/cpra/email-stats` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/attachments/process` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/attachments/process/:attachmentId` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/classify/:attachmentId` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/classify-all` | (role/route-permission only) | - | - |
| GET | `/api/admin/cpra/notifications` | (role/route-permission only) | - | - |
| GET | `/api/admin/cpra/notifications/count` | (role/route-permission only) | - | - |
| GET | `/api/admin/cpra/notifications/summary` | (role/route-permission only) | - | - |
| PUT | `/api/admin/cpra/notifications/:notificationId/read` | (role/route-permission only) | - | - |
| PUT | `/api/admin/cpra/notifications/read-all` | (role/route-permission only) | - | - |
| DELETE | `/api/admin/cpra/notifications/:notificationId` | (role/route-permission only) | - | - |
| GET | `/api/admin/cpra/timeline/:agencyId` | (role/route-permission only) | - | - |
| GET | `/api/admin/cpra/timeline` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/monitor/poll` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/monitor/simulate` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/monitor/start` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/monitor/stop` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/follow-up/check` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/follow-up/worker/start` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/follow-up/worker/stop` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/ingestion/process` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/ingestion/worker/start` | (role/route-permission only) | - | - |
| POST | `/api/admin/cpra/ingestion/worker/stop` | (role/route-permission only) | - | - |
| GET | `/api/admin/cpra/status` | (role/route-permission only) | - | - |
| GET | `/api/cpra/policy-matrix/topics` | (role/route-permission only) | - | - |
| GET | `/api/cpra/policy-matrix/agencies` | (role/route-permission only) | - | - |
| GET | `/api/cpra/policy-matrix` | (role/route-permission only) | - | - |
| GET | `/api/cpra/policy-matrix/:agencyId` | (role/route-permission only) | - | - |
| PUT | `/api/cpra/policy-matrix/:agencyId/:topicId` | (role/route-permission only) | - | - |
| GET | `/api/cpra/policy-matrix/summary` | (role/route-permission only) | - | - |
| POST | `/api/cpra/policy-matrix/seed` | (role/route-permission only) | - | - |
| GET | `/api/doctrine/status` | (role/route-permission only) | - | - |
| GET | `/api/doctrine/rules` | (role/route-permission only) | - | - |
| GET | `/api/doctrine/rules/:doctrineId` | (role/route-permission only) | - | - |
| GET | `/api/doctrine/search` | (role/route-permission only) | - | - |
| POST | `/api/doctrine/analyze` | (role/route-permission only) | - | - |
| POST | `/api/doctrine/quick-scan` | (role/route-permission only) | - | - |
| POST | `/api/doctrine/ingest` | (role/route-permission only) | - | - |
| POST | `/api/doctrine/seed` | (role/route-permission only) | - | - |
| POST | `/api/doctrine/seed-all` | (role/route-permission only) | - | - |
| POST | `/api/doctrine/seed/:domainCode` | (role/route-permission only) | - | - |
| GET | `/api/doctrine/domains` | (role/route-permission only) | - | - |
| GET | `/api/doctrine/categories` | (role/route-permission only) | - | - |
| GET | `/api/doctrine/chapters` | (role/route-permission only) | - | - |

_(truncated to 120; full in canonical-api-registry.json.)_

---

## 1. Canonical API Registry (by controller)

### `admin/adminRoutes.ts` (7)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/admin/billing/metrics` | yes | CONNECTED | 0 | yes |
| GET | `/api/admin/stats` | yes | CONNECTED | 1 | - |
| GET | `/api/admin/users` | yes | CONNECTED | 1 | - |
| GET | `/api/admin/cases` | yes | CONNECTED | 1 | - |
| DELETE | `/api/admin/users/:userId` | yes | CONNECTED | 1 | - |
| DELETE | `/api/admin/cases/:caseId` | yes | CONNECTED | 1 | - |
| DELETE | `/api/admin/evidence/:evidenceId` | yes | UNUSED | 0 | - |

### `admin/queueMonitorRoutes.ts` (4)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/admin/queues` | yes | UNUSED | 0 | - |
| GET | `/api/admin/queues/:queueName` | yes | UNUSED | 0 | - |
| POST | `/api/admin/queues/:queueName/retry-all` | yes | UNUSED | 0 | - |
| POST | `/api/admin/queues/:queueName/clean` | yes | UNUSED | 0 | - |

### `assistant/litigationAssistantRoutes.ts` (1)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| POST | `/api/cases/:caseId/assistant` | yes | UNUSED | 0 | - |

### `billing/billingRoutes.ts` (16)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/billing/plans` | yes | CONNECTED | 1 | - |
| GET | `/api/billing/plans/:planId` | yes | PARTIALLY CONNECTED | 0 | - |
| GET | `/api/billing/subscription` | yes | CONNECTED | 0 | yes |
| POST | `/api/billing/subscription` | yes | CONNECTED | 0 | yes |
| GET | `/api/billing/credits` | yes | UNUSED | 0 | - |
| GET | `/api/billing/credits/history` | yes | UNUSED | 0 | - |
| GET | `/api/billing/credits/by-type` | yes | UNUSED | 0 | - |
| GET | `/api/billing/credits/costs` | yes | UNUSED | 0 | - |
| POST | `/api/billing/credits/calculate` | yes | UNUSED | 0 | - |
| POST | `/api/billing/credits/deduct` | yes | UNUSED | 0 | - |
| GET | `/api/billing/credit-packs` | yes | UNUSED | 0 | - |
| POST | `/api/billing/credit-packs/purchase` | yes | UNUSED | 0 | - |
| GET | `/api/billing/usage` | yes | CONNECTED | 1 | yes |
| POST | `/api/billing/usage/check-pages` | yes | UNUSED | 0 | - |
| POST | `/api/billing/usage/check-credits` | yes | UNUSED | 0 | - |
| POST | `/api/billing/usage/record-upload` | yes | UNUSED | 0 | - |

### `billing/discountRoutes.ts` (6)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/discount-codes/validate` | PUBLIC | CONNECTED | 1 | - |
| GET | `/api/admin/discount-codes` | yes | CONNECTED | 1 | - |
| POST | `/api/admin/discount-codes` | yes | CONNECTED | 1 | - |
| PATCH | `/api/admin/discount-codes/:codeId` | yes | CONNECTED | 1 | - |
| DELETE | `/api/admin/discount-codes/:codeId` | yes | CONNECTED | 1 | - |
| POST | `/api/discount-codes/apply` | yes | CONNECTED | 1 | - |

### `billing/stripeWebhookHandler.ts` (3)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| POST | `/api/billing/create-checkout-session` | yes | CONNECTED | 2 | - |
| GET | `/api/billing/checkout-status/:sessionId` | yes | UNUSED | 0 | - |
| POST | `/api/billing/create-portal-session` | yes | CONNECTED | 1 | - |

### `charges/chargeRoutes.ts` (3)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| POST | `/api/charges` | yes | CONNECTED | 0 | yes |
| GET | `/api/charges/:caseId` | yes | UNUSED | 0 | - |
| DELETE | `/api/charges/:id` | yes | UNUSED | 0 | - |

### `clients/clientRoutes.ts` (5)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| POST | `/api/clients` | yes | UNUSED | 0 | - |
| GET | `/api/clients` | yes | UNUSED | 0 | - |
| GET | `/api/clients/:clientId` | yes | UNUSED | 0 | - |
| PATCH | `/api/clients/:clientId` | yes | UNUSED | 0 | - |
| DELETE | `/api/clients/:clientId` | yes | UNUSED | 0 | - |

### `communications/hearingRoutes.ts` (3)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/cases/:caseId/hearings` | yes | UNUSED | 0 | - |
| POST | `/api/cases/:caseId/hearings` | yes | UNUSED | 0 | - |
| GET | `/api/portal/court-dates` | yes | UNUSED | 0 | - |

### `communications/messagingRoutes.ts` (3)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/cases/:caseId/messages` | yes | UNUSED | 0 | - |
| POST | `/api/cases/:caseId/messages` | yes | UNUSED | 0 | - |
| PATCH | `/api/cases/:caseId/messages/:messageId/read` | yes | UNUSED | 0 | - |

### `contradiction/contradictionRoutes.ts` (13)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/contradiction/status` | yes | UNUSED | 0 | - |
| GET | `/api/contradiction/ontology` | yes | UNUSED | 0 | - |
| GET | `/api/contradiction/ontology/:category` | yes | PARTIALLY CONNECTED | 0 | - |
| GET | `/api/contradiction/ontology/event/:eventTypeId` | yes | PARTIALLY CONNECTED | 0 | - |
| POST | `/api/contradiction/extract` | yes | UNUSED | 0 | - |
| GET | `/api/contradiction/events/:caseId` | yes | UNUSED | 0 | - |
| POST | `/api/contradiction/timeline/:caseId` | yes | UNUSED | 0 | - |
| POST | `/api/contradiction/video/process` | yes | UNUSED | 0 | - |
| POST | `/api/contradiction/video/bodycam-gaps` | yes | UNUSED | 0 | - |
| POST | `/api/contradiction/analyze/:caseId` | yes | CONNECTED | 1 | - |
| GET | `/api/contradiction/graph/:caseId` | yes | PARTIALLY CONNECTED | 0 | - |
| GET | `/api/contradiction/graph/:caseId/cypher` | yes | PARTIALLY CONNECTED | 0 | - |
| GET | `/api/contradiction/recommendations/:caseId` | yes | PARTIALLY CONNECTED | 1 | - |

### `courtlistener/courtListenerRoutes.ts` (5)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/courtlistener/status` | yes | CONNECTED | 1 | - |
| GET | `/api/courtlistener/search` | yes | CONNECTED | 1 | - |
| GET | `/api/courtlistener/opinions/:id` | yes | UNUSED | 0 | - |
| GET | `/api/courtlistener/dockets/:id` | yes | UNUSED | 0 | - |
| POST | `/api/courtlistener/citation-lookup` | yes | CONNECTED | 1 | - |

### `cpra/autonomousCpraRoutes.ts` (31)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| POST | `/api/admin/cpra/send` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/send-batch` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/send-all-missing` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/follow-up/:requestId` | yes | UNUSED | 0 | - |
| GET | `/api/admin/cpra/progress` | yes | UNUSED | 0 | - |
| GET | `/api/admin/cpra/emails/:agencyId` | yes | UNUSED | 0 | - |
| GET | `/api/admin/cpra/emails/conversation/:requestId` | yes | UNUSED | 0 | - |
| GET | `/api/admin/cpra/email-stats` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/attachments/process` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/attachments/process/:attachmentId` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/classify/:attachmentId` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/classify-all` | yes | UNUSED | 0 | - |
| GET | `/api/admin/cpra/notifications` | yes | UNUSED | 0 | - |
| GET | `/api/admin/cpra/notifications/count` | yes | UNUSED | 0 | - |
| GET | `/api/admin/cpra/notifications/summary` | yes | UNUSED | 0 | - |
| PUT | `/api/admin/cpra/notifications/:notificationId/read` | yes | UNUSED | 0 | - |
| PUT | `/api/admin/cpra/notifications/read-all` | yes | UNUSED | 0 | - |
| DELETE | `/api/admin/cpra/notifications/:notificationId` | yes | UNUSED | 0 | - |
| GET | `/api/admin/cpra/timeline/:agencyId` | yes | UNUSED | 0 | - |
| GET | `/api/admin/cpra/timeline` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/monitor/poll` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/monitor/simulate` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/monitor/start` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/monitor/stop` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/follow-up/check` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/follow-up/worker/start` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/follow-up/worker/stop` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/ingestion/process` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/ingestion/worker/start` | yes | UNUSED | 0 | - |
| POST | `/api/admin/cpra/ingestion/worker/stop` | yes | UNUSED | 0 | - |
| GET | `/api/admin/cpra/status` | yes | UNUSED | 0 | - |

### `cpra/policyMatrixRoutes.ts` (7)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/cpra/policy-matrix/topics` | yes | UNUSED | 0 | - |
| GET | `/api/cpra/policy-matrix/agencies` | yes | UNUSED | 0 | - |
| GET | `/api/cpra/policy-matrix` | yes | UNUSED | 0 | - |
| GET | `/api/cpra/policy-matrix/:agencyId` | yes | UNUSED | 0 | - |
| PUT | `/api/cpra/policy-matrix/:agencyId/:topicId` | yes | UNUSED | 0 | - |
| GET | `/api/cpra/policy-matrix/summary` | yes | UNUSED | 0 | - |
| POST | `/api/cpra/policy-matrix/seed` | yes | UNUSED | 0 | - |

### `doctrine/doctrineRoutes.ts` (13)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/doctrine/status` | yes | CONNECTED | 1 | - |
| GET | `/api/doctrine/rules` | yes | UNUSED | 0 | - |
| GET | `/api/doctrine/rules/:doctrineId` | yes | PARTIALLY CONNECTED | 0 | - |
| GET | `/api/doctrine/search` | yes | CONNECTED | 1 | - |
| POST | `/api/doctrine/analyze` | yes | CONNECTED | 1 | - |
| POST | `/api/doctrine/quick-scan` | yes | CONNECTED | 1 | - |
| POST | `/api/doctrine/ingest` | yes | UNUSED | 0 | - |
| POST | `/api/doctrine/seed` | yes | CONNECTED | 1 | - |
| POST | `/api/doctrine/seed-all` | yes | UNUSED | 0 | - |
| POST | `/api/doctrine/seed/:domainCode` | yes | UNUSED | 0 | - |
| GET | `/api/doctrine/domains` | yes | UNUSED | 0 | - |
| GET | `/api/doctrine/categories` | yes | UNUSED | 0 | - |
| GET | `/api/doctrine/chapters` | yes | UNUSED | 0 | - |

### `evidence/caseRoutes.ts` (5)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| POST | `/api/cases` | yes | CONNECTED | 2 | - |
| GET | `/api/cases` | yes | CONNECTED | 2 | - |
| GET | `/api/cases/:caseId` | yes | CONNECTED | 1 | - |
| PATCH | `/api/cases/:caseId` | yes | CONNECTED | 1 | - |
| DELETE | `/api/cases/:caseId` | yes | CONNECTED | 1 | - |

### `evidence/complianceRoutes.ts` (30)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| POST | `/api/compliance/events/extract` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/events/:caseId` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/events/:caseId/stats` | yes | UNUSED | 0 | - |
| POST | `/api/compliance/video/analyze` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/video/:caseId/summary` | yes | UNUSED | 0 | - |
| POST | `/api/compliance/speech/analyze` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/timeline/:caseId` | yes | UNUSED | 0 | - |
| POST | `/api/compliance/rules/extract` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/rules/:agencyId` | yes | UNUSED | 0 | - |
| POST | `/api/compliance/mappings/generate` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/mappings/:eventType/:agencyId` | yes | UNUSED | 0 | - |
| POST | `/api/compliance/analyze` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/findings/:caseId` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/findings/agency/:agencyId` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/reviews` | yes | UNUSED | 0 | - |
| PUT | `/api/compliance/reviews/:reviewId` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/reviews/stats` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/dashboard` | yes | CONNECTED | 1 | - |
| GET | `/api/compliance/heatmap` | yes | CONNECTED | 1 | - |
| POST | `/api/compliance/report/:caseId` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/exhibits/:caseId` | yes | UNUSED | 0 | - |
| POST | `/api/compliance/compare` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/comparisons` | yes | UNUSED | 0 | - |
| POST | `/api/compliance/training/analyze` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/evolution/:agencyId` | yes | UNUSED | 0 | - |
| POST | `/api/compliance/evolution/:agencyId/detect` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/audit/:caseId` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/expert/:caseId` | yes | UNUSED | 0 | - |
| GET | `/api/compliance/jury/:caseId` | yes | UNUSED | 0 | - |
| POST | `/api/compliance/safety/check` | yes | UNUSED | 0 | - |

### `evidence/evidenceRequestRoutes.ts` (3)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/cases/:caseId/evidence-requests` | yes | CONNECTED | 1 | - |
| POST | `/api/evidence-requests/:id/respond` | yes | CONNECTED | 1 | - |
| POST | `/api/cases/:caseId/evidence-requests/detect` | yes | CONNECTED | 1 | - |

### `evidence/evidenceRoutes.ts` (5)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| POST | `/api/evidence/upload-url` | yes | CONNECTED | 1 | - |
| POST | `/api/evidence` | yes | CONNECTED | 1 | - |
| GET | `/api/cases/:caseId/evidence` | yes | CONNECTED | 1 | - |
| GET | `/api/evidence/:evidenceId` | yes | CONNECTED | 1 | - |
| DELETE | `/api/evidence/:evidenceId` | yes | CONNECTED | 1 | - |

### `evidence/forensicReconstructionRoutes.ts` (22)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| POST | `/api/forensic/vision/analyze` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/vision/:caseId` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/vision/:caseId/critical` | yes | UNUSED | 0 | - |
| POST | `/api/forensic/trajectory/analyze` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/trajectory/:caseId` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/trajectory/profiles` | yes | UNUSED | 0 | - |
| POST | `/api/forensic/visibility/simulate` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/visibility/:caseId` | yes | UNUSED | 0 | - |
| POST | `/api/forensic/line-of-sight/analyze` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/line-of-sight/:caseId` | yes | UNUSED | 0 | - |
| POST | `/api/forensic/camera-sync/synchronize` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/camera-sync/:caseId` | yes | UNUSED | 0 | - |
| POST | `/api/forensic/scene/build` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/scene/:caseId` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/scene/:caseId/exhibit` | yes | PARTIALLY CONNECTED | 0 | - |
| GET | `/api/forensic/timeline/:caseId` | yes | CONNECTED | 1 | - |
| POST | `/api/forensic/evidence-graph/build` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/evidence-graph/:caseId` | yes | UNUSED | 0 | - |
| POST | `/api/forensic/expert-package/generate` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/expert-package/:caseId` | yes | UNUSED | 0 | - |
| POST | `/api/forensic/jury-view/generate` | yes | UNUSED | 0 | - |
| GET | `/api/forensic/jury-view/:caseId` | yes | UNUSED | 0 | - |

### `governance/governanceRoutes.ts` (7)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/corpus/registry` | yes | UNUSED | 0 | - |
| POST | `/api/corpus/register` | yes | UNUSED | 0 | - |
| GET | `/api/corpus/status` | yes | UNUSED | 0 | - |
| GET | `/api/corpus/versions` | yes | UNUSED | 0 | - |
| POST | `/api/corpus/lock` | yes | UNUSED | 0 | - |
| POST | `/api/corpus/unlock` | yes | UNUSED | 0 | - |
| POST | `/api/corpus/ingest` | yes | CONNECTED | 0 | yes |

### `intelligence/intelligenceRoutes.ts` (8)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/cases/:caseId/intelligence` | yes | UNUSED | 0 | - |
| GET | `/api/cases/:caseId/intelligence/report` | yes | UNUSED | 0 | - |
| POST | `/api/cases/:caseId/intelligence/analyze` | yes | UNUSED | 0 | - |
| GET | `/api/narrative/:caseId/claims` | yes | UNUSED | 0 | - |
| GET | `/api/narrative/:caseId/contradictions` | yes | CONNECTED | 1 | - |
| GET | `/api/narrative/:caseId/impeachment` | yes | UNUSED | 0 | - |
| POST | `/api/narrative/analyze/:caseId` | yes | CONNECTED | 1 | - |
| GET | `/api/narrative/health` | yes | UNUSED | 0 | - |

### `investigator/investigatorRoutes.ts` (6)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/cases/:caseId/investigator-workbench` | yes | CONNECTED | 1 | - |
| POST | `/api/cases/:caseId/investigator/witnesses` | yes | CONNECTED | 1 | - |
| POST | `/api/cases/:caseId/investigator/leads` | yes | CONNECTED | 1 | - |
| POST | `/api/cases/:caseId/investigator/field-notes` | yes | CONNECTED | 1 | - |
| POST | `/api/cases/:caseId/investigator/assignments` | yes | UNUSED | 0 | - |
| GET | `/api/investigator/health` | yes | UNUSED | 0 | - |

### `legislative/legislativeRoutes.ts` (9)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/legislative/metrics` | yes | CONNECTED | 0 | yes |
| GET | `/api/legislative/coverage` | yes | UNUSED | 0 | - |
| GET | `/api/legislative/repositories` | yes | UNUSED | 0 | - |
| GET | `/api/legislative/liability` | yes | UNUSED | 0 | - |
| GET | `/api/legislative/classifications/:code/:section` | yes | UNUSED | 0 | - |
| GET | `/api/legislative/intelligence/:code/:section` | yes | UNUSED | 0 | - |
| GET | `/api/legislative/audit` | yes | UNUSED | 0 | - |
| GET | `/api/legislative/repository-integrity` | yes | UNUSED | 0 | - |
| GET | `/api/legislative/statutes/:code/:section` | yes | UNUSED | 0 | - |

### `marketing/contactRoutes.ts` (1)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| POST | `/api/contact` | PUBLIC | CONNECTED | 1 | yes |

### `membership/membershipRoutes.ts` (19)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/membership/account` | yes | CONNECTED | 1 | - |
| PATCH | `/api/membership/settings` | yes | CONNECTED | 1 | - |
| GET | `/api/membership/shared-access` | yes | CONNECTED | 1 | - |
| GET | `/api/membership/accessible-cases` | yes | UNUSED | 0 | - |
| POST | `/api/membership/permission-grants` | yes | CONNECTED | 1 | - |
| GET | `/api/membership/permission-check` | yes | UNUSED | 0 | - |
| GET | `/api/cases/:caseId/documents/:documentId/redactions` | yes | CONNECTED | 1 | - |
| POST | `/api/cases/:caseId/documents/:documentId/redactions` | yes | CONNECTED | 1 | - |
| GET | `/api/cases/:caseId/disclosures` | yes | CONNECTED | 1 | - |
| POST | `/api/cases/:caseId/disclosures` | yes | CONNECTED | 1 | - |
| POST | `/api/cases/:caseId/disclosures/:packageId/publish` | yes | UNUSED | 0 | - |
| POST | `/api/cases/:caseId/documents/:documentId/redactions/:redactionId/publish` | yes | UNUSED | 0 | - |
| GET | `/api/membership/onboarding` | yes | CONNECTED | 1 | - |
| GET | `/api/membership/permission-model` | yes | UNUSED | 0 | - |
| GET | `/api/cases/:caseId/publication-sets` | yes | UNUSED | 0 | - |
| POST | `/api/cases/:caseId/publication-sets` | yes | UNUSED | 0 | - |
| POST | `/api/cases/:caseId/publication-sets/:setId/publish` | yes | UNUSED | 0 | - |
| GET | `/api/cases/:caseId/documents/:documentId/copies` | yes | UNUSED | 0 | - |
| POST | `/api/cases/:caseId/documents/:documentId/copies/original` | yes | UNUSED | 0 | - |

### `observability/observabilityRoutes.ts` (3)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/health/deep` | PUBLIC | CONNECTED | 0 | yes |
| GET | `/api/metrics` | PUBLIC | CONNECTED | 0 | yes |
| GET | `/api/metrics/json` | PUBLIC | CONNECTED | 0 | yes |

### `organizations/firmPlatformRoutes.ts` (22)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/firm/departments` | yes | UNUSED | 0 | - |
| POST | `/api/firm/departments` | yes | UNUSED | 0 | - |
| GET | `/api/firm/personnel` | yes | UNUSED | 0 | - |
| PUT | `/api/firm/personnel/:userId` | yes | UNUSED | 0 | - |
| GET | `/api/firm/clients/:clientId/team` | yes | UNUSED | 0 | - |
| PUT | `/api/firm/clients/:clientId/team` | yes | UNUSED | 0 | - |
| GET | `/api/firm/messages` | yes | UNUSED | 0 | - |
| POST | `/api/firm/messages` | yes | UNUSED | 0 | - |
| GET | `/api/firm/tasks` | yes | UNUSED | 0 | - |
| POST | `/api/firm/tasks` | yes | UNUSED | 0 | - |
| PATCH | `/api/firm/tasks/:taskId` | yes | UNUSED | 0 | - |
| GET | `/api/firm/knowledge` | yes | UNUSED | 0 | - |
| POST | `/api/firm/knowledge` | yes | UNUSED | 0 | - |
| POST | `/api/firm/conflicts/check` | yes | UNUSED | 0 | - |
| GET | `/api/firm/conflicts` | yes | UNUSED | 0 | - |
| GET | `/api/firm/permissions` | yes | UNUSED | 0 | - |
| POST | `/api/firm/permissions` | yes | UNUSED | 0 | - |
| POST | `/api/firm/approvals` | yes | UNUSED | 0 | - |
| PATCH | `/api/firm/approvals/:requestId` | yes | UNUSED | 0 | - |
| GET | `/api/firm/analytics` | yes | UNUSED | 0 | - |
| PATCH | `/api/firm/theme` | yes | UNUSED | 0 | - |
| POST | `/api/firm/offices/seed-california` | yes | UNUSED | 0 | - |

### `organizations/organizationRoutes.ts` (16)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/organizations/current` | yes | CONNECTED | 1 | - |
| PATCH | `/api/organizations/current` | yes | CONNECTED | 1 | - |
| POST | `/api/organizations/onboarding` | yes | CONNECTED | 1 | - |
| GET | `/api/organizations/offices` | yes | CONNECTED | 1 | - |
| POST | `/api/organizations/offices` | yes | CONNECTED | 1 | - |
| GET | `/api/organizations/practice-groups` | yes | CONNECTED | 1 | - |
| POST | `/api/organizations/practice-groups` | yes | CONNECTED | 1 | - |
| GET | `/api/organizations/members` | yes | CONNECTED | 1 | - |
| GET | `/api/organizations/invitations` | yes | CONNECTED | 1 | - |
| POST | `/api/organizations/invitations` | yes | CONNECTED | 1 | - |
| GET | `/api/organizations/analytics` | yes | CONNECTED | 1 | - |
| GET | `/api/organizations/search` | yes | CONNECTED | 1 | - |
| GET | `/api/organizations/audit-logs` | yes | UNUSED | 0 | - |
| GET | `/api/organizations/invitations/preview` | PUBLIC | CONNECTED | 1 | - |
| POST | `/api/auth/accept-invitation` | PUBLIC | CONNECTED | 1 | - |
| GET | `/api/organizations/tenant-verify` | yes | UNUSED | 0 | - |

### `policy/pipeline/operationsConsoleRoutes.ts` (7)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/operations/dashboard` | yes | CONNECTED | 1 | - |
| GET | `/api/operations/deadlines` | yes | UNUSED | 0 | - |
| GET | `/api/operations/topics` | yes | CONNECTED | 1 | - |
| GET | `/api/operations/topics/:agencyId` | yes | CONNECTED | 1 | - |
| GET | `/api/operations/topics/:agencyId/export/csv` | yes | CONNECTED | 1 | - |
| POST | `/api/operations/report` | yes | UNUSED | 0 | - |
| POST | `/api/operations/populate` | yes | UNUSED | 0 | - |

### `policy/pipeline/pipelineRoutes.ts` (9)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/policy-pipeline/stats` | yes | CONNECTED | 1 | - |
| GET | `/api/policy-pipeline/agencies` | yes | CONNECTED | 1 | - |
| GET | `/api/policy-pipeline/agencies/search` | yes | UNUSED | 0 | - |
| GET | `/api/policy-pipeline/agencies/:agencyId` | yes | UNUSED | 0 | - |
| POST | `/api/policy-pipeline/intelligence` | yes | UNUSED | 0 | - |
| POST | `/api/policy-pipeline/run/post-crawl` | yes | UNUSED | 0 | - |
| POST | `/api/policy-pipeline/run/rank` | yes | UNUSED | 0 | - |
| POST | `/api/policy-pipeline/run/enqueue-crawls` | yes | UNUSED | 0 | - |
| POST | `/api/policy-pipeline/run/full` | yes | UNUSED | 0 | - |

### `policy/pipeline/policyIntelligenceRoutes.ts` (18)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/policy-intelligence/dashboard` | yes | CONNECTED | 1 | - |
| POST | `/api/policy-intelligence/sandbox/crawl` | yes | UNUSED | 0 | - |
| GET | `/api/policy-intelligence/sandbox/status` | yes | UNUSED | 0 | - |
| POST | `/api/policy-intelligence/chp/import` | yes | UNUSED | 0 | - |
| GET | `/api/policy-intelligence/chp/status` | yes | UNUSED | 0 | - |
| GET | `/api/policy-intelligence/classification/validate` | yes | UNUSED | 0 | - |
| GET | `/api/policy-intelligence/classification/accuracy` | yes | UNUSED | 0 | - |
| POST | `/api/policy-intelligence/coverage/generate` | yes | UNUSED | 0 | - |
| GET | `/api/policy-intelligence/coverage/agency/:agencyId` | yes | UNUSED | 0 | - |
| GET | `/api/policy-intelligence/coverage/heatmap` | yes | UNUSED | 0 | - |
| GET | `/api/policy-intelligence/coverage/summary` | yes | UNUSED | 0 | - |
| POST | `/api/policy-intelligence/cpra/prepare-queue` | yes | UNUSED | 0 | - |
| GET | `/api/policy-intelligence/cpra/queue-status` | yes | UNUSED | 0 | - |
| POST | `/api/policy-intelligence/cpra/launch-campaign` | yes | UNUSED | 0 | - |
| GET | `/api/policy-intelligence/cpra/campaign-status` | yes | UNUSED | 0 | - |
| POST | `/api/policy-intelligence/responses/process` | yes | UNUSED | 0 | - |
| GET | `/api/policy-intelligence/responses/health` | yes | UNUSED | 0 | - |
| POST | `/api/policy-intelligence/responses/process-pending` | yes | UNUSED | 0 | - |

### `productionGates/productionGatesRoutes.ts` (1)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/admin/production-gates` | yes | UNUSED | 0 | - |

### `productionOperations/productionOperationsRoutes.ts` (10)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/admin/operations/dashboard` | yes | CONNECTED | 1 | - |
| GET | `/api/system/health` | yes | CONNECTED | 1 | - |
| GET | `/api/admin/deployment-checks` | yes | CONNECTED | 1 | - |
| GET | `/api/admin/engineering-dashboard` | yes | UNUSED | 0 | - |
| GET | `/api/admin/audit` | yes | UNUSED | 0 | - |
| GET | `/api/admin/changes` | yes | UNUSED | 0 | - |
| GET | `/api/admin/repository-integrity` | yes | CONNECTED | 1 | - |
| GET | `/api/admin/backup/status` | yes | UNUSED | 0 | - |
| POST | `/api/admin/backup/verify` | yes | UNUSED | 0 | - |
| GET | `/api/admin/alerts` | yes | UNUSED | 0 | - |

### `providers/providerRoutes.ts` (4)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/providers` | yes | UNUSED | 0 | - |
| GET | `/api/providers/health` | yes | UNUSED | 0 | - |
| GET | `/api/providers/:id` | yes | UNUSED | 0 | - |
| GET | `/api/providers/search/:capability` | yes | UNUSED | 0 | - |

### `routes/calcrimRoutes.ts` (1)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/calcrim/analyze/:caseId` | yes | UNUSED | 0 | - |

### `search/searchRoutes.ts` (2)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/search` | yes | CONNECTED | 1 | - |
| GET | `/api/cases/:caseId/search` | yes | UNUSED | 0 | - |

### `security/authMiddleware.ts` (10)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/auth/debug-check` | PUBLIC | CONNECTED | 0 | - |
| POST | `/api/auth/login` | PUBLIC | CONNECTED | 1 | yes |
| POST | `/api/auth/register` | PUBLIC | CONNECTED | 1 | yes |
| POST | `/api/auth/refresh` | PUBLIC | CONNECTED | 0 | yes |
| POST | `/api/auth/logout` | PUBLIC | CONNECTED | 1 | yes |
| GET | `/api/auth/me` | yes | UNUSED | 0 | - |
| POST | `/api/auth/forgot-password` | PUBLIC | CONNECTED | 1 | - |
| POST | `/api/auth/reset-password` | PUBLIC | CONNECTED | 1 | - |
| POST | `/api/admin/reset-password` | yes | UNUSED | 0 | - |
| GET | `/api/security/log` | yes | CONNECTED | 0 | yes |

### `security/identityRoutes.ts` (8)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| POST | `/api/auth/verify-email` | PUBLIC | CONNECTED | 1 | - |
| POST | `/api/auth/resend-verification` | yes | UNUSED | 0 | - |
| POST | `/api/auth/mfa/setup` | yes | UNUSED | 0 | - |
| POST | `/api/auth/mfa/confirm` | yes | UNUSED | 0 | - |
| POST | `/api/auth/mfa/challenge` | PUBLIC | CONNECTED | 1 | - |
| POST | `/api/auth/mfa/disable` | yes | UNUSED | 0 | - |
| GET | `/api/auth/sessions` | yes | UNUSED | 0 | - |
| DELETE | `/api/auth/sessions/:sessionId` | yes | UNUSED | 0 | - |

### `security/rateLimiter.ts` (1)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/admin/rate-limits` | yes | UNUSED | 0 | - |

### `security/securityLogger.ts` (2)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/security/logs` | yes | UNUSED | 0 | - |
| GET | `/api/security/summary` | yes | UNUSED | 0 | - |

### `server.ts` (2)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/health` | PUBLIC | CONNECTED | 0 | yes |
| GET | `/api/auth/csrf-token` | PUBLIC | CONNECTED | 0 | - |

### `timeline/timelineRoutes.ts` (5)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/timeline/:caseId/events` | yes | CONNECTED | 1 | - |
| GET | `/api/timeline/:caseId/conflicts` | yes | CONNECTED | 1 | - |
| POST | `/api/timeline/rebuild/:caseId` | yes | CONNECTED | 1 | - |
| POST | `/api/timeline/process` | yes | UNUSED | 0 | - |
| GET | `/api/timeline/health` | yes | UNUSED | 0 | - |

### `workbench/caseViewRoutes.ts` (2)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/cases/:caseId/litigation-strategy` | yes | CONNECTED | 1 | - |
| GET | `/api/cases/:caseId/trial-exhibits` | yes | CONNECTED | 1 | - |

### `workbench/workbenchRoutes.ts` (16)

| Method | Route | Auth | Status | UI callers | Tested |
|--------|-------|------|--------|-----------|--------|
| GET | `/api/cases/:caseId/workbench` | yes | CONNECTED | 1 | - |
| GET | `/api/cases/:caseId/workbench/command-center` | yes | UNUSED | 0 | - |
| GET | `/api/cases/:caseId/workbench/trial-prep` | yes | UNUSED | 0 | - |
| GET | `/api/cases/:caseId/workbench/export/:packageType` | yes | CONNECTED | 1 | - |
| GET | `/api/cases/:caseId/workbench/notes` | yes | CONNECTED | 1 | - |
| POST | `/api/cases/:caseId/workbench/notes` | yes | CONNECTED | 1 | - |
| PATCH | `/api/cases/:caseId/workbench/notes/:noteId` | yes | UNUSED | 0 | - |
| DELETE | `/api/cases/:caseId/workbench/notes/:noteId` | yes | UNUSED | 0 | - |
| GET | `/api/cases/:caseId/workbench/pins` | yes | CONNECTED | 1 | - |
| POST | `/api/cases/:caseId/workbench/pins` | yes | CONNECTED | 1 | - |
| DELETE | `/api/cases/:caseId/workbench/pins/:pinId` | yes | UNUSED | 0 | - |
| GET | `/api/cases/:caseId/workbench/tasks` | yes | CONNECTED | 1 | - |
| POST | `/api/cases/:caseId/workbench/tasks` | yes | CONNECTED | 1 | - |
| PATCH | `/api/cases/:caseId/workbench/tasks/:taskId` | yes | CONNECTED | 1 | - |
| DELETE | `/api/cases/:caseId/workbench/tasks/:taskId` | yes | CONNECTED | 1 | - |
| GET | `/api/workbench/health` | yes | UNUSED | 0 | - |
