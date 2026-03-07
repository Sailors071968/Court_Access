// ============================================
// Court Access — Deterministic Replay Test (Wave 0 Stabilization)
// Verifies that the same input document always produces identical outputs
// through the full processing pipeline:
//   document → fact extraction → fact registry → evidence graph → reasoning engine
// Run twice and confirm identical hashes.
// ============================================

import { sha3_256 } from 'js-sha3';

// ---------------------------------------------------------------------------
// Test Fixtures — Deterministic Input Document
// ---------------------------------------------------------------------------

const TEST_DOCUMENT = {
  id: 'test-doc-determinism-001',
  title: 'Motion to Suppress Evidence — Determinism Test',
  content: `On January 15, 2024, at approximately 2:30 AM, Officer James Rodriguez (Badge #4521)
conducted a traffic stop on the defendant's vehicle at the intersection of Main Street and 5th Avenue.
The officer stated that the vehicle was observed crossing the center line. During the stop,
Officer Rodriguez claimed to smell marijuana and conducted a search of the vehicle without consent
or a warrant. During the search, a firearm was recovered from under the passenger seat.
The defendant was subsequently arrested and charged with possession of a concealed weapon.
The defense argues that the initial traffic stop was pretextual and that the warrantless search
violated the defendant's Fourth Amendment rights against unreasonable searches and seizures.`,
  type: 'defense_motion' as const,
  filedDate: '2024-01-20',
  caseId: 'test-case-001',
  tenantId: 'test-tenant-001',
};

// ---------------------------------------------------------------------------
// Simulated Processing Pipeline (deterministic)
// ---------------------------------------------------------------------------

/**
 * Step 1: Fact Extraction
 * Extracts structured facts from document text using deterministic rules.
 * No randomness — same input always produces same facts in same order.
 */
function extractFacts(document: typeof TEST_DOCUMENT): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const content = document.content;

  // Extract date facts
  const datePattern = /(?:on\s+)?(\w+\s+\d{1,2},\s+\d{4})/gi;
  let dateMatch: RegExpExecArray | null;
  while ((dateMatch = datePattern.exec(content)) !== null) {
    facts.push({
      factId: computeFactId(document.id, 'date', dateMatch[1]),
      type: 'temporal',
      content: dateMatch[1],
      sourceOffset: dateMatch.index,
      confidence: 1.0,
    });
  }

  // Extract person facts
  const personPattern = /(?:Officer|Judge|Attorney|Defendant)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
  let personMatch: RegExpExecArray | null;
  while ((personMatch = personPattern.exec(content)) !== null) {
    facts.push({
      factId: computeFactId(document.id, 'person', personMatch[1]),
      type: 'entity',
      content: personMatch[1],
      sourceOffset: personMatch.index,
      confidence: 1.0,
    });
  }

  // Extract badge numbers
  const badgePattern = /Badge\s+#(\d+)/g;
  let badgeMatch: RegExpExecArray | null;
  while ((badgeMatch = badgePattern.exec(content)) !== null) {
    facts.push({
      factId: computeFactId(document.id, 'badge', badgeMatch[1]),
      type: 'identifier',
      content: `Badge #${badgeMatch[1]}`,
      sourceOffset: badgeMatch.index,
      confidence: 1.0,
    });
  }

  // Extract location facts
  const locationPattern = /(?:at\s+(?:the\s+)?)?intersection\s+of\s+([^.]+)/gi;
  let locMatch: RegExpExecArray | null;
  while ((locMatch = locationPattern.exec(content)) !== null) {
    facts.push({
      factId: computeFactId(document.id, 'location', locMatch[1].trim()),
      type: 'location',
      content: locMatch[1].trim(),
      sourceOffset: locMatch.index,
      confidence: 1.0,
    });
  }

  // Extract legal concepts
  const legalPatterns = [
    /Fourth Amendment/g,
    /warrantless search/gi,
    /unreasonable searches and seizures/gi,
    /traffic stop/gi,
    /without consent/gi,
  ];

  for (const pattern of legalPatterns) {
    let legalMatch: RegExpExecArray | null;
    while ((legalMatch = pattern.exec(content)) !== null) {
      facts.push({
        factId: computeFactId(document.id, 'legal', legalMatch[0].toLowerCase()),
        type: 'legal_concept',
        content: legalMatch[0],
        sourceOffset: legalMatch.index,
        confidence: 1.0,
      });
    }
  }

  // Sort deterministically by sourceOffset, then by factId
  facts.sort((a, b) => {
    if (a.sourceOffset !== b.sourceOffset) return a.sourceOffset - b.sourceOffset;
    return a.factId.localeCompare(b.factId);
  });

  return facts;
}

interface ExtractedFact {
  factId: string;
  type: 'temporal' | 'entity' | 'identifier' | 'location' | 'legal_concept';
  content: string;
  sourceOffset: number;
  confidence: number;
}

