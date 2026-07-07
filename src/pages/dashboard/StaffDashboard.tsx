// ============================================================================
// CourtAccess — Attorney Workspace (Program 20, flagship)
// Calm, premium, progressive-disclosure dashboard built entirely on the
// master component library. Responsive: desktop / tablet / mobile.
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Upload, ArrowRight } from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ProgressRing } from '../../components/ui/progress';
import { SkeletonStatGrid } from '../../components/ui/skeleton';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/icons/registry';
import { ExpandableCard } from '../../components/cards/ExpandableCard';
import { TimelineCard, EvidenceCard, ReportCard } from '../../components/cards/domain-cards';
import { IntelligencePanel } from '../../components/intelligence/IntelligencePanel';
import { SPACING } from '../../constants/designTokens';
import { useAuthStore } from '../../stores/authStore';
import { fetchCases, fetchCaseEvidence, type ApiCase, type ApiEvidence } from '../../services/caseApi';

export function StaffDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [primaryCase, setPrimaryCase] = useState<ApiCase | null>(null);
  const [evidence, setEvidence] = useState<ApiEvidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const allCases = await fetchCases().catch(() => []);
        if (cancelled) return;
        const first = allCases?.[0] ?? null;
        setPrimaryCase(first);
        if (first) {
          const docs = await fetchCaseEvidence(first.caseId).catch(() => []);
          if (!cancelled) setEvidence(docs ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className={`${SPACING.container} space-y-6`}>
        <SkeletonStatGrid count={4} />
        <SkeletonStatGrid count={2} />
      </div>
    );
  }

  if (!primaryCase) {
    return (
      <div className={`${SPACING.container} ${SPACING.stack}`}>
        <PageHeader title="Attorney Workspace" subtitle={`Welcome back, ${user?.name}`} overline="Dashboard" />
        <Card>
          <EmptyState
            icon={<Icon name="attorney" size={24} />}
            title="Create your first case"
            description="Open a case to begin building citation-backed intelligence, evidence maps, and reports."
            action={<Button variant="primary" onClick={() => navigate('/cases')}>Go to Cases</Button>}
          />
        </Card>
      </div>
    );
  }

  const caseId = primaryCase.caseId;
  const caseTitle = primaryCase.title || primaryCase.caseNumber;

  return (
    <div className={`${SPACING.container} space-y-6`}>
      <PageHeader
        title="Attorney Workspace"
        overline="Dashboard"
        subtitle={`Welcome back, ${user?.name}`}
        action={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate(`/cases/${caseId}/evidence`)}>
              <Upload size={16} /> Upload
            </Button>
            <Button variant="primary" onClick={() => navigate(`/cases/${caseId}`)}>
              Open Case <ArrowRight size={16} />
            </Button>
          </div>
        }
      />

      {/* Intelligence headline — analytics compute from the repository; shown as
          UNKNOWN until the case is processed (never fabricated). */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <IntelligencePanel type="case_strength" value="UNKNOWN" subtitle="Process case to compute" onClick={() => navigate(`/cases/${caseId}/charges`)} />
        <IntelligencePanel type="evidence_confidence" value="UNKNOWN" subtitle="Awaiting analysis" onClick={() => navigate(`/cases/${caseId}/evidence`)} />
        <IntelligencePanel type="repository_integrity" value="UNKNOWN" subtitle="Awaiting analysis" onClick={() => navigate(`/cases/${caseId}/evidence`)} />
        <IntelligencePanel type="contradictions" value="UNKNOWN" subtitle="Awaiting analysis" onClick={() => navigate(`/cases/${caseId}/narrative`)} />
      </div>

      {/* Main two-column layout — collapses to one column on tablet/mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / primary column */}
        <div className="lg:col-span-2 space-y-6">
          <ExpandableCard title="Recent Evidence" icon={<Icon name="evidence" size={18} />} subtitle={`${evidence.length} items`}>
            {evidence.length === 0 ? (
              <EmptyState
                icon={<Icon name="upload" size={20} />}
                title="No evidence yet"
                description="Upload discovery to start OCR and evidence extraction."
                action={<Button variant="primary" onClick={() => navigate(`/cases/${caseId}/evidence`)}>Upload Evidence</Button>}
              />
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {evidence.slice(0, 4).map((doc) => (
                  <EvidenceCard
                    key={doc.evidenceId}
                    title={doc.fileName}
                    type={doc.evidenceType}
                    status={doc.processingStatus}
                    onClick={() => navigate(`/cases/${caseId}/evidence`)}
                  />
                ))}
              </div>
            )}
          </ExpandableCard>

          <ExpandableCard title="AI Findings" icon={<Icon name="aiAnalysis" size={18} />} subtitle="Contradictions, gaps & unknowns">
            <EmptyState
              icon={<Icon name="aiAnalysis" size={20} />}
              title="No findings computed yet"
              description="AI findings are derived from processed evidence. Process the case to populate contradictions, gaps, and unknowns."
            />
          </ExpandableCard>

          <ExpandableCard title="Timeline" icon={<Icon name="timeline" size={18} />} subtitle="Case events">
            <EmptyState
              icon={<Icon name="timeline" size={20} />}
              title="Timeline builds from the record"
              description="Open the case timeline to view citation-backed events."
              action={<Button variant="secondary" onClick={() => navigate(`/cases/${caseId}/activity`)}>View timeline</Button>}
            />
          </ExpandableCard>
        </div>

        {/* Right / context column */}
        <div className="space-y-6">
          <ExpandableCard title="Current Case" icon={<Icon name="attorney" size={18} />}>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-white">{caseTitle}</p>
                <p className="text-xs text-slate-400 mt-0.5">{primaryCase.jurisdiction} · {primaryCase.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="gold">{primaryCase.phase ?? 'Active'}</Badge>
                {primaryCase.court && <Badge variant="default">{primaryCase.court}</Badge>}
              </div>
              <Button variant="navy" className="w-full" onClick={() => navigate(`/cases/${caseId}`)}>
                Open case
              </Button>
            </div>
          </ExpandableCard>

          <ExpandableCard title="Case Strength" icon={<Icon name="caseStrength" size={18} />}>
            <div className="flex flex-col items-center py-2">
              <ProgressRing value={0} label="UNKNOWN" />
              <p className="text-xs text-slate-400 mt-3 text-center">Case strength is computed from the record once the case is processed.</p>
            </div>
          </ExpandableCard>

          <ExpandableCard title="Upcoming Hearings" icon={<Icon name="calendar" size={18} />} subtitle="From case record">
            {primaryCase.nextHearing ? (
              <TimelineCard title={primaryCase.nextHearingNote ?? 'Hearing'} date={new Date(primaryCase.nextHearing).toLocaleString()} />
            ) : (
              <EmptyState icon={<Icon name="calendar" size={20} />} title="No scheduled hearings" description="Hearing dates appear here when set on the case." />
            )}
          </ExpandableCard>

          <ExpandableCard title="Reports" icon={<Icon name="reports" size={18} />} subtitle="Generate & export" defaultExpanded={false}>
            <div className="space-y-3">
              <ReportCard title="Attorney Report" description="Full case intelligence" format="PDF / Word" onGenerate={() => navigate(`/cases/${caseId}/reports`)} />
              <ReportCard title="Chronology" description="Timeline export" format="PDF" onGenerate={() => navigate(`/cases/${caseId}/reports`)} />
            </div>
          </ExpandableCard>
        </div>
      </div>
    </div>
  );
}
