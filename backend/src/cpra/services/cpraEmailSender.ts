// ---------------------------------------------------------------------------
// Phase 33 — CPRA Email Sender
// Sends CPRA request emails via AWS SES with template variable merging.
// ---------------------------------------------------------------------------

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { CPRA_SAFEGUARDS } from './cpraSafeguards.js';

const prisma = new PrismaClient();

const SES_REGION = process.env.AWS_REGION ?? 'us-west-2';
const SENDER_EMAIL =
  process.env.CPRA_SENDER_EMAIL ?? 'research@courtaccess.org';
const REQUESTER_NAME =
  process.env.CPRA_REQUESTER_NAME ?? 'CourtAccess Research Division';
const REQUESTER_ORG =
  process.env.CPRA_REQUESTER_ORG ?? 'CourtAccess';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateVariables {
  agencyName: string;
  agencyEmail: string;
  agencyCity: string;
  agencyCounty: string;
  requestDate: string;
  requesterName: string;
  requesterOrganization: string;
}

export interface SendResult {
  requestId: string;
  agencyId: string;
  success: boolean;
  messageId: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Template loading and merging
// ---------------------------------------------------------------------------

const TEMPLATE_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../templates',
);

export function loadTemplate(templateName: string): string {
  const templatePath = path.join(TEMPLATE_DIR, templateName);
  return fs.readFileSync(templatePath, 'utf-8');
}

export function mergeTemplate(
  template: string,
  variables: TemplateVariables,
): { subject: string; body: string } {
  let merged = template;

  // Replace all {variable} placeholders
  merged = merged.replace(/\{agencyName\}/g, variables.agencyName);
  merged = merged.replace(/\{agencyEmail\}/g, variables.agencyEmail);
  merged = merged.replace(/\{agencyCity\}/g, variables.agencyCity);
  merged = merged.replace(/\{agencyCounty\}/g, variables.agencyCounty);
  merged = merged.replace(/\{requestDate\}/g, variables.requestDate);
  merged = merged.replace(/\{requesterName\}/g, variables.requesterName);
  merged = merged.replace(
    /\{requesterOrganization\}/g,
    variables.requesterOrganization,
  );

  // Extract subject from first line if it starts with "Subject:"
  const lines = merged.split('\n');
  let subject = 'California Public Records Act Request';
  let bodyStart = 0;

  if (lines[0]?.startsWith('Subject:')) {
    subject = lines[0].replace('Subject:', '').trim();
    bodyStart = 1;
  }

  // Skip empty lines after subject
  while (bodyStart < lines.length && lines[bodyStart]?.trim() === '') {
    bodyStart++;
  }

  const body = lines.slice(bodyStart).join('\n').trim();

  return { subject, body };
}

// ---------------------------------------------------------------------------
// SES email sending
// ---------------------------------------------------------------------------

function getSesClient(): SESClient {
  return new SESClient({
    region: SES_REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        }
      : undefined,
  });
}

