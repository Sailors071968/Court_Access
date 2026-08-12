// Operational Health — NIIS V1.0 heartbeat (not CPU/RAM/Redis/PM2).

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import { intelligenceApi, type OperationalHealthBoard } from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, ErrorNotice, Loading, PageHeader, Panel,
} from './shared';

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number | null;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const display = value === null || value === undefined ? 'UNKNOWN' : value;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        {tone && display !== 'UNKNOWN' ? <Badge tone={tone}>{String(display)}</Badge> : null}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{display}</p>
    </div>
  );
}

function certTone(c: string): 'good' | 'warn' | 'bad' | 'neutral' {
  if (c === 'PASS') return 'good';
  if (c === 'FAIL' || c === 'BLOCKED') return 'bad';
  if (c === 'PROVISIONAL') return 'warn';
  return 'neutral';
}

export function OperationalHealth() {
  const [board, setBoard] = useState<OperationalHealthBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBoard(await intelligenceApi.operationalHealth('sacramento'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operational health could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading operational health" />;
  if (error) return <ErrorNotice message={error} onRetry={() => void load()} />;
  if (!board) return null;

  const pct = (n: number | null) =>
    n == null ? 'UNKNOWN' : `${(n * 100).toFixed(0)}%`;

  return (
    <div className="mx-auto max-w-[72rem] space-y-5" data-testid="operational-health">
      <PageHeader
        title="Operational Health"
        subtitle={`${board.facility} · ${board.opsDate} · heartbeat (not infrastructure)`}
        actions={
          <>
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Link to="/admin/intelligence/investigator-workspace">
              <Button variant="primary">Investigator Workspace</Button>
            </Link>
          </>
        }
      />

      <p className="border-l-4 border-gray-900 pl-3 text-sm font-medium text-gray-800">
        {board.northStar}
      </p>

      {board.automaticClassification ? (
        <Panel title="Automatic Classification Rate" description={board.automaticClassification.summary}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric
              label="Today"
              value={
                board.automaticClassification.ratePercent == null
                  ? null
                  : `${board.automaticClassification.ratePercent}%`
              }
              tone="good"
            />
            <Metric label="Automatically Certified" value={board.automaticClassification.automaticallyCertified} />
            <Metric label="Human Review" value={board.automaticClassification.humanReview} />
            <Metric label="Corrected" value={board.automaticClassification.corrected} />
          </div>
        </Panel>
      ) : null}

      {board.dailyGoals ? (
        <Panel title="Daily operational goals" description="Seven answers at a glance.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <Metric label="PDF processed" value={board.dailyGoals.pdfProcessed ? 'Yes' : 'No'} />
            <Metric label="Extracted" value={board.dailyGoals.extracted} />
            <Metric label="New" value={board.dailyGoals.newInmates} />
            <Metric label="Require review" value={board.dailyGoals.requireReview} />
            <Metric label="Certified" value={board.dailyGoals.reportCertified ? 'Yes' : 'No'} />
            <Metric
              label="Processing time"
              value={
                board.dailyGoals.processingTimeMs == null
                  ? null
                  : `${(board.dailyGoals.processingTimeMs / 1000).toFixed(0)}s`
              }
            />
            <Metric label="Critical alerts" value={board.dailyGoals.criticalAlerts} />
          </div>
        </Panel>
      ) : null}

      {board.featureWork ? (
        <p className={`rounded border px-3 py-2 text-sm ${board.featureWork.allowed ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
          {board.featureWork.message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Today's Roster" value={board.todayRosterCount} />
        <Metric label="Yesterday" value={board.yesterdayRosterCount} />
        <Metric label="New" value={board.newCount} />
        <Metric label="Existing" value={board.existingCount} />
        <Metric label="Returning" value={board.returningCount} />
        <Metric label="Review" value={board.reviewCount} />
        <Metric
          label="Reconciliation"
          value={board.reconciliation}
          tone={board.reconciliation === 'PASS' ? 'good' : board.reconciliation === 'FAIL' ? 'bad' : 'warn'}
        />
        <Metric label="Precision" value={pct(board.precision)} />
        <Metric label="Recall" value={pct(board.recall)} />
        <Metric
          label="Certification"
          value={board.certification}
          tone={certTone(board.certification)}
        />
        <Metric
          label="Processing Time"
          value={
            board.processingTimeMs == null
              ? null
              : `${(board.processingTimeMs / 1000).toFixed(0)}s`
          }
        />
        <Metric label="Potential Clients" value={board.potentialClients} />
      </div>

      <Panel
        title="Silent failures"
        description={
          board.silentFailureCount === 0
            ? 'None detected by self-verification.'
            : `${board.silentFailureCount} fail/UNKNOWN check(s) — do not bury these.`
        }
      >
        {(board.alerts?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500">No operational alerts.</p>
        ) : (
          <ul className="space-y-2">
            {board.alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-2 text-sm">
                <Badge tone={a.severity === 'critical' ? 'bad' : a.severity === 'warning' ? 'warn' : 'info'}>
                  {a.severity}
                </Badge>
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Readiness" description="Sustained consecutive PASS certifications.">
        <p className="text-sm text-gray-800">
          Streak {board.readiness.consecutivePassStreak}/{board.readiness.required}
          {board.readiness.productionReady ? (
            <Badge tone="good">Production ready</Badge>
          ) : (
            <Badge tone="warn">Not yet</Badge>
          )}
        </p>
        {board.potentialClientsMissed != null && board.potentialClientsMissed > 0 ? (
          <p className="mt-2 text-sm text-red-700">
            Potential clients missed: {board.potentialClientsMissed}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
