// ============================================
// Court Access — Collaboration Page (Phase 19: Collaboration System)
// Multi-user case collaboration: team members, annotations, comments, activity feed.
// ============================================

import { useState } from 'react';
import {
  Users,
  MessageSquare,
  StickyNote,
  Clock,
  Plus,
  Search,
  MoreHorizontal,
  Send,
  CheckCircle,
  UserPlus,
  Shield,
  Eye,
  Edit3,
  Trash2,
  Flag,
  HelpCircle,
  AlertCircle,
  Star,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'team' | 'comments' | 'annotations' | 'activity';
type CollaboratorRole = 'attorney' | 'investigator' | 'researcher';
type AnnotationType = 'highlight' | 'note' | 'flag' | 'question' | 'important';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: CollaboratorRole;
  addedAt: string;
  lastActive: string;
  avatar: string;
}

interface CommentThread {
  id: string;
  subject: string;
  author: string;
  authorRole: CollaboratorRole;
  evidence: string | null;
  createdAt: string;
  replyCount: number;
  isResolved: boolean;
  lastReply: string;
  replies: { author: string; content: string; timestamp: string }[];
}

interface Annotation {
  id: string;
  type: AnnotationType;
  content: string;
  author: string;
  evidence: string;
  page: number | null;
  timestamp: string | null;
  createdAt: string;
}

interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target: string | null;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const TEAM: TeamMember[] = [
  { id: '1', name: 'Sarah Chen', email: 'sarah@lawfirm.com', role: 'attorney', addedAt: '2026-02-15', lastActive: '2026-03-05T18:30:00Z', avatar: 'SC' },
  { id: '2', name: 'Marcus Rodriguez', email: 'marcus@investigations.com', role: 'investigator', addedAt: '2026-02-20', lastActive: '2026-03-05T16:00:00Z', avatar: 'MR' },
  { id: '3', name: 'Emily Park', email: 'emily@research.edu', role: 'researcher', addedAt: '2026-03-01', lastActive: '2026-03-04T14:00:00Z', avatar: 'EP' },
];

const THREADS: CommentThread[] = [
  {
    id: 't1', subject: 'Inconsistency in officer testimony timestamps', author: 'Sarah Chen', authorRole: 'attorney',
    evidence: 'officer-report-2024-001.pdf', createdAt: '2026-03-05T14:00:00Z', replyCount: 3, isResolved: false,
    lastReply: '2026-03-05T17:30:00Z',
    replies: [
      { author: 'Sarah Chen', content: 'The officer report states arrival at 10:15 PM but the body cam footage shows 10:32 PM. This 17-minute discrepancy needs to be flagged for cross-examination.', timestamp: '2026-03-05T14:00:00Z' },
      { author: 'Marcus Rodriguez', content: 'Confirmed. I pulled the CAD dispatch logs — dispatch was at 10:08 PM, which makes the 10:15 arrival plausible but the body cam timestamp suggests otherwise.', timestamp: '2026-03-05T15:30:00Z' },
      { author: 'Emily Park', content: 'I found two prior cases where this officer had similar timestamp discrepancies. Adding cross-reference annotations now.', timestamp: '2026-03-05T17:30:00Z' },
    ],
  },
  {
    id: 't2', subject: 'Audio quality issue on witness interview', author: 'Marcus Rodriguez', authorRole: 'investigator',
    evidence: 'witness-interview-003.mp3', createdAt: '2026-03-04T10:00:00Z', replyCount: 1, isResolved: true,
    lastReply: '2026-03-04T11:00:00Z',
    replies: [
      { author: 'Marcus Rodriguez', content: 'The audio from 12:45 to 14:20 has significant background noise. Transcription accuracy may be affected in that segment.', timestamp: '2026-03-04T10:00:00Z' },
      { author: 'Sarah Chen', content: 'Noted. I will flag this segment as unreliable in the evidence summary. We may need to re-interview.', timestamp: '2026-03-04T11:00:00Z' },
    ],
  },
];

