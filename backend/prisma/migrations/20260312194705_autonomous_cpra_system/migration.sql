-- CreateTable
CREATE TABLE "agency_policy_status" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "city" TEXT,
    "county" TEXT,
    "website" TEXT,
    "lastCrawledAt" TIMESTAMP(3),
    "policiesDiscovered" INTEGER NOT NULL DEFAULT 0,
    "policiesDownloaded" INTEGER NOT NULL DEFAULT 0,
    "policiesIngested" INTEGER NOT NULL DEFAULT 0,
    "coverageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpraStatus" TEXT NOT NULL DEFAULT 'none',
    "lastCpraEmailSent" TIMESTAMP(3),
    "cpraDeadline" TIMESTAMP(3),
    "annualUpdateDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_policy_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_inventory" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "policyTitle" TEXT,
    "policyTopic" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "fileHash" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadedAt" TIMESTAMP(3),
    "ocrProcessedAt" TIMESTAMP(3),
    "classificationConfidence" DOUBLE PRECISION,
    "ingestionStatus" TEXT NOT NULL DEFAULT 'discovered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_topic_coverage" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_topic_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpra_request_log" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "emailSentDate" TIMESTAMP(3),
    "emailTemplateUsed" TEXT,
    "recipientEmail" TEXT,
    "responseReceived" BOOLEAN NOT NULL DEFAULT false,
    "responseDate" TIMESTAMP(3),
    "documentsReceived" INTEGER NOT NULL DEFAULT 0,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpra_request_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_exhibit_scenes" (
    "sceneId" TEXT NOT NULL,
    "caseId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "objectSettings" TEXT NOT NULL,
    "cameraSettings" TEXT,
    "markers" TEXT,
    "sceneData" TEXT,
    "animationData" TEXT,
    "createdBy" TEXT,
    "thumbnail" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trial_exhibit_scenes_pkey" PRIMARY KEY ("sceneId")
);

