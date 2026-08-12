// Morning Operations Dashboard — the daily command center.
//
// Answers seven questions in under ten seconds so an operator knows whether
// today's New Inmate Report is ready to act on. Detection semantics live
// elsewhere; this screen only surfaces operational state.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, Clock, Printer, RefreshCw, Upload, XCircle,
} from 'lucide-react';

import {
  intelligenceApi,
  type MorningOperationsBoard,
} from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, ErrorNotice, Loading, PageHeader, Panel,
} from './shared';

export function MorningOperationsDashboard() {
  const [board, setBoard] = useState<MorningOperationsBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const next = await intelligenceApi.morningBoard('sacramento');
      setBoard(next);
      setRefreshedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Morning board could not be loaded.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  // Poll while comparison is incomplete so upload → process → ready stays live.
  useEffect(() => {
    if (!board) return;
    const q = board.questions;
    const inFlight = q.todaysPdfUploaded.answer && !q.comparisonCompleted.answer;
    if (!inFlight) return;
    const timer = window.setTimeout(() => void load(false), 4000);
    return () => window.clearTimeout(timer);
  }, [board, load]);

  if (loading) return <Loading label="Loading morning operations" />;
  if (error) return <ErrorNotice message={error} onRetry={() => void load(true)} />;
  if (!board) return null;

  const { questions: q, readiness, links } = board;
  const printHref = q.canPrintReport.reportId
    ? `${links.reports}?reportId=${encodeURIComponent(q.canPrintReport.reportId)}`
    : links.reports;

  return (
    <div className="mx-auto max-w-[72rem] space-y-5" data-testid="morning-ops-dashboard">
      <PageHeader
        title="Morning Operations"
        subtitle={
          refreshedAt
            ? `Sacramento · ${board.opsDate} · refreshed ${refreshedAt.toLocaleTimeString()}`
            : `Sacramento · ${board.opsDate}`
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => void load(true)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Link to={links.upload}>
              <Button variant="primary" testId="morning-upload">
                <Upload className="h-3.5 w-3.5" /> Upload PDFs
              </Button>
            </Link>
            {q.canPrintReport.answer ? (
              <Link to={printHref}>
                <Button variant="primary" testId="morning-print">
                  <Printer className="h-3.5 w-3.5" /> Print report
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" disabled testId="morning-print">
                <Printer className="h-3.5 w-3.5" /> Print report
              </Button>
            )}
          </>
        }
      />

      <p className="text-sm font-medium text-gray-800 border-l-4 border-gray-900 pl-3" data-testid="north-star">
        {board.northStar
          ?? 'Every morning NIIS must tell the truth about who is newly booked into the Sacramento County Jail.'}
      </p>
      <p className="text-xs text-gray-500" data-testid="operational-lock">
        Architecture COMPLETE · V1.0 FROZEN · Success = recall / precision / reconciliation / zero silent failures · operator mode
      </p>

      <Headline board={board} />

      {/* Reduce Human Review — primary trust metric */}
      {board.automaticClassification ? (
        <Panel
          title="Automatic Classification Rate"
          description="How close NIIS is to a trusted operational assistant. Goal: shrink unnecessary review without sacrificing correctness."
        >
          <div className="grid gap-3 sm:grid-cols-4" data-testid="auto-classification-rate">
            <div className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-3 text-white sm:col-span-1">
              <p className="text-xs uppercase tracking-wide text-gray-300">Today</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {board.automaticClassification.ratePercent == null
                  ? 'UNKNOWN'
                  : `${board.automaticClassification.ratePercent}%`}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Automatically Certified</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                {board.automaticClassification.automaticallyCertified.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Human Review</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                {board.automaticClassification.humanReview.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Corrected</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                {board.automaticClassification.corrected.toLocaleString()}
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      {/* Seven daily operational goals at a glance */}
      {board.dailyGoals ? (
        <Panel title="Daily operational goals" description="Answer these seven immediately — then begin business.">
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm" data-testid="daily-goals">
            <Goal ok={board.dailyGoals.pdfProcessed} label="PDF processed" value={board.dailyGoals.pdfProcessed ? 'Yes' : 'No'} />
            <Goal ok={board.dailyGoals.extracted != null} label="Extracted" value={board.dailyGoals.extracted ?? 'UNKNOWN'} />
            <Goal ok={board.dailyGoals.newInmates != null} label="New" value={board.dailyGoals.newInmates ?? 'UNKNOWN'} />
            <Goal
              ok={(board.dailyGoals.requireReview ?? 0) === 0}
              label="Require review"
              value={board.dailyGoals.requireReview ?? 'UNKNOWN'}
              warn={(board.dailyGoals.requireReview ?? 0) > 0}
            />
            <Goal ok={board.dailyGoals.reportCertified} label="Report certified" value={board.dailyGoals.reportCertified ? 'Yes' : 'No'} />
            <Goal
              ok={board.dailyGoals.processingTimeMs != null}
              label="Processing time"
              value={
                board.dailyGoals.processingTimeMs == null
                  ? 'UNKNOWN'
                  : `${(board.dailyGoals.processingTimeMs / 1000).toFixed(0)}s`
              }
            />
            <Goal
              ok={board.dailyGoals.criticalAlerts === 0}
              label="Critical alerts"
              value={board.dailyGoals.criticalAlerts}
              warn={board.dailyGoals.criticalAlerts > 0}
            />
            <li className="rounded border border-gray-200 px-3 py-2">
              <Link
                to={links.investigatorWorkspace ?? '/admin/intelligence/investigator-workspace'}
                className="font-medium text-blue-700 underline"
              >
                Open Investigator Workspace →
              </Link>
            </li>
          </ol>
        </Panel>
      ) : null}

      {board.compareAssistant?.leastConfident?.length ? (
        <Panel
          title="Manual Compare Assistant"
          description={board.compareAssistant.message}
        >
          <ul className="space-y-1.5 text-sm" data-testid="compare-assistant">
            {board.compareAssistant.leastConfident.map((c, i) => (
              <li key={c.key} className="flex flex-wrap items-center gap-2">
                <Badge tone="warn">#{i + 1}</Badge>
                <span className="font-medium text-gray-900">{c.name}</span>
                <Badge tone="info">{c.classification}</Badge>
                <span className="text-xs text-gray-500">uncertainty {c.uncertainty}</span>
              </li>
            ))}
          </ul>
          <Link
            to={links.investigatorWorkspace ?? '/admin/intelligence/investigator-workspace'}
            className="mt-3 inline-block text-sm font-medium text-blue-700 underline"
          >
            Review these first in Investigator Workspace
          </Link>
        </Panel>
      ) : null}

      {(board.alerts?.length ?? 0) > 0 ? (
        <Panel
          title="Conditions that could change today's report"
          description="Never buried in logs. Critical items require action before trusting the report. Human review is a feature — not a silent failure."
        >
          <ul className="space-y-2" data-testid="morning-alerts">
            {board.alerts!.map((a) => (
              <li
                key={a.id}
                className={
                  a.severity === 'critical'
                    ? 'rounded border border-red-300 bg-red-50 px-3 py-2 text-sm'
                    : a.severity === 'warning'
                      ? 'rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm'
                      : 'rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm'
                }
              >
                <div className="flex flex-wrap items-start gap-2">
                  <Badge
                    tone={a.severity === 'critical' ? 'bad' : a.severity === 'warning' ? 'warn' : 'info'}
                  >
                    {a.severity}
                  </Badge>
                  <span className="flex-1 text-gray-900">{a.message}</span>
                  {a.href ? (
                    <Link to={a.href} className="text-xs font-medium text-blue-700 underline">
                      Open
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {board.featureWork ? (
        <p
          className={`rounded border px-3 py-2 text-sm ${
            board.featureWork.allowed
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
          data-testid="feature-work-gate"
        >
          {board.featureWork.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2" data-testid="reliability-streaks">
        <ReliabilityMetric
          label="Days Since Last Missed New Inmate"
          value={board.reliability?.daysSinceLastMissedNew ?? 'UNKNOWN'}
          hint={
            board.reliability?.lastMissedDate && board.reliability.lastMissedDate !== 'UNKNOWN'
              ? `Last miss ${board.reliability.lastMissedDate}`
              : board.reliability?.evidence ?? 'Evidence-governed streak'
          }
        />
        <ReliabilityMetric
          label="Days Since Last False New Inmate"
          value={board.reliability?.daysSinceLastFalseNew ?? 'UNKNOWN'}
          hint={
            board.reliability?.lastFalseNewDate && board.reliability.lastFalseNewDate !== 'UNKNOWN'
              ? `Last false new ${board.reliability.lastFalseNewDate}`
              : board.reliability?.evidence ?? 'Evidence-governed streak'
          }
        />
      </div>

      {board.selfVerification ? (
        <Panel
          title="Self-verification"
          description={
            board.selfVerification.provisional
              ? 'Provisional — fail or UNKNOWN checks present. Not silently certified.'
              : 'All self-checks passed.'
          }
        >
          <ul className="space-y-1.5 text-sm">
            {board.selfVerification.checks.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start gap-2">
                <Badge
                  tone={c.verdict === 'pass' ? 'good' : c.verdict === 'fail' ? 'bad' : 'warn'}
                >
                  {c.verdict}
                </Badge>
                <span className="font-medium text-gray-900">{c.question}</span>
                <span className="text-xs text-gray-500">{c.detail}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel
        title="Today's checklist"
        description="Seven answers for the New Inmate Report cycle."
      >
        <ol className="divide-y divide-gray-100">
          <QuestionRow
            n={1}
            question="Was today's PDF uploaded?"
            ok={q.todaysPdfUploaded.answer}
            value={q.todaysPdfUploaded.answer ? 'Yes' : 'No'}
            detail={q.todaysPdfUploaded.detail}
            action={!q.todaysPdfUploaded.answer ? { to: links.upload, label: 'Upload today' } : undefined}
          />
          <QuestionRow
            n={2}
            question="Has yesterday's roster been identified?"
            ok={q.yesterdaysRosterIdentified.answer}
            value={q.yesterdaysRosterIdentified.answer ? 'Yes' : 'No'}
            detail={q.yesterdaysRosterIdentified.detail}
            action={!q.yesterdaysRosterIdentified.answer ? { to: links.upload, label: 'Upload yesterday' } : undefined}
          />
          <QuestionRow
            n={3}
            question="Has comparison completed?"
            ok={q.comparisonCompleted.answer}
            value={q.comparisonCompleted.answer ? 'Yes' : 'No'}
            detail={q.comparisonCompleted.detail}
          />
          <QuestionRow
            n={4}
            question="How many new inmates were found?"
            ok={q.comparisonCompleted.answer}
            value={String(q.newInmatesFound.answer)}
            detail={q.newInmatesFound.detail}
            action={q.comparisonCompleted.answer ? { to: links.newInmates, label: 'Open list' } : undefined}
            emphasize
          />
          <QuestionRow
            n={5}
            question="How many require manual review?"
            ok={q.requireManualReview.answer === 0}
            value={String(q.requireManualReview.answer)}
            detail={q.requireManualReview.detail}
            warn={q.requireManualReview.answer > 0}
            action={q.requireManualReview.answer > 0 ? { to: links.review, label: 'Review queue' } : undefined}
          />
          <QuestionRow
            n={6}
            question="Is today's report certified or provisional?"
            ok={q.reportCertification.answer === 'certified'}
            warn={q.reportCertification.answer === 'provisional' || q.reportCertification.answer === 'failed'}
            value={labelCertification(q.reportCertification.answer)}
            detail={q.reportCertification.detail}
          />
          <QuestionRow
            n={7}
            question="Can I print the report now?"
            ok={q.canPrintReport.answer}
            value={q.canPrintReport.answer ? 'Yes' : 'Not yet'}
            detail={q.canPrintReport.detail}
            action={q.canPrintReport.answer ? { to: printHref, label: 'Print' } : undefined}
          />
        </ol>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          label="Certification streak"
          value={`${readiness.consecutivePassStreak} / ${readiness.required}`}
          hint={
            readiness.productionReady
              ? 'Production-ready streak met'
              : `${Math.max(0, readiness.required - readiness.consecutivePassStreak)} consecutive PASS days remaining`
          }
          tone={readiness.productionReady ? 'good' : 'neutral'}
        />
        <StatusCard
          label="Open Learning Queue defects"
          value={String(board.openLearningQueueItems)}
          hint="Every discrepancy stays open until reproduced"
          tone={board.openLearningQueueItems > 0 ? 'warn' : 'good'}
          to={links.learningQueue}
        />
        <StatusCard
          label="Prior roster date"
          value={board.priorDate}
          hint="Baseline for today's new-inmate detection"
          tone="neutral"
        />
        <StatusCard
          label="Daily Difference Viewer"
          value={q.comparisonCompleted.answer ? 'Open' : 'Waiting'}
          hint="Side-by-side prior vs today with why + evidence"
          tone={q.comparisonCompleted.answer ? 'good' : 'neutral'}
          to={links.dailyDifference ?? '/admin/intelligence/daily-difference'}
        />
        <StatusCard
          label="Investigator Workspace"
          value={q.comparisonCompleted.answer ? 'Ready' : 'Waiting'}
          hint="One-click confirm / defect marks — feeds the corpus"
          tone={q.comparisonCompleted.answer ? 'good' : 'neutral'}
          to={links.investigatorWorkspace ?? '/admin/intelligence/investigator-workspace'}
        />
        <StatusCard
          label="Operational Health"
          value="Heartbeat"
          hint="Roster counts, reconciliation, precision/recall, certification"
          tone="neutral"
          to={links.operationalHealth ?? '/admin/intelligence/operational-health'}
        />
      </div>

      <p className="text-xs text-gray-500">
        Need import health, parser warnings, or batch comparison detail?{' '}
        <Link to="/admin/intelligence/console" className="font-medium text-blue-600 hover:underline">
          Open full operations console
        </Link>
        .
      </p>
    </div>
  );
}

function Headline({ board }: { board: MorningOperationsBoard }) {
  const tones = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    attention: 'border-amber-200 bg-amber-50 text-amber-950',
    action_required: 'border-red-200 bg-red-50 text-red-950',
  } as const;
  const Icon = board.posture === 'ok' ? CheckCircle2 : board.posture === 'attention' ? Clock : XCircle;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${tones[board.posture]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">What to do next</p>
        <p className="mt-0.5 text-base font-semibold leading-snug">{board.headline}</p>
      </div>
    </div>
  );
}

function QuestionRow({
  n,
  question,
  value,
  detail,
  ok,
  warn,
  emphasize,
  action,
}: {
  n: number;
  question: string;
  value: string;
  detail: string;
  ok: boolean;
  warn?: boolean;
  emphasize?: boolean;
  action?: { to: string; label: string };
}) {
  const tone = warn ? 'warn' : ok ? 'good' : 'bad';
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">{n}</span>
          <p className="text-sm font-medium text-gray-900">{question}</p>
        </div>
        <p className="mt-1 pl-5 text-xs text-gray-500">{detail}</p>
      </div>
      <div className="flex items-center gap-2 pl-5 sm:pl-0">
        <span
          className={`tabular-nums text-sm font-semibold ${
            emphasize ? 'text-lg text-blue-700' : 'text-gray-900'
          }`}
        >
          {value}
        </span>
        <Badge tone={tone}>{warn ? 'review' : ok ? 'ready' : 'needed'}</Badge>
        {action ? (
          <Link
            to={action.to}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            {action.label} <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function Goal({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: string | number;
  ok: boolean;
  warn?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded border border-gray-200 px-3 py-2">
      <span className="text-gray-600">{label}</span>
      <span className="flex items-center gap-1.5 font-semibold tabular-nums text-gray-900">
        {value}
        <Badge tone={warn ? 'warn' : ok ? 'good' : 'bad'}>{warn ? '!' : ok ? 'ok' : '—'}</Badge>
      </span>
    </li>
  );
}

function ReliabilityMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | 'UNKNOWN';
  hint: string;
}) {
  const unknown = value === 'UNKNOWN';
  return (
    <div className="rounded-xl border border-gray-900 bg-gray-950 px-5 py-4 text-white">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-4xl font-semibold tabular-nums ${unknown ? 'text-amber-300' : 'text-white'}`}>
        {unknown ? 'UNKNOWN' : value}
      </p>
      <p className="mt-2 text-xs text-gray-400">{unknown ? 'No certified history yet — not fabricated' : hint}</p>
    </div>
  );
}

function StatusCard({
  label,
  value,
  hint,
  tone,
  to,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'neutral' | 'good' | 'warn';
  to?: string;
}) {
  const tones = {
    neutral: 'text-gray-900',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
  };
  const body = (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
  return to ? (
    <Link to={to} className="block transition hover:border-blue-300">
      {body}
    </Link>
  ) : (
    body
  );
}

function labelCertification(answer: MorningOperationsBoard['questions']['reportCertification']['answer']): string {
  switch (answer) {
    case 'certified':
      return 'Certified';
    case 'provisional':
      return 'Provisional';
    case 'failed':
      return 'Failed cert';
    default:
      return 'Missing';
  }
}
