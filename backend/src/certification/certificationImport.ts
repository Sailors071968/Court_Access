// ============================================================================
// Gold Standard certification import.
//
// Takes a directory of real discovery, exactly as counsel delivered it, and
// brings it into the platform through the same ingestion function customers
// use. Three properties matter:
//
//   the originals are never modified — files are copied, never moved, and the
//   source directory is only ever read
//
//   the delivery is preserved — folder hierarchy, filenames and modification
//   times are recorded so a citation can be traced back to the file as served
//
//   nothing is silently dropped — every file is accounted for, including the
//   ones that fail, with the reason
// ============================================================================

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import prisma from '../lib/prisma.js';
import { ingestEvidence } from '../evidence/evidenceDirectUpload.js';
import { classifyDocument, evidenceTypeFor, type DocumentClass } from './documentClassifier.js';
import { listZipEntries, readZipEntry } from '../evidence/fileDiagnostics.js';
import { measure } from './mediaProbe.js';

/** Directories that are packaging noise rather than discovery. */
const SKIP_DIRS = new Set(['__MACOSX', '.git', 'node_modules', '.DS_Store']);
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/** Called as each file is handled so a live dashboard can follow along. */
export type ProgressReporter = (update: {
  stage: string;
  detail?: string;
  current?: number;
  total?: number;
}) => void | Promise<void>;

export interface ImportOptions {
  reference: string;
  label: string;
  description?: string;
  sourceDirectory: string;
  user: { userId: string; tenantId: string };
  /** Existing case to import into; one is created when omitted. */
  caseId?: string;
  /** Expand ZIP archives into their members. */
  expandArchives?: boolean;
  /** Walk the tree without importing, to preview what would happen. */
  dryRun?: boolean;
  /** Progress callback for the live dashboard. */
  onProgress?: ProgressReporter;
}

export interface DiscoveredFile {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: Date | null;
  /** Set when the file came out of an archive rather than off disk. */
  extractedFromArchive?: string;
}

async function sha256OfFile(absolutePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(absolutePath);
    stream.on('data', (c) => hash.update(c));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Walk the delivery. Archives are expanded into a scratch directory so their
 * members are inventoried individually; the archive itself is left untouched.
 */
export async function discoverFiles(
  root: string,
  options: { expandArchives?: boolean; scratchDir?: string } = {},
): Promise<{ files: DiscoveredFile[]; warnings: string[] }> {
  const files: DiscoveredFile[] = [];
  const warnings: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      warnings.push(`Could not read folder "${path.relative(root, dir) || '.'}": ${(err as Error).message}`);
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name) || SKIP_FILES.has(entry.name)) continue;
      // Hidden directories are never delivered discovery; they are scratch and
      // system artefacts, and importing them would put files in the corpus
      // that counsel never sent.
      if (entry.isDirectory() && entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;

      let stat;
      try {
        stat = await fs.stat(abs);
      } catch (err) {
        warnings.push(`Could not read "${path.relative(root, abs)}": ${(err as Error).message}`);
        continue;
      }

      const relativePath = path.relative(root, abs);
      const extension = (entry.name.split('.').pop() ?? '').toLowerCase();

      if (options.expandArchives && extension === 'zip' && options.scratchDir) {
        const expanded = await expandArchive(abs, relativePath, options.scratchDir, warnings);
        files.push(...expanded);
        // The archive is still recorded, so the inventory reflects what arrived.
      }

      files.push({
        absolutePath: abs,
        relativePath,
        fileName: entry.name,
        extension,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime ?? null,
      });
    }
  }

  await walk(root);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return { files, warnings };
}

