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
import { ProgressRing, ProgressBar } from '../../components/ui/progress';
import { SkeletonStatGrid } from '../../components/ui/skeleton';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/icons/registry';
import { ExpandableCard } from '../../components/cards/ExpandableCard';
import { TimelineCard, EvidenceCard, ReportCard } from '../../components/cards/domain-cards';
import { HumanReviewBanner } from '../../components/indicators/indicators';
import { IntelligencePanel } from '../../components/intelligence/IntelligencePanel';
import { Sparkline } from '../../components/charts/charts';
import { SPACING } from '../../constants/designTokens';
import { useAuthStore } from '../../stores/authStore';
import { fetchCases, fetchCaseEvidence, type ApiCase, type ApiEvidence } from '../../services/caseApi';

const CONFIDENCE_TREND = [62, 68, 71, 75, 79, 84, 88, 91];

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

      {/* One primary decision surfaced first: items needing review */}
      <HumanReviewBanner count={1} onReview={() => navigate(`/cases/${caseId}/narrative`)} />

      {/* Intelligence headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <IntelligencePanel type="case_strength" value="94%" status="success" subtitle="Strong posture" onClick={() => navigate(`/cases/${caseId}/charges`)} />
        <IntelligencePanel type="evidence_confidence" value="98%" status="success" subtitle="106 items reviewed" onClick={() => navigate(`/cases/${caseId}/evidence`)} />
        <IntelligencePanel type="repository_integrity" value="91%" status="info" subtitle="Chain intact" onClick={() => navigate(`/cases/${caseId}/evidence`)} />
        <IntelligencePanel type="contradictions" value={2} status="warning" subtitle="Needs review" onClick={() => navigate(`/cases/${caseId}/narrative`)} />
      </div>

      {/* Main two-column layout — collapses to one column on tablet/mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / primary column */}
        <div className="lg:col-span-2 space-y-6">
          <ExpandableCard title="Today's Priorities" icon={<Icon name="tasks" size={18} />} subtitle="3 items">
            <div className="space-y-2">
              {[
                { label: 'Review Motion to Suppress recommendation (HIGH)', tone: 'warning' as const },
                { label: 'Resolve evidence dispute — People v. Smith', tone: 'danger' as const },
                { label: 'Approve discovery request draft', tone: 'info' as const },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/cases/${caseId}/charges`)}
                  className="flex w-full items-center gap-3 p-3 rounded-lg text-left hover:bg-white/5 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${item.tone === 'danger' ? 'bg-red-400' : item.tone === 'warning' ? 'bg-gold-light' : 'bg-blue-400'}`} />
                  <span className="text-sm text-slate-200 flex-1">{item.label}</span>
                  <ArrowRight size={14} className="text-slate-500" />
                </button>
              ))}
            </div>
          </ExpandableCard>

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
            <div className="grid sm:grid-cols-2 gap-3">
              <IntelligencePanel type="contradictions" value={2} status="warning" compact />
              <IntelligencePanel type="evidence_gaps" value={3} status="danger" compact />
              <IntelligencePanel type="unknowns" value={5} status="info" compact />
              <IntelligencePanel type="authorities" value={8} status="success" compact />
            </div>
          </ExpandableCard>

          <ExpandableCard title="Timeline" icon={<Icon name="timeline" size={18} />} subtitle="Recent case events">
            <div className="space-y-1">
              <TimelineCard title="Evidence dispute added" date="2 hours ago" tag="Evidence" description="People v. Smith — body-cam metadata conflict" />
              <TimelineCard title="Motion recommendation generated" date="4 hours ago" tag="AI" description="Motion to Suppress flagged HIGH" />
              <TimelineCard title="3 documents uploaded" date="6 hours ago" tag="Discovery" />
            </div>
          </ExpandableCard>
        </div>

        {/* Right / context column */}
        <div className="space-y-6">
          <ExpandableCard title="Current Case" icon={<Icon name="attorney" size={18} />}>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-white">{caseTitle}</p>
                <p className="text-xs text-slate-500 mt-0.5">{primaryCase.jurisdiction} · {primaryCase.status}</p>
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
              <ProgressRing value={94} sublabel="High" />
              <p className="text-xs text-slate-400 mt-3 text-center">Strong likelihood of a favorable outcome based on current record.</p>
            </div>
          </ExpandableCard>

          <ExpandableCard title="Evidence Confidence" icon={<Icon name="evidenceConfidence" size={18} />}>
            <Sparkline data={CONFIDENCE_TREND} />
            <div className="mt-3">
              <ProgressBar value={98} tone="emerald" label="Overall confidence" showValue />
            </div>
          </ExpandableCard>

          <ExpandableCard title="Upcoming Hearings" icon={<Icon name="calendar" size={18} />} subtitle="Next 30 days">
            <div className="space-y-1">
              <TimelineCard title="Hearing — People v. Smith" date="Feb 15, 2026" />
              <TimelineCard title="Filing deadline — Motion to Suppress" date="Feb 20, 2026" />
            </div>
          </ExpandableCard>

          <ExpandableCard title="Discovery Status" icon={<Icon name="discovery" size={18} />}>
            <ProgressBar value={72} tone="blue" label="Discovery reviewed" showValue />
            <p className="text-xs text-slate-500 mt-2">18 of 25 items processed.</p>
          </ExpandableCard>

          <ExpandableCard title="Investigation Tasks" icon={<Icon name="tasks" size={18} />} subtitle="2 open" defaultExpanded={false}>
            <div className="space-y-2 text-sm text-slate-300">
              <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gold-light" /> Interview forensic toxicologist</p>
              <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Subpoena dispatch logs</p>
            </div>
          </ExpandableCard>

          <ExpandableCard title="Reports" icon={<Icon name="reports" size={18} />} subtitle="Generate & export" defaultExpanded={false}>
            <div className="space-y-3">
              <ReportCard title="Attorney Report" description="Full case intelligence" format="PDF / Word" onGenerate={() => navigate(`/cases/${caseId}/attorney-workbench`)} />
              <ReportCard title="Chronology" description="Timeline export" format="PDF" onGenerate={() => navigate(`/cases/${caseId}/attorney-workbench`)} />
            </div>
          </ExpandableCard>
        </div>
      </div>
    </div>
  );
}
