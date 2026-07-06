// ============================================
// Court Access — Staff Dashboard
// Operational control center for legal professionals
// ============================================

import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  FileText, Scale, AlertTriangle,
  Plus, Upload, BarChart3, Users, Clock, TrendingUp, Briefcase, Lightbulb
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { PageHeader } from '../../components/ui/page-header';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { SkeletonStatGrid } from '../../components/ui/skeleton';
import { IntelligenceGrid } from '../../components/intelligence/IntelligencePanel';
import { SPACING, STATUS_COLORS, TEXT_COLORS } from '../../constants/designTokens';
import { useAuthStore } from '../../stores/authStore';
import { fetchCases, fetchCaseEvidence, type ApiCase, type ApiEvidence } from '../../services/caseApi';

export function StaffDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [cases, setCases] = useState<ApiCase[]>([]);
  const [primaryCase, setPrimaryCase] = useState<ApiCase | null>(null);
  const [evidence, setEvidence] = useState<ApiEvidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const allCases = await fetchCases().catch(() => []);
        if (cancelled) return;
        setCases(allCases ?? []);
        const first = allCases?.[0] ?? null;
        setPrimaryCase(first);
        if (first) {
          const docs = await fetchCaseEvidence(first.caseId).catch(() => []);
          if (!cancelled) setEvidence(docs ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className={SPACING.container}>
        <SkeletonStatGrid count={5} />
      </div>
    );
  }

  if (!primaryCase) {
    return (
      <div className={`${SPACING.container} ${SPACING.stack}`}>
        <PageHeader
          title="Attorney Workspace"
          subtitle={`Welcome back, ${user?.name}`}
          overline="Dashboard"
        />
        <Card className="text-center py-12">
          <p className="text-slate-500 mb-6">No cases yet. Create your first case to begin building case intelligence.</p>
          <Button variant="navy" onClick={() => navigate('/cases')}>Go to Cases</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${SPACING.container} ${SPACING.stackLg}`}>
      <PageHeader
        title="Attorney Workspace"
        subtitle={`Welcome back, ${user?.name} — ${primaryCase.title ?? primaryCase.caseId}`}
        overline="Dashboard"
        action={<Button variant="navy" onClick={() => navigate(`/cases/${primaryCase.caseId}`)}>Open Case</Button>}
      />

      <IntelligenceGrid
        columns={4}
        panels={[
          { type: 'case_strength', value: cases.length, status: 'info' },
          { type: 'contradictions', value: 2, status: 'warning' },
          { type: 'evidence_gaps', value: 3, status: 'danger' },
          { type: 'authorities', value: 8, status: 'success' },
        ]}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          tile="blue"
          icon={<Briefcase size={20} />}
          value={cases.length}
          label="Active Cases"
          sublabel="Across your workspace"
          onClick={() => navigate('/cases?status=active')}
        />
        <StatCard
          tile="emerald"
          icon={<Plus size={20} />}
          value={cases.filter((c) => new Date(c.createdAt) > new Date(Date.now() - 7 * 86400000)).length}
          label="New This Week"
          sublabel="Recently opened"
          onClick={() => navigate('/cases?sort=newest')}
        />
        <StatCard
          tile="gold"
          icon={<AlertTriangle size={20} />}
          value={2}
          label="Action Required"
          sublabel="Needs your attention"
          onClick={() => navigate('/cases?filter=action-needed')}
        />
        <StatCard
          tile="violet"
          icon={<Lightbulb size={20} />}
          value={8}
          label="Intelligence Signals"
          sublabel="Review recommended"
          onClick={() => navigate(`/cases/${primaryCase.caseId}/charges`)}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Alerts & Action Queue */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
              <span className="text-xs text-slate-500">Sorted by urgency</span>
            </div>
            <div className="space-y-2">
              {[
                { type: 'high', icon: AlertTriangle, color: STATUS_COLORS.danger, label: 'Evidence dispute added — People v. Smith', time: '2 hours ago' },
                { type: 'high', icon: Lightbulb, color: STATUS_COLORS.warning, label: 'Motion recommendation signal: Motion to Suppress (HIGH)', time: '4 hours ago' },
                { type: 'medium', icon: Upload, color: STATUS_COLORS.info, label: 'New defendant upload — 3 documents pending review', time: '6 hours ago' },
                { type: 'medium', icon: Users, color: STATUS_COLORS.accent, label: 'Expert recommendation flagged: Forensic Toxicologist', time: '1 day ago' },
                { type: 'low', icon: Clock, color: STATUS_COLORS.neutral, label: 'Discovery deadline approaching — Case #2024-CF-001234', time: '2 days ago' },
              ].map((alert, i) => {
                const Icon = alert.icon;
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${alert.color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{alert.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{alert.time}</p>
                    </div>
                    {alert.type === 'high' && <Badge variant="danger" className="flex-shrink-0">Urgent</Badge>}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Recent Documents */}
          <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Recent Documents</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Document Name</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Filed Date</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Type</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">AI Status</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.slice(0, 3).map((doc) => (
                    <tr
                      key={doc.evidenceId}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                      onClick={() => navigate(`/cases/${primaryCase.caseId}/evidence`)}
                    >
                      <td className="py-3 px-2 font-medium text-slate-200">{doc.fileName}</td>
                      <td className="py-3 px-2 text-slate-400">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                      <td className="py-3 px-2 text-slate-400">{doc.evidenceType}</td>
                      <td className="py-3 px-2">
                        <Badge
                          variant={
                            doc.processingStatus === 'analyzed'
                              ? 'success'
                              : doc.processingStatus === 'processing'
                                ? 'info'
                                : doc.processingStatus === 'failed'
                                  ? 'danger'
                                  : 'default'
                          }
                        >
                          {doc.processingStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {evidence.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500 text-sm">
                        No documents uploaded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Case Strength */}
          <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Case Strength</h2>
            <div className="flex flex-col items-center text-center py-2">
              <div className="relative w-28 h-28 mb-3">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#C8963E"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42 * 0.94} ${2 * Math.PI * 42}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">94%</span>
                  <span className="text-[10px] font-semibold text-gold-light uppercase tracking-wide">High</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">Strong likelihood of favorable outcome</p>
              <button
                onClick={() => navigate(`/cases/${primaryCase.caseId}/charges`)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gold/10 text-gold-light rounded-lg text-sm font-medium hover:bg-gold/20 transition-colors w-full justify-center border border-gold/20"
              >
                <TrendingUp size={16} />
                View Full Analysis
              </button>
            </div>
          </Card>

          {/* Case Intelligence Overview */}
          <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Case Intelligence</h2>
            <div className="space-y-1">
              {[
                { label: 'Priority cases', value: '1', color: TEXT_COLORS.danger },
                { label: 'Prosecution Vulnerabilities', value: '3', color: TEXT_COLORS.warning },
                { label: 'Sentencing Exposure Flags', value: '2', color: TEXT_COLORS.orange },
                { label: 'Procedural deadline warnings', value: '1', color: TEXT_COLORS.info },
              ].map((insight, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                  <span className="text-sm text-slate-300">{insight.label}</span>
                  <span className={`text-sm font-bold ${insight.color}`}>{insight.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Upcoming Schedule */}
          <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Upcoming Schedule</h2>
            <div className="space-y-2">
              {[
                { label: 'Hearing — People v. Smith', date: 'Feb 15, 2024', icon: Scale },
                { label: 'Filing Deadline — Motion to Suppress', date: 'Feb 20, 2024', icon: Clock },
                { label: 'Discovery Deadline', date: 'Mar 1, 2024', icon: FileText },
              ].map((event, i) => {
                const Icon = event.icon;
                return (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ca-icon-blue text-blue-300">
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{event.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{event.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'New Case', icon: Plus, action: () => navigate('/cases') },
                { label: 'Upload Evidence', icon: Upload, action: () => navigate(`/cases/${primaryCase.caseId}/evidence`) },
                { label: 'Charge Analysis', icon: BarChart3, action: () => navigate(`/cases/${primaryCase.caseId}/charges`) },
                { label: 'Expert Review', icon: Users, action: () => navigate(`/cases/${primaryCase.caseId}/experts`) },
              ].map((action, i) => {
                const Icon = action.icon;
                return (
                  <button
                    key={i}
                    onClick={action.action}
                    className="flex items-center gap-2 p-3 rounded-lg border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/5 hover:border-gold/30 hover:text-white transition-colors"
                  >
                    <Icon size={16} className="text-gold-light/80" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
