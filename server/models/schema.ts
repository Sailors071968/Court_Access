// ============================================
// Court Access — Database Schema (Drizzle ORM + PostgreSQL)
// All tables enforce tenant isolation via tenant_id.
// ============================================

import { pgTable, uuid, text, timestamp, integer, jsonb, varchar, boolean } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationName: text('organization_name').notNull(),
  subscriptionTier: varchar('subscription_tier', { length: 50 }).notNull().default('basic'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: varchar('role', { length: 50 }).notNull().default('client'),
  phone: varchar('phone', { length: 20 }),
  smsEnabled: boolean('sms_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export const cases = pgTable('cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  caseNumber: varchar('case_number', { length: 100 }),
  caseName: text('case_name').notNull(),
  jurisdiction: text('jurisdiction'),
  court: text('court'),
  judge: text('judge'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  phase: varchar('phase', { length: 50 }).notNull().default('intake'),
  assignedAttorneyId: uuid('assigned_attorney_id'),
  assignedInvestigatorId: uuid('assigned_investigator_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().references(() => cases.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  fileName: text('file_name').notNull(),
  fileType: varchar('file_type', { length: 20 }).notNull(),
  fileSize: integer('file_size').notNull(),
  s3Key: text('s3_key').notNull(),
  documentHash: text('document_hash'),
  sha3Hash: text('sha3_hash'),
  extractedText: text('extracted_text'),
  extractionStatus: varchar('extraction_status', { length: 50 }).notNull().default('pending'),
  analysisStatus: varchar('analysis_status', { length: 50 }).notNull().default('pending'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  uploadTimestamp: timestamp('upload_timestamp', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Analysis Results
// ---------------------------------------------------------------------------

export const analysisResults = pgTable('analysis_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  caseId: uuid('case_id').notNull().references(() => cases.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  analysisSnapshotHash: text('analysis_snapshot_hash'),
  analysisDataJson: jsonb('analysis_data_json'),
  modelVersion: varchar('model_version', { length: 100 }),
  constitutionStatus: varchar('constitution_status', { length: 10 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  channel: varchar('channel', { length: 20 }).notNull().default('in_app'),
  message: text('message').notNull(),
  sentStatus: varchar('sent_status', { length: 50 }).notNull().default('pending'),
  twilioSid: text('twilio_sid'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  plan: varchar('plan', { length: 50 }).notNull().default('basic'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id'),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventDataJson: jsonb('event_data_json'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type AnalysisResult = typeof analysisResults.$inferSelect;
export type NewAnalysisResult = typeof analysisResults.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
