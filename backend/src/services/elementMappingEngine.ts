// ============================================================================
// Phase C.3 — Element Mapping Engine
// Deterministic first-pass rule engine: maps EvidenceStatements to CALCRIM
// elements via keyword/alias matching with confidence scoring and provenance.
// NO LLM. NO AI inference. Deterministic matching only.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeywordMatch {
  keyword: string;
  category: string;
  weight: number;
}

interface AliasMatch {
  alias: string;
  source: string;
}

interface ElementMatchResult {
  elementId: string;
  instructionId: string;
  instructionNumber: number;
  elementNumber: number;
  elementLabel: string;
  matchMethod: 'keyword' | 'alias' | 'rule_engine';
  confidence: number;
  matchedKeywords: string[];
  matchedAliases: string[];
  supportType: 'supports' | 'contradicts' | 'neutral';
  explanation: string;
}

export interface MappingResult {
  statementId: string;
  chargeId: string;
  matches: ElementMatchResult[];
  linksCreated: number;
}

export interface BatchMappingResult {
  caseId: string;
  chargeId: string;
  statementsProcessed: number;
  totalLinksCreated: number;
  results: MappingResult[];
}

// ---------------------------------------------------------------------------
// Keyword Matching Engine
// ---------------------------------------------------------------------------

function findKeywordMatches(text: string, keywords: Array<{ keyword: string; category: string; weight: number }>): KeywordMatch[] {
  const lowerText = text.toLowerCase();
  const matches: KeywordMatch[] = [];

  for (const kw of keywords) {
    if (lowerText.includes(kw.keyword.toLowerCase())) {
      matches.push({ keyword: kw.keyword, category: kw.category, weight: kw.weight });
    }
  }

  return matches;
}

