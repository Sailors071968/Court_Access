// ============================================================================
// Program 21 — Unified Audit Center
// ============================================================================

import prisma from '../lib/prisma.js';
import { securityLogger } from '../security/securityLogger.js';
import { queryExtractionAudit } from '../legislative/extractionAuditLog.js';
import type { AuditCenterQuery, AuditCenterResult, AuditRecord } from './types.js';

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /^(LOGIN|LOGOUT|TOKEN|USER_REGISTERED|SESSION)/, category: 'authentication' },
  { pattern: /^STRIPE_|^BILLING_/, category: 'billing' },
  { pattern: /^LEGISLATIVE_|extraction/, category: 'legislative' },
  { pattern: /^EVIDENCE_|UPLOAD_/, category: 'evidence' },
  { pattern: /^ADMIN_|DELETE_/, category: 'administrative' },
  { pattern: /^REPORT_|EXPORT_/, category: 'attorney_reports' },
];

function categorize(event: string): string {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(event)) return category;
  }
  return 'system';
}

function matchesSearch(record: AuditRecord, search?: string): boolean {
  if (!search) return true;
  const haystack = [record.event, record.details, record.userId, record.category, record.source].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(search.toLowerCase());
}

export async function queryAuditCenter(query: AuditCenterQuery = {}): Promise<AuditCenterResult> {
  const limit = Math.min(query.limit ?? 100, 500);
  const offset = query.offset ?? 0;
  const records: AuditRecord[] = [];

  if (!query.source || query.source === 'security_db' || query.source === 'billing' || query.source === 'admin') {
    const where: Record<string, unknown> = {};
    if (query.userId) where.userId = query.userId;
    if (query.event) where.event = { contains: query.event };
    if (query.since) where.createdAt = { gte: new Date(query.since) };

    const dbLogs = await prisma.securityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + offset,
    });

    for (const log of dbLogs) {
      const category = categorize(log.event);
      if (query.category && query.category !== category) continue;
      records.push({
        id: `db-${log.id}`,
        timestamp: log.createdAt.toISOString(),
        source: log.event.startsWith('STRIPE_') || log.event.startsWith('BILLING_') ? 'billing' : 'security_db',
        category,
        event: log.event,
        userId: log.userId,
        ip: log.ip,
        details: log.details,
      });
    }
  }

  if (!query.source || query.source === 'security_memory') {
    const memLogs = securityLogger.getEntries({
      limit: limit + offset,
      userId: query.userId,
      since: query.since,
      event: query.event as never,
    });
    for (const log of memLogs) {
      const category = categorize(log.event);
      if (query.category && query.category !== category) continue;
      records.push({
        id: `mem-${log.timestamp}-${log.event}`,
        timestamp: log.timestamp,
        source: 'security_memory',
        category,
        event: log.event,
        userId: log.userId,
        ip: log.ip,
        details: log.details,
        severity: log.severity,
      });
    }
  }

  if (!query.source || query.source === 'legislative') {
    try {
      const legislative = await queryExtractionAudit({
        code: query.category === 'legislative' ? undefined : undefined,
        limit: limit + offset,
      });
      for (const entry of legislative.entries) {
        if (query.since && entry.createdAt < query.since) continue;
        records.push({
          id: `leg-${entry.id}`,
          timestamp: entry.createdAt,
          source: 'legislative',
          category: 'legislative',
          event: `EXTRACTION_${entry.stage.toUpperCase()}_${entry.status.toUpperCase()}`,
          details: `${entry.code} §${entry.section} offenses=${entry.offenseCount}`,
        });
      }
    } catch {
      // legislative audit optional
    }
  }

  const filtered = records
    .filter((r) => matchesSearch(r, query.search))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const page = filtered.slice(offset, offset + limit);

  return {
    generatedAt: new Date().toISOString(),
    total: filtered.length,
    records: page,
  };
}