-- CreateTable
CREATE TABLE "evidence_events" (
    "eventId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceEvidence" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'bodycam',
    "description" TEXT,
    "rawText" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "policy_rules" (
    "ruleId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleText" TEXT NOT NULL,
    "conditions" TEXT,
    "exceptions" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'standard',
    "effectiveDate" TIMESTAMP(3),
    "supersededDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_rules_pkey" PRIMARY KEY ("ruleId")
);

-- CreateTable
CREATE TABLE "policy_action_mappings" (
    "mappingId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mappingReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_action_mappings_pkey" PRIMARY KEY ("mappingId")
);

-- CreateTable
CREATE TABLE "compliance_findings" (
    "findingId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "findingType" TEXT NOT NULL DEFAULT 'potential_inconsistency',
    "policyReference" TEXT NOT NULL,
    "ruleId" TEXT,
    "evidenceTimestamp" TEXT NOT NULL,
    "evidenceEventId" TEXT,
    "detectedAction" TEXT NOT NULL,
    "ruleDescription" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ruleConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "analysisConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "explanation" TEXT,
    "safetyLanguage" TEXT NOT NULL DEFAULT 'potential_policy_inconsistency',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_findings_pkey" PRIMARY KEY ("findingId")
);

-- CreateTable
CREATE TABLE "evidence_links" (
    "linkId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "sourceContent" TEXT,
    "sourceUrl" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_links_pkey" PRIMARY KEY ("linkId")
);

-- CreateTable
CREATE TABLE "compliance_review_queue" (
    "reviewId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewerNotes" TEXT,
    "reviewerId" TEXT,
    "approvedForReport" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "assignedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_review_queue_pkey" PRIMARY KEY ("reviewId")
);

-- CreateTable
CREATE TABLE "cross_agency_comparisons" (
    "comparisonId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "agencyAId" TEXT NOT NULL,
    "agencyAName" TEXT NOT NULL,
    "agencyAPolicy" TEXT NOT NULL,
    "agencyBId" TEXT NOT NULL,
    "agencyBName" TEXT NOT NULL,
    "agencyBPolicy" TEXT NOT NULL,
    "differenceType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_agency_comparisons_pkey" PRIMARY KEY ("comparisonId")
);

-- CreateTable
CREATE TABLE "policy_evolution" (
    "evolutionId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "policyTopic" TEXT NOT NULL,
    "previousVersion" TEXT,
    "currentVersion" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_evolution_pkey" PRIMARY KEY ("evolutionId")
);

-- CreateTable
CREATE TABLE "compliance_audit_trail" (
    "auditId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "findingId" TEXT,
    "stepName" TEXT NOT NULL,
    "stepDescription" TEXT NOT NULL,
    "inputData" TEXT,
    "outputData" TEXT,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_audit_trail_pkey" PRIMARY KEY ("auditId")
);

-- CreateTable
CREATE TABLE "vision_events" (
    "eventId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "frameNumber" INTEGER NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "detections" TEXT NOT NULL,
    "poseEstimates" TEXT NOT NULL,
    "distanceEstimates" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vision_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "trajectory_analyses" (
    "analysisId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sceneId" TEXT,
    "trajectories" TEXT NOT NULL,
    "impactPredictions" TEXT NOT NULL,
    "lineOfFire" TEXT NOT NULL,
    "ballisticParams" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trajectory_analyses_pkey" PRIMARY KEY ("analysisId")
);

-- CreateTable
CREATE TABLE "visibility_simulations" (
    "simulationId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sceneId" TEXT,
    "inputConditions" TEXT NOT NULL,
    "visibilityMap" TEXT NOT NULL,
    "shadowMap" TEXT NOT NULL,
    "lightSources" TEXT NOT NULL,
    "subjectVisibility" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visibility_simulations_pkey" PRIMARY KEY ("simulationId")
);

-- CreateTable
CREATE TABLE "line_of_sight_analyses" (
    "analysisId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sceneId" TEXT,
    "observerPosition" TEXT NOT NULL,
    "viewDirection" TEXT NOT NULL,
    "fieldOfView" TEXT NOT NULL,
    "obstacles" TEXT NOT NULL,
    "visibilityResults" TEXT NOT NULL,
    "obstructionMap" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "line_of_sight_analyses_pkey" PRIMARY KEY ("analysisId")
);

-- CreateTable
CREATE TABLE "camera_sync_results" (
    "syncId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sources" TEXT NOT NULL,
    "syncPairs" TEXT NOT NULL,
    "masterTimeline" TEXT NOT NULL,
    "syncQuality" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camera_sync_results_pkey" PRIMARY KEY ("syncId")
);

-- CreateTable
CREATE TABLE "scene_geometries" (
    "geometryId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sceneId" TEXT,
    "bounds" TEXT NOT NULL,
    "buildings" TEXT NOT NULL,
    "roads" TEXT NOT NULL,
    "sidewalks" TEXT NOT NULL,
    "vehicles" TEXT NOT NULL,
    "vegetation" TEXT NOT NULL,
    "obstacles" TEXT NOT NULL,
    "terrain" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_geometries_pkey" PRIMARY KEY ("geometryId")
);

-- CreateTable
CREATE TABLE "evidence_graphs" (
    "graphId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "nodes" TEXT NOT NULL,
    "edges" TEXT NOT NULL,
    "clusters" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_graphs_pkey" PRIMARY KEY ("graphId")
);

-- CreateTable
CREATE TABLE "expert_witness_packages" (
    "packageId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "packageVersion" TEXT NOT NULL,
    "expertInfo" TEXT NOT NULL,
    "sections" TEXT NOT NULL,
    "sceneReconstruction" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "policyAnalysis" TEXT NOT NULL,
    "evidenceClips" TEXT NOT NULL,
    "analysisReport" TEXT NOT NULL,
    "appendices" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_witness_packages_pkey" PRIMARY KEY ("packageId")
);

-- CreateTable
CREATE TABLE "jury_visualizations" (
    "visualizationId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sceneView" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "highlightedEvents" TEXT NOT NULL,
    "narrativeCards" TEXT NOT NULL,
    "viewerSettings" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jury_visualizations_pkey" PRIMARY KEY ("visualizationId")
);

-- CreateTable
CREATE TABLE "agency_policy_matrix" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
    "requestDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "uploadedDate" TIMESTAMP(3),
    "inUseDate" TIMESTAMP(3),
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_policy_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpra_requests_v2" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "dateSent" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "responseReceived" BOOLEAN NOT NULL DEFAULT false,
    "followupDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpra_requests_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_credit_balances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyCredits" INTEGER NOT NULL DEFAULT 0,
    "purchasedCredits" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_credit_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_credit_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT,
    "analysisType" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_credit_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_tracking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "pagesUploadedTotal" INTEGER NOT NULL DEFAULT 0,
    "videoMinutesProcessed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpra_email_log" (
    "emailId" TEXT NOT NULL,
    "agencyId" TEXT,
    "direction" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "fromAddress" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT,
    "policyTopics" TEXT,
    "sesMessageId" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cpra_email_log_pkey" PRIMARY KEY ("emailId")
);

-- CreateTable
CREATE TABLE "cpra_email_attachments" (
    "attachmentId" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSizeBytes" INTEGER,
    "fileUrl" TEXT,
    "uploadTimestamp" TIMESTAMP(3),
    "documentType" TEXT,
    "classificationConfidence" DOUBLE PRECISION,
    "policyTopicDetected" TEXT,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpra_email_attachments_pkey" PRIMARY KEY ("attachmentId")
);

-- CreateTable
CREATE TABLE "cpra_notifications" (
    "notificationId" TEXT NOT NULL,
    "agencyId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cpra_notifications_pkey" PRIMARY KEY ("notificationId")
);

-- CreateTable
CREATE TABLE "cpra_timeline_events" (
    "eventId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cpra_timeline_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "agency_policy_status_agencyId_key" ON "agency_policy_status"("agencyId");

-- CreateIndex
CREATE INDEX "agency_policy_status_county_idx" ON "agency_policy_status"("county");

-- CreateIndex
CREATE INDEX "agency_policy_status_cpraStatus_idx" ON "agency_policy_status"("cpraStatus");

-- CreateIndex
CREATE INDEX "agency_policy_status_coverageScore_idx" ON "agency_policy_status"("coverageScore");

-- CreateIndex
CREATE INDEX "agency_policy_status_cpraDeadline_idx" ON "agency_policy_status"("cpraDeadline");

-- CreateIndex
CREATE INDEX "policy_inventory_agencyId_idx" ON "policy_inventory"("agencyId");

-- CreateIndex
CREATE INDEX "policy_inventory_ingestionStatus_idx" ON "policy_inventory"("ingestionStatus");

-- CreateIndex
CREATE INDEX "policy_inventory_policyTopic_idx" ON "policy_inventory"("policyTopic");

-- CreateIndex
CREATE INDEX "policy_topic_coverage_agencyId_idx" ON "policy_topic_coverage"("agencyId");

-- CreateIndex
CREATE INDEX "policy_topic_coverage_topic_idx" ON "policy_topic_coverage"("topic");

-- CreateIndex
CREATE INDEX "policy_topic_coverage_status_idx" ON "policy_topic_coverage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "policy_topic_coverage_agencyId_topic_key" ON "policy_topic_coverage"("agencyId", "topic");

-- CreateIndex
CREATE INDEX "cpra_request_log_agencyId_idx" ON "cpra_request_log"("agencyId");

-- CreateIndex
CREATE INDEX "cpra_request_log_requestId_idx" ON "cpra_request_log"("requestId");

-- CreateIndex
CREATE INDEX "cpra_request_log_responseReceived_idx" ON "cpra_request_log"("responseReceived");

-- CreateIndex
CREATE INDEX "cpra_request_log_followUpRequired_idx" ON "cpra_request_log"("followUpRequired");

-- CreateIndex
CREATE INDEX "trial_exhibit_scenes_caseId_idx" ON "trial_exhibit_scenes"("caseId");

-- CreateIndex
CREATE INDEX "trial_exhibit_scenes_createdBy_idx" ON "trial_exhibit_scenes"("createdBy");

-- CreateIndex
CREATE INDEX "evidence_events_caseId_idx" ON "evidence_events"("caseId");

-- CreateIndex
CREATE INDEX "evidence_events_eventType_idx" ON "evidence_events"("eventType");

-- CreateIndex
CREATE INDEX "evidence_events_sourceType_idx" ON "evidence_events"("sourceType");

-- CreateIndex
CREATE INDEX "evidence_events_confidence_idx" ON "evidence_events"("confidence");

-- CreateIndex
CREATE INDEX "policy_rules_policyId_idx" ON "policy_rules"("policyId");

-- CreateIndex
CREATE INDEX "policy_rules_agencyId_idx" ON "policy_rules"("agencyId");

-- CreateIndex
CREATE INDEX "policy_rules_ruleType_idx" ON "policy_rules"("ruleType");

-- CreateIndex
CREATE INDEX "policy_rules_category_idx" ON "policy_rules"("category");

-- CreateIndex
CREATE INDEX "policy_rules_severity_idx" ON "policy_rules"("severity");

-- CreateIndex
CREATE INDEX "policy_action_mappings_eventType_idx" ON "policy_action_mappings"("eventType");

-- CreateIndex
CREATE INDEX "policy_action_mappings_ruleId_idx" ON "policy_action_mappings"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_action_mappings_eventType_ruleId_key" ON "policy_action_mappings"("eventType", "ruleId");

-- CreateIndex
CREATE INDEX "compliance_findings_caseId_idx" ON "compliance_findings"("caseId");

-- CreateIndex
CREATE INDEX "compliance_findings_agencyId_idx" ON "compliance_findings"("agencyId");

-- CreateIndex
CREATE INDEX "compliance_findings_findingType_idx" ON "compliance_findings"("findingType");

-- CreateIndex
CREATE INDEX "compliance_findings_confidence_idx" ON "compliance_findings"("confidence");

-- CreateIndex
CREATE INDEX "evidence_links_findingId_idx" ON "evidence_links"("findingId");

-- CreateIndex
CREATE INDEX "evidence_links_linkType_idx" ON "evidence_links"("linkType");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_review_queue_findingId_key" ON "compliance_review_queue"("findingId");

-- CreateIndex
CREATE INDEX "compliance_review_queue_reviewStatus_idx" ON "compliance_review_queue"("reviewStatus");

-- CreateIndex
CREATE INDEX "compliance_review_queue_priority_idx" ON "compliance_review_queue"("priority");

-- CreateIndex
CREATE INDEX "compliance_review_queue_approvedForReport_idx" ON "compliance_review_queue"("approvedForReport");

-- CreateIndex
CREATE INDEX "cross_agency_comparisons_topic_idx" ON "cross_agency_comparisons"("topic");

-- CreateIndex
CREATE INDEX "cross_agency_comparisons_agencyAId_idx" ON "cross_agency_comparisons"("agencyAId");

-- CreateIndex
CREATE INDEX "cross_agency_comparisons_agencyBId_idx" ON "cross_agency_comparisons"("agencyBId");

-- CreateIndex
CREATE INDEX "policy_evolution_agencyId_idx" ON "policy_evolution"("agencyId");

-- CreateIndex
CREATE INDEX "policy_evolution_policyTopic_idx" ON "policy_evolution"("policyTopic");

-- CreateIndex
CREATE INDEX "policy_evolution_changeType_idx" ON "policy_evolution"("changeType");

-- CreateIndex
CREATE INDEX "compliance_audit_trail_caseId_idx" ON "compliance_audit_trail"("caseId");

-- CreateIndex
CREATE INDEX "compliance_audit_trail_findingId_idx" ON "compliance_audit_trail"("findingId");

-- CreateIndex
CREATE INDEX "compliance_audit_trail_stepName_idx" ON "compliance_audit_trail"("stepName");

-- CreateIndex
CREATE INDEX "vision_events_caseId_idx" ON "vision_events"("caseId");

-- CreateIndex
CREATE INDEX "vision_events_sourceId_idx" ON "vision_events"("sourceId");

-- CreateIndex
CREATE INDEX "vision_events_eventCategory_idx" ON "vision_events"("eventCategory");

-- CreateIndex
CREATE INDEX "vision_events_confidence_idx" ON "vision_events"("confidence");

-- CreateIndex
CREATE INDEX "trajectory_analyses_caseId_idx" ON "trajectory_analyses"("caseId");

-- CreateIndex
CREATE INDEX "trajectory_analyses_sceneId_idx" ON "trajectory_analyses"("sceneId");

-- CreateIndex
CREATE INDEX "visibility_simulations_caseId_idx" ON "visibility_simulations"("caseId");

-- CreateIndex
CREATE INDEX "visibility_simulations_sceneId_idx" ON "visibility_simulations"("sceneId");

-- CreateIndex
CREATE INDEX "line_of_sight_analyses_caseId_idx" ON "line_of_sight_analyses"("caseId");

-- CreateIndex
CREATE INDEX "line_of_sight_analyses_sceneId_idx" ON "line_of_sight_analyses"("sceneId");

-- CreateIndex
CREATE INDEX "camera_sync_results_caseId_idx" ON "camera_sync_results"("caseId");

-- CreateIndex
CREATE INDEX "scene_geometries_caseId_idx" ON "scene_geometries"("caseId");

-- CreateIndex
CREATE INDEX "scene_geometries_sceneId_idx" ON "scene_geometries"("sceneId");

-- CreateIndex
CREATE INDEX "evidence_graphs_caseId_idx" ON "evidence_graphs"("caseId");

-- CreateIndex
CREATE INDEX "expert_witness_packages_caseId_idx" ON "expert_witness_packages"("caseId");

-- CreateIndex
CREATE INDEX "jury_visualizations_caseId_idx" ON "jury_visualizations"("caseId");

-- CreateIndex
CREATE INDEX "agency_policy_matrix_agencyId_idx" ON "agency_policy_matrix"("agencyId");

-- CreateIndex
CREATE INDEX "agency_policy_matrix_topicId_idx" ON "agency_policy_matrix"("topicId");

-- CreateIndex
CREATE INDEX "agency_policy_matrix_status_idx" ON "agency_policy_matrix"("status");

-- CreateIndex
CREATE UNIQUE INDEX "agency_policy_matrix_agencyId_topicId_key" ON "agency_policy_matrix"("agencyId", "topicId");

-- CreateIndex
CREATE INDEX "cpra_requests_v2_agencyId_idx" ON "cpra_requests_v2"("agencyId");

-- CreateIndex
CREATE INDEX "cpra_requests_v2_topicId_idx" ON "cpra_requests_v2"("topicId");

-- CreateIndex
CREATE INDEX "cpra_requests_v2_status_idx" ON "cpra_requests_v2"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_credit_balances_userId_key" ON "ai_credit_balances"("userId");

-- CreateIndex
CREATE INDEX "ai_credit_balances_userId_idx" ON "ai_credit_balances"("userId");

-- CreateIndex
CREATE INDEX "ai_credit_balances_billingPeriodEnd_idx" ON "ai_credit_balances"("billingPeriodEnd");

-- CreateIndex
CREATE INDEX "ai_credit_usage_userId_idx" ON "ai_credit_usage"("userId");

-- CreateIndex
CREATE INDEX "ai_credit_usage_caseId_idx" ON "ai_credit_usage"("caseId");

-- CreateIndex
CREATE INDEX "ai_credit_usage_analysisType_idx" ON "ai_credit_usage"("analysisType");

-- CreateIndex
CREATE INDEX "ai_credit_usage_timestamp_idx" ON "ai_credit_usage"("timestamp");

-- CreateIndex
CREATE INDEX "usage_tracking_userId_idx" ON "usage_tracking"("userId");

-- CreateIndex
CREATE INDEX "usage_tracking_organizationId_idx" ON "usage_tracking"("organizationId");

-- CreateIndex
CREATE INDEX "usage_tracking_billingPeriodEnd_idx" ON "usage_tracking"("billingPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "usage_tracking_userId_billingPeriodStart_key" ON "usage_tracking"("userId", "billingPeriodStart");

-- CreateIndex
CREATE INDEX "cpra_email_log_agencyId_idx" ON "cpra_email_log"("agencyId");

-- CreateIndex
CREATE INDEX "cpra_email_log_direction_idx" ON "cpra_email_log"("direction");

-- CreateIndex
CREATE INDEX "cpra_email_log_requestId_idx" ON "cpra_email_log"("requestId");

-- CreateIndex
CREATE INDEX "cpra_email_log_processed_idx" ON "cpra_email_log"("processed");

-- CreateIndex
CREATE INDEX "cpra_email_log_sentTimestamp_idx" ON "cpra_email_log"("sentTimestamp");

-- CreateIndex
CREATE INDEX "cpra_email_attachments_emailId_idx" ON "cpra_email_attachments"("emailId");

-- CreateIndex
CREATE INDEX "cpra_email_attachments_processingStatus_idx" ON "cpra_email_attachments"("processingStatus");

-- CreateIndex
CREATE INDEX "cpra_email_attachments_documentType_idx" ON "cpra_email_attachments"("documentType");

-- CreateIndex
CREATE INDEX "cpra_notifications_agencyId_idx" ON "cpra_notifications"("agencyId");

-- CreateIndex
CREATE INDEX "cpra_notifications_eventType_idx" ON "cpra_notifications"("eventType");

-- CreateIndex
CREATE INDEX "cpra_notifications_read_idx" ON "cpra_notifications"("read");

-- CreateIndex
CREATE INDEX "cpra_notifications_createdAt_idx" ON "cpra_notifications"("createdAt");

-- CreateIndex
CREATE INDEX "cpra_timeline_events_agencyId_idx" ON "cpra_timeline_events"("agencyId");

-- CreateIndex
CREATE INDEX "cpra_timeline_events_eventType_idx" ON "cpra_timeline_events"("eventType");

-- CreateIndex
CREATE INDEX "cpra_timeline_events_createdAt_idx" ON "cpra_timeline_events"("createdAt");

-- AddForeignKey
ALTER TABLE "agency_policy_status" ADD CONSTRAINT "agency_policy_status_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("agencyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpra_email_attachments" ADD CONSTRAINT "cpra_email_attachments_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "cpra_email_log"("emailId") ON DELETE RESTRICT ON UPDATE CASCADE;
