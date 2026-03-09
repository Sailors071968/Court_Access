// ---------------------------------------------------------------------------
// Phase 37 — CPRA Response Detection & Processing
// Phase 38 — Campaign Stop Logic
// Phase 41 — Document Ingestion (connect to policy pipeline)
// Handles incoming CPRA responses, stops follow-ups, and triggers ingestion.
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import { sendThankYouEmail } from './cpraEmailSender.js';
import { scheduleAnnualPolicyUpdate } from './cpraAnnualUpdateService.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CpraResponseResult {
  requestId: string;
  agencyId: string;
  success: boolean;
  thankYouSent: boolean;
  documentsIngested: number;
  error: string | null;
}

export interface DocumentAttachment {
  fileName: string;
  mimeType: string;
  sourceUrl: string;
  fileSizeBytes: number;
}

// ---------------------------------------------------------------------------
// Phase 37 — Process incoming CPRA response
// ---------------------------------------------------------------------------

export async function processIncomingCpraResponse(
  requestId: string,
  attachments: DocumentAttachment[] = [],
): Promise<CpraResponseResult> {
  const request = await prisma.cPRAAgencyRequest.findUnique({
    where: { requestId },
  });

  if (!request) {
    return {
      requestId,
      agencyId: '',
      success: false,
      thankYouSent: false,
      documentsIngested: 0,
      error: `Request ${requestId} not found`,
    };
  }

  if (request.closed) {
    return {
      requestId,
      agencyId: request.agencyId,
      success: false,
      thankYouSent: false,
      documentsIngested: 0,
      error: 'Request is already closed',
    };
  }

  // Phase 38 — Mark response received and stop follow-ups
  await prisma.cPRAAgencyRequest.update({
    where: { requestId },
    data: {
      responseReceived: true,
      responseReceivedAt: new Date(),
      closed: true,
      status: 'documents_received',
    },
  });

  // Phase 41 — Ingest documents into policy pipeline
  let documentsIngested = 0;
  for (const attachment of attachments) {
    try {
      await prisma.policyDocument.create({
        data: {
          agencyId: request.agencyId,
          sourceUrl: attachment.sourceUrl,
          title: attachment.fileName,
          mimeType: attachment.mimeType,
          fileSizeBytes: attachment.fileSizeBytes,
          ocrStatus: 'pending',
          classificationStatus: 'pending',
        },
      });
      documentsIngested++;
    } catch (error) {
      console.error(
        `[CPRA Response] Failed to ingest document ${attachment.fileName}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  // Phase 39 — Send thank-you email
  let thankYouSent = false;
  try {
    const thankYouResult = await sendThankYouEmail(requestId);
    thankYouSent = thankYouResult.success;
  } catch (error) {
    console.error(
      `[CPRA Response] Failed to send thank-you email: ${error instanceof Error ? error.message : error}`,
    );
  }

  // Phase 46-47 — Schedule annual policy update (365-day cycle)
  try {
    const { annualUpdateDue } = await scheduleAnnualPolicyUpdate(
      request.agencyId,
      requestId,
    );
    console.log(
      `[CPRA Response] Annual update scheduled for agency ${request.agencyId} on ${annualUpdateDue.toISOString()}`,
    );
  } catch (error) {
    console.error(
      `[CPRA Response] Failed to schedule annual update: ${error instanceof Error ? error.message : error}`,
    );
  }

  console.log(
    `[CPRA Response] Request ${requestId}: response received, ${documentsIngested} documents ingested, thank-you ${thankYouSent ? 'sent' : 'failed'}`,
  );

  return {
    requestId,
    agencyId: request.agencyId,
    success: true,
    thankYouSent,
    documentsIngested,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Phase 40 — Manual response confirmation
// Called when an investigator marks a request as fulfilled.
// ---------------------------------------------------------------------------

export async function markResponseReceived(
  requestId: string,
  attachments: DocumentAttachment[] = [],
): Promise<CpraResponseResult> {
  return processIncomingCpraResponse(requestId, attachments);
}

// ---------------------------------------------------------------------------
// Close a request without response (e.g., agency does not respond)
// ---------------------------------------------------------------------------

export async function closeRequestNoResponse(
  requestId: string,
): Promise<{ success: boolean; error: string | null }> {
  const request = await prisma.cPRAAgencyRequest.findUnique({
    where: { requestId },
  });

  if (!request) {
    return { success: false, error: `Request ${requestId} not found` };
  }

  await prisma.cPRAAgencyRequest.update({
    where: { requestId },
    data: {
      closed: true,
      status: 'closed',
    },
  });

  return { success: true, error: null };
}

// ---------------------------------------------------------------------------
// Get CPRA request status overview
// ---------------------------------------------------------------------------

export async function getCpraRequestStatus(requestId: string) {
  const request = await prisma.cPRAAgencyRequest.findUnique({
    where: { requestId },
  });

  if (!request) return null;

  const agency = await prisma.agency.findUnique({
    where: { agencyId: request.agencyId },
  });

  return {
    ...request,
    agencyName: agency?.agencyName ?? 'Unknown',
    agencyCounty: agency?.county ?? null,
  };
}
