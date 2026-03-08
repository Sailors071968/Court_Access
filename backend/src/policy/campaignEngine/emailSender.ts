// ============================================
// Court Access — Email Sender (AWS SES Integration)
// Sends CPRA policy request emails via Amazon SES.
// ============================================

import { getCpraSubject, getCpraBody, getCpraBodyHtml } from '../emailTemplates/index.js';
import type { CpraTemplateVars } from '../emailTemplates/index.js';

// ---------------------------------------------------------------------------
// SES Configuration
// ---------------------------------------------------------------------------

interface SesConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  fromEmail: string;
}

function getSesConfig(): SesConfig {
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY;
  const secretAccessKey = process.env.AWS_SES_SECRET;
  const fromEmail = process.env.POLICY_REQUEST_EMAIL;
  const region = process.env.AWS_SES_REGION || 'us-west-2';

  if (!accessKeyId || !secretAccessKey || !fromEmail) {
    throw new Error(
      'Missing SES configuration. Required env vars: AWS_SES_ACCESS_KEY, AWS_SES_SECRET, POLICY_REQUEST_EMAIL'
    );
  }

  return { accessKeyId, secretAccessKey, region, fromEmail };
}

// ---------------------------------------------------------------------------
// SES API Types
// ---------------------------------------------------------------------------

interface SesEmailParams {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  fromEmail: string;
}

interface SesSendResult {
  messageId: string;
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// SES HTTP API (v2 — direct HTTPS request, no SDK dependency)
// ---------------------------------------------------------------------------

async function sendViaSes(params: SesEmailParams, config: SesConfig): Promise<SesSendResult> {
  // Build SES SendEmail request body
  const formParams = new URLSearchParams();
  formParams.append('Action', 'SendEmail');
  formParams.append('Source', params.fromEmail);
  formParams.append('Destination.ToAddresses.member.1', params.to);
  formParams.append('Message.Subject.Data', params.subject);
  formParams.append('Message.Subject.Charset', 'UTF-8');
  formParams.append('Message.Body.Text.Data', params.bodyText);
  formParams.append('Message.Body.Text.Charset', 'UTF-8');
  formParams.append('Message.Body.Html.Data', params.bodyHtml);
  formParams.append('Message.Body.Html.Charset', 'UTF-8');
  formParams.append('Version', '2010-12-01');

  const endpoint = `https://email.${config.region}.amazonaws.com/`;
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

  // AWS Signature Version 4
  const body = formParams.toString();
  const bodyHash = await sha256Hex(body);

  const canonicalHeaders = [
    `content-type:application/x-www-form-urlencoded`,
    `host:email.${config.region}.amazonaws.com`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';

  const signedHeaders = 'content-type;host;x-amz-date';

  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${config.region}/ses/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSignatureKey(config.secretAccessKey, dateStamp, config.region, 'ses');
  const signature = await hmacHex(signingKey, stringToSign);

  const authHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Amz-Date': amzDate,
        'Authorization': authHeader,
      },
      body,
    });

    const responseText = await response.text();

    if (!response.ok) {
      const errorMatch = responseText.match(/<Message>(.*?)<\/Message>/);
      const errorMsg = errorMatch ? errorMatch[1] : `HTTP ${response.status}`;
      return { messageId: '', success: false, error: errorMsg };
    }

    // Extract MessageId from XML response
    const messageIdMatch = responseText.match(/<MessageId>(.*?)<\/MessageId>/);
    const messageId = messageIdMatch ? messageIdMatch[1] : '';

    return { messageId, success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown SES error';
    return { messageId: '', success: false, error: errorMsg };
  }
}

// ---------------------------------------------------------------------------
// AWS Signature V4 Crypto Helpers (using Node.js built-in crypto)
// ---------------------------------------------------------------------------

async function sha256Hex(data: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

async function hmac(key: Buffer | string, data: string): Promise<Buffer> {
  const { createHmac } = await import('node:crypto');
  const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'utf8') : key;
  return Buffer.from(createHmac('sha256', keyBuffer).update(data, 'utf8').digest());
}

async function hmacHex(key: Buffer | string, data: string): Promise<string> {
  const { createHmac } = await import('node:crypto');
  const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'utf8') : key;
  return createHmac('sha256', keyBuffer).update(data, 'utf8').digest('hex');
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<Buffer> {
  const kDate = await hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  return kSigning;
}

// ---------------------------------------------------------------------------
// Public API: Send CPRA Email
// ---------------------------------------------------------------------------

export interface SendEmailInput {
  toEmail: string;
  agencyName: string;
  trackingId: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId: string;
  error?: string;
}

/**
 * Send a CPRA policy request email to a law enforcement agency.
 */
export async function sendCpraEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = getSesConfig();

  const templateVars: CpraTemplateVars = {
    agencyName: input.agencyName,
    trackingId: input.trackingId,
    contactEmail: config.fromEmail,
  };

  const subject = getCpraSubject(templateVars);
  const bodyText = getCpraBody(templateVars);
  const bodyHtml = getCpraBodyHtml(templateVars);

  const result = await sendViaSes(
    {
      to: input.toEmail,
      subject,
      bodyText,
      bodyHtml,
      fromEmail: config.fromEmail,
    },
    config
  );

  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  };
}
