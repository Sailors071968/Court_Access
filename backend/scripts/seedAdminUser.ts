// ============================================================================
// Seed Admin User — Create or reset the admin account
// Run: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx backend/scripts/seedAdminUser.ts
// ============================================================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 12;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';
const ADMIN_ROLE = 'admin';

async function seedAdminUser(): Promise<void> {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('[Seed] ERROR: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    console.error('[Seed] Usage: ADMIN_EMAIL=user@example.com ADMIN_PASSWORD=yourpassword npx tsx backend/scripts/seedAdminUser.ts');
    process.exit(1);
  }

  if (ADMIN_PASSWORD.length < 8) {
    console.error('[Seed] ERROR: Password must be at least 8 characters.');
    process.exit(1);
  }

  console.log(`[Seed] Seeding admin user: ${ADMIN_EMAIL}`);
  console.log('[Seed] Hashing password with bcrypt...');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    console.log(`[Seed] User ${ADMIN_EMAIL} already exists (id=${existing.id}). Updating password...`);
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: ADMIN_ROLE },
    });
    console.log(`[Seed] Password updated for ${ADMIN_EMAIL}`);
  } else {
    const tenantId = `tenant-${crypto.randomUUID()}`;
    const now = new Date();

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          passwordHash,
          role: ADMIN_ROLE,
          tenantId,
        },
      });

      await tx.subscription.create({
        data: {
          userId: created.id,
          planId: 'FREE',
          activatedAt: now,
          billingPeriodStart: now,
          billingPeriodEnd: new Date(now.getFullYear() + 100, 0, 1),
          subscriptionStatus: 'active',
          subscriptionTier: 'free',
        },
      });

      await tx.aiCreditBalance.create({
        data: {
          userId: created.id,
          monthlyCredits: 0,
          purchasedCredits: 0,
          creditsUsed: 0,
          billingPeriodStart: now,
          billingPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      });

      return created;
    });

    console.log(`[Seed] Created admin user: ${ADMIN_EMAIL} (id=${user.id}, tenant=${tenantId})`);
  }

  // Verify the password works
  const verifyUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (verifyUser) {
    const valid = await bcrypt.compare(ADMIN_PASSWORD, verifyUser.passwordHash);
    console.log(`[Seed] Verification: bcrypt.compare(password, storedHash) = ${valid}`);
    console.log(`[Seed] Hash starts with: ${verifyUser.passwordHash.substring(0, 7)}`);
    if (!valid) {
      console.error('[Seed] ERROR: Password verification FAILED. Something is wrong.');
      process.exit(1);
    }
  }

  console.log('[Seed] Done. Admin user is ready.');
}

seedAdminUser()
  .catch((err) => {
    console.error('[Seed] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
