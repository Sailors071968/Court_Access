// ============================================================================
// Raw HTML storage for leginfo acquisition (Stage 2)
// ============================================================================

import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { AcquisitionRecord } from './types.ts';

export interface StoredHtmlResult {
  filePath: string;
  contentHash: string;
  byteLength: number;
}

function sectionDirName(section: string): string {
  return section.replace(/\./g, '_');
}

export function rawHtmlPath(baseDir: string, code: string, section: string): string {
  return join(baseDir, code.toUpperCase(), `${sectionDirName(section)}.html`);
}

export function acquisitionIndexPath(baseDir: string, code: string): string {
  return join(baseDir, code.toUpperCase(), 'acquisition-index.jsonl');
}

export async function storeRawHtml(
  baseDir: string,
  record: AcquisitionRecord,
): Promise<StoredHtmlResult | null> {
  const contentHash = createHash('sha256').update(record.html || record.errorMessage || '').digest('hex');
  let filePath = '';
  let byteLength = 0;

  if (record.status === 'success' && record.html) {
    filePath = rawHtmlPath(baseDir, record.code, record.section);
    await mkdir(join(baseDir, record.code.toUpperCase()), { recursive: true });
    await writeFile(filePath, record.html, 'utf-8');
    byteLength = Buffer.byteLength(record.html, 'utf-8');
  }

  const indexEntry = {
    code: record.code,
    section: record.section,
    sourceUrl: record.sourceUrl,
    retrievedAt: record.retrievedAt,
    contentHash,
    filePath: filePath || null,
    status: record.status,
    httpStatus: record.httpStatus,
    errorMessage: record.errorMessage ?? null,
  };

  await mkdir(join(baseDir, record.code.toUpperCase()), { recursive: true });
  await writeFile(
    acquisitionIndexPath(baseDir, record.code),
    `${JSON.stringify(indexEntry)}\n`,
    { flag: 'a' },
  );

  if (!filePath) return null;

  return { filePath, contentHash, byteLength };
}

export async function rawHtmlExists(baseDir: string, code: string, section: string): Promise<boolean> {
  try {
    await access(rawHtmlPath(baseDir, code, section));
    return true;
  } catch {
    return false;
  }
}

export async function readRawHtml(baseDir: string, code: string, section: string): Promise<string> {
  return readFile(rawHtmlPath(baseDir, code, section), 'utf-8');
}
