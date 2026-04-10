// ============================================================================
// Court Access — Video Processing Page
// Start video processing for a case and track real-time progress via polling.
// Backend: POST /api/video/process/:caseId → GET /api/jobs/:jobId
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Play, CheckCircle, AlertTriangle, Loader2, RefreshCw, Clock } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { startVideoProcessing, getJobStatus } from '../../services/videoService';
import type { JobState } from '../../services/videoService';
import { fetchCases } from '../../services/caseApi';
import type { ApiCase } from '../../services/caseApi';

const POLL_INTERVAL_MS = 2000;

interface ProcessingJob {
  jobId: string;
  caseId: string;
  caseTitle: string;
  progress: number;
  state: JobState;
  failedReason: string | null;
  startedAt: number;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function stateLabel(state: JobState): string {
  switch (state) {
    case 'waiting': return 'Queued';
    case 'active': return 'Processing';
    case 'completed': return 'Complete';
    case 'failed': return 'Failed';
    case 'delayed': return 'Delayed';
    default: return 'Unknown';
  }
}

function stateColor(state: JobState): string {
  switch (state) {
    case 'waiting': return 'text-yellow-600';
    case 'active': return 'text-blue-600';
    case 'completed': return 'text-green-600';
    case 'failed': return 'text-red-600';
    case 'delayed': return 'text-orange-600';
    default: return 'text-gray-500';
  }
}

function progressBarColor(state: JobState): string {
  switch (state) {
    case 'completed': return 'bg-green-500';
    case 'failed': return 'bg-red-500';
    default: return 'bg-blue-500';
  }
}

export function VideoProcessingPage() {
  const [cases, setCases] = useState<ApiCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [startingJob, setStartingJob] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Fetch available cases on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCases();
        if (!cancelled) {
          setCases(data);
          if (data.length > 0) setSelectedCaseId(data[0].caseId);
        }
      } catch (err) {
        if (!cancelled) setCasesError(err instanceof Error ? err.message : 'Failed to load cases');
      } finally {
        if (!cancelled) setCasesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Cleanup poll timers on unmount
  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      Object.values(timers).forEach(clearInterval);
    };
  }, []);

  const pollJob = useCallback((jobId: string) => {
    // Avoid duplicate timers
    if (pollTimers.current[jobId]) return;

    const timer = setInterval(async () => {
      try {
        const status = await getJobStatus(jobId);
        setJobs((prev) =>
          prev.map((j) =>
            j.jobId === jobId
              ? { ...j, progress: status.progress ?? j.progress, state: status.state, failedReason: status.failedReason }
              : j
          )
        );
        // Stop polling on terminal states
        if (status.state === 'completed' || status.state === 'failed') {
          clearInterval(timer);
          delete pollTimers.current[jobId];
        }
      } catch {
        // On error, keep polling — transient failure
      }
    }, POLL_INTERVAL_MS);

    pollTimers.current[jobId] = timer;
  }, []);

  const handleStartProcessing = async () => {
    if (!selectedCaseId) return;
    setStartingJob(true);
    setStartError(null);

    try {
      const res = await startVideoProcessing(selectedCaseId);
      const caseTitle = cases.find((c) => c.caseId === selectedCaseId)?.title || selectedCaseId;
      const newJob: ProcessingJob = {
        jobId: res.jobId,
        caseId: selectedCaseId,
        caseTitle,
        progress: 0,
        state: 'waiting',
        failedReason: null,
        startedAt: Date.now(),
      };
      setJobs((prev) => [newJob, ...prev]);
      pollJob(res.jobId);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start processing');
    } finally {
      setStartingJob(false);
    }
  };

  const activeJobs = jobs.filter((j) => j.state === 'active' || j.state === 'waiting' || j.state === 'delayed');
  const completedJobs = jobs.filter((j) => j.state === 'completed');
  const failedJobs = jobs.filter((j) => j.state === 'failed');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Video Processing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Process video evidence files. Progress is tracked in real-time via the backend job queue.
        </p>
      </div>

      {/* Start Processing Card */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Video size={20} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Start Video Processing</h2>
            <p className="text-sm text-gray-500 mb-4">
              Select a case and start processing its video evidence. The backend will queue the job and you can track progress below.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              {casesLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={16} className="animate-spin" />
                  Loading cases...
                </div>
              ) : casesError ? (
                <p className="text-sm text-red-600">{casesError}</p>
              ) : cases.length === 0 ? (
                <p className="text-sm text-gray-500">No cases available. Create a case first.</p>
              ) : (
                <>
                  <select
                    value={selectedCaseId}
                    onChange={(e) => setSelectedCaseId(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Select case"
                  >
                    {cases.map((c) => (
                      <option key={c.caseId} value={c.caseId}>
                        {c.title} — #{c.caseNumber}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleStartProcessing}
                    disabled={startingJob || !selectedCaseId}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {startingJob ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    {startingJob ? 'Starting...' : 'Process Video'}
                  </button>
                </>
              )}
            </div>

            {startError && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle size={14} />
                {startError}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Status Summary */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{activeJobs.length}</div>
            <div className="text-sm text-blue-600">Active</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{completedJobs.length}</div>
            <div className="text-sm text-green-600">Completed</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-700">{failedJobs.length}</div>
            <div className="text-sm text-red-600">Failed</div>
          </div>
        </div>
      )}

      {/* Active Jobs */}
      {jobs.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Processing Jobs</h2>
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.jobId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {job.state === 'active' && <Loader2 size={16} className="text-blue-600 animate-spin" />}
                    {job.state === 'waiting' && <Clock size={16} className="text-yellow-600" />}
                    {job.state === 'completed' && <CheckCircle size={16} className="text-green-600" />}
                    {job.state === 'failed' && <AlertTriangle size={16} className="text-red-600" />}
                    {job.state === 'delayed' && <RefreshCw size={16} className="text-orange-600" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{job.caseTitle}</p>
                      <p className="text-xs text-gray-500">Job: {job.jobId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${stateColor(job.state)}`}>
                      {stateLabel(job.state)}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatElapsed(Date.now() - job.startedAt)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-100 rounded-full h-3 mb-1">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${progressBarColor(job.state)}`}
                    style={{ width: `${Math.max(job.progress, job.state === 'waiting' ? 0 : 2)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{Math.round(job.progress)}% complete</span>
                  {job.state === 'active' && (
                    <span className="text-blue-500">Polling every {POLL_INTERVAL_MS / 1000}s...</span>
                  )}
                </div>

                {/* Error Message */}
                {job.failedReason && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {job.failedReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {jobs.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <Video size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-1">No Processing Jobs</h3>
            <p className="text-sm text-gray-400">
              Select a case above and click "Process Video" to start.
              <br />
              Progress will appear here in real-time.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
