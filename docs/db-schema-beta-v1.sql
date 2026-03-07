--
-- PostgreSQL database dump
--

-- Dumped from database version 14.22 (Ubuntu 14.22-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.22 (Ubuntu 14.22-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ArchiveAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ArchiveAuditLog" (
    id text NOT NULL,
    "caseId" text NOT NULL,
    action text NOT NULL,
    actor text DEFAULT 'system'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ArchiveRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ArchiveRecord" (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "archiveHash" text NOT NULL,
    "archiveLocation" text NOT NULL,
    "archiveTimestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "archiveManifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'archived'::text NOT NULL,
    "fileCount" integer DEFAULT 0 NOT NULL,
    "totalSizeBytes" bigint DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BetaAccessConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BetaAccessConfig" (
    id text NOT NULL,
    "maxBetaAccounts" integer DEFAULT 50 NOT NULL,
    "inviteExpireDays" integer DEFAULT 7 NOT NULL,
    "registrationOpen" boolean DEFAULT false NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BetaInvite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BetaInvite" (
    id text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'attorney'::text NOT NULL,
    "inviteCode" text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Case; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Case" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "caseNumber" text DEFAULT ''::text NOT NULL,
    "caseName" text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CaseNarrative; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CaseNarrative" (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "generatedTimestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "summaryText" text NOT NULL,
    "keyEvents" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "conflictsDetected" jsonb DEFAULT '[]'::jsonb NOT NULL,
    participants jsonb DEFAULT '[]'::jsonb NOT NULL,
    "modelVersion" text DEFAULT 'gpt-4'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DocumentCrossReference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentCrossReference" (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "tenantId" text NOT NULL,
    "sourceDocumentId" text NOT NULL,
    "relatedDocumentId" text NOT NULL,
    "referenceType" text NOT NULL,
    "sourceReferenceId" text,
    "relatedReferenceId" text,
    description text NOT NULL,
    "sourceSnippet" text DEFAULT ''::text NOT NULL,
    "relatedSnippet" text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EmailJob; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailJob" (
    id text NOT NULL,
    "emailType" text NOT NULL,
    recipient text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "attemptCount" integer DEFAULT 0 NOT NULL,
    "lastError" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: EmailLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailLog" (
    id text NOT NULL,
    recipient text NOT NULL,
    "emailType" text NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    "deliveryStatus" text DEFAULT 'pending'::text NOT NULL,
    "errorMessage" text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Entity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Entity" (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "entityType" text NOT NULL,
    "entityValue" text NOT NULL,
    "firstDetectedEvidenceId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EvidenceCorrelation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EvidenceCorrelation" (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "sourceEvidenceId" text NOT NULL,
    "relatedEvidenceId" text NOT NULL,
    "correlationType" text NOT NULL,
    "confidenceScore" double precision DEFAULT 0.0 NOT NULL,
    description text NOT NULL,
    "sourceSnippet" text DEFAULT ''::text NOT NULL,
    "relatedSnippet" text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EvidenceEntityLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EvidenceEntityLink" (
    id text NOT NULL,
    "entityId" text NOT NULL,
    "evidenceId" text NOT NULL,
    "detectionConfidence" double precision DEFAULT 1.0 NOT NULL,
    "contextSnippet" text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EvidenceIntegrityReport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EvidenceIntegrityReport" (
    id text NOT NULL,
    "evidenceId" text NOT NULL,
    "caseId" text NOT NULL,
    "fileName" text DEFAULT ''::text NOT NULL,
    "sha256Hash" text NOT NULL,
    "sha3Hash" text NOT NULL,
    "uploadTimestamp" timestamp(3) without time zone NOT NULL,
    "verificationStatus" text DEFAULT 'verified'::text NOT NULL,
    "chainOfCustody" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EvidenceRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EvidenceRecord" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "caseId" text NOT NULL,
    filename text NOT NULL,
    "contentType" text NOT NULL,
    "evidenceType" text NOT NULL,
    "fileSize" bigint DEFAULT 0 NOT NULL,
    sha256 text DEFAULT ''::text NOT NULL,
    "storageKey" text,
    description text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "processingResult" jsonb,
    "scanResult" jsonb,
    "jobId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: EvidenceReference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EvidenceReference" (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "tenantId" text NOT NULL,
    "sourceDocumentId" text NOT NULL,
    "referenceType" text NOT NULL,
    "referenceValue" text NOT NULL,
    "sourceContext" text DEFAULT ''::text NOT NULL,
    "extractionMethod" text DEFAULT 'deterministic'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Hearing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Hearing" (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "courthouseName" text NOT NULL,
    "courthouseAddress" text NOT NULL,
    "hearingName" text NOT NULL,
    "hearingDatetime" timestamp(3) without time zone NOT NULL,
    department text DEFAULT ''::text NOT NULL,
    "reminder1Enabled" boolean DEFAULT true NOT NULL,
    "reminder2Enabled" boolean DEFAULT true NOT NULL,
    "reminder3Enabled" boolean DEFAULT true NOT NULL,
    "reminder1DaysBefore" integer DEFAULT 7 NOT NULL,
    "reminder2DaysBefore" integer DEFAULT 3 NOT NULL,
    "reminder3DaysBefore" integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "caseName" text,
    "clientPhone" text
);


--
-- Name: HearingReminderLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."HearingReminderLog" (
    id text NOT NULL,
    "hearingId" text NOT NULL,
    "reminderType" integer NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LawEnforcementAgency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LawEnforcementAgency" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "agencyName" text NOT NULL,
    "agencyType" text NOT NULL,
    state text NOT NULL,
    county text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    "phoneMain" text DEFAULT ''::text NOT NULL,
    "phoneRecordsDivision" text DEFAULT ''::text NOT NULL,
    "emailRecordsDivision" text DEFAULT ''::text NOT NULL,
    website text DEFAULT ''::text NOT NULL,
    "recordsRequestUrl" text DEFAULT ''::text NOT NULL,
    "dataSource" text DEFAULT ''::text NOT NULL,
    "verificationStatus" text DEFAULT 'pending'::text NOT NULL,
    "lastVerifiedAt" timestamp(3) without time zone,
    "discoveredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MediaTranscript; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MediaTranscript" (
    id text NOT NULL,
    "evidenceId" text NOT NULL,
    "caseId" text NOT NULL,
    "speakerLabel" text DEFAULT ''::text NOT NULL,
    "startTime" double precision DEFAULT 0 NOT NULL,
    "endTime" double precision DEFAULT 0 NOT NULL,
    "transcriptText" text NOT NULL,
    "confidenceScore" double precision DEFAULT 0.0 NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    "modelVersion" text DEFAULT 'whisper-1'::text NOT NULL,
    "fullTranscript" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PolicyComplianceFinding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PolicyComplianceFinding" (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "evidenceId" text NOT NULL,
    "policyDocumentId" text NOT NULL,
    "policySection" text DEFAULT ''::text NOT NULL,
    description text NOT NULL,
    "confidenceScore" double precision DEFAULT 0.0 NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PolicyDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PolicyDocument" (
    id text NOT NULL,
    "caseId" text NOT NULL,
    title text NOT NULL,
    "documentType" text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    "uploadedBy" text,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PublicRecordsRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PublicRecordsRequest" (
    id text NOT NULL,
    "agencyId" text NOT NULL,
    "tenantId" text NOT NULL,
    "caseId" text,
    "requestType" text NOT NULL,
    "submissionDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deliveryMethod" text DEFAULT 'email'::text NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    "responseReceivedDate" timestamp(3) without time zone,
    "responseHash" text,
    "responseHashSha3" text,
    "requestDocumentHash" text,
    "requestDocumentHashSha3" text,
    "requestContent" text DEFAULT ''::text NOT NULL,
    "templateId" text,
    "staffApproved" boolean DEFAULT false NOT NULL,
    "staffApprovedBy" text,
    "staffApprovedAt" timestamp(3) without time zone,
    notes text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RecordsRequestTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RecordsRequestTemplate" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "templateName" text NOT NULL,
    "displayName" text NOT NULL,
    content text NOT NULL,
    "mergeFields" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RefreshToken" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tokenHash" text NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ReminderFailure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReminderFailure" (
    id text NOT NULL,
    "hearingId" text NOT NULL,
    "reminderType" integer NOT NULL,
    phone text NOT NULL,
    "errorMessage" text NOT NULL,
    attempt integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SmsRateLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SmsRateLog" (
    id text NOT NULL,
    phone text NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SubscriptionEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SubscriptionEvent" (
    id text NOT NULL,
    "stripeCustomerId" text NOT NULL,
    "stripeEventId" text NOT NULL,
    "eventType" text NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    amount integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SystemErrorLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SystemErrorLog" (
    id text NOT NULL,
    service text NOT NULL,
    level text DEFAULT 'error'::text NOT NULL,
    message text NOT NULL,
    "stackTrace" text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    count integer DEFAULT 1 NOT NULL,
    "firstSeen" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastSeen" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TimelineEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TimelineEvent" (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "timestamp" timestamp(3) without time zone NOT NULL,
    "sourceEvidenceId" text,
    "sourceType" text NOT NULL,
    "eventType" text DEFAULT 'other'::text NOT NULL,
    "eventDescription" text NOT NULL,
    "confidenceScore" double precision DEFAULT 1.0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    role text DEFAULT 'attorney'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    "stripeCustomerId" text,
    "subscriptionId" text,
    "subscriptionStatus" text DEFAULT 'none'::text NOT NULL,
    "betaInviteId" text,
    "onboardingComplete" boolean DEFAULT false NOT NULL,
    "storageUsedBytes" bigint DEFAULT 0 NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: UserAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserAuditLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    resource text DEFAULT ''::text NOT NULL,
    "ipAddress" text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: VerifiedEmail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerifiedEmail" (
    id text NOT NULL,
    "emailAddress" text NOT NULL,
    "verificationStatus" text DEFAULT 'pending'::text NOT NULL,
    "verificationToken" text NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WorkerHeartbeat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkerHeartbeat" (
    id text NOT NULL,
    "workerName" text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    "lastBeatAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "restartCount" integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: ArchiveAuditLog ArchiveAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ArchiveAuditLog"
    ADD CONSTRAINT "ArchiveAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: ArchiveRecord ArchiveRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ArchiveRecord"
    ADD CONSTRAINT "ArchiveRecord_pkey" PRIMARY KEY (id);


--
-- Name: BetaAccessConfig BetaAccessConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BetaAccessConfig"
    ADD CONSTRAINT "BetaAccessConfig_pkey" PRIMARY KEY (id);


--
-- Name: BetaInvite BetaInvite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BetaInvite"
    ADD CONSTRAINT "BetaInvite_pkey" PRIMARY KEY (id);


--
-- Name: CaseNarrative CaseNarrative_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CaseNarrative"
    ADD CONSTRAINT "CaseNarrative_pkey" PRIMARY KEY (id);


--
-- Name: Case Case_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Case"
    ADD CONSTRAINT "Case_pkey" PRIMARY KEY (id);


--
-- Name: DocumentCrossReference DocumentCrossReference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentCrossReference"
    ADD CONSTRAINT "DocumentCrossReference_pkey" PRIMARY KEY (id);


--
-- Name: EmailJob EmailJob_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailJob"
    ADD CONSTRAINT "EmailJob_pkey" PRIMARY KEY (id);


--
-- Name: EmailLog EmailLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailLog"
    ADD CONSTRAINT "EmailLog_pkey" PRIMARY KEY (id);


--
-- Name: Entity Entity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Entity"
    ADD CONSTRAINT "Entity_pkey" PRIMARY KEY (id);


--
-- Name: EvidenceCorrelation EvidenceCorrelation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EvidenceCorrelation"
    ADD CONSTRAINT "EvidenceCorrelation_pkey" PRIMARY KEY (id);


--
-- Name: EvidenceEntityLink EvidenceEntityLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EvidenceEntityLink"
    ADD CONSTRAINT "EvidenceEntityLink_pkey" PRIMARY KEY (id);


--
-- Name: EvidenceIntegrityReport EvidenceIntegrityReport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EvidenceIntegrityReport"
    ADD CONSTRAINT "EvidenceIntegrityReport_pkey" PRIMARY KEY (id);


--
-- Name: EvidenceRecord EvidenceRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EvidenceRecord"
    ADD CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY (id);


--
-- Name: EvidenceReference EvidenceReference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EvidenceReference"
    ADD CONSTRAINT "EvidenceReference_pkey" PRIMARY KEY (id);


--
-- Name: HearingReminderLog HearingReminderLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HearingReminderLog"
    ADD CONSTRAINT "HearingReminderLog_pkey" PRIMARY KEY (id);


--
-- Name: Hearing Hearing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Hearing"
    ADD CONSTRAINT "Hearing_pkey" PRIMARY KEY (id);


--
-- Name: LawEnforcementAgency LawEnforcementAgency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LawEnforcementAgency"
    ADD CONSTRAINT "LawEnforcementAgency_pkey" PRIMARY KEY (id);


--
-- Name: MediaTranscript MediaTranscript_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MediaTranscript"
    ADD CONSTRAINT "MediaTranscript_pkey" PRIMARY KEY (id);


--
-- Name: PolicyComplianceFinding PolicyComplianceFinding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PolicyComplianceFinding"
    ADD CONSTRAINT "PolicyComplianceFinding_pkey" PRIMARY KEY (id);


--
-- Name: PolicyDocument PolicyDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PolicyDocument"
    ADD CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY (id);


--
-- Name: PublicRecordsRequest PublicRecordsRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicRecordsRequest"
    ADD CONSTRAINT "PublicRecordsRequest_pkey" PRIMARY KEY (id);


--
-- Name: RecordsRequestTemplate RecordsRequestTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecordsRequestTemplate"
    ADD CONSTRAINT "RecordsRequestTemplate_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: ReminderFailure ReminderFailure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReminderFailure"
    ADD CONSTRAINT "ReminderFailure_pkey" PRIMARY KEY (id);


--
-- Name: SmsRateLog SmsRateLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmsRateLog"
    ADD CONSTRAINT "SmsRateLog_pkey" PRIMARY KEY (id);


--
-- Name: SubscriptionEvent SubscriptionEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubscriptionEvent"
    ADD CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY (id);


--
-- Name: SystemErrorLog SystemErrorLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemErrorLog"
    ADD CONSTRAINT "SystemErrorLog_pkey" PRIMARY KEY (id);


--
-- Name: TimelineEvent TimelineEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TimelineEvent"
    ADD CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY (id);


--
-- Name: UserAuditLog UserAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAuditLog"
    ADD CONSTRAINT "UserAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: VerifiedEmail VerifiedEmail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerifiedEmail"
    ADD CONSTRAINT "VerifiedEmail_pkey" PRIMARY KEY (id);


--
-- Name: WorkerHeartbeat WorkerHeartbeat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkerHeartbeat"
    ADD CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: ArchiveAuditLog_caseId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchiveAuditLog_caseId_createdAt_idx" ON public."ArchiveAuditLog" USING btree ("caseId", "createdAt");


--
-- Name: ArchiveAuditLog_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchiveAuditLog_caseId_idx" ON public."ArchiveAuditLog" USING btree ("caseId");


--
-- Name: ArchiveRecord_caseId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ArchiveRecord_caseId_key" ON public."ArchiveRecord" USING btree ("caseId");


--
-- Name: ArchiveRecord_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchiveRecord_status_idx" ON public."ArchiveRecord" USING btree (status);


--
-- Name: BetaInvite_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BetaInvite_email_idx" ON public."BetaInvite" USING btree (email);


--
-- Name: BetaInvite_inviteCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BetaInvite_inviteCode_idx" ON public."BetaInvite" USING btree ("inviteCode");


--
-- Name: BetaInvite_inviteCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BetaInvite_inviteCode_key" ON public."BetaInvite" USING btree ("inviteCode");


--
-- Name: BetaInvite_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BetaInvite_status_idx" ON public."BetaInvite" USING btree (status);


--
-- Name: CaseNarrative_caseId_generatedTimestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CaseNarrative_caseId_generatedTimestamp_idx" ON public."CaseNarrative" USING btree ("caseId", "generatedTimestamp");


--
-- Name: CaseNarrative_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CaseNarrative_caseId_idx" ON public."CaseNarrative" USING btree ("caseId");


--
-- Name: Case_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Case_status_idx" ON public."Case" USING btree (status);


--
-- Name: Case_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Case_userId_idx" ON public."Case" USING btree ("userId");


--
-- Name: DocumentCrossReference_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentCrossReference_caseId_idx" ON public."DocumentCrossReference" USING btree ("caseId");


--
-- Name: DocumentCrossReference_caseId_referenceType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentCrossReference_caseId_referenceType_idx" ON public."DocumentCrossReference" USING btree ("caseId", "referenceType");


--
-- Name: DocumentCrossReference_referenceType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentCrossReference_referenceType_idx" ON public."DocumentCrossReference" USING btree ("referenceType");


--
-- Name: DocumentCrossReference_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentCrossReference_tenantId_idx" ON public."DocumentCrossReference" USING btree ("tenantId");


--
-- Name: EmailJob_emailType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailJob_emailType_idx" ON public."EmailJob" USING btree ("emailType");


--
-- Name: EmailJob_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailJob_recipient_idx" ON public."EmailJob" USING btree (recipient);


--
-- Name: EmailJob_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailJob_status_idx" ON public."EmailJob" USING btree (status);


--
-- Name: EmailLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailLog_createdAt_idx" ON public."EmailLog" USING btree ("createdAt");


--
-- Name: EmailLog_deliveryStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailLog_deliveryStatus_idx" ON public."EmailLog" USING btree ("deliveryStatus");


--
-- Name: EmailLog_emailType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailLog_emailType_idx" ON public."EmailLog" USING btree ("emailType");


--
-- Name: EmailLog_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailLog_recipient_idx" ON public."EmailLog" USING btree (recipient);


--
-- Name: Entity_caseId_entityType_entityValue_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Entity_caseId_entityType_entityValue_key" ON public."Entity" USING btree ("caseId", "entityType", "entityValue");


--
-- Name: Entity_caseId_entityType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Entity_caseId_entityType_idx" ON public."Entity" USING btree ("caseId", "entityType");


--
-- Name: Entity_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Entity_caseId_idx" ON public."Entity" USING btree ("caseId");


--
-- Name: EvidenceCorrelation_caseId_correlationType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceCorrelation_caseId_correlationType_idx" ON public."EvidenceCorrelation" USING btree ("caseId", "correlationType");


--
-- Name: EvidenceCorrelation_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceCorrelation_caseId_idx" ON public."EvidenceCorrelation" USING btree ("caseId");


--
-- Name: EvidenceCorrelation_relatedEvidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceCorrelation_relatedEvidenceId_idx" ON public."EvidenceCorrelation" USING btree ("relatedEvidenceId");


--
-- Name: EvidenceCorrelation_sourceEvidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceCorrelation_sourceEvidenceId_idx" ON public."EvidenceCorrelation" USING btree ("sourceEvidenceId");


--
-- Name: EvidenceEntityLink_entityId_evidenceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EvidenceEntityLink_entityId_evidenceId_key" ON public."EvidenceEntityLink" USING btree ("entityId", "evidenceId");


--
-- Name: EvidenceEntityLink_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceEntityLink_entityId_idx" ON public."EvidenceEntityLink" USING btree ("entityId");


--
-- Name: EvidenceEntityLink_evidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceEntityLink_evidenceId_idx" ON public."EvidenceEntityLink" USING btree ("evidenceId");


--
-- Name: EvidenceIntegrityReport_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceIntegrityReport_caseId_idx" ON public."EvidenceIntegrityReport" USING btree ("caseId");


--
-- Name: EvidenceIntegrityReport_evidenceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EvidenceIntegrityReport_evidenceId_key" ON public."EvidenceIntegrityReport" USING btree ("evidenceId");


--
-- Name: EvidenceRecord_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceRecord_caseId_idx" ON public."EvidenceRecord" USING btree ("caseId");


--
-- Name: EvidenceRecord_caseId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceRecord_caseId_status_idx" ON public."EvidenceRecord" USING btree ("caseId", status);


--
-- Name: EvidenceRecord_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceRecord_status_idx" ON public."EvidenceRecord" USING btree (status);


--
-- Name: EvidenceRecord_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceRecord_userId_idx" ON public."EvidenceRecord" USING btree ("userId");


--
-- Name: EvidenceReference_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceReference_caseId_idx" ON public."EvidenceReference" USING btree ("caseId");


--
-- Name: EvidenceReference_caseId_referenceType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceReference_caseId_referenceType_idx" ON public."EvidenceReference" USING btree ("caseId", "referenceType");


--
-- Name: EvidenceReference_caseId_tenantId_sourceDocumentId_referenc_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EvidenceReference_caseId_tenantId_sourceDocumentId_referenc_key" ON public."EvidenceReference" USING btree ("caseId", "tenantId", "sourceDocumentId", "referenceType", "referenceValue");


--
-- Name: EvidenceReference_referenceType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceReference_referenceType_idx" ON public."EvidenceReference" USING btree ("referenceType");


--
-- Name: EvidenceReference_referenceValue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceReference_referenceValue_idx" ON public."EvidenceReference" USING btree ("referenceValue");


--
-- Name: EvidenceReference_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvidenceReference_tenantId_idx" ON public."EvidenceReference" USING btree ("tenantId");


--
-- Name: HearingReminderLog_hearingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HearingReminderLog_hearingId_idx" ON public."HearingReminderLog" USING btree ("hearingId");


--
-- Name: HearingReminderLog_hearingId_reminderType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "HearingReminderLog_hearingId_reminderType_key" ON public."HearingReminderLog" USING btree ("hearingId", "reminderType");


--
-- Name: Hearing_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Hearing_caseId_idx" ON public."Hearing" USING btree ("caseId");


--
-- Name: LawEnforcementAgency_agencyType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LawEnforcementAgency_agencyType_idx" ON public."LawEnforcementAgency" USING btree ("agencyType");


--
-- Name: LawEnforcementAgency_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LawEnforcementAgency_state_idx" ON public."LawEnforcementAgency" USING btree (state);


--
-- Name: LawEnforcementAgency_tenantId_agencyName_state_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LawEnforcementAgency_tenantId_agencyName_state_key" ON public."LawEnforcementAgency" USING btree ("tenantId", "agencyName", state);


--
-- Name: LawEnforcementAgency_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LawEnforcementAgency_tenantId_idx" ON public."LawEnforcementAgency" USING btree ("tenantId");


--
-- Name: LawEnforcementAgency_tenantId_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LawEnforcementAgency_tenantId_state_idx" ON public."LawEnforcementAgency" USING btree ("tenantId", state);


--
-- Name: LawEnforcementAgency_verificationStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LawEnforcementAgency_verificationStatus_idx" ON public."LawEnforcementAgency" USING btree ("verificationStatus");


--
-- Name: MediaTranscript_caseId_evidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MediaTranscript_caseId_evidenceId_idx" ON public."MediaTranscript" USING btree ("caseId", "evidenceId");


--
-- Name: MediaTranscript_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MediaTranscript_caseId_idx" ON public."MediaTranscript" USING btree ("caseId");


--
-- Name: MediaTranscript_evidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MediaTranscript_evidenceId_idx" ON public."MediaTranscript" USING btree ("evidenceId");


--
-- Name: MediaTranscript_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MediaTranscript_status_idx" ON public."MediaTranscript" USING btree (status);


--
-- Name: PolicyComplianceFinding_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PolicyComplianceFinding_caseId_idx" ON public."PolicyComplianceFinding" USING btree ("caseId");


--
-- Name: PolicyComplianceFinding_caseId_severity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PolicyComplianceFinding_caseId_severity_idx" ON public."PolicyComplianceFinding" USING btree ("caseId", severity);


--
-- Name: PolicyComplianceFinding_evidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PolicyComplianceFinding_evidenceId_idx" ON public."PolicyComplianceFinding" USING btree ("evidenceId");


--
-- Name: PolicyComplianceFinding_policyDocumentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PolicyComplianceFinding_policyDocumentId_idx" ON public."PolicyComplianceFinding" USING btree ("policyDocumentId");


--
-- Name: PolicyDocument_caseId_documentType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PolicyDocument_caseId_documentType_idx" ON public."PolicyDocument" USING btree ("caseId", "documentType");


--
-- Name: PolicyDocument_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PolicyDocument_caseId_idx" ON public."PolicyDocument" USING btree ("caseId");


--
-- Name: PublicRecordsRequest_agencyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PublicRecordsRequest_agencyId_idx" ON public."PublicRecordsRequest" USING btree ("agencyId");


--
-- Name: PublicRecordsRequest_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PublicRecordsRequest_caseId_idx" ON public."PublicRecordsRequest" USING btree ("caseId");


--
-- Name: PublicRecordsRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PublicRecordsRequest_status_idx" ON public."PublicRecordsRequest" USING btree (status);


--
-- Name: PublicRecordsRequest_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PublicRecordsRequest_tenantId_idx" ON public."PublicRecordsRequest" USING btree ("tenantId");


--
-- Name: PublicRecordsRequest_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PublicRecordsRequest_tenantId_status_idx" ON public."PublicRecordsRequest" USING btree ("tenantId", status);


--
-- Name: RecordsRequestTemplate_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RecordsRequestTemplate_tenantId_idx" ON public."RecordsRequestTemplate" USING btree ("tenantId");


--
-- Name: RecordsRequestTemplate_tenantId_templateName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RecordsRequestTemplate_tenantId_templateName_key" ON public."RecordsRequestTemplate" USING btree ("tenantId", "templateName");


--
-- Name: RefreshToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RefreshToken_expiresAt_idx" ON public."RefreshToken" USING btree ("expiresAt");


--
-- Name: RefreshToken_tokenHash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RefreshToken_tokenHash_idx" ON public."RefreshToken" USING btree ("tokenHash");


--
-- Name: RefreshToken_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON public."RefreshToken" USING btree ("tokenHash");


--
-- Name: RefreshToken_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RefreshToken_userId_idx" ON public."RefreshToken" USING btree ("userId");


--
-- Name: ReminderFailure_hearingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReminderFailure_hearingId_idx" ON public."ReminderFailure" USING btree ("hearingId");


--
-- Name: ReminderFailure_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReminderFailure_phone_idx" ON public."ReminderFailure" USING btree (phone);


--
-- Name: SmsRateLog_phone_sentAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmsRateLog_phone_sentAt_idx" ON public."SmsRateLog" USING btree (phone, "sentAt");


--
-- Name: SubscriptionEvent_eventType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SubscriptionEvent_eventType_idx" ON public."SubscriptionEvent" USING btree ("eventType");


--
-- Name: SubscriptionEvent_stripeCustomerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SubscriptionEvent_stripeCustomerId_idx" ON public."SubscriptionEvent" USING btree ("stripeCustomerId");


--
-- Name: SubscriptionEvent_stripeEventId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SubscriptionEvent_stripeEventId_key" ON public."SubscriptionEvent" USING btree ("stripeEventId");


--
-- Name: SystemErrorLog_lastSeen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemErrorLog_lastSeen_idx" ON public."SystemErrorLog" USING btree ("lastSeen");


--
-- Name: SystemErrorLog_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemErrorLog_level_idx" ON public."SystemErrorLog" USING btree (level);


--
-- Name: SystemErrorLog_resolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemErrorLog_resolved_idx" ON public."SystemErrorLog" USING btree (resolved);


--
-- Name: SystemErrorLog_service_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemErrorLog_service_idx" ON public."SystemErrorLog" USING btree (service);


--
-- Name: TimelineEvent_caseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TimelineEvent_caseId_idx" ON public."TimelineEvent" USING btree ("caseId");


--
-- Name: TimelineEvent_caseId_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TimelineEvent_caseId_timestamp_idx" ON public."TimelineEvent" USING btree ("caseId", "timestamp");


--
-- Name: UserAuditLog_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserAuditLog_action_idx" ON public."UserAuditLog" USING btree (action);


--
-- Name: UserAuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserAuditLog_createdAt_idx" ON public."UserAuditLog" USING btree ("createdAt");


--
-- Name: UserAuditLog_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserAuditLog_userId_idx" ON public."UserAuditLog" USING btree ("userId");


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_status_idx" ON public."User" USING btree (status);


--
-- Name: User_stripeCustomerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_stripeCustomerId_idx" ON public."User" USING btree ("stripeCustomerId");


--
-- Name: User_stripeCustomerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON public."User" USING btree ("stripeCustomerId");


--
-- Name: VerifiedEmail_emailAddress_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerifiedEmail_emailAddress_idx" ON public."VerifiedEmail" USING btree ("emailAddress");


--
-- Name: VerifiedEmail_emailAddress_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerifiedEmail_emailAddress_key" ON public."VerifiedEmail" USING btree ("emailAddress");


--
-- Name: VerifiedEmail_verificationStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerifiedEmail_verificationStatus_idx" ON public."VerifiedEmail" USING btree ("verificationStatus");


--
-- Name: VerifiedEmail_verificationToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerifiedEmail_verificationToken_key" ON public."VerifiedEmail" USING btree ("verificationToken");


--
-- Name: WorkerHeartbeat_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkerHeartbeat_status_idx" ON public."WorkerHeartbeat" USING btree (status);


--
-- Name: WorkerHeartbeat_workerName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkerHeartbeat_workerName_idx" ON public."WorkerHeartbeat" USING btree ("workerName");


--
-- Name: WorkerHeartbeat_workerName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WorkerHeartbeat_workerName_key" ON public."WorkerHeartbeat" USING btree ("workerName");


--
-- Name: Case Case_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Case"
    ADD CONSTRAINT "Case_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EvidenceEntityLink EvidenceEntityLink_entityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EvidenceEntityLink"
    ADD CONSTRAINT "EvidenceEntityLink_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES public."Entity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EvidenceRecord EvidenceRecord_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EvidenceRecord"
    ADD CONSTRAINT "EvidenceRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public."Case"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EvidenceRecord EvidenceRecord_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EvidenceRecord"
    ADD CONSTRAINT "EvidenceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HearingReminderLog HearingReminderLog_hearingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HearingReminderLog"
    ADD CONSTRAINT "HearingReminderLog_hearingId_fkey" FOREIGN KEY ("hearingId") REFERENCES public."Hearing"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PolicyComplianceFinding PolicyComplianceFinding_policyDocumentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PolicyComplianceFinding"
    ADD CONSTRAINT "PolicyComplianceFinding_policyDocumentId_fkey" FOREIGN KEY ("policyDocumentId") REFERENCES public."PolicyDocument"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PublicRecordsRequest PublicRecordsRequest_agencyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicRecordsRequest"
    ADD CONSTRAINT "PublicRecordsRequest_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES public."LawEnforcementAgency"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserAuditLog UserAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAuditLog"
    ADD CONSTRAINT "UserAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

