// ============================================================================
// Phase 291.4 — Analysis Regeneration Triggers
// Ensures case analysis and recommendations regenerate when:
//   1. New evidence is uploaded
//   2. Evidence is reprocessed
//   3. Policy database is updated
// ============================================================================

import type { CaseAnalysisOutput } from './evidenceIntelligenceIntegration';
import type { RecommendationGeneratorOutput } from './litigationRecommendationGenerator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegenerationTrigger =
  | 'new_evidence_uploaded'
  | 'evidence_reprocessed'
  | 'policy_database_updated'
  | 'manual_regeneration'
  | 'scheduled_refresh';

export interface RegenerationEvent {
  eventId: string;
  caseId: string;
  trigger: RegenerationTrigger;
  triggeredAt: string;
  triggeredBy: string;
  metadata?: Record<string, unknown>;
}

export interface RegenerationResult {
  eventId: string;
  caseId: string;
  trigger: RegenerationTrigger;
  analysisRegenerated: boolean;
  recommendationsRegenerated: boolean;
  durationMs: number;
  newAnalysisVersion?: number;
  error?: string;
}

export interface RegenerationSubscriber {
  id: string;
  triggers: RegenerationTrigger[];
  callback: (event: RegenerationEvent) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Regeneration Event Bus
// ---------------------------------------------------------------------------

class AnalysisRegenerationBus {
  private subscribers: RegenerationSubscriber[] = [];
  private eventLog: RegenerationEvent[] = [];
  private pendingRegenerations = new Map<string, RegenerationEvent>();

  /**
   * Subscribe to regeneration events.
   * The callback will be invoked whenever a matching trigger fires.
   */
  subscribe(subscriber: RegenerationSubscriber): void {
    this.subscribers.push(subscriber);
    console.log(`[RegenerationBus] Subscriber "${subscriber.id}" registered for triggers: ${subscriber.triggers.join(', ')}`);
  }

  /**
   * Unsubscribe a subscriber by ID
   */
  unsubscribe(subscriberId: string): void {
    this.subscribers = this.subscribers.filter(s => s.id !== subscriberId);
  }

  /**
   * Fire a regeneration trigger. Notifies all matching subscribers.
   * Debounces rapid-fire triggers for the same case (5-second window).
   */
  async fire(event: RegenerationEvent): Promise<void> {
    const debounceKey = `${event.caseId}:${event.trigger}`;
    const pending = this.pendingRegenerations.get(debounceKey);

    if (pending) {
      const pendingTime = new Date(pending.triggeredAt).getTime();
      const eventTime = new Date(event.triggeredAt).getTime();
      if (eventTime - pendingTime < 5000) {
        console.log(`[RegenerationBus] Debounced trigger "${event.trigger}" for case ${event.caseId}`);
        return;
      }
    }

    this.pendingRegenerations.set(debounceKey, event);
    this.eventLog.push(event);

    console.log(`[RegenerationBus] Firing trigger "${event.trigger}" for case ${event.caseId}`);

    const matchingSubscribers = this.subscribers.filter(s =>
      s.triggers.includes(event.trigger)
    );

    for (const subscriber of matchingSubscribers) {
      try {
        await subscriber.callback(event);
      } catch (err) {
        console.error(`[RegenerationBus] Subscriber "${subscriber.id}" failed:`, err);
      }
    }

    // Clean up debounce entry after processing
    setTimeout(() => {
      this.pendingRegenerations.delete(debounceKey);
    }, 5000);
  }

  /**
   * Get recent regeneration events for a case
   */
  getEventLog(caseId?: string, limit = 50): RegenerationEvent[] {
    const filtered = caseId
      ? this.eventLog.filter(e => e.caseId === caseId)
      : this.eventLog;
    return filtered.slice(-limit);
  }

  /**
   * Check if a regeneration is currently pending for a case
   */
  isPending(caseId: string): boolean {
    for (const [key] of this.pendingRegenerations) {
      if (key.startsWith(`${caseId}:`)) return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const regenerationBus = new AnalysisRegenerationBus();

// ---------------------------------------------------------------------------
// Trigger Helper Functions
// ---------------------------------------------------------------------------

/**
 * Call when new evidence is uploaded for a case.
 * Triggers regeneration of both case analysis and litigation recommendations.
 */
export function onNewEvidenceUploaded(caseId: string, uploadedBy: string, fileId: string): void {
  regenerationBus.fire({
    eventId: `regen-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    caseId,
    trigger: 'new_evidence_uploaded',
    triggeredAt: new Date().toISOString(),
    triggeredBy: uploadedBy,
    metadata: { fileId },
  });
}

/**
 * Call when evidence is reprocessed (e.g., OCR re-run, transcript corrected).
 */
export function onEvidenceReprocessed(caseId: string, triggeredBy: string, fileId: string, reason: string): void {
  regenerationBus.fire({
    eventId: `regen-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    caseId,
    trigger: 'evidence_reprocessed',
    triggeredAt: new Date().toISOString(),
    triggeredBy,
    metadata: { fileId, reason },
  });
}

/**
 * Call when the policy database is updated (new policies, rule changes).
 * This affects ALL cases, so it triggers regeneration for every cached case.
 */
export function onPolicyDatabaseUpdated(triggeredBy: string, policyId: string): void {
  // In production, this would query all cases with cached analysis
  // and fire regeneration for each. For now, fire a global event.
  regenerationBus.fire({
    eventId: `regen-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    caseId: '__all__',
    trigger: 'policy_database_updated',
    triggeredAt: new Date().toISOString(),
    triggeredBy,
    metadata: { policyId },
  });
}

/**
 * Check if case analysis should be regenerated based on the trigger type.
 */
export function shouldRegenerate(trigger: RegenerationTrigger): {
  analysis: boolean;
  recommendations: boolean;
} {
  switch (trigger) {
    case 'new_evidence_uploaded':
      return { analysis: true, recommendations: true };
    case 'evidence_reprocessed':
      return { analysis: true, recommendations: true };
    case 'policy_database_updated':
      return { analysis: false, recommendations: true }; // Only recommendations depend on policy
    case 'manual_regeneration':
      return { analysis: true, recommendations: true };
    case 'scheduled_refresh':
      return { analysis: true, recommendations: true };
    default:
      return { analysis: false, recommendations: false };
  }
}
