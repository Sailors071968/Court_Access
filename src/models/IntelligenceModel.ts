// ============================================
// Court Access — Canonical Intelligence Model (Phase 1)
// Deterministic signals only — no probabilistic scoring.
// All intelligence outputs are evidence-bound.
// ============================================

import type { ChargeElement } from './CaseModel';

// ---------------------------------------------------------------------------
// Signal classification
// ---------------------------------------------------------------------------

export type IntelligenceSeverity = 'info' | 'warning' | 'danger';

/**
 * Signal categories for deterministic intelligence analysis.
 * Each category maps to a specific domain of legal analysis.
 */
export type SignalCategory =
  | 'element_weakness'    // Weak/disputed prosecution element
  | 'procedural'          // Procedural deadline or requirement
  | 'evidentiary'         // Evidence-related signal
  | 'constitutional'      // Constitutional rights issue
  | 'sentencing';         // Sentencing exposure signal

// ---------------------------------------------------------------------------
// Intelligence Signal
// ---------------------------------------------------------------------------

/**
 * A single deterministic intelligence signal.
 * Every signal must be traceable to a source (document or charge).
 * The `deterministic` field is always `true` — enforces no probabilistic drift.
 */
export interface IntelligenceSignal {
  id: string;
  category: SignalCategory;
  label: string;
  severity: IntelligenceSeverity;
  description: string;
  sourceDocumentId: string | null;
  sourceChargeId: string | null;
  deterministic: true;
}

// ---------------------------------------------------------------------------
// Element Coverage Map
// ---------------------------------------------------------------------------

/**
 * Deterministic coverage summary of charge elements.
 * Counts are computed from actual element statuses — never estimated.
 */
export interface ElementCoverageMap {
  totalElements: number;
  established: number;
  disputed: number;
  weak: number;
  unclear: number;
}

// ---------------------------------------------------------------------------
// Intelligence Snapshot
// ---------------------------------------------------------------------------

/**
 * Full intelligence snapshot for a case.
 * This is the primary output of the intelligence engine.
 * All fields are deterministic and evidence-bound.
 */
export interface IntelligenceSnapshot {
  caseId: string;
  tenantId: string;
  generatedAt: string;        // ISO 8601
  signals: IntelligenceSignal[];
  elementCoverage: ElementCoverageMap;
  notes: string;
}

// ---------------------------------------------------------------------------
// Risk Score Result
// ---------------------------------------------------------------------------

/**
 * Deterministic risk score result.
 * Score is null until Phase 2+ implements the deterministic scoring contract.
 * Rationale must always explain the basis — no opaque scores.
 */
export interface RiskScoreResult {
  caseId: string;
  score: number | null;
  maxScore: number;
  rationale: string;
  factors: RiskFactor[];
  generatedAt: string;        // ISO 8601
}

export interface RiskFactor {
  id: string;
  label: string;
  severity: IntelligenceSeverity;
  description: string;
  weight: number;
}

// ---------------------------------------------------------------------------
// Prosecution Analysis Result
// ---------------------------------------------------------------------------

/**
 * Structured prosecution analysis.
 * Maps prosecution elements to their evidentiary status.
 * Vulnerabilities are derived from element analysis — never speculated.
 */
export interface ProsecutionAnalysisResult {
  caseId: string;
  elements: ChargeElement[];
  vulnerabilities: ProsecutionVulnerability[];
  strengthSummary: StrengthSummary;
  notes: string;
  generatedAt: string;        // ISO 8601
}

export interface ProsecutionVulnerability {
  id: string;
  chargeId: string;
  elementNumber: number;
  description: string;
  severity: IntelligenceSeverity;
}

export interface StrengthSummary {
  totalElements: number;
  strongElements: number;
  weakElements: number;
  disputedElements: number;
}

// ---------------------------------------------------------------------------
// Defense Insight
// ---------------------------------------------------------------------------

/**
 * A single defense insight derived from case analysis.
 * Must be traceable to source data — no hallucinated recommendations.
 */
export interface DefenseInsight {
  id: string;
  content: string;
  sourceChargeId: string | null;
  sourceDocumentId: string | null;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  type: 'case' | 'document' | 'statute';
  title: string;
  description: string;
  url: string;
}
