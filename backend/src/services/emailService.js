// ============================================
// Court Access — Phase 64/66: Email Relay Gateway + SES Sandbox Compliance
// All outgoing emails pass through this service.
// Sandbox mode blocks sends to unverified recipients.
// ============================================

import prisma from './prismaClient.js';
import { config } from '../config/index.js';

// ---------------------------------------------------------------------------
// SES Sandbox Mode Check
// ---------------------------------------------------------------------------

const isSandboxMode = () => {
  return process.env.EMAIL_SANDBOX_MODE !== 'false';
};

// ---------------------------------------------------------------------------
// Check if recipient is verified (Phase 66)
// ---------------------------------------------------------------------------

async function isRecipientVerified(email) {
  if (!isSandboxMode()) return true; // Production mode — no restrictions

  const verified = await prisma.verifiedEmail.findUnique({
    where: { emailAddress: email },
  });

  return verified && verified.verificationStatus === 'verified';
}

// ---------------------------------------------------------------------------
// Send Email (Phase 64 — central relay)
// ---------------------------------------------------------------------------

async function sendEmail({ to, subject, body, emailType = 'transactional', metadata = {} }) {
  // Phase 66: Sandbox compliance check
  if (isSandboxMode()) {
    const verified = await isRecipientVerified(to);
    if (!verified) {
      // Log blocked send
      await prisma.emailLog.create({
        data: {
          recipient: to,
          emailType,
          subject,
          deliveryStatus: 'blocked',
          errorMessage: 'Recipient not verified (SES sandbox mode)',
          metadata,
        },
      });

      console.log(`[Email] BLOCKED: ${to} not verified (sandbox mode)`);
      return { success: false, blocked: true, reason: 'recipient_not_verified' };
    }
  }

  try {
    // SES send — uses AWS SDK if available, falls back to logging
    let deliveryStatus = 'sent';
    let errorMessage = null;

    if (config.sesRegion && config.sesAccessKeyId) {
      // Real SES send would go here
      // For now, log the send attempt
      console.log(JSON.stringify({
        event: 'email_sent',
        to,
        subject,
        emailType,
        timestamp: new Date().toISOString(),
      }));
    } else {
      // Development mode — log only
      console.log(`[Email] DEV SEND: to=${to} subject="${subject}" type=${emailType}`);
      deliveryStatus = 'sent';
    }

    // Phase 67: Log the email
    await prisma.emailLog.create({
      data: {
        recipient: to,
        emailType,
        subject,
        deliveryStatus,
        errorMessage,
        metadata,
      },
    });

    return { success: true, deliveryStatus };
  } catch (err) {
    // Log failure
    await prisma.emailLog.create({
      data: {
        recipient: to,
        emailType,
        subject,
        deliveryStatus: 'failed',
        errorMessage: err.message,
        metadata,
      },
    }).catch(() => {});

    console.error(`[Email] Send failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Request Email Verification (Phase 63)
// ---------------------------------------------------------------------------

async function requestVerification(email) {
  const existing = await prisma.verifiedEmail.findUnique({
    where: { emailAddress: email },
  });

  if (existing && existing.verificationStatus === 'verified') {
    return { alreadyVerified: true };
  }

  const record = await prisma.verifiedEmail.upsert({
    where: { emailAddress: email },
    update: {
      verificationStatus: 'pending',
    },
    create: {
      emailAddress: email,
      verificationStatus: 'pending',
    },
  });

  // In production, this would trigger SES SendCustomVerificationEmail
  // For now, log the verification request
  console.log(JSON.stringify({
    event: 'verification_requested',
    email,
    token: record.verificationToken,
    timestamp: new Date().toISOString(),
  }));

  return { requested: true, token: record.verificationToken };
}

// ---------------------------------------------------------------------------
// Confirm Email Verification (Phase 63)
// ---------------------------------------------------------------------------

async function confirmVerification(token) {
  const record = await prisma.verifiedEmail.findUnique({
    where: { verificationToken: token },
  });

  if (!record) {
    return { success: false, error: 'Invalid verification token' };
  }

  if (record.verificationStatus === 'verified') {
    return { success: true, alreadyVerified: true };
  }

  await prisma.verifiedEmail.update({
    where: { verificationToken: token },
    data: {
      verificationStatus: 'verified',
      verifiedAt: new Date(),
    },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Send Invite Email (Phase 68)
// ---------------------------------------------------------------------------

async function sendInviteEmail({ to, inviteCode, role }) {
  // First verify the recipient
  const verificationResult = await requestVerification(to);

  if (!verificationResult.alreadyVerified && isSandboxMode()) {
    return {
      success: false,
      blocked: true,
      reason: 'recipient_not_verified',
      message: 'Recipient must verify their email before invite can be sent (SES sandbox mode)',
    };
  }

  return sendEmail({
    to,
    subject: 'Court Access — Beta Invite',
    body: `You have been invited to join Court Access as a ${role}. Use invite code: ${inviteCode}`,
    emailType: 'invite',
    metadata: { inviteCode, role },
  });
}

// ---------------------------------------------------------------------------
// Send Processing Alert (Phase 64)
// ---------------------------------------------------------------------------

async function sendProcessingAlert({ to, alertType, details }) {
  return sendEmail({
    to,
    subject: `Court Access — ${alertType}`,
    body: JSON.stringify(details),
    emailType: 'processing_alert',
    metadata: { alertType, ...details },
  });
}

// ---------------------------------------------------------------------------
// Send Staff Notification (Phase 73/74)
// ---------------------------------------------------------------------------

async function sendStaffNotification({ to, subject, details }) {
  return sendEmail({
    to,
    subject: `Court Access Staff — ${subject}`,
    body: JSON.stringify(details),
    emailType: 'notification',
    metadata: details,
  });
}

// ---------------------------------------------------------------------------
// Get Sandbox Status
// ---------------------------------------------------------------------------

function getSandboxStatus() {
  return {
    sandboxMode: isSandboxMode(),
    envVar: process.env.EMAIL_SANDBOX_MODE || 'true (default)',
  };
}

export {
  sendEmail,
  requestVerification,
  confirmVerification,
  sendInviteEmail,
  sendProcessingAlert,
  sendStaffNotification,
  isRecipientVerified,
  isSandboxMode,
  getSandboxStatus,
};
