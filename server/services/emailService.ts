// ============================================
// Court Access — Email Service (AWS SES)
// ============================================

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { env } from '../config/env.js';
import { logger } from '../utils/loggingUtils.js';
import { createNotification, updateNotificationStatus } from './notificationService.js';

let sesClient: SESClient | null = null;

function getSESClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: env.AWS_REGION,
      credentials: env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
    });
  }
  return sesClient;
}

export interface SendEmailInput {
  tenantId: string;
  userId: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  type: string;
}

/**
 * Send an email via AWS SES.
 */
export async function sendEmail(input: SendEmailInput) {
  const notification = await createNotification({
    tenantId: input.tenantId,
    userId: input.userId,
    type: input.type,
    channel: 'email',
    message: input.subject,
  });

  try {
    if (!env.AWS_ACCESS_KEY_ID) {
      logger.warn('AWS SES not configured — email not sent');
      await updateNotificationStatus(notification.id, 'skipped');
      return { ...notification, sentStatus: 'skipped' };
    }

    const client = getSESClient();
    await client.send(
      new SendEmailCommand({
        Source: env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [input.to] },
        Message: {
          Subject: { Data: input.subject },
          Body: {
            Html: { Data: input.bodyHtml },
            Text: { Data: input.bodyText },
          },
        },
      })
    );

    await updateNotificationStatus(notification.id, 'sent');
    logger.info('Email sent', { to: input.to, subject: input.subject });
    return { ...notification, sentStatus: 'sent' };
  } catch (error) {
    logger.error('Email send failed', { error: (error as Error).message });
    await updateNotificationStatus(notification.id, 'failed');
    return { ...notification, sentStatus: 'failed' };
  }
}

export interface CampaignInput {
  tenantId: string;
  userId: string;
  recipients: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

/**
 * Send a campaign email to multiple recipients.
 */
export async function sendCampaign(input: CampaignInput) {
  const results: Array<{ email: string; status: string }> = [];

  for (const recipient of input.recipients) {
    const result = await sendEmail({
      tenantId: input.tenantId,
      userId: input.userId,
      to: recipient,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText,
      type: 'campaign',
    });
    results.push({ email: recipient, status: result.sentStatus });
  }

  logger.info('Campaign sent', {
    tenantId: input.tenantId,
    recipientCount: input.recipients.length,
  });

  return results;
}
