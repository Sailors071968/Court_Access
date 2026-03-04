// ============================================
// Court Access — SES SNS Webhook Controller (Phase O2)
// SNS Notification Parser for Bounce / Complaint Events
//
// Responsibilities:
//   - Verify SNS message type
//   - Parse SES JSON payload
//   - Extract bounce/complaint fields
//   - Return normalized payload for bounceHandlerEngine
//
// No business logic inside controller.
// No retry loops.
// No dispatch calls.
// No store access.
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Does NOT import scheduler
//   - Does NOT import anchor/signature engines
//   - Type-only imports from models
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of input entities
//   - Deterministic parsing
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  SESNotificationType,
  NormalizedBouncePayload,
  NormalizedComplaintPayload,
} from '../models/BounceModel';

// ---------------------------------------------------------------------------
// SNS Message Type Verification
// ---------------------------------------------------------------------------

/**
 * Verify that a raw SNS message body contains a valid SES notification type.
 *
 * Returns the notification type if valid, or null if unrecognized.
 * Only 'Bounce' and 'Complaint' are recognized.
 *
 * No fuzzy matching. Exact ASCII comparison only.
 * Deterministic — same input always produces same output.
 */
export function verifySnsNotificationType(
  parsedBody: { notificationType?: string }
): SESNotificationType | null {
  if (parsedBody.notificationType === 'Bounce') return 'Bounce';
  if (parsedBody.notificationType === 'Complaint') return 'Complaint';
  return null;
}

// ---------------------------------------------------------------------------
// Parse Bounce Notification
// ---------------------------------------------------------------------------

/**
 * Parse an SES bounce notification from SNS JSON payload.
 *
 * Expected structure (SES SNS format):
 *   {
 *     notificationType: "Bounce",
 *     mail: { messageId: string, destination: string[] },
 *     bounce: {
 *       bounceType: string,
 *       bouncedRecipients: [{ emailAddress: string, diagnosticCode?: string }],
 *       timestamp: string
 *     }
 *   }
 *
 * Returns NormalizedBouncePayload or null if parsing fails.
 * No fuzzy logic. No tolerance for malformed payloads.
 * Deterministic — same input always produces same output.
 */
export function parseBounceNotification(
  parsedBody: {
    notificationType?: string;
    mail?: { messageId?: string; destination?: string[] };
    bounce?: {
      bounceType?: string;
      bouncedRecipients?: Array<{ emailAddress?: string; diagnosticCode?: string }>;
      timestamp?: string;
    };
  }
): NormalizedBouncePayload | null {
  // Validate required fields
  if (parsedBody.notificationType !== 'Bounce') return null;
  if (!parsedBody.mail) return null;
  if (typeof parsedBody.mail.messageId !== 'string') return null;
  if (!parsedBody.bounce) return null;
  if (typeof parsedBody.bounce.bounceType !== 'string') return null;
  if (typeof parsedBody.bounce.timestamp !== 'string') return null;
  if (!Array.isArray(parsedBody.bounce.bouncedRecipients)) return null;

  // Extract recipient addresses
  const recipientAddresses: string[] = [];
  for (let i = 0; i < parsedBody.bounce.bouncedRecipients.length; i++) {
    const recipient = parsedBody.bounce.bouncedRecipients[i];
    if (typeof recipient.emailAddress === 'string') {
      recipientAddresses.push(recipient.emailAddress);
    }
  }

  if (recipientAddresses.length === 0) return null;

  // Extract diagnostic code from first recipient (SES convention)
  const diagnosticCode =
    typeof parsedBody.bounce.bouncedRecipients[0].diagnosticCode === 'string'
      ? parsedBody.bounce.bouncedRecipients[0].diagnosticCode
      : '';

  return {
    notificationType: 'Bounce',
    messageId: parsedBody.mail.messageId,
    recipientAddresses,
    bounceType: parsedBody.bounce.bounceType,
    diagnosticCode,
    timestamp: parsedBody.bounce.timestamp,
  };
}

// ---------------------------------------------------------------------------
// Parse Complaint Notification
// ---------------------------------------------------------------------------

/**
 * Parse an SES complaint notification from SNS JSON payload.
 *
 * Expected structure (SES SNS format):
 *   {
 *     notificationType: "Complaint",
 *     mail: { messageId: string, destination: string[] },
 *     complaint: {
 *       complaintFeedbackType?: string,
 *       complainedRecipients: [{ emailAddress: string }],
 *       feedbackId: string,
 *       timestamp: string
 *     }
 *   }
 *
 * Returns NormalizedComplaintPayload or null if parsing fails.
 * No fuzzy logic. No tolerance for malformed payloads.
 * Deterministic — same input always produces same output.
 */
export function parseComplaintNotification(
  parsedBody: {
    notificationType?: string;
    mail?: { messageId?: string; destination?: string[] };
    complaint?: {
      complaintFeedbackType?: string;
      complainedRecipients?: Array<{ emailAddress?: string }>;
      feedbackId?: string;
      timestamp?: string;
    };
  }
): NormalizedComplaintPayload | null {
  // Validate required fields
  if (parsedBody.notificationType !== 'Complaint') return null;
  if (!parsedBody.mail) return null;
  if (typeof parsedBody.mail.messageId !== 'string') return null;
  if (!parsedBody.complaint) return null;
  if (typeof parsedBody.complaint.feedbackId !== 'string') return null;
  if (typeof parsedBody.complaint.timestamp !== 'string') return null;
  if (!Array.isArray(parsedBody.complaint.complainedRecipients)) return null;

  // Extract recipient addresses
  const recipientAddresses: string[] = [];
  for (let i = 0; i < parsedBody.complaint.complainedRecipients.length; i++) {
    const recipient = parsedBody.complaint.complainedRecipients[i];
    if (typeof recipient.emailAddress === 'string') {
      recipientAddresses.push(recipient.emailAddress);
    }
  }

  if (recipientAddresses.length === 0) return null;

  // Extract feedback type (may be undefined in SES payload)
  const feedbackType =
    typeof parsedBody.complaint.complaintFeedbackType === 'string'
      ? parsedBody.complaint.complaintFeedbackType
      : '';

  return {
    notificationType: 'Complaint',
    messageId: parsedBody.mail.messageId,
    recipientAddresses,
    feedbackType,
    feedbackId: parsedBody.complaint.feedbackId,
    timestamp: parsedBody.complaint.timestamp,
  };
}