async function expandArchive(
  archivePath: string,
  archiveRelative: string,
  scratchDir: string,
  warnings: string[],
): Promise<DiscoveredFile[]> {
  const out: DiscoveredFile[] = [];
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(archivePath);
  } catch (err) {
    warnings.push(`Could not open archive "${archiveRelative}": ${(err as Error).message}`);
    return out;
  }

  const entries = listZipEntries(buffer).filter((e) => !e.name.endsWith('/'));
  if (entries.length === 0) {
    warnings.push(`Archive "${archiveRelative}" could not be read, or contains no files.`);
    return out;
  }

  const target = path.join(scratchDir, archiveRelative.replace(/[^A-Za-z0-9._-]/g, '_'));
  await fs.mkdir(target, { recursive: true });

  for (const entry of entries) {
    if (SKIP_FILES.has(path.basename(entry.name))) continue;
    if (entry.name.split('/').some((seg) => SKIP_DIRS.has(seg))) continue;

    const data = readZipEntry(buffer, entry);
    if (!data) {
      warnings.push(`Member "${entry.name}" of archive "${archiveRelative}" could not be decompressed.`);
      continue;
    }

    // Keep the archive's internal hierarchy, refusing any traversal in it.
    const safeName = entry.name.split('/').filter((s) => s && s !== '.' && s !== '..').join('/');
    const dest = path.join(target, safeName);
    if (!path.resolve(dest).startsWith(path.resolve(target) + path.sep)) {
      warnings.push(`Member "${entry.name}" of archive "${archiveRelative}" has an unsafe path and was skipped.`);
      continue;
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, data);

    out.push({
      absolutePath: dest,
      relativePath: `${archiveRelative}!/${safeName}`,
      fileName: path.basename(safeName),
      extension: (safeName.split('.').pop() ?? '').toLowerCase(),
      sizeBytes: data.length,
      modifiedAt: null,
      extractedFromArchive: archiveRelative,
    });
  }

  return out;
}

export interface ImportResult {
  certificationCaseId: string;
  reference: string;
  caseId: string;
  fileCount: number;
  ingested: number;
  duplicates: number;
  failed: number;
  totalBytes: number;
  corpusHash: string;
  warnings: string[];
}

/**
 * Import a certification corpus. Each file is hashed, deduplicated, ingested
 * through the production path, then classified from the text that ingestion
 * extracted.
 */
