// ============================================================================
// CourtAccess — Collaborators Management (Master Collaboration System Program)
// Dedicated page: invite / remove / suspend / reactivate / search / filter /
// sort / role assignment. Unlimited collaborators. Authorization + audit are
// enforced server-side (organization routes); this UI only orchestrates.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Search, Loader2, Pause, Play, Trash2, Mail, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { Avatar } from '../../components/ui/avatar';
import {
  listCollaborators,
  listInvitations,
  createInvitation,
  updateCollaborator,
  removeCollaborator,
} from '../../services/organizationApi';

interface Member {
  memberId: string;
  role: string;
  caseRole?: string | null;
  personnelType?: string | null;
  status: string;
  joinedAt: string;
  user: { id: string; email: string; name: string; role: string; avatarUrl?: string | null };
  office?: { name: string } | null;
}
interface Invitation {
  invitationId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
}

const ORG_ROLES = [
  { value: 'attorney', label: 'Attorney' },
  { value: 'investigator', label: 'Investigator' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Administrator' },
];

const STATUS_VARIANT: Record<string, 'emerald' | 'amber' | 'slate'> = {
  active: 'emerald',
  suspended: 'amber',
  removed: 'slate',
} as const;

export function CollaboratorsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('attorney');
  const [inviting, setInviting] = useState(false);

  // Controls
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'joined'>('joined');

  const load = async () => {
    setLoading(true);
    try {
      const [c, inv] = await Promise.all([
        listCollaborators(),
        listInvitations().catch(() => ({ invitations: [] })),
      ]);
      setMembers(c.collaborators ?? []);
      setInvitations(inv.invitations ?? []);
      setError('');
    } catch {
      setError('Unable to load collaborators.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await createInvitation({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      flash(`Invitation sent to ${inviteEmail.trim()}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  };

  const act = async (memberId: string, fn: () => Promise<unknown>, msg: string) => {
    setBusyId(memberId);
    setError('');
    try {
      await fn();
      flash(msg);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyId('');
    }
  };

  const filtered = useMemo(() => {
    let list = members.slice();
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((m) => m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q));
    if (roleFilter !== 'all') list = list.filter((m) => m.role === roleFilter);
    if (statusFilter !== 'all') list = list.filter((m) => m.status === statusFilter);
    list.sort((a, b) => {
      if (sortBy === 'name') return a.user.name.localeCompare(b.user.name);
      if (sortBy === 'role') return a.role.localeCompare(b.role);
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
    return list;
  }, [members, query, roleFilter, statusFilter, sortBy]);

  const activeCount = members.filter((m) => m.status === 'active').length;
  const suspendedCount = members.filter((m) => m.status === 'suspended').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        overline="Team"
        title="Collaborators"
        subtitle="Invite an unlimited number of collaborators and manage their roles, access, and status."
        action={<Badge variant="gold"><ShieldCheck size={13} className="mr-1" /> Unlimited collaborators</Badge>}
      />

      {notice && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-2.5 rounded-xl text-sm">{notice}</div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-2.5 rounded-xl text-sm">{error}</div>
      )}

      {/* Invite */}
      <Card>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <UserPlus size={18} className="text-gold-light" /> Invite a collaborator
        </h2>
        <form onSubmit={invite} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="collaborator@example.com"
              className="w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-400 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:border-gold-light focus:outline-none"
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="bg-white/5 border border-white/10 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:border-gold-light focus:outline-none"
          >
            {ORG_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="inline-flex items-center justify-center gap-2 h-[42px] px-5 rounded-xl text-sm font-semibold ca-gradient-gold text-navy hover:brightness-110 disabled:opacity-60"
          >
            {inviting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Send invite
          </button>
        </form>
      </Card>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-4">
        {[['Collaborators', members.length], ['Active', activeCount], ['Suspended', suspendedCount]].map(([label, val]) => (
          <Card key={String(label)} className="py-4">
            <div className="text-3xl font-bold text-white tracking-tight">{String(val)}</div>
            <div className="text-sm font-medium text-slate-300 mt-1">{String(label)}</div>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-400 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:border-gold-light focus:outline-none"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-white/5 border border-white/10 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:border-gold-light focus:outline-none">
          <option value="all">All roles</option>
          {ORG_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white/5 border border-white/10 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:border-gold-light focus:outline-none">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="bg-white/5 border border-white/10 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:border-gold-light focus:outline-none">
          <option value="joined">Sort: Joined</option>
          <option value="name">Sort: Name</option>
          <option value="role">Sort: Role</option>
        </select>
      </div>

      {/* List */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" /> Loading collaborators…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={24} />}
            title={members.length === 0 ? 'No collaborators yet' : 'No matching collaborators'}
            description={members.length === 0 ? 'Invite your first collaborator above — there is no limit.' : 'Adjust your search or filters.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  {['Collaborator', 'Role', 'Status', 'Joined', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold uppercase tracking-wide text-slate-300 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((m) => (
                  <tr key={m.memberId} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.user.name} src={m.user.avatarUrl ?? undefined} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{m.user.name}</p>
                          <p className="text-xs text-slate-400 truncate">{m.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={m.role}
                        disabled={busyId === m.memberId}
                        onChange={(e) => act(m.memberId, () => updateCollaborator(m.memberId, { role: e.target.value }), 'Role updated.')}
                        className="bg-white/5 border border-white/10 text-slate-200 rounded-lg px-2 py-1 text-xs focus:border-gold-light focus:outline-none"
                      >
                        {ORG_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[m.status] ?? 'slate'} className="capitalize">{m.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{new Date(m.joinedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {m.status === 'active' ? (
                          <button
                            disabled={busyId === m.memberId}
                            onClick={() => act(m.memberId, () => updateCollaborator(m.memberId, { status: 'suspended' }), 'Collaborator suspended.')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-white/5 disabled:opacity-50"
                            title="Suspend"
                          ><Pause size={15} /></button>
                        ) : (
                          <button
                            disabled={busyId === m.memberId}
                            onClick={() => act(m.memberId, () => updateCollaborator(m.memberId, { status: 'active' }), 'Collaborator reactivated.')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-white/5 disabled:opacity-50"
                            title="Reactivate"
                          ><Play size={15} /></button>
                        )}
                        <button
                          disabled={busyId === m.memberId}
                          onClick={() => { if (confirm(`Remove ${m.user.name}? They will lose access.`)) void act(m.memberId, () => removeCollaborator(m.memberId), 'Collaborator removed.'); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-white/5 disabled:opacity-50"
                          title="Remove"
                        ><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-white mb-4">Pending invitations ({invitations.length})</h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.invitationId} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={inv.email} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{inv.email}</p>
                    <p className="text-xs text-slate-400 capitalize">{inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <Badge variant="amber" className="capitalize">{inv.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
