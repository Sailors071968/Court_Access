// ============================================================================
// CourtAccess — Attorney Workbench (Program 95)
// The flagship premium litigation command center. Executive overview, animated
// metrics, litigation intelligence panels, premium quick actions, a repository-
// backed activity feed, and attorney notes — with the full evidence-governed
// detailed analysis preserved below. Every value is repository-backed; UNKNOWN
// is shown wherever repository evidence is insufficient.
// Route: /cases/:caseId/attorney-workbench
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Briefcase, Scale, FileSearch, BookOpen, Search, Gavel, StickyNote,
  Download, Loader2, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Pin, Plus,
  CheckCircle2, FileText, Network, Clock, Users, Library, Landmark, ClipboardList,
  ShieldCheck, Activity, ArrowRight, Upload, ShieldAlert,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/common/Card';
import {
  fetchWorkbench, fetchWorkbenchExport, createWorkbenchNote, createWorkbenchTask,
  updateWorkbenchTask, pinWorkbenchItem, type WorkbenchBundle, type ExportPackageType,
} from '../../services/workbenchApi';

type TabId = 'offenses' | 'evidence' | 'authority' | 'investigation' | 'trial-prep' | 'exports';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'offenses', label: 'Offense Analysis', icon: <Scale size={16} /> },
  { id: 'evidence', label: 'Evidence', icon: <FileSearch size={16} /> },
  { id: 'authority', label: 'Legal Authority', icon: <BookOpen size={16} /> },
  { id: 'investigation', label: 'Investigation', icon: <Search size={16} /> },
  { id: 'trial-prep', label: 'Trial Prep', icon: <Gavel size={16} /> },
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

const QUICK_ACTIONS: Array<{ label: string; desc: string; icon: React.ReactNode; path: string; abs?: boolean }> = [
  { label: 'Case Intake', desc: 'Open or create a case', icon: <Upload size={18} />, path: '/cases', abs: true },
  { label: 'Evidence Workspace', desc: 'Exhibits, OCR, custody', icon: <FileSearch size={18} />, path: 'evidence' },
  { label: 'Witness Workspace', desc: 'Credibility & prep', icon: <Users size={18} />, path: 'witnesses' },
  { label: 'Timeline', desc: 'Event reconstruction', icon: <Clock size={18} />, path: 'timeline' },
  { label: 'Knowledge Graph', desc: 'Relationship intelligence', icon: <Network size={18} />, path: 'knowledge-graph' },
  { label: 'Attorney Report', desc: 'Full case intelligence', icon: <FileText size={18} />, path: 'report' },
  { label: 'Motion Builder', desc: 'Repository-backed drafting', icon: <Gavel size={18} />, path: 'motions' },
  { label: 'Trial Preparation', desc: 'Readiness & exhibits', icon: <ShieldCheck size={18} />, path: 'trial-prep' },
  { label: 'Voir Dire', desc: 'Jury selection', icon: <Users size={18} />, path: 'voir-dire' },
  { label: 'Sentencing Center', desc: 'Exposure & enhancements', icon: <ShieldAlert size={18} />, path: 'sentencing' },
  { label: 'CourtListener', desc: 'Case-law authority', icon: <Landmark size={18} />, path: 'research' },
  { label: 'Search', desc: 'Global repository search', icon: <Search size={18} />, path: '/search', abs: true },
];

