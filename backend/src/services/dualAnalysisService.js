// ============================================
// Court Access — Dual Analysis Service
// Phase K: Run both evidence intelligence and
// fact-graph reasoning in parallel, merge results
// ============================================

import prisma from './prismaClient.js';
import { correlateEvidence } from '../engines/evidenceCorrelationEngine.js';
import { buildCourtTimeline } from '../engines/courtTimelineEngine.js';
import { detectTimelineConflicts } from '../engines/timelineConflictEngine.js';
import { enrichEvidenceGraph } from '../engines/graphEnrichmentEngine.js';
import { runFactReasoning } from './factReasoningEngine.js';
import { analyzeFactCorroboration } from './factCorroborationService.js';
import { integrateFactsIntoGraph } from './graphFactIntegrationService.js';
import { timedExecution } from '../engines/evidencePerformanceEngine.js';

/**
 * Run full dual-layer analysis on a case.
 * @param {string} caseId
 * @returns {{ layer1: object, layer2: object, merged: object }}
 */
export async function runDualAnalysis(caseId) {
  console.log(`[DualAnalysis] Running dual-layer analysis for case ${caseId}`);
  const startTime = Date.now();

  // Layer 1: Evidence Intelligence
  const layer1 = {};
  try {
    layer1.correlations = await timedExecution(caseId, 'correlation', () => correlateEvidence(caseId));
    layer1.timeline = await timedExecution(caseId, 'timeline', () => buildCourtTimeline(caseId));
    layer1.conflicts = await timedExecution(caseId, 'conflict_detection', () => detectTimelineConflicts(caseId));
    layer1.graph = await timedExecution(caseId, 'graphEnrichment', () => enrichEvidenceGraph(caseId));
  } catch (err) {
    console.error(`[DualAnalysis] Layer 1 error: ${err.message}`);
    layer1.error = err.message;
  }

  // Layer 2: Fact-Graph Reasoning
  const layer2 = {};
  try {
    layer2.corroboration = await timedExecution(caseId, 'fact_corroboration', () => analyzeFactCorroboration(caseId));
    layer2.reasoning = await timedExecution(caseId, 'fact_reasoning', () => runFactReasoning(caseId));
    layer2.graphIntegration = await timedExecution(caseId, 'graph_fact_integration', () => integrateFactsIntoGraph(caseId));
  } catch (err) {
    console.error(`[DualAnalysis] Layer 2 error: ${err.message}`);
    layer2.error = err.message;
  }

  // Merge results
  const merged = mergeLayerResults(layer1, layer2);
  const totalDuration = Date.now() - startTime;

  // Store dual analysis record
  const record = await prisma.dualAnalysisResult.create({
    data: {
      caseId,
      layer1Summary: {
        correlations: layer1.correlations?.summary || null,
        timeline: layer1.timeline?.summary || null,
        conflicts: layer1.conflicts?.summary || null,
        graph: layer1.graph?.summary || null,
        error: layer1.error || null,
      },
      layer2Summary: {
        corroboration: layer2.corroboration?.summary || null,
        reasoning: layer2.reasoning?.summary || null,
        graphIntegration: layer2.graphIntegration?.summary || null,
        error: layer2.error || null,
      },
      mergedInsights: merged,
      totalDurationMs: totalDuration,
      metadata: {
        analyzedAt: new Date().toISOString(),
        layer1Duration: null,
        layer2Duration: null,
      },
    },
  });

  console.log(`[DualAnalysis] Complete in ${totalDuration}ms for case ${caseId}`);

  return { layer1, layer2, merged, record };
}

function mergeLayerResults(layer1, layer2) {
  const insights = [];

  // Merge conflict detection with reasoning inferences
  const conflictCount = layer1.conflicts?.summary?.total || 0;
  const inferenceCount = layer2.reasoning?.summary?.total || 0;

  if (conflictCount > 0) {
    insights.push({
      type: 'timeline_conflicts',
      source: 'layer1',
      description: `${conflictCount} timeline conflicts detected across evidence`,
      severity: conflictCount >= 5 ? 'critical' : conflictCount >= 2 ? 'high' : 'medium',
    });
  }

  if (inferenceCount > 0) {
    const contradictions = layer2.reasoning?.summary?.byType?.contradiction || 0;
    if (contradictions > 0) {
      insights.push({
        type: 'fact_contradictions',
        source: 'layer2',
        description: `${contradictions} contradictions found through fact-based reasoning`,
        severity: contradictions >= 3 ? 'critical' : 'high',
      });
    }
  }

  // Corroboration insights
  const corroboratedGroups = layer2.corroboration?.summary?.corroboratedGroups || 0;
  if (corroboratedGroups > 0) {
    insights.push({
      type: 'corroboration',
      source: 'layer2',
      description: `${corroboratedGroups} fact groups independently corroborated`,
      severity: 'low',
    });
  }

  // Graph completeness
  const graphNodes = layer1.graph?.summary?.nodeCount || 0;
  const factNodes = layer2.graphIntegration?.summary?.newNodes || 0;
  if (graphNodes > 0) {
    insights.push({
      type: 'graph_completeness',
      source: 'merged',
      description: `Evidence graph has ${graphNodes + factNodes} total nodes after fact integration`,
      severity: 'low',
    });
  }

  return insights;
}

export async function getCaseDualAnalysisResults(caseId) {
  return prisma.dualAnalysisResult.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
}
