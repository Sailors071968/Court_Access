// ============================================================================
// CourtAccess — Case Command Center (Program 31)
// Every case's single home. Everything one click away. Progressive disclosure.
// Fully responsive (desktop / tablet / mobile). Built on the component library.
// ============================================================================

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ProgressRing, ProgressBar } from '../../components/ui/progress';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon, type IconName } from '../../components/icons/registry';
import { ExpandableCard } from '../../components/cards/ExpandableCard';
import { IntelligenceGrid } from '../../components/intelligence/IntelligencePanel';
import { TimelineCard } from '../../components/cards/domain-cards';
import { PresentationDeck, buildCourtroomDeck } from '../../components/presentation';
import { DoctrineCompliancePanel } from '../../components/case/DoctrineCompliancePanel';
import { ROLE_PERMISSIONS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { fetchCase, fetchCaseEvidence, type ApiCase, type ApiEvidence } from '../../services/caseApi';

interface QuickTile {
  label: string;
  icon: IconName;
  path: string;
}

const QUICK_TILES: QuickTile[] = [
  { label: 'Evidence', icon: 'evidence', path: 'evidence' },
  { label: 'Documents', icon: 'documents', path: 'documents' },
  { label: 'Timeline', icon: 'timeline', path: 'activity' },
  { label: 'Charges', icon: 'statutes', path: 'charges' },
  { label: 'Witnesses', icon: 'witness', path: 'investigator-workbench' },
  { label: 'Authorities', icon: 'authorities', path: 'attorney-workbench' },
  { label: 'Knowledge Graph', icon: 'knowledgeGraph', path: 'research' },
  { label: 'Reports', icon: 'reports', path: 'reports' },
  { label: 'Discovery', icon: 'discovery', path: 'investigator-workbench' },
  { label: 'Tasks', icon: 'tasks', path: 'attorney-workbench' },
  { label: 'Contradictions', icon: 'contradiction', path: 'contradictions' },
  { label: 'Audit', icon: 'audit', path: 'activity' },
];

export function CaseOverviewPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [currentCase, setCurrentCase] = useState<ApiCase | null>(null);
  const [evidence, setEvidence] = useState<ApiEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [caseData, evidenceData] = await Promise.all([
          fetchCase(caseId),
          fetchCaseEvidence(caseId).catch(() => []),
        ]);
        if (!cancelled) {
          setCurrentCase(caseData);
          setEvidence(evidenceData ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load case');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const evStats = useMemo(() => {
    const analyzed = evidence.filter((e) => e.processingStatus === 'analyzed').length;
    const pending = evidence.filter((e) => ['pending', 'processing'].includes(e.processingStatus)).length;
    const confidence = evidence.length ? Math.round((analyzed / evidence.length) * 100) : 0;
    return { total: evidence.length, analyzed, pending, confidence };
  }, [evidence]);

  if (!user) return null;
  const permissions = ROLE_PERMISSIONS[user.role];
  const showIntelligence = user.role !== 'defendant';
  const go = (path: string) => navigate(`/cases/${caseId}/${path}`.replace(/\/$/, ''));

  if (loading) return <Spinner label="Loading case…" />;

  if (error || !currentCase) {
    return (
      <Card>
        <EmptyState icon={<Icon name="attorney" size={24} />} title="Unable to load case" description={error ?? 'Case not found.'} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={currentCase.title}
        overline="Case Command Center"
        subtitle={`#${currentCase.caseNumber} · ${currentCase.jurisdiction}${currentCase.court ? `, ${currentCase.court}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            <Badge variant="gold">{currentCase.phase ?? 'Active'}</Badge>
            {showIntelligence && (
              <Button variant="secondary" size="sm" onClick={() => setPresenting(true)}>
                <Icon name="reports" size={15} /> Present
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => go('evidence')}>
              <Icon name="upload" size={15} /> Upload
            </Button>
          </div>
        }
      />

      {/* Intelligence headline (hidden for defendant) */}
      {showIntelligence && (
        <IntelligenceGrid
          columns={4}
          panels={[
            { type: 'case_strength', value: '94%', status: 'success', onClick: () => go('charges') },
            { type: 'evidence_confidence', value: `${evStats.confidence}%`, status: evStats.confidence > 70 ? 'success' : 'warning', subtitle: `${evStats.analyzed}/${evStats.total} analyzed`, onClick: () => go('evidence') },
            { type: 'repository_integrity', value: '91%', status: 'info', onClick: () => go('evidence') },
            { type: 'contradictions', value: 2, status: 'warning', onClick: () => go('contradictions') },
          ]}
        />
      )}

      {/* One-click access to everything */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-light mb-3">Jump to</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {QUICK_TILES.map((tile) => (
            <button
              key={tile.label}
              onClick={() => go(tile.path)}
              className="ca-panel ca-panel-hover flex flex-col items-center gap-2 py-4 text-slate-300 hover:text-white"
            >
              <span className="w-10 h-10 rounded-xl ca-icon-gold text-gold-light flex items-center justify-center">
                <Icon name={tile.icon} size={18} />
              </span>
              <span className="text-xs font-medium text-center">{tile.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main responsive layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primary column */}
        <div className="lg:col-span-2 space-y-6">
          <ExpandableCard title="Recent Activity" icon={<Icon name="timeline" size={18} />} subtitle="Latest case events">
            <div className="space-y-1">
              <TimelineCard title="Evidence uploaded" date="2 hours ago" tag="Evidence" />
              <TimelineCard title="Motion recommendation generated" date="4 hours ago" tag="AI" />
              <TimelineCard title="Discovery request acknowledged" date="1 day ago" tag="Discovery" />
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => go('activity')}>
              View full timeline <ArrowRight size={14} />
            </Button>
          </ExpandableCard>

          <ExpandableCard title="Evidence Summary" icon={<Icon name="evidence" size={18} />} subtitle={`${evStats.total} items`}>
            {evStats.total === 0 ? (
              <EmptyState icon={<Icon name="upload" size={20} />} title="No evidence yet" description="Upload discovery to begin OCR and extraction." action={<Button variant="primary" size="sm" onClick={() => go('evidence')}>Upload</Button>} />
            ) : (
              <div className="space-y-3">
                <ProgressBar value={evStats.confidence} tone="emerald" label="Analyzed" showValue />
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Stat label="Total" value={evStats.total} />
                  <Stat label="Analyzed" value={evStats.analyzed} />
                  <Stat label="In queue" value={evStats.pending} />
                </div>
              </div>
            )}
          </ExpandableCard>

          {showIntelligence && (
            <ExpandableCard title="Unknowns & Contradictions" icon={<Icon name="unknown" size={18} />} defaultExpanded={false}>
              <div className="grid sm:grid-cols-2 gap-3">
                <button onClick={() => go('narrative-analysis')} className="ca-panel ca-panel-hover p-4 text-left">
                  <p className="text-2xl font-bold text-white">5</p>
                  <p className="text-xs text-slate-400 mt-1">Open unknowns</p>
                </button>
                <button onClick={() => go('contradictions')} className="ca-panel ca-panel-hover p-4 text-left">
                  <p className="text-2xl font-bold text-white">2</p>
                  <p className="text-xs text-slate-400 mt-1">Contradictions</p>
                </button>
              </div>
            </ExpandableCard>
          )}
        </div>

        {/* Context column */}
        <div className="space-y-6">
          {showIntelligence && (
            <Card>
              <h3 className="text-base font-semibold text-white mb-4">Case Strength</h3>
              <div className="flex flex-col items-center">
                <ProgressRing value={94} sublabel="High" />
                <p className="text-xs text-slate-400 mt-3 text-center">Strong likelihood of a favorable outcome.</p>
              </div>
            </Card>
          )}

          <Card>
            <h3 className="text-base font-semibold text-white mb-4">Upcoming Hearings</h3>
            <div className="space-y-1">
              {currentCase.nextHearing ? (
                <TimelineCard title={currentCase.nextHearingNote ?? 'Hearing'} date={new Date(currentCase.nextHearing).toLocaleString()} />
              ) : (
                <>
                  <TimelineCard title="Hearing" date="Feb 15, 2026" />
                  <TimelineCard title="Filing deadline" date="Feb 20, 2026" />
                </>
              )}
            </div>
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => go('activity')}>View calendar <ArrowRight size={14} /></Button>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-white mb-4">Case Details</h3>
            <dl className="space-y-2 text-sm">
              <Detail label="Status" value={currentCase.status} />
              <Detail label="Judge" value={currentCase.judge ?? '—'} />
              <Detail label="Department" value={currentCase.department ?? '—'} />
              <Detail label="Type" value={currentCase.caseType} />
            </dl>
          </Card>

          {permissions.canViewCharges && (
            <Card>
              <h3 className="text-base font-semibold text-white mb-3">Tasks & Messages</h3>
              <div className="space-y-2">
                <button onClick={() => go('attorney-workbench')} className="flex w-full items-center justify-between p-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-200">
                  <span className="flex items-center gap-2"><Icon name="tasks" size={15} variant="selected" /> Investigation tasks</span>
                  <ArrowRight size={14} className="text-slate-500" />
                </button>
                <button onClick={() => go('activity')} className="flex w-full items-center justify-between p-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-200">
                  <span className="flex items-center gap-2"><Icon name="messages" size={15} variant="selected" /> Case messages</span>
                  <ArrowRight size={14} className="text-slate-500" />
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <DoctrineCompliancePanel />

      {showIntelligence && (
        <PresentationDeck
          title={currentCase.title}
          open={presenting}
          onClose={() => setPresenting(false)}
          slides={buildCourtroomDeck({ caseTitle: currentCase.title, caseStrength: 94, evidenceConfidence: evStats.confidence })}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="ca-panel py-3">
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200 capitalize">{value}</dd>
    </div>
  );
}
