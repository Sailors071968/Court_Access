// ============================================
// Court Access — Agency Seed Script
// Populates the Agency table with California law enforcement agencies.
// Usage: npx tsx src/policy/agencyDirectory/agencySeeder.ts
// ============================================

import { PrismaClient } from '@prisma/client';
import { allCaliforniaAgencies } from './californiaAgencies.js';

const prisma = new PrismaClient();

async function seedAgencies(): Promise<void> {
  console.log(`\n--- CourtAccess Agency Seeder ---`);
  console.log(`Agencies to seed: ${allCaliforniaAgencies.length}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const agency of allCaliforniaAgencies) {
    try {
      await prisma.agency.upsert({
        where: {
          agencyName_county: {
            agencyName: agency.agencyName,
            county: agency.county,
          },
        },
        update: {
          agencyType: agency.agencyType,
          city: agency.city ?? null,
          recordsEmail: agency.recordsEmail ?? null,
          recordsRequestUrl: agency.recordsRequestUrl ?? null,
          phoneNumber: agency.phoneNumber ?? null,
          website: agency.website ?? null,
          policyUrl: agency.policyUrl ?? null,
        },
        create: {
          agencyName: agency.agencyName,
          agencyType: agency.agencyType,
          county: agency.county,
          city: agency.city ?? null,
          recordsEmail: agency.recordsEmail ?? null,
          recordsRequestUrl: agency.recordsRequestUrl ?? null,
          phoneNumber: agency.phoneNumber ?? null,
          website: agency.website ?? null,
          policyUrl: agency.policyUrl ?? null,
        },
      });
      created++;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      // If duplicate (unique constraint), count as skipped
      if (msg.includes('Unique constraint')) {
        skipped++;
      } else {
        failed++;
        console.error(`  FAIL: ${agency.agencyName} (${agency.county}) — ${msg}`);
      }
    }
  }

  const total = await prisma.agency.count();

  console.log(`\n--- Seed Complete ---`);
  console.log(`  Created/Updated: ${created}`);
  console.log(`  Skipped (dup):   ${skipped}`);
  console.log(`  Failed:          ${failed}`);
  console.log(`  Total in DB:     ${total}`);
  console.log(`---\n`);
}

seedAgencies()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
