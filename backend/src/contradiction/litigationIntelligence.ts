// ============================================================================
// Phase 7 — Litigation Intelligence Integration
// Generates actionable litigation recommendations from contradiction
// analysis and doctrine matching results.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  Contradiction,
  DoctrineMatchResult,
  CdeRecommendation,
  CdeRecommendationType,
  CdeLitigationSummary,
} from './types.ts';

// ---------------------------------------------------------------------------
// Recommendation Generation Rules
// ---------------------------------------------------------------------------

interface RecommendationRule {
  contradictionTypes: string[];
  doctrinePatterns: string[];
  recommendation: {
    type: CdeRecommendationType;
    titleTemplate: string;
    descriptionTemplate: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  };
}

const RECOMMENDATION_RULES: RecommendationRule[] = [
  // Search authority gaps → Motion to Suppress
  {
    contradictionTypes: ['search_authority_gap', 'consent_dispute'],
    doctrinePatterns: ['POSTLD16_SEAR', 'POSTLD16_CONS', 'POSTLD16_WARR'],
    recommendation: {
      type: 'motion_to_suppress',
      titleTemplate: 'Motion to Suppress — Search Without Documented Authority',
      descriptionTemplate: 'Evidence obtained during search may be subject to suppression. Analysis identified potential gap in documented search authority. Consider filing a motion to suppress physical evidence under the Fourth Amendment exclusionary rule.',
      priority: 'critical',
    },
  },

  // Miranda issues → Motion to Suppress Statements
  {
    contradictionTypes: ['missing_miranda'],
    doctrinePatterns: ['POSTLD15_MIRA'],
    recommendation: {
      type: 'motion_to_suppress',
      titleTemplate: 'Motion to Suppress Statements — Miranda Advisement Gap',
      descriptionTemplate: 'Custodial statements may be subject to suppression. Analysis identified potential gap in Miranda advisement documentation. Consider filing a motion to suppress statements under Miranda v. Arizona.',
      priority: 'critical',
    },
  },

  // Chain of custody gaps → Evidence Exclusion
  {
    contradictionTypes: ['chain_of_custody_gap', 'evidence_appearance_disappearance'],
    doctrinePatterns: ['POSTLD24_CHAI', 'POSTLD24_EVID'],
    recommendation: {
      type: 'evidence_exclusion',
      titleTemplate: 'Evidence Exclusion Motion — Chain of Custody Gap',
      descriptionTemplate: 'Evidence integrity may be compromised due to chain of custody gap. Consider filing a motion to exclude evidence based on authentication and foundation objections.',
      priority: 'high',
    },
  },

  // Narrative inconsistencies → Brady Request
  {
    contradictionTypes: ['narrative_inconsistency', 'witness_conflict'],
    doctrinePatterns: ['POSTLD18_REPO'],
    recommendation: {
      type: 'brady_request',
      titleTemplate: 'Brady Disclosure Request — Cross-Source Inconsistencies',
      descriptionTemplate: 'Significant inconsistencies detected between evidence sources. Consider filing a Brady request for all versions of reports, prior drafts, and any additional witness statements that may exist.',
      priority: 'high',
    },
  },

  // Missing bodycam → Discovery Motion
  {
    contradictionTypes: ['missing_bodycam_activation'],
    doctrinePatterns: [],
    recommendation: {
      type: 'motion_for_discovery',
      titleTemplate: 'Discovery Motion — Body-Worn Camera Footage',
      descriptionTemplate: 'Critical events lack body-worn camera documentation. Consider filing a motion to compel production of all available video footage, camera activation logs, and agency BWC policy compliance records.',
      priority: 'high',
    },
  },

  // Dispatch inconsistencies → Discovery Motion
  {
    contradictionTypes: ['dispatch_report_inconsistency', 'timeline_conflict'],
    doctrinePatterns: ['POSTLD18_TIME'],
    recommendation: {
      type: 'motion_for_discovery',
      titleTemplate: 'Discovery Motion — CAD Records and Communications',
      descriptionTemplate: 'Discrepancies between dispatch records and officer report detected. Consider filing a motion to compel production of full CAD printout, radio communications, and MDT records.',
      priority: 'medium',
    },
  },

  // Force issues → Expert Consultation
  {
    contradictionTypes: ['force_justification_gap', 'action_sequence_conflict'],
    doctrinePatterns: ['POSTLD20_FORC', 'POSTLD20_DEES'],
    recommendation: {
      type: 'expert_consultation',
      titleTemplate: 'Expert Consultation — Use of Force Analysis',
      descriptionTemplate: 'Force application sequence may deviate from standard training protocols. Consider retaining a use-of-force expert to analyze the documented sequence of events against POST LD-20 standards.',
      priority: 'high',
    },
  },

  // Witness conflicts → Investigative Task
  {
    contradictionTypes: ['witness_conflict'],
    doctrinePatterns: [],
    recommendation: {
      type: 'investigative_task',
      titleTemplate: 'Investigative Task — Witness Re-Interview',
      descriptionTemplate: 'Witness account conflicts with official report. Consider conducting independent witness interviews to document discrepancies and obtain detailed sworn statements.',
      priority: 'medium',
    },
  },

  // Location inconsistency → Investigative Task
  {
    contradictionTypes: ['location_inconsistency'],
    doctrinePatterns: [],
    recommendation: {
      type: 'investigative_task',
      titleTemplate: 'Investigative Task — Scene Documentation',
      descriptionTemplate: 'Location discrepancies detected between evidence sources. Consider conducting an independent scene survey with photographs and measurements to verify reported locations.',
      priority: 'medium',
    },
  },

  // Multiple critical contradictions → Motion to Dismiss
  {
    contradictionTypes: ['search_authority_gap', 'missing_miranda', 'chain_of_custody_gap'],
    doctrinePatterns: ['POSTLD15', 'POSTLD16', 'POSTLD24'],
    recommendation: {
      type: 'motion_to_dismiss',
      titleTemplate: 'Motion to Dismiss — Cumulative Procedural Gaps',
      descriptionTemplate: 'Multiple significant procedural deviations identified across evidence sources. If suppression motions succeed in excluding key evidence, consider filing a motion to dismiss based on insufficiency of remaining evidence.',
      priority: 'critical',
    },
  },
];