function findAliasMatches(text: string, aliases: Array<{ alias: string; source: string }>): AliasMatch[] {
  const lowerText = text.toLowerCase();
  const matches: AliasMatch[] = [];

  for (const al of aliases) {
    if (lowerText.includes(al.alias.toLowerCase())) {
      matches.push({ alias: al.alias, source: al.source });
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Confidence Calculation
// ---------------------------------------------------------------------------

function calculateMatchConfidence(
  keywordMatches: KeywordMatch[],
  aliasMatches: AliasMatch[],
  totalKeywords: number,
  totalAliases: number,
): number {
  if (keywordMatches.length === 0 && aliasMatches.length === 0) return 0;

  // Weighted keyword score
  let keywordScore = 0;
  if (totalKeywords > 0 && keywordMatches.length > 0) {
    const weightedSum = keywordMatches.reduce((sum, m) => sum + m.weight, 0);
    const maxPossible = totalKeywords; // Simplified: each keyword weight averages ~1.0
    keywordScore = Math.min(1.0, weightedSum / Math.max(maxPossible * 0.3, 1));
  }

  // Alias score (binary boost)
  const aliasScore = aliasMatches.length > 0 ? 0.3 : 0;

  // Combined: keyword matching is primary, alias is supplementary
  const combined = Math.min(1.0, keywordScore * 0.7 + aliasScore);

  return Math.round(combined * 100) / 100;
}

// ---------------------------------------------------------------------------
// Support Type Detection
// ---------------------------------------------------------------------------

const NEGATION_PATTERNS = [
  /\bnot\b/i,
  /\bnever\b/i,
  /\bdidn['']?t\b/i,
  /\bdid not\b/i,
  /\bwasn['']?t\b/i,
  /\bwas not\b/i,
  /\bdenied?\b/i,
  /\bno evidence\b/i,
  /\bcould not\b/i,
  /\bcouldn['']?t\b/i,
  /\bfailed to\b/i,
  /\bwithout\b/i,
  /\babsence of\b/i,
  /\blacked?\b/i,
];

function detectSupportType(
  text: string,
  keywordMatches: KeywordMatch[],
): 'supports' | 'contradicts' | 'neutral' {
  if (keywordMatches.length === 0) return 'neutral';

  const hasNegation = NEGATION_PATTERNS.some((pattern) => pattern.test(text));

  if (hasNegation) return 'contradicts';
  return 'supports';
}

// ---------------------------------------------------------------------------
// Build Explanation
// ---------------------------------------------------------------------------

function buildExplanation(
  elementLabel: string,
  keywordMatches: KeywordMatch[],
  aliasMatches: AliasMatch[],
  supportType: string,
): string {
  const parts: string[] = [];

  if (keywordMatches.length > 0) {
    const kwList = keywordMatches.map((m) => `"${m.keyword}" (${m.category})`).join(', ');
    parts.push(`Keywords matched: ${kwList}`);
  }

  if (aliasMatches.length > 0) {
    const alList = aliasMatches.map((m) => `"${m.alias}"`).join(', ');
    parts.push(`Aliases matched: ${alList}`);
  }

  const verb = supportType === 'contradicts' ? 'contradicts' : supportType === 'supports' ? 'supports' : 'is neutral to';
  parts.push(`Statement ${verb} element: "${elementLabel}"`);

  return parts.join('. ');
}

// ---------------------------------------------------------------------------
// Map Single Statement to All Elements of a Charge
// ---------------------------------------------------------------------------

export async function mapStatementToCharge(
  statementId: string,
  chargeId: string,
): Promise<MappingResult> {
  // Load statement
  const statement = await prisma.evidenceStatement.findUnique({
    where: { id: statementId },
  });
  if (!statement) throw new Error(`Statement ${statementId} not found`);

  // Load charge with its CALCRIM instruction and elements
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    include: {
      calcrimInstruction: {
        include: {
          elements: {
            include: {
              keywords: true,
              aliases: true,
            },
            orderBy: { elementNumber: 'asc' },
          },
        },
      },
    },
  });
  if (!charge) throw new Error(`Charge ${chargeId} not found`);
  if (!charge.calcrimInstruction) {
    return { statementId, chargeId, matches: [], linksCreated: 0 };
  }

  const textToMatch = statement.normalizedText;
  const matches: ElementMatchResult[] = [];

  for (const element of charge.calcrimInstruction.elements) {
    const keywordMatches = findKeywordMatches(
      textToMatch,
      element.keywords.map((k) => ({ keyword: k.keyword, category: k.category, weight: k.weight })),
    );

    const aliasMatches = findAliasMatches(
      textToMatch,
      element.aliases.map((a) => ({ alias: a.alias, source: a.source })),
    );

    if (keywordMatches.length === 0 && aliasMatches.length === 0) continue;

    const confidence = calculateMatchConfidence(
      keywordMatches,
      aliasMatches,
      element.keywords.length,
      element.aliases.length,
    );

    if (confidence < 0.1) continue; // Skip near-zero confidence

    const supportType = detectSupportType(textToMatch, keywordMatches);
    const explanation = buildExplanation(element.label, keywordMatches, aliasMatches, supportType);

    matches.push({
      elementId: element.id,
      instructionId: charge.calcrimInstruction.id,
      instructionNumber: charge.calcrimInstruction.instructionNumber,
      elementNumber: element.elementNumber,
      elementLabel: element.label,
      matchMethod: aliasMatches.length > 0 ? 'alias' : 'keyword',
      confidence,
      matchedKeywords: keywordMatches.map((m) => m.keyword),
      matchedAliases: aliasMatches.map((m) => m.alias),
      supportType,
      explanation,
    });
  }

  // Persist links
  let linksCreated = 0;
  for (const match of matches) {
    await prisma.elementStatementLink.upsert({
      where: {
        statementId_elementId_chargeId: {
          statementId,
          elementId: match.elementId,
          chargeId,
        },
      },
      update: {
        matchMethod: match.matchMethod,
        confidence: match.confidence,
        supportType: match.supportType,
        matchedKeywords: JSON.stringify(match.matchedKeywords),
        explanation: match.explanation,
      },
      create: {
        statementId,
        elementId: match.elementId,
        chargeId,
        matchMethod: match.matchMethod,
        confidence: match.confidence,
        supportType: match.supportType,
        matchedKeywords: JSON.stringify(match.matchedKeywords),
        explanation: match.explanation,
      },
    });
    linksCreated++;
  }

  return { statementId, chargeId, matches, linksCreated };
}

// ---------------------------------------------------------------------------
// Map All Statements for a Case to a Charge
// ---------------------------------------------------------------------------

export async function mapCaseStatementsToCharge(
  caseId: string,
  chargeId: string,
  tenantId: string,
): Promise<BatchMappingResult> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId, tenantId },
    orderBy: [{ sourceDocumentId: 'asc' }, { page: 'asc' }, { lineStart: 'asc' }],
  });

  const results: MappingResult[] = [];
  let totalLinksCreated = 0;

  for (const stmt of statements) {
    const result = await mapStatementToCharge(stmt.id, chargeId);
    totalLinksCreated += result.linksCreated;
    if (result.matches.length > 0) {
      results.push(result);
    }
  }

  return {
    caseId,
    chargeId,
    statementsProcessed: statements.length,
    totalLinksCreated,
    results,
  };
}

