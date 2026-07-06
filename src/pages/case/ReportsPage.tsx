// ============================================================================
// CourtAccess — Reports (Program 30)
// One report engine renders every report type from the workbench bundle.
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/page-header';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Spinner } from '../../components/ui/spinner';
import { Icon } from '../../components/icons/registry';
import { ReportEngine } from '../../components/report/ReportEngine';
import { buildReport } from '../../components/report/reportBuilder';
import type { ReportType } from '../../components/report/types';
import { fetchWorkbench, type WorkbenchBundle, type CitationRef } from '../../services/workbenchApi';

export function ReportsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('attorney_report');

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchWorkbench(caseId);
        if (!cancelled) setBundle(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const report = useMemo(() => (bundle ? buildReport(reportType, bundle) : null), [bundle, reportType]);

  const drill = (ref: CitationRef) => {
    if (ref.type === 'evidence') navigate(`/cases/${caseId}/evidence`);
    else if (ref.type === 'timeline') navigate(`/cases/${caseId}/activity`);
  };

  if (loading) return <Spinner label="Building report…" />;

  if (error || !report) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" overline="Reports" />
        <Card>
          <EmptyState
            icon={<Icon name="reports" size={24} />}
            title="Report data unavailable"
            description={error ?? 'Process the case to generate report intelligence.'}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" overline="Reports" subtitle="Attorney & client reports, indexes, and trial materials — one engine." />
      <ReportEngine report={report} reportType={reportType} onChangeType={setReportType} onDrillCitation={drill} />
    </div>
  );
}