const ANNOTATIONS: Annotation[] = [
  { id: 'a1', type: 'important', content: 'Key admission by witness — contradicts police report paragraph 3', author: 'Sarah Chen', evidence: 'witness-statement-001.pdf', page: 2, timestamp: null, createdAt: '2026-03-05T15:00:00Z' },
  { id: 'a2', type: 'flag', content: 'Possible chain of custody break — evidence bag seal appears tampered', author: 'Marcus Rodriguez', evidence: 'evidence-photo-045.jpg', page: null, timestamp: null, createdAt: '2026-03-05T12:00:00Z' },
  { id: 'a3', type: 'question', content: 'Is this the same vehicle referenced in exhibit B?', author: 'Emily Park', evidence: 'surveillance-footage.mp4', page: null, timestamp: '02:34:15', createdAt: '2026-03-04T16:00:00Z' },
  { id: 'a4', type: 'note', content: 'Miranda warning given at 11:42 PM per body cam audio', author: 'Sarah Chen', evidence: 'body-cam-001.mp4', page: null, timestamp: '00:15:42', createdAt: '2026-03-04T14:00:00Z' },
  { id: 'a5', type: 'highlight', content: 'Officer uses passive voice throughout — "the suspect was observed" rather than "I saw"', author: 'Emily Park', evidence: 'officer-report-2024-001.pdf', page: 4, timestamp: null, createdAt: '2026-03-03T10:00:00Z' },
];

const ACTIVITY: ActivityItem[] = [
  { id: 'act1', user: 'Emily Park', action: 'created annotation on', target: 'officer-report-2024-001.pdf', timestamp: '2026-03-05T17:30:00Z' },
  { id: 'act2', user: 'Marcus Rodriguez', action: 'replied to thread', target: 'Inconsistency in officer testimony timestamps', timestamp: '2026-03-05T15:30:00Z' },
  { id: 'act3', user: 'Sarah Chen', action: 'uploaded evidence', target: 'witness-statement-002.pdf', timestamp: '2026-03-05T14:00:00Z' },
  { id: 'act4', user: 'Sarah Chen', action: 'created comment thread', target: 'Inconsistency in officer testimony timestamps', timestamp: '2026-03-05T14:00:00Z' },
  { id: 'act5', user: 'Marcus Rodriguez', action: 'flagged evidence', target: 'evidence-photo-045.jpg', timestamp: '2026-03-05T12:00:00Z' },
  { id: 'act6', user: 'Sarah Chen', action: 'resolved thread', target: 'Audio quality issue on witness interview', timestamp: '2026-03-04T11:00:00Z' },
  { id: 'act7', user: 'Marcus Rodriguez', action: 'uploaded evidence', target: 'witness-interview-003.mp3', timestamp: '2026-03-04T10:00:00Z' },
  { id: 'act8', user: 'Emily Park', action: 'joined case', target: null, timestamp: '2026-03-01T09:00:00Z' },
];

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: CollaboratorRole }) {
  const config = {
    attorney: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: Shield },
    investigator: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Eye },
    researcher: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Search },
  };
  const c = config[role];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon size={10} />
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function AnnotationIcon({ type }: { type: AnnotationType }) {
  const icons = {
    highlight: <Edit3 size={14} className="text-yellow-500" />,
    note: <StickyNote size={14} className="text-blue-500" />,
    flag: <Flag size={14} className="text-red-500" />,
    question: <HelpCircle size={14} className="text-purple-500" />,
    important: <Star size={14} className="text-amber-500" />,
  };
  return icons[type];
}

