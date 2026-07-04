// ============================================================================
// Domain U — Legal Analysis (Phase 3)
// ============================================================================

import { getAttorneyStatuteIntelligence } from '../legislative/attorneyIntelligence.js';
import type { ChargeLegalAnalysis, IntelligenceAudit } from './types.js';
import { INTELLIGENCE_VERSION } from './types.js';

function audit(reasoning: string, sourceId?: string): IntelligenceAudit {
  return {
    generatedAt: new Date().toISOString(),
    intelligenceVersion: INTELLIGENCE_VERSION,
    pipelineVersion: 'legal-analysis-1.0.0',
    reasoning,
    sourceType: 'statute',
    sourceId,
  };
}

export async function analyzeChargeLegal(
  charge: { id: string; code: string; section: string },
): Promise<ChargeLegalAnalysis> {
  const statuteIntelligence = await getAttorneyStatuteIntelligence(charge.code, charge.section);
  const unknownLegalQuestions: string[] = [];

  if (!statuteIntelligence) {
    return {
      chargeId: charge.id,
      code: charge.code,
      section: charge.section,
      statuteIntelligence: null,
      applicableStatutes: [],
      applicableAuthorities: [],
      applicableCalcrim: [],
      enhancements: [],
      defenses: [],
      exceptions: [],
      crossReferences: [],
      unknownLegalQuestions: ['Statute not found in legislative repository — legal analysis UNKNOWN'],
    };
  }

  const applicableStatutes = [{ code: charge.code, section: charge.section }];
  const applicableAuthorities = statuteIntelligence.authorities.map((a) => ({
    code: charge.code,
    section: charge.section,
    authorityId: a.id,
  }));
  const applicableCalcrim = statuteIntelligence.calcrimLinks.map((c) => ({
    instructionNumber: c.instructionNumber.value !== 'UNKNOWN' ? String(c.instructionNumber.value) : 'UNKNOWN',
    title: c.instructionTitle.value !== 'UNKNOWN' ? String(c.instructionTitle.value) : 'UNKNOWN',
    audit: audit(`CALCRIM link from repository`, c.id),
  }));

  if (applicableCalcrim.length === 0) {
    unknownLegalQuestions.push(`CALCRIM instruction UNKNOWN for ${charge.code} §${charge.section}`);
  }

  const enhancements = statuteIntelligence.offenses
    .map((o) => (o.penalty.value !== 'UNKNOWN' ? String(o.penalty.value) : null))
    .filter(Boolean) as string[];

  const defenses = statuteIntelligence.defenses
    .map((d) => (d.text.value !== 'UNKNOWN' ? String(d.text.value) : null))
    .filter(Boolean) as string[];

  const exceptions = statuteIntelligence.exceptions
    .map((e) => (e.text.value !== 'UNKNOWN' ? String(e.text.value) : null))
    .filter(Boolean) as string[];

  const crossReferences = statuteIntelligence.crossReferences.map((r) => ({
    code: r.targetCode,
    section: r.targetSection,
  }));

  unknownLegalQuestions.push(...statuteIntelligence.unknowns);

  return {
    chargeId: charge.id,
    code: charge.code,
    section: charge.section,
    statuteIntelligence,
    applicableStatutes,
    applicableAuthorities,
    applicableCalcrim,
    enhancements,
    defenses,
    exceptions,
    crossReferences,
    unknownLegalQuestions,
  };
}
