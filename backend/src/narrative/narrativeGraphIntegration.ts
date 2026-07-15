// ============================================================================
// Narrative Deconstruction Engine — Graph Integration
// Creates graph nodes and relationships for narrative claims.
// Node: Claim
// Relationships: CLAIMED_IN, SUPPORTED_BY, CONTRADICTED_BY, RELATES_TO
// ============================================================================

// ---------------------------------------------------------------------------
// Extended Graph Types for Narrative Engine
// ---------------------------------------------------------------------------

export type NarrativeNodeType = 'Claim' | 'Evidence' | 'Event';
export type NarrativeRelType = 'CLAIMED_IN' | 'SUPPORTED_BY' | 'CONTRADICTED_BY' | 'RELATES_TO';

export interface NarrativeGraphNode {
  id: string;
  type: NarrativeNodeType;
  label: string;
  properties: Record<string, unknown>;
}

export interface NarrativeGraphRelationship {
  fromId: string;
  toId: string;
  type: NarrativeRelType;
  properties?: Record<string, unknown>;
}

export interface NarrativeGraphData {
  nodes: NarrativeGraphNode[];
  relationships: NarrativeGraphRelationship[];
}

// ---------------------------------------------------------------------------
// Graph Node Factories
// ---------------------------------------------------------------------------

export function createClaimNode(params: {
  claimId: string;
  claimText: string;
  subject: string;
  action: string;
  confidence: number;
  validationStatus?: string;
}): NarrativeGraphNode {
  return {
    id: `claim:${params.claimId}`,
    type: 'Claim',
    label: params.claimText.substring(0, 80),
    properties: {
      claimId: params.claimId,
      subject: params.subject,
      action: params.action,
      confidence: params.confidence,
      validationStatus: params.validationStatus || 'pending',
    },
  };
}

// ---------------------------------------------------------------------------
// Graph Relationship Factories
// ---------------------------------------------------------------------------

export function createClaimedInRelationship(
  claimNodeId: string,
  evidenceNodeId: string,
  properties?: Record<string, unknown>,
): NarrativeGraphRelationship {
  return {
    fromId: claimNodeId,
    toId: evidenceNodeId,
    type: 'CLAIMED_IN',
    properties,
  };
}

export function createSupportedByRelationship(
  claimNodeId: string,
  evidenceNodeId: string,
  properties?: Record<string, unknown>,
): NarrativeGraphRelationship {
  return {
    fromId: claimNodeId,
    toId: evidenceNodeId,
    type: 'SUPPORTED_BY',
    properties,
  };
}

export function createContradictedByRelationship(
  claimNodeId: string,
  evidenceNodeId: string,
  properties?: Record<string, unknown>,
): NarrativeGraphRelationship {
  return {
    fromId: claimNodeId,
    toId: evidenceNodeId,
    type: 'CONTRADICTED_BY',
    properties,
  };
}

export function createRelatesToRelationship(
  claimNodeId: string,
  eventNodeId: string,
  properties?: Record<string, unknown>,
): NarrativeGraphRelationship {
  return {
    fromId: claimNodeId,
    toId: eventNodeId,
    type: 'RELATES_TO',
    properties,
  };
}

// ---------------------------------------------------------------------------
// Build Narrative Graph for a Case
// ---------------------------------------------------------------------------

export function buildNarrativeGraph(params: {
  caseId: string;
  claims: Array<{
    claimId: string;
    claimText: string;
    subject: string;
    action: string;
    confidence: number;
    evidenceId: string;
    validationStatus?: string;
    supportingEvidenceIds?: string[];
    contradictingEvidenceIds?: string[];
  }>;
}): NarrativeGraphData {
  const nodes: NarrativeGraphNode[] = [];
  const relationships: NarrativeGraphRelationship[] = [];

  for (const claim of params.claims) {
    // Create claim node
    const claimNode = createClaimNode({
      claimId: claim.claimId,
      claimText: claim.claimText,
      subject: claim.subject,
      action: claim.action,
      confidence: claim.confidence,
      validationStatus: claim.validationStatus,
    });
    nodes.push(claimNode);

    // CLAIMED_IN → source evidence
    relationships.push(
      createClaimedInRelationship(claimNode.id, `evidence:${claim.evidenceId}`),
    );

    // SUPPORTED_BY → supporting evidence
    if (claim.supportingEvidenceIds) {
      for (const eid of claim.supportingEvidenceIds) {
        relationships.push(
          createSupportedByRelationship(claimNode.id, `evidence:${eid}`),
        );
      }
    }

    // CONTRADICTED_BY → contradicting evidence
    if (claim.contradictingEvidenceIds) {
      for (const eid of claim.contradictingEvidenceIds) {
        relationships.push(
          createContradictedByRelationship(claimNode.id, `evidence:${eid}`),
        );
      }
    }
  }

  return { nodes, relationships };
}
