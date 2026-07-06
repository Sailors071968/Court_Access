// ============================================================================
// CourtAccess — Collaboration Workspace (Program 32)
// Shared workspaces + collaborators, presence, activity, comments — on the
// design system. Authorization reuses the existing permission engine
// (fetchSharedAccess / createPermissionGrant); no duplicated auth logic.
// ============================================================================

import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, FileText } from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/icons/registry';
import { PresenceBar } from '../../components/collaboration/PresenceBar';
import { ActivityFeed } from '../../components/collaboration/ActivityFeed';
import { CommentThread } from '../../components/collaboration/CommentThread';
import { CollaboratorList } from '../../components/collaboration/CollaboratorList';
import type { Collaborator, Comment, ActivityItem, CollaboratorRole } from '../../components/collaboration/types';
import { fetchSharedAccess, type SharedWorkspace } from '../../services/membershipApi';

export function SharedAccessPage() {
  const [workspaces, setWorkspaces] = useState<SharedWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    fetchSharedAccess()
      .then((data) => setWorkspaces(data.workspaces))
      .catch(() => setError('Unable to load shared access'))
      .finally(() => setLoading(false));
  }, []);

  // Derive collaborators from the workspaces the permission engine returns.
  const collaborators: Collaborator[] = useMemo(
    () =>
      workspaces.map((ws, i) => ({
        userId: ws.organizationId + i,
        name: ws.sharedBy,
        role: (ws.role as CollaboratorRole) ?? 'attorney',
        online: i === 0,
        permissions: ws.permissions.map((p) => `${p.scope}:${p.permission}`),
      })),
    [workspaces],
  );

  const activity: ActivityItem[] = useMemo(
    () =>
      workspaces.flatMap((ws) =>
        ws.cases.map((c, i) => ({
          id: `${ws.organizationId}-${c.caseId}-${i}`,
          actor: ws.sharedBy,
          action: 'shared case',
          target: c.title || c.caseNumber,
          at: 'Recently',
          type: 'system' as const,
        })),
      ),
    [workspaces],
  );

  if (loading) return <Spinner label="Loading collaboration…" />;
  if (error) {
    return (
      <Card>
        <EmptyState icon={<Icon name="permissions" size={24} />} title="Unable to load" description={error} />
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Collaboration"
        overline="Shared Workspaces"
        subtitle="People and cases shared with you — you only see what you are authorized to see."
        action={<PresenceBar collaborators={collaborators} />}
      />

      {workspaces.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="witness" size={24} />}
            title="No shared workspaces yet"
            description="When an account owner invites you (attorney, secretary, client, investigator, expert, paralegal, family), shared cases and documents appear here."
            action={<Link to="/dashboard" className="inline-flex items-center h-9 px-4 rounded-xl text-sm font-semibold ca-gradient-gold text-navy hover:brightness-110">Go to Dashboard</Link>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shared workspaces */}
          <div className="lg:col-span-2 space-y-6">
            {workspaces.map((ws) => (
              <Card key={ws.organizationId}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-white">{ws.sharedBy}</h2>
                    <p className="text-sm text-slate-400 capitalize">Your role: {ws.role}</p>
                  </div>
                  <Badge variant="gold">{ws.permissions.length} permissions</Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <FolderOpen size={15} className="text-gold-light" /> Cases
                    </h3>
                    {ws.cases.length === 0 ? (
                      <p className="text-sm text-slate-500">No cases shared</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {ws.cases.map((c) => (
                          <li key={c.caseId}>
                            <Link to={`/cases/${c.caseId}/overview`} className="text-sm text-gold-light hover:text-gold-bright">
                              {c.title || c.caseNumber}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <FileText size={15} className="text-gold-light" /> Shared Documents
                    </h3>
                    {ws.disclosures.filter((d) => d.status === 'published').length === 0 ? (
                      <p className="text-sm text-slate-500">No published documents</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {ws.disclosures.filter((d) => d.status === 'published').map((d) => (
                          <li key={d.packageId} className="text-sm text-slate-400">
                            {d.recipientType} version — Case {d.caseId.slice(0, 8)}…
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            <Card>
              <h3 className="text-base font-semibold text-white mb-4">Discussion</h3>
              <CommentThread
                comments={comments}
                onAdd={(text) =>
                  setComments((prev) => [
                    ...prev,
                    { id: String(Date.now()), author: 'You', text, at: 'Just now' },
                  ])
                }
                className="max-h-80"
              />
            </Card>
          </div>

          {/* Collaborators + activity */}
          <div className="space-y-6">
            <Card>
              <CollaboratorList collaborators={collaborators} />
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-white mb-4">Activity Feed</h3>
              <ActivityFeed items={activity} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
