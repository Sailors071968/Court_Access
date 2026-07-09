// ============================================================================
// Domain V — Attorney Workbench
// Primary daily workspace for criminal defense attorneys
// Route: /cases/:caseId/attorney-workbench
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Scale,
  FileSearch,
  BookOpen,
  Search,
  Gavel,
  StickyNote,
  LayoutDashboard,
  Download,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Pin,
  Plus,
  CheckCircle2,
  FileText,
  Network,
  Clock,
  Users,
  Library,
  Landmark,
  ClipboardList,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, StatCard } from '../../components/common/Card';
import {
  fetchWorkbench,
  fetchWorkbenchExport,
  createWorkbenchNote,
  createWorkbenchTask,
  updateWorkbenchTask,
  pinWorkbenchItem,
  type WorkbenchBundle,
  type ExportPackageType,
} from '../../services/workbenchApi';

type TabId =
  | 'overview'
  | 'offenses'
  | 'evidence'
  | 'authority'
  | 'investigation'
  | 'trial-prep'
  | 'notes'
  | 'command'
  | 'exports';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Case Overview', icon: <Briefcase size={16} /> },
  { id: 'offenses', label: 'Offense Analysis', icon: <Scale size={16} /> },
  { id: 'evidence', label: 'Evidence', icon: <FileSearch size={16} /> },
  { id: 'authority', label: 'Legal Authority', icon: <BookOpen size={16} /> },
  { id: 'investigation', label: 'Investigation', icon: <Search size={16} /> },
  { id: 'trial-prep', label: 'Trial Prep', icon: <Gavel size={16} /> },
  { id: 'notes', label: 'Notes & Pins', icon: <StickyNote size={16} /> },
  { id: 'command', label: 'Command Center', icon: <LayoutDashboard size={16} /> },
  { id: 'exports', label: 'Exports', icon: <Download size={16} /> },
];

const EXPORT_OPTIONS: Array<{ type: ExportPackageType; label: string }> = [
  { type: 'attorney_report', label: 'Attorney Report' },
  { type: 'trial_notebook', label: 'Trial Notebook' },
  { type: 'evidence_package', label: 'Evidence Package' },
  { type: 'witness_binder', label: 'Witness Binder' },
  { type: 'authority_binder', label: 'Authority Binder' },
  { type: 'motion_package', label: 'Motion Package' },
  { type: 'discovery_package', label: 'Discovery Package' },
  { type: 'investigation_package', label: 'Investigation Package' },
  { type: 'chronology', label: 'Chronology' },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    satisfied: 'bg-emerald-500/15 text-emerald-300',
    unsatisfied: 'bg-red-500/15 text-red-300',
    unknown: 'bg-white/10 text-slate-200',
    disputed: 'bg-amber-500/15 text-amber-300',
    open: 'bg-blue-500/15 text-blue-300',
    in_progress: 'bg-indigo-100 text-indigo-800',
    completed: 'bg-emerald-500/15 text-emerald-300',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-white/10 text-slate-200'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ExpandableSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/10 rounded-lg">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 text-left font-medium text-white hover:bg-white/5"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {title}
      </button>
      {open && <div className="px-4 pb-4 border-t border-white/10">{children}</div>}
    </div>
  );
}

function CitationList({ citations }: { citations: Array<{ type: string; id: string; label?: string }> }) {
  if (!citations.length) return <span className="text-xs text-slate-400">No citations</span>;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {citations.map((c) => (
        <span key={`${c.type}-${c.id}`} className="text-xs bg-white/10 text-slate-300 px-1.5 py-0.5 rounded">
          {c.type}:{c.label ?? c.id.slice(0, 8)}
        </span>
      ))}
    </div>
  );
}

// Phase 4 — one-click litigation actions. Every target is a real, mounted case route.
const ATTORNEY_ACTIONS: Array<{ label: string; icon: React.ReactNode; path: string }> = [
  { label: 'Create Motion', icon: <Gavel size={16} />, path: 'motions' },
  { label: 'Attorney Report', icon: <FileText size={16} />, path: 'report' },
  { label: 'Trial Prep', icon: <ShieldCheck size={16} />, path: 'trial-prep' },
  { label: 'Voir Dire', icon: <Users size={16} />, path: 'voir-dire' },
  { label: 'Sentencing', icon: <Scale size={16} />, path: 'sentencing' },
  { label: 'Search Authorities', icon: <BookOpen size={16} />, path: 'research' },
  { label: 'Review Evidence', icon: <FileSearch size={16} />, path: 'evidence' },
  { label: 'Review Charges', icon: <Scale size={16} />, path: 'charges' },
  { label: 'Review Discovery', icon: <ClipboardList size={16} />, path: 'discovery' },
  { label: 'Review Witnesses', icon: <Users size={16} />, path: 'witnesses' },
  { label: 'Review Timeline', icon: <Clock size={16} />, path: 'timeline' },
  { label: 'Knowledge Graph', icon: <Network size={16} />, path: 'knowledge-graph' },
  { label: 'CourtListener', icon: <Landmark size={16} />, path: 'research' },
  { label: 'CALCRIM', icon: <Library size={16} />, path: 'calcrim' },
  { label: 'Repository Browser', icon: <Search size={16} />, path: 'research' },
];

