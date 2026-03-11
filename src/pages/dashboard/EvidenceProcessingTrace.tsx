// ============================================================================
// Phase 260 — Evidence Processing Trace
// Shows processing log for each evidence file
// ============================================================================

import { useState } from 'react';
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, Filter } from 'lucide-react';

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

const MOCK_LOGS: ProcessingLogEntry[] = [
  { id: 'l1', evidenceId: 'ev-1', evidenceName: 'Police Report #2024-1847.pdf', stage: 'UPLOAD', status: 'completed', workerId: 'upload-worker-1', timestamp: '2026-01-15 14:22:03', details: 'File uploaded (2.4 MB)' },
  { id: 'l2', evidenceId: 'ev-1', evidenceName: 'Police Report #2024-1847.pdf', stage: 'OCR', status: 'completed', workerId: 'ocr-worker-2', timestamp: '2026-01-15 14:22:15', details: 'OCR completed — 12 pages extracted' },
  { id: 'l3', evidenceId: 'ev-1', evidenceName: 'Police Report #2024-1847.pdf', stage: 'TEXT_EXTRACTION', status: 'completed', workerId: 'text-worker-1', timestamp: '2026-01-15 14:22:30', details: '4,521 words extracted' },
  { id: 'l4', evidenceId: 'ev-1', evidenceName: 'Police Report #2024-1847.pdf', stage: 'ENTITY_EXTRACTION', status: 'completed', workerId: 'entity-worker-1', timestamp: '2026-01-15 14:23:00', details: '18 entities found (persons: 5, locations: 3, dates: 10)' },
  { id: 'l5', evidenceId: 'ev-1', evidenceName: 'Police Report #2024-1847.pdf', stage: 'TIMELINE_BUILD', status: 'completed', workerId: 'timeline-worker-1', timestamp: '2026-01-15 14:23:30', details: '8 timeline events generated' },
  { id: 'l6', evidenceId: 'ev-1', evidenceName: 'Police Report #2024-1847.pdf', stage: 'POLICY_COMPARISON', status: 'completed', workerId: 'policy-worker-1', timestamp: '2026-01-15 14:24:00', details: '3 policy observations generated' },
  { id: 'l7', evidenceId: 'ev-1', evidenceName: 'Police Report #2024-1847.pdf', stage: 'AI_ANALYSIS', status: 'completed', workerId: 'ai-worker-1', timestamp: '2026-01-15 14:25:00', details: 'Full analysis complete — 2 inconsistencies flagged' },
  { id: 'l8', evidenceId: 'ev-2', evidenceName: 'Bodycam - Martinez.mp4', stage: 'UPLOAD', status: 'completed', workerId: 'upload-worker-1', timestamp: '2026-01-15 14:30:00', details: 'File uploaded (145 MB)' },
  { id: 'l9', evidenceId: 'ev-2', evidenceName: 'Bodycam - Martinez.mp4', stage: 'OCR', status: 'completed', workerId: 'ocr-worker-3', timestamp: '2026-01-15 14:32:00', details: 'Video transcription completed — 8:45 duration' },
  { id: 'l10', evidenceId: 'ev-2', evidenceName: 'Bodycam - Martinez.mp4', stage: 'TEXT_EXTRACTION', status: 'running', workerId: 'text-worker-2', timestamp: '2026-01-15 14:33:00', details: 'Extracting dialogue from transcript...' },
];

export function EvidenceProcessingTrace() {
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = MOCK_LOGS.filter((log) => {
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
    </div>
  );
}