export async function sendEmail(
  toAddress: string,
  subject: string,
  body: string,
): Promise<{ messageId: string | null; error: string | null }> {
  try {
    const ses = getSesClient();
    const result = await ses.send(
      new SendEmailCommand({
        Source: SENDER_EMAIL,
        Destination: { ToAddresses: [toAddress] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: body, Charset: 'UTF-8' },
          },
        },
      }),
    );
    return { messageId: result.MessageId ?? null, error: null };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[CPRA Email] SES send failed: ${msg}`);
    return { messageId: null, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Main: send CPRA request email to agency
// ---------------------------------------------------------------------------

export async function sendCpraRequestEmail(
  agencyId: string,
  campaignId: string,
  templateName: string = 'initial_cpra_request.txt',
): Promise<SendResult> {
  // Load agency data
  const agency = await prisma.agency.findUnique({
    where: { agencyId },
  });

  if (!agency) {
    return {
      requestId: '',
      agencyId,
      success: false,
      messageId: null,
      error: `Agency ${agencyId} not found`,
    };
  }

  // Derive email domain from website — skip send if agency has no usable website
  const domain = agency.website?.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '') || '';
  if (!domain) {
    return {
      requestId: '',
      agencyId,
      success: false,
      messageId: null,
      error: `Agency ${agencyId} has no website — cannot derive email address`,
    };
  }
  const agencyEmail = `records@${domain}`;

  // Load and merge template
  const template = loadTemplate(templateName);
  const variables: TemplateVariables = {
    agencyName: agency.agencyName,
    agencyEmail,
    agencyCity: agency.city ?? '',
    agencyCounty: agency.county ?? '',
    requestDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    requesterName: REQUESTER_NAME,
    requesterOrganization: REQUESTER_ORG,
  };

  const { subject, body } = mergeTemplate(template, variables);

  // Create CPRAAgencyRequest record BEFORE sending to prevent TOCTOU race with duplicate check
  const request = await prisma.cPRAAgencyRequest.create({
    data: {
      campaignId,
      agencyId,
      status: 'draft',
      sentAt: null,
    },
  });

  // Send email
  const { messageId, error } = await sendEmail(agencyEmail, subject, body);

  // Update record status after send attempt
  if (!error) {
    await prisma.cPRAAgencyRequest.update({
      where: { requestId: request.requestId },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });
  } else {
    // Delete orphaned draft so BullMQ retries aren't blocked by duplicate check
    await prisma.cPRAAgencyRequest.delete({
      where: { requestId: request.requestId },
    });
  }

  return {
    requestId: error ? '' : request.requestId,
    agencyId,
    success: !error,
    messageId,
    error,
  };
}

// ---------------------------------------------------------------------------
// Send follow-up email
// ---------------------------------------------------------------------------

export async function sendFollowUpEmail(
  requestId: string,
): Promise<SendResult> {
  const request = await prisma.cPRAAgencyRequest.findUnique({
    where: { requestId },
  });

  if (!request) {
    return {
      requestId,
      agencyId: '',
      success: false,
      messageId: null,
      error: `Request ${requestId} not found`,
    };
  }

  // Check follow-up cap
  if (request.followUpCount >= CPRA_SAFEGUARDS.maxFollowUps) {
    return {
      requestId,
      agencyId: request.agencyId,
      success: false,
      messageId: null,
      error: `Max follow-ups (${CPRA_SAFEGUARDS.maxFollowUps}) reached`,
    };
  }

  // Select template based on follow-up count
  let templateName: string;
  if (request.followUpCount === 0) {
    templateName = 'cpra_followup_1.txt';
  } else if (request.followUpCount === 1) {
    templateName = 'cpra_followup_2.txt';
  } else {
    templateName = 'cpra_followup_final.txt';
  }

  const agency = await prisma.agency.findUnique({
    where: { agencyId: request.agencyId },
  });

  if (!agency) {
    return {
      requestId,
      agencyId: request.agencyId,
      success: false,
      messageId: null,
      error: `Agency ${request.agencyId} not found`,
    };
  }

  // Derive email domain from website — skip send if agency has no usable website
  const domain = agency.website?.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '') || '';
  if (!domain) {
    return {
      requestId,
      agencyId: request.agencyId,
      success: false,
      messageId: null,
      error: `Agency ${request.agencyId} has no website — cannot derive email address`,
    };
  }
  const agencyEmail = `records@${domain}`;

  const template = loadTemplate(templateName);
  const variables: TemplateVariables = {
    agencyName: agency.agencyName,
    agencyEmail,
    agencyCity: agency.city ?? '',
    agencyCounty: agency.county ?? '',
    requestDate: request.sentAt?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) ?? 'N/A',
    requesterName: REQUESTER_NAME,
    requesterOrganization: REQUESTER_ORG,
  };

  const { subject, body } = mergeTemplate(template, variables);
  const { messageId, error } = await sendEmail(agencyEmail, subject, body);

  if (!error) {
    // Determine new status based on follow-up count
    let newStatus: string;
    if (request.followUpCount === 0) {
      newStatus = 'follow_up_1';
    } else if (request.followUpCount === 1) {
      newStatus = 'follow_up_2';
    } else {
      newStatus = 'follow_up_final';
    }

    await prisma.cPRAAgencyRequest.update({
      where: { requestId },
      data: {
        followUpCount: request.followUpCount + 1,
        lastFollowUpAt: new Date(),
        status: newStatus,
      },
    });
  }

  return {
    requestId,
    agencyId: request.agencyId,
    success: !error,
    messageId,
    error,
  };
}

// ---------------------------------------------------------------------------
// Send thank-you email
// ---------------------------------------------------------------------------

export async function sendThankYouEmail(
  requestId: string,
): Promise<SendResult> {
  const request = await prisma.cPRAAgencyRequest.findUnique({
    where: { requestId },
  });

  if (!request) {
    return {
      requestId,
      agencyId: '',
      success: false,
      messageId: null,
      error: `Request ${requestId} not found`,
    };
  }

  const agency = await prisma.agency.findUnique({
    where: { agencyId: request.agencyId },
  });

  if (!agency) {
    return {
      requestId,
      agencyId: request.agencyId,
      success: false,
      messageId: null,
      error: `Agency ${request.agencyId} not found`,
    };
  }

  // Derive email domain from website — skip send if agency has no usable website
  const domain = agency.website?.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '') || '';
  if (!domain) {
    return {
      requestId,
      agencyId: request.agencyId,
      success: false,
      messageId: null,
      error: `Agency ${request.agencyId} has no website — cannot derive email address`,
    };
  }
  const agencyEmail = `records@${domain}`;

  const template = loadTemplate('cpra_thank_you.txt');
  const variables: TemplateVariables = {
    agencyName: agency.agencyName,
    agencyEmail,
    agencyCity: agency.city ?? '',
    agencyCounty: agency.county ?? '',
    requestDate: request.sentAt?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) ?? 'N/A',
    requesterName: REQUESTER_NAME,
    requesterOrganization: REQUESTER_ORG,
  };

  const { subject, body } = mergeTemplate(template, variables);
  const { messageId, error } = await sendEmail(agencyEmail, subject, body);

  return {
    requestId,
    agencyId: request.agencyId,
    success: !error,
    messageId,
    error,
  };
}
