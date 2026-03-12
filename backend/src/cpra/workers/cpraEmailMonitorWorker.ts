// ============================================================================
// Autonomous CPRA System — Email Monitor Worker
// Polls inbox for incoming CPRA responses, parses emails, logs them,
// and triggers the attachment processor pipeline.
// Runs every 30-60 seconds as a background worker.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { logEmail, markEmailProcessed } from '../services/cpraEmailLogService.js';
import { createNotification } from '../services/cpraNotificationService.js';
import { addTimelineEvent } from '../services/cpraTimelineService.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CPRA_INBOX_EMAIL = process.env.CPRA_INBOX_EMAIL ?? 'cpra@courtaccess.net';
const SES_REGION = process.env.AWS_REGION ?? 'us-west-2';
const S3_BUCKET_FOR_EMAIL = process.env.SES_INCOMING_BUCKET ?? 'courtaccess-incoming-email';
const POLL_INTERVAL_MS = parseInt(process.env.EMAIL_POLL_INTERVAL_MS ?? '30000', 10);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  date: Date;
  attachments: Array<{
    fileName: string;
    mimeType: string;
    content: Buffer | null;
    size: number;
  }>;
  rawHeaders: Record<string, string>;
}

export interface EmailMonitorResult {
  processed: number;
  matched: number;
  errors: number;
  details: Array<{
    emailFrom: string;
    subject: string;
    agencyId: string | null;
    attachmentCount: number;
    status: string;
  }>;
}

// ---------------------------------------------------------------------------
// S3 Client (for reading SES-delivered emails)
// ---------------------------------------------------------------------------

function getS3Client(): S3Client {
  return new S3Client({
    region: SES_REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        }
      : undefined,
  });
}

// ---------------------------------------------------------------------------
// Parse raw email from S3 (SES stores raw MIME in S3)
// ---------------------------------------------------------------------------

function parseRawEmail(rawContent: string): ParsedEmail {
  const lines = rawContent.split('\n');
  const headers: Record<string, string> = {};
  let bodyStart = 0;

  // Parse headers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (line === '') {
      bodyStart = i + 1;
      break;
    }
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();
      headers[key] = value;
    }
  }

  const body = lines.slice(bodyStart).join('\n').trim();

  // Extract attachments from MIME boundaries (simplified)
  const attachments: ParsedEmail['attachments'] = [];
  const boundaryMatch = headers['content-type']?.match(/boundary="?([^";\s]+)"?/);

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = rawContent.split(`--${boundary}`);

    for (const part of parts) {
      const contentDisposition = part.match(/Content-Disposition:\s*attachment;\s*filename="?([^";\n]+)"?/i);
      if (contentDisposition) {
        const fileName = contentDisposition[1]?.trim() ?? 'unknown';
        const contentTypeMatch = part.match(/Content-Type:\s*([^\n;]+)/i);
        const mimeType = contentTypeMatch?.[1]?.trim() ?? 'application/octet-stream';

        // Find the content after the double newline in this MIME part
        // Handle both \r\n\r\n (standard MIME) and \n\n (unix) line endings
        const crlfIndex = part.indexOf('\r\n\r\n');
        const lfIndex = part.indexOf('\n\n');
        const contentStart = crlfIndex !== -1 ? crlfIndex + 4 : (lfIndex !== -1 ? lfIndex + 2 : -1);
        const content = contentStart > 0 ? part.slice(contentStart).trim() : '';

        const decodedContent = Buffer.from(content, 'base64');
        attachments.push({
          fileName,
          mimeType,
          content: decodedContent,
          size: decodedContent.length,
        });
      }
    }
  }

  return {
    from: headers.from ?? '',
    to: headers.to ?? '',
    subject: headers.subject ?? '(no subject)',
    body,
    date: headers.date ? new Date(headers.date) : new Date(),
    attachments,
    rawHeaders: headers,
  };
}

// ---------------------------------------------------------------------------
// Match sender email to agency in database
// ---------------------------------------------------------------------------

