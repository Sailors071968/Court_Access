// ============================================
// Court Access — AI Analysis Service
// Phase 118: Graph Intelligence + AI Analysis Layer
//
// Controlled LLM usage for case analysis.
// Uses Phase 117 prompt templates + OpenAI API.
//
// Supported analyses:
// - case_summary
// - timeline_analysis
// - contradiction_analysis
// - evidence_strength_report
//
// AI processes ONLY structured outputs from Phase 116 engines.
// Never processes raw documents directly.
// ============================================

import { config } from '../config/index.js';
import {
  getCaseGraph,
  getGraphStats,
} from './graphService.js';
import {
  buildCentralActorPrompt,
  buildClusterDetectionPrompt,
  buildTimelineGapPrompt,
  buildTestimonyContradictionPrompt,
} from '../engines/aiGraphEnrichment.js';

// ---------------------------------------------------------------------------
// Analysis Types
// ---------------------------------------------------------------------------

export const ANALYSIS_TYPES = {
  CASE_SUMMARY: 'case_summary',
  TIMELINE_ANALYSIS: 'timeline_analysis',
  CONTRADICTION_ANALYSIS: 'contradiction_analysis',
  EVIDENCE_STRENGTH: 'evidence_strength_report',
};

// ---------------------------------------------------------------------------
// OpenAI Client
// ---------------------------------------------------------------------------

/**
 * Call OpenAI Chat Completions API.
 * Returns the assistant's response text.
 *
 * @param {string} systemMessage
 * @param {string} userPrompt
 * @param {object} options
 * @returns {Promise<string>}
 */
