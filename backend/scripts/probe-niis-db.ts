import prisma from '../src/lib/prisma.js';

async function q<T = unknown>(sql: string): Promise<T> {
  return prisma.$queryRawUnsafe(sql) as Promise<T>;
}

async function main() {
  const cols = await q<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'inmate_roster_uploads' ORDER BY ordinal_position`,
  );
  console.log('upload cols', cols.map((c) => c.column_name).join(', '));

  const uploads = await q(
    `SELECT "uploadId","originalName",status,stage,facility,"rosterDate","uploadedAt","batchId",left("sha256",16) as sha
     FROM inmate_roster_uploads ORDER BY "uploadedAt" DESC LIMIT 15`,
  );
  console.log('uploads', JSON.stringify(uploads, null, 2));

  const jobs = await q(
    `SELECT "jobId",status,facility,"rosterDate","createdAt","autoProcess","filesUploaded","filesCompleted","filesUploading","currentFilename","failureReason"
     FROM inmate_import_jobs ORDER BY "createdAt" DESC LIMIT 10`,
  );
  console.log('jobs', JSON.stringify(jobs, null, 2));

  const files = await q(
    `SELECT "jobFileId","jobId","originalName",status,"uploadId",error
     FROM inmate_import_job_files ORDER BY "createdAt" DESC LIMIT 15`,
  );
  console.log('jobFiles', JSON.stringify(files, null, 2));

  const batches = await q(
    `SELECT "batchId",status,"sourceFilename","rosterDate","recordsTotal","recordsNew","finishedAt",facility
     FROM inmate_ingestion_batches ORDER BY "startedAt" DESC LIMIT 10`,
  );
  console.log('batches', JSON.stringify(batches, null, 2));

  try {
    const daily = await q(
      `SELECT "caseId",facility,"opsDate",status,"newInmateCount","currentPdfBatchId","priorPdfBatchId"
       FROM inmate_daily_cases ORDER BY "opsDate" DESC LIMIT 10`,
    );
    console.log('daily', JSON.stringify(daily, null, 2));
  } catch (e) {
    console.log('daily err', e instanceof Error ? e.message : e);
  }

  const first = await q(
    `SELECT b."bookedAt", i."canonicalLast", i."identityConfidence", b.facility
     FROM inmate_bookings b JOIN inmates i ON i."inmateId"=b."inmateId"
     WHERE b."isFirstAppearance"=true ORDER BY b."bookedAt" DESC LIMIT 10`,
  );
  console.log('firstApp', JSON.stringify(first, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
