// ============================================================================
// Phase 2 — Clean Test/Mock Data from Database
// Removes demo users, test cases, mock emails, simulation data.
// Run: npx tsx backend/scripts/cleanTestData.ts
// IMPORTANT: Run BEFORE production deployment. Creates backup counts first.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CleanupResult {
  table: string;
  deleted: number;
  criteria: string;
}

async function cleanTestData(): Promise<void> {
  console.log('='.repeat(70));
  console.log('Phase 2 — Test Data Cleanup');
  console.log('='.repeat(70));

  const results: CleanupResult[] = [];

  // --- Step 1: Audit current data ---
  console.log('\n[Step 1] Auditing current data...');

  const emailCount = await prisma.cpraEmailLog.count();
  const attachmentCount = await prisma.cpraEmailAttachment.count();
  const notificationCount = await prisma.cpraNotification.count();
  const timelineCount = await prisma.cpraTimelineEvent.count();

  console.log(`  CpraEmailLog: ${emailCount} records`);
  console.log(`  CpraEmailAttachment: ${attachmentCount} records`);
  console.log(`  CpraNotification: ${notificationCount} records`);
  console.log(`  CpraTimelineEvent: ${timelineCount} records`);

  // --- Step 1b: Delete demo user accounts ---
  console.log('\n[Step 1b] Cleaning demo user accounts...');

  try {
    const demoUsers = await prisma.$executeRawUnsafe(`
      DELETE FROM "users"
      WHERE email LIKE 'demo%'
        OR email LIKE 'test%'
        OR email LIKE '%@example.com'
        OR email LIKE '%@test.com'
        OR email LIKE '%@demo.%'
        OR email IN (
          'admin@courtaccess.com',
          'attorney@courtaccess.com',
          'investigator@courtaccess.com',
          'expert@courtaccess.com',
          'defendant@courtaccess.com',
          'staff@courtaccess.com'
        )
    `);
    results.push({ table: 'users', deleted: demoUsers, criteria: 'demo/test/example accounts + known demo emails' });
    console.log(`  Deleted ${demoUsers} demo user accounts`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Table may not exist yet in some environments
    if (msg.includes('does not exist') || msg.includes('relation')) {
      console.log('  [Info] users table not found — skipping demo user cleanup');
    } else {
      console.error(`  [Warning] Could not clean demo users: ${msg}`);
    }
  }

  // --- Step 2: Delete test CPRA simulation data ---
  console.log('\n[Step 2] Cleaning CPRA simulation data...');

  // Delete attachments linked to test emails first (FK constraint)
  const testAttachments = await prisma.cpraEmailAttachment.deleteMany({
    where: {
      Email: {
        OR: [
          { fromAddress: { contains: 'test' } },
          { fromAddress: { contains: 'simulation' } },
          { fromAddress: { contains: 'demo' } },
          { subject: { contains: '[SIMULATION]' } },
          { subject: { contains: '[TEST]' } },
        ],
      },
    },
  });
  results.push({ table: 'CpraEmailAttachment', deleted: testAttachments.count, criteria: 'test/simulation/demo emails' });

  // Delete test email logs
  const testEmails = await prisma.cpraEmailLog.deleteMany({
    where: {
      OR: [
        { fromAddress: { contains: 'test' } },
        { fromAddress: { contains: 'simulation' } },
        { fromAddress: { contains: 'demo' } },
        { subject: { contains: '[SIMULATION]' } },
        { subject: { contains: '[TEST]' } },
        { emailAddress: { contains: '@example.com' } },
        { emailAddress: { contains: '@test.com' } },
      ],
    },
  });
  results.push({ table: 'CpraEmailLog', deleted: testEmails.count, criteria: 'test/simulation/demo/example addresses' });

  // Delete test notifications
  const testNotifications = await prisma.cpraNotification.deleteMany({
    where: {
      OR: [
        { title: { contains: '[TEST]' } },
        { title: { contains: '[SIMULATION]' } },
        { title: { contains: 'Simulated' } },
        { message: { contains: 'simulation' } },
      ],
    },
  });
  results.push({ table: 'CpraNotification', deleted: testNotifications.count, criteria: 'test/simulation notifications' });

  // Delete test timeline events
  const testTimeline = await prisma.cpraTimelineEvent.deleteMany({
    where: {
      OR: [
        { title: { contains: '[TEST]' } },
        { title: { contains: '[SIMULATION]' } },
        { title: { contains: 'Simulated' } },
        { description: { contains: 'simulation' } },
      ],
    },
  });
  results.push({ table: 'CpraTimelineEvent', deleted: testTimeline.count, criteria: 'test/simulation timeline events' });

  // --- Step 3: Summary ---
  console.log('\n[Step 3] Cleanup Summary');
  console.log('-'.repeat(70));
  console.log(`${'Table'.padEnd(30)} ${'Deleted'.padEnd(10)} Criteria`);
  console.log('-'.repeat(70));
  for (const r of results) {
    console.log(`${r.table.padEnd(30)} ${String(r.deleted).padEnd(10)} ${r.criteria}`);
  }
  console.log('-'.repeat(70));

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  console.log(`Total records cleaned: ${totalDeleted}`);

  // --- Step 4: Post-cleanup audit ---
  console.log('\n[Step 4] Post-cleanup audit...');
  const postEmailCount = await prisma.cpraEmailLog.count();
  const postAttachmentCount = await prisma.cpraEmailAttachment.count();
  const postNotificationCount = await prisma.cpraNotification.count();
  const postTimelineCount = await prisma.cpraTimelineEvent.count();

  console.log(`  CpraEmailLog: ${postEmailCount} records (was ${emailCount})`);
  console.log(`  CpraEmailAttachment: ${postAttachmentCount} records (was ${attachmentCount})`);
  console.log(`  CpraNotification: ${postNotificationCount} records (was ${notificationCount})`);
  console.log(`  CpraTimelineEvent: ${postTimelineCount} records (was ${timelineCount})`);

  console.log('\n[Done] Test data cleanup complete.');
}

// Run
cleanTestData()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Error] Cleanup failed:', err);
    process.exit(1);
  });
