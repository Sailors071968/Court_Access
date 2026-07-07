// ============================================
// Program 2 — Law Firm Operating Platform
// Complete multi-tenant firm administration UI
// ============================================

import { useCallback, useEffect, useState } from 'react';
import {
  getCurrentOrganization,
  listMembers,
  listOffices,
  createOffice,
} from '../../services/organizationApi';
import { firmApi } from '../../services/firmApi';

type Tab = 'overview' | 'offices' | 'personnel' | 'collaboration' | 'knowledge' | 'conflicts' | 'security' | 'assignments';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'offices', label: 'Offices & Departments' },
  { id: 'personnel', label: 'Personnel' },
  { id: 'collaboration', label: 'Collaboration' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'security', label: 'Security' },
  { id: 'assignments', label: 'Client Teams' },
];

const PERSONNEL_TYPES = [
  { value: 'attorney', label: 'Attorney' },
  { value: 'investigator', label: 'Criminal Investigator' },
  { value: 'paralegal', label: 'Paralegal' },
  { value: 'legal_assistant', label: 'Legal Assistant' },
  { value: 'office_admin', label: 'Office Administrator' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'expert_witness', label: 'Expert Witness' },
  { value: 'contract_investigator', label: 'Contract Investigator' },
];

export function FirmOperatingPlatformPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [org, setOrg] = useState<Record<string, unknown> | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [offices, setOffices] = useState<Array<Record<string, unknown>>>([]);
  const [departments, setDepartments] = useState<Array<Record<string, unknown>>>([]);
  const [personnel, setPersonnel] = useState<Array<Record<string, unknown>>>([]);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [tasks, setTasks] = useState<Array<Record<string, unknown>>>([]);
  const [knowledge, setKnowledge] = useState<Array<Record<string, unknown>>>([]);
  const [conflicts, setConflicts] = useState<Array<Record<string, unknown>>>([]);
  const [permissions, setPermissions] = useState<Array<Record<string, unknown>>>([]);
  const [members, setMembers] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newMsg, setNewMsg] = useState('');
  const [newTask, setNewTask] = useState('');
  const [conflictQuery, setConflictQuery] = useState('');
  const [deptName, setDeptName] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [knowledgeTitle, setKnowledgeTitle] = useState('');
  const [knowledgeBody, setKnowledgeBody] = useState('');
  const [selectedOffice, setSelectedOffice] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const [orgRes, analyticsRes, officesRes, deptRes, personnelRes, membersRes] = await Promise.all([
        getCurrentOrganization(),
        firmApi.getAnalytics(selectedOffice || undefined),
        listOffices(),
        firmApi.getDepartments(selectedOffice || undefined),
        firmApi.getPersonnel(selectedOffice ? { officeId: selectedOffice } : undefined),
        listMembers(),
      ]);
      setOrg(orgRes.organization as Record<string, unknown>);
      setAnalytics(analyticsRes.analytics as Record<string, unknown>);
      setOffices(officesRes.offices);
      setDepartments(deptRes.departments);
      setPersonnel(personnelRes.personnel);
      setMembers(membersRes.members);

      if (tab === 'collaboration') {
        const [msgRes, taskRes] = await Promise.all([firmApi.getMessages(), firmApi.getTasks()]);
        setMessages(msgRes.messages);
        setTasks(taskRes.tasks);
      }
      if (tab === 'knowledge') {
        const kRes = await firmApi.getKnowledge();
        setKnowledge(kRes.assets);
      }
      if (tab === 'conflicts') {
        const cRes = await firmApi.getConflicts();
        setConflicts(cRes.conflicts);
      }
      if (tab === 'security') {
        const pRes = await firmApi.getPermissions();
        setPermissions(pRes.grants);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load firm data');
    }
  }, [tab, selectedOffice]);

  useEffect(() => { void load(); }, [load]);

  const seedCAOffices = async () => {
    try {
      const res = await firmApi.seedCaliforniaOffices();
      setOffices(res.offices);
      setMessage('California branch offices created (Sacramento, LA, San Diego, SF).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    }
  };

  const primaryColor = String(org?.primaryColor ?? '#1e293b');

  return (
    <div className="min-h-screen bg-slate-50" style={{ '--firm-primary': primaryColor } as React.CSSProperties}>
      <header className="bg-white/5 border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {org?.logoUrl ? (
            <img src={String(org.logoUrl)} alt="Firm logo" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: primaryColor }}>
              {String(org?.name ?? 'F').charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{String(org?.name ?? 'Law Firm')}</h1>
            <p className="text-sm text-slate-400">{String(org?.tagline ?? 'Law Firm Operating Platform')}</p>
          </div>
        </div>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={selectedOffice}
          onChange={(e) => setSelectedOffice(e.target.value)}
        >
          <option value="">All offices</option>
          {offices.map((o) => (
            <option key={String(o.officeId)} value={String(o.officeId)}>{String(o.name)}</option>
          ))}
        </select>
      </header>

      <nav className="bg-white/5 border-b px-6 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${tab === t.id ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        {error && <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        {message && <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg text-sm">{message}</div>}

        {tab === 'overview' && analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Active Cases', analytics.activeCases],
                ['Closed Cases', analytics.closedCases],
                ['New Clients (30d)', analytics.newClientsMonth],
                ['Evidence Processed', analytics.evidenceProcessed],
                ['Staff', analytics.staffCount],
                ['Pending Tasks', analytics.pendingTasks],
                ['Open Conflicts', analytics.openConflicts],
                ['Knowledge Assets', analytics.knowledgeAssets],
              ].map(([label, val]) => (
                <div key={String(label)} className="bg-white/5 rounded-xl border p-4">
                  <div className="text-2xl font-bold" style={{ color: primaryColor }}>{String(val ?? 0)}</div>
                  <div className="text-sm text-slate-400">{String(label)}</div>
                </div>
              ))}
            </div>
            {(analytics.officeStats as Array<Record<string, unknown>>)?.length > 0 && (
              <section className="bg-white/5 rounded-xl border p-6">
                <h2 className="font-semibold mb-4">Office Analytics</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {(analytics.officeStats as Array<Record<string, unknown>>).map((o) => (
                    <div key={String(o.officeId)} className="border rounded-lg p-3">
                      <div className="font-medium">{String(o.name)}</div>
                      <div className="text-sm text-slate-400">{String(o.city)} — {String(o.staff)} staff, {String(o.activeCases)} active cases</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === 'offices' && (
          <div className="space-y-6">
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={seedCAOffices} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">Seed CA Offices</button>
              <input className="border rounded-lg px-3 py-2 text-sm" value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="New office name" />
              <button type="button" onClick={async () => { await createOffice({ name: officeName }); setOfficeName(''); await load(); }} className="border px-4 py-2 rounded-lg text-sm">Add office</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {offices.map((o) => (
                <div key={String(o.officeId)} className="bg-white/5 border rounded-xl p-4">
                  <div className="font-semibold">{String(o.name)}{o.isPrimary ? ' ★' : ''}{o.isBranch ? ' (branch)' : ''}</div>
                  <div className="text-sm text-slate-400">{[o.city, o.state].filter(Boolean).join(', ')}</div>
                </div>
              ))}
            </div>
            <section className="bg-white/5 border rounded-xl p-4">
              <h3 className="font-semibold mb-3">Departments</h3>
              <div className="flex gap-2 mb-3">
                <input className="border rounded-lg px-3 py-2 text-sm flex-1" value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Department name" />
                <button type="button" onClick={async () => { await firmApi.createDepartment({ name: deptName, officeId: selectedOffice || undefined }); setDeptName(''); await load(); }} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">Add</button>
              </div>
              <ul className="text-sm space-y-1">
                {departments.map((d) => <li key={String(d.departmentId)}>{String(d.name)}</li>)}
              </ul>
            </section>
          </div>
        )}

        {tab === 'personnel' && (
          <div className="bg-white/5 border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Office</th>
                  <th className="text-left p-3">Active Cases</th>
                </tr>
              </thead>
              <tbody>
                {personnel.map((p) => (
                  <tr key={String(p.memberId)} className="border-b">
                    <td className="p-3">{(p.user as Record<string, unknown>)?.name as string}</td>
                    <td className="p-3">{String(p.personnelType ?? p.role)}</td>
                    <td className="p-3">{(p.office as Record<string, unknown>)?.name as string ?? '—'}</td>
                    <td className="p-3">{String(p.activeCases ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 border-t text-xs text-slate-400">
              Personnel types: {PERSONNEL_TYPES.map((t) => t.label).join(', ')}
            </div>
          </div>
        )}

        {tab === 'collaboration' && (
          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-white/5 border rounded-xl p-4">
              <h3 className="font-semibold mb-3">Internal Messages</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
                {messages.map((m) => (
                  <div key={String(m.messageId)} className="text-sm border-b pb-2">
                    <span className="font-medium">{(m.sender as Record<string, unknown>)?.name as string}: </span>
                    {String(m.body)}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="border rounded-lg px-3 py-2 text-sm flex-1" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Team message…" />
                <button type="button" onClick={async () => { await firmApi.sendMessage({ body: newMsg, channel: 'team' }); setNewMsg(''); await load(); }} className="bg-slate-800 text-white px-3 py-2 rounded-lg text-sm">Send</button>
              </div>
            </section>
            <section className="bg-white/5 border rounded-xl p-4">
              <h3 className="font-semibold mb-3">Tasks</h3>
              <ul className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                {tasks.map((t) => (
                  <li key={String(t.taskId)} className="text-sm flex justify-between border-b pb-1">
                    <span>{String(t.title)}</span>
                    <span className="text-slate-500">{String(t.status)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input className="border rounded-lg px-3 py-2 text-sm flex-1" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="New task…" />
                <button type="button" onClick={async () => { await firmApi.createTask({ title: newTask, taskType: 'general' }); setNewTask(''); await load(); }} className="bg-slate-800 text-white px-3 py-2 rounded-lg text-sm">Add</button>
              </div>
            </section>
          </div>
        )}

        {tab === 'knowledge' && (
          <div className="space-y-4">
            <div className="bg-white/5 border rounded-xl p-4 space-y-2">
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={knowledgeTitle} onChange={(e) => setKnowledgeTitle(e.target.value)} placeholder="Title" />
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} value={knowledgeBody} onChange={(e) => setKnowledgeBody(e.target.value)} placeholder="Content (motion, template, procedure…)" />
              <button type="button" onClick={async () => { await firmApi.createKnowledge({ assetType: 'template', title: knowledgeTitle, body: knowledgeBody }); setKnowledgeTitle(''); setKnowledgeBody(''); await load(); }} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">Add to repository</button>
            </div>
            {knowledge.map((k) => (
              <div key={String(k.assetId)} className="bg-white/5 border rounded-xl p-4">
                <div className="font-medium">{String(k.title)} <span className="text-xs text-slate-500">({String(k.assetType)})</span></div>
                <p className="text-sm text-slate-300 mt-1 line-clamp-2">{String(k.body)}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'conflicts' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input className="border rounded-lg px-3 py-2 text-sm flex-1" value={conflictQuery} onChange={(e) => setConflictQuery(e.target.value)} placeholder="Name to check for conflicts…" />
              <button type="button" onClick={async () => { await firmApi.checkConflicts(conflictQuery); await load(); setMessage('Conflict check complete.'); }} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">Run check</button>
            </div>
            {conflicts.map((c) => (
              <div key={String(c.recordId)} className="bg-white/5 border rounded-xl p-4 flex justify-between">
                <div>
                  <div className="font-medium">{String(c.conflictType)}: {String(c.entityA)} ↔ {String(c.entityB)}</div>
                  <div className="text-sm text-slate-400">{String(c.details)}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${c.severity === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{String(c.severity)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'security' && (
          <div className="bg-white/5 border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Permission Grants</h3>
            <ul className="text-sm space-y-2 mb-4">
              {permissions.map((g) => (
                <li key={String(g.grantId)}>{String(g.scope)} / {String(g.permission)} — user {String(g.userId).slice(0, 8)}…</li>
              ))}
              {!permissions.length && <li className="text-slate-500">No custom grants — using role defaults.</li>}
            </ul>
            <p className="text-xs text-slate-400">Scopes: office, department, case, document, evidence, admin. Approval workflows available via API.</p>
          </div>
        )}

        {tab === 'assignments' && (
          <div className="bg-white/5 border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Client Team Assignment</h3>
            <p className="text-sm text-slate-300 mb-4">Assign primary attorney, investigator, paralegal, and office per client via API or client management.</p>
            <div className="text-sm text-slate-400">{members.length} team members available for assignment.</div>
          </div>
        )}
      </main>
    </div>
  );
}