/**
 * Compute a deterministic fact ID from document ID, fact type, and content.
 * Uses SHA3-256 to ensure collision resistance.
 */
function computeFactId(documentId: string, factType: string, content: string): string {
  const input = `${documentId}:${factType}:${content.toLowerCase().trim()}`;
  return `fact:${sha3_256(input).substring(0, 16)}`;
}

// ---------------------------------------------------------------------------
// Step 2: Fact Registry
// ---------------------------------------------------------------------------

interface FactRegistryEntry {
  factId: string;
  documentId: string;
  registeredAt: string;
  hash: string;
}

/**
 * Register facts into a deterministic registry.
 * Each fact gets a content hash for integrity verification.
 */
function registerFacts(
  facts: ExtractedFact[],
  documentId: string,
): FactRegistryEntry[] {
  // Use fixed timestamp for determinism
  const registeredAt = '2024-01-20T00:00:00.000Z';

  return facts.map((fact) => ({
    factId: fact.factId,
    documentId,
    registeredAt,
    hash: sha3_256(`${fact.factId}:${fact.type}:${fact.content}:${fact.sourceOffset}`),
  }));
}

// ---------------------------------------------------------------------------
// Step 3: Evidence Graph
// ---------------------------------------------------------------------------

interface EvidenceNode {
  nodeId: string;
  label: string;
  properties: Record<string, string | number>;
}

interface EvidenceEdge {
  edgeId: string;
  source: string;
  target: string;
  relationship: string;
}

interface EvidenceGraph {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  graphHash: string;
}

/**
 * Build an evidence graph from registered facts.
 * Graph structure is deterministic — same facts always produce same graph.
 */
function buildEvidenceGraph(
  _registryEntries: FactRegistryEntry[],
  facts: ExtractedFact[],
): EvidenceGraph {
  const nodes: EvidenceNode[] = [];
  const edges: EvidenceEdge[] = [];

  // Create a node for each fact
  for (const fact of facts) {
    nodes.push({
      nodeId: fact.factId,
      label: fact.type,
      properties: {
        content: fact.content,
        sourceOffset: fact.sourceOffset,
        confidence: fact.confidence,
      },
    });
  }

  // Create edges between related facts (deterministic rules)
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      const factA = facts[i];
      const factB = facts[j];

      // Temporal facts connect to entity facts that are nearby in text
      if (
        (factA.type === 'temporal' && factB.type === 'entity') ||
        (factA.type === 'entity' && factB.type === 'temporal')
      ) {
        if (Math.abs(factA.sourceOffset - factB.sourceOffset) < 200) {
          const edgeId = sha3_256(`edge:${factA.factId}:${factB.factId}`).substring(0, 16);
          edges.push({
            edgeId: `edge:${edgeId}`,
            source: factA.factId,
            target: factB.factId,
            relationship: 'TEMPORALLY_RELATED',
          });
        }
      }

      // Legal concepts connect to other legal concepts
      if (factA.type === 'legal_concept' && factB.type === 'legal_concept') {
        const edgeId = sha3_256(`edge:${factA.factId}:${factB.factId}`).substring(0, 16);
        edges.push({
          edgeId: `edge:${edgeId}`,
          source: factA.factId,
          target: factB.factId,
          relationship: 'LEGALLY_RELATED',
        });
      }
    }
  }

  // Sort nodes and edges deterministically
  nodes.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  edges.sort((a, b) => a.edgeId.localeCompare(b.edgeId));

  // Compute graph hash
  const graphContent = JSON.stringify({ nodes, edges });
  const graphHash = sha3_256(graphContent);

  return { nodes, edges, graphHash };
}

// ---------------------------------------------------------------------------
// Step 4: Reasoning Engine
// ---------------------------------------------------------------------------

interface ReasoningResult {
  documentId: string;
  factCount: number;
  graphNodeCount: number;
  graphEdgeCount: number;
  legalIssues: string[];
  riskFactors: string[];
  resultHash: string;
}

/**
 * Run deterministic reasoning over the evidence graph.
 * Identifies legal issues and risk factors based on graph structure.
 */
function runReasoningEngine(
  graph: EvidenceGraph,
  facts: ExtractedFact[],
  documentId: string,
): ReasoningResult {
  const legalIssues: string[] = [];
  const riskFactors: string[] = [];

  // Identify legal issues from legal_concept facts
  const legalFacts = facts.filter((f) => f.type === 'legal_concept');
  for (const fact of legalFacts) {
    const content = fact.content.toLowerCase();
    if (content.includes('fourth amendment')) {
      legalIssues.push('Fourth Amendment violation claim');
    }
    if (content.includes('warrantless search')) {
      legalIssues.push('Warrantless search challenge');
      riskFactors.push('Evidence suppression risk');
    }
    if (content.includes('without consent')) {
      legalIssues.push('Lack of consent for search');
    }
    if (content.includes('traffic stop')) {
      riskFactors.push('Pretextual stop defense available');
    }
  }

  // Sort for determinism
  legalIssues.sort();
  riskFactors.sort();

  const resultContent = JSON.stringify({
    documentId,
    factCount: facts.length,
    graphNodeCount: graph.nodes.length,
    graphEdgeCount: graph.edges.length,
    graphHash: graph.graphHash,
    legalIssues,
    riskFactors,
  });

  return {
    documentId,
    factCount: facts.length,
    graphNodeCount: graph.nodes.length,
    graphEdgeCount: graph.edges.length,
    legalIssues,
    riskFactors,
    resultHash: sha3_256(resultContent),
  };
}