// -- Animated counter --------------------------------------------------------
function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target)) { setValue(0); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function MetricCard({ value, label, icon, tone, suffix }: { value: number; label: string; icon: React.ReactNode; tone: string; suffix?: string }) {
  const shown = useCountUp(value);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-gold-light/30 hover:-translate-y-0.5 transition-all">
      <span className={`inline-flex w-10 h-10 rounded-xl items-center justify-center mb-3 ${tone}`}>{icon}</span>
      <div className="text-3xl font-bold text-white tracking-tight tabular-nums">{shown}{suffix}</div>
      <div className="text-xs font-medium text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function confidenceTone(score: number): { badge: 'emerald' | 'amber' | 'danger'; text: string } {
  if (score >= 67) return { badge: 'emerald', text: 'text-emerald-300' };
  if (score >= 34) return { badge: 'amber', text: 'text-amber-300' };
  return { badge: 'danger', text: 'text-red-300' };
}

function IntelPanel({ title, icon, status, confidence, outstanding, onOpen }: {
  title: string; icon: React.ReactNode; status: string; confidence: number | null; outstanding: string; onOpen: () => void;
}) {
  const tone = confidence == null ? { badge: 'slate' as const, text: 'text-slate-300' } : confidenceTone(confidence);
  return (
    <button type="button" onClick={onOpen} className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-gold-light/40 hover:bg-white/5 transition-all">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-white"><span className="text-gold-light">{icon}</span>{title}</span>
        <ArrowRight size={15} className="text-gold-light opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${tone.badge === 'emerald' ? 'bg-emerald-500/15 text-emerald-300' : tone.badge === 'amber' ? 'bg-amber-500/15 text-amber-300' : tone.badge === 'danger' ? 'bg-red-500/15 text-red-300' : 'bg-white/10 text-slate-300'}`}>{status}</span>
        {confidence != null && <span className="text-[11px] text-slate-400">confidence {confidence}%</span>}
      </div>
      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{outstanding}</p>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    satisfied: 'bg-emerald-500/15 text-emerald-300', established: 'bg-emerald-500/15 text-emerald-300',
    unsatisfied: 'bg-red-500/15 text-red-300', unknown: 'bg-white/10 text-slate-200',
    disputed: 'bg-amber-500/15 text-amber-300', open: 'bg-blue-500/15 text-blue-300',
    in_progress: 'bg-indigo-500/15 text-indigo-300', completed: 'bg-emerald-500/15 text-emerald-300',
  };
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-white/10 text-slate-200'}`}>{status.replace(/_/g, ' ')}</span>;
}

function ExpandableSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-lg">
      <button type="button" className="w-full flex items-center gap-2 px-4 py-3 text-left font-medium text-white hover:bg-white/5" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}{title}
      </button>
      {open && <div className="px-4 pb-4 border-t border-white/10">{children}</div>}
    </div>
  );
}

function CitationList({ citations }: { citations: Array<{ type: string; id: string; label?: string }> }) {
  if (!citations.length) return <span className="text-xs text-slate-400">No citations</span>;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {citations.map((c) => <span key={`${c.type}-${c.id}`} className="text-xs bg-white/10 text-slate-300 px-1.5 py-0.5 rounded">{c.type}:{c.label ?? c.id.slice(0, 8)}</span>)}
    </div>
  );
}

interface FeedItem { at: string | null; icon: React.ReactNode; text: string }