function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sizeClasses} rounded-full bg-slate-200 flex items-center justify-center font-medium text-slate-600`}>
      {initials}
    </div>
  );
}

function TimeAgo({ timestamp }: { timestamp: string }) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  let text = 'just now';
  if (days > 0) text = `${days}d ago`;
  else if (hours > 0) text = `${hours}h ago`;
  else if (minutes > 0) text = `${minutes}m ago`;
  return <span className="text-xs text-slate-400">{text}</span>;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CollaborationPage() {
  const [activeTab, setActiveTab] = useState<TabId>('team');
  const [showInvite, setShowInvite] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>('t1');
  const [newReply, setNewReply] = useState('');

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }>; count?: number }[] = [
    { id: 'team', label: 'Team', icon: Users, count: TEAM.length },
    { id: 'comments', label: 'Comments', icon: MessageSquare, count: THREADS.filter((t) => !t.isResolved).length },
    { id: 'annotations', label: 'Annotations', icon: StickyNote, count: ANNOTATIONS.length },
    { id: 'activity', label: 'Activity', icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Collaboration</h2>
          <p className="text-sm text-slate-500 mt-1">Team members, annotations, and discussion threads</p>
        </div>
        {activeTab === 'team' && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <UserPlus size={14} />
            Invite Member
          </button>
        )}
        {activeTab === 'comments' && (
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={14} />
            New Thread
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon size={14} />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-white/20' : 'bg-slate-100'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          {/* Invite Form */}
          {showInvite && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Invite Team Member</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                  <input type="email" placeholder="colleague@lawfirm.com" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                    <option value="attorney">Attorney</option>
                    <option value="investigator">Investigator</option>
                    <option value="researcher">Researcher</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
                    Send Invite
                  </button>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Invited members will receive an email with a link to join this case. Attorney role has full access, Investigator can upload and annotate, Researcher has view and comment access.
              </div>
            </div>
          )}

          {/* Team Members */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Case Team ({TEAM.length} members)</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {TEAM.map((member) => (
                <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Avatar initials={member.avatar} />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{member.name}</div>
                      <div className="text-xs text-slate-500">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <RoleBadge role={member.role} />
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Last active</div>
                      <TimeAgo timestamp={member.lastActive} />
                    </div>
                    <button className="p-1 hover:bg-slate-100 rounded">
                      <MoreHorizontal size={14} className="text-slate-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Permissions Reference */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Role Permissions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-xs font-medium text-slate-500">Permission</th>
                    <th className="text-center py-2 text-xs font-medium text-indigo-600">Attorney</th>
                    <th className="text-center py-2 text-xs font-medium text-amber-600">Investigator</th>
                    <th className="text-center py-2 text-xs font-medium text-emerald-600">Researcher</th>
                  </tr>
                </thead>
                <tbody>
                  {['View evidence', 'Upload evidence', 'Create annotations', 'Post comments', 'Export packets', 'Share case', 'Manage team'].map((perm, i) => {
                    const atty = true;
                    const inv = i < 5;
                    const res = i < 4;
                    return (
                      <tr key={perm} className="border-b border-slate-50">
                        <td className="py-2 text-slate-700">{perm}</td>
                        <td className="py-2 text-center">{atty ? <CheckCircle size={14} className="inline text-indigo-500" /> : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 text-center">{inv ? <CheckCircle size={14} className="inline text-amber-500" /> : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 text-center">{res ? <CheckCircle size={14} className="inline text-emerald-500" /> : <span className="text-slate-300">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="space-y-4">
          {THREADS.map((thread) => (
            <div key={thread.id} className="bg-white rounded-xl border border-slate-200">
              <div
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedThread(expandedThread === thread.id ? null : thread.id)}
              >
                <div className="flex items-center gap-3">
                  {thread.isResolved ? (
                    <CheckCircle size={16} className="text-emerald-500" />
                  ) : (
                    <AlertCircle size={16} className="text-amber-500" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-slate-900">{thread.subject}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{thread.author}</span>
                      <RoleBadge role={thread.authorRole} />
                      {thread.evidence && (
                        <span className="text-xs text-slate-400">on {thread.evidence}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{thread.replyCount} replies</span>
                  <TimeAgo timestamp={thread.lastReply} />
                </div>
              </div>

              {expandedThread === thread.id && (
                <div className="border-t border-slate-100">
                  <div className="divide-y divide-slate-50">
                    {thread.replies.map((reply, i) => (
                      <div key={i} className="px-6 py-3 flex gap-3">
                        <Avatar initials={reply.author.split(' ').map((n) => n[0]).join('')} size="sm" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-900">{reply.author}</span>
                            <TimeAgo timestamp={reply.timestamp} />
                          </div>
                          <p className="text-sm text-slate-700 mt-1">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!thread.isResolved && (
                    <div className="px-6 py-3 border-t border-slate-100 flex gap-2">
                      <input
                        type="text"
                        value={newReply}
                        onChange={(e) => setNewReply(e.target.value)}
                        placeholder="Write a reply..."
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      />
                      <button className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
                        <Send size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Annotations Tab */}
      {activeTab === 'annotations' && (
        <div className="space-y-3">
          {ANNOTATIONS.map((ann) => (
            <div key={ann.id} className="bg-white rounded-xl border border-slate-200 px-6 py-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <AnnotationIcon type={ann.type} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-900">{ann.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span>{ann.author}</span>
                    <span className="text-slate-300">|</span>
                    <span>{ann.evidence}</span>
                    {ann.page !== null && <span>Page {ann.page}</span>}
                    {ann.timestamp !== null && <span>@ {ann.timestamp}</span>}
                    <span className="text-slate-300">|</span>
                    <TimeAgo timestamp={ann.createdAt} />
                  </div>
                </div>
                <button className="p-1 hover:bg-slate-100 rounded">
                  <Trash2 size={12} className="text-slate-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Case Activity</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {ACTIVITY.map((item) => (
              <div key={item.id} className="px-6 py-3 flex items-center gap-3">
                <Avatar initials={item.user.split(' ').map((n) => n[0]).join('')} size="sm" />
                <div className="flex-1">
                  <span className="text-sm">
                    <span className="font-medium text-slate-900">{item.user}</span>
                    {' '}
                    <span className="text-slate-500">{item.action}</span>
                    {item.target && (
                      <>
                        {' '}
                        <span className="text-slate-700 font-medium">{item.target}</span>
                      </>
                    )}
                  </span>
                </div>
                <TimeAgo timestamp={item.timestamp} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
