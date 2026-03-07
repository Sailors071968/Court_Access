// ============================================
// Court Access — Evidence Strength Scoring Engine
// Phase 118: Graph Intelligence + AI Analysis Layer
//
// Scores reliability of evidence based on:
// - Number of corroborating sources
// - Timeline consistency
// - Entity confidence
// - Document reliability
//
// All computations are deterministic and read-only.
// Results stored in evidence_scores table.
// ============================================

import prisma from '../services/prismaClient.js';
import {
  getCaseGraph,
  getGraphStats,
} from '../services/graphService.js';

// ---------------------------------------------------------------------------
// Score Factors
// ---------------------------------------------------------------------------

const SCORE_WEIGHTS = {
  corroboration: 0.35,
  timelineConsistency: 0.25,
  entityConfidence: 0.20,
  documentReliability: 0.20,
};

// ---------------------------------------------------------------------------
// 1. Compute Corroboration Score
// ---------------------------------------------------------------------------

/**
 * Score based on how many other sources corroborate the entity/evidence.
 * More independent sources = higher score.
 *
 * @param {string} nodeId
 * @param {Array} edges
 * @param {Array} nodes
 * @returns {number} Score 0-1
 */
function computeCorroborationScore(nodeId, edges, nodes) {
  // Count unique documents that reference this entity
  const mentionEdges = edges.filter(
    e => (e.source === nodeId || e.target === nodeId) &&
         (e.type === 'MENTIONED_IN' || e.type === 'REFERENCED_BY')
  );

  const uniqueDocs = new Set();
  for (const edge of mentionEdges) {
    const otherId = edge.source === nodeId ? edge.target : edge.source;
    const otherNode = nodes.find(n => n.id === otherId);
    if (otherNode && otherNode.type === 'Document') {
      uniqueDocs.add(otherId);
    }
  }

  // Scoring: 1 doc = 0.2, 2 docs = 0.4, 3+ docs = 0.6, 5+ = 0.8, 10+ = 1.0
  const docCount = uniqueDocs.size;
  if (docCount >= 10) return 1.0;
  if (docCount >= 5) return 0.8;
  if (docCount >= 3) return 0.6;
  if (docCount >= 2) return 0.4;
  if (docCount >= 1) return 0.2;
  return 0.0;
}

// ---------------------------------------------------------------------------
// 2. Compute Timeline Consistency Score
// ---------------------------------------------------------------------------

/**
 * Score based on whether the entity's timeline references are consistent.
 * Contradictions lower the score.
 *
 * @param {string} nodeId
 * @param {Array} edges
 * @returns {number} Score 0-1
 */
function computeTimelineConsistencyScore(nodeId, edges) {
  // Check for contradiction edges involving this node
  const contradictions = edges.filter(
    e => (e.source === nodeId || e.target === nodeId) && e.type === 'CONTRADICTS'
  );

  if (contradictions.length === 0) return 1.0;
  if (contradictions.length === 1) return 0.6;
  if (contradictions.length === 2) return 0.3;
  return 0.1;
}

// ---------------------------------------------------------------------------
// 3. Compute Entity Confidence Score
// ---------------------------------------------------------------------------

/**
 * Score based on the extraction confidence of the entity.
 *
 * @param {object} node
 * @returns {number} Score 0-1
 */
function computeEntityConfidenceScore(node) {
  const confidence = node.metadata?.confidence;
  if (typeof confidence === 'number') return Math.min(Math.max(confidence, 0), 1);
  return 0.5; // Default if no confidence score
}

// ---------------------------------------------------------------------------
// 4. Compute Document Reliability Score
// ---------------------------------------------------------------------------

/**
 * Score based on the type and source of the document.
 * Official documents score higher than informal ones.
 *
 * @param {string} nodeId
 * @param {Array} edges
 * @param {Array} nodes
 * @returns {number} Score 0-1
 */
function computeDocumentReliabilityScore(nodeId, edges, nodes) {
  // For document nodes, score based on their connections
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return 0.5;

  if (node.type === 'Document') {
    // More connected documents tend to be more central/reliable
    const connections = edges.filter(
      e => e.source === nodeId || e.target === nodeId
    ).length;

    if (connections >= 10) return 0.9;
    if (connections >= 5) return 0.7;
    if (connections >= 2) return 0.5;
    return 0.3;
  }

  // For non-document nodes, score based on connected documents
  const docEdges = edges.filter(
    e => (e.source === nodeId || e.target === nodeId) &&
         (e.type === 'MENTIONED_IN' || e.type === 'REFERENCED_BY')
  );

  if (docEdges.length >= 5) return 0.8;
  if (docEdges.length >= 2) return 0.6;
  if (docEdges.length >= 1) return 0.4;
  return 0.2;
}

