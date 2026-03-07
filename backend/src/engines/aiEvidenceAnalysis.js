// ============================================
// Court Access — AI Evidence Analysis Engine (Preparation)
// Phase 116: Evidence Intelligence Engine v1
//
// IMPORTANT: This module prepares structured prompts for AI integration.
// LLM calls are NOT yet integrated — that will happen in Phase 117.
//
// Prepared capabilities:
// - Case summary generation
// - Contradiction explanation
// - Timeline narrative
// - Evidence strength scoring
// ============================================

// ---------------------------------------------------------------------------
// Structured Prompt Templates
// ---------------------------------------------------------------------------

/**
 * Generate a structured prompt for case summary generation.
 *
 * @param {object} caseData
 * @param {string} caseData.caseId
 * @param {Array} caseData.entities - Extracted entities
 * @param {Array} caseData.events - Timeline events
 * @param {Array} caseData.statements - Key testimony statements
 * @param {Array} caseData.conflicts - Detected conflicts
 * @returns {object} { prompt, systemMessage, expectedOutput }
 */
export function buildCaseSummaryPrompt(caseData) {
  const { caseId, entities, events, statements, conflicts } = caseData;

  const entityList = (entities || [])
    .slice(0, 50)
    .map(e => `- ${e.entityType}: ${e.entityValue}`)
    .join('\n');

  const eventList = (events || [])
    .slice(0, 30)
    .map(e => `- ${e.timestamp}: ${e.description} (${e.eventType})`)
    .join('\n');

  const statementList = (statements || [])
    .slice(0, 20)
    .map(s => `- ${s.speaker}: "${s.statementText.substring(0, 100)}" [${s.statementType}]`)
    .join('\n');

  const conflictList = (conflicts || [])
    .slice(0, 10)
    .map(c => `- ${c.description} (confidence: ${c.confidence})`)
    .join('\n');

  const systemMessage = `You are a legal case analyst for Court Access, a litigation intelligence platform. Your role is to provide objective, factual case summaries based on extracted evidence data. Do not speculate beyond what the evidence supports. Clearly distinguish between facts and potential inferences.`;

  const prompt = `Generate a comprehensive case summary for Case ID: ${caseId}.

## Extracted Entities
${entityList || 'No entities extracted.'}

## Timeline of Events
${eventList || 'No timeline events available.'}

## Key Testimony
${statementList || 'No key statements identified.'}

## Detected Conflicts
${conflictList || 'No conflicts detected.'}

## Instructions
1. Provide a factual overview of the case based on the above data.
2. Highlight the key parties involved and their roles.
3. Summarize the chronological sequence of events.
4. Note any contradictions or areas requiring further investigation.
5. Keep the summary concise (300-500 words).
6. Use neutral, objective language appropriate for legal proceedings.`;

  return {
    prompt,
    systemMessage,
    expectedOutput: {
      format: 'structured_text',
      sections: ['overview', 'key_parties', 'chronology', 'contradictions', 'areas_for_investigation'],
    },
    metadata: {
      caseId,
      entityCount: (entities || []).length,
      eventCount: (events || []).length,
      statementCount: (statements || []).length,
      conflictCount: (conflicts || []).length,
    },
  };
}

/**
 * Generate a structured prompt for contradiction explanation.
 *
 * @param {object} conflictData
 * @param {string} conflictData.caseId
 * @param {Array} conflictData.conflicts - Detected conflicts
 * @param {Array} conflictData.relatedStatements - Statements related to conflicts
 * @returns {object} { prompt, systemMessage, expectedOutput }
 */
export function buildContradictionPrompt(conflictData) {
  const { caseId, conflicts, relatedStatements } = conflictData;

  const conflictDetails = (conflicts || []).map((c, i) => {
    return `### Conflict ${i + 1}
- Type: ${c.conflictType}
- Entity: ${c.entity}
- Document A: ${c.documentA}
- Document B: ${c.documentB}
- Description: ${c.description}
- Confidence: ${(c.confidence * 100).toFixed(0)}%`;
  }).join('\n\n');

  const statementContext = (relatedStatements || [])
    .slice(0, 15)
    .map(s => `- ${s.speaker} (line ${s.lineNumber}): "${s.statementText.substring(0, 150)}"`)
    .join('\n');

  const systemMessage = `You are a legal contradiction analyst. Your role is to explain evidence contradictions in clear, objective language suitable for attorney review. Assess the significance of each contradiction and suggest what additional investigation might resolve the discrepancy.`;

  const prompt = `Analyze the following contradictions detected in Case ID: ${caseId}.

## Detected Contradictions
${conflictDetails || 'No contradictions to analyze.'}

## Related Testimony
${statementContext || 'No related testimony available.'}

## Instructions
1. For each contradiction, explain what the discrepancy is in plain language.
2. Assess the legal significance (high/medium/low).
3. Suggest what additional evidence or investigation could resolve each contradiction.
4. Note if any contradictions appear to be benign (e.g., minor time discrepancies).`;

  return {
    prompt,
    systemMessage,
    expectedOutput: {
      format: 'structured_analysis',
      perConflict: ['explanation', 'significance', 'resolution_suggestion'],
    },
    metadata: { caseId, conflictCount: (conflicts || []).length },
  };
}

