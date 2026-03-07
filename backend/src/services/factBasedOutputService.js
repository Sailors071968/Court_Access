// ============================================
// Court Access — Fact-Based Output Service
// Phase J: Ensure all system outputs are grounded
// in verified facts with citations
// ============================================

import prisma from './prismaClient.js';

/**
 * Validate that an output is grounded in verified facts.
 * @param {string} caseId
 * @param {string} outputText
 * @param {string} outputType - 'narrative', 'motion', 'analysis', 'report'
 * @returns {{ isGrounded: boolean, citations: object[], ungroundedClaims: string[] }}
 */
export async function validateOutputGrounding(caseId, outputText, outputType) {
  console.log(`[FactBasedOutput] Validating ${outputType} grounding for case ${caseId}`);

  const facts = await prisma.verifiedFact.findMany({
    where: { caseId, verificationStatus: { not: 'merged' } },
  });

  const sentences = outputText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
  const citations = [];
  const ungroundedClaims = [];

  for (const sentence of sentences) {
    const supporting = findGroundingFacts(sentence, facts);

    if (supporting.length > 0) {
      citations.push({
        claim: sentence,
        supportingFacts: supporting.map(f => ({
          factId: f.id,
          factText: f.factText.substring(0, 100),
          confidence: f.confidence,
          documentId: f.documentId,
          page: f.page,
          line: f.line,
        })),
        groundingStrength: Math.max(...supporting.map(f => f.confidence)),
      });
    } else {
      // Check if it's a factual claim vs a procedural statement
      if (isFactualClaim(sentence)) {
        ungroundedClaims.push(sentence);
      }
    }
  }

  const isGrounded = ungroundedClaims.length === 0 || (ungroundedClaims.length / sentences.length) < 0.2;

  // Store validation result
  await prisma.outputValidation.create({
    data: {
      caseId,
      outputType,
      outputText: outputText.substring(0, 5000),
      isGrounded,
      citationCount: citations.length,
      ungroundedCount: ungroundedClaims.length,
      groundingRate: sentences.length > 0
        ? Math.round((citations.length / sentences.length) * 100) / 100
        : 0,
      citations,
      ungroundedClaims,
      metadata: { validatedAt: new Date().toISOString() },
    },
  });

  return {
    isGrounded,
    citations,
    ungroundedClaims,
    groundingRate: sentences.length > 0
      ? Math.round((citations.length / sentences.length) * 100)
      : 0,
  };
}

function findGroundingFacts(sentence, facts) {
  const sentenceWords = new Set(
    sentence.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
  );
  if (sentenceWords.size === 0) return [];

  return facts.filter(fact => {
    const factWords = new Set(
      fact.factText.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
    );
    let overlap = 0;
    for (const w of sentenceWords) { if (factWords.has(w)) overlap++; }
    return overlap / Math.max(sentenceWords.size, 1) > 0.25;
  });
}

function isFactualClaim(sentence) {
  const lower = sentence.toLowerCase();
  // Skip procedural / structural statements
  if (lower.startsWith('section') || lower.startsWith('phase') || lower.startsWith('step')) return false;
  if (lower.includes('should') || lower.includes('recommend') || lower.includes('suggest')) return false;
  if (lower.includes('no data') || lower.includes('not available') || lower.includes('n/a')) return false;
  // Likely a factual claim if it contains specifics
  return /\b(?:occurred|happened|stated|testified|observed|recorded|showed|found|discovered)\b/i.test(sentence) ||
         /\b(?:at|on|in|during|between|approximately|about)\b.*\b\d+\b/.test(sentence);
}

const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they',
  'their', 'which', 'would', 'could', 'should', 'about', 'there',
  'these', 'those', 'then', 'than', 'what', 'when', 'where', 'will',
]);

export async function getCaseOutputValidations(caseId) {
  return prisma.outputValidation.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}
