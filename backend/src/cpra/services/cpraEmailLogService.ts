// ============================================================================
// Autonomous CPRA System — Email Log Service
// Logs all outbound and inbound CPRA emails with full audit trail.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailDirection = 'OUTBOUND' | 'INBOUND';

export interface LogEmailParams {
  agencyId?: string;
  direction: EmailDirection;
  emailAddress: string;
  fromAddress?: string;
  subject: string;
  body: string;
  requestId?: string;
  policyTopics?: string[];
  sesMessageId?: string;
}

export interface EmailLogEntry {
  emailId: string;
  agencyId: string | null;
  direction: string;
  emailAddress: string;
  fromAddress: string | null;
  subject: string;
  body: string;
  sentTimestamp: Date;
  requestId: string | null;
  policyTopics: string | null;
  sesMessageId: string | null;
  processed: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Log an email (outbound or inbound)
// ---------------------------------------------------------------------------

export async function logEmail(params: LogEmailParams): Promise<EmailLogEntry> {
  const entry = await prisma.cpraEmailLog.create({
    data: {
      agencyId: params.agencyId ?? null,
      direction: params.direction,
      emailAddress: params.emailAddress,
      fromAddress: params.fromAddress ?? null,
      subject: params.subject,
      body: params.body,
      requestId: params.requestId ?? null,
      policyTopics: params.policyTopics ? JSON.stringify(params.policyTopics) : null,
      sesMessageId: params.sesMessageId ?? null,
      processed: params.direction === 'OUTBOUND', // outbound emails are already "processed"
    },
  });

  return entry;
}

// ---------------------------------------------------------------------------
// Mark inbound email as processed
// ---------------------------------------------------------------------------

export async function markEmailProcessed(emailId: string): Promise<void> {
  await prisma.cpraEmailLog.update({
    where: { emailId },
    data: { processed: true },
  });
}

// ---------------------------------------------------------------------------
// Get email log for an agency
// ---------------------------------------------------------------------------

export async function getEmailLogForAgency(
  agencyId: string,
  limit: number = 50,
): Promise<EmailLogEntry[]> {
  return prisma.cpraEmailLog.findMany({
    where: { agencyId },
    orderBy: { sentTimestamp: 'desc' },
    take: limit,
  });
}

// ---------------------------------------------------------------------------
// Get email conversation (outbound + inbound) for a request
// ---------------------------------------------------------------------------

export async function getEmailConversation(
  requestId: string,
): Promise<EmailLogEntry[]> {
  return prisma.cpraEmailLog.findMany({
    where: { requestId },
    orderBy: { sentTimestamp: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Get unprocessed inbound emails
// ---------------------------------------------------------------------------

export async function getUnprocessedInboundEmails(): Promise<EmailLogEntry[]> {
  return prisma.cpraEmailLog.findMany({
    where: {
      direction: 'INBOUND',
      processed: false,
    },
    orderBy: { sentTimestamp: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Get email stats
// ---------------------------------------------------------------------------

export async function getEmailStats(): Promise<{
  totalOutbound: number;
  totalInbound: number;
  unprocessedInbound: number;
  todayOutbound: number;
  todayInbound: number;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalOutbound, totalInbound, unprocessedInbound, todayOutbound, todayInbound] =
    await Promise.all([
      prisma.cpraEmailLog.count({ where: { direction: 'OUTBOUND' } }),
      prisma.cpraEmailLog.count({ where: { direction: 'INBOUND' } }),
      prisma.cpraEmailLog.count({ where: { direction: 'INBOUND', processed: false } }),
      prisma.cpraEmailLog.count({ where: { direction: 'OUTBOUND', sentTimestamp: { gte: todayStart } } }),
      prisma.cpraEmailLog.count({ where: { direction: 'INBOUND', sentTimestamp: { gte: todayStart } } }),
    ]);

  return { totalOutbound, totalInbound, unprocessedInbound, todayOutbound, todayInbound };
}
