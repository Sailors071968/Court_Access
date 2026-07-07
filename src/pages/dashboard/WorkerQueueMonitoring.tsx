// ============================================================================
// Phase 261 — Worker Queue Monitoring Dashboard
// Route: /dashboard/system/workers
// ============================================================================

import { useState } from 'react';
import { Server, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, Zap } from 'lucide-react';

interface WorkerJob {
  id: string;
  queue: string;
  status: 'active' | 'completed' | 'failed' | 'waiting' | 'retry';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  payload: string;
}

interface QueueStats {
  name: string;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  retrying: number;
  avgProcessingTime: number;
  depth: number;
}

// Initial empty state — data will be populated from real API endpoints
const INITIAL_QUEUES: QueueStats[] = [];
const INITIAL_JOBS: WorkerJob[] = [];

export function WorkerQueueMonitoring() {
  const [queues] = useState<QueueStats[]>(INITIAL_QUEUES);
  const [jobs] = useState<WorkerJob[]>(INITIAL_JOBS);

  const totalActive = queues.reduce((s, q) => s + q.active, 0);
  const totalFailed = queues.reduce((s, q) => s + q.failed, 0);
  const totalDepth = queues.reduce((s, q) => s + q.depth, 0);
  const avgTime = queues.length > 0 ? (queues.reduce((s, q) => s + q.avgProcessingTime, 0) / queues.length).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server size={24} className="text-gold-light" />
          <div>
            <h1 className="text-2xl font-bold text-white">Worker Queue Monitoring</h1>
            <p className="text-sm text-slate-400">Real-time worker status and job tracking</p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-1"><Zap size={14} className="text-blue-500" /><span className="text-xs text-slate-400">Active Jobs</span></div>
          <p className="text-2xl font-bold text-gold-light">{totalActive}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-1"><XCircle size={14} className="text-red-500" /><span className="text-xs text-slate-400">Failed Jobs</span></div>
          <p className="text-2xl font-bold text-red-600">{totalFailed}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-1"><Clock size={14} className="text-amber-500" /><span className="text-xs text-slate-400">Queue Depth</span></div>
          <p className="text-2xl font-bold text-amber-600">{totalDepth}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle size={14} className="text-green-500" /><span className="text-xs text-slate-400">Avg Processing</span></div>
          <p className="text-2xl font-bold text-green-600">{avgTime}s</p>
        </div>
      </div>

      {/* Queue Status Table */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <h3 className="text-sm font-semibold text-slate-200">Queue Status</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5/50">
              <th className="text-left px-4 py-3 font-medium text-slate-300">Queue</th>
              <th className="text-right px-4 py-3 font-medium text-slate-300">Active</th>
              <th className="text-right px-4 py-3 font-medium text-slate-300">Waiting</th>
              <th className="text-right px-4 py-3 font-medium text-slate-300">Completed</th>
              <th className="text-right px-4 py-3 font-medium text-slate-300">Failed</th>
              <th className="text-right px-4 py-3 font-medium text-slate-300">Retry</th>
              <th className="text-right px-4 py-3 font-medium text-slate-300">Avg Time</th>
              <th className="text-right px-4 py-3 font-medium text-slate-300">Depth</th>
              <th className="text-center px-4 py-3 font-medium text-slate-300">Health</th>
            </tr>
          </thead>
          <tbody>
            {queues.map((q) => {
              const health = q.failed > 10 ? 'critical' : q.depth > 10 ? 'warning' : 'healthy';
              return (
                <tr key={q.name} className="border-b border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white font-mono text-xs">{q.name}</td>
                  <td className="px-4 py-3 text-right text-gold-light font-medium">{q.active}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{q.waiting}</td>
                  <td className="px-4 py-3 text-right text-green-600">{q.completed}</td>
                  <td className="px-4 py-3 text-right text-red-600">{q.failed}</td>
                  <td className="px-4 py-3 text-right text-purple-600">{q.retrying}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{q.avgProcessingTime}s</td>
                  <td className="px-4 py-3 text-right text-white font-medium">{q.depth}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      health === 'healthy' ? 'bg-green-100 text-green-700' :
                      health === 'warning' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {health === 'healthy' ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                      {health.toUpperCase()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <h3 className="text-sm font-semibold text-slate-200">Recent Jobs</h3>
        </div>
        <div className="divide-y divide-white/10">
          {jobs.map((job) => (
            <div key={job.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {job.status === 'active' && <RefreshCw size={14} className="text-blue-500 animate-spin" />}
                {job.status === 'completed' && <CheckCircle size={14} className="text-green-500" />}
                {job.status === 'failed' && <XCircle size={14} className="text-red-500" />}
                {job.status === 'waiting' && <Clock size={14} className="text-slate-500" />}
                {job.status === 'retry' && <AlertTriangle size={14} className="text-amber-500" />}
                <div>
                  <p className="text-sm font-medium text-white">{job.payload}</p>
                  <p className="text-xs text-slate-400">{job.queue} | {job.startedAt}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                job.status === 'active' ? 'bg-blue-100 text-blue-700' :
                job.status === 'completed' ? 'bg-green-100 text-green-700' :
                job.status === 'failed' ? 'bg-red-100 text-red-700' :
                job.status === 'retry' ? 'bg-amber-100 text-amber-700' :
                'bg-white/10 text-slate-300'
              }`}>
                {job.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
