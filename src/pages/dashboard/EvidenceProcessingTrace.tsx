// ============================================================================
// Phase 260 — Evidence Processing Trace
// Shows processing log for each evidence file
// ============================================================================

import { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, Filter, Loader2 } from 'lucide-react';

interface ProcessingLogEntry {
  id: string;
  evidenceId: string;
  evidenceName: string;
  stage: 'UPLOAD' | 'OCR' | 'TEXT_EXTRACTION' | 'ENTITY_EXTRACTION' | 'TIMELINE_BUILD' | 'POLICY_COMPARISON' | 'AI_ANALYSIS';
  status: 'completed' | 'failed' | 'running' | 'pending';
  workerId: string;
  timestamp: string;
  details: string;
}

const STAGES: ProcessingLogEntry['stage'][] = ['UPLOAD', 'OCR', 'TEXT_EXTRACTION', 'ENTITY_EXTRACTION', 'TIMELINE_BUILD', 'POLICY_COMPARISON', 'AI_ANALYSIS'];


export function EvidenceProcessingTrace() {
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [logs, setLogs] = useState<ProcessingLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/evidence/processing-logs');
        if (res.ok) {
          const json = await res.json();
          if (json.data) setLogs(json.data);
        }
      } catch {
        // API not available yet
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const filtered = logs.filter((log) => {
    if (filterStage !== 'all' && log.stage !== filterStage) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    return true;
  });

  const statusIcon = (status: ProcessingLogEntry['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} className="text-green-500" />;
      case 'failed': return <XCircle size={14} className="text-red-500" />;
      case 'running': return <RefreshCw size={14} className="text-blue-500 animate-spin" />;
      case 'pending': return <Clock size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Evidence Processing Trace</h1>
            <p className="text-sm text-gray-500">Track every stage of evidence processing</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter size={14} className="text-gray-400" />
        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
        >
          <option value="all">All Stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="running">Running</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Log Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading processing logs...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Activity size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No processing logs available yet.</p>
          <p className="text-xs text-gray-400 mt-1">Upload evidence to see processing activity.</p>
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Evidence</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Worker</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Timestamp</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">{statusIcon(log.status)}</td>
                <td className="px-4 py-3 font-medium text-gray-900 text-xs">{log.evidenceName}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-mono">{log.stage}</span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs font-mono">{log.workerId}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{log.timestamp}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
