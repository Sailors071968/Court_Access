// ============================================================================
// Phase D.2 — CALCRIM Element Mapping Engine
// Deterministic mapping of EvidenceStatements to CALCRIM instructions/elements.
// NO hallucination. NO LLM. NO generative reasoning. NO semantic rewriting.
// Preserves exact evidence citations, page/line anchors, statement text.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EvidenceClassification =
  | 'act'
  | 'intent'
  | 'knowledge'
  | 'identity'
  | 'temporal'
  | 'impeachment'
  | 'contradiction'
  | 'credibility'
  | 'procedural';

interface LexicalMatch {
  term: string;
  source: 'keyword' | 'alias';
  category: string;
  weight: number;
}

export interface StatementMappingResult {
  statementId: string;
  rawTextPreview: string;
  page: number | null;
  lineStart: number | null;
  lineEnd: number | null;
  sourceDocumentId: string;
  mappings: Array<{
    mappingId: string;
    instructionNumber: number;
    elementNumber: number;
    elementLabel: string;
    confidence: number;
    evidenceClassification: EvidenceClassification;
    lexicalTriggerCount: number;
  }>;
  unmapped: boolean;
}

export interface DocumentMappingResult {
  caseId: string;
  documentId: string;
  statementsProcessed: number;
  mappingsGenerated: number;
  unmappedStatements: number;
  confidenceDistribution: Record<string, number>;
  classificationDistribution: Record<string, number>;
  instructionCoverage: Array<{ instructionNumber: number; title: string; mappingCount: number }>;
  processingTimeMs: number;
  failures: string[];
}

export interface ProsecutorTheoryResult {
  caseId: string;
  instructions: Array<{
    instructionId: string;
    instructionNumber: number;
    title: string;
    elements: Array<{
      elementId: string;
      elementNumber: number;
      label: string;
      prosecutionBurden: string;
      supportingStatements: Array<{
        statementId: string;
        rawTextPreview: string;
        page: number | null;
        lineStart: number | null;
        lineEnd: number | null;
        speaker: string | null;
        confidence: number;
        evidenceClassification: EvidenceClassification;
      }>;
      statementCount: number;
      averageConfidence: number;
      burdenStrength: string; // strong | moderate | weak | unsupported
    }>;
    overallBurdenAssessment: string;
  }>;
  narrativeClusters: Array<{
    clusterId: string;
    narrativeType: string;
    prosecutionTheory: string | null;
    statementCount: number;
    confidence: number;
  }>;
}

// ---------------------------------------------------------------------------
// Evidence Classification Rules (deterministic)
// ---------------------------------------------------------------------------

