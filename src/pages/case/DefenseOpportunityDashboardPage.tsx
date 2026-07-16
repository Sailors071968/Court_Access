// ============================================================================
// Program 134 — Defense Opportunity Dashboard (full page)
// Thin wrapper rendering the shared DefenseOpportunityDashboard in full mode.
// ============================================================================

import { useParams } from 'react-router-dom';
import { DefenseOpportunityDashboard } from '../../components/case/DefenseOpportunityDashboard';

export function DefenseOpportunityDashboardPage() {
  const { caseId } = useParams<{ caseId: string }>();
  if (!caseId) return null;
  return <DefenseOpportunityDashboard caseId={caseId} />;
}