/**
 * Generate a structured prompt for timeline narrative.
 *
 * @param {object} timelineData
 * @param {string} timelineData.caseId
 * @param {Array} timelineData.events - Chronological events
 * @returns {object} { prompt, systemMessage, expectedOutput }
 */
export function buildTimelineNarrativePrompt(timelineData) {
  const { caseId, events } = timelineData;

  const eventDetails = (events || []).map(e => {
    const time = e.timestamp ? new Date(e.timestamp).toLocaleString() : 'Unknown time';
    return `- ${time} | ${e.eventType} | ${e.description} (confidence: ${(e.confidence * 100).toFixed(0)}%)`;
  }).join('\n');

  const systemMessage = `You are a legal timeline narrator. Convert chronological evidence events into a clear, readable narrative that an attorney could present in court. Use precise language and maintain temporal accuracy.`;

  const prompt = `Create a narrative timeline for Case ID: ${caseId}.

## Chronological Events
${eventDetails || 'No events available.'}

## Instructions
1. Write a flowing narrative that connects the events chronologically.
2. Use transitional phrases to show the sequence ("Subsequently...", "Prior to this...", etc.).
3. Note gaps in the timeline where events may be missing.
4. Highlight events with low confidence scores as "reportedly" or "allegedly".
5. Keep the narrative suitable for inclusion in legal filings.`;

  return {
    prompt,
    systemMessage,
    expectedOutput: {
      format: 'narrative_text',
      sections: ['narrative', 'timeline_gaps', 'confidence_notes'],
    },
    metadata: { caseId, eventCount: (events || []).length },
  };
}

/**
 * Generate a structured prompt for evidence strength scoring.
 *
 * @param {object} evidenceData
 * @param {string} evidenceData.caseId
 * @param {Array} evidenceData.entities
 * @param {Array} evidenceData.statements
 * @param {Array} evidenceData.conflicts
 * @returns {object} { prompt, systemMessage, expectedOutput }
 */
export function buildEvidenceStrengthPrompt(evidenceData) {
  const { caseId, entities, statements, conflicts } = evidenceData;

  const entitySummary = {};
  for (const e of (entities || [])) {
    entitySummary[e.entityType] = (entitySummary[e.entityType] || 0) + 1;
  }

  const statementSummary = {};
  for (const s of (statements || [])) {
    statementSummary[s.statementType] = (statementSummary[s.statementType] || 0) + 1;
  }

  const systemMessage = `You are a legal evidence strength assessor. Evaluate the strength of evidence in a case based on entity coverage, testimony quality, and contradiction levels. Provide an objective assessment suitable for case strategy planning.`;

  const prompt = `Assess the evidence strength for Case ID: ${caseId}.

## Entity Coverage
${Object.entries(entitySummary).map(([k, v]) => `- ${k}: ${v} instances`).join('\n') || 'No entities.'}

## Statement Analysis
${Object.entries(statementSummary).map(([k, v]) => `- ${k}: ${v} statements`).join('\n') || 'No statements.'}

## Conflicts
- Total: ${(conflicts || []).length}
- High confidence: ${(conflicts || []).filter(c => c.confidence >= 0.8).length}

## Instructions
1. Rate overall evidence strength on a scale of 1-10.
2. Identify the strongest pieces of evidence.
3. Identify the weakest areas that need reinforcement.
4. Note any evidence gaps that could be exploited by opposing counsel.
5. Suggest priorities for additional evidence gathering.`;

  return {
    prompt,
    systemMessage,
    expectedOutput: {
      format: 'structured_assessment',
      fields: ['overall_score', 'strengths', 'weaknesses', 'gaps', 'priorities'],
    },
    metadata: {
      caseId,
      entityTypes: Object.keys(entitySummary),
      statementTypes: Object.keys(statementSummary),
      conflictCount: (conflicts || []).length,
    },
  };
}

/**
 * Get all available prompt builders.
 * This allows the system to enumerate available AI capabilities
 * before Phase 117 integration.
 */
export function getAvailablePrompts() {
  return [
    {
      id: 'case_summary',
      name: 'Case Summary Generation',
      description: 'Generate a comprehensive case summary from extracted evidence data',
      builder: 'buildCaseSummaryPrompt',
      requiredData: ['entities', 'events', 'statements', 'conflicts'],
    },
    {
      id: 'contradiction_analysis',
      name: 'Contradiction Explanation',
      description: 'Explain detected contradictions and assess their significance',
      builder: 'buildContradictionPrompt',
      requiredData: ['conflicts', 'relatedStatements'],
    },
    {
      id: 'timeline_narrative',
      name: 'Timeline Narrative',
      description: 'Convert chronological events into a readable narrative',
      builder: 'buildTimelineNarrativePrompt',
      requiredData: ['events'],
    },
    {
      id: 'evidence_strength',
      name: 'Evidence Strength Scoring',
      description: 'Assess overall evidence strength and identify gaps',
      builder: 'buildEvidenceStrengthPrompt',
      requiredData: ['entities', 'statements', 'conflicts'],
    },
  ];
}