export async function importCertificationCase(options: ImportOptions): Promise<ImportResult> {
  const root = path.resolve(options.sourceDirectory);

  const stat = await fs.stat(root).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(
      `"${options.sourceDirectory}" is not a readable folder. Provide the folder containing the discovery as delivered.`,
    );
  }

  const scratchDir = path.join('/tmp', 'courtaccess-certification-scratch', options.reference);
  await fs.rm(scratchDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(scratchDir, { recursive: true });

  const report = async (stage: string, detail?: string, current?: number, total?: number) => {
    try {
      await options.onProgress?.({ stage, detail, current, total });
    } catch {
      // Never let progress reporting break the import.
    }
  };

  await report('Reading the delivery', 'Walking folders and expanding archives');

  const { files, warnings } = await discoverFiles(root, {
    expandArchives: options.expandArchives ?? true,
    scratchDir,
  });

  if (files.length === 0) {
    throw new Error(`No files were found under "${options.sourceDirectory}".`);
  }

  // The case the evidence lands in. Certification cases are ordinary cases so
  // that everything downstream behaves exactly as it does for a customer.
  let caseId = options.caseId;
  if (!caseId) {
    const created = await prisma.criminalCase.create({
      data: {
        tenantId: options.user.tenantId,
        ownerId: options.user.userId,
        title: options.label,
        caseNumber: `${options.reference}-${Date.now()}`,
        jurisdiction: 'Certification corpus',
        caseType: 'felony',
      },
    });
    caseId = created.caseId;
  }

  const certCase = await prisma.certificationCase.create({
    data: {
      reference: options.reference,
      label: options.label,
      description: options.description,
      sourceDirectory: root,
      caseId,
      tenantId: options.user.tenantId,
      importedById: options.user.userId,
      status: 'importing',
      fileCount: files.length,
      totalBytes: BigInt(files.reduce((sum, f) => sum + f.sizeBytes, 0)),
    },
  });

  const seenHashes = new Map<string, string>(); // sha256 -> certificationFileId
  const hashes: string[] = [];
  let ingested = 0;
  let duplicates = 0;
  let failed = 0;

  let processedCount = 0;
  for (const file of files) {
    processedCount++;
    await report('Ingesting discovery', file.relativePath, processedCount, files.length);

    let sha256: string;
    try {
      sha256 = await sha256OfFile(file.absolutePath);
    } catch (err) {
      failed++;
      warnings.push(`Could not hash "${file.relativePath}": ${(err as Error).message}`);
      await prisma.certificationFile.create({
        data: {
          certificationCaseId: certCase.certificationCaseId,
          relativePath: file.relativePath,
          fileName: file.fileName,
          extension: file.extension,
          sizeBytes: BigInt(file.sizeBytes),
          sha256: '',
          originalModifiedAt: file.modifiedAt,
          ingestStatus: 'failed',
          ingestMessage: `The file could not be read: ${(err as Error).message}`,
        },
      });
      continue;
    }
    hashes.push(sha256);

    const duplicateOf = seenHashes.get(sha256);

    const record = await prisma.certificationFile.create({
      data: {
        certificationCaseId: certCase.certificationCaseId,
        relativePath: file.relativePath,
        fileName: file.fileName,
        extension: file.extension,
        sizeBytes: BigInt(file.sizeBytes),
        sha256,
        originalModifiedAt: file.modifiedAt,
        duplicateOfFileId: duplicateOf ?? null,
        ingestStatus: 'pending',
      },
    });
    if (!duplicateOf) seenHashes.set(sha256, record.certificationFileId);

    if (options.dryRun) continue;

    if (duplicateOf) {
      duplicates++;
      await prisma.certificationFile.update({
        where: { certificationFileId: record.certificationFileId },
        data: {
          ingestStatus: 'skipped',
          ingestMessage:
            'Identical to a file already imported in this corpus (same SHA-256). ' +
            'It is recorded in the inventory but was not ingested a second time.',
        },
      });
      continue;
    }

    // The production ingestion path, unchanged.
    const provisionalType = evidenceTypeFor(
      classifyDocument({ fileName: file.fileName, relativePath: file.relativePath }).classification,
      file.fileName,
    );

    const result = await ingestEvidence({
      user: options.user,
      caseId,
      evidenceType: provisionalType,
      fileName: file.fileName,
      sourcePath: file.absolutePath,
      awaitProcessing: true,
    });

    if (!result.ok) {
      failed++;
      await prisma.certificationFile.update({
        where: { certificationFileId: record.certificationFileId },
        data: {
          ingestStatus: 'failed',
          ingestMessage: result.message ?? result.error ?? 'Ingestion failed.',
        },
      });
      continue;
    }

    ingested++;
    const evidenceId = result.evidence?.evidenceId as string;

    // Measure the file so the inventory can report pages and running time.
    const measured = await measure(file.absolutePath, file.fileName).catch(() => ({
      durationSeconds: null,
      pageCount: null,
      note: 'The file could not be measured.',
    }));

    // Classify from the text ingestion actually extracted, not from the name.
    const chunks = await prisma.evidenceChunk.findMany({
      where: { evidenceId },
      orderBy: { chunkIndex: 'asc' },
      take: 5,
      select: { text: true },
    });
    const extracted = chunks.map((c) => c.text).join('\n');

    const classification = classifyDocument({
      fileName: file.fileName,
      relativePath: file.relativePath,
      text: extracted,
      mimeType: result.evidence?.mimeType as string | null,
    });

    await prisma.certificationFile.update({
      where: { certificationFileId: record.certificationFileId },
      data: {
        evidenceId,
        mimeType: (result.evidence?.mimeType as string) ?? null,
        ingestStatus: 'ingested',
        ingestMessage: (result.evidence?.processingError as string) ?? null,
        classification: classification.classification,
        classificationConfidence: classification.confidence,
        classificationBasis: classification.basis,
        pageCount: measured.pageCount,
        durationSeconds: measured.durationSeconds,
        mediaProbeNote: measured.note,
      },
    });
  }

  await report('Fingerprinting the corpus', `${hashes.length} file hashes`, files.length, files.length);

  // Identifies the corpus itself, so a later run can prove it read the same
  // material.
  const corpusHash = createHash('sha256').update(hashes.sort().join('\n')).digest('hex');

  await prisma.certificationCase.update({
    where: { certificationCaseId: certCase.certificationCaseId },
    data: {
      status: failed > 0 && ingested === 0 ? 'failed' : 'imported',
      corpusHash,
      importCompletedAt: new Date(),
      importErrors: warnings.length ? warnings : undefined,
    },
  });

  return {
    certificationCaseId: certCase.certificationCaseId,
    reference: options.reference,
    caseId,
    fileCount: files.length,
    ingested,
    duplicates,
    failed,
    totalBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
    corpusHash,
    warnings,
  };
}

