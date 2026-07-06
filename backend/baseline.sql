-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL DEFAULT 'FREE',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
    "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_logs" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "userId" TEXT,
    "ip" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_ingestion_state" (
    "id" TEXT NOT NULL,
    "corpusName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "lastProcessedOffset" INTEGER NOT NULL DEFAULT 0,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalRecords" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corpus_ingestion_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_ingestion_log" (
    "id" TEXT NOT NULL,
    "corpusName" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "recordsInserted" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_ingestion_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "corpusName" TEXT,
    "sourceFile" TEXT,
    "contentHash" TEXT NOT NULL,
    "corpusVersion" TEXT,
    "documentVersion" TEXT NOT NULL DEFAULT '1.0',
    "supersededBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_registry" (
    "id" TEXT NOT NULL,
    "corpusName" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "sourceAuthority" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "releaseDate" TIMESTAMP(3),
    "ingestionStatus" TEXT NOT NULL DEFAULT 'pending',
    "totalDocuments" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corpus_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_ingestion_lock" (
    "id" TEXT NOT NULL,
    "corpusName" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "corpus_ingestion_lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "agencyId" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "agencyType" TEXT,
    "city" TEXT,
    "county" TEXT,
    "populationEstimate" INTEGER,
    "jurisdictionRank" INTEGER,
    "website" TEXT,
    "postDirectoryUrl" TEXT,
    "recordsRequestUrl" TEXT,
    "policyCollectionUrl" TEXT,
    "policiesDiscovered" BOOLEAN NOT NULL DEFAULT false,
    "crawlStatus" TEXT NOT NULL DEFAULT 'pending',
    "crawlError" TEXT,
    "lastCrawledAt" TIMESTAMP(3),
    "pagesFound" INTEGER NOT NULL DEFAULT 0,
    "policyPagesFound" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("agencyId")
);

-- CreateTable
CREATE TABLE "policy_topics" (
    "id" TEXT NOT NULL,
    "topicName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "description" TEXT,
    "chpReference" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_documents" (
    "documentId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "topicId" TEXT,
    "documentType" TEXT,
    "title" TEXT,
    "policyNumber" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "s3Url" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "textExtracted" BOOLEAN NOT NULL DEFAULT false,
    "textContent" TEXT,
    "ocrStatus" TEXT NOT NULL DEFAULT 'pending',
    "ocrError" TEXT,
    "classificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "classificationScore" DOUBLE PRECISION,
    "isChpCanonical" BOOLEAN NOT NULL DEFAULT false,
    "matchedTopicConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("documentId")
);