const CLASSIFICATION_PATTERNS: Array<{
  classification: EvidenceClassification;
  patterns: RegExp[];
  weight: number;
}> = [
  {
    classification: 'act',
    patterns: [
      /\b(?:hit|struck|stabbed|shot|pushed|pulled|grabbed|threw|kicked|punched|assaulted|attacked|fired)\b/i,
      /\b(?:entered|broke in|forced entry|trespassed|stole|took|removed|possessed)\b/i,
      /\b(?:drove|operated|swerved|crashed|collided|accelerated|fled|ran)\b/i,
      /\b(?:sold|distributed|manufactured|transported|delivered)\b/i,
    ],
    weight: 0.8,
  },
  {
    classification: 'intent',
    patterns: [
      /\b(?:intended|planned|premeditated|deliberately|purposely|knowingly|willfully)\b/i,
      /\b(?:meant to|wanted to|tried to|attempted to|sought to)\b/i,
      /\b(?:with the intent|with intent to|for the purpose of|in order to)\b/i,
      /\b(?:motive|reason|goal|objective|scheme|plot|conspiracy)\b/i,
    ],
    weight: 0.7,
  },
  {
    classification: 'knowledge',
    patterns: [
      /\b(?:knew|aware|conscious|understood|recognized|realized|noticed)\b/i,
      /\b(?:should have known|had knowledge|was informed|was told)\b/i,
      /\b(?:defendant knew|was aware that|had reason to believe)\b/i,
    ],
    weight: 0.7,
  },
  {
    classification: 'identity',
    patterns: [
      /\b(?:identified|recognized|pointed out|picked out|lineup|photo array)\b/i,
      /\b(?:description|described as|matches the description|looks like)\b/i,
      /\b(?:DNA|fingerprint|forensic|physical evidence linking)\b/i,
      /\b(?:eyewitness|witness identified|victim identified)\b/i,
    ],
    weight: 0.8,
  },
  {
    classification: 'temporal',
    patterns: [
      /\b(?:at approximately|at about|around \d|on \d|between \d)\b/i,
      /\b(?:before|after|during|prior to|subsequent to|following)\b/i,
      /\b(?:timeline|sequence|chronolog|hours later|minutes later)\b/i,
      /\b\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?|hours)\b/i,
    ],
    weight: 0.5,
  },
  {
    classification: 'impeachment',
    patterns: [
      /\b(?:prior inconsistent|previously stated|changed (?:his|her|their) story|contradicted)\b/i,
      /\b(?:prior conviction|criminal record|bias|motive to lie|credibility)\b/i,
      /\b(?:inconsistent with|contrary to|differs from|conflicts with)\b/i,
    ],
    weight: 0.9,
  },
  {
    classification: 'contradiction',
    patterns: [
      /\b(?:but earlier|however.*said|contradicts|inconsistent|conflicting)\b/i,
      /\b(?:impossible|could not have|was not at|was elsewhere)\b/i,
      /\b(?:recanted|retracted|took back|denied previously)\b/i,
    ],
    weight: 0.9,
  },
  {
    classification: 'credibility',
    patterns: [
      /\b(?:reliable|unreliable|trustworthy|honest|dishonest|lying)\b/i,
      /\b(?:demeanor|manner|attitude|behavioral|appeared|seemed)\b/i,
      /\b(?:corroborated|uncorroborated|unverified|confirmed by)\b/i,
      /\b(?:intoxicated|impaired|under the influence|visibility|lighting)\b/i,
    ],
    weight: 0.6,
  },
  {
    classification: 'procedural',
    patterns: [
      /\b(?:Miranda|rights|waived|invoked|counsel|attorney|lawyer)\b/i,
      /\b(?:search warrant|consent to search|probable cause|exigent)\b/i,
      /\b(?:chain of custody|evidence handling|collection|preservation)\b/i,
      /\b(?:booking|arrest|detained|handcuffed|transported)\b/i,
    ],
    weight: 0.6,
  },
];

// ---------------------------------------------------------------------------
// Narrative Type Detection (deterministic)
// ---------------------------------------------------------------------------

const NARRATIVE_TYPE_PATTERNS: Array<{ type: string; patterns: RegExp[] }> = [
  {
    type: 'timeline',
    patterns: [
      /\b(?:at \d|on \d|\d{1,2}:\d{2}|approximately|around|between|before|after)\b/i,
      /\b(?:first|then|next|subsequently|later|afterwards|finally)\b/i,
    ],
  },
  {
    type: 'witness_account',
    patterns: [
      /\b(?:I saw|I observed|I witnessed|I heard|I noticed)\b/i,
      /\b(?:stated that|told (?:me|officers)|testified|declared)\b/i,
      /\b(?:the victim said|the witness|eyewitness)\b/i,
    ],
  },
  {
    type: 'physical_evidence',
    patterns: [
      /\b(?:DNA|fingerprint|forensic|blood|weapon|firearm|knife|tool mark)\b/i,
      /\b(?:collected|recovered|seized|found at the scene|bagged|tagged)\b/i,
      /\b(?:toxicology|autopsy|medical report|lab results|test results)\b/i,
    ],
  },
  {
    type: 'circumstantial',
    patterns: [
      /\b(?:proximity|motive|opportunity|access|prior relationship)\b/i,
      /\b(?:surveillance|camera|recording|phone records|GPS|cell tower)\b/i,
      /\b(?:inconsistent behavior|fled|concealed|destroyed|altered)\b/i,
    ],
  },
  {
    type: 'burden_proof',
    patterns: [
      /\b(?:beyond a reasonable doubt|preponderance|clear and convincing)\b/i,
      /\b(?:prosecution must prove|burden|element|required showing)\b/i,
    ],
  },
];