async function matchSenderToAgency(
  fromEmail: string,
): Promise<{ agencyId: string; agencyName: string } | null> {
  // Extract domain from email
  const domainMatch = fromEmail.match(/@([^\s>]+)/);
  if (!domainMatch) return null;

  const senderDomain = domainMatch[1]?.toLowerCase() ?? '';

  // Search agencies by website domain
  const agencies = await prisma.agency.findMany({
    where: {
      website: { not: null },
    },
    select: { agencyId: true, agencyName: true, website: true },
  });

  for (const agency of agencies) {
    const agencyDomain = agency.website
      ?.replace(/^https?:\/\//, '')
      .replace(/[/:].*$/, '')
      .replace(/^www\./, '')
      .toLowerCase() ?? '';

    if (agencyDomain && (senderDomain.includes(agencyDomain) || agencyDomain.includes(senderDomain))) {
      return { agencyId: agency.agencyId, agencyName: agency.agencyName };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Process a single incoming email
// ---------------------------------------------------------------------------

async function processIncomingEmail(
  parsed: ParsedEmail,
): Promise<{
  agencyId: string | null;
  emailLogId: string;
  attachmentCount: number;
  status: string;
}> {
  // Try to match sender to an agency
  const agencyMatch = await matchSenderToAgency(parsed.from);
  const agencyId = agencyMatch?.agencyId ?? null;

  // Find active CPRA request for this agency if matched
  let requestId: string | null = null;
  if (agencyId) {
    const activeRequest = await prisma.cPRAAgencyRequest.findFirst({
      where: { agencyId, closed: false },
      orderBy: { createdAt: 'desc' },
    });
    requestId = activeRequest?.requestId ?? null;
  }

  // Log the inbound email
  const emailLog = await logEmail({
    agencyId: agencyId ?? undefined,
    direction: 'INBOUND',
    emailAddress: parsed.to,
    fromAddress: parsed.from,
    subject: parsed.subject,
    body: parsed.body.slice(0, 10000), // Truncate body for storage
    requestId: requestId ?? undefined,
  });

  // Create attachment records
  for (const attachment of parsed.attachments) {
    await prisma.cpraEmailAttachment.create({
      data: {
        emailId: emailLog.emailId,
        fileName: attachment.fileName,
        fileType: attachment.mimeType,
        fileSizeBytes: attachment.size,
        processingStatus: 'pending',
      },
    });
  }

  // Create notification
  await createNotification({
    agencyId: agencyId ?? undefined,
    eventType: 'EMAIL_RECEIVED',
    title: `Email received${agencyMatch ? ` from ${agencyMatch.agencyName}` : ''}`,
    message: `Subject: "${parsed.subject}" | ${parsed.attachments.length} attachment(s)`,
    metadata: {
      from: parsed.from,
      subject: parsed.subject,
      attachmentCount: parsed.attachments.length,
      emailLogId: emailLog.emailId,
    },
  });

  // Add timeline event if we matched an agency
  if (agencyId) {
    await addTimelineEvent({
      agencyId,
      eventType: 'EMAIL_RECEIVED',
      title: `Email received: ${parsed.subject}`,
      description: `From: ${parsed.from} | ${parsed.attachments.length} attachment(s)`,
      metadata: {
        from: parsed.from,
        subject: parsed.subject,
        attachments: parsed.attachments.map((a) => a.fileName),
        emailLogId: emailLog.emailId,
      },
    });

    // If this is a response to a CPRA request and has attachments, update request status
    if (requestId && parsed.attachments.length > 0) {
      await prisma.cPRAAgencyRequest.update({
        where: { requestId },
        data: {
          responseReceived: true,
          responseReceivedAt: new Date(),
          status: 'documents_received',
        },
      });
    }
  }

  // Mark email as processed
  await markEmailProcessed(emailLog.emailId);

  return {
    agencyId,
    emailLogId: emailLog.emailId,
    attachmentCount: parsed.attachments.length,
    status: agencyId ? 'matched' : 'unmatched',
  };
}

// ---------------------------------------------------------------------------
// Poll S3 for new incoming emails (SES → S3 rule)
// ---------------------------------------------------------------------------

export async function pollIncomingEmails(): Promise<EmailMonitorResult> {
  const result: EmailMonitorResult = {
    processed: 0,
    matched: 0,
    errors: 0,
    details: [],
  };

  try {
    const s3 = getS3Client();

    // List new email objects in the incoming bucket
    const listResponse = await s3.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET_FOR_EMAIL,
        Prefix: 'incoming/',
        MaxKeys: 20,
      }),
    );

    const objects = listResponse.Contents ?? [];

    for (const obj of objects) {
      if (!obj.Key) continue;

      try {
        // Get the raw email content
        const getResponse = await s3.send(
          new GetObjectCommand({
            Bucket: S3_BUCKET_FOR_EMAIL,
            Key: obj.Key,
          }),
        );

        const rawContent = await getResponse.Body?.transformToString() ?? '';
        if (!rawContent) continue;

        // Parse the email
        const parsed = parseRawEmail(rawContent);

        // Process the email
        const processResult = await processIncomingEmail(parsed);

        result.processed++;
        if (processResult.agencyId) result.matched++;

        result.details.push({
          emailFrom: parsed.from,
          subject: parsed.subject,
          agencyId: processResult.agencyId,
          attachmentCount: processResult.attachmentCount,
          status: processResult.status,
        });

        // Move processed email to processed/ prefix to prevent reprocessing
        await s3.send(
          new CopyObjectCommand({
            Bucket: S3_BUCKET_FOR_EMAIL,
            CopySource: `${S3_BUCKET_FOR_EMAIL}/${obj.Key}`,
            Key: obj.Key.replace('incoming/', 'processed/'),
          }),
        );
        await s3.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET_FOR_EMAIL,
            Key: obj.Key,
          }),
        );
      } catch (error) {
        result.errors++;
        console.error(
          `[Email Monitor] Error processing email ${obj.Key}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  } catch (error) {
    console.error(
      `[Email Monitor] Poll failed: ${error instanceof Error ? error.message : error}`,
    );
    result.errors++;
  }

  if (result.processed > 0) {
    console.log(
      `[Email Monitor] Processed ${result.processed} emails, ${result.matched} matched to agencies, ${result.errors} errors`,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Simulate incoming email (for testing without actual SES setup)
// ---------------------------------------------------------------------------

export async function simulateIncomingEmail(params: {
  from: string;
  subject: string;
  body: string;
  attachments?: Array<{ fileName: string; mimeType: string; size: number }>;
}): Promise<{
  emailLogId: string;
  agencyId: string | null;
  attachmentCount: number;
}> {
  const parsed: ParsedEmail = {
    from: params.from,
    to: CPRA_INBOX_EMAIL,
    subject: params.subject,
    body: params.body,
    date: new Date(),
    attachments: (params.attachments ?? []).map((a) => ({
      fileName: a.fileName,
      mimeType: a.mimeType,
      content: null,
      size: a.size,
    })),
    rawHeaders: {},
  };

  const result = await processIncomingEmail(parsed);
  return {
    emailLogId: result.emailLogId,
    agencyId: result.agencyId,
    attachmentCount: result.attachmentCount,
  };
}

// ---------------------------------------------------------------------------
// Start the email monitor as a background worker
// ---------------------------------------------------------------------------

let monitorInterval: ReturnType<typeof setInterval> | null = null;

export function startEmailMonitor(): void {
  if (monitorInterval) {
    console.log('[Email Monitor] Already running');
    return;
  }

  console.log(`[Email Monitor] Starting with ${POLL_INTERVAL_MS}ms interval`);

  monitorInterval = setInterval(async () => {
    try {
      await pollIncomingEmails();
    } catch (error) {
      console.error(
        `[Email Monitor] Worker error: ${error instanceof Error ? error.message : error}`,
      );
    }
  }, POLL_INTERVAL_MS);
}

export function stopEmailMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[Email Monitor] Stopped');
  }
}

export function isEmailMonitorRunning(): boolean {
  return monitorInterval !== null;
}