-- CreateTable
CREATE TABLE "policy_coverage" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "policyFound" BOOLEAN NOT NULL DEFAULT false,
    "documentId" TEXT,
    "sourceUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpra_request_campaigns" (
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cpra_request_campaigns_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "cpra_agency_requests" (
    "requestId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "lastFollowUpAt" TIMESTAMP(3),
    "responseReceived" BOOLEAN NOT NULL DEFAULT false,
    "responseReceivedAt" TIMESTAMP(3),
    "policyReceivedAt" TIMESTAMP(3),
    "annualUpdateDue" TIMESTAMP(3),
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpra_agency_requests_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE "cpra_annual_updates" (
    "updateId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "responseReceived" BOOLEAN NOT NULL DEFAULT false,
    "responseReceivedAt" TIMESTAMP(3),
    "policyReceivedAt" TIMESTAMP(3),
    "annualUpdateDue" TIMESTAMP(3),
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "lastFollowUpAt" TIMESTAMP(3),
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpra_annual_updates_pkey" PRIMARY KEY ("updateId")
);

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

-- CreateTable
CREATE TABLE "criminal_cases" (
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "phase" TEXT NOT NULL DEFAULT 'intake',
    "court" TEXT,
    "judge" TEXT,
    "department" TEXT,
    "nextHearing" TIMESTAMP(3),
    "nextHearingNote" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "criminal_cases_pkey" PRIMARY KEY ("caseId")
);

-- CreateTable
CREATE TABLE "evidence" (
    "evidenceId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" BIGINT NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "pageCount" INTEGER,
    "evidenceType" TEXT NOT NULL,
    "s3Key" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "processingError" TEXT,
    "multiplexDetected" BOOLEAN NOT NULL DEFAULT false,
    "multiplexCount" INTEGER,
    "normalizedPageCount" INTEGER,
    "acuCost" DOUBLE PRECISION,
    "acuConsumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("evidenceId")
);

-- CreateTable
CREATE TABLE "evidence_chunks" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verified_facts" (
    "factId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "factType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sourceEvidenceId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lockedAt" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verified_facts_pkey" PRIMARY KEY ("factId")
);

-- CreateTable
CREATE TABLE "narrative_claims" (
    "claimId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "object" TEXT,
    "target" TEXT,
    "timestampReference" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sentenceIndex" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "narrative_claims_pkey" PRIMARY KEY ("claimId")
);

-- CreateTable
CREATE TABLE "normalized_claim_events" (
    "eventId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actionNorm" TEXT NOT NULL,
    "object" TEXT,
    "target" TEXT,
    "timestamp" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "normalized_claim_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "claim_validations" (
    "validationId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "supportingEvidenceIds" JSONB NOT NULL DEFAULT '[]',
    "contradictingEvidenceIds" JSONB NOT NULL DEFAULT '[]',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "reasoning" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_validations_pkey" PRIMARY KEY ("validationId")
);

-- CreateTable
CREATE TABLE "impeachment_candidates" (
    "impeachmentId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "contradictionType" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "contradictingEvidence" TEXT NOT NULL,
    "suggestedQuestion" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impeachment_candidates_pkey" PRIMARY KEY ("impeachmentId")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT,
    "pipeline" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "failureCode" TEXT,
    "acuCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sourceDoc" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actor" TEXT,
    "location" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
    "conflictsWith" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" TEXT NOT NULL,
    "codeName" TEXT NOT NULL,
    "codeValue" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_usages" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "agencyType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_licenses" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "agencyType" TEXT NOT NULL,
    "seatCount" INTEGER NOT NULL,
    "licenseStart" TIMESTAMP(3) NOT NULL,
    "licenseEnd" TIMESTAMP(3) NOT NULL,
    "billingTier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminEmail" TEXT NOT NULL,
    "county" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "government_leads" (
    "id" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT NOT NULL,
    "agencyType" TEXT NOT NULL,
    "seatEstimate" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "government_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_events" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedBy" TEXT NOT NULL DEFAULT 'prisma-migrate',
    "description" TEXT,
    "migrationName" TEXT NOT NULL,
    "driftChecked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "schema_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_planId_idx" ON "subscriptions"("planId");

-- CreateIndex
CREATE INDEX "subscriptions_stripeSubscriptionId_idx" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_stripeCustomerId_idx" ON "subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "security_logs_event_idx" ON "security_logs"("event");

-- CreateIndex
CREATE INDEX "security_logs_userId_idx" ON "security_logs"("userId");

-- CreateIndex
CREATE INDEX "security_logs_ip_idx" ON "security_logs"("ip");

-- CreateIndex
CREATE INDEX "security_logs_createdAt_idx" ON "security_logs"("createdAt");

-- CreateIndex
CREATE INDEX "corpus_ingestion_state_corpusName_idx" ON "corpus_ingestion_state"("corpusName");

-- CreateIndex
CREATE INDEX "corpus_ingestion_state_status_idx" ON "corpus_ingestion_state"("status");

-- CreateIndex
CREATE UNIQUE INDEX "corpus_ingestion_state_corpusName_fileName_key" ON "corpus_ingestion_state"("corpusName", "fileName");

-- CreateIndex
CREATE INDEX "corpus_ingestion_log_corpusName_idx" ON "corpus_ingestion_log"("corpusName");

-- CreateIndex
CREATE INDEX "corpus_ingestion_log_timestamp_idx" ON "corpus_ingestion_log"("timestamp");

-- CreateIndex
CREATE INDEX "legal_documents_tenantId_idx" ON "legal_documents"("tenantId");

-- CreateIndex
CREATE INDEX "legal_documents_documentType_idx" ON "legal_documents"("documentType");

-- CreateIndex
CREATE INDEX "legal_documents_corpusName_idx" ON "legal_documents"("corpusName");

-- CreateIndex
CREATE INDEX "legal_documents_jurisdiction_idx" ON "legal_documents"("jurisdiction");

-- CreateIndex
CREATE INDEX "legal_documents_contentHash_idx" ON "legal_documents"("contentHash");

-- CreateIndex
CREATE INDEX "legal_documents_supersededBy_idx" ON "legal_documents"("supersededBy");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_contentHash_tenantId_key" ON "legal_documents"("contentHash", "tenantId");

-- CreateIndex
CREATE INDEX "corpus_registry_corpusName_idx" ON "corpus_registry"("corpusName");

-- CreateIndex
CREATE INDEX "corpus_registry_jurisdiction_idx" ON "corpus_registry"("jurisdiction");

-- CreateIndex
CREATE INDEX "corpus_registry_ingestionStatus_idx" ON "corpus_registry"("ingestionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "corpus_registry_corpusName_version_key" ON "corpus_registry"("corpusName", "version");

-- CreateIndex
CREATE UNIQUE INDEX "corpus_ingestion_lock_corpusName_key" ON "corpus_ingestion_lock"("corpusName");

-- CreateIndex
CREATE INDEX "corpus_ingestion_lock_corpusName_idx" ON "corpus_ingestion_lock"("corpusName");

-- CreateIndex
CREATE INDEX "corpus_ingestion_lock_expiresAt_idx" ON "corpus_ingestion_lock"("expiresAt");

-- CreateIndex
CREATE INDEX "agencies_county_idx" ON "agencies"("county");

-- CreateIndex
CREATE INDEX "agencies_agencyType_idx" ON "agencies"("agencyType");

-- CreateIndex
CREATE INDEX "agencies_crawlStatus_idx" ON "agencies"("crawlStatus");

-- CreateIndex
CREATE INDEX "agencies_jurisdictionRank_idx" ON "agencies"("jurisdictionRank");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_agencyName_county_key" ON "agencies"("agencyName", "county");

-- CreateIndex
CREATE UNIQUE INDEX "policy_topics_topicName_key" ON "policy_topics"("topicName");

-- CreateIndex
CREATE INDEX "policy_topics_category_idx" ON "policy_topics"("category");

-- CreateIndex
CREATE INDEX "policy_documents_agencyId_idx" ON "policy_documents"("agencyId");

-- CreateIndex
CREATE INDEX "policy_documents_topicId_idx" ON "policy_documents"("topicId");

-- CreateIndex
CREATE INDEX "policy_documents_documentType_idx" ON "policy_documents"("documentType");

-- CreateIndex
CREATE INDEX "policy_documents_ocrStatus_idx" ON "policy_documents"("ocrStatus");

-- CreateIndex
CREATE INDEX "policy_documents_classificationStatus_idx" ON "policy_documents"("classificationStatus");

-- CreateIndex
CREATE INDEX "policy_documents_isChpCanonical_idx" ON "policy_documents"("isChpCanonical");

-- CreateIndex
CREATE INDEX "policy_coverage_agencyId_idx" ON "policy_coverage"("agencyId");

-- CreateIndex
CREATE INDEX "policy_coverage_topicId_idx" ON "policy_coverage"("topicId");

-- CreateIndex
CREATE INDEX "policy_coverage_policyFound_idx" ON "policy_coverage"("policyFound");

-- CreateIndex
CREATE UNIQUE INDEX "policy_coverage_agencyId_topicId_key" ON "policy_coverage"("agencyId", "topicId");

-- CreateIndex
CREATE INDEX "cpra_request_campaigns_active_idx" ON "cpra_request_campaigns"("active");

-- CreateIndex
CREATE INDEX "cpra_agency_requests_campaignId_idx" ON "cpra_agency_requests"("campaignId");

-- CreateIndex
CREATE INDEX "cpra_agency_requests_agencyId_idx" ON "cpra_agency_requests"("agencyId");

-- CreateIndex
CREATE INDEX "cpra_agency_requests_status_idx" ON "cpra_agency_requests"("status");

-- CreateIndex
CREATE INDEX "cpra_agency_requests_closed_idx" ON "cpra_agency_requests"("closed");

-- CreateIndex
CREATE INDEX "cpra_agency_requests_responseReceived_idx" ON "cpra_agency_requests"("responseReceived");

-- CreateIndex
CREATE INDEX "cpra_agency_requests_annualUpdateDue_idx" ON "cpra_agency_requests"("annualUpdateDue");

-- CreateIndex
CREATE INDEX "cpra_annual_updates_agencyId_idx" ON "cpra_annual_updates"("agencyId");

-- CreateIndex
CREATE INDEX "cpra_annual_updates_annualUpdateDue_idx" ON "cpra_annual_updates"("annualUpdateDue");

-- CreateIndex
CREATE INDEX "cpra_annual_updates_status_idx" ON "cpra_annual_updates"("status");

-- CreateIndex
CREATE INDEX "cpra_annual_updates_closed_idx" ON "cpra_annual_updates"("closed");

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

-- CreateIndex
CREATE INDEX "criminal_cases_tenantId_idx" ON "criminal_cases"("tenantId");

-- CreateIndex
CREATE INDEX "criminal_cases_ownerId_idx" ON "criminal_cases"("ownerId");

-- CreateIndex
CREATE INDEX "criminal_cases_status_idx" ON "criminal_cases"("status");

-- CreateIndex
CREATE INDEX "criminal_cases_caseType_idx" ON "criminal_cases"("caseType");

-- CreateIndex
CREATE INDEX "criminal_cases_createdAt_idx" ON "criminal_cases"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "criminal_cases_tenantId_caseNumber_key" ON "criminal_cases"("tenantId", "caseNumber");

-- CreateIndex
CREATE INDEX "evidence_caseId_idx" ON "evidence"("caseId");

-- CreateIndex
CREATE INDEX "evidence_tenantId_idx" ON "evidence"("tenantId");

-- CreateIndex
CREATE INDEX "evidence_evidenceType_idx" ON "evidence"("evidenceType");

-- CreateIndex
CREATE INDEX "evidence_processingStatus_idx" ON "evidence"("processingStatus");

-- CreateIndex
CREATE INDEX "evidence_analysisStatus_idx" ON "evidence"("analysisStatus");

-- CreateIndex
CREATE INDEX "evidence_chunks_evidenceId_idx" ON "evidence_chunks"("evidenceId");

-- CreateIndex
CREATE INDEX "evidence_chunks_tenantId_idx" ON "evidence_chunks"("tenantId");

-- CreateIndex
CREATE INDEX "evidence_chunks_checksum_idx" ON "evidence_chunks"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_chunks_evidenceId_chunkIndex_key" ON "evidence_chunks"("evidenceId", "chunkIndex");

-- CreateIndex
CREATE INDEX "verified_facts_caseId_idx" ON "verified_facts"("caseId");

-- CreateIndex
CREATE INDEX "verified_facts_tenantId_idx" ON "verified_facts"("tenantId");

-- CreateIndex
CREATE INDEX "verified_facts_factType_idx" ON "verified_facts"("factType");

-- CreateIndex
CREATE INDEX "verified_facts_contentHash_idx" ON "verified_facts"("contentHash");

-- CreateIndex
CREATE INDEX "verified_facts_sourceEvidenceId_idx" ON "verified_facts"("sourceEvidenceId");

-- CreateIndex
CREATE INDEX "verified_facts_lockedAt_idx" ON "verified_facts"("lockedAt");

-- CreateIndex
CREATE INDEX "verified_facts_confidence_idx" ON "verified_facts"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "verified_facts_caseId_tenantId_contentHash_key" ON "verified_facts"("caseId", "tenantId", "contentHash");

-- CreateIndex
CREATE INDEX "narrative_claims_caseId_idx" ON "narrative_claims"("caseId");

-- CreateIndex
CREATE INDEX "narrative_claims_tenantId_idx" ON "narrative_claims"("tenantId");

-- CreateIndex
CREATE INDEX "narrative_claims_evidenceId_idx" ON "narrative_claims"("evidenceId");

-- CreateIndex
CREATE INDEX "narrative_claims_caseId_evidenceId_idx" ON "narrative_claims"("caseId", "evidenceId");

-- CreateIndex
CREATE INDEX "narrative_claims_confidence_idx" ON "narrative_claims"("confidence");

-- CreateIndex
CREATE INDEX "normalized_claim_events_claimId_idx" ON "normalized_claim_events"("claimId");

-- CreateIndex
CREATE INDEX "normalized_claim_events_caseId_idx" ON "normalized_claim_events"("caseId");

-- CreateIndex
CREATE INDEX "normalized_claim_events_tenantId_idx" ON "normalized_claim_events"("tenantId");

-- CreateIndex
CREATE INDEX "normalized_claim_events_eventType_idx" ON "normalized_claim_events"("eventType");

-- CreateIndex
CREATE INDEX "claim_validations_claimId_idx" ON "claim_validations"("claimId");

-- CreateIndex
CREATE INDEX "claim_validations_caseId_idx" ON "claim_validations"("caseId");

-- CreateIndex
CREATE INDEX "claim_validations_tenantId_idx" ON "claim_validations"("tenantId");

-- CreateIndex
CREATE INDEX "claim_validations_status_idx" ON "claim_validations"("status");

-- CreateIndex
CREATE INDEX "impeachment_candidates_claimId_idx" ON "impeachment_candidates"("claimId");

-- CreateIndex
CREATE INDEX "impeachment_candidates_caseId_idx" ON "impeachment_candidates"("caseId");

-- CreateIndex
CREATE INDEX "impeachment_candidates_tenantId_idx" ON "impeachment_candidates"("tenantId");

-- CreateIndex
CREATE INDEX "impeachment_candidates_severity_idx" ON "impeachment_candidates"("severity");

-- CreateIndex
CREATE INDEX "processing_jobs_userId_idx" ON "processing_jobs"("userId");

-- CreateIndex
CREATE INDEX "processing_jobs_tenantId_idx" ON "processing_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "processing_jobs_caseId_idx" ON "processing_jobs"("caseId");

-- CreateIndex
CREATE INDEX "processing_jobs_pipeline_idx" ON "processing_jobs"("pipeline");

-- CreateIndex
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs"("status");

-- CreateIndex
CREATE INDEX "processing_jobs_createdAt_idx" ON "processing_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "timeline_events_caseId_idx" ON "timeline_events"("caseId");

-- CreateIndex
CREATE INDEX "timeline_events_tenantId_idx" ON "timeline_events"("tenantId");

-- CreateIndex
CREATE INDEX "timeline_events_timestamp_idx" ON "timeline_events"("timestamp");

-- CreateIndex
CREATE INDEX "timeline_events_sourceType_idx" ON "timeline_events"("sourceType");

-- CreateIndex
CREATE INDEX "timeline_events_confidence_idx" ON "timeline_events"("confidence");

-- CreateIndex
CREATE INDEX "timeline_events_conflictFlag_idx" ON "timeline_events"("conflictFlag");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_codeValue_key" ON "discount_codes"("codeValue");

-- CreateIndex
CREATE INDEX "discount_codes_codeValue_idx" ON "discount_codes"("codeValue");

-- CreateIndex
CREATE INDEX "discount_codes_active_idx" ON "discount_codes"("active");

-- CreateIndex
CREATE INDEX "discount_usages_discountCodeId_idx" ON "discount_usages"("discountCodeId");

-- CreateIndex
CREATE INDEX "discount_usages_userId_idx" ON "discount_usages"("userId");

-- CreateIndex
CREATE INDEX "demo_requests_status_idx" ON "demo_requests"("status");

-- CreateIndex
CREATE INDEX "demo_requests_email_idx" ON "demo_requests"("email");

-- CreateIndex
CREATE INDEX "demo_requests_submittedAt_idx" ON "demo_requests"("submittedAt");

-- CreateIndex
CREATE INDEX "enterprise_licenses_status_idx" ON "enterprise_licenses"("status");

-- CreateIndex
CREATE INDEX "enterprise_licenses_adminEmail_idx" ON "enterprise_licenses"("adminEmail");

-- CreateIndex
CREATE INDEX "enterprise_licenses_organizationName_idx" ON "enterprise_licenses"("organizationName");

-- CreateIndex
CREATE INDEX "government_leads_status_idx" ON "government_leads"("status");

-- CreateIndex
CREATE INDEX "government_leads_email_idx" ON "government_leads"("email");

-- CreateIndex
CREATE INDEX "government_leads_agencyName_idx" ON "government_leads"("agencyName");

-- CreateIndex
CREATE INDEX "marketing_events_event_idx" ON "marketing_events"("event");

-- CreateIndex
CREATE INDEX "marketing_events_page_idx" ON "marketing_events"("page");

-- CreateIndex
CREATE INDEX "marketing_events_source_idx" ON "marketing_events"("source");

-- CreateIndex
CREATE INDEX "marketing_events_createdAt_idx" ON "marketing_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_webhook_events_eventId_key" ON "stripe_webhook_events"("eventId");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_eventId_idx" ON "stripe_webhook_events"("eventId");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_eventType_idx" ON "stripe_webhook_events"("eventType");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_processedAt_idx" ON "stripe_webhook_events"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "schema_versions_version_key" ON "schema_versions"("version");

-- CreateIndex
CREATE INDEX "schema_versions_appliedAt_idx" ON "schema_versions"("appliedAt");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_logs" ADD CONSTRAINT "security_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("agencyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "policy_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_coverage" ADD CONSTRAINT "policy_coverage_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("agencyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_coverage" ADD CONSTRAINT "policy_coverage_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "policy_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpra_agency_requests" ADD CONSTRAINT "cpra_agency_requests_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "cpra_request_campaigns"("campaignId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpra_agency_requests" ADD CONSTRAINT "cpra_agency_requests_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("agencyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpra_annual_updates" ADD CONSTRAINT "cpra_annual_updates_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("agencyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_policy_status" ADD CONSTRAINT "agency_policy_status_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("agencyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpra_email_attachments" ADD CONSTRAINT "cpra_email_attachments_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "cpra_email_log"("emailId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "criminal_cases"("caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_usages" ADD CONSTRAINT "discount_usages_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "discount_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

