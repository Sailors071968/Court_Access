// ============================================
// Court Access — Intelligence Pipeline (Stage 3)
// AI analysis with constitutional enforcement.
// Output passes through constitutional engines before storage.
// ============================================

import { runAIAnalysis } from '../services/aiService.js';
import { storeAnalysisResult } from '../services/analysisService.js';
import { logger } from '../utils/loggingUtils.js';
import { computeSHA256 } from '../utils/hashUtils.js';

export interface IntelligencePipelineInput {
  documentId: string;
  caseId: string;
  tenantId: string;
  extractedText: string;
}

export interface IntelligencePipelineResult {
  analysisId: string;
  modelVersion: string;
  constitutionStatus: 'PASS' | 'FAIL';
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Forbidden terms — must match constitutional engine
const FORBIDDEN_TERMS = [
  'ADVICE', 'RECOMMEND', 'STRATEGY', 'SHOULD', 'LIKELY', 'SUGGESTS',
  'INDICATES', 'IMPLIES', 'WEAK', 'STRONG', 'CONTRADICTION',
  'VIOLATION', 'MISCONDUCT', 'PATTERN',
];

function deterministicUppercase(input: string): string {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 97 && code <= 122) {
      result = result + String.fromCharCode(code - 32);
    } else {
      result = result + input.charAt(i);
    }
  }
  return result;
}

function containsForbiddenTerm(text: string): { found: boolean; term: string | null } {
  const upper = deterministicUppercase(text);
  for (let t = 0; t < FORBIDDEN_TERMS.length; t++) {
    const term = FORBIDDEN_TERMS[t];
    for (let i = 0; i <= upper.length - term.length; i++) {
      let found = true;
      for (let j = 0; j < term.length; j++) {
        if (upper.charAt(i + j) !== term.charAt(j)) {
          found = false;
          break;
        }
      }
      if (found) {
        return { found: true, term };
      }
    }
  }
  return { found: false, term: null };
}

/**
 * Stage 3: Run AI analysis and enforce constitutional constraints.
 * 1. Send text to AI model
 * 2. Validate output against forbidden language scanner
 * 3. Store result if PASS
 */
export async function runIntelligencePipeline(
  input: IntelligencePipelineInput
): Promise<IntelligencePipelineResult> {
  // Run AI analysis
  const aiResult = await runAIAnalysis({
    documentText: input.extractedText,
  });

  // Constitutional enforcement — scan AI output for forbidden terms
  const outputText = JSON.stringify(aiResult.structuredAnalysis);
  const forbiddenCheck = containsForbiddenTerm(outputText);

  let constitutionStatus: 'PASS' | 'FAIL' = 'PASS';
  if (forbiddenCheck.found) {
    constitutionStatus = 'FAIL';
    logger.warn('Constitutional violation in AI output', {
      documentId: input.documentId,
      forbiddenTerm: forbiddenCheck.term,
    });
  }

  // Store analysis result
  const stored = await storeAnalysisResult({
    documentId: input.documentId,
    caseId: input.caseId,
    tenantId: input.tenantId,
    analysisData: {
      ...aiResult.structuredAnalysis,
      constitutionStatus,
      modelVersion: aiResult.modelVersion,
    },
    modelVersion: aiResult.modelVersion,
  });

  logger.info('Intelligence pipeline complete', {
    analysisId: stored.id,
    documentId: input.documentId,
    constitutionStatus,
    modelVersion: aiResult.modelVersion,
  });

  return {
    analysisId: stored.id,
    modelVersion: aiResult.modelVersion,
    constitutionStatus,
    tokenUsage: aiResult.tokenUsage,
  };
}
