// Program 137 — seed the provided test accounts + People v. Jordan Rivera case.
// Idempotent: upserts users by email and the case by (tenantId, caseNumber).
import { PrismaClient } from '../node_modules/@prisma/client/index.js';
import bcrypt from '../node_modules/bcrypt/bcrypt.js';

const prisma = new PrismaClient();
const TENANT = 'tenant-cd6731b6-b111-4315-a36a-480deebefb50';
const PASSWORD = 'TestPass123!';

const ACCOUNTS = [
  { email: 'attorney2@courtaccess.test', name: 'Demo Attorney', role: 'attorney' },
  { email: 'investigator2@courtaccess.test', name: 'Demo Investigator', role: 'investigator' },
  { email: 'defendant2@courtaccess.test', name: 'Demo Defendant', role: 'defendant' },
  { email: 'paralegal2@courtaccess.test', name: 'Demo Paralegal', role: 'staff' },
  { email: 'legalassistant@courtaccess.test', name: 'Demo Legal Assistant', role: 'staff' },
  { email: 'officeadmin@courtaccess.test', name: 'Demo Office Administrator', role: 'admin' },
  { email: 'admin@courtaccess.test', name: 'Demo Administrator', role: 'admin' },
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
    console.log(`upserted ${a.email} (${a.role})`);
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