// ---------------------------------------------------------------------------
// Get Element Coverage for a Charge
// ---------------------------------------------------------------------------

export async function getElementCoverage(chargeId: string): Promise<{
  chargeId: string;
  instructionNumber: number | null;
  elements: Array<{
    elementNumber: number;
    label: string;
    isEssential: boolean;
    supportingStatements: number;
    contradictingStatements: number;
    neutralStatements: number;
    maxConfidence: number;
    coverage: 'covered' | 'partially_covered' | 'uncovered';
  }>;
}> {
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    include: {
      calcrimInstruction: {
        include: {
          elements: {
            orderBy: { elementNumber: 'asc' },
          },
        },
      },
    },
  });

  if (!charge || !charge.calcrimInstruction) {
    return { chargeId, instructionNumber: null, elements: [] };
  }

  const elements = [];

  for (const element of charge.calcrimInstruction.elements) {
    const links = await prisma.elementStatementLink.findMany({
      where: { elementId: element.id, chargeId },
    });

    const supporting = links.filter((l) => l.supportType === 'supports').length;
    const contradicting = links.filter((l) => l.supportType === 'contradicts').length;
    const neutral = links.filter((l) => l.supportType === 'neutral').length;
    const maxConf = links.length > 0 ? Math.max(...links.map((l) => l.confidence)) : 0;

    let coverage: 'covered' | 'partially_covered' | 'uncovered';
    if (supporting > 0 && maxConf >= 0.5) coverage = 'covered';
    else if (supporting > 0 || contradicting > 0) coverage = 'partially_covered';
    else coverage = 'uncovered';

    elements.push({
      elementNumber: element.elementNumber,
      label: element.label,
      isEssential: element.isEssential,
      supportingStatements: supporting,
      contradictingStatements: contradicting,
      neutralStatements: neutral,
      maxConfidence: maxConf,
      coverage,
    });
  }

  return {
    chargeId,
    instructionNumber: charge.calcrimInstruction.instructionNumber,
    elements,
  };
}

// ---------------------------------------------------------------------------
// Validation Report
// ---------------------------------------------------------------------------

export async function generateMappingValidationReport(): Promise<Record<string, unknown>> {
  const totalLinks = await prisma.elementStatementLink.count();
  const byMethod = await prisma.elementStatementLink.groupBy({
    by: ['matchMethod'],
    _count: true,
    _avg: { confidence: true },
  });
  const bySupport = await prisma.elementStatementLink.groupBy({
    by: ['supportType'],
    _count: true,
  });
  const lowConfidence = await prisma.elementStatementLink.count({
    where: { confidence: { lt: 0.3 } },
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalLinks,
      lowConfidenceLinks: lowConfidence,
      lowConfidencePercentage: totalLinks > 0 ? Math.round((lowConfidence / totalLinks) * 10000) / 100 : 0,
    },
    byMatchMethod: byMethod.map((m) => ({
      method: m.matchMethod,
      count: m._count,
      avgConfidence: Math.round((m._avg.confidence ?? 0) * 100) / 100,
    })),
    bySupportType: bySupport.map((s) => ({
      type: s.supportType,
      count: s._count,
    })),
    validation: {
      deterministicFirstPass: true,
      keywordAliasMatching: true,
      confidenceScoring: true,
      provenancePreserved: true,
      noAiInference: true,
    },
  };
}
