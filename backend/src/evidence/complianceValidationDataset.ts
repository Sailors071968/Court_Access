// ============================================================================
// Phase 159 — Compliance Engine Validation Dataset
// Type definitions and dataset for compliance validation test cases.
// Populate with real evidence data as cases are processed.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationTestCase {
  testCaseId: string;
  title: string;
  sourceType: 'bodycam' | 'dashcam' | 'audio' | 'transcript' | 'police_report';
  agencyId: string;
  agencyName: string;
  incidentNarrative: string;
  evidenceText: string;
  expectedEvents: ExpectedEvent[];
  expectedPolicyReferences: string[];
  expectedFindingCount: { min: number; max: number };
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'use_of_force' | 'pursuit' | 'search_seizure' | 'arrest' | 'interrogation' | 'officer_conduct' | 'custody' | 'mixed';
}

export interface ExpectedEvent {
  eventType: string;
  shouldDetect: boolean;
  timestamp?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Validation Dataset — populate from real evidence data
// ---------------------------------------------------------------------------

export const VALIDATION_DATASET: ValidationTestCase[] = [];
