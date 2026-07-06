// ============================================================================
// Per-record extraction audit log — canonical, auditable, queryable
// ============================================================================

import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { PARSER_VERSION } from './statuteParser.ts';
import { EXTRACTOR_VERSION } from './knowledgeGraph/intelligenceExtractor.ts';

export type ExtractionStage = 'parse' | 'extract';
export type ExtractionAuditStatus = 'success' | 'rejected' | 'partial';

export interface ExtractionAuditEntry {
  id: string;
  code: string;
  section: string;
  sourceUrl: string;
  contentHash: string | null;
  sourceStatuteId: string | null;
  stage: ExtractionStage;
  status: ExtractionAuditStatus;
  rejectionReason: string | null;
  offenseCount: number;
  elementCount: number;
  parserVersion: string;
  extractorVersion: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ExtractionAuditQuery {
  code?: string;
  section?: string;
  status?: ExtractionAuditStatus;
  stage?: ExtractionStage;
  limit?: number;
  offset?: number;
}

const DEFAULT_AUDIT_DIR = 'data/legislative/audit';

function auditFilePath(auditDir: string): string {
  return join(resolve(auditDir), 'extraction-audit.jsonl');
}

export async function appendExtractionAudit(
  entry: Omit<ExtractionAuditEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  options?: { auditDir?: string; prisma?: PrismaClient },
): Promise<ExtractionAuditEntry> {
  const record: ExtractionAuditEntry = {
    id: entry.id ?? randomUUID(),
    code: entry.code.toUpperCase(),
    section: entry.section,
    sourceUrl: entry.sourceUrl,
    contentHash: entry.contentHash,
    sourceStatuteId: entry.sourceStatuteId,
    stage: entry.stage,
    status: entry.status,
    rejectionReason: entry.rejectionReason,
    offenseCount: entry.offenseCount,
    elementCount: entry.elementCount,
    parserVersion: entry.parserVersion,
    extractorVersion: entry.extractorVersion,
    metadata: entry.metadata,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };

  const auditDir = resolve(options?.auditDir ?? DEFAULT_AUDIT_DIR);
  await mkdir(auditDir, { recursive: true });
  await appendFile(auditFilePath(auditDir), `${JSON.stringify(record)}\n`, 'utf-8');

  if (options?.prisma) {
    await options.prisma.legislativeExtractionAudit.create({
      data: {
        id: record.id,
        code: record.code,
        section: record.section,
        sourceUrl: record.sourceUrl,
        contentHash: record.contentHash,
        sourceStatuteId: record.sourceStatuteId,
        stage: record.stage,
        status: record.status,
        rejectionReason: record.rejectionReason,
        offenseCount: record.offenseCount,
        elementCount: record.elementCount,
        parserVersion: record.parserVersion,
        extractorVersion: record.extractorVersion,
        metadata: record.metadata ? JSON.stringify(record.metadata) : null,
        createdAt: new Date(record.createdAt),
      },
    });
  }

  return record;
}

export async function queryExtractionAudit(
  query: ExtractionAuditQuery,
  options?: { auditDir?: string; prisma?: PrismaClient },
): Promise<{ entries: ExtractionAuditEntry[]; total: number }> {
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  if (options?.prisma) {
    const where = {
      code: query.code?.toUpperCase(),
      section: query.section,
      status: query.status,
      stage: query.stage,
    };
    const [rows, total] = await Promise.all([
      options.prisma.legislativeExtractionAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      options.prisma.legislativeExtractionAudit.count({ where }),
    ]);

    return {
      total,
      entries: rows.map((row) => ({
        id: row.id,
        code: row.code,
        section: row.section,
        sourceUrl: row.sourceUrl,
        contentHash: row.contentHash,
        sourceStatuteId: row.sourceStatuteId,
        stage: row.stage as ExtractionStage,
        status: row.status as ExtractionAuditStatus,
        rejectionReason: row.rejectionReason,
        offenseCount: row.offenseCount,
        elementCount: row.elementCount,
        parserVersion: row.parserVersion,
        extractorVersion: row.extractorVersion,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  const filePath = auditFilePath(options?.auditDir ?? DEFAULT_AUDIT_DIR);
  let lines: string[] = [];
  try {
    const raw = await readFile(filePath, 'utf-8');
    lines = raw.trim().split('\n').filter(Boolean);
  } catch {
    return { entries: [], total: 0 };
  }

  let entries = lines.map((line) => JSON.parse(line) as ExtractionAuditEntry);
  if (query.code) entries = entries.filter((e) => e.code === query.code!.toUpperCase());
  if (query.section) entries = entries.filter((e) => e.section === query.section);
  if (query.status) entries = entries.filter((e) => e.status === query.status);
  if (query.stage) entries = entries.filter((e) => e.stage === query.stage);

  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = entries.length;
  return { entries: entries.slice(offset, offset + limit), total };
}

export async function getExtractionAuditStats(
  options?: { auditDir?: string; prisma?: PrismaClient },
): Promise<{
  total: number;
  success: number;
  rejected: number;
  partial: number;
  withOffenses: number;
}> {
  const { entries, total } = await queryExtractionAudit({ limit: 100_000 }, options);
  return {
    total,
    success: entries.filter((e) => e.status === 'success').length,
    rejected: entries.filter((e) => e.status === 'rejected').length,
    partial: entries.filter((e) => e.status === 'partial').length,
    withOffenses: entries.filter((e) => e.offenseCount > 0).length,
  };
}

export function buildParseAuditEntry(params: {
  code: string;
  section: string;
  sourceUrl: string;
  contentHash: string | null;
  status: ExtractionAuditStatus;
  rejectionReason?: string;
  sourceStatuteId?: string;
}): Omit<ExtractionAuditEntry, 'id' | 'createdAt'> {
  return {
    code: params.code,
    section: params.section,
    sourceUrl: params.sourceUrl,
    contentHash: params.contentHash,
    sourceStatuteId: params.sourceStatuteId ?? null,
    stage: 'parse',
    status: params.status,
    rejectionReason: params.rejectionReason ?? null,
    offenseCount: 0,
    elementCount: 0,
    parserVersion: PARSER_VERSION,
    extractorVersion: EXTRACTOR_VERSION,
    metadata: null,
  };
}

export function buildExtractAuditEntry(params: {
  code: string;
  section: string;
  sourceUrl: string;
  contentHash: string;
  sourceStatuteId: string;
  status: ExtractionAuditStatus;
  offenseCount: number;
  elementCount: number;
  flags?: string[];
}): Omit<ExtractionAuditEntry, 'id' | 'createdAt'> {
  return {
    code: params.code,
    section: params.section,
    sourceUrl: params.sourceUrl,
    contentHash: params.contentHash,
    sourceStatuteId: params.sourceStatuteId,
    stage: 'extract',
    status: params.status,
    rejectionReason: null,
    offenseCount: params.offenseCount,
    elementCount: params.elementCount,
    parserVersion: PARSER_VERSION,
    extractorVersion: EXTRACTOR_VERSION,
    metadata: params.flags?.length ? { flags: params.flags } : null,
  };
}