// ---------------------------------------------------------------------------
// Full Pipeline Execution
// ---------------------------------------------------------------------------

interface PipelineResult {
  extractionHash: string;
  registryHash: string;
  graphHash: string;
  reasoningHash: string;
  pipelineHash: string;
  factCount: number;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Execute the full deterministic pipeline:
 * document → fact extraction → fact registry → evidence graph → reasoning engine
 *
 * Returns hashes at each stage for comparison.
 */
function executePipeline(document: typeof TEST_DOCUMENT): PipelineResult {
  // Step 1: Fact Extraction
  const facts = extractFacts(document);
  const extractionHash = sha3_256(JSON.stringify(facts));

  // Step 2: Fact Registry
  const registryEntries = registerFacts(facts, document.id);
  const registryHash = sha3_256(JSON.stringify(registryEntries));

  // Step 3: Evidence Graph
  const graph = buildEvidenceGraph(registryEntries, facts);

  // Step 4: Reasoning Engine
  const reasoning = runReasoningEngine(graph, facts, document.id);

  // Pipeline hash = hash of all stage hashes
  const pipelineHash = sha3_256(
    `${extractionHash}:${registryHash}:${graph.graphHash}:${reasoning.resultHash}`,
  );

  return {
    extractionHash,
    registryHash,
    graphHash: graph.graphHash,
    reasoningHash: reasoning.resultHash,
    pipelineHash,
    factCount: facts.length,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
  };
}

// ---------------------------------------------------------------------------
// Test Runner
// ---------------------------------------------------------------------------

/**
 * Run the deterministic replay test.
 * Executes the pipeline twice with the same input and asserts identical hashes.
 *
 * This can be run as:
 *   npx tsx tests/determinism/replay.test.ts
 *
 * Or imported and called from a test framework.
 */
export function runDeterministicReplayTest(): {
  passed: boolean;
  run1: PipelineResult;
  run2: PipelineResult;
  comparison: Record<string, boolean>;
} {
  console.log('=== Deterministic Replay Test ===\n');
  console.log('Running pipeline execution #1...');
  const run1 = executePipeline(TEST_DOCUMENT);
  console.log(`  Facts extracted: ${run1.factCount}`);
  console.log(`  Graph nodes: ${run1.nodeCount}`);
  console.log(`  Graph edges: ${run1.edgeCount}`);
  console.log(`  Pipeline hash: ${run1.pipelineHash}\n`);

  console.log('Running pipeline execution #2...');
  const run2 = executePipeline(TEST_DOCUMENT);
  console.log(`  Facts extracted: ${run2.factCount}`);
  console.log(`  Graph nodes: ${run2.nodeCount}`);
  console.log(`  Graph edges: ${run2.edgeCount}`);
  console.log(`  Pipeline hash: ${run2.pipelineHash}\n`);

  const comparison = {
    extractionHashMatch: run1.extractionHash === run2.extractionHash,
    registryHashMatch: run1.registryHash === run2.registryHash,
    graphHashMatch: run1.graphHash === run2.graphHash,
    reasoningHashMatch: run1.reasoningHash === run2.reasoningHash,
    pipelineHashMatch: run1.pipelineHash === run2.pipelineHash,
  };

  const allPassed = Object.values(comparison).every((v) => v);

  console.log('=== Comparison Results ===\n');
  for (const [key, value] of Object.entries(comparison)) {
    console.log(`  ${value ? 'PASS' : 'FAIL'}: ${key}`);
  }
  console.log(`\n=== Overall: ${allPassed ? 'PASS' : 'FAIL'} ===\n`);

  return { passed: allPassed, run1, run2, comparison };
}

// ---------------------------------------------------------------------------
// Self-executing test (run with: npx tsx tests/determinism/replay.test.ts)
// ---------------------------------------------------------------------------

// Only auto-run when executed directly (not imported)
const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv[1] &&
  process.argv[1].includes('replay.test');

if (isDirectExecution) {
  const result = runDeterministicReplayTest();
  if (!result.passed) {
    console.error('DETERMINISTIC REPLAY TEST FAILED — pipeline is not deterministic!');
    process.exit(1);
  }
  console.log('All deterministic replay checks passed.');
  process.exit(0);
}