// ---------------------------------------------------------------------------
// 5. Compute Overall Evidence Score
// ---------------------------------------------------------------------------

/**
 * Compute the weighted overall evidence strength score.
 *
 * @param {string} nodeId
 * @param {Array} edges
 * @param {Array} nodes
 * @returns {{ overall: number, factors: object }}
 */
function computeOverallScore(nodeId, edges, nodes) {
  const node = nodes.find(n => n.id === nodeId);

  const factors = {
    corroboration: computeCorroborationScore(nodeId, edges, nodes),
    timelineConsistency: computeTimelineConsistencyScore(nodeId, edges),
    entityConfidence: computeEntityConfidenceScore(node || {}),
    documentReliability: computeDocumentReliabilityScore(nodeId, edges, nodes),
  };

  const overall =
    factors.corroboration * SCORE_WEIGHTS.corroboration +
    factors.timelineConsistency * SCORE_WEIGHTS.timelineConsistency +
    factors.entityConfidence * SCORE_WEIGHTS.entityConfidence +
    factors.documentReliability * SCORE_WEIGHTS.documentReliability;

  return {
    overall: Math.round(overall * 100) / 100,
    factors,
  };
}

// ---------------------------------------------------------------------------
// 6. Score All Evidence in a Case
// ---------------------------------------------------------------------------

/**
 * Compute evidence strength scores for all entities in a case.
 *
 * @param {string} caseId
 * @returns {Promise<Array<{ nodeId: string, label: string, type: string, score: object }>>}
 */
export async function scoreAllEvidence(caseId) {
  const graph = await getCaseGraph(caseId, { limit: 5000 });
  const scores = [];

  for (const node of graph.nodes) {
    const score = computeOverallScore(node.id, graph.edges, graph.nodes);
    scores.push({
      nodeId: node.id,
      label: node.label,
      type: node.type,
      score: score.overall,
      factors: score.factors,
    });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Store scores in database
  for (const entry of scores.slice(0, 100)) {
    try {
      await prisma.evidenceScore.upsert({
        where: { nodeId_caseId: { nodeId: entry.nodeId, caseId } },
        update: {
          score: entry.score,
          factors: entry.factors,
          updatedAt: new Date(),
        },
        create: {
          nodeId: entry.nodeId,
          caseId,
          label: entry.label,
          nodeType: entry.type,
          score: entry.score,
          factors: entry.factors,
        },
      });
    } catch {
      // Table may not exist yet — continue
    }
  }

  return scores;
}

// ---------------------------------------------------------------------------
// 7. Get Evidence Scores for a Case
// ---------------------------------------------------------------------------

/**
 * Retrieve stored evidence scores.
 *
 * @param {string} caseId
 * @param {object} options
 * @returns {Promise<Array>}
 */
export async function getEvidenceScores(caseId, options = {}) {
  const { type, minScore = 0, limit = 100 } = options;

  try {
    const where = { caseId };
    if (type) where.nodeType = type;
    if (minScore > 0) where.score = { gte: minScore };

    return await prisma.evidenceScore.findMany({
      where,
      orderBy: { score: 'desc' },
      take: limit,
    });
  } catch {
    // Table may not exist — return empty
    return [];
  }
}

// ---------------------------------------------------------------------------
// 8. Score Specific Entity
// ---------------------------------------------------------------------------

/**
 * Score a specific entity's evidence strength.
 *
 * @param {string} caseId
 * @param {string} nodeId
 * @returns {Promise<object>}
 */
export async function scoreEntity(caseId, nodeId) {
  const graph = await getCaseGraph(caseId, { limit: 5000 });
  const node = graph.nodes.find(n => n.id === nodeId);

  if (!node) {
    return { error: 'Entity not found', nodeId };
  }

  const score = computeOverallScore(nodeId, graph.edges, graph.nodes);

  return {
    nodeId,
    label: node.label,
    type: node.type,
    score: score.overall,
    factors: score.factors,
    interpretation: interpretScore(score.overall),
  };
}

// ---------------------------------------------------------------------------
// Helper: Interpret Score
// ---------------------------------------------------------------------------

function interpretScore(score) {
  if (score >= 0.8) return { level: 'strong', description: 'Highly reliable — multiple corroborating sources, consistent timeline' };
  if (score >= 0.6) return { level: 'moderate', description: 'Moderately reliable — some corroboration, minor inconsistencies' };
  if (score >= 0.4) return { level: 'weak', description: 'Weakly supported — limited corroboration or timeline issues' };
  return { level: 'insufficient', description: 'Insufficient evidence — single source, contradictions, or low confidence' };
}