export function AttorneyWorkbenchPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState('');
  const [expandedCharge, setExpandedCharge] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('offenses');
  const detailRef = useRef<HTMLDivElement | null>(null);

  const go = (path: string, abs = false) => { if (caseId) navigate(abs ? path : `/cases/${caseId}/${path}`); };
  const openDetail = (tab: TabId) => { setActiveTab(tab); detailRef.current?.scrollIntoView({ behavior: 'smooth' }); };

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try { setData(await fetchWorkbench(caseId)); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load workbench'); }
    finally { setLoading(false); }
  }, [caseId]);
  useEffect(() => { void load(); }, [load]);

  const handleExport = async (type: ExportPackageType) => {
    if (!caseId) return;
    setExporting(type);
    try {
      const pkg = await fetchWorkbenchExport(caseId, type);
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `workbench-${type}-${caseId}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Export failed'); }
    finally { setExporting(null); }
  };
  const handleAddNote = async () => { if (!caseId || !noteText.trim()) return; await createWorkbenchNote(caseId, noteText.trim()); setNoteText(''); await load(); };
  const handleAddTask = async () => { if (!caseId || !taskTitle.trim()) return; await createWorkbenchTask(caseId, { title: taskTitle.trim() }); setTaskTitle(''); await load(); };

  if (loading && !data) {
    return <div className="flex flex-col items-center justify-center py-32 gap-3 text-slate-400"><Loader2 className="animate-spin text-gold-light" size={32} /><p>Assembling litigation command center…</p></div>;
  }
  if (error && !data) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center py-24">
        <AlertTriangle className="mx-auto text-amber-400 mb-3" size={32} />
        <p className="text-slate-300">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-4 px-4 py-2 bg-white/10 border border-white/10 text-white rounded-xl">Retry</button>
      </div>
    );
  }
  if (!data) return null;

  const cc = data.commandCenter;
  const co = data.caseOverview;
  const calcrimCount = data.legalAuthority.calcrim.length || data.offenseAnalysis.reduce((n, o) => n + o.applicableCalcrim.length, 0);
  const nextHearing = co.upcomingHearings.find((hh) => hh.date);

  const metrics = [
    { value: co.evidenceSummary.total, label: 'Evidence Items', icon: <FileSearch size={18} />, tone: 'ca-icon-gold text-gold-light' },
    { value: data.trialPreparation.witnessList.length, label: 'Witnesses', icon: <Users size={18} />, tone: 'ca-icon-blue text-blue-300' },
    { value: co.charges.length, label: 'Charges', icon: <Scale size={18} />, tone: 'ca-icon-violet text-violet-300' },
    { value: data.legalAuthority.authorities.length, label: 'Authorities', icon: <Landmark size={18} />, tone: 'ca-icon-emerald text-emerald-300' },
    { value: calcrimCount, label: 'CALCRIM', icon: <Library size={18} />, tone: 'ca-icon-gold text-gold-light' },
    { value: cc.discoveryStatus.total, label: 'Discovery Items', icon: <ClipboardList size={18} />, tone: 'ca-icon-blue text-blue-300' },
    { value: cc.motionOpportunities, label: 'Potential Motions', icon: <Gavel size={18} />, tone: 'ca-icon-violet text-violet-300' },
    { value: cc.timelineCoverage.eventCount, label: 'Timeline Events', icon: <Clock size={18} />, tone: 'ca-icon-emerald text-emerald-300' },
    { value: cc.contradictionCount, label: 'Contradictions', icon: <AlertTriangle size={18} />, tone: 'ca-icon-gold text-gold-light' },
    { value: cc.legalCoverage.score, label: 'Repository Coverage', icon: <BookOpen size={18} />, tone: 'ca-icon-blue text-blue-300', suffix: '%' },
    { value: cc.investigationStatus.open, label: 'Outstanding Tasks', icon: <Search size={18} />, tone: 'ca-icon-violet text-violet-300' },
    { value: cc.unknownCount, label: 'Manual Reviews', icon: <ShieldCheck size={18} />, tone: 'ca-icon-emerald text-emerald-300' },
  ];

  const panels = [
    { title: 'Evidence Intelligence', icon: <FileSearch size={16} />, status: cc.evidenceHealth.label || 'UNKNOWN', confidence: cc.evidenceHealth.score, outstanding: `${cc.evidenceHealth.pending} pending · ${cc.evidenceHealth.failed} failed`, tab: 'evidence' as TabId },
    { title: 'Witness Intelligence', icon: <Users size={16} />, status: data.trialPreparation.witnessList.length ? 'Indexed' : 'No witnesses available', confidence: null, outstanding: `${data.investigation.witnessGaps.length} witness gap(s)`, path: 'witnesses' },
    { title: 'Discovery Intelligence', icon: <ClipboardList size={16} />, status: cc.discoveryStatus.total ? `${cc.discoveryStatus.pending} pending` : 'No discovery imported', confidence: null, outstanding: `${cc.discoveryStatus.acknowledged}/${cc.discoveryStatus.total} acknowledged`, path: 'discovery' },
    { title: 'Timeline Intelligence', icon: <Clock size={16} />, status: cc.timelineCoverage.label || 'UNKNOWN', confidence: cc.timelineCoverage.score, outstanding: `${cc.timelineCoverage.eventCount} events · ${cc.timelineCoverage.conflictCount} conflicts`, path: 'timeline' },
    { title: 'Contradiction Intelligence', icon: <AlertTriangle size={16} />, status: cc.contradictionCount ? `${cc.contradictionCount} flagged` : 'None flagged', confidence: null, outstanding: 'Repository-detected conflicts in the record', path: 'contradictions' },
    { title: 'Motion Intelligence', icon: <Gavel size={16} />, status: cc.motionOpportunities ? `${cc.motionOpportunities} topics` : 'No topics', confidence: null, outstanding: 'Repository-backed motion drafting', path: 'motions' },
    { title: 'CALCRIM Intelligence', icon: <Library size={16} />, status: calcrimCount ? `${calcrimCount} instructions` : 'UNKNOWN', confidence: null, outstanding: 'Jury instruction discovery & element mapping', path: 'calcrim' },
    { title: 'Sentencing Intelligence', icon: <ShieldAlert size={16} />, status: `${co.charges.length} charge(s)`, confidence: null, outstanding: 'Classification, enhancements, exposure', path: 'sentencing' },
    { title: 'CourtListener Intelligence', icon: <Landmark size={16} />, status: 'Federated search', confidence: null, outstanding: 'Federal & state case-law authority', path: 'research' },
    { title: 'Authority Intelligence', icon: <BookOpen size={16} />, status: data.legalAuthority.authorities.length ? `${data.legalAuthority.authorities.length} authorities` : 'UNKNOWN', confidence: cc.legalCoverage.score, outstanding: 'California statutes, CALCRIM, case law', tab: 'authority' as TabId },
  ];

  // Repository-backed activity feed
  const feed: FeedItem[] = [
    ...co.caseTimeline.slice(-5).reverse().map((e) => ({ at: e.timestamp, icon: <Clock size={14} />, text: `Timeline: ${e.description}${e.actor ? ` — ${e.actor}` : ''}` })),
    ...data.attorneyNotes.notes.slice(0, 4).map((n) => ({ at: n.createdAt, icon: <StickyNote size={14} />, text: `Note added: ${(n.title || n.content).slice(0, 60)}` })),
    { at: data.generatedAt, icon: <RefreshCw size={14} />, text: `Workbench intelligence generated (v${data.workbenchVersion})` },
  ].filter((f) => f.text).sort((a, b) => (b.at ? new Date(b.at).getTime() : 0) - (a.at ? new Date(a.at).getTime() : 0)).slice(0, 8);

  const filteredEvidence = data.evidenceWorkbench.items.filter(
    (e) => !evidenceFilter || e.fileName.toLowerCase().includes(evidenceFilter.toLowerCase()) || e.evidenceType.includes(evidenceFilter),
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* ===== Executive command-center header ===== */}
      <header className="ca-panel p-6 md:p-8 relative overflow-hidden">
        <div className="absolute inset-0 ca-gradient-gold opacity-[0.06] pointer-events-none" />
        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="ca-overline">Litigation Command Center · v{data.workbenchVersion}</div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1 flex items-center gap-3">
                <Briefcase size={26} className="text-gold-light" /> {co.case.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs px-2.5 py-1 rounded-lg bg-gold-light/15 text-gold-light font-semibold">{co.case.caseNumber || 'UNKNOWN'}</span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-navy-700/70 border border-white/10 text-slate-200">{co.currentStatus}</span>
                <span className="text-xs text-slate-400">Client: {co.client?.name ?? 'UNKNOWN'}</span>
              </div>
            </div>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 px-4 h-9 text-sm font-semibold border border-white/10 rounded-xl text-slate-200 hover:bg-white/5 flex-shrink-0">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
            {[
              ['Custody Status', 'UNKNOWN'],
              ['Trial Date', 'UNKNOWN'],
              ['Next Hearing', nextHearing?.date ? new Date(nextHearing.date).toLocaleDateString() : 'UNKNOWN'],
              ['Knowledge Graph', cc.legalCoverage.score >= 0 ? 'generated' : 'UNKNOWN'],
              ['Repository Confidence', cc.caseHealth.label || 'UNKNOWN'],
              ['Litigation Readiness', `${cc.trialReadiness.score}%`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-navy-800/50 border border-white/5 px-3 py-2">
                <div className="ca-overline text-[10px]">{l}</div>
                <div className={`text-sm mt-0.5 ${v === 'UNKNOWN' ? 'text-amber-400 font-medium' : 'text-slate-100'}`}>{v}</div>
              </div>
            ))}
          </div>
          {cc.unknownCount > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2">
              <AlertTriangle size={16} /> Attorney review required — {cc.unknownCount} outstanding unknown(s) / manual review item(s).
            </div>
          )}
        </div>
      </header>

      {/* ===== Executive metrics ===== */}
      <section>
        <h2 className="ca-overline mb-3">Executive Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {metrics.map((m) => <MetricCard key={m.label} value={m.value} label={m.label} icon={m.icon} tone={m.tone} suffix={m.suffix} />)}
        </div>
      </section>

      {/* ===== Quick actions ===== */}
      <section>
        <h2 className="ca-overline mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.label} type="button" onClick={() => go(a.path, a.abs)}
              className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left hover:border-gold-light/40 hover:bg-white/5 hover:-translate-y-0.5 transition-all">
              <span className="w-10 h-10 rounded-xl ca-gradient-gold flex items-center justify-center text-navy flex-shrink-0 shadow-gold">{a.icon}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-sm font-semibold text-white">{a.label}<ArrowRight size={13} className="text-gold-light opacity-0 group-hover:opacity-100 transition-opacity" /></span>
                <span className="block text-xs text-slate-400 mt-0.5">{a.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ===== Litigation intelligence panels ===== */}
      <section>
        <h2 className="ca-overline mb-3">Litigation Intelligence</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {panels.map((p) => (
            <IntelPanel key={p.title} title={p.title} icon={p.icon} status={p.status} confidence={p.confidence}
              outstanding={p.outstanding} onOpen={() => (p.tab ? openDetail(p.tab) : go(p.path!))} />
          ))}
        </div>
      </section>

      {/* ===== Feed + Notes ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ca-panel p-5">
          <div className="flex items-center gap-2 mb-3"><Activity size={16} className="text-gold-light" /><h2 className="text-sm font-bold text-white uppercase tracking-wide">Live Intelligence Feed</h2></div>
          {feed.length === 0 ? (
            <p className="text-sm text-slate-400">No activity available.</p>
          ) : (
            <ul className="space-y-2">
              {feed.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm rounded-lg bg-navy-800/40 border border-white/5 px-3 py-2">
                  <span className="text-gold-light mt-0.5 flex-shrink-0">{f.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-slate-200">{f.text}</span>
                    <span className="text-[11px] text-slate-500">{f.at ? new Date(f.at).toLocaleString() : 'UNKNOWN time'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ca-panel p-5">
          <div className="flex items-center gap-2 mb-3"><StickyNote size={16} className="text-gold-light" /><h2 className="text-sm font-bold text-white uppercase tracking-wide">Attorney Notes</h2></div>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a strategy, investigation, or trial note…"
            className="w-full h-20 rounded-xl bg-navy-900/50 border border-white/10 px-3 py-2 text-sm text-slate-100 focus:border-gold-light/50 focus:outline-none resize-none" />
          <div className="flex justify-end mt-2">
            <button type="button" onClick={() => void handleAddNote()} className="text-sm font-semibold px-3 py-1.5 rounded-lg ca-gradient-gold text-navy">Save Note</button>
          </div>
          {data.attorneyNotes.pins.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.attorneyNotes.pins.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-gold-light/10 text-gold-light"><Pin size={11} />{p.label ?? p.entityId}</span>
              ))}
            </div>
          )}
          <ul className="mt-3 space-y-2 max-h-56 overflow-y-auto">
            {data.attorneyNotes.notes.length === 0 ? (
              <li className="text-sm text-slate-400">No notes yet — add strategy, investigation, or trial notes above.</li>
            ) : data.attorneyNotes.notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-navy-800/40 border border-white/5 px-3 py-2 text-sm">
                {n.title && <div className="font-medium text-slate-100">{n.title}</div>}
                <div className="text-slate-300">{n.content}</div>
                <div className="text-[11px] text-slate-500 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== Detailed litigation analysis (preserved) ===== */}
      <section ref={detailRef} className="scroll-mt-6">
        <h2 className="ca-overline mb-3">Detailed Litigation Analysis</h2>
        <nav className="flex flex-wrap gap-1 border-b border-white/10 pb-1 mb-4">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === tab.id ? 'border-gold text-white' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'offenses' && (
          <div className="space-y-4">
            {data.elementMatrices.length === 0 && <Card><p className="text-sm text-slate-400">No charges recorded — offense analysis UNKNOWN.</p></Card>}
            {data.elementMatrices.map((matrix) => {
              const legal = data.offenseAnalysis.find((o) => o.chargeId === matrix.chargeId);
              const isOpen = expandedCharge === matrix.chargeId;
              return (
                <Card key={matrix.chargeId}>
                  <button type="button" className="w-full flex items-center justify-between text-left" onClick={() => setExpandedCharge(isOpen ? null : matrix.chargeId)}>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{matrix.code} §{matrix.section}</h3>
                      <p className="text-sm text-slate-400">{matrix.rows.length} elements · {legal?.applicableCalcrim.length ?? 0} CALCRIM</p>
                    </div>
                    {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>
                  {isOpen && (
                    <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                      {legal && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-300">
                          <div><strong className="text-slate-200">Defenses:</strong> {legal.defenses.length ? legal.defenses.join('; ') : 'None identified'}</div>
                          <div><strong className="text-slate-200">Exceptions:</strong> {legal.exceptions.length ? legal.exceptions.join('; ') : 'None identified'}</div>
                          <div><strong className="text-slate-200">Enhancements:</strong> {legal.enhancements.length ? legal.enhancements.join('; ') : 'None identified'}</div>
                        </div>
                      )}
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-slate-400 border-b border-white/10"><th className="pb-2">Element</th><th className="pb-2">Status</th><th className="pb-2">Confidence</th><th className="pb-2">Evidence</th></tr></thead>
                        <tbody>
                          {matrix.rows.map((row) => (
                            <tr key={row.elementId} className="border-b border-white/5">
                              <td className="py-2 text-slate-200">{row.elementLabel}</td>
                              <td className="py-2"><StatusBadge status={row.status} /></td>
                              <td className="py-2 text-slate-300">{row.confidence}</td>
                              <td className="py-2">
                                {row.supportingEvidence.length > 0 && <span className="text-emerald-300">{row.supportingEvidence.length} supporting</span>}
                                {row.contradictoryEvidence.length > 0 && <span className="text-red-300 ml-2">{row.contradictoryEvidence.length} contradictory</span>}
                                {row.missingEvidenceReason && <p className="text-xs text-amber-400 mt-0.5">{row.missingEvidenceReason}</p>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {legal?.unknownLegalQuestions.length ? (
                        <div className="text-sm text-amber-300 bg-amber-500/10 p-3 rounded"><strong>Unknown legal questions:</strong> {legal.unknownLegalQuestions.join('; ')}</div>
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
            <input type="text" placeholder="Filter evidence…" value={evidenceFilter} onChange={(e) => setEvidenceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-navy-900/50 text-slate-100 focus:border-gold-light/50 focus:outline-none" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader title="Evidence Items" subtitle={`${filteredEvidence.length} items`} />
                {filteredEvidence.length === 0 ? <p className="text-sm text-slate-400">No evidence available.</p> : (
                  <ul className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredEvidence.map((e) => (
                      <li key={e.evidenceId} className="flex items-center justify-between p-2 bg-white/5 rounded text-sm">
                        <div><span className="font-medium text-slate-100">{e.fileName}</span><span className="ml-2 text-slate-400">{e.evidenceType}</span></div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={e.processingStatus} />
                          <button type="button" title="Pin evidence" onClick={() => void pinWorkbenchItem(caseId!, 'evidence', e.evidenceId, e.fileName).then(() => load())} className="text-slate-400 hover:text-gold-light"><Pin size={14} /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <div className="space-y-4">
                <Card><CardHeader title="Contradictions" /><p className="text-2xl font-bold text-white">{data.evidenceWorkbench.contradictions.length}</p></Card>
                <Card><CardHeader title="Duplicates" /><p className="text-2xl font-bold text-white">{data.evidenceWorkbench.duplicates.length}</p></Card>
                <Card><CardHeader title="Evidence Graph" /><p className="text-sm text-slate-300">{data.evidenceWorkbench.graph.nodes.length} nodes, {data.evidenceWorkbench.graph.edges.length} edges</p></Card>
              </div>
            </div>
            {data.evidenceWorkbench.missing.length > 0 && (
              <Card><CardHeader title="Missing Evidence" /><ul className="list-disc list-inside text-sm text-slate-200">{data.evidenceWorkbench.missing.map((m, i) => <li key={i}>{m}</li>)}</ul></Card>
            )}
          </div>
        )}

        {activeTab === 'authority' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader title="CALCRIM Instructions" />
                {data.legalAuthority.calcrim.length === 0 ? <p className="text-sm text-slate-400">UNKNOWN — none linked.</p> : data.legalAuthority.calcrim.map((c) => (
                  <ExpandableSection key={c.id} title={c.finding}><p className="text-sm text-slate-300">Repository-backed authority with audit trail.</p></ExpandableSection>
                ))}
              </Card>
              <Card>
                <CardHeader title="Authorities" />
                {data.legalAuthority.authorities.length === 0 ? <p className="text-sm text-slate-400">UNKNOWN — no authorities.</p> : (
                  <ul className="space-y-1 text-sm">{data.legalAuthority.authorities.map((a) => <li key={a.id} className="p-2 bg-white/5 rounded text-slate-200">{a.finding}</li>)}</ul>
                )}
              </Card>
            </div>
            <Card>
              <CardHeader title="Defenses, Exceptions, Enhancements" />
              <div className="grid grid-cols-3 gap-4 text-sm text-slate-200">
                <div><strong>Defenses</strong><ul className="mt-1 list-disc list-inside">{data.legalAuthority.defenses.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
                <div><strong>Exceptions</strong><ul className="mt-1 list-disc list-inside">{data.legalAuthority.exceptions.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
                <div><strong>Enhancements</strong><ul className="mt-1 list-disc list-inside">{data.legalAuthority.enhancements.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'investigation' && (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Recommended Investigation" />
              {data.investigation.recommendedInvestigation.length === 0 ? <p className="text-sm text-slate-400">None flagged.</p> : (
                <ul className="list-disc list-inside text-sm space-y-1 text-slate-200">{data.investigation.recommendedInvestigation.map((r, i) => <li key={i}>{r}</li>)}</ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Investigation Tasks" action={
                <div className="flex gap-2">
                  <input type="text" placeholder="New task…" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="px-2 py-1 border border-white/10 rounded text-sm bg-navy-900/50 text-slate-100" />
                  <button type="button" onClick={() => void handleAddTask()} className="px-2 py-1 bg-white/10 border border-white/10 text-white rounded text-sm flex items-center gap-1"><Plus size={14} /> Add</button>
                </div>
              } />
              <ul className="space-y-2">
                {data.investigation.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between p-2 bg-white/5 rounded text-sm">
                    <div><span className="font-medium text-slate-100">{t.title}</span>{t.assignedTo && <span className="ml-2 text-slate-400">→ {t.assignedTo}</span>}</div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      {t.status !== 'completed' && <button type="button" onClick={() => void updateWorkbenchTask(caseId!, t.id, { status: 'completed' }).then(() => load())} className="text-emerald-400" title="Mark complete"><CheckCircle2 size={16} /></button>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {activeTab === 'trial-prep' && (
          <div className="space-y-4">
            {(['witnessList', 'exhibitList', 'crossExaminationTopics', 'impeachmentOpportunities', 'openingOutline', 'closingOutline', 'trialNotebook'] as const).map((section) => {
              const labels: Record<string, string> = { witnessList: 'Witness List', exhibitList: 'Exhibit List', crossExaminationTopics: 'Cross Examination Topics', impeachmentOpportunities: 'Impeachment Opportunities', openingOutline: 'Opening Outline', closingOutline: 'Closing Outline', trialNotebook: 'Trial Notebook' };
              const items = data.trialPreparation[section];
              return (
                <Card key={section}>
                  <CardHeader title={labels[section]} subtitle={`${items.length} items — evidence-governed`} />
                  {items.length === 0 ? <p className="text-sm text-slate-400">UNKNOWN — none available.</p> : (
                    <ul className="space-y-2">
                      {items.map((item) => (
                        <li key={item.id} className="p-2 bg-white/5 rounded text-sm">
                          <div className="font-medium text-slate-100">{item.title}</div>
                          <div className="text-slate-300">{item.detail}</div>
                          {'citations' in item && <CitationList citations={item.citations} />}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === 'exports' && (
          <Card>
            <CardHeader title="Export Packages" subtitle="All exports preserve citations and audit trails" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {EXPORT_OPTIONS.map((opt) => (
                <button key={opt.type} type="button" disabled={exporting === opt.type} onClick={() => void handleExport(opt.type)}
                  className="flex items-center justify-center gap-2 p-4 border border-white/10 rounded-lg hover:bg-white/5 text-sm font-medium text-slate-200 disabled:opacity-50">
                  {exporting === opt.type ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}{opt.label}
                </button>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
