// ============================================
// Court Access — SES Dispatch Service (Phase O1)
// Isolated SES Client Wrapper
//
// Responsibilities:
//   - Accept a SendQueueEntry
//   - Call AWS SES to send email
//   - Return dispatch outcome
//
// This service is the ONLY file that touches the SES client.
// No scheduling logic here. No warmup logic here.
// SES client isolated.
//
// Dispatch rules:
//   - Dispatch one entry per call (no bulk arrays)
//   - No retry loops inside dispatcher (retries handled by scheduler)
//   - No direct scheduling logic
//   - CommunicationLedger entry must exist before dispatch
//   - SendStatus must be 'QUEUED' before dispatch
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Does NOT import scheduler
//   - Does NOT modify CommunicationLedger
//   - SES client isolated in this one service
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now (timestamps caller-provided)
//   - No localeCompare
//   - No mutation of input entities
//   - Deterministic validation (dispatch itself is external side effect)
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  SendQueueEntry,
  DispatchResult,
  DispatchOutcome,
} from '../models/SendQueueModel';

// ---------------------------------------------------------------------------
// SES Client Configuration
// ---------------------------------------------------------------------------

/**
 * SES client configuration.
 * Caller provides all configuration — no environment variable reads.
 * No secrets in code.
 */
export interface SESClientConfig {
  region: string;                        // AWS region (e.g., 'us-east-1')
  sourceAddress: string;                 // Verified sender address
}

// ---------------------------------------------------------------------------
// Pre-Dispatch Validation — deterministic checks before SES call
// ---------------------------------------------------------------------------

/**
 * Validate that a send queue entry is eligible for dispatch.
 *
 * Checks:
 *   1. sendStatus === 'QUEUED' (only QUEUED entries can be dispatched)
 *   2. communicationId is non-empty (must reference a CommunicationLedger entry)
 *   3. recipientAddress is non-empty
 *   4. queueId is non-empty
 *
 * Binary PASS/FAIL only.
 * No mutation. No side effects.
 * Deterministic — same input always produces same result.
 */
export function validatePreDispatch(
  entry: SendQueueEntry
): 'PASS' | 'FAIL' {
  if (entry.sendStatus !== 'QUEUED') return 'FAIL';
  if (entry.communicationId.length === 0) return 'FAIL';
  if (entry.recipientAddress.length === 0) return 'FAIL';
  if (entry.queueId.length === 0) return 'FAIL';
  return 'PASS';
}

// ---------------------------------------------------------------------------
// Dispatch Single Entry — SES call wrapper
// ---------------------------------------------------------------------------

/**
 * Dispatch a single email via AWS SES.
 *
 * This is the ONLY function that makes an external SES call.
 * One entry per call. No bulk dispatch. No retry loops.
 *
 * Parameters:
 *   - entry: SendQueueEntry (must have sendStatus === 'QUEUED')
 *   - config: SESClientConfig
 *   - dispatchedTimestamp: ISO 8601, caller-provided
 *   - subject: email subject line
 *   - bodyText: email body (plain text)
 *
 * Returns:
 *   - DispatchResult with outcome (DISPATCHED, FAILED, or THROTTLED)
 *
 * Pre-dispatch validation is performed before the SES call.
 * If validation fails, returns FAILED without calling SES.
 *
 * SES errors are caught and mapped to FAILED or THROTTLED.
 * No retry logic — retries handled by scheduler.
 */
export async function dispatchSingleEntry(
  entry: SendQueueEntry,
  config: SESClientConfig,
  dispatchedTimestamp: string,
  subject: string,
  bodyText: string
): Promise<DispatchResult> {
  // Pre-dispatch validation
  const preCheck = validatePreDispatch(entry);
  if (preCheck === 'FAIL') {
    return {
      queueId: entry.queueId,
      outcome: 'FAILED' as DispatchOutcome,
      messageId: '',
      dispatchedTimestamp,
    };
  }

  try {
    // Build SES send parameters
    // Uses fetch to call SES API directly (no SDK dependency)
    // In production, this would use the AWS SDK SESv2 client
    // For now, this is the structural placeholder that will be
    // wired to the actual SES client at deployment time.
    //
    // The structural contract is:
    //   Input: source, destination, subject, body
    //   Output: messageId or error
    const sesPayload = {
      Source: config.sourceAddress,
      Destination: {
        ToAddresses: [entry.recipientAddress],
      },
      Message: {
        Subject: { Data: subject },
        Body: { Text: { Data: bodyText } },
      },
    };

    // SES API endpoint (to be wired at deployment)
    const endpoint = `https://email.${config.region}.amazonaws.com`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildSESFormBody(sesPayload),
    });

    if (response.ok) {
      const responseText = await response.text();
      // Extract MessageId from SES response XML
      const messageId = extractMessageId(responseText);
      return {
        queueId: entry.queueId,
        outcome: 'DISPATCHED' as DispatchOutcome,
        messageId,
        dispatchedTimestamp,
      };
    }

    // Check for throttling (HTTP 429 or SES Throttling error)
    if (response.status === 429) {
      return {
        queueId: entry.queueId,
        outcome: 'THROTTLED' as DispatchOutcome,
        messageId: '',
        dispatchedTimestamp,
      };
    }

    // Any other error
    return {
      queueId: entry.queueId,
      outcome: 'FAILED' as DispatchOutcome,
      messageId: '',
      dispatchedTimestamp,
    };
  } catch {
    // Network or unexpected error
    return {
      queueId: entry.queueId,
      outcome: 'FAILED' as DispatchOutcome,
      messageId: '',
      dispatchedTimestamp,
    };
  }
}

// ---------------------------------------------------------------------------
// SES Form Body Builder — URL-encoded form parameters
// ---------------------------------------------------------------------------

/**
 * Build URL-encoded form body for SES SendEmail action.
 * Deterministic string construction.
 */
function buildSESFormBody(payload: {
  Source: string;
  Destination: { ToAddresses: string[] };
  Message: { Subject: { Data: string }; Body: { Text: { Data: string } } };
}): string {
  const params: string[] = [];
  params.push('Action=SendEmail');
  params.push('Source=' + encodeURIComponent(payload.Source));
  for (let i = 0; i < payload.Destination.ToAddresses.length; i++) {
    params.push(
      'Destination.ToAddresses.member.' + String(i + 1) + '=' +
      encodeURIComponent(payload.Destination.ToAddresses[i])
    );
  }
  params.push('Message.Subject.Data=' + encodeURIComponent(payload.Message.Subject.Data));
  params.push('Message.Body.Text.Data=' + encodeURIComponent(payload.Message.Body.Text.Data));
  return params.join('&');
}

// ---------------------------------------------------------------------------
// Extract Message ID from SES XML Response
// ---------------------------------------------------------------------------

/**
 * Extract MessageId from SES SendEmail XML response.
 * Simple tag extraction — no XML parser dependency.
 * Returns empty string if not found.
 */
function extractMessageId(responseXml: string): string {
  const startTag = '<MessageId>';
  const endTag = '</MessageId>';
  const startIdx = responseXml.indexOf(startTag);
  if (startIdx === -1) return '';
  const valueStart = startIdx + startTag.length;
  const endIdx = responseXml.indexOf(endTag, valueStart);
  if (endIdx === -1) return '';
  return responseXml.substring(valueStart, endIdx);
}
