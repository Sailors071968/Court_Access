// ============================================
// Program 2 — Organization Settings & Administration
// ============================================

import { useEffect, useState } from 'react';
import {
  getCurrentOrganization,
  updateOrganization,
  listMembers,
  listInvitations,
  createInvitation,
  getFirmAnalytics,
  listOffices,
  createOffice,
  listPracticeGroups,
  createPracticeGroup,
} from '../../services/organizationApi';

export function OrganizationSettingsPage() {
  const [org, setOrg] = useState<Record<string, unknown> | null>(null);
  const [members, setMembers] = useState<Array<Record<string, unknown>>>([]);
  const [invitations, setInvitations] = useState<Array<Record<string, unknown>>>([]);
  const [offices, setOffices] = useState<Array<Record<string, unknown>>>([]);
  const [groups, setGroups] = useState<Array<Record<string, unknown>>>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('attorney');
  const [officeName, setOfficeName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [orgRes, membersRes, invitesRes, officesRes, groupsRes, analyticsRes] = await Promise.all([
        getCurrentOrganization(),
        listMembers(),
        listInvitations(),
        listOffices(),
        listPracticeGroups(),
        getFirmAnalytics(),
      ]);
      setOrg(orgRes.organization as Record<string, unknown>);
      setMembers(membersRes.members);
      setInvitations(invitesRes.invitations);
      setOffices(officesRes.offices);
      setGroups(groupsRes.practiceGroups);
      setAnalytics(analyticsRes.analytics);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organization');
    }
  };

  useEffect(() => { void load(); }, []);

  const saveBranding = async () => {
    if (!org) return;
    try {
      await updateOrganization({
        name: org.name,
        tagline: org.tagline,
        website: org.website,
        primaryColor: org.primaryColor,
        logoUrl: org.logoUrl,
        billingEmail: org.billingEmail,
      });
      setMessage('Organization settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const sendInvite = async () => {
    try {
      await createInvitation({ email: inviteEmail, role: inviteRole });
      setInviteEmail('');
      setMessage('Invitation sent.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invitation failed');
    }
  };

  const addOffice = async () => {
    try {
      await createOffice({ name: officeName, isPrimary: offices.length === 0 });
      setOfficeName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add office');
    }
  };

  const addGroup = async () => {
    try {
      await createPracticeGroup({ name: groupName, practiceArea: 'criminal_defense' });
      setGroupName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add practice group');
    }
  };

  if (!org) {
    return <div className="p-8 text-slate-300">Loading organization…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Organization Administration</h1>
        <p className="text-slate-300">Manage your law firm, offices, team, and branding.</p>
      </div>

      {error && <div className="bg-red-500/10 text-red-300 p-3 rounded-lg text-sm">{error}</div>}
      {message && <div className="bg-emerald-500/10 text-emerald-300 p-3 rounded-lg text-sm">{message}</div>}

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['members', 'clients', 'cases', 'evidence'] as const).map((key) => (
            <div key={key} className="bg-white/5 border rounded-xl p-4">
              <div className="text-2xl font-bold">{String(analytics[key] ?? 0)}</div>
              <div className="text-sm text-slate-400 capitalize">{key}</div>
            </div>
          ))}
        </div>
      )}

      <section className="bg-white/5 border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Firm Profile & Branding</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <input className="border rounded-lg px-3 py-2" value={String(org.name ?? '')} onChange={(e) => setOrg({ ...org, name: e.target.value })} placeholder="Firm name" />
          <input className="border rounded-lg px-3 py-2" value={String(org.tagline ?? '')} onChange={(e) => setOrg({ ...org, tagline: e.target.value })} placeholder="Tagline" />
          <input className="border rounded-lg px-3 py-2" value={String(org.website ?? '')} onChange={(e) => setOrg({ ...org, website: e.target.value })} placeholder="Website" />
          <input className="border rounded-lg px-3 py-2" value={String(org.primaryColor ?? '')} onChange={(e) => setOrg({ ...org, primaryColor: e.target.value })} placeholder="Primary color" />
          <input className="border rounded-lg px-3 py-2 md:col-span-2" value={String(org.logoUrl ?? '')} onChange={(e) => setOrg({ ...org, logoUrl: e.target.value })} placeholder="Logo URL" />
        </div>
        <button type="button" onClick={saveBranding} className="bg-slate-800 text-white px-4 py-2 rounded-lg">Save settings</button>
      </section>

      <section className="bg-white/5 border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Offices ({offices.length})</h2>
        <ul className="text-sm space-y-1">
          {offices.map((o) => (
            <li key={String(o.officeId)}>{String(o.name)}{o.isPrimary ? ' (primary)' : ''}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className="border rounded-lg px-3 py-2 flex-1" value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="New office name" />
          <button type="button" onClick={addOffice} className="bg-slate-800 text-white px-4 py-2 rounded-lg">Add office</button>
        </div>
      </section>

      <section className="bg-white/5 border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Practice Groups ({groups.length})</h2>
        <ul className="text-sm space-y-1">
          {groups.map((g) => <li key={String(g.practiceGroupId)}>{String(g.name)}</li>)}
        </ul>
        <div className="flex gap-2">
          <input className="border rounded-lg px-3 py-2 flex-1" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Practice group name" />
          <button type="button" onClick={addGroup} className="bg-slate-800 text-white px-4 py-2 rounded-lg">Add group</button>
        </div>
      </section>

      <section className="bg-white/5 border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Team Members ({members.length})</h2>
        <ul className="text-sm divide-y">
          {members.map((m) => (
            <li key={String(m.memberId)} className="py-2 flex justify-between">
              <span>{String((m.user as Record<string, unknown>)?.name)} — {(m.user as Record<string, unknown>)?.email as string}</span>
              <span className="text-slate-400">{String(m.role)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input className="border rounded-lg px-3 py-2 flex-1 min-w-[200px]" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Invite email" type="email" />
          <select className="border rounded-lg px-3 py-2" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            <option value="attorney">Attorney</option>
            <option value="investigator">Investigator</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          <button type="button" onClick={sendInvite} className="bg-slate-800 text-white px-4 py-2 rounded-lg">Send invitation</button>
        </div>
        {invitations.length > 0 && (
          <p className="text-xs text-slate-400">{invitations.length} pending invitation(s)</p>
        )}
      </section>
    </div>
  );
}
