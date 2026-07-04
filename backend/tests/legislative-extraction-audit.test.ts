// ============================================
// Epic 2A-006 — Extraction audit log tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendExtractionAudit,
  buildExtractAuditEntry,
  buildParseAuditEntry,
  getExtractionAuditStats,
  queryExtractionAudit,
} from '../src/legislative/extractionAuditLog.ts';
import { processStatutePipeline } from '../src/legislative/knowledgeGraph/pipeline.ts';

describe('Extraction audit log', () => {
  let auditDir: string;

  before(async () => {
    auditDir = await mkdtemp(join(tmpdir(), 'leg-audit-'));
  });

  after(async () => {
    await rm(auditDir, { recursive: true, force: true });
  });

  it('appends parse rejection entries to JSONL', async () => {
    const entry = await appendExtractionAudit(
      buildParseAuditEntry({
        code: 'PEN',
        section: '999.',
        sourceUrl: 'http://example.com',
        contentHash: 'abc123',
        status: 'rejected',
        rejectionReason: 'missing_single_law_section',
      }),
      { auditDir },
    );

    assert.ok(entry.id);
    assert.equal(entry.stage, 'parse');
    assert.equal(entry.status, 'rejected');

    const raw = await readFile(join(auditDir, 'extraction-audit.jsonl'), 'utf-8');
    assert.ok(raw.includes('missing_single_law_section'));
  });

  it('queries entries with filters', async () => {
    await appendExtractionAudit(
      buildExtractAuditEntry({
        code: 'PEN',
        section: '459.',
        sourceUrl: 'http://example.com',
        contentHash: 'hash459',
        sourceStatuteId: 'statute-459',
        status: 'success',
        offenseCount: 1,
        elementCount: 3,
      }),
      { auditDir },
    );

    const { entries, total } = await queryExtractionAudit(
      { code: 'PEN', status: 'success', stage: 'extract' },
      { auditDir },
    );

    assert.ok(total >= 1);
    assert.ok(entries.some((e) => e.section === '459.' && e.offenseCount === 1));
  });

  it('returns audit stats summary', async () => {
    const stats = await getExtractionAuditStats({ auditDir });
    assert.ok(stats.total >= 2);
    assert.ok(stats.rejected >= 1);
    assert.ok(stats.success >= 1);
  });
});

describe('Pipeline audit integration', () => {
  let tempDir: string;
  let auditDir: string;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kg-audit-pipeline-'));
    auditDir = join(tempDir, 'audit');
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes parse and extract audit entries during processing', async () => {
    await processStatutePipeline({
      code: 'PEN',
      rawHtmlDir: join(import.meta.dirname ?? '.', '../data/legislative/raw'),
      repositoryDir: join(tempDir, 'repos'),
      auditDir,
      maxSections: 2,
    });

    const { entries, total } = await queryExtractionAudit({ limit: 100 }, { auditDir });
    assert.ok(total >= 2);
    assert.ok(entries.some((e) => e.stage === 'parse'));
    assert.ok(entries.some((e) => e.stage === 'extract'));
  });
});
