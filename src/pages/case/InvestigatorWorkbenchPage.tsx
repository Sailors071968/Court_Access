// ============================================================================
// CourtAccess — Investigator Workspace (Program 21)
// Investigation-first workflows on the unified design system.
// Route: /cases/:caseId/investigator-workbench
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, Camera, Video, Mic, MapPin, Plus } from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs } from '../../components/ui/tabs';
import { Input, Textarea } from '../../components/ui/input';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/icons/registry';
import { StatCard } from '../../components/ui/card';
import { DataTable, type Column } from '../../components/data/data-table';
import { TimelineEngine, fromGenericEvents } from '../../components/timeline';
import { StatusBadge, UnknownIndicator } from '../../components/indicators/indicators';
import { SPACING } from '../../constants/designTokens';
import {
  fetchInvestigatorWorkbench,
  createWitness,
  createLead,
  createFieldNote,
  type InvestigatorWorkbench,
} from '../../services/investigatorApi';

type TabId = 'dashboard' | 'tasks' | 'witnesses' | 'evidence' | 'timeline' | 'notes' | 'gaps';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: <Icon name="investigator" size={15} /> },
  { id: 'tasks', label: 'Tasks & Leads', icon: <Icon name="tasks" size={15} /> },
  { id: 'witnesses', label: 'Witnesses', icon: <Icon name="witness" size={15} /> },
  { id: 'evidence', label: 'Evidence', icon: <Icon name="evidence" size={15} /> },
  { id: 'timeline', label: 'Timeline', icon: <Icon name="timeline" size={15} /> },
  { id: 'notes', label: 'Field Notes', icon: <Icon name="documents" size={15} /> },
  { id: 'gaps', label: 'Gaps & Unknowns', icon: <Icon name="unknown" size={15} /> },
];

export function InvestigatorWorkbenchPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<InvestigatorWorkbench | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('dashboard');
  const [witnessName, setWitnessName] = useState('');
  const [leadTitle, setLeadTitle] = useState('');
  const [noteText, setNoteText] = useState('');

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      setData(await fetchInvestigatorWorkbench(caseId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <Spinner label="Loading investigation workspace…" />;

  if (error && !data) {
    return (
      <div className={SPACING.container}>
        <Card>
          <EmptyState
            icon={<Icon name="unknown" size={24} />}
            title="Unable to load workspace"
            description={error}
            action={<Button variant="primary" onClick={() => void load()}>Retry</Button>}
          />
        </Card>
      </div>
    );
  }
  if (!data) return null;

  const uploadHref = `/cases/${caseId}/evidence`;

  const witnessColumns: Column<InvestigatorWorkbench['witnesses'][number]>[] = [
    { key: 'name', header: 'Name', render: (w) => <span className="font-medium text-white">{w.name}</span> },
    { key: 'role', header: 'Role', render: (w) => w.role ?? '—' },
    { key: 'interviewStatus', header: 'Interview', render: (w) => <StatusBadge status={w.interviewStatus} /> },
    {
      key: 'source',
      header: 'Source',
      render: (w) => (
        <span className="text-xs text-slate-500">
          {w.citations.map((c) => `${c.type}:${c.id.slice(0, 6)}`).join(', ') || 'manual'}
        </span>
      ),
    },
  ];

  return (
    <div className={`${SPACING.container} space-y-6`}>
      <PageHeader
        title="Investigator Workspace"
        overline="Investigation"
        subtitle={`${data.dashboard.caseTitle} — ${data.dashboard.caseNumber}`}
        action={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
            <Button variant="primary" onClick={() => navigate(uploadHref)}>
              <Icon name="upload" size={15} /> Quick Upload
            </Button>
          </div>
        }
      />

      {/* Quick evidence capture — always one tap away */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Photo', icon: <Camera size={18} /> },
          { label: 'Video', icon: <Video size={18} /> },
          { label: 'Audio', icon: <Mic size={18} /> },
          { label: 'GPS Evidence', icon: <MapPin size={18} /> },
        ].map((q) => (
          <button
            key={q.label}
            onClick={() => navigate(uploadHref)}
            className="ca-panel ca-panel-hover flex flex-col items-center gap-2 py-4 text-slate-300 hover:text-white"
          >
            <span className="w-10 h-10 rounded-xl ca-icon-gold text-gold-light flex items-center justify-center">{q.icon}</span>
            <span className="text-sm font-medium">{q.label}</span>
          </button>
        ))}
      </div>

      <Tabs tabs={TABS} activeId={tab} onChange={(id) => setTab(id as TabId)} />

      {tab === 'dashboard' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard tile="blue" icon={<Icon name="tasks" size={20} />} value={data.dashboard.openTasks} label="Open Tasks" />
          <StatCard tile="gold" icon={<Icon name="search" size={20} />} value={data.dashboard.openLeads} label="Active Leads" />
          <StatCard tile="violet" icon={<Icon name="witness" size={20} />} value={data.dashboard.witnessCount} label="Witnesses" />
          <StatCard tile="emerald" icon={<Icon name="unknown" size={20} />} value={data.dashboard.unknownCount} label="Unknowns" highlight={data.dashboard.unknownCount > 0} />
        </div>
      )}

      {tab === 'tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-base font-semibold text-white mb-4">Investigation Tasks</h3>
            {data.tasks.length === 0 ? (
              <EmptyState title="No tasks yet" />
            ) : (
              <ul className="space-y-2">
                {data.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.03]">
                    <span className="text-sm text-slate-200">{t.title}</span>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h3 className="text-base font-semibold text-white mb-4">Leads</h3>
            <div className="flex gap-2 mb-4">
              <Input
                value={leadTitle}
                onChange={(e) => setLeadTitle(e.target.value)}
                placeholder="New lead…"
                className="flex-1"
              />
              <Button
                variant="primary"
                onClick={() => leadTitle && void createLead(caseId!, { title: leadTitle }).then(() => { setLeadTitle(''); load(); })}
              >
                <Plus size={15} />
              </Button>
            </div>
            <ul className="space-y-2">
              {data.leads.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.03]">
                  <span className="text-sm text-slate-200">{l.title}</span>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'witnesses' && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-white">Witnesses &amp; Interviews</h3>
            <div className="flex gap-2">
              <Input value={witnessName} onChange={(e) => setWitnessName(e.target.value)} placeholder="Witness name…" />
              <Button
                variant="primary"
                onClick={() => witnessName && void createWitness(caseId!, { name: witnessName }).then(() => { setWitnessName(''); load(); })}
              >
                <Plus size={15} /> Add
              </Button>
            </div>
          </div>
          <DataTable
            columns={witnessColumns}
            rows={data.witnesses}
            rowKey={(w) => w.id}
            emptyTitle="No witnesses tracked yet"
          />
        </Card>
      )}

      {tab === 'evidence' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Camera size={15} className="text-gold-light" /> Photos</h3>
            <ul className="text-sm space-y-1.5 text-slate-300">{data.evidenceCollection.photos.map((e) => <li key={e.evidenceId} className="truncate">{e.fileName}</li>)}</ul>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Video size={15} className="text-gold-light" /> Video</h3>
            <ul className="text-sm space-y-1.5 text-slate-300">{data.evidenceCollection.videos.map((e) => <li key={e.evidenceId} className="truncate">{e.fileName}</li>)}</ul>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Mic size={15} className="text-gold-light" /> Audio</h3>
            <ul className="text-sm space-y-1.5 text-slate-300">{data.evidenceCollection.audio.map((e) => <li key={e.evidenceId} className="truncate">{e.fileName}</li>)}</ul>
          </Card>
          <Card className="md:col-span-3">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Icon name="security" size={16} /> Chain of Custody</h3>
            <DataTable
              columns={[
                { key: 'fileName', header: 'File' },
                { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
              ]}
              rows={data.chainOfCustody}
              rowKey={(c) => c.evidenceId}
              emptyTitle="No custody records"
            />
          </Card>
        </div>
      )}

      {tab === 'timeline' && (
        <TimelineEngine
          variant="investigation"
          events={fromGenericEvents(
            data.timeline.map((e) => ({
              id: e.id,
              timestamp: e.timestamp,
              description: e.description,
              eventType: e.actor ? `${e.actor}` : 'Event',
            })),
          )}
        />
      )}

      {tab === 'notes' && (
        <Card>
          <h3 className="text-base font-semibold text-white mb-4">Investigation Notebook</h3>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Field observation…"
            className="mb-3"
          />
          <Button
            variant="primary"
            onClick={() => noteText && void createFieldNote(caseId!, noteText).then(() => { setNoteText(''); load(); })}
          >
            Save Note
          </Button>
          <ul className="mt-5 space-y-2">
            {data.fieldNotes.map((n) => (
              <li key={n.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                <Badge variant="default">{n.noteType}</Badge>
                <p className="text-sm text-slate-200 mt-2">{n.content}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'gaps' && (
        <div className="space-y-4">
          <Card>
            <h3 className="text-base font-semibold text-white mb-3">Recommended Investigation</h3>
            <ul className="space-y-2">
              {data.recommendedInvestigation.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-light mt-1.5 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3">Evidence Gaps</h3>
              <ul className="text-sm space-y-1.5 text-slate-300">{data.gaps.evidence.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3">Witness Gaps</h3>
              <ul className="text-sm space-y-1.5 text-slate-300">{data.gaps.witness.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3">Timeline Gaps</h3>
              <ul className="text-sm space-y-1.5 text-slate-300">{data.gaps.timeline.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </Card>
          </div>
          {data.unknowns.length > 0 && (
            <Card>
              <h3 className="text-base font-semibold text-white mb-3">Unknowns</h3>
              <ul className="space-y-2">
                {data.unknowns.map((u, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <UnknownIndicator />
                    <span className="text-sm text-slate-300">{u}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
