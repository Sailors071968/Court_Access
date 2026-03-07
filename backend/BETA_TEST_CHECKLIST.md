# Court Access — Beta Test Checklist

## Phase 45: Pre-Beta Verification

This checklist confirms all end-to-end flows work correctly before opening the platform to closed beta testers.

---

### 1. User Signup
- [ ] Navigate to `/signup`
- [ ] Enter email, password (8+ chars), name
- [ ] With valid invite code: account created successfully
- [ ] Without invite code: signup still works (open beta mode)
- [ ] Duplicate email rejected with 409
- [ ] Expired/revoked invite code rejected
- [ ] JWT token returned on success
- [ ] User record created in PostgreSQL

### 2. User Login
- [ ] Navigate to `/login`
- [ ] Valid credentials return JWT + user profile
- [ ] Invalid credentials return 401
- [ ] Suspended account returns 403
- [ ] `lastLoginAt` updated in database
- [ ] Audit log entry created for login

### 3. Subscription Activation
- [ ] Navigate to billing page
- [ ] Select Professional or Team plan
- [ ] Redirect to Stripe Checkout
- [ ] Complete payment in Stripe
- [ ] Webhook `checkout.session.completed` fires
- [ ] User record updated: `plan`, `subscriptionStatus = 'active'`
- [ ] SubscriptionEvent persisted in database
- [ ] SMS notification sent to admin

### 4. Case Creation
- [ ] Authenticated user creates case via `POST /api/cases`
- [ ] Case requires `caseName`
- [ ] Case scoped to authenticated user (tenant isolation)
- [ ] Case appears in `GET /api/cases` list
- [ ] Other users cannot see the case (404)

### 5. Evidence Upload
- [ ] Upload file via `POST /api/evidence/upload`
- [ ] File validation: reject unsupported MIME types
- [ ] File size limits enforced per type (50MB docs, 25MB images, 500MB audio, 1GB video)
- [ ] Virus scan executes (ClamAV or fallback)
- [ ] File stored in Cloudflare R2
- [ ] EvidenceRecord created with `status: 'processing'`
- [ ] BullMQ job queued for processing
- [ ] Rate limit: max 20 uploads/tenant/minute
- [ ] Presigned upload URL generation works for large files

### 6. Evidence Analysis (AI Processing)
- [ ] Document analysis: OpenAI GPT-4 extracts summary, key findings
- [ ] Image analysis: OCR via Tesseract + GPT-4 description
- [ ] Audio analysis: Whisper transcription + GPT-4 summary
- [ ] Video analysis: frame extraction + audio transcription + GPT-4 analysis
- [ ] Processing results stored in `processingResult` JSON field
- [ ] Evidence status updated to `complete` on success
- [ ] Evidence status updated to `error` on failure
- [ ] System error logged on AI processing failure

### 7. Timeline Generation
- [ ] `POST /api/timeline/:caseId/generate` creates timeline from evidence
- [ ] Timeline events sorted chronologically
- [ ] Each event linked to source evidence
- [ ] Timeline viewable via `GET /api/timeline/:caseId`
- [ ] Tenant isolation: only case owner can access

### 8. Entity Linking
- [ ] `POST /api/entities/:caseId/extract` identifies entities across evidence
- [ ] Entity types: person, location, organization, date, legal_reference
- [ ] Cross-evidence entity linking via EvidenceEntityLink
- [ ] Entity list viewable via `GET /api/entities/:caseId`
- [ ] Tenant isolation enforced

### 9. Narrative Generation
- [ ] `POST /api/narrative/:caseId/generate` creates AI case narrative
- [ ] Narrative uses real OpenAI GPT-4 (not mocked)
- [ ] Narrative includes sections, key findings, evidence references
- [ ] Viewable via `GET /api/narrative/:caseId`
- [ ] Tenant isolation enforced

### 10. Evidence Search
- [ ] Search across evidence within a case
- [ ] Filter by evidence type, status
- [ ] Results return relevant evidence records
- [ ] Tenant isolation: cross-account search impossible

### 11. Evidence Viewing
- [ ] `GET /api/evidence/:evidenceId` returns evidence metadata
- [ ] `GET /api/evidence/:evidenceId/download` returns signed R2 URL
- [ ] Signed URLs expire after 1 hour
- [ ] Tenant isolation: other users get 404
- [ ] Evidence integrity certificate viewable

### 12. Archive and Restore
- [ ] `POST /api/archives/:caseId/archive` creates cold archive
- [ ] Archive manifest includes SHA-256 + SHA3-256 dual hashes
- [ ] Archive status trackable via `GET /api/archives/:caseId/status`
- [ ] `POST /api/archives/:caseId/restore` restores archived case
- [ ] Restore verification: hash comparison confirms data integrity
- [ ] Audit log records all archive/restore operations

### 13. Security Verification
- [ ] JWT authentication required for all protected routes
- [ ] Tenant isolation: users cannot access other users' cases/evidence
- [ ] Signed URLs prevent unauthorized file access
- [ ] Role-based permissions enforced (admin, attorney, investigator, client)
- [ ] CORS configured for allowed origins only
- [ ] Helmet security headers active
- [ ] Rate limiting active on API routes

### 14. Admin Controls
- [ ] Admin can view system monitoring dashboard
- [ ] Admin can send beta invites
- [ ] Admin can enable/disable users
- [ ] Admin can change user roles
- [ ] Admin can view audit log
- [ ] Admin can view/resolve system errors
- [ ] Admin can check deployment readiness

### 15. Billing Lifecycle
- [ ] Billing page shows current plan
- [ ] Invoice history loads from Stripe
- [ ] Subscription cancellation works (cancel at period end)
- [ ] Customer portal accessible
- [ ] Payment failure updates user status to `past_due`
- [ ] Subscription deletion downgrades user to free

### 16. Monitoring
- [ ] API errors logged to SystemErrorLog table
- [ ] Processing failures logged with deduplication
- [ ] Upload failures logged
- [ ] AI processing failures logged
- [ ] Payment errors logged
- [ ] Admin monitoring endpoint returns real data
- [ ] Queue stats (waiting, active, completed, failed) available

### 17. Deployment Readiness
- [ ] All required env vars validated at startup
- [ ] Database connectivity confirmed
- [ ] Redis connectivity confirmed (if configured)
- [ ] Startup checks print clear status report
- [ ] Health endpoint (`/api/health`) returns system status
- [ ] Deployment readiness endpoint available for admin

---

## Environment Variables Required

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT token signing secret |
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4 |
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `R2_ACCOUNT_ID` | Yes | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 secret key |
| `R2_BUCKET_NAME` | Yes | R2 bucket name |
| `REDIS_URL` | Optional | Redis for BullMQ job queue |
| `SENTRY_DSN` | Optional | Sentry error tracking |
| `TWILIO_ACCOUNT_SID` | Optional | Twilio SMS notifications |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Optional | Twilio sender number |
| `FRONTEND_URL` | Optional | Frontend URL for redirects |

---

## Sign-Off

- [ ] All 17 sections verified
- [ ] No critical errors in monitoring dashboard
- [ ] Platform ready for closed beta testing

**Date:** _______________
**Verified by:** _______________