export interface InventorySummary {
  certificationCaseId: string;
  reference: string;
  label: string;
  status: string;
  caseId: string | null;
  corpusHash: string | null;
  importedAt: Date;
  totals: {
    files: number;
    bytes: number;
    documents: number;
    videos: number;
    audio: number;
    images: number;
    duplicates: number;
    ingested: number;
    failed: number;
    pages: number;
    videoSeconds: number;
    audioSeconds: number;
    /** Files whose duration or page count could not be determined. */
    unmeasured: number;
  };
  byExtension: Record<string, number>;
  byClassification: Record<string, number>;
  files: Array<{
    certificationFileId: string;
    relativePath: string;
    fileName: string;
    sizeBytes: string;
    sha256: string;
    originalModifiedAt: Date | null;
    classification: string;
    classificationConfidence: number;
    classificationBasis: string | null;
    pageCount: number | null;
    durationSeconds: number | null;
    mediaProbeNote: string | null;
    ingestStatus: string;
    ingestMessage: string | null;
    evidenceId: string | null;
    isDuplicate: boolean;
  }>;
}

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'bmp', 'webp']);
const VIDEO_EXT = new Set(['mp4', 'mov', 'avi', 'mkv', 'm4v', 'webm']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg']);

/** The full inventory of a corpus: what arrived, and what became of it. */
export async function buildInventory(certificationCaseId: string): Promise<InventorySummary | null> {
  const certCase = await prisma.certificationCase.findUnique({
    where: { certificationCaseId },
    include: { files: { orderBy: { relativePath: 'asc' } } },
  });
  if (!certCase) return null;

  const byExtension: Record<string, number> = {};
  const byClassification: Record<string, number> = {};
  let documents = 0;
  let videos = 0;
  let audio = 0;
  let images = 0;
  let duplicates = 0;
  let ingestedCount = 0;
  let failedCount = 0;
  let bytes = 0;
  let pages = 0;
  let videoSeconds = 0;
  let audioSeconds = 0;
  let unmeasured = 0;

  for (const f of certCase.files) {
    const ext = f.extension ?? 'none';
    byExtension[ext] = (byExtension[ext] ?? 0) + 1;
    byClassification[f.classification] = (byClassification[f.classification] ?? 0) + 1;
    bytes += Number(f.sizeBytes);

    if (VIDEO_EXT.has(ext)) {
      videos++;
      if (f.durationSeconds) videoSeconds += f.durationSeconds;
      else unmeasured++;
    } else if (AUDIO_EXT.has(ext)) {
      audio++;
      if (f.durationSeconds) audioSeconds += f.durationSeconds;
      else unmeasured++;
    } else if (IMAGE_EXT.has(ext)) {
      images++;
      pages += f.pageCount ?? 0;
    } else {
      documents++;
      if (f.pageCount) pages += f.pageCount;
      else if (f.ingestStatus === 'ingested') unmeasured++;
    }

    if (f.duplicateOfFileId) duplicates++;
    if (f.ingestStatus === 'ingested') ingestedCount++;
    if (f.ingestStatus === 'failed') failedCount++;
  }

  return {
    certificationCaseId: certCase.certificationCaseId,
    reference: certCase.reference,
    label: certCase.label,
    status: certCase.status,
    caseId: certCase.caseId,
    corpusHash: certCase.corpusHash,
    importedAt: certCase.importStartedAt,
    totals: {
      files: certCase.files.length,
      bytes,
      documents,
      videos,
      audio,
      images,
      duplicates,
      ingested: ingestedCount,
      failed: failedCount,
      pages,
      videoSeconds: Math.round(videoSeconds),
      audioSeconds: Math.round(audioSeconds),
      unmeasured,
    },
    byExtension,
    byClassification,
    files: certCase.files.map((f) => ({
      certificationFileId: f.certificationFileId,
      relativePath: f.relativePath,
      fileName: f.fileName,
      sizeBytes: f.sizeBytes.toString(),
      sha256: f.sha256,
      originalModifiedAt: f.originalModifiedAt,
      classification: f.classification,
      classificationConfidence: f.classificationConfidence,
      classificationBasis: f.classificationBasis,
      pageCount: f.pageCount,
      durationSeconds: f.durationSeconds,
      mediaProbeNote: f.mediaProbeNote,
      ingestStatus: f.ingestStatus,
      ingestMessage: f.ingestMessage,
      evidenceId: f.evidenceId,
      isDuplicate: Boolean(f.duplicateOfFileId),
    })),
  };
}

export type { DocumentClass };
