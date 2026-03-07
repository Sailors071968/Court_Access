// ============================================
// Court Access — AI Graph Enrichment Engine (Preparation)
// Phase 117: Evidence Graph + Visualization System
//
// Purpose: Generate insights from graph structure.
// DO NOT call external LLM APIs yet — prompt templates only.
//
// Capabilities prepared:
// - Central actor identification
// - Unusual relationship cluster detection
// - Timeline gap detection
// - Testimony contradiction analysis
// ============================================

/**
 * Build a prompt to identify central actors in the case graph.
 *
 * @param {object} graphData - { nodes, edges, stats }
 * @returns {object} { prompt, systemMessage, expectedOutput }
 */
export function buildCentralActorPrompt(graphData) {
  const { nodes, edges, stats } = graphData;

  const personNodes = (nodes || []).filter(n => n.type === 'Person');
  const topPersons = personNodes
    .sort((a, b) => (b.connectionCount || 0) - (a.connectionCount || 0))
    .slice(0, 20);

  const personSummary = topPersons
    .map(p => `- ${p.label} (${p.connectionCount} connections)`)
    .join('\n');

  const systemMessage = `You are a legal investigation analyst. Identify the most important actors in a case evidence graph based on their connections, roles, and mentions across documents. Rank them by investigative significance.`;

  const prompt = `Analyze the following case evidence graph to identify central actors.

## Graph Statistics
- Total nodes: ${stats?.nodeCount || 0}
- Total edges: ${stats?.edgeCount || 0}
- Node types: ${JSON.stringify(stats?.typeCounts || {})}

## Top Connected Persons
${personSummary || 'No persons identified.'}

## Instructions
1. Rank the top 5 most significant actors by investigative importance.
2. Explain why each actor is significant (number of connections, types of relationships).
3. Identify any actors who appear to be bridge nodes connecting otherwise disconnected groups.
4. Note any actors who appear in both testimony and documentary evidence.`;

  return {
    prompt,
    systemMessage,
    expectedOutput: {
      format: 'ranked_list',
      fields: ['rank', 'actor', 'significance', 'connectionTypes', 'bridgeNode'],
    },
    metadata: { personCount: personNodes.length, topPersonCount: topPersons.length },
  };
}

/**
 * Build a prompt to detect unusual relationship clusters.
 *
 * @param {object} graphData - { nodes, edges }
 * @returns {object} { prompt, systemMessage, expectedOutput }
 */
export function buildClusterDetectionPrompt(graphData) {
  const { nodes, edges } = graphData;

  // Find nodes with high connectivity
  const highConnectivity = (nodes || [])
    .filter(n => (n.connectionCount || 0) >= 3)
    .slice(0, 30);

  // Find contradiction edges
  const contradictions = (edges || [])
    .filter(e => e.type === 'CONTRADICTS')
    .slice(0, 10);

  const nodeSummary = highConnectivity
    .map(n => `- ${n.label} (${n.type}, ${n.connectionCount} connections)`)
    .join('\n');

  const contradictionSummary = contradictions
    .map(e => `- ${e.source} <-> ${e.target} (confidence: ${(e.confidence * 100).toFixed(0)}%)`)
    .join('\n');

  const systemMessage = `You are a pattern analyst specializing in evidence graph analysis. Identify unusual clusters of relationships that may indicate important investigative leads.`;

  const prompt = `Analyze the following evidence graph for unusual relationship patterns.

## Highly Connected Nodes
${nodeSummary || 'No highly connected nodes.'}

## Known Contradictions
${contradictionSummary || 'No contradictions detected.'}

## Instructions
1. Identify clusters of nodes that are densely connected to each other but loosely connected to the rest of the graph.
2. Flag any unusual relationship patterns (e.g., a person connected to contradicting documents).
3. Suggest which clusters warrant deeper investigation.
4. Note any potential missing relationships that would be expected given the evidence.`;

  return {
    prompt,
    systemMessage,
    expectedOutput: {
      format: 'cluster_analysis',
      fields: ['clusterId', 'members', 'significance', 'missingRelationships'],
    },
    metadata: { highConnectivityCount: highConnectivity.length, contradictionCount: contradictions.length },
  };
}

/**
 * Build a prompt to detect timeline gaps.
 *
 * @param {object} timelineData - { events }
 * @returns {object} { prompt, systemMessage, expectedOutput }
 */
