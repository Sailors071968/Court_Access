// ============================================
// Court Access — Email Service (AWS SES)
// ============================================

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';

let sesClient: SESClient | null = null;

function getSESClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: env.SES_REGION,
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

async function isEmailSuppressed(email: string): Promise<boolean> {
  const suppressed = await prisma.emailSuppression.findFirst({
    where: { email },
  });
  return suppressed !== null;
}

async function sendEmailViaSES(to: string, subject: string, bodyHtml: string, bodyText: string): Promise<boolean> {
  // Check suppression list
  if (await isEmailSuppressed(to)) {
    logger.warn('Email suppressed — recipient on suppression list', { to });
    return false;
  }

  if (!env.AWS_ACCESS_KEY_ID) {
    logger.warn('AWS SES not configured — email not sent', { to, subject });
    return false;
  }

  try {
    const client = getSESClient();
    await client.send(
      new SendEmailCommand({
        Source: env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: {
            Html: { Data: bodyHtml },
            Text: { Data: bodyText },
          },
        },
      })
    );
    logger.info('Email sent', { to, subject });
    return true;
  } catch (error) {
    logger.error('Email send failed', { error: (error as Error).message, to });
    return false;
  }
}

export async function sendUploadConfirmation(email: string, documentName: string): Promise<boolean> {
  return sendEmailViaSES(
    email,
    'Court Access — Document Uploaded',
    `<p>Your document <strong>${documentName}</strong> has been uploaded and is being processed.</p>`,
    `Your document "${documentName}" has been uploaded and is being processed.`
  );
}

export async function sendAnalysisComplete(email: string, documentName: string): Promise<boolean> {
  return sendEmailViaSES(
    email,
    'Court Access — Analysis Complete',
    `<p>Analysis of <strong>${documentName}</strong> is complete. Log in to view results.</p>`,
    `Analysis of "${documentName}" is complete. Log in to view results.`
  );
}

export async function sendAccountNotification(email: string, subject: string, message: string): Promise<boolean> {
  return sendEmailViaSES(
    email,
    `Court Access — ${subject}`,
    `<p>${message}</p>`,
    message
  );
}

/**
 * Handle SES/SNS events (Bounce, Complaint, Delivery, Reject).
 */
export async function handleSESEvent(event: {
  eventType: string;
  bounce?: { bouncedRecipients: Array<{ emailAddress: string }> };
  complaint?: { complainedRecipients: Array<{ emailAddress: string }> };
}) {
  switch (event.eventType) {
    case 'Bounce': {
      const recipients = event.bounce?.bouncedRecipients || [];
      for (const r of recipients) {
        await prisma.emailSuppression.create({
          data: {
            email: r.emailAddress,
            reason: 'bounce',
            sourceEvent: 'ses_bounce',
          },
        });
        logger.info('Email suppressed — bounce', { email: r.emailAddress });
      }
      break;
    }
    case 'Complaint': {
      const recipients = event.complaint?.complainedRecipients || [];
      for (const r of recipients) {
        await prisma.emailSuppression.create({
          data: {
            email: r.emailAddress,
            reason: 'complaint',
            sourceEvent: 'ses_complaint',
          },
        });
        logger.info('Email suppressed — complaint', { email: r.emailAddress });
      }
      break;
    }
    case 'Delivery':
      logger.debug('Email delivered', { event });
      break;
    case 'Reject':
      logger.warn('Email rejected', { event });
      break;
    default:
      logger.debug('Unhandled SES event', { eventType: event.eventType });
  }
}
