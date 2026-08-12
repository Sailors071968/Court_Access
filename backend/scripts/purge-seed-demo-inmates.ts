/**
 * Permanently delete seeded/demo/fixture operational inmate data from a database.
 *
 * Production must never contain fake inmates. This does NOT hide rows — it deletes them.
 *
 * Usage:
 *   npx tsx scripts/purge-seed-demo-inmates.ts --confirm
 *   npx tsx scripts/purge-seed-demo-inmates.ts --confirm --facility sacramento
 *
 * Dry-run (default): prints what would be deleted.
 */
import prisma from '../src/lib/prisma.js';

const CONFIRM = process.argv.includes('--confirm');
const facilityArg = process.argv.indexOf('--facility');
const facility = facilityArg >= 0 ? process.argv[facilityArg + 1] : null;

/** Known seed/demo surnames from verify-*.ts and fixtures/sacramento/*.csv */
const SEED_SURNAMES = [
  'NGUYEN', 'BAKER', 'SILVA', 'OKAFOR', 'SMITH', 'WASHINGTON',
  'GARCIALOPEZ', 'GARCIA', 'OBRIEN', 'BROWN', 'PATEL', 'WILLIAMS',
  'JONES', 'MARTINEZ', 'ANDERSON', 'TAYLOR', 'THOMAS', 'JACKSON',
  'WHITE', 'HARRIS', 'MARTIN', 'THOMPSON', 'MOORE', 'YOUNG',
  'ALLEN', 'KING', 'WRIGHT', 'SCOTT', 'TORRES', 'NGUYENBINH',
];

/** Source filenames that identify fixture imports */
const SEED_FILENAMES = [
  'ops-day2.csv',
  'good.csv',
  'sacramento-roster-2026-08-08.csv',
  'sacramento-roster-2026-08-09.csv',
  'sacramento-roster-2026-08-09-again.csv',
  'sacramento-new-format-export.csv',
  'roster-2026-08-09-prior.csv',
  'roster-2026-08-10.csv',
  'roster-2026-08-10.pdf',
];

async function main() {
  const batchWhere = {
    OR: [
      ...SEED_FILENAMES.map((f) => ({ sourceFilename: f })),
      ...SEED_FILENAMES.map((f) => ({ sourceFilename: { contains: f } })),
      { sourceFilename: { startsWith: 'ops-' } },
      { sourceFilename: { startsWith: 'good' } },
      { sourceFilename: { contains: 'fixture' } },
      { sourceFilename: { contains: 'demo' } },
      { sourceFilename: { contains: 'seed' } },
    ],
    ...(facility ? { facility } : {}),
  };

  const seedBatches = await prisma.inmateIngestionBatch.findMany({
    where: batchWhere,
    select: { batchId: true, sourceFilename: true, facility: true, recordsTotal: true },
  });

  const seedInmates = await prisma.inmate.findMany({
    where: {
      canonicalLast: { in: SEED_SURNAMES },
      ...(facility
        ? { bookings: { some: { facility } } }
        : {}),
    },
    select: {
      inmateId: true,
      canonicalLast: true,
      canonicalFirst: true,
      bookingCount: true,
    },
  });

  const seedUploads = await prisma.inmateRosterUpload.findMany({
    where: {
      OR: SEED_FILENAMES.map((f) => ({ originalName: f })),
      ...(facility ? { facility } : {}),
    },
    select: { uploadId: true, originalName: true, status: true },
  });

  const report = {
    mode: CONFIRM ? 'DELETE' : 'DRY_RUN',
    database: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? 'unknown',
    at: new Date().toISOString(),
    wouldDelete: {
      batches: seedBatches.length,
      batchFiles: seedBatches.map((b) => b.sourceFilename),
      inmates: seedInmates.length,
      inmateNames: seedInmates.map((i) => `${i.canonicalLast}, ${i.canonicalFirst}`),
      uploads: seedUploads.length,
      uploadNames: seedUploads.map((u) => u.originalName),
    },
  };
  console.log(JSON.stringify(report, null, 2));

  if (!CONFIRM) {
    console.error('Dry-run only. Re-run with --confirm to permanently delete.');
    return;
  }

  const batchIds = seedBatches.map((b) => b.batchId);
  const inmateIds = seedInmates.map((i) => i.inmateId);
  const uploadIds = seedUploads.map((u) => u.uploadId);

  // Order: dependent rows first. Each step is best-effort (schema varies by DB).
  const soft = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      console.error(`skip ${label}:`, e instanceof Error ? e.message : e);
    }
  };

  if (batchIds.length) {
    await soft('observations', () => prisma.inmateBookingObservation.deleteMany({
      where: { booking: { sourceBatchId: { in: batchIds } } },
    }));
    await soft('charges', () => prisma.inmateBookingCharge.deleteMany({
      where: { booking: { sourceBatchId: { in: batchIds } } },
    }));
    await soft('changeEvents', () => prisma.inmateChangeEvent.deleteMany({
      where: { batchId: { in: batchIds } },
    }));
    await soft('watchMatches', () => prisma.inmateWatchListMatch.deleteMany({
      where: { batchId: { in: batchIds } },
    }));
    await soft('ingestionRecords', () => prisma.inmateIngestionRecord.deleteMany({
      where: { batchId: { in: batchIds } },
    }));
    await soft('bookings-by-batch', () => prisma.inmateBooking.deleteMany({
      where: { sourceBatchId: { in: batchIds } },
    }));
  }

  if (inmateIds.length) {
    await soft('bookings-by-inmate', () => prisma.inmateBooking.deleteMany({
      where: { inmateId: { in: inmateIds } },
    }));
    await soft('aliases', () => prisma.inmateAlias.deleteMany({
      where: { inmateId: { in: inmateIds } },
    }));
    await soft('inmates', () => prisma.inmate.deleteMany({
      where: { inmateId: { in: inmateIds } },
    }));
  }

  if (batchIds.length) {
    await soft('batches', () => prisma.inmateIngestionBatch.deleteMany({
      where: { batchId: { in: batchIds } },
    }));
  }

  if (uploadIds.length) {
    await soft('uploads', () => prisma.inmateRosterUpload.deleteMany({
      where: { uploadId: { in: uploadIds } },
    }));
  }

  console.log(JSON.stringify({
    deleted: true,
    batches: batchIds.length,
    inmates: inmateIds.length,
    uploads: uploadIds.length,
    at: new Date().toISOString(),
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
