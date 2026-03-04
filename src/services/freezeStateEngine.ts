// ============================================
// Court Access — Freeze State Engine (Phase O5)
// Freeze State Transition Manager
//
// Manages freeze state transitions for the domain
// protection governor. No store writes — caller persists state.
//
// Rules:
//   - FREEZE detected → create new freeze state (if not already frozen)
//   - ALLOW detected → do NOT automatically unfreeze
//   - Manual override required to unfreeze
//   - Auto-unfreeze is prohibited
//   - No bypass. No warning mode.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - No side effects
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access (caller persists)
//   - No SES calls
//   - No escalation building
//   - No dispatch calls
//   - No anchor modifications
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of input entities
//   - No deletion
//   - Deterministic processing
//   - No auto-unfreeze
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  FreezeState,
  RiskEvaluationResult,
} from '../models/RiskGuardModel';

// ---------------------------------------------------------------------------
// Compute Freeze State
// ---------------------------------------------------------------------------

/**
 * Compute the next freeze state based on risk evaluation.
 *
 * Rules:
 *   1. If riskResult.status === 'FREEZE':
 *      - If already frozen → return existing state (no change)
 *      - If not frozen → create new freeze state
 *   2. If riskResult.status === 'ALLOW':
 *      - Do NOT automatically unfreeze
 *      - Must remain frozen unless manually overridden
 *      - If not frozen → return existing state (no change)
 *
 * Automatic unfreeze is prohibited.
 * Only manualOverrideFreeze() can set isFrozen = false.
 *
 * Parameters:
 *   - currentState: current freeze state (null if no prior state)
 *   - riskResult: evaluation result from riskGuardEngine
 *   - freezeReason: deterministic reason string from buildFreezeReason()
 *   - currentTimestamp: ISO 8601, caller-provided
 *
 * Deterministic — same inputs always produce same output.
 */
export function computeFreezeState(
  currentState: FreezeState | null,
  riskResult: RiskEvaluationResult,
  freezeReason: string,
  currentTimestamp: string
): FreezeState {
  // If risk result is FREEZE
  if (riskResult.status === 'FREEZE') {
    // Already frozen → return existing state unchanged
    if (currentState !== null && currentState.isFrozen) {
      return {
        tenantId: currentState.tenantId,
        isFrozen: currentState.isFrozen,
        freezeReason: currentState.freezeReason,
        frozenAtTimestamp: currentState.frozenAtTimestamp,
        manuallyOverridden: currentState.manuallyOverridden,
        overrideTimestamp: currentState.overrideTimestamp,
      };
    }

    // Not frozen → create new freeze state
    return {
      tenantId: riskResult.tenantId,
      isFrozen: true,
      freezeReason,
      frozenAtTimestamp: currentTimestamp,
      manuallyOverridden: false,
      overrideTimestamp: null,
    };
  }

  // If risk result is ALLOW
  // Do NOT auto-unfreeze — return current state as-is
  if (currentState !== null) {
    return {
      tenantId: currentState.tenantId,
      isFrozen: currentState.isFrozen,
      freezeReason: currentState.freezeReason,
      frozenAtTimestamp: currentState.frozenAtTimestamp,
      manuallyOverridden: currentState.manuallyOverridden,
      overrideTimestamp: currentState.overrideTimestamp,
    };
  }

  // No prior state and ALLOW → create unfrozen default state
  return {
    tenantId: riskResult.tenantId,
    isFrozen: false,
    freezeReason: '',
    frozenAtTimestamp: '',
    manuallyOverridden: false,
    overrideTimestamp: null,
  };
}

// ---------------------------------------------------------------------------
// Manual Override Freeze
// ---------------------------------------------------------------------------

/**
 * Manually override a freeze state — explicit operator action.
 *
 * Sets:
 *   - isFrozen = false
 *   - manuallyOverridden = true
 *   - overrideTimestamp = provided timestamp
 *
 * This is the ONLY way to unfreeze.
 * Auto-unfreeze is prohibited.
 * Override must be explicit call.
 * No auto-reset.
 *
 * Parameters:
 *   - currentState: current freeze state (must be frozen)
 *   - overrideTimestamp: ISO 8601, caller-provided
 *
 * Deterministic — same inputs always produce same output.
 */
export function manualOverrideFreeze(
  currentState: FreezeState,
  overrideTimestamp: string
): FreezeState {
  return {
    tenantId: currentState.tenantId,
    isFrozen: false,
    freezeReason: currentState.freezeReason,
    frozenAtTimestamp: currentState.frozenAtTimestamp,
    manuallyOverridden: true,
    overrideTimestamp,
  };
}
