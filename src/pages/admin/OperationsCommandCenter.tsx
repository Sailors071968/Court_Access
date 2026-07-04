// ============================================================================
// Program 21 — Production Operations Command Center
// Route: /admin/operations
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, AlertTriangle, CheckCircle, RefreshCw, Shield, Server,
  Database, Mail, CreditCard, GitBranch, Archive, Bell,
} from 'lucide-react';
import { Card } from '../../components/common/Card';

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

function statusColor(status: string): string {
  if (status === 'healthy' || status === 'PASS' || status === 'READY') return 'text-green-700 bg-green-50';
  if (status === 'degraded' || status === 'PARTIAL' || status === 'degraded') return 'text-yellow-700 bg-yellow-50';
  if (status === 'unhealthy' || status === 'FAIL' || status === 'NOT_READY') return 'text-red-700 bg-red-50';
  return 'text-gray-600 bg-gray-50';
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(status)}`}>
      {status === 'healthy' || status === 'PASS' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
      {status}
    </span>
  );
}

export function OperationsCommandCenter() {
  const [dashboard, setDashboard] = useState<OperationsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400" size={24} />
        <span className="ml-3 text-gray-500">Loading operations dashboard...</span>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">{error}</p>
        <button onClick={fetchDashboard} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Retry</button>
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
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={28} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Operations</h1>
            <p className="text-sm text-gray-500">
              Last updated: {new Date(dashboard.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={dashboard.overallStatus} />
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Production Gates */}
      <Card>
        <h2 className="text-lg font-semibold mb-3">Production Gates</h2>
        <div className="flex items-center gap-4 mb-4">
          <StatusBadge status={dashboard.productionGates.overallResult} />
          <span className="text-sm text-gray-600">
            {dashboard.productionGates.passCount} PASS / {dashboard.productionGates.partialCount} PARTIAL / {dashboard.productionGates.failCount} FAIL
          </span>
          {dashboard.productionGates.deploymentBlocked && (
            <span className="text-sm font-medium text-red-600">Deployment Blocked</span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {dashboard.productionGates.gates.map((g) => (
            <div key={g.id} className="p-2 bg-gray-50 rounded text-xs">
              <span className="font-mono text-gray-500">{g.id}</span>
              <p className="font-medium truncate">{g.name}</p>
              <StatusBadge status={g.result} />
            </div>
          ))}
        </div>
      </Card>

      {/* Alerts */}
      {dashboard.alerts.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Bell size={18} className="text-orange-500" />
            <h2 className="text-lg font-semibold">Active Alerts ({dashboard.alerts.length})</h2>
          </div>
          <div className="space-y-2">
            {dashboard.alerts.map((a) => (
              <div key={a.id} className={`p-3 rounded-lg text-sm ${a.severity === 'critical' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <span className="font-medium uppercase text-xs">{a.severity}</span>
                <span className="mx-2 text-gray-400">|</span>
                <span className="text-gray-600">{a.category}</span>
                <p className="mt-1 text-gray-900">{a.message}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Component Health Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {components.map(({ label, icon: Icon, health }) => (
          <Card key={label} padding="sm">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </div>
            <StatusBadge status={health.status} />
            {health.message && <p className="mt-2 text-xs text-gray-500 truncate">{health.message}</p>}
          </Card>
        ))}
      </div>

      {/* Observability Metrics */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold mb-4">Observability</h2>
          <div className="space-y-3">
            {[
              ['Production Gates', `${dashboard.observability.productionGatesCoverage}%`],
              ['Legislative Coverage', `${dashboard.observability.legislativeCoveragePercent}%`],
              ['Attorney Workflows', `${dashboard.observability.attorneyWorkflowCoveragePercent}%`],
              ['System Availability', dashboard.observability.systemAvailability],
              ['Billing Availability', dashboard.observability.billingAvailability],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold mb-4">Performance</h2>
          <div className="space-y-3">
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Error Rate</span>
              <span className="text-sm font-medium">{(dashboard.performance.errorRate * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Response Time (p95)</span>
              <span className="text-sm font-medium">{dashboard.performance.responseTimeP95Ms}ms</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
