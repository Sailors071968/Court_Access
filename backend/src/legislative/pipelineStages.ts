// ============================================================================
// Stage 3–6 — Canonical legislative pipeline orchestration
//
// California Legislature → Discovery → Acquisition → Normalization
//   → Classification → Legal Extraction → Knowledge Graph → Repositories
//   → Attorney Intelligence
// ============================================================================

import type { CriminalKnowledgeBundle, ParseRejection, StatuteRecord } from './knowledgeGraph/types.ts';
import { extractCriminalKnowledge } from './knowledgeGraph/intelligenceExtractor.ts';
import { classifyStatute } from './liabilityDiscovery/classificationEngine.ts';
import type { StatuteClassificationRecord } from './liabilityDiscovery/types.ts';
import { normalizeLeginfoHtml, type NormalizedStatute, NORMALIZATION_VERSION } from './normalization.ts';
import { buildSectionUrl, normalizeSectionNumber } from './leginfoUrls.ts';
import { statuteId, PARSER_VERSION } from './statuteParser.ts';
import type { AuditMetadata } from './knowledgeGraph/types.ts';

export const PIPELINE_VERSION = '1.0.0';

export type PipelineStageName =
  | 'normalization'
  | 'classification'
  | 'legal_extraction';

export interface PipelineStageAudit {
  stage: PipelineStageName;
  version: string;
  status: 'success' | 'rejected' | 'partial';
  completedAt: string;
}

export interface LegislativePipelineInput {
  html: string;
  sourceUrl: string;
  retrievedAt: string;
  code?: string;
  section?: string;
}

export type LegislativePipelineResult =
  | {
      ok: true;
      normalized: NormalizedStatute;
      statute: StatuteRecord;
      classification: StatuteClassificationRecord;
      bundle: CriminalKnowledgeBundle;
      stages: PipelineStageAudit[];
    }
  | {
      ok: false;
      rejection: ParseRejection;
      stages: PipelineStageAudit[];
    };

function buildStatuteRecord(
  normalized: NormalizedStatute,
  input: LegislativePipelineInput,
): StatuteRecord {
  const id = statuteId(normalized.code, normalized.section);
  const audit: AuditMetadata = {
    extractedAt: new Date().toISOString(),
    extractorVersion: PARSER_VERSION,
    sourceStatuteId: id,
    sourceUrl: input.sourceUrl,
    contentHash: normalized.contentHash,
    parseStatus: normalized.flags.length > 0 ? 'partial' : 'success',
  };

  return {
    id,
    code: normalized.code,
    section: normalized.section,
    title: normalized.title,
    hierarchy: normalized.hierarchy,
    fullText: normalized.fullText,
    subdivisions: normalized.subdivisions,
    sourceUrl: input.sourceUrl || buildSectionUrl(normalized.code, normalized.section),
    retrievedAt: input.retrievedAt,
    contentHash: normalized.contentHash,
    effectiveDate: normalized.effectiveDate,
    flags: normalized.flags,
    audit,
  };
}

function toParseRejection(
  normalized: { code: string; section: string; reason: string; contentHash: string },
  input: LegislativePipelineInput,
): ParseRejection {
  return {
    code: normalized.code,
    section: normalized.section,
    sourceUrl: input.sourceUrl,
    reason: normalized.reason,
    retrievedAt: input.retrievedAt,
    contentHash: normalized.contentHash,
  };
}

/**
 * Run the full legislative intelligence pipeline for a single acquired statute.
 * Stages execute in canonical order: Normalization → Classification → Legal Extraction.
 */
export function runLegislativePipeline(input: LegislativePipelineInput): LegislativePipelineResult {
  const stages: PipelineStageAudit[] = [];
  const now = () => new Date().toISOString();

  const normResult = normalizeLeginfoHtml({
    html: input.html,
    code: input.code,
    section: input.section,
  });

  if (!normResult.ok) {
    stages.push({
      stage: 'normalization',
      version: NORMALIZATION_VERSION,
      status: 'rejected',
      completedAt: now(),
    });
    return {
      ok: false,
      rejection: toParseRejection(normResult.rejection, input),
      stages,
    };
  }

  stages.push({
    stage: 'normalization',
    version: NORMALIZATION_VERSION,
    status: normResult.normalized.flags.length > 0 ? 'partial' : 'success',
    completedAt: now(),
  });

  const statute = buildStatuteRecord(normResult.normalized, input);

  const preliminaryClassification = classifyStatute(statute, { confirmedOffenseCount: 0 });
  stages.push({
    stage: 'classification',
    version: preliminaryClassification.audit.extractorVersion,
    status: preliminaryClassification.criminalLiabilityLikely ? 'partial' : 'success',
    completedAt: now(),
  });

  const bundle = extractCriminalKnowledge(statute);
  stages.push({
    stage: 'legal_extraction',
    version: bundle.statute.audit.extractorVersion,
    status: bundle.offenses.length > 0 ? 'success' : 'partial',
    completedAt: now(),
  });

  const classification = classifyStatute(statute, {
    confirmedOffenseCount: bundle.offenses.length,
  });

  return {
    ok: true,
    normalized: normResult.normalized,
    statute,
    classification,
    bundle,
    stages,
  };
}

export function normalizeSection(section: string): string {
  return normalizeSectionNumber(section);
}
