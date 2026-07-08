// ============================================================================
// CourtAccess — Attorney Workspace (Program 20, flagship)
// Calm, premium, progressive-disclosure dashboard built entirely on the
// master component library. Responsive: desktop / tablet / mobile.
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Upload, ArrowRight, Scale, ShieldCheck, BarChart3, AlertTriangle,
  Briefcase, Gavel, Calendar, Network, Clock, Landmark,
} from 'lucide-react';
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
import { SPACING } from '../../constants/designTokens';
import { useAuthStore } from '../../stores/authStore';
import { fetchCases, fetchCaseEvidence, type ApiCase, type ApiEvidence } from '../../services/caseApi';

const TONE_CLASS: Record<string, string> = {
  emerald: 'ca-icon-emerald text-emerald-300',
  blue: 'ca-icon-blue text-blue-300',
  violet: 'ca-icon-violet text-violet-300',
  gold: 'ca-icon-gold text-gold-light',
};
const TAG_CLASS: Record<string, string> = {
  emerald: 'text-emerald-300', blue: 'text-blue-300', violet: 'text-violet-300', gold: 'text-gold-light',
};

// Phase 3 — large color-themed intelligence card, matching the approved
// reference hero cards (icon tile + value + colored tag + supporting text).
// Values remain UNKNOWN until computed from the repository (never fabricated).
function IntelCard({ tone, icon, label, value, tag, desc, onClick }: {
  tone: 'emerald' | 'blue' | 'violet' | 'gold';
  icon: React.ReactNode; label: string; value: string; tag: string; desc: string; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-gold/30 hover:bg-white/[0.05] hover:-translate-y-0.5 hover:shadow-elevated transition-all duration-200"
    >
      <div className="flex items-center gap-3.5 mb-3">
        <span className={`inline-flex w-14 h-14 rounded-2xl items-center justify-center flex-shrink-0 ${TONE_CLASS[tone]}`}>{icon}</span>
        <div className="min-w-0">
          <div className="text-3xl font-bold text-white leading-none tracking-tight">{value}</div>
          <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] mt-1.5 ${TAG_CLASS[tone]}`}>{tag}</div>
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-200">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
    </button>
  );
}

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
      {/* Phase 2 — premium case header hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 ca-gradient-hero ca-grid-overlay">
        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex items-start gap-5 min-w-0">
              <div className="w-16 h-16 rounded-2xl ca-gradient-gold flex items-center justify-center shadow-gold flex-shrink-0">
                <Scale size={30} className="text-navy" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-light">Attorney Workspace · Welcome back, {user?.name}</p>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mt-1 truncate">{caseTitle}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge variant="gold">{primaryCase.caseNumber}</Badge>
                  <Badge variant="navy" className="capitalize">{primaryCase.status}</Badge>
                  {primaryCase.phase && <Badge variant="default" className="capitalize">{primaryCase.phase}</Badge>}
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 mt-5 text-sm">
                  <div><dt className="text-xs text-slate-400 flex items-center gap-1"><Landmark size={12} /> Court</dt><dd className="text-slate-200 mt-0.5 truncate">{primaryCase.court ?? 'UNKNOWN'}</dd></div>
                  <div><dt className="text-xs text-slate-400 flex items-center gap-1"><Gavel size={12} /> Judge</dt><dd className="text-slate-200 mt-0.5 truncate">{primaryCase.judge ?? 'UNKNOWN'}</dd></div>
                  <div><dt className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={12} /> Next hearing</dt><dd className="text-slate-200 mt-0.5">{primaryCase.nextHearing ? new Date(primaryCase.nextHearing).toLocaleDateString() : 'None set'}</dd></div>
                  <div><dt className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12} /> Last updated</dt><dd className="text-slate-200 mt-0.5">{primaryCase.updatedAt ? new Date(primaryCase.updatedAt).toLocaleDateString() : 'UNKNOWN'}</dd></div>
                </dl>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <Button variant="secondary" onClick={() => navigate(`/cases/${caseId}/evidence`)}><Upload size={16} /> Upload</Button>
              <Button variant="primary" onClick={() => navigate(`/cases/${caseId}`)}>Open Case <ArrowRight size={16} /></Button>
            </div>
          </div>
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-white/10">
            {([
              ['Workbench', 'attorney-workbench', <Briefcase size={14} key="w" />],
              ['Knowledge Graph', 'knowledge-graph', <Network size={14} key="k" />],
              ['Timeline', 'timeline', <Clock size={14} key="t" />],
              ['Evidence', 'evidence', <Icon name="evidence" size={14} key="e" />],
              ['Charges', 'charges', <Scale size={14} key="c" />],
              ['Reports', 'reports', <Icon name="reports" size={14} key="r" />],
            ] as const).map(([label, path, icon]) => (
              <button key={label} onClick={() => navigate(`/cases/${caseId}/${path}`)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-slate-200 hover:border-gold/30 hover:bg-white/5 hover:text-white transition-colors">
                <span className="text-gold-light">{icon}</span> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Phase 3 — large color-themed intelligence cards. Analytics compute from
          the repository; shown as UNKNOWN until processed (never fabricated). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <IntelCard tone="emerald" icon={<Scale size={26} />} label="Case Strength" value="UNKNOWN" tag="Awaiting analysis" desc="Overall defense posture — process case to compute" onClick={() => navigate(`/cases/${caseId}/charges`)} />
        <IntelCard tone="blue" icon={<ShieldCheck size={26} />} label="Evidence Confidence" value="UNKNOWN" tag="Awaiting analysis" desc="Reliability of extracted evidence" onClick={() => navigate(`/cases/${caseId}/evidence`)} />
        <IntelCard tone="violet" icon={<BarChart3 size={26} />} label="Repository Integrity" value="UNKNOWN" tag="Awaiting analysis" desc="Chain of custody & completeness" onClick={() => navigate(`/cases/${caseId}/evidence`)} />
        <IntelCard tone="gold" icon={<AlertTriangle size={26} />} label="Contradictions" value="UNKNOWN" tag="Awaiting analysis" desc="Conflicting statements & facts" onClick={() => navigate(`/cases/${caseId}/contradictions`)} />
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
