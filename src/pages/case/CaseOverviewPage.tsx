// ============================================================================
// CourtAccess — Attorney Case Overview (Program 81, flagship)
// The primary premium workspace after opening a case. Executive litigation
// dashboard: case-header hero, intelligence cards, evidence summary, key
// findings, timeline overview, authorities, collaborators, quick actions.
// Every metric is repository-backed; UNKNOWN where coverage is incomplete —
// never fabricated.
// ============================================================================

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import {
  Scale, ShieldCheck, BarChart3, AlertTriangle, CheckCircle2, Users, HelpCircle, Brain,
  Gavel, Calendar, Landmark, Clock, Network, Upload, FileText, Search, BookOpen, Plus,
  Briefcase, ClipboardList, ArrowRight, Building2,
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { Avatar } from '../../components/ui/avatar';
import { Icon } from '../../components/icons/registry';
import { DoctrineCompliancePanel } from '../../components/case/DoctrineCompliancePanel';
import { ROLE_PERMISSIONS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { fetchCase, fetchCaseEvidence, type ApiCase, type ApiEvidence } from '../../services/caseApi';
import { listCollaborators } from '../../services/organizationApi';

type Tone = 'emerald' | 'blue' | 'violet' | 'gold' | 'slate';
const TONE_ICON: Record<Tone, string> = {
  emerald: 'ca-icon-emerald text-emerald-300', blue: 'ca-icon-blue text-blue-300',
  violet: 'ca-icon-violet text-violet-300', gold: 'ca-icon-gold text-gold-light',
  slate: 'bg-white/5 text-slate-300',
};
const TONE_TAG: Record<Tone, string> = {
  emerald: 'text-emerald-300', blue: 'text-blue-300', violet: 'text-violet-300', gold: 'text-gold-light', slate: 'text-slate-400',
};

function IntelCard({ tone, icon, label, value, tag, desc, onClick }: {
  tone: Tone; icon: React.ReactNode; label: string; value: string; tag: string; desc: string; onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-gold/30 hover:bg-white/[0.05] hover:-translate-y-0.5 hover:shadow-elevated transition-all duration-200">
      <div className="flex items-center gap-3.5 mb-3">
        <span className={`inline-flex w-14 h-14 rounded-2xl items-center justify-center flex-shrink-0 ${TONE_ICON[tone]}`}>{icon}</span>
        <div className="min-w-0">
          <div className="text-3xl font-bold text-white leading-none tracking-tight">{value}</div>
          <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] mt-1.5 ${TONE_TAG[tone]}`}>{tag}</div>
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-200">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
    </button>
  );
}

function mediaClass(mime: string | null, t: string): 'document' | 'image' | 'audio' | 'video' | 'other' {
  const m = (mime ?? '').toLowerCase(); const tt = (t ?? '').toLowerCase();
  if (m.startsWith('image/') || tt === 'photo') return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/') || ['bodycam', 'dashcam', 'witness_video'].includes(tt)) return 'video';
  if (m.includes('pdf') || m.includes('word') || m.includes('text') || m.includes('document') || ['transcript', 'police_report', 'forensic_report', 'autopsy_report', 'other_document'].includes(tt)) return 'document';
  return 'other';
}

interface Collab { memberId: string; role: string; user: { name: string; avatarUrl?: string | null }; status: string }

export function CaseOverviewPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [c, setC] = useState<ApiCase | null>(null);
  const [evidence, setEvidence] = useState<ApiEvidence[]>([]);
  const [collaborators, setCollaborators] = useState<Collab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const [caseData, evidenceData, collabData] = await Promise.all([
          fetchCase(caseId),
          fetchCaseEvidence(caseId).catch(() => []),
          listCollaborators().then((r) => r.collaborators ?? []).catch(() => []),
        ]);
        if (!cancelled) { setC(caseData); setEvidence(evidenceData ?? []); setCollaborators(collabData); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load case');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const ev = useMemo(() => {
    const m = { document: 0, image: 0, audio: 0, video: 0, other: 0 };
    let ocrDone = 0, ocrPending = 0;
    for (const e of evidence) {
      m[mediaClass(e.mimeType, e.evidenceType)] += 1;
      if (e.processingStatus === 'analyzed' || e.analysisStatus === 'completed') ocrDone += 1;
      else if (e.processingStatus !== 'failed') ocrPending += 1;
    }
    const confidence = evidence.length ? Math.round((ocrDone / evidence.length) * 100) : 0;
    return { ...m, total: evidence.length, ocrDone, ocrPending, confidence };
  }, [evidence]);

  if (!user) return null;
  const permissions = ROLE_PERMISSIONS[user.role];
  const showIntel = user.role !== 'defendant';
  const go = (path: string) => navigate(`/cases/${caseId}/${path}`.replace(/\/$/, ''));

  if (loading) return <Spinner label="Loading case…" />;
  if (error || !c) {
    return <Card><EmptyState icon={<Icon name="attorney" size={24} />} title="Unable to load case" description={error ?? 'Case not found.'} /></Card>;
  }

  const QUICK: Array<{ label: string; icon: React.ReactNode; path: string }> = [
    { label: 'Upload Evidence', icon: <Upload size={16} />, path: 'evidence' },
    { label: 'Import Discovery', icon: <ClipboardList size={16} />, path: 'discovery' },
    { label: 'Search Authorities', icon: <BookOpen size={16} />, path: 'research' },
    { label: 'Build Motion', icon: <Gavel size={16} />, path: 'motions' },
    { label: 'Attorney Report', icon: <FileText size={16} />, path: 'report' },
    { label: 'Open Timeline', icon: <Clock size={16} />, path: 'timeline' },
    { label: 'Knowledge Graph', icon: <Network size={16} />, path: 'knowledge-graph' },
    { label: 'Attorney Workbench', icon: <Briefcase size={16} />, path: 'attorney-workbench' },
    { label: 'Witnesses', icon: <Users size={16} />, path: 'witnesses' },
    { label: 'Repository Search', icon: <Search size={16} />, path: 'research' },
  ];

  return (
    <div className="space-y-6">
      {/* Phase 1 — premium case header hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 ca-gradient-hero ca-grid-overlay">
        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex items-start gap-5 min-w-0">
              <div className="w-16 h-16 rounded-2xl ca-gradient-gold flex items-center justify-center shadow-gold flex-shrink-0">
                <Scale size={30} className="text-navy" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-light">Case Command Center</p>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mt-1 truncate">{c.title}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge variant="gold">{c.caseNumber}</Badge>
                  <Badge variant="navy" className="capitalize">{c.status}</Badge>
                  {c.phase && <Badge variant="default" className="capitalize">{c.phase}</Badge>}
                  <Badge variant="default" className="capitalize">{c.caseType}</Badge>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2.5 mt-5 text-sm">
                  <Meta icon={<Landmark size={12} />} label="Court" value={c.court} />
                  <Meta icon={<Gavel size={12} />} label="Judge" value={c.judge} />
                  <Meta icon={<Building2 size={12} />} label="County" value={c.county ?? null} />
                  <Meta icon={<Calendar size={12} />} label="Next hearing" value={c.nextHearing ? new Date(c.nextHearing).toLocaleDateString() : null} fallback="None set" />
                  <Meta icon={<FileText size={12} />} label="Filing date" value={c.filingDate ? new Date(c.filingDate).toLocaleDateString() : null} />
                  <Meta icon={<Clock size={12} />} label="Last updated" value={c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : null} />
                  <Meta icon={<Briefcase size={12} />} label="Defense" value={c.defenseAttorney ?? null} />
                  <Meta icon={<Scale size={12} />} label="Prosecutor" value={c.prosecutor ?? null} />
                </dl>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <Button variant="secondary" onClick={() => go('evidence')}><Upload size={16} /> Upload</Button>
              <Button variant="primary" onClick={() => go('attorney-workbench')}>Workbench <ArrowRight size={16} /></Button>
            </div>
          </div>
          {/* Phase 8 — premium quick actions */}
          <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-white/10">
            {QUICK.map((q) => (
              <button key={q.label} onClick={() => go(q.path)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-slate-200 hover:border-gold/30 hover:bg-white/5 hover:text-white transition-colors">
                <span className="text-gold-light">{q.icon}</span> {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Phase 2 — executive intelligence cards */}
      {showIntel && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <IntelCard tone="emerald" icon={<Scale size={26} />} label="Case Strength" value="UNKNOWN" tag="Awaiting analysis" desc="Overall defense posture" onClick={() => go('charges')} />
          <IntelCard tone="blue" icon={<ShieldCheck size={26} />} label="Evidence Confidence" value={ev.total > 0 ? `${ev.confidence}%` : 'UNKNOWN'} tag={ev.total > 0 ? `${ev.ocrDone}/${ev.total} analyzed` : 'Awaiting evidence'} desc="Reliability of extracted evidence" onClick={() => go('evidence')} />
          <IntelCard tone="violet" icon={<CheckCircle2 size={26} />} label="Overall Completeness" value="UNKNOWN" tag="Awaiting analysis" desc="Critical areas addressed" onClick={() => go('attorney-workbench')} />
          <IntelCard tone="gold" icon={<Users size={26} />} label="Human Review" value={ev.ocrPending > 0 ? String(ev.ocrPending) : 'UNKNOWN'} tag={ev.ocrPending > 0 ? 'Requires review' : 'Awaiting analysis'} desc="Items flagged for attorney review" onClick={() => go('evidence')} />
          <IntelCard tone="blue" icon={<BarChart3 size={26} />} label="Repository Integrity" value="UNKNOWN" tag="Awaiting analysis" desc="Chain of custody & completeness" onClick={() => go('evidence')} />
          <IntelCard tone="gold" icon={<AlertTriangle size={26} />} label="Conflict Check" value="UNKNOWN" tag="Awaiting analysis" desc="Contradictions across the record" onClick={() => go('contradictions')} />
          <IntelCard tone="violet" icon={<HelpCircle size={26} />} label="Uncertainties" value="UNKNOWN" tag="Awaiting analysis" desc="Unresolved questions" onClick={() => go('narrative-analysis')} />
          <IntelCard tone="emerald" icon={<Brain size={26} />} label="AI Analysis" value="UNKNOWN" tag="Evidence-governed" desc="Derived only from processed evidence" onClick={() => go('attorney-workbench')} />
        </div>
      )}

      {/* Main responsive layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Phase 3 — Evidence Summary */}
          <Panel title="Evidence Summary" icon={<Icon name="evidence" size={18} />} action={<PanelLink onClick={() => go('evidence')} />}>
            {ev.total === 0 ? (
              <EmptyState icon={<Icon name="upload" size={20} />} title="No evidence yet" description="Upload discovery to begin OCR and extraction." action={<Button variant="primary" size="sm" onClick={() => go('evidence')}>Upload Evidence</Button>} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([['Evidence Items', ev.total], ['Documents', ev.document], ['Photos', ev.image], ['Videos', ev.video], ['Audio', ev.audio], ['Completed OCR', ev.ocrDone], ['Pending OCR', ev.ocrPending], ['Other', ev.other]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-white/[0.03] border border-white/10 p-3"><div className="text-xl font-bold text-white">{v}</div><div className="text-[11px] text-slate-400 mt-0.5">{l}</div></div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-3">Witness statements, physical evidence, and authority counts populate from their workspaces — UNKNOWN until logged.</p>
          </Panel>

          {/* Phase 4 — Key Findings */}
          <Panel title="Key Findings" icon={<Icon name="aiAnalysis" size={18} />}>
            <div className="grid sm:grid-cols-2 gap-3">
              {['Evidence Strength', 'Missing Elements', 'Contradictions', 'Foundation Issues', 'Discovery Gaps', 'Brady Candidates', 'Giglio Candidates', 'Jencks Candidates'].map((f) => (
                <div key={f} className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2.5">
                  <span className="text-sm text-slate-300">{f}</span>
                  <Badge variant="slate">UNKNOWN</Badge>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">Findings are evidence-governed — each populates with supporting authority once the case is processed. No values are estimated.</p>
          </Panel>

          {/* Phase 5 — Timeline Overview */}
          <Panel title="Timeline Overview" icon={<Icon name="timeline" size={18} />} action={<PanelLink label="Open Timeline" onClick={() => go('timeline')} />}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {['Incident', 'Investigation', 'Court', 'Discovery', 'Evidence', 'Review'].map((cat) => (
                <button key={cat} onClick={() => go('timeline')} className="rounded-xl bg-white/[0.03] border border-white/10 p-3 text-left hover:border-gold/30">
                  <div className="text-lg font-bold text-white">UNKNOWN</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{cat} events</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">Events sync with the Timeline, Knowledge Graph, and Evidence workspaces. Counts populate as events are extracted or added.</p>
          </Panel>
        </div>

        {/* Context column */}
        <div className="space-y-6">
          {/* Phase 7 — Collaborators */}
          <Panel title="Collaborators" icon={<Icon name="permissions" size={18} />} action={<button onClick={() => navigate('/collaborators')} className="inline-flex items-center gap-1 text-xs font-semibold text-gold-light hover:text-gold-bright"><Plus size={13} /> Add</button>}>
            {collaborators.length === 0 ? (
              <EmptyState icon={<Users size={20} />} title="No collaborators" description="Invite an unlimited number of collaborators to this firm." action={<Button variant="secondary" size="sm" onClick={() => navigate('/collaborators')}>Manage Collaborators</Button>} />
            ) : (
              <div className="space-y-2">
                {collaborators.slice(0, 6).map((m) => (
                  <div key={m.memberId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5">
                    <Avatar name={m.user.name} src={m.user.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{m.user.name}</p>
                      <p className="text-xs text-slate-400 capitalize">{m.role}</p>
                    </div>
                    <Badge variant={m.status === 'active' ? 'emerald' : 'amber'} className="capitalize">{m.status}</Badge>
                  </div>
                ))}
                {collaborators.length > 6 && <button onClick={() => navigate('/collaborators')} className="text-xs text-gold-light hover:text-gold-bright">+{collaborators.length - 6} more</button>}
              </div>
            )}
          </Panel>

          {/* Phase 6 — Authorities */}
          <Panel title="Authorities" icon={<Icon name="authorities" size={18} />} action={<PanelLink onClick={() => go('research')} />}>
            <div className="grid grid-cols-2 gap-2">
              {['CA Statutes', 'Federal Statutes', 'CA Cases', 'Federal Cases', 'Secondary', 'Court Rules', 'CALCRIM', 'Repository'].map((a) => (
                <div key={a} className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-2.5 py-2">
                  <span className="text-xs text-slate-300">{a}</span><span className="text-xs font-semibold text-slate-400">UNKNOWN</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Upcoming Hearings" icon={<Icon name="calendar" size={18} />}>
            {c.nextHearing ? (
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
                <p className="text-sm font-medium text-white">{c.nextHearingNote ?? 'Hearing'}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(c.nextHearing).toLocaleString()}</p>
              </div>
            ) : (
              <EmptyState icon={<Icon name="calendar" size={20} />} title="No scheduled hearings" description="Hearing dates appear here when set on the case." />
            )}
          </Panel>

          <Panel title="Case Details" icon={<Icon name="attorney" size={18} />}>
            <dl className="space-y-2 text-sm">
              <Detail label="Status" value={c.status} />
              <Detail label="Jurisdiction" value={c.jurisdiction} />
              <Detail label="Department" value={c.department ?? '—'} />
              <Detail label="Type" value={c.caseType} />
            </dl>
          </Panel>
        </div>
      </div>

      {permissions.canViewEvidence && <DoctrineCompliancePanel />}
    </div>
  );
}

function Meta({ icon, label, value, fallback = 'UNKNOWN' }: { icon: React.ReactNode; label: string; value: string | null; fallback?: string }) {
  return (
    <div><dt className="text-xs text-slate-400 flex items-center gap-1">{icon} {label}</dt><dd className="text-slate-200 mt-0.5 truncate">{value || fallback}</dd></div>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2"><span className="text-gold-light">{icon}</span> {title}</h3>
        {action}
      </div>
      {children}
    </Card>
  );
}

function PanelLink({ label = 'Open', onClick }: { label?: string; onClick: () => void }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold text-gold-light hover:text-gold-bright">{label} <ArrowRight size={13} /></button>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
      <dt className="text-slate-400">{label}</dt><dd className="text-slate-200 capitalize">{value}</dd>
    </div>
  );
}
