// ============================================================================
// Program 1 — Identity Extensions
// Email verification, MFA (TOTP), device/session management
// ============================================================================

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { FastifyRequest } from 'fastify';
import prisma from '../lib/prisma.js';
import { logSecurityEvent } from './authMiddleware.js';
import type { UserRole } from './authMiddleware.js';

const MFA_SESSION_EXPIRY = '5m';
const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000;
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

const MFA_JWT_SECRET = process.env.MFA_JWT_SECRET || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'court-access-mfa-key-change-in-production';

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(MFA_ENCRYPTION_KEY).digest();
}

export function encryptMfaSecret(secret: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptMfaSecret(encrypted: string): string {
  const [ivHex, dataHex] = encrypted.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

export function generateMfaSecret(): string {
  // Base32 secret for TOTP (RFC 4648)
  const bytes = crypto.randomBytes(20);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output.slice(0, 32);
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpCode(secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / TOTP_STEP_SECONDS);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const normalized = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const now = Date.now();
  for (const drift of [-1, 0, 1]) {
    if (generateTotpCode(secret, now + drift * TOTP_STEP_SECONDS * 1000) === normalized) return true;
  }
  return false;
}

export function buildOtpAuthUri(email: string, secret: string): string {
  const issuer = encodeURIComponent('CourtAccess');
  const label = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

export function createMfaSessionToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'mfa_challenge' }, MFA_JWT_SECRET, { expiresIn: MFA_SESSION_EXPIRY });
}

export function verifyMfaSessionToken(token: string): { userId: string } {
  const payload = jwt.verify(token, MFA_JWT_SECRET) as { userId: string; purpose: string };
  if (payload.purpose !== 'mfa_challenge') throw new Error('Invalid MFA session');
  return { userId: payload.userId };
}

export function parseDeviceLabel(userAgent?: string): string {
  if (!userAgent) return 'Unknown device';
  if (userAgent.includes('Mobile')) return 'Mobile browser';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  return 'Web browser';
}

export interface DeviceContext {
  userAgent?: string;
  ipAddress?: string;
  deviceLabel?: string;
}

export function extractDeviceContext(request: FastifyRequest): DeviceContext {
  const userAgent = request.headers['user-agent'];
  return {
    userAgent,
    ipAddress: request.ip,
    deviceLabel: parseDeviceLabel(userAgent),
  };
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS),
    },
  });
  return rawToken;
}

export async function verifyEmailToken(rawToken: string): Promise<{ userId: string; email: string } | null> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const record = await prisma.emailVerificationToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!record) return null;

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  return { userId: record.userId, email: record.user.email };
}

export async function sendVerificationEmail(email: string, rawToken: string, ip?: string): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'https://courtaccess.net';
  const verifyUrl = `${frontendUrl}/verify-email?token=${rawToken}`;

  try {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    const ses = new SESClient({
      region: process.env.AWS_REGION ?? 'us-west-2',
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '' }
        : undefined,
    });
    const senderEmail = process.env.PASSWORD_RESET_FROM_EMAIL || process.env.CPRA_SENDER_EMAIL || 'noreply@courtaccess.net';
    await ses.send(new SendEmailCommand({
      Source: senderEmail,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: 'Court Access — Verify your email', Charset: 'UTF-8' },
        Body: {
          Html: {
            Data: `<p>Please verify your Court Access account by clicking <a href="${verifyUrl}">this link</a>. Link expires in 24 hours.</p>`,
            Charset: 'UTF-8',
          },
        },
      },
    }));
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Identity] VERIFY URL for ${email}: ${verifyUrl}`);
    }
  }

  void logSecurityEvent('EMAIL_VERIFICATION_SENT', undefined, ip, email);
}

export async function listUserSessions(userId: string) {
  const sessions = await prisma.refreshToken.findMany({
    where: { userId, revoked: false, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true,
      deviceLabel: true,
      userAgent: true,
      ipAddress: true,
      lastSeenAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });
  return sessions;
}

export async function revokeUserSession(userId: string, sessionId: string): Promise<boolean> {
  const result = await prisma.refreshToken.updateMany({
    where: { id: sessionId, userId, revoked: false },
    data: { revoked: true },
  });
  return result.count > 0;
}

export async function touchRefreshTokenSession(token: string, device: DeviceContext): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token, revoked: false },
    data: {
      lastSeenAt: new Date(),
      userAgent: device.userAgent,
      ipAddress: device.ipAddress,
      deviceLabel: device.deviceLabel,
    },
  }).catch(() => undefined);
}

export async function createRefreshTokenWithDevice(
  createFn: (payload: { userId: string; tenantId: string; email: string; role: UserRole }) => Promise<string>,
  payload: { userId: string; tenantId: string; email: string; role: UserRole },
  device: DeviceContext,
): Promise<string> {
  const token = await createFn(payload);
  await touchRefreshTokenSession(token, device);
  return token;
}