// ---------------------------------------------------------------------------
// Classify a statement's evidence type (deterministic)
// ---------------------------------------------------------------------------

function classifyEvidence(text: string): { classification: EvidenceClassification; score: number } {
  let bestClassification: EvidenceClassification = 'act';
  let bestScore = 0;

  for (const rule of CLASSIFICATION_PATTERNS) {
    let matchCount = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) matchCount++;
    }
    if (matchCount > 0) {
      const score = (matchCount / rule.patterns.length) * rule.weight;
      if (score > bestScore) {
        bestScore = score;
        bestClassification = rule.classification;
      }
    }
  }

  return { classification: bestClassification, score: bestScore };
}

// ---------------------------------------------------------------------------
// Detect narrative type (deterministic)
// ---------------------------------------------------------------------------

function detectNarrativeType(text: string): string {
  let bestType = 'burden_proof';
  let bestMatchCount = 0;

  for (const rule of NARRATIVE_TYPE_PATTERNS) {
    let matchCount = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) matchCount++;
    }
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestType = rule.type;
    }
  }

  return bestType;
}

// ---------------------------------------------------------------------------
// Lexical Matching — match statement text against CALCRIM keywords/aliases
// ---------------------------------------------------------------------------

async function findLexicalMatches(
  normalizedText: string,
  instructionId: string,
): Promise<{ matches: LexicalMatch[]; elementScores: Map<string, number> }> {
  const lowerText = normalizedText.toLowerCase();
  const matches: LexicalMatch[] = [];
  const elementScores = new Map<string, number>();

  // Fetch keywords for this instruction's elements
  const elements = await prisma.calcrimElement.findMany({
    where: { instructionId },
    include: {
      keywords: true,
      aliases: true,
    },
  });

  for (const element of elements) {
    let elementScore = 0;

    // Keyword matching
    for (const kw of element.keywords) {
      if (lowerText.includes(kw.keyword.toLowerCase())) {
        matches.push({
          term: kw.keyword,
          source: 'keyword',
          category: kw.category,
          weight: kw.weight,
        });
        elementScore += kw.weight;
      }
    }

    // Alias matching
    for (const alias of element.aliases) {
      if (lowerText.includes(alias.alias.toLowerCase())) {
        matches.push({
          term: alias.alias,
          source: 'alias',
          category: 'alias',
          weight: 0.7,
        });
        elementScore += 0.7;
      }
    }

    if (elementScore > 0) {
      elementScores.set(element.id, elementScore);
    }
  }

  return { matches, elementScores };
}

// ---------------------------------------------------------------------------
// Confidence Scoring (deterministic)
// ---------------------------------------------------------------------------

function calculateMappingConfidence(
  lexicalMatchCount: number,
  totalKeywordsForElement: number,
  classificationScore: number,
): number {
  if (totalKeywordsForElement === 0) return 0;
  const keywordCoverage = Math.min(1.0, lexicalMatchCount / Math.max(totalKeywordsForElement * 0.3, 1));
  const combined = keywordCoverage * 0.7 + classificationScore * 0.3;
  return Math.max(0.0, Math.min(1.0, Math.round(combined * 100) / 100));
}

function assessBurdenStrength(avgConfidence: number, stmtCount: number): string {
  if (stmtCount === 0) return 'unsupported';
  if (avgConfidence >= 0.7 && stmtCount >= 3) return 'strong';
  if (avgConfidence >= 0.4 && stmtCount >= 2) return 'moderate';
  if (avgConfidence >= 0.2 || stmtCount >= 1) return 'weak';
  return 'unsupported';
}

