# Narrative Conflict Detection AI (Phase 3)

## Overview

The conflict detection module identifies contradictions across legal case narratives using a deterministic 5-stage pipeline. It analyzes timeline events, witness/officer statements, evidence metadata, policy violations, and legal claims to surface conflicts with weighted severity scoring.

## Pipeline Stages

### Stage 1: Timeline Conflict Analysis
**File:** `timelineConflictAnalyzer.ts`

Detects temporal contradictions by comparing timeline events across speakers:
- **Cross-speaker conflicts:** Different speakers report the same event at contradictory times
- **Impossible sequences:** Speaker A's ordering contradicts Speaker B's ordering
- **Simultaneous conflicts:** Same speaker claims involvement in incompatible events at the same time

Events are grouped by speaker, sorted chronologically, and compared pairwise. Token-overlap similarity determines whether two event descriptions refer to the same incident.

### Stage 2: Statement Comparison
**File:** `statementComparator.ts`

Compares testimony pairs for contradictions using token-level heuristics:
- **Negation contradictions:** Detects negation words (e.g., "armed" vs "not armed") using hardcoded negation pairs
- **Quantitative contradictions:** Extracts numbers and detects significant discrepancies (>50% difference)
- **Temporal contradictions:** Detects ordering contradictions ("before" vs "after", "first" vs "last")

Statements must be topically related (token overlap >= 40%) and from different speakers (in cross-role mode) to be compared. Speaker role reliability weights officer-vs-witness contradictions higher (0.9) than witness-only (0.6).

### Stage 3: Evidence Inconsistency Detection
**File:** `narrativeConflictDetector.ts` (method: `detectEvidenceInconsistencies`)

Surfaces existing CONTRADICTS and REFUTES relationships between Evidence nodes in the knowledge graph. Does not discover new contradictions from graph topology -- it pattern-matches existing relationship types.

### Stage 4: Policy Violation Detection
**File:** `narrativeConflictDetector.ts` (method: `detectPolicyViolationConflicts`)

Finds cases where evidence VIOLATES a policy/statute but other evidence SUPPORTS compliance with the same policy. These contradictory claims are surfaced as policy violation conflicts.

### Stage 5: Legal Claim Conflict Detection
**File:** `narrativeConflictDetector.ts` (method: `detectLegalClaimConflictsFromGraph`)

Identifies pairs of LegalClaim nodes that make contradictory assertions about the same evidence (e.g., one SUPPORTS and the other REFUTES the same target).

## Conflict Scoring Methodology

### Weighted Factors

Each conflict is scored using 4 factors with fixed weights:

| Factor | Weight | Description |
|--------|--------|-------------|
| `temporalContradictionStrength` | 0.35 | Strength of temporal contradiction (0.0-1.0) |
| `evidenceReliability` | 0.25 | Reliability of underlying evidence (0.0-1.0) |
| `policyViolationWeight` | 0.25 | Policy violation implications (0.0-1.0) |
| `supportingSourceCount` | 0.15 | Independent sources (normalized: count/5, capped at 1.0) |

**Formula:**
```
severityScore = temporal * 0.35 + reliability * 0.25 + policy * 0.25 + min(sources/5, 1.0) * 0.15
```

### Type-Specific Adjustments

After base scoring, type-specific multipliers are applied in Stage 6:
- **timeline:** `temporalContradictionStrength *= 1.2`
- **testimony:** `evidenceReliability *= 1.15`
- **evidence:** `evidenceReliability *= 1.1`, `supportingSourceCount = max(current, 2)`
- **policy_violation:** `policyViolationWeight *= 1.3`
- **legal_claim:** `policyViolationWeight *= 1.2`, `temporalContradictionStrength *= 1.1`

### Severity Bands

| Band | Score Range | Relationship Type |
|------|-------------|-------------------|
| Critical | >= 0.85 | `INVALIDATES` |
| High | >= 0.65 | `CONTRADICTS` |
| Medium | >= 0.40 | `WEAKENS` |
| Low | < 0.40 | `WEAKENS` (if above insertion threshold) |

### Explanation Factors

Each conflict includes an `explanationFactors` object for human-readable explainability:

```typescript
{
  severityScore: 0.91,
  conflictType: "timeline",
  explanationFactors: {
    timestampMismatch: true,
    policyViolation: false,
    witnessContradiction: false,
    evidenceInconsistency: false,
    legalClaimContradiction: false
  }
}
```

## Graph Representation of Conflicts

### Conflict Node

A `Conflict` node in Neo4j stores:
- `id` - Unique conflict identifier (SHA-256 hash)
- `tenantId` - Tenant isolation key
- `conflictType` - One of: timeline, testimony, evidence, policy_violation, legal_claim
- `description` - Human-readable conflict description
- `severityScore` - Composite severity (0.0-1.0)
- `severity` - Band: low, medium, high, critical
- Scoring factors: `temporalContradictionStrength`, `evidenceReliability`, `policyViolationWeight`, `supportingSourceCount`
- Explanation factors: `timestampMismatch`, `policyViolation`, `witnessContradiction`, `evidenceInconsistency`, `legalClaimContradiction`
- `detectedAt` - Detection timestamp

### Relationships

Conflicts are connected to source/target nodes via typed relationships:
- **INVALIDATES** - Critical/high severity (score >= 0.85)
- **CONTRADICTS** - Medium-high severity (score >= 0.65)
- **WEAKENS** - Lower severity (score < 0.65)

Each relationship carries:
- `confidence` / `confidenceScore` - The conflict's severity score
- Scoring factor breakdown for explainability

### Query Methods

The `GraphQueryEngine` provides these conflict query methods:
- `findNarrativeConflicts(tenantId)` - All conflicts for a case
- `findConflictsBySeverity(tenantId, threshold)` - Conflicts at or above a severity threshold
- `findTimelineConflicts(tenantId)` - Timeline-specific conflicts
- `findPolicyViolationConflicts(tenantId)` - Policy violation conflicts

## Module Files

| File | Purpose |
|------|---------|
| `types.ts` | Type definitions, scoring factors/weights, explanation factors |
| `timelineConflictAnalyzer.ts` | Stage 1: Timeline contradiction detection |
| `statementComparator.ts` | Stage 2: Testimony comparison |
| `conflictScoringEngine.ts` | Severity scoring with weighted factors |
| `conflictGraphIntegrator.ts` | Neo4j Conflict node/relationship insertion |
| `narrativeConflictDetector.ts` | Pipeline orchestrator (all 5 stages) |
| `index.ts` | Barrel exports |

## Testing

```bash
# Run conflict-specific tests (46 tests)
node --import tsx --test tests/conflict.test.ts

# Run full pipeline integration tests
node --import tsx --test tests/pipeline.test.ts

# Run all tests
node --import tsx --test tests/*.test.ts
```

Test dataset for pipeline validation: 10,000 documents, 500 evidence items, 200 statements, 100 timeline events.
