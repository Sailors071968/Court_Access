// ============================================================================
// Program 136 — Marketing Demonstration Mode
// A dedicated, visually-stunning marketing surface rendering the Defense
// Opportunity Dashboard with a permanently-labeled ILLUSTRATIVE DEMONSTRATION
// dataset. Suitable for hero screenshots, Instagram/YouTube reels, and sales
// presentations. Contains no real case data and never asserts guilt or outcome.
// ============================================================================

import { DefenseOpportunityDashboard } from '../../components/case/DefenseOpportunityDashboard';

export function DemonstrationModePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <DefenseOpportunityDashboard mode="demo" />
    </div>
  );
}
