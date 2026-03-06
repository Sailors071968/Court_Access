// ============================================
// Court Access — Phase 52/56: Media Transcripts Page
// Searchable transcript viewer with legal ledger format,
// clickable timestamps, and keyword highlighting.
// Standard 8.5" x 11" numbered ruled legal format.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Mic, Search, FileText, Clock, ChevronDown, ChevronUp, RefreshCw, Download, Play, AlertCircle, Loader2, Info } from 'lucide-react';
import { Card } from '../../components/common/Card';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MediaTranscript {
  id: string;
  evidenceId: string;
  caseId: string;
  speakerLabel: string;
  startTime: number;
  endTime: number;
  transcriptText: string;
  confidenceScore: number;
  language: string;
  modelVersion: string;
  fullTranscript: boolean;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface LegalLedgerLine {
  lineNumber: number;
  text: string;
  timestamp: number | null;
  isTimestamped: boolean;
}

interface LegalLedgerPage {
  pageNumber: number;
  lines: LegalLedgerLine[];
}

interface LegalLedger {
  header: {
    title: string;
    caseCaption: string;
    caseNumber: string;
    evidenceReference: string;
    transcriptionDate: string;
    transcriptionEngine: string;
    language: string;
    pageSize: string;
  };
  pages: LegalLedgerPage[];
  certificate: {
    text: string;
    body: string;
  };
  metadata: {
    totalPages: number;
    totalLines: number;
    linesPerPage: number;
    charsPerLine: number;
    segmentCount: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  complete: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  pending: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-700',
  none: 'bg-gray-100 text-gray-500',
};

// ---------------------------------------------------------------------------
// Legal Ledger Viewer — 8.5" x 11" numbered ruled format
// ---------------------------------------------------------------------------

function LegalLedgerViewer({
  ledger,
  searchQuery,
}: {
  ledger: LegalLedger;
  searchQuery: string;
}) {
  const [currentPage, setCurrentPage] = useState(1);

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">{part}</mark>
      ) : (
        part
      )
    );
  };

  const page = ledger.pages[currentPage - 1];
  if (!page) return null;

  return (
    <div className="space-y-4">
      {/* Legal Ledger Header */}
      <div className="bg-white border-2 border-gray-800 p-6 font-mono text-sm" style={{ maxWidth: '8.5in', margin: '0 auto' }}>
        {/* Title block — centered */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
          <p className="text-xs tracking-widest text-gray-500 mb-1">{ledger.header.pageSize}</p>
          <h2 className="text-base font-bold tracking-wide">{ledger.header.title}</h2>
          <p className="text-sm font-bold mt-2">{ledger.header.caseCaption}</p>
          {ledger.header.caseNumber && (
            <p className="text-xs text-gray-600 mt-1">{ledger.header.caseNumber}</p>
          )}
          <p className="text-xs text-gray-600 mt-1">{ledger.header.evidenceReference}</p>
          <p className="text-xs text-gray-500 mt-1">{ledger.header.transcriptionDate}</p>
          <p className="text-xs text-gray-500">{ledger.header.transcriptionEngine} | {ledger.header.language}</p>
        </div>

        {/* Page indicator */}
        <div className="flex justify-between items-center mb-2 text-xs text-gray-500">
          <span>Page {page.pageNumber} of {ledger.metadata.totalPages}</span>
          <span>{ledger.metadata.totalLines} total lines</span>
        </div>

        {/* Numbered ruled lines */}
        <div className="border border-gray-300">
          {page.lines.map((line) => (
            <div
              key={line.lineNumber}
              className={`flex border-b border-gray-200 min-h-[1.5rem] ${
                line.isTimestamped ? 'bg-blue-50/30' : ''
              } ${line.text ? '' : 'text-gray-300'}`}
            >
              {/* Line number column — ruled left margin */}
              <div className="w-12 flex-shrink-0 text-right pr-2 border-r-2 border-gray-400 text-xs text-gray-400 py-0.5 select-none">
                {line.lineNumber}
              </div>
              {/* Content column */}
              <div className="flex-1 pl-3 py-0.5 text-xs leading-relaxed whitespace-pre-wrap break-words">
                {line.text ? highlightText(line.text, searchQuery) : '\u00A0'}
              </div>
            </div>
          ))}
        </div>

        {/* Page footer */}
        <div className="text-center text-xs text-gray-400 mt-2 pt-2 border-t border-gray-300">
          {ledger.header.caseCaption} — Page {page.pageNumber}
        </div>
      </div>

      {/* Pagination */}
      {ledger.metadata.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {currentPage} of {ledger.metadata.totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(ledger.metadata.totalPages, currentPage + 1))}
            disabled={currentPage === ledger.metadata.totalPages}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Certificate of Transcription */}
      {currentPage === ledger.metadata.totalPages && (
        <div className="bg-white border-2 border-gray-800 p-6 font-mono text-sm" style={{ maxWidth: '8.5in', margin: '0 auto' }}>
          <div className="text-center mb-4">
            <h3 className="text-sm font-bold tracking-wide">{ledger.certificate.text}</h3>
          </div>
          <p className="text-xs leading-relaxed text-gray-700">{ledger.certificate.body}</p>
          <div className="mt-6 pt-4 border-t border-gray-300">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Automated Transcription System</span>
              <span>Date: {ledger.header.transcriptionDate}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transcript Card (list view)
// ---------------------------------------------------------------------------

function TranscriptCard({
  transcript,
  onViewLedger,
  searchQuery,
}: {
  transcript: MediaTranscript;
  onViewLedger: (evidenceId: string) => void;
  searchQuery: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLORS[transcript.status] || STATUS_COLORS.none;
  const metadata = transcript.metadata as Record<string, unknown>;
  const duration = metadata?.duration as number;
  const filename = metadata?.filename as string;

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">{part}</mark>
      ) : (
        part
      )
    );
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Mic size={14} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-900">
              {filename || `Evidence ${transcript.evidenceId.substring(0, 8)}...`}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
              {transcript.status}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
            {duration > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {formatDuration(duration)}
              </span>
            )}
            <span>Language: {transcript.language.toUpperCase()}</span>
            <span>Confidence: {Math.round(transcript.confidenceScore * 100)}%</span>
            <span>{new Date(transcript.createdAt).toLocaleDateString()}</span>
          </div>

          {/* Preview */}
          <p className="text-xs text-gray-600 leading-relaxed">
            {expanded
              ? highlightText(transcript.transcriptText, searchQuery)
              : highlightText(transcript.transcriptText.substring(0, 300) + (transcript.transcriptText.length > 300 ? '...' : ''), searchQuery)
            }
          </p>
        </div>

        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            aria-label="Toggle full text"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {transcript.status === 'complete' && (
            <button
              onClick={() => onViewLedger(transcript.evidenceId)}
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
              aria-label="View legal ledger"
              title="View as Legal Ledger (8.5&quot; x 11&quot;)"
            >
              <FileText size={14} />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Media Transcripts Page
// ---------------------------------------------------------------------------

export function MediaTranscriptsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [transcripts, setTranscripts] = useState<MediaTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ledger, setLedger] = useState<LegalLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [viewingEvidenceId, setViewingEvidenceId] = useState<string | null>(null);

  const fetchTranscripts = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`${API_BASE}/api/transcripts/${caseId}?${params}`);
      const data = await res.json();
      setTranscripts(data.transcripts || []);
    } catch (err) {
      console.error('Failed to fetch transcripts:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId, searchQuery]);

  useEffect(() => {
    fetchTranscripts();
  }, [fetchTranscripts]);

  const handleViewLedger = async (evidenceId: string) => {
    if (!caseId) return;
    setLedgerLoading(true);
    setViewingEvidenceId(evidenceId);
    try {
      const res = await fetch(`${API_BASE}/api/transcripts/${caseId}/evidence/${evidenceId}/legal-ledger`);
      const data = await res.json();
      setLedger(data.ledger || null);
    } catch (err) {
      console.error('Failed to fetch legal ledger:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleCloseLedger = () => {
    setLedger(null);
    setViewingEvidenceId(null);
  };

  // If viewing a legal ledger, show that
  if (ledger && viewingEvidenceId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Legal Ledger Format
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Standard 8.5&quot; x 11&quot; — Numbered Ruled Legal Format
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCloseLedger}
              className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Back to Transcripts
            </button>
          </div>
        </div>

        {/* Phase 60: AI Disclaimer */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg" style={{ maxWidth: '8.5in', margin: '0 auto' }}>
          <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            This transcript was generated by automated speech recognition technology and is intended for investigative assistance only. It does not constitute a certified verbatim record. All transcripts should be independently verified for accuracy before use in legal proceedings.
          </p>
        </div>

        <LegalLedgerViewer ledger={ledger} searchQuery={searchQuery} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Mic size={20} className="text-blue-600" />
            Media Transcripts
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''} from audio/video evidence
          </p>
        </div>
        <button
          onClick={fetchTranscripts}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          aria-label="Refresh transcripts"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Phase 60: AI Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          Transcripts are generated by automated speech recognition technology and are intended for investigative assistance only. They do not constitute certified verbatim records. All transcripts should be independently verified for accuracy before use in legal proceedings.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transcripts by keyword..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Transcript List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 size={24} className="mx-auto mb-2 text-gray-400 animate-spin" />
          <p className="text-gray-400 text-sm">Loading transcripts...</p>
        </div>
      ) : transcripts.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Mic size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">No media transcripts yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Upload audio or video evidence to automatically generate transcripts.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {transcripts.map((t) => (
            <TranscriptCard
              key={t.id}
              transcript={t}
              onViewLedger={handleViewLedger}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}

      {/* Ledger Loading Overlay */}
      {ledgerLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <Loader2 size={24} className="mx-auto mb-2 text-blue-600 animate-spin" />
            <p className="text-sm text-gray-600">Generating legal ledger format...</p>
          </div>
        </div>
      )}
    </div>
  );
}