// ---------------------------------------------------------------------------
// Map a Single Statement to CALCRIM Elements
// ---------------------------------------------------------------------------

export async function mapStatement(
  statementId: string,
  caseId: string,
): Promise<StatementMappingResult> {
  const statement = await prisma.evidenceStatement.findUnique({
    where: { id: statementId },
  });
  if (!statement) throw new Error(`Statement ${statementId} not found`);

  // Get all charges for this case (each links to a CALCRIM instruction)
  const charges = await prisma.charge.findMany({
    where: { caseId },
    include: {
      calcrimInstruction: {
        include: {
          elements: { include: { keywords: true, aliases: true } },
        },
      },
    },
  });

  const { classification, score: classificationScore } = classifyEvidence(statement.normalizedText);
  const mappings: Array<{
    mappingId: string;
    instructionNumber: number;
    elementNumber: number;
    elementLabel: string;
    confidence: number;
    evidenceClassification: EvidenceClassification;
    lexicalTriggerCount: number;
  }> = [];

  for (const charge of charges) {
    if (!charge.calcrimInstruction) continue;
    const instruction = charge.calcrimInstruction;

    const { matches, elementScores } = await findLexicalMatches(
      statement.normalizedText,
      instruction.id,
    );

    for (const element of instruction.elements) {
      const score = elementScores.get(element.id);
      if (!score || score <= 0) continue;

      const elementMatches = matches.filter((m) => {
        const kws = element.keywords.map((k) => k.keyword.toLowerCase());
        const als = element.aliases.map((a) => a.alias.toLowerCase());
        return kws.includes(m.term.toLowerCase()) || als.includes(m.term.toLowerCase());
      });

      const totalKw = element.keywords.length + element.aliases.length;
      const confidence = calculateMappingConfidence(elementMatches.length, totalKw, classificationScore);

      if (confidence < 0.1) continue;

      const prosecutorWeight = element.isEssential ? element.weight * confidence : element.weight * confidence * 0.5;

      const created = await prisma.calcrimElementMapping.create({
        data: {
          statementId: statement.id,
          instructionId: instruction.id,
          elementId: element.id,
          confidence,
          mappingMethod: elementMatches.some((m) => m.source === 'alias') ? 'phrase' : 'lexical',
          lexicalTriggers: JSON.stringify(elementMatches.map((m) => m.term)),
          semanticCategory: classification,
          prosecutorTheoryWeight: Math.round(prosecutorWeight * 100) / 100,
          evidenceClassification: classification,
        },
      });

      mappings.push({
        mappingId: created.id,
        instructionNumber: instruction.instructionNumber,
        elementNumber: element.elementNumber,
        elementLabel: element.label,
        confidence,
        evidenceClassification: classification,
        lexicalTriggerCount: elementMatches.length,
      });
    }
  }

  return {
    statementId: statement.id,
    rawTextPreview: statement.rawText.slice(0, 200) + (statement.rawText.length > 200 ? '...' : ''),
    page: statement.page,
    lineStart: statement.lineStart,
    lineEnd: statement.lineEnd,
    sourceDocumentId: statement.sourceDocumentId,
    mappings,
    unmapped: mappings.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Map All Statements for a Document
// ---------------------------------------------------------------------------

export async function mapDocumentStatements(
  documentId: string,
  caseId: string,
  options?: { limit?: number; offset?: number },
): Promise<DocumentMappingResult> {
  const startTime = Date.now();
  const failures: string[] = [];
  let mappingsGenerated = 0;
  let unmappedCount = 0;
  const confidenceBuckets: Record<string, number> = {
    'high_0.7_1.0': 0,
    'medium_0.4_0.7': 0,
    'low_0.1_0.4': 0,
  };
  const classificationCounts: Record<string, number> = {};
  const instructionCounts = new Map<string, { instructionNumber: number; title: string; count: number }>();

  const statements = await prisma.evidenceStatement.findMany({
    where: { documentId },
    orderBy: [{ page: 'asc' }, { lineStart: 'asc' }],
    take: options?.limit ?? 10000,
    skip: options?.offset ?? 0,
  });

  for (const stmt of statements) {
    try {
      const result = await mapStatement(stmt.id, caseId);

      if (result.unmapped) {
        unmappedCount++;
      }

      for (const m of result.mappings) {
        mappingsGenerated++;

        if (m.confidence >= 0.7) confidenceBuckets['high_0.7_1.0']++;
        else if (m.confidence >= 0.4) confidenceBuckets['medium_0.4_0.7']++;
        else confidenceBuckets['low_0.1_0.4']++;

        classificationCounts[m.evidenceClassification] = (classificationCounts[m.evidenceClassification] || 0) + 1;

        const key = `${m.instructionNumber}`;
        if (!instructionCounts.has(key)) {
          instructionCounts.set(key, { instructionNumber: m.instructionNumber, title: m.elementLabel, count: 0 });
        }
        instructionCounts.get(key)!.count++;
      }
    } catch (err) {
      failures.push(`Statement ${stmt.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    caseId,
    documentId,
    statementsProcessed: statements.length,
    mappingsGenerated,
    unmappedStatements: unmappedCount,
    confidenceDistribution: confidenceBuckets,
    classificationDistribution: classificationCounts,
    instructionCoverage: Array.from(instructionCounts.values()).map((v) => ({
      instructionNumber: v.instructionNumber,
      title: v.title,
      mappingCount: v.count,
    })),
    processingTimeMs: Date.now() - startTime,
    failures,
  };
}

// ---------------------------------------------------------------------------
// Get Mappings for a Statement
// ---------------------------------------------------------------------------

export async function getStatementMappings(statementId: string): Promise<{
  statementId: string;
  statement: Record<string, unknown> | null;
  mappings: Array<Record<string, unknown>>;
}> {
  const statement = await prisma.evidenceStatement.findUnique({
    where: { id: statementId },
    include: { citations: true, speakers: true, timestamps: true },
  });

  const mappings = await prisma.calcrimElementMapping.findMany({
    where: { statementId },
    orderBy: { confidence: 'desc' },
  });

  return { statementId, statement, mappings };
}

// ---------------------------------------------------------------------------
// Build Narrative Clusters for a Case
// ---------------------------------------------------------------------------

export async function buildNarrativeClusters(caseId: string): Promise<{
  caseId: string;
  clustersCreated: number;
  clusters: Array<{
    clusterId: string;
    instructionId: string;
    narrativeType: string;
    statementCount: number;
    confidence: number;
  }>;
}> {
  // Get all mapped statements for this case
  const mappings = await prisma.calcrimElementMapping.findMany({
    where: {
      statementId: {
        in: (await prisma.evidenceStatement.findMany({
          where: { caseId },
          select: { id: true },
        })).map((s) => s.id),
      },
    },
    orderBy: { confidence: 'desc' },
  });

  // Group by instruction
  const byInstruction = new Map<string, typeof mappings>();
  for (const m of mappings) {
    const arr = byInstruction.get(m.instructionId) || [];
    arr.push(m);
    byInstruction.set(m.instructionId, arr);
  }

  const clusters: Array<{
    clusterId: string;
    instructionId: string;
    narrativeType: string;
    statementCount: number;
    confidence: number;
  }> = [];

  for (const [instructionId, instrMappings] of byInstruction.entries()) {
    // Group statements by narrative type
    const stmtIds = [...new Set(instrMappings.map((m) => m.statementId))];
    const statements = await prisma.evidenceStatement.findMany({
      where: { id: { in: stmtIds } },
    });

    // Detect narrative types across statements
    const typeGroups = new Map<string, typeof statements>();
    for (const stmt of statements) {
      const narrativeType = detectNarrativeType(stmt.normalizedText);
      const arr = typeGroups.get(narrativeType) || [];
      arr.push(stmt);
      typeGroups.set(narrativeType, arr);
    }

    for (const [narrativeType, groupStatements] of typeGroups.entries()) {
      if (groupStatements.length === 0) continue;

      const avgConfidence = instrMappings
        .filter((m) => groupStatements.some((s) => s.id === m.statementId))
        .reduce((sum, m) => sum + m.confidence, 0) /
        Math.max(
          instrMappings.filter((m) => groupStatements.some((s) => s.id === m.statementId)).length,
          1,
        );

      const elementIds = [...new Set(instrMappings
        .filter((m) => groupStatements.some((s) => s.id === m.statementId))
        .map((m) => m.elementId))];

      // Delete existing cluster for this instruction+type if any
      const existing = await prisma.calcrimNarrativeCluster.findFirst({
        where: { caseId, instructionId, narrativeType },
      });
      if (existing) {
        await prisma.narrativeClusterStatement.deleteMany({ where: { clusterId: existing.id } });
        await prisma.calcrimNarrativeCluster.delete({ where: { id: existing.id } });
      }

      const cluster = await prisma.calcrimNarrativeCluster.create({
        data: {
          caseId,
          instructionId,
          narrativeType,
          confidence: Math.round(avgConfidence * 100) / 100,
          totalStatements: groupStatements.length,
          elementsCovered: JSON.stringify(elementIds),
        },
      });

      // Link statements to cluster
      for (const stmt of groupStatements) {
        const stmtMappings = instrMappings.filter((m) => m.statementId === stmt.id);
        const relevance = stmtMappings.length > 0
          ? stmtMappings.reduce((sum, m) => sum + m.confidence, 0) / stmtMappings.length
          : 0;

        await prisma.narrativeClusterStatement.create({
          data: {
            clusterId: cluster.id,
            statementId: stmt.id,
            relevanceScore: Math.round(relevance * 100) / 100,
          },
        });
      }

      clusters.push({
        clusterId: cluster.id,
        instructionId,
        narrativeType,
        statementCount: groupStatements.length,
        confidence: Math.round(avgConfidence * 100) / 100,
      });
    }
  }

  return { caseId, clustersCreated: clusters.length, clusters };
}

// ---------------------------------------------------------------------------
// Get Prosecutor Theory for a Case
// ---------------------------------------------------------------------------

export async function getProsecutorTheory(caseId: string): Promise<ProsecutorTheoryResult> {
  const charges = await prisma.charge.findMany({
    where: { caseId },
    include: {
      calcrimInstruction: {
        include: {
          elements: { orderBy: { elementNumber: 'asc' } },
        },
      },
    },
  });

  const instructions: ProsecutorTheoryResult['instructions'] = [];

  for (const charge of charges) {
    if (!charge.calcrimInstruction) continue;
    const instruction = charge.calcrimInstruction;

    const elements: ProsecutorTheoryResult['instructions'][0]['elements'] = [];

    for (const element of instruction.elements) {
      const mappings = await prisma.calcrimElementMapping.findMany({
        where: { elementId: element.id },
        orderBy: { confidence: 'desc' },
      });

      const stmtIds = [...new Set(mappings.map((m) => m.statementId))];
      const statements = stmtIds.length > 0
        ? await prisma.evidenceStatement.findMany({ where: { id: { in: stmtIds } } })
        : [];

      const supportingStatements = statements.map((stmt) => {
        const mapping = mappings.find((m) => m.statementId === stmt.id);
        return {
          statementId: stmt.id,
          rawTextPreview: stmt.rawText.slice(0, 200) + (stmt.rawText.length > 200 ? '...' : ''),
          page: stmt.page,
          lineStart: stmt.lineStart,
          lineEnd: stmt.lineEnd,
          speaker: stmt.speaker,
          confidence: mapping?.confidence ?? 0,
          evidenceClassification: (mapping?.evidenceClassification ?? 'act') as EvidenceClassification,
        };
      });

      const avgConf = supportingStatements.length > 0
        ? supportingStatements.reduce((s, x) => s + x.confidence, 0) / supportingStatements.length
        : 0;

      elements.push({
        elementId: element.id,
        elementNumber: element.elementNumber,
        label: element.label,
        prosecutionBurden: element.prosecutionBurden,
        supportingStatements,
        statementCount: supportingStatements.length,
        averageConfidence: Math.round(avgConf * 100) / 100,
        burdenStrength: assessBurdenStrength(avgConf, supportingStatements.length),
      });
    }

    const strengthCounts = elements.map((e) => e.burdenStrength);
    let overall = 'strong';
    if (strengthCounts.includes('unsupported')) overall = 'incomplete';
    else if (strengthCounts.filter((s) => s === 'weak').length > elements.length * 0.5) overall = 'weak';
    else if (strengthCounts.includes('weak')) overall = 'moderate';

    instructions.push({
      instructionId: instruction.id,
      instructionNumber: instruction.instructionNumber,
      title: instruction.title,
      elements,
      overallBurdenAssessment: overall,
    });
  }

  // Get narrative clusters
  const clusters = await prisma.calcrimNarrativeCluster.findMany({
    where: { caseId },
    include: { _count: { select: { clusterStatements: true } } },
  });

  return {
    caseId,
    instructions,
    narrativeClusters: clusters.map((c) => ({
      clusterId: c.id,
      narrativeType: c.narrativeType,
      prosecutionTheory: c.prosecutionTheory,
      statementCount: c._count.clusterStatements,
      confidence: c.confidence,
    })),
  };
}

// ---------------------------------------------------------------------------
// Get Narrative Clusters for a Case
// ---------------------------------------------------------------------------

export async function getCaseNarratives(caseId: string): Promise<{
  caseId: string;
  clusters: Array<{
    clusterId: string;
    instructionId: string;
    narrativeType: string;
    prosecutionTheory: string | null;
    confidence: number;
    totalStatements: number;
    statements: Array<{
      statementId: string;
      rawTextPreview: string;
      page: number | null;
      lineStart: number | null;
      relevanceScore: number;
    }>;
  }>;
}> {
  const clusters = await prisma.calcrimNarrativeCluster.findMany({
    where: { caseId },
    include: {
      clusterStatements: {
        orderBy: { relevanceScore: 'desc' },
      },
    },
  });

  const result = [];
  for (const cluster of clusters) {
    const stmtIds = cluster.clusterStatements.map((cs) => cs.statementId);
    const statements = stmtIds.length > 0
      ? await prisma.evidenceStatement.findMany({ where: { id: { in: stmtIds } } })
      : [];

    result.push({
      clusterId: cluster.id,
      instructionId: cluster.instructionId,
      narrativeType: cluster.narrativeType,
      prosecutionTheory: cluster.prosecutionTheory,
      confidence: cluster.confidence,
      totalStatements: cluster.totalStatements,
      statements: cluster.clusterStatements.map((cs) => {
        const stmt = statements.find((s) => s.id === cs.statementId);
        return {
          statementId: cs.statementId,
          rawTextPreview: stmt ? stmt.rawText.slice(0, 200) + (stmt.rawText.length > 200 ? '...' : '') : '',
          page: stmt?.page ?? null,
          lineStart: stmt?.lineStart ?? null,
          relevanceScore: cs.relevanceScore,
        };
      }),
    });
  }

  return { caseId, clusters: result };
}

// ---------------------------------------------------------------------------
// Rebuild All Mappings for a Case
// ---------------------------------------------------------------------------

export async function rebuildCaseMappings(caseId: string): Promise<{
  caseId: string;
  deletedMappings: number;
  deletedClusters: number;
  newMappings: number;
  newClusters: number;
  processingTimeMs: number;
}> {
  const startTime = Date.now();

  // Get all statement IDs for this case
  const stmtIds = (await prisma.evidenceStatement.findMany({
    where: { caseId },
    select: { id: true },
  })).map((s) => s.id);

  // Delete existing mappings
  const deletedMappings = await prisma.calcrimElementMapping.deleteMany({
    where: { statementId: { in: stmtIds } },
  });

  // Delete existing clusters
  const existingClusters = await prisma.calcrimNarrativeCluster.findMany({
    where: { caseId },
    select: { id: true },
  });
  const clusterIds = existingClusters.map((c) => c.id);
  await prisma.narrativeClusterStatement.deleteMany({ where: { clusterId: { in: clusterIds } } });
  const deletedClusters = await prisma.calcrimNarrativeCluster.deleteMany({ where: { caseId } });

  // Re-map all statements
  let newMappings = 0;
  for (const stmtId of stmtIds) {
    try {
      const result = await mapStatement(stmtId, caseId);
      newMappings += result.mappings.length;
    } catch {
      // Skip failed statements
    }
  }

  // Rebuild clusters
  const clusterResult = await buildNarrativeClusters(caseId);

  return {
    caseId,
    deletedMappings: deletedMappings.count,
    deletedClusters: deletedClusters.count,
    newMappings,
    newClusters: clusterResult.clustersCreated,
    processingTimeMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Validation Report Generator
// ---------------------------------------------------------------------------

export async function generateMappingValidationReport(): Promise<Record<string, unknown>> {
  const totalMappings = await prisma.calcrimElementMapping.count();
  const totalClusters = await prisma.calcrimNarrativeCluster.count();
  const totalClusterStatements = await prisma.narrativeClusterStatement.count();
  const totalStatements = await prisma.evidenceStatement.count();

  const mappedStmtIds = await prisma.calcrimElementMapping.findMany({
    select: { statementId: true },
    distinct: ['statementId'],
  });
  const unmappedCount = totalStatements - mappedStmtIds.length;

  const byMethod = await prisma.calcrimElementMapping.groupBy({
    by: ['mappingMethod'],
    _count: true,
  });

  const byClassification = await prisma.calcrimElementMapping.groupBy({
    by: ['evidenceClassification'],
    _count: true,
    _avg: { confidence: true },
  });

  const byCategory = await prisma.calcrimElementMapping.groupBy({
    by: ['semanticCategory'],
    _count: true,
  });

  const highConf = await prisma.calcrimElementMapping.count({ where: { confidence: { gte: 0.7 } } });
  const medConf = await prisma.calcrimElementMapping.count({ where: { confidence: { gte: 0.4, lt: 0.7 } } });
  const lowConf = await prisma.calcrimElementMapping.count({ where: { confidence: { lt: 0.4 } } });

  const byNarrativeType = await prisma.calcrimNarrativeCluster.groupBy({
    by: ['narrativeType'],
    _count: true,
    _avg: { confidence: true },
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalMappings,
      totalStatements,
      mappedStatements: mappedStmtIds.length,
      unmappedStatements: unmappedCount,
      mappingRate: totalStatements > 0
        ? Math.round((mappedStmtIds.length / totalStatements) * 10000) / 100
        : 0,
      narrativeClusters: totalClusters,
      clusterStatements: totalClusterStatements,
    },
    confidenceDistribution: {
      high: highConf,
      medium: medConf,
      low: lowConf,
    },
    byMappingMethod: byMethod.map((m) => ({
      method: m.mappingMethod,
      count: m._count,
    })),
    byEvidenceClassification: byClassification.map((c) => ({
      classification: c.evidenceClassification,
      count: c._count,
      avgConfidence: Math.round((c._avg.confidence ?? 0) * 100) / 100,
    })),
    bySemanticCategory: byCategory.map((c) => ({
      category: c.semanticCategory,
      count: c._count,
    })),
    byNarrativeType: byNarrativeType.map((n) => ({
      type: n.narrativeType,
      count: n._count,
      avgConfidence: Math.round((n._avg.confidence ?? 0) * 100) / 100,
    })),
    deterministicConstraints: {
      noLLMInference: true,
      noGenerativeReasoning: true,
      noHallucinatedElementAssignment: true,
      noProbabilisticFreeformAI: true,
      allowedMethods: ['lexical', 'phrase', 'ontology', 'keyword', 'regex', 'manual'],
    },
  };
}