async function callOpenAI(systemMessage, userPrompt, options = {}) {
  const apiKey = config.openaiApiKey;
  if (!apiKey) {
    return JSON.stringify({
      error: 'OpenAI API key not configured',
      fallback: true,
      message: 'AI analysis requires OPENAI_API_KEY. Set it in environment variables.',
    });
  }

  const model = options.model || 'gpt-4o-mini';
  const maxTokens = options.maxTokens || 2000;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[AIAnalysis] OpenAI error: ${res.status} - ${errBody}`);
      return JSON.stringify({ error: `OpenAI API error: ${res.status}`, fallback: true });
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.error(`[AIAnalysis] OpenAI call failed: ${err.message}`);
    return JSON.stringify({ error: err.message, fallback: true });
  }
}

// ---------------------------------------------------------------------------
// 1. Case Summary Analysis
// ---------------------------------------------------------------------------

/**
 * Generate an AI-powered case summary from graph data.
 *
 * @param {string} caseId
 * @returns {Promise<{ type: string, result: string, metadata: object }>}
 */
export async function analyzeCaseSummary(caseId) {
  const graph = await getCaseGraph(caseId, { limit: 2000 });
  const stats = await getGraphStats(caseId);

  const promptData = buildCentralActorPrompt({ nodes: graph.nodes, edges: graph.edges, stats });

  const systemMessage = `You are a legal case analyst. Generate a concise, factual case summary based on evidence graph data. Focus on key actors, events, documents, and relationships. Do not speculate beyond what the evidence shows.`;

  const prompt = `Generate a case summary from the following evidence graph.

## Graph Overview
- Nodes: ${stats.nodeCount || 0}
- Relationships: ${stats.edgeCount || 0}
- Node types: ${JSON.stringify(stats.typeCounts || {})}
- Relationship types: ${JSON.stringify(stats.relationshipTypeCounts || {})}

## Key Actors
${promptData.prompt}

## Instructions
1. Summarize the case based on the evidence graph structure.
2. Identify the primary parties involved.
3. Note the volume and types of evidence available.
4. Highlight any patterns or notable connections.
5. Keep the summary factual and concise (under 500 words).`;

  const result = await callOpenAI(systemMessage, prompt);

  return {
    type: ANALYSIS_TYPES.CASE_SUMMARY,
    result,
    metadata: {
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
      typeCounts: stats.typeCounts,
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Timeline Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze the case timeline for gaps, patterns, and anomalies.
 *
 * @param {string} caseId
 * @param {Array} events - Timeline events
 * @returns {Promise<{ type: string, result: string, metadata: object }>}
 */
export async function analyzeTimeline(caseId, events = []) {
  const promptData = buildTimelineGapPrompt({ events });

  const result = await callOpenAI(promptData.systemMessage, promptData.prompt);

  return {
    type: ANALYSIS_TYPES.TIMELINE_ANALYSIS,
    result,
    metadata: promptData.metadata,
  };
}

// ---------------------------------------------------------------------------
// 3. Contradiction Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze contradictions found in evidence.
 *
 * @param {string} caseId
 * @param {Array} conflicts - Evidence conflicts
 * @param {Array} statements - Transcript statements
 * @returns {Promise<{ type: string, result: string, metadata: object }>}
 */
export async function analyzeContradictions(caseId, conflicts = [], statements = []) {
  const promptData = buildTestimonyContradictionPrompt({ conflicts, statements });

  const result = await callOpenAI(promptData.systemMessage, promptData.prompt);

  return {
    type: ANALYSIS_TYPES.CONTRADICTION_ANALYSIS,
    result,
    metadata: promptData.metadata,
  };
}

// ---------------------------------------------------------------------------
// 4. Evidence Strength Report
// ---------------------------------------------------------------------------

/**
 * Generate an evidence strength assessment.
 *
 * @param {string} caseId
 * @returns {Promise<{ type: string, result: string, metadata: object }>}
 */
export async function analyzeEvidenceStrength(caseId) {
  const graph = await getCaseGraph(caseId, { limit: 2000 });
  const stats = await getGraphStats(caseId);

  const promptData = buildClusterDetectionPrompt({ nodes: graph.nodes, edges: graph.edges });

  const systemMessage = `You are a legal evidence analyst. Assess the strength and reliability of evidence in a case based on graph structure, corroboration patterns, and contradiction indicators. Provide actionable insights.`;

  const prompt = `Assess the evidence strength for this case.

## Graph Structure
- Total evidence items: ${stats.nodeCount || 0}
- Total relationships: ${stats.edgeCount || 0}
- Document count: ${(stats.typeCounts || {}).Document || 0}
- Statement count: ${(stats.typeCounts || {}).Statement || 0}
- Contradiction edges: ${graph.edges.filter(e => e.type === 'CONTRADICTS').length}

## Relationship Patterns
${promptData.prompt}

## Instructions
1. Assess overall evidence strength (strong/moderate/weak).
2. Identify the most reliable evidence items (high corroboration).
3. Flag evidence with low reliability (contradictions, single-source).
4. Score key witnesses/testimony reliability.
5. Provide recommendations for strengthening the case.`;

  const result = await callOpenAI(systemMessage, prompt);

  return {
    type: ANALYSIS_TYPES.EVIDENCE_STRENGTH,
    result,
    metadata: {
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
      contradictionCount: graph.edges.filter(e => e.type === 'CONTRADICTS').length,
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Run Analysis by Type
// ---------------------------------------------------------------------------

/**
 * Run a specific analysis type.
 *
 * @param {string} caseId
 * @param {string} analysisType
 * @param {object} data - Additional data for the analysis
 * @returns {Promise<object>}
 */
export async function runAnalysis(caseId, analysisType, data = {}) {
  switch (analysisType) {
    case ANALYSIS_TYPES.CASE_SUMMARY:
      return analyzeCaseSummary(caseId);
    case ANALYSIS_TYPES.TIMELINE_ANALYSIS:
      return analyzeTimeline(caseId, data.events || []);
    case ANALYSIS_TYPES.CONTRADICTION_ANALYSIS:
      return analyzeContradictions(caseId, data.conflicts || [], data.statements || []);
    case ANALYSIS_TYPES.EVIDENCE_STRENGTH:
      return analyzeEvidenceStrength(caseId);
    default:
      throw new Error(`Unknown analysis type: ${analysisType}`);
  }
}

/**
 * Get available analysis types.
 */
export function getAvailableAnalyses() {
  return [
    { id: ANALYSIS_TYPES.CASE_SUMMARY, name: 'Case Summary', description: 'AI-generated case summary from evidence graph' },
    { id: ANALYSIS_TYPES.TIMELINE_ANALYSIS, name: 'Timeline Analysis', description: 'Timeline gap and pattern analysis' },
    { id: ANALYSIS_TYPES.CONTRADICTION_ANALYSIS, name: 'Contradiction Analysis', description: 'Testimony contradiction assessment' },
    { id: ANALYSIS_TYPES.EVIDENCE_STRENGTH, name: 'Evidence Strength', description: 'Evidence reliability and strength report' },
  ];
}
