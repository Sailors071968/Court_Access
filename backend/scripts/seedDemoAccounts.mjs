// Program 137 — seed the provided test accounts + People v. Jordan Rivera case.
// Idempotent: upserts users by email and the case by (tenantId, caseNumber).
import { PrismaClient } from '../node_modules/@prisma/client/index.js';
import bcrypt from '../node_modules/bcrypt/bcrypt.js';

const prisma = new PrismaClient();
const TENANT = 'tenant-cd6731b6-b111-4315-a36a-480deebefb50';
const PASSWORD = 'TestPass123!';

const ACCOUNTS = [
  { email: 'attorney2@courtaccess.test', name: 'Demo Attorney', role: 'attorney', personnelType: 'attorney' },
  { email: 'investigator2@courtaccess.test', name: 'Demo Investigator', role: 'investigator', personnelType: 'investigator' },
  { email: 'defendant2@courtaccess.test', name: 'Demo Defendant', role: 'defendant', personnelType: null },
  { email: 'paralegal2@courtaccess.test', name: 'Demo Paralegal', role: 'staff', personnelType: 'paralegal' },
  { email: 'legalassistant@courtaccess.test', name: 'Demo Legal Assistant', role: 'staff', personnelType: 'legal_assistant' },
  { email: 'officeadmin@courtaccess.test', name: 'Demo Office Administrator', role: 'admin', personnelType: 'office_admin' },
  { email: 'admin@courtaccess.test', name: 'Demo Administrator', role: 'admin', personnelType: 'office_admin' },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const now = new Date();
  let attorneyId = null;
  for (const a of ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: { passwordHash, role: a.role, tenantId: TENANT, name: a.name, emailVerifiedAt: now, termsAcceptedAt: now, privacyAcceptedAt: now },
      create: { email: a.email, name: a.name, passwordHash, role: a.role, tenantId: TENANT, emailVerifiedAt: now, termsAcceptedAt: now, privacyAcceptedAt: now },
    });
    if (a.role === 'attorney') attorneyId = user.id;
    // Trial subscription so the app's paywall admits the account.
    const end = new Date(now.getTime() + 30 * 864e5);
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: { subscriptionStatus: 'trialing', subscriptionTier: 'trial', planId: 'TRIAL', billingPeriodEnd: end, trialEndsAt: end },
      create: { userId: user.id, planId: 'TRIAL', subscriptionStatus: 'trialing', subscriptionTier: 'trial', billingPeriodStart: now, billingPeriodEnd: end, trialEndsAt: end },
    });
    // Active organization membership so resource-access guards admit the user.
    if (a.role !== 'defendant') {
      const existingMember = await prisma.organizationMember.findFirst({ where: { organizationId: TENANT, userId: user.id } });
      if (existingMember) {
        await prisma.organizationMember.update({ where: { memberId: existingMember.memberId }, data: { role: a.role, status: 'active', personnelType: a.personnelType ?? undefined } });
      } else {
        await prisma.organizationMember.create({ data: { organizationId: TENANT, userId: user.id, role: a.role, status: 'active', personnelType: a.personnelType ?? undefined } });
      }
    }
    console.log(`upserted ${a.email} (${a.role}) + trial subscription + membership`);
  }

  const existing = await prisma.criminalCase.findFirst({ where: { tenantId: TENANT, caseNumber: 'CR-2026-04821' } });
  let caseId;
  if (existing) {
    caseId = existing.caseId;
    console.log(`case exists: ${caseId}`);
  } else {
    const c = await prisma.criminalCase.create({
      data: {
        tenantId: TENANT,
        ownerId: attorneyId ?? 'system',
        title: 'People v. Jordan Rivera',
        caseNumber: 'CR-2026-04821',
        jurisdiction: 'Los Angeles County',
        caseType: 'felony',
        status: 'active',
        phase: 'pretrial',
        court: 'Los Angeles County',
      },
    });
    caseId = c.caseId;
    console.log(`created case: ${caseId}`);
    await prisma.charge.createMany({
      data: [
        { caseId, code: 'PEN', section: '459', title: 'Burglary', victim: 'UNKNOWN' },
        { caseId, code: 'PEN', section: '211', title: 'Robbery', victim: 'UNKNOWN' },
      ],
    });
    console.log('created charges PEN 459, PEN 211');
  }
  console.log(`CASE_ID=${caseId}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