// ---------------------------------------------------------------------------
// Recommendation Generation
// ---------------------------------------------------------------------------

/**
 * Generate litigation recommendations from contradictions and doctrine matches.
 */
export function generateRecommendations(
  caseId: string,
  contradictions: Contradiction[],
  doctrineResults: DoctrineMatchResult[],
): CdeRecommendation[] {
  const recommendations: CdeRecommendation[] = [];
  const generatedTypes = new Set<string>();

  for (const rule of RECOMMENDATION_RULES) {
    // Check if any contradiction matches this rule
    const matchingContradictions = contradictions.filter((c) =>
      rule.contradictionTypes.includes(c.contradictionType),
    );

    if (matchingContradictions.length === 0) continue;

    // Check doctrine pattern match (if patterns specified)
    let doctrineMatch = rule.doctrinePatterns.length === 0;
    if (!doctrineMatch) {
      for (const dr of doctrineResults) {
        for (const link of dr.doctrineMatches) {
          if (rule.doctrinePatterns.some((p) => link.doctrineRuleId.startsWith(p))) {
            doctrineMatch = true;
            break;
          }
        }
        if (doctrineMatch) break;
      }
    }

    if (!doctrineMatch) continue;

    // Avoid duplicate recommendation types for the same contradiction
    const dedupeKey = `${rule.recommendation.type}:${rule.recommendation.titleTemplate}`;
    if (generatedTypes.has(dedupeKey)) continue;
    generatedTypes.add(dedupeKey);

    const bestContradiction = matchingContradictions.reduce((a, b) =>
      a.confidence > b.confidence ? a : b,
    );

    // Find associated doctrine rule
    const associatedDoctrine = doctrineResults.find(
      (dr) => dr.contradictionId === bestContradiction.contradictionId,
    );

    recommendations.push({
      recommendationId: uuidv4(),
      caseId,
      type: rule.recommendation.type,
      title: rule.recommendation.titleTemplate,
      description: rule.recommendation.descriptionTemplate,
      sourceEventId: bestContradiction.eventA,
      sourceEvidenceId: bestContradiction.sourceEvidenceIds[0] ?? '',
      doctrineRuleId: associatedDoctrine?.doctrineMatches[0]?.doctrineRuleId ?? null,
      contradictionId: bestContradiction.contradictionId,
      confidence: bestContradiction.confidence,
      priority: rule.recommendation.priority,
      createdAt: new Date().toISOString(),
    });
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Litigation Summary
// ---------------------------------------------------------------------------

/**
 * Generate a comprehensive litigation summary for a case.
 */
export function generateLitigationSummary(
  caseId: string,
  recommendations: CdeRecommendation[],
): CdeLitigationSummary {
  const motionCount = recommendations.filter((r) =>
    r.type === 'motion_to_suppress' ||
    r.type === 'motion_to_dismiss' ||
    r.type === 'evidence_exclusion' ||
    r.type === 'motion_for_discovery' ||
    r.type === 'motion_for_sanctions',
  ).length;

  const investigativeTaskCount = recommendations.filter(
    (r) => r.type === 'investigative_task',
  ).length;

  const expertConsultationCount = recommendations.filter(
    (r) => r.type === 'expert_consultation',
  ).length;

  // Assess overall case strength
  const criticalCount = recommendations.filter((r) => r.priority === 'critical').length;
  const highCount = recommendations.filter((r) => r.priority === 'high').length;

  let overallStrength: 'strong' | 'moderate' | 'developing' | 'weak';
  if (criticalCount >= 2 || (criticalCount >= 1 && highCount >= 2)) {
    overallStrength = 'strong';
  } else if (criticalCount >= 1 || highCount >= 2) {
    overallStrength = 'moderate';
  } else if (highCount >= 1 || recommendations.length >= 3) {
    overallStrength = 'developing';
  } else {
    overallStrength = 'weak';
  }

  return {
    caseId,
    recommendations,
    motionCount,
    investigativeTaskCount,
    expertConsultationCount,
    overallStrength,
  };
}