export function buildTimelineGapPrompt(timelineData) {
  const { events } = timelineData;

  const sortedEvents = (events || [])
    .filter(e => e.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Find gaps between consecutive events
  const gaps = [];
  for (let i = 1; i < sortedEvents.length; i++) {
    const prev = new Date(sortedEvents[i - 1].timestamp);
    const curr = new Date(sortedEvents[i].timestamp);
    const gapHours = (curr - prev) / (1000 * 60 * 60);

    if (gapHours > 24) {
      gaps.push({
        after: sortedEvents[i - 1].description,
        before: sortedEvents[i].description,
        gapHours: Math.round(gapHours),
        afterTime: sortedEvents[i - 1].timestamp,
        beforeTime: sortedEvents[i].timestamp,
      });
    }
  }

  const eventSummary = sortedEvents
    .slice(0, 30)
    .map(e => `- ${new Date(e.timestamp).toLocaleString()}: ${e.description} (${e.eventType})`)
    .join('\n');

  const gapSummary = gaps
    .slice(0, 10)
    .map(g => `- ${g.gapHours}h gap between "${g.after}" and "${g.before}"`)
    .join('\n');

  const systemMessage = `You are a timeline analyst. Identify significant gaps in case timelines that may represent missing evidence or undocumented events.`;

  const prompt = `Analyze the following case timeline for significant gaps.

## Chronological Events
${eventSummary || 'No events available.'}

## Detected Gaps (>24 hours)
${gapSummary || 'No significant gaps detected.'}

## Instructions
1. Assess the significance of each gap for the investigation.
2. Suggest what events might have occurred during each gap.
3. Recommend what evidence should be sought to fill the gaps.
4. Rate each gap's investigative priority (high/medium/low).`;

  return {
    prompt,
    systemMessage,
    expectedOutput: {
      format: 'gap_analysis',
      fields: ['gapId', 'duration', 'significance', 'likelyEvents', 'priority'],
    },
    metadata: { eventCount: sortedEvents.length, gapCount: gaps.length },
  };
}

/**
 * Build a prompt for testimony contradiction analysis.
 *
 * @param {object} contradictionData - { conflicts, statements }
 * @returns {object} { prompt, systemMessage, expectedOutput }
 */
export function buildTestimonyContradictionPrompt(contradictionData) {
  const { conflicts, statements } = contradictionData;

  const conflictSummary = (conflicts || [])
    .slice(0, 15)
    .map((c, i) => `${i + 1}. ${c.description} (confidence: ${(c.confidence * 100).toFixed(0)}%)`)
    .join('\n');

  const statementSummary = (statements || [])
    .filter(s => s.statementType === 'contradiction' || s.statementType === 'confession')
    .slice(0, 15)
    .map(s => `- ${s.speaker}: "${s.statementText.substring(0, 120)}" [${s.statementType}]`)
    .join('\n');

  const systemMessage = `You are a legal contradiction analyst. Analyze testimony contradictions to identify which ones are most significant for the case and suggest resolution strategies.`;

  const prompt = `Analyze the following testimony contradictions.

## Detected Contradictions
${conflictSummary || 'No contradictions detected.'}

## Key Testimony
${statementSummary || 'No key statements.'}

## Instructions
1. For each contradiction, assess its legal significance.
2. Identify which contradictions could be explained by honest mistakes vs. potential deception.
3. Suggest cross-examination questions that could resolve each contradiction.
4. Rank contradictions by their potential impact on the case outcome.`;

  return {
    prompt,
    systemMessage,
    expectedOutput: {
      format: 'contradiction_analysis',
      fields: ['contradictionId', 'significance', 'likelyExplanation', 'crossExamQuestions', 'impact'],
    },
    metadata: { conflictCount: (conflicts || []).length, statementCount: (statements || []).length },
  };
}

/**
 * Get all available graph enrichment prompts.
 */
export function getAvailableGraphPrompts() {
  return [
    {
      id: 'central_actors',
      name: 'Central Actor Identification',
      description: 'Identify the most significant actors in the evidence graph',
      builder: 'buildCentralActorPrompt',
      requiredData: ['nodes', 'edges', 'stats'],
    },
    {
      id: 'cluster_detection',
      name: 'Unusual Cluster Detection',
      description: 'Detect unusual relationship clusters in the evidence graph',
      builder: 'buildClusterDetectionPrompt',
      requiredData: ['nodes', 'edges'],
    },
    {
      id: 'timeline_gaps',
      name: 'Timeline Gap Detection',
      description: 'Identify significant gaps in the case timeline',
      builder: 'buildTimelineGapPrompt',
      requiredData: ['events'],
    },
    {
      id: 'testimony_contradictions',
      name: 'Testimony Contradiction Analysis',
      description: 'Analyze testimony contradictions for significance and resolution',
      builder: 'buildTestimonyContradictionPrompt',
      requiredData: ['conflicts', 'statements'],
    },
  ];
}