export function AttorneyWorkbenchPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [data, setData] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState('');
  const [expandedCharge, setExpandedCharge] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const bundle = await fetchWorkbench(caseId);
      setData(bundle);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workbench');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async (type: ExportPackageType) => {
    if (!caseId) return;
    setExporting(type);
    try {
      const pkg = await fetchWorkbenchExport(caseId, type);
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workbench-${type}-${caseId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const handleAddNote = async () => {
    if (!caseId || !noteText.trim()) return;
    await createWorkbenchNote(caseId, noteText.trim());
    setNoteText('');
    await load();
  };

  const handleAddTask = async () => {
    if (!caseId || !taskTitle.trim()) return;
    await createWorkbenchTask(caseId, { title: taskTitle.trim() });
    setTaskTitle('');
    await load();
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <AlertTriangle className="mx-auto text-red-500 mb-3" size={32} />
        <p className="text-red-300">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const filteredEvidence = data.evidenceWorkbench.items.filter(
    (e) => !evidenceFilter || e.fileName.toLowerCase().includes(evidenceFilter.toLowerCase()) || e.evidenceType.includes(evidenceFilter),
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-light">Litigation Command Center</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2 mt-1">
            <Briefcase size={26} className="text-gold-light" /> Attorney Workbench
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            {data.caseOverview.case.title} — {data.caseOverview.case.caseNumber}
            <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded-full">v{data.workbenchVersion}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 px-4 h-9 text-sm font-semibold border border-white/10 rounded-xl text-slate-200 hover:bg-white/5"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      {/* Phase 4 — Attorney Actions (one-click litigation launcher) */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Attorney Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {ATTORNEY_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => caseId && navigate(`/cases/${caseId}/${a.path}`)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-slate-200 hover:border-gold/30 hover:bg-white/5 hover:text-white transition-colors text-left"
            >
              <span className="text-gold-light flex-shrink-0">{a.icon}</span>
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Phase 1/3 — litigation status command widgets (real command-center metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {([
          ['Case Health', `${data.commandCenter.caseHealth.score}%`, <Briefcase size={18} />, data.commandCenter.caseHealth.score],
          ['Evidence Health', `${data.commandCenter.evidenceHealth.score}%`, <FileSearch size={18} />, data.commandCenter.evidenceHealth.score],
          ['Legal Coverage', `${data.commandCenter.legalCoverage.score}%`, <Scale size={18} />, data.commandCenter.legalCoverage.score],
          ['Trial Readiness', `${data.commandCenter.trialReadiness.score}%`, <Gavel size={18} />, data.commandCenter.trialReadiness.score],
          ['Outstanding Unknowns', data.commandCenter.unknownCount, <AlertTriangle size={18} />, data.commandCenter.unknownCount === 0 ? 100 : 0],
        ] as const).map(([label, value, icon, score]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span className={`inline-flex w-9 h-9 rounded-lg items-center justify-center mb-2 ${Number(score) >= 67 ? 'ca-icon-emerald text-emerald-300' : Number(score) >= 34 ? 'ca-icon-gold text-gold-light' : 'ca-icon-blue text-blue-300'}`}>{icon}</span>
            <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
            <div className="text-xs font-medium text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-white/10 pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-gold text-white' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader title="Case Summary" subtitle="Evidence-governed case understanding" />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-400">Client</dt><dd className="font-medium">{data.caseOverview.client?.name ?? 'UNKNOWN'}</dd></div>
              <div><dt className="text-slate-400">Status</dt><dd>{data.caseOverview.currentStatus}</dd></div>
              <div><dt className="text-slate-400">Court</dt><dd>{data.caseOverview.court ?? 'UNKNOWN'}</dd></div>
              <div><dt className="text-slate-400">Judge</dt><dd>{data.caseOverview.judge ?? 'UNKNOWN'}</dd></div>
              <div><dt className="text-slate-400">Prosecutor</dt><dd>{data.caseOverview.prosecutor ?? 'UNKNOWN'}</dd></div>
              <div><dt className="text-slate-400">Defense</dt><dd>{data.caseOverview.defenseTeam.map((d) => d.role).join(', ') || 'UNKNOWN'}</dd></div>
            </dl>
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-2">Charges</h4>
              <ul className="space-y-1">
                {data.caseOverview.charges.map((c) => (
                  <li key={c.id} className="text-sm">{c.code} §{c.section} — {c.title ?? 'Untitled'}</li>
                ))}
              </ul>
            </div>
            {data.caseOverview.upcomingHearings[0]?.date && (
              <div className="mt-4 p-3 bg-amber-500/10 rounded-lg text-sm">
                <strong>Next hearing:</strong> {new Date(data.caseOverview.upcomingHearings[0].date).toLocaleDateString()}
                {data.caseOverview.upcomingHearings[0].note && ` — ${data.caseOverview.upcomingHearings[0].note}`}
              </div>
            )}
          </Card>
          <div className="space-y-4">
            <StatCard icon={<AlertTriangle size={20} />} value={data.caseOverview.intelligenceSummary.unknownCount} label="Outstanding Unknowns" highlight={data.caseOverview.intelligenceSummary.unknownCount > 0} />
            <StatCard icon={<FileSearch size={20} />} value={data.caseOverview.evidenceSummary.total} label="Evidence Items" />
            <StatCard icon={<Scale size={20} />} value={data.caseOverview.intelligenceSummary.offenseCount} label="Charged Offenses" />
          </div>
          <Card className="lg:col-span-3">
            <CardHeader title="Case Timeline" />
            {data.caseOverview.caseTimeline.length === 0 ? (
              <p className="text-sm text-slate-400">No timeline events — UNKNOWN timeline coverage</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {data.caseOverview.caseTimeline.map((e) => (
                  <li key={e.id} className={`text-sm p-2 rounded ${e.conflictFlag ? 'bg-red-500/10 border border-red-100' : 'bg-white/5'}`}>
                    <span className="text-slate-400">{e.timestamp ? new Date(e.timestamp).toLocaleString() : 'UNKNOWN time'}</span>
                    {e.actor && <span className="ml-2 font-medium">{e.actor}: </span>}
                    {e.description}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {data.caseOverview.outstandingUnknowns.length > 0 && (
            <Card className="lg:col-span-3">
              <CardHeader title="Outstanding Unknowns" subtitle="Never fabricated — explicitly reported" />
              <ul className="list-disc list-inside text-sm text-slate-200 space-y-1">
                {data.caseOverview.outstandingUnknowns.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'offenses' && (
        <div className="space-y-4">
          {data.elementMatrices.map((matrix) => {
            const legal = data.offenseAnalysis.find((o) => o.chargeId === matrix.chargeId);
            const isOpen = expandedCharge === matrix.chargeId;
            return (
              <Card key={matrix.chargeId}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setExpandedCharge(isOpen ? null : matrix.chargeId)}
                >
                  <div>
                    <h3 className="text-lg font-semibold">{matrix.code} §{matrix.section}</h3>
                    <p className="text-sm text-slate-400">{matrix.rows.length} elements · {legal?.applicableCalcrim.length ?? 0} CALCRIM</p>
                  </div>
                  {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>
                {isOpen && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    {legal && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div><strong>Defenses:</strong> {legal.defenses.length ? legal.defenses.join('; ') : 'None identified'}</div>
                        <div><strong>Exceptions:</strong> {legal.exceptions.length ? legal.exceptions.join('; ') : 'None identified'}</div>
                        <div><strong>Enhancements:</strong> {legal.enhancements.length ? legal.enhancements.join('; ') : 'None identified'}</div>
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-400 border-b">
                          <th className="pb-2">Element</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2">Confidence</th>
                          <th className="pb-2">Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.rows.map((row) => (
                          <tr key={row.elementId} className="border-b border-gray-50">
                            <td className="py-2">{row.elementLabel}</td>
                            <td className="py-2"><StatusBadge status={row.status} /></td>
                            <td className="py-2">{row.confidence}</td>
                            <td className="py-2">
                              {row.supportingEvidence.length > 0 && (
                                <span className="text-emerald-300">{row.supportingEvidence.length} supporting</span>
                              )}
                              {row.contradictoryEvidence.length > 0 && (
                                <span className="text-red-300 ml-2">{row.contradictoryEvidence.length} contradictory</span>
                              )}
                              {row.missingEvidenceReason && (
                                <p className="text-xs text-amber-600 mt-0.5">{row.missingEvidenceReason}</p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {legal?.unknownLegalQuestions.length ? (
                      <div className="text-sm text-amber-300 bg-amber-500/10 p-3 rounded">
                        <strong>Unknown legal questions:</strong> {legal.unknownLegalQuestions.join('; ')}
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Filter evidence..."
              value={evidenceFilter}
              onChange={(e) => setEvidenceFilter(e.target.value)}
              className="flex-1 px-3 py-2 border border-white/10 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader title="Evidence Items" subtitle={`${filteredEvidence.length} items`} />
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {filteredEvidence.map((e) => (
                  <li key={e.evidenceId} className="flex items-center justify-between p-2 bg-white/5 rounded text-sm">
                    <div>
                      <span className="font-medium">{e.fileName}</span>
                      <span className="ml-2 text-slate-400">{e.evidenceType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={e.processingStatus} />
                      <button
                        type="button"
                        title="Pin evidence"
                        onClick={() => void pinWorkbenchItem(caseId!, 'evidence', e.evidenceId, e.fileName).then(() => load())}
                        className="text-slate-400 hover:text-amber-600"
                      >
                        <Pin size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader title="Contradictions" />
                <p className="text-2xl font-bold">{data.evidenceWorkbench.contradictions.length}</p>
              </Card>
              <Card>
                <CardHeader title="Duplicates" />
                <p className="text-2xl font-bold">{data.evidenceWorkbench.duplicates.length}</p>
              </Card>
              <Card>
                <CardHeader title="Evidence Graph" />
                <p className="text-sm text-slate-300">{data.evidenceWorkbench.graph.nodes.length} nodes, {data.evidenceWorkbench.graph.edges.length} edges</p>
              </Card>
            </div>
          </div>
          {data.evidenceWorkbench.missing.length > 0 && (
            <Card>
              <CardHeader title="Missing Evidence" />
              <ul className="list-disc list-inside text-sm">{data.evidenceWorkbench.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'authority' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="CALCRIM Instructions" />
              {data.legalAuthority.calcrim.map((c) => (
                <ExpandableSection key={c.id} title={c.finding}>
                  <p className="text-sm text-slate-300">Expandable authority with repository audit trail</p>
                </ExpandableSection>
              ))}
            </Card>
            <Card>
              <CardHeader title="Authorities" />
              <ul className="space-y-1 text-sm">
                {data.legalAuthority.authorities.map((a) => (
                  <li key={a.id} className="p-2 bg-white/5 rounded">{a.finding}</li>
                ))}
              </ul>
            </Card>
          </div>
          <Card>
            <CardHeader title="Defenses, Exceptions, Enhancements" />
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><strong>Defenses</strong><ul className="mt-1 list-disc list-inside">{data.legalAuthority.defenses.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
              <div><strong>Exceptions</strong><ul className="mt-1 list-disc list-inside">{data.legalAuthority.exceptions.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
              <div><strong>Enhancements</strong><ul className="mt-1 list-disc list-inside">{data.legalAuthority.enhancements.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
            </div>
          </Card>
          {data.legalAuthority.relatedOffenses.length > 0 && (
            <Card>
              <CardHeader title="Related Offenses" />
              <ul className="text-sm list-disc list-inside">{data.legalAuthority.relatedOffenses.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'investigation' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Recommended Investigation" />
            <ul className="list-disc list-inside text-sm space-y-1">
              {data.investigation.recommendedInvestigation.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Evidence Gaps" />
              <ul className="text-sm space-y-1">{data.investigation.evidenceGaps.map((g, i) => <li key={i}>{g.finding}</li>)}</ul>
            </Card>
            <Card>
              <CardHeader title="Timeline Gaps" />
              <ul className="text-sm space-y-1">{data.investigation.timelineGaps.map((g, i) => <li key={i}>{g.finding}</li>)}</ul>
            </Card>
          </div>
          <Card>
            <CardHeader
              title="Investigation Tasks"
              action={
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New task..."
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="px-2 py-1 border rounded text-sm"
                  />
                  <button type="button" onClick={() => void handleAddTask()} className="px-2 py-1 bg-slate-800 text-white rounded text-sm flex items-center gap-1">
                    <Plus size={14} /> Add
                  </button>
                </div>
              }
            />
            <ul className="space-y-2">
              {data.investigation.tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between p-2 bg-white/5 rounded text-sm">
                  <div>
                    <span className="font-medium">{t.title}</span>
                    {t.assignedTo && <span className="ml-2 text-slate-400">→ {t.assignedTo}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.status} />
                    {t.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => void updateWorkbenchTask(caseId!, t.id, { status: 'completed' }).then(() => load())}
                        className="text-green-600"
                        title="Mark complete"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Discovery Requests" />
            <ul className="text-sm space-y-1">
              {data.investigation.discoveryRequests.map((r) => (
                <li key={r.id} className="flex justify-between p-2 bg-white/5 rounded">
                  <span>{r.title}</span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {activeTab === 'trial-prep' && (
        <div className="space-y-4">
          {(['witnessList', 'exhibitList', 'crossExaminationTopics', 'impeachmentOpportunities', 'openingOutline', 'closingOutline', 'trialNotebook'] as const).map((section) => {
            const labels: Record<string, string> = {
              witnessList: 'Witness List',
              exhibitList: 'Exhibit List',
              crossExaminationTopics: 'Cross Examination Topics',
              impeachmentOpportunities: 'Impeachment Opportunities',
              openingOutline: 'Opening Outline',
              closingOutline: 'Closing Outline',
              trialNotebook: 'Trial Notebook',
            };
            const items = data.trialPreparation[section];
            return (
              <Card key={section}>
                <CardHeader title={labels[section]} subtitle={`${items.length} items — evidence-governed`} />
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item.id} className="p-2 bg-white/5 rounded text-sm">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-slate-300">{item.detail}</div>
                      {'citations' in item && <CitationList citations={item.citations} />}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Private Attorney Notes" />
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a private note..."
              className="w-full h-24 px-3 py-2 border rounded-lg text-sm mb-2"
            />
            <button type="button" onClick={() => void handleAddNote()} className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm">
              Save Note
            </button>
            <ul className="mt-4 space-y-2">
              {data.attorneyNotes.notes.map((n) => (
                <li key={n.id} className="p-3 bg-amber-500/10 border border-yellow-100 rounded text-sm">
                  {n.title && <div className="font-medium">{n.title}</div>}
                  <div>{n.content}</div>
                  <div className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Pinned Items" />
            <ul className="space-y-2">
              {data.attorneyNotes.pins.map((p) => (
                <li key={p.id} className="flex items-center gap-2 p-2 bg-white/5 rounded text-sm">
                  <Pin size={14} className="text-amber-600" />
                  <span className="font-medium">{p.pinType}</span>
                  <span className="text-slate-300">{p.label ?? p.entityId}</span>
                </li>
              ))}
              {data.attorneyNotes.pins.length === 0 && (
                <p className="text-sm text-slate-400">Pin evidence, authorities, or timeline items from other tabs.</p>
              )}
            </ul>
          </Card>
        </div>
      )}

      {activeTab === 'command' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard icon={<Briefcase size={20} />} value={`${data.commandCenter.caseHealth.score}%`} label="Case Health" />
          <StatCard icon={<FileSearch size={20} />} value={`${data.commandCenter.evidenceHealth.score}%`} label="Evidence Health" />
          <StatCard icon={<Scale size={20} />} value={`${data.commandCenter.legalCoverage.score}%`} label="Legal Coverage" />
          <StatCard icon={<AlertTriangle size={20} />} value={data.commandCenter.unknownCount} label="Unknowns" highlight={data.commandCenter.unknownCount > 0} />
          <StatCard icon={<AlertTriangle size={20} />} value={data.commandCenter.contradictionCount} label="Contradictions" />
          <StatCard icon={<Gavel size={20} />} value={`${data.commandCenter.trialReadiness.score}%`} label="Trial Readiness" />
          <StatCard icon={<Search size={20} />} value={data.commandCenter.investigationStatus.open} label="Open Tasks" />
          <StatCard icon={<Download size={20} />} value={data.commandCenter.motionOpportunities} label="Motion Opportunities" />
          <StatCard icon={<LayoutDashboard size={20} />} value={`${data.commandCenter.productionGateStatus.pass}/${data.commandCenter.productionGateStatus.total}`} label="Production Gates" />
          <StatCard icon={<BookOpen size={20} />} value={data.commandCenter.discoveryStatus.pending} label="Pending Discovery" />
        </div>
      )}

      {activeTab === 'exports' && (
        <Card>
          <CardHeader title="Export Packages" subtitle="All exports preserve citations and audit trails" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {EXPORT_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                disabled={exporting === opt.type}
                onClick={() => void handleExport(opt.type)}
                className="flex items-center justify-center gap-2 p-4 border border-white/10 rounded-lg hover:bg-white/5 text-sm font-medium disabled:opacity-50"
              >
                {exporting === opt.type ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {opt.label}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
