// ============================================================================
// Billing Email Service — subscription lifecycle notifications
// Sends via SES when configured; always logs to security audit trail
// ============================================================================

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import prisma from '../lib/prisma.js';
import { logSecurityEvent } from '../security/authMiddleware.js';

export type BillingEmailTemplate =
  | 'checkout_completed'
  | 'subscription_created'
  | 'subscription_renewed'
  | 'payment_failed'
  | 'subscription_canceled'
  | 'refund_processed';

const BILLING_FROM = process.env.BILLING_FROM_EMAIL ?? process.env.AWS_SES_FROM_EMAIL ?? 'billing@courtaccess.net';

function buildMessage(template: BillingEmailTemplate, details: Record<string, string>): { subject: string; body: string } {
  switch (template) {
    case 'checkout_completed':
      return {
        subject: 'CourtAccess — Subscription confirmed',
        body: `Your CourtAccess subscription (${details.planName ?? details.planId ?? 'paid plan'}) is now active.\n\nManage billing: ${details.portalUrl ?? 'https://courtaccess.net/dashboard/usage'}`,
      };
    case 'subscription_created':
      return {
        subject: 'CourtAccess — Welcome to your new plan',
        body: `Your subscription to ${details.planName ?? details.tier ?? 'CourtAccess'} is active.`,
      };
    case 'subscription_renewed':
      return {
        subject: 'CourtAccess — Subscription renewed',
        body: `Your subscription has been renewed. Billing period ends ${details.periodEnd ?? 'at next cycle'}.`,
      };
    case 'payment_failed':
      return {
        subject: 'CourtAccess — Payment failed',
        body: `We could not process your subscription payment. Update your payment method to avoid service interruption.\n\nManage billing: ${details.portalUrl ?? 'https://courtaccess.net/dashboard/usage'}`,
      };
    case 'subscription_canceled':
      return {
        subject: 'CourtAccess — Subscription canceled',
        body: 'Your paid subscription has ended. You are now on the Free plan.',
      };
    case 'refund_processed':
      return {
        subject: 'CourtAccess — Refund processed',
        body: `A refund of ${details.amount ?? 'your payment'} has been processed.`,
      };
    default:
      return { subject: 'CourtAccess billing update', body: 'Your billing status has changed.' };
  }
}

async function sendViaSes(to: string, subject: string, body: string): Promise<{ messageId: string | null; error: string | null }> {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    return { messageId: null, error: 'SES not configured' };
  }
  try {
    const ses = new SESClient({
      region: process.env.AWS_SES_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
    const result = await ses.send(
      new SendEmailCommand({
        Source: BILLING_FROM,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Text: { Data: body, Charset: 'UTF-8' } },
        },
      }),
    );
    return { messageId: result.MessageId ?? null, error: null };
  } catch (err) {
    return { messageId: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface BillingEmailResult {
  sent: boolean;
  logged: boolean;
  messageId: string | null;
  simulationMode: boolean;
}

export async function sendBillingEmail(
  userId: string,
  template: BillingEmailTemplate,
  details: Record<string, string> = {},
): Promise<BillingEmailResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) {
    return { sent: false, logged: false, messageId: null, simulationMode: true };
  }

  const { subject, body } = buildMessage(template, details);
  const sesResult = await sendViaSes(user.email, subject, body);
  const sent = Boolean(sesResult.messageId);
  const simulationMode = !sent && Boolean(sesResult.error);

  void logSecurityEvent(
    sent ? 'BILLING_EMAIL_SENT' : 'BILLING_EMAIL_SIMULATED',
    userId,
    undefined,
    `${template}: ${subject}${sesResult.messageId ? ` (${sesResult.messageId})` : sesResult.error ? ` [${sesResult.error}]` : ''}`,
  );

  return {
    sent,
    logged: true,
    messageId: sesResult.messageId,
    simulationMode,
  };
}
