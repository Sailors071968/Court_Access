// ============================================================================
// CourtAccess — Operations Command Center (Program 23)
// Premium dark operational nerve center on the unified design system.
// Route: /admin/operations
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Server, Database, Mail, CreditCard, GitBranch, Archive, Bell, Activity } from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { StatCard } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { SearchBar } from '../../components/ui/input';
import { ProgressBar } from '../../components/ui/progress';
import { Icon } from '../../components/icons/registry';
import { SPACING } from '../../constants/designTokens';

interface ComponentHealth {
  status: string;
  message?: string;
  latencyMs?: number;
}

interface OperationsDashboard {
  generatedAt: string;
  overallStatus: string;
  productionGates: {
    overallResult: string;
    passCount: number;
    partialCount: number;
    failCount: number;
    deploymentBlocked: boolean;
    gates: Array<{ id: string; name: string; result: string }>;
  };
  systemHealth: ComponentHealth;
  apiHealth: ComponentHealth;
  database: ComponentHealth;
  redis: ComponentHealth;
  queues: ComponentHealth & { queues?: Record<string, { waiting: number; active: number; failed: number }> };
  stripeHealth: ComponentHealth;
  emailHealth: ComponentHealth;
  legislativePipeline: ComponentHealth;
  knowledgeGraph: ComponentHealth;
  repositoryIntegrity: ComponentHealth;
  alerts: Array<{ id: string; severity: string; category: string; message: string }>;
  observability: {
    productionGatesCoverage: number;
    legislativeCoveragePercent: number;
    attorneyWorkflowCoveragePercent: number;
    systemAvailability: string;
    billingAvailability: string;
  };
  performance: { errorRate: number; responseTimeP95Ms: number };
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type HealthTone = 'success' | 'warning' | 'danger' | 'default';

function healthTone(status: string): HealthTone {
  if (['healthy', 'PASS', 'READY', 'ok'].includes(status)) return 'success';
  if (['degraded', 'PARTIAL'].includes(status)) return 'warning';
  if (['unhealthy', 'FAIL', 'NOT_READY'].includes(status)) return 'danger';
  return 'default';
}

function HealthBadge({ status }: { status: string }) {
  const tone = healthTone(status);
  const variant = tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : tone === 'danger' ? 'danger' : 'default';
  return <Badge variant={variant}>{status}</Badge>;
}

export function OperationsCommandCenter() {
  const [dashboard, setDashboard] = useState<OperationsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/operations/dashboard', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDashboard(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load operations dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !dashboard) return <Spinner label="Loading operations dashboard…" />;

  if (error && !dashboard) {
    return (
      <div className={SPACING.container}>
        <Card>
          <EmptyState
            icon={<Icon name="repositoryIntegrity" size={24} />}
            title="Unable to load operations dashboard"
            description={error}
            action={<Button variant="primary" onClick={fetchDashboard}>Retry</Button>}
          />
        </Card>
      </div>
    );
  }

  if (!dashboard) return null;

  const components = [
    { label: 'System', icon: Server, health: dashboard.systemHealth },
    { label: 'API', icon: Activity, health: dashboard.apiHealth },
    { label: 'Database', icon: Database, health: dashboard.database },
    { label: 'Redis', icon: Server, health: dashboard.redis },
    { label: 'Queues', icon: Server, health: dashboard.queues },
    { label: 'Stripe', icon: CreditCard, health: dashboard.stripeHealth },
    { label: 'Email', icon: Mail, health: dashboard.emailHealth },
    { label: 'Legislative', icon: GitBranch, health: dashboard.legislativePipeline },
    { label: 'Knowledge Graph', icon: GitBranch, health: dashboard.knowledgeGraph },
    { label: 'Repositories', icon: Archive, health: dashboard.repositoryIntegrity },
  ].filter((c) => c.label.toLowerCase().includes(filter.toLowerCase()));

  const queueEntries = Object.entries(dashboard.queues.queues ?? {});

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(dashboard, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`${SPACING.container} space-y-6`}>
      <PageHeader
        title="Operations Command Center"
        overline="Production"
        subtitle={`Last updated ${new Date(dashboard.generatedAt).toLocaleString()}`}
        action={
          <div className="flex items-center gap-3">
            <HealthBadge status={dashboard.overallStatus} />
            <Button variant="secondary" onClick={exportJson}>Export</Button>
            <Button variant="primary" onClick={fetchDashboard} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </div>
        }
      />

      {/* Headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard tile="emerald" icon={<Icon name="repositoryIntegrity" size={20} />} value={dashboard.observability.systemAvailability} label="System Availability" />
        <StatCard tile="blue" icon={<Activity size={20} />} value={`${dashboard.performance.responseTimeP95Ms}ms`} label="Response p95" />
        <StatCard tile="gold" icon={<CreditCard size={20} />} value={dashboard.observability.billingAvailability} label="Billing Availability" />
        <StatCard
          tile="violet"
          icon={<Bell size={20} />}
          value={dashboard.alerts.length}
          label="Active Alerts"
          highlight={dashboard.alerts.length > 0}
        />
      </div>

      {/* Production Gates */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-white">Production Gates</h2>
          <div className="flex items-center gap-3">
            <HealthBadge status={dashboard.productionGates.overallResult} />
            <span className="text-sm text-slate-400">
              {dashboard.productionGates.passCount} PASS / {dashboard.productionGates.partialCount} PARTIAL / {dashboard.productionGates.failCount} FAIL
            </span>
            {dashboard.productionGates.deploymentBlocked && <Badge variant="danger">Deployment Blocked</Badge>}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {dashboard.productionGates.gates.map((g) => (
            <div key={g.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <span className="font-mono text-[10px] text-slate-500">{g.id}</span>
              <p className="text-xs font-medium text-slate-200 truncate">{g.name}</p>
              <div className="mt-1.5"><HealthBadge status={g.result} /></div>
            </div>
          ))}
        </div>
      </Card>

      {/* Alerts */}
      {dashboard.alerts.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-gold-light" />
            <h2 className="text-lg font-semibold text-white">Active Alerts ({dashboard.alerts.length})</h2>
          </div>
          <div className="space-y-2">
            {dashboard.alerts.map((a) => (
              <div
                key={a.id}
                className={`p-3 rounded-lg border ${a.severity === 'critical' ? 'bg-red-500/10 border-red-500/20' : 'bg-gold/10 border-gold/20'}`}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={a.severity === 'critical' ? 'danger' : 'warning'}>{a.severity}</Badge>
                  <span className="text-xs text-slate-400">{a.category}</span>
                </div>
                <p className="mt-1.5 text-sm text-slate-200">{a.message}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Component health with search/filter */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-white">Component Health</h2>
          <SearchBar placeholder="Filter components…" value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {components.map(({ label, icon: CompIcon, health }) => (
            <div key={label} className="ca-panel p-4">
              <div className="flex items-center gap-2 mb-2">
                <CompIcon size={16} className="text-gold-light" />
                <span className="text-sm font-medium text-slate-200">{label}</span>
              </div>
              <HealthBadge status={health.status} />
              {health.latencyMs !== undefined && <p className="mt-2 text-xs text-slate-500">{health.latencyMs}ms latency</p>}
              {health.message && <p className="mt-1 text-xs text-slate-500 truncate">{health.message}</p>}
            </div>
          ))}
          {components.length === 0 && <p className="text-sm text-slate-500 col-span-full py-4 text-center">No components match “{filter}”.</p>}
        </div>
      </Card>

      {/* Queue depths */}
      {queueEntries.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Queue Depths &amp; Background Jobs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {queueEntries.map(([name, q]) => (
              <div key={name} className="ca-panel p-4">
                <p className="text-sm font-medium text-white mb-3 capitalize">{name.replace(/[-_]/g, ' ')}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-400 tabular-nums">{q.waiting}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Waiting</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-400 tabular-nums">{q.active}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Active</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-400 tabular-nums">{q.failed}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Failed</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Observability + Performance */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Observability</h2>
          <div className="space-y-4">
            <ProgressBar value={dashboard.observability.productionGatesCoverage} tone="gold" label="Production Gates Coverage" showValue />
            <ProgressBar value={dashboard.observability.legislativeCoveragePercent} tone="blue" label="Legislative Coverage" showValue />
            <ProgressBar value={dashboard.observability.attorneyWorkflowCoveragePercent} tone="violet" label="Attorney Workflows" showValue />
            <div className="flex justify-between p-2.5 rounded-lg bg-white/[0.03]">
              <span className="text-sm text-slate-400">System Availability</span>
              <span className="text-sm font-medium text-white">{dashboard.observability.systemAvailability}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-white/[0.03]">
              <span className="text-sm text-slate-400">Billing Availability</span>
              <span className="text-sm font-medium text-white">{dashboard.observability.billingAvailability}</span>
            </div>
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Performance</h2>
          <div className="space-y-3">
            <div className="flex justify-between p-2.5 rounded-lg bg-white/[0.03]">
              <span className="text-sm text-slate-400">Error Rate</span>
              <span className="text-sm font-medium text-white tabular-nums">{(dashboard.performance.errorRate * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-white/[0.03]">
              <span className="text-sm text-slate-400">Response Time (p95)</span>
              <span className="text-sm font-medium text-white tabular-nums">{dashboard.performance.responseTimeP95Ms}ms</span>
            </div>
            <ProgressBar
              value={Math.max(0, 100 - dashboard.performance.errorRate * 100 * 10)}
              tone={dashboard.performance.errorRate > 0.02 ? 'red' : 'emerald'}
              label="Error budget remaining"
              showValue
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
