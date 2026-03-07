// ============================================
// Court Access — Evidence Dashboard (Phases 21-22-24)
// Complete evidence management interface with:
//   - Full upload flow with drag-drop + progress (Phase 21)
//   - Processing status indicators + results (Phase 22)
//   - Evidence search with filters + highlighting (Phase 24)
// ============================================

import { useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Upload, Search, FileText, Image, Mic, Video, Clock, GitBranch,
  FileSearch, X, CheckCircle, AlertCircle, Loader2, Eye, Shield,
  BarChart3, Filter, Calendar, User, Zap, Copy,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import type { EvidenceRecord, EvidenceType, EvidenceProcessingStatus } from '../../models/EvidenceModel';
import { EVIDENCE_TYPE_LABELS, EVIDENCE_STATUS_LABELS, SUPPORTED_EXTENSIONS, getAllSupportedExtensions } from '../../models/EvidenceModel';
import type { CaseTimelineEvent } from '../../models/CaseTimelineModel';
import { TIMELINE_CATEGORY_LABELS } from '../../models/CaseTimelineModel';
import type { EvidenceGraph } from '../../models/EvidenceGraphModel';
import { formatEvidenceFileSize } from '../../services/evidenceIngestionService';
import type { UploadItem, ProcessingResult } from '../../services/evidenceUploadService';
import { createUploadItem, simulateUploadPipeline } from '../../services/evidenceUploadService';
import { indexEvidence, searchEvidence } from '../../services/evidenceSearchService';
import type { SearchResult, SearchFilters } from '../../services/evidenceSearchService';
import { checkUploadRateLimit, trackUploadStart, trackUploadEnd, scanFile } from '../../services/productionHardeningService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVIDENCE_TYPE_ICONS: Record<EvidenceType, typeof FileText> = {
  document: FileText,
  image: Image,
  audio: Mic,
  video: Video,
};

// ---------------------------------------------------------------------------
// Processing Status Badge (Phase 22)
// ---------------------------------------------------------------------------

function ProcessingStatusBadge({ status }: { status: EvidenceProcessingStatus }) {
  const config: Record<EvidenceProcessingStatus, { color: string; icon: typeof CheckCircle }> = {
    pending: { color: 'bg-gray-100 text-gray-600', icon: Clock },
    processing: { color: 'bg-blue-100 text-blue-700', icon: Loader2 },
    complete: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
    error: { color: 'bg-red-100 text-red-700', icon: AlertCircle },
  };
  const { color, icon: Icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon size={12} className={status === 'processing' ? 'animate-spin' : ''} />
      {EVIDENCE_STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Evidence Type Badge
// ---------------------------------------------------------------------------

function EvidenceTypeBadge({ type }: { type: EvidenceType }) {
  const colors: Record<EvidenceType, string> = {
    document: 'bg-slate-100 text-slate-700',
    image: 'bg-purple-100 text-purple-700',
    audio: 'bg-amber-100 text-amber-700',
    video: 'bg-blue-100 text-blue-700',
  };
  const Icon = EVIDENCE_TYPE_ICONS[type];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors[type]}`}>
      <Icon size={12} />
      {EVIDENCE_TYPE_LABELS[type]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Upload Dropzone (Phase 21)
// ---------------------------------------------------------------------------

function UploadDropzone({
  onFilesSelected,
  isUploading,
}: {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isUploading) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFilesSelected(files);
    },
    [onFilesSelected, isUploading]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFilesSelected(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onFilesSelected]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        isDragging
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
      } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onClick={() => !isUploading && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={getAllSupportedExtensions().join(',')}
        onChange={handleFileInput}
        className="hidden"
      />
      <Upload className="mx-auto mb-3 text-gray-400" size={32} />
      <p className="text-sm font-medium text-gray-700 mb-1">
        {isUploading ? 'Uploading...' : 'Drop evidence files here or click to browse'}
      </p>
      <p className="text-xs text-gray-500">
        Documents, images, audio, and video files supported
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {Object.entries(SUPPORTED_EXTENSIONS).map(([type, exts]) => (
          <span key={type} className="text-xs text-gray-400">
            {EVIDENCE_TYPE_LABELS[type as EvidenceType]}: {exts.join(', ')}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload Queue Row (Phase 21 + 22)
// ---------------------------------------------------------------------------

function UploadQueueRow({ item }: { item: UploadItem }) {
  const Icon = item.evidenceType ? EVIDENCE_TYPE_ICONS[item.evidenceType] : FileText;
  const statusColors: Record<string, string> = {
    validating: 'text-gray-500',
    uploading: 'text-blue-500',
    processing: 'text-blue-600',
    analyzing: 'text-purple-600',
    complete: 'text-green-600',
    error: 'text-red-500',
  };

  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-gray-50 last:border-b-0">
      <Icon size={16} className="text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-500">{formatEvidenceFileSize(item.file.size)}</p>
          {item.processingStep && item.status !== 'error' && (
            <>
              <span className="text-xs text-gray-300">&bull;</span>
              <p className={`text-xs ${statusColors[item.status] || 'text-gray-500'}`}>
                {item.processingStep}
              </p>
            </>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">
        {(item.status === 'validating' ||
          item.status === 'processing' ||
          item.status === 'analyzing') && (
          <Loader2 size={14} className="animate-spin text-blue-500" />
        )}
        {item.status === 'uploading' && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <span className="text-xs text-blue-600 font-medium w-10 text-right">
              {Math.round(item.progress)}%
            </span>
          </div>
        )}
        {item.status === 'complete' && <CheckCircle size={14} className="text-green-500" />}
        {item.status === 'error' && (
          <span className="text-xs text-red-500 max-w-xs truncate">
            {item.error ?? 'Error'}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence Table
// ---------------------------------------------------------------------------

function EvidenceTable({
  records,
  onSelect,
  onView,
  selectedId,
}: {
  records: EvidenceRecord[];
  onSelect: (r: EvidenceRecord) => void;
  onView: (r: EvidenceRecord) => void;
  selectedId: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Evidence</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Type</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Size</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Uploaded</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Integrity</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && (
            <tr>
              <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                No evidence uploaded yet. Use the upload area above to add evidence files.
              </td>
            </tr>
          )}
          {records.map((record) => {
            const Icon = EVIDENCE_TYPE_ICONS[record.fileType];
            return (
              <tr
                key={record.evidenceId}
                className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedId === record.evidenceId ? 'bg-blue-50' : ''
                }`}
                onClick={() => onSelect(record)}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-gray-400" />
                    <span className="font-medium text-gray-900 truncate max-w-xs">
                      {record.fileName}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <EvidenceTypeBadge type={record.fileType} />
                </td>
                <td className="py-3 px-4 text-gray-500">
                  {formatEvidenceFileSize(record.fileSize)}
                </td>
                <td className="py-3 px-4 text-gray-500 text-xs">
                  {new Date(record.uploadTimestamp).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <ProcessingStatusBadge status={record.processingStatus} />
                </td>
                <td className="py-3 px-4">
                  {record.integrityVerified ? (
                    <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                      <Shield size={12} /> Verified
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Pending</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(record);
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
                  >
                    <Eye size={12} /> View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence Detail Panel (Phase 22)
// ---------------------------------------------------------------------------

function EvidenceDetailPanel({
  record,
  processingResult,
  onClose,
}: {
  record: EvidenceRecord;
  processingResult: ProcessingResult | null;
  onClose: () => void;
}) {
  const Icon = EVIDENCE_TYPE_ICONS[record.fileType];
  const [showFullText, setShowFullText] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Icon size={20} className="text-gray-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{record.fileName}</h3>
            <p className="text-xs text-gray-500">
              {formatEvidenceFileSize(record.fileSize)} &middot; {record.mimeType}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X size={16} />
        </button>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-gray-500">Evidence ID</span>
          <p className="font-mono text-gray-700 mt-0.5">{record.evidenceId}</p>
        </div>
        <div>
          <span className="text-gray-500">Type</span>
          <p className="mt-0.5">
            <EvidenceTypeBadge type={record.fileType} />
          </p>
        </div>
        <div>
          <span className="text-gray-500">Processing</span>
          <p className="mt-0.5">
            <ProcessingStatusBadge status={record.processingStatus} />
          </p>
        </div>
        <div>
          <span className="text-gray-500">Integrity</span>
          <p className="mt-0.5">
            {record.integrityVerified ? (
              <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                <Shield size={12} /> Verified
              </span>
            ) : (
              <span className="text-gray-400">Pending</span>
            )}
          </p>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">SHA-256</span>
          <p className="font-mono text-gray-700 mt-0.5 break-all text-[10px]">
            {record.sha256Hash}
          </p>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">SHA3-256</span>
          <p className="font-mono text-gray-700 mt-0.5 break-all text-[10px]">
            {record.sha3Hash}
          </p>
        </div>
      </div>

      {/* Processing Results (Phase 22) */}
      {processingResult && (
        <>
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Zap size={12} className="text-blue-500" />
              AI Summary
            </h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              {processingResult.summary}
            </p>
          </div>

          {processingResult.keyPoints.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 mb-1.5">Key Points</h5>
              <ul className="space-y-1">
                {processingResult.keyPoints.map((point, i) => (
                  <li
                    key={i}
                    className="text-xs text-gray-600 flex items-start gap-1.5"
                  >
                    <span className="text-blue-500 mt-0.5">&bull;</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {processingResult.extractedText && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h5 className="text-xs font-medium text-gray-500">Extracted Text</h5>
                <button
                  onClick={() => setShowFullText(!showFullText)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {showFullText ? 'Collapse' : 'Expand'}
                </button>
              </div>
              <div
                className={`bg-gray-50 rounded-lg p-3 ${showFullText ? '' : 'max-h-32'} overflow-hidden`}
              >
                <p className="text-xs text-gray-600 whitespace-pre-wrap">
                  {processingResult.extractedText}
                </p>
              </div>
            </div>
          )}

          {processingResult.transcript && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h5 className="text-xs font-medium text-gray-500">Transcript</h5>
                <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Copy size={10} /> Copy
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">
                  {processingResult.transcript}
                </pre>
              </div>
            </div>
          )}

          {processingResult.ocrText && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 mb-1.5">
                OCR Extracted Text
              </h5>
              <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                  {processingResult.ocrText}
                </pre>
              </div>
            </div>
          )}

          {processingResult.entities.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 mb-1.5">
                Detected Entities
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {processingResult.entities.map((entity, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                  >
                    {entity.name}
                    <span className="text-gray-400">({entity.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            {processingResult.pageCount !== null && (
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-900">
                  {processingResult.pageCount}
                </p>
                <p className="text-gray-500">Pages</p>
              </div>
            )}
            {processingResult.duration !== null && (
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-900">
                  {Math.floor(processingResult.duration / 60)}:
                  {String(processingResult.duration % 60).padStart(2, '0')}
                </p>
                <p className="text-gray-500">Duration</p>
              </div>
            )}
          </div>
        </>
      )}

      <div className="border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">Storage</span>
        <p className="font-mono text-[10px] text-gray-500 mt-0.5 break-all">
          {record.storageLocation}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline View
// ---------------------------------------------------------------------------

function TimelineView({ events }: { events: CaseTimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No timeline events yet. Upload evidence to auto-generate a timeline.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => (
        <div key={event.eventId} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
            {index < events.length - 1 && <div className="w-0.5 flex-1 bg-gray-200" />}
          </div>
          <div className="pb-6 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-900">
                {new Date(event.timestamp).toLocaleDateString()}{' '}
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-medium">
                {TIMELINE_CATEGORY_LABELS[event.eventCategory]}
              </span>
            </div>
            <p className="text-sm text-gray-600">{event.eventDescription}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Graph View
// ---------------------------------------------------------------------------

function GraphView({ graph }: { graph: EvidenceGraph | null }) {
  if (!graph || (graph.nodes.length === 0 && graph.edges.length === 0)) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No relationship data yet. Upload evidence to auto-detect relationships.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{graph.nodes.length}</p>
          <p className="text-xs text-gray-500 mt-1">Entities</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{graph.edges.length}</p>
          <p className="text-xs text-gray-500 mt-1">Relationships</p>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Entities
        </h4>
        <div className="space-y-1">
          {graph.nodes.map((node) => (
            <div
              key={node.nodeId}
              className="flex items-center gap-2 py-1.5 px-3 bg-gray-50 rounded-lg"
            >
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium uppercase">
                {node.nodeType}
              </span>
              <span className="text-sm text-gray-700">{node.label}</span>
            </div>
          ))}
        </div>
      </div>

      {graph.edges.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Relationships
          </h4>
          <div className="space-y-1">
            {graph.edges.map((edge) => {
              const source = graph.nodes.find((n) => n.nodeId === edge.sourceNodeId);
              const target = graph.nodes.find((n) => n.nodeId === edge.targetNodeId);
              return (
                <div
                  key={edge.edgeId}
                  className="flex items-center gap-2 py-1.5 px-3 bg-gray-50 rounded-lg text-xs"
                >
                  <span className="text-gray-700 font-medium">
                    {source?.label ?? '?'}
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px]">
                    {edge.relationshipType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="text-gray-700 font-medium">
                    {target?.label ?? '?'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search Results List (Phase 24)
// ---------------------------------------------------------------------------

function SearchResultsList({ results }: { results: SearchResult[] }) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No results found. Try different search terms or filters.
      </div>
    );
  }

  const matchTypeLabels: Record<string, string> = {
    content: 'Content',
    transcript: 'Transcript',
    ocr: 'OCR',
    summary: 'Summary',
    entity: 'Entity',
    filename: 'File Name',
  };

  return (
    <div className="space-y-3">
      {results.map((result, i) => {
        const Icon = EVIDENCE_TYPE_ICONS[result.fileType];
        return (
          <div
            key={`${result.evidenceId}-${i}`}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-900">
                {result.fileName}
              </span>
              <EvidenceTypeBadge type={result.fileType} />
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">
                {matchTypeLabels[result.matchType] || result.matchType}
              </span>
            </div>
            <div
              className="text-sm text-gray-600 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: result.matchHighlight }}
            />
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span>Relevance: {Math.round(result.relevanceScore * 100)}%</span>
              <span>&bull;</span>
              <span>
                Uploaded: {new Date(result.uploadTimestamp).toLocaleDateString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Tabs
// ---------------------------------------------------------------------------

type DashboardTab = 'evidence' | 'timeline' | 'graph' | 'search';
type FilterType = 'all' | EvidenceType;

const DASHBOARD_TABS: { id: DashboardTab; label: string; icon: typeof FileText }[] = [
  { id: 'evidence', label: 'Evidence', icon: FileSearch },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'graph', label: 'Relationships', icon: GitBranch },
  { id: 'search', label: 'Search', icon: Search },
];

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export function EvidenceDashboardPage() {
  const navigate = useNavigate();
  const { caseId } = useParams();

  // UI State
  const [activeTab, setActiveTab] = useState<DashboardTab>('evidence');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<EvidenceRecord | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Evidence State
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([]);
  const [processingResults, setProcessingResults] = useState<Map<string, ProcessingResult>>(
    new Map()
  );

  // Timeline + Graph (populated by processing pipeline)
  const [timelineEvents] = useState<CaseTimelineEvent[]>([]);
  const [evidenceGraph] = useState<EvidenceGraph | null>(null);

  // Search State (Phase 24)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    evidenceType: 'all',
    dateFrom: null,
    dateTo: null,
    personMentioned: null,
  });

  // ---------------------------------------------------------------------------
  // Upload Handler (Phase 21 + Phase 27 hardening)
  // ---------------------------------------------------------------------------

  const handleFilesSelected = useCallback(async (files: File[]) => {
    for (const file of files) {
      // Phase 27: Rate limit check
      const rateCheck = checkUploadRateLimit(file.size);
      if (!rateCheck.allowed) {
        const errorItem = createUploadItem(file);
        errorItem.status = 'error';
        errorItem.error = rateCheck.reason;
        setUploadQueue((prev) => [...prev, errorItem]);
        continue;
      }

      // Phase 27: File security scan
      const scanResult = await scanFile(file);
      if (!scanResult.safe) {
        const errorItem = createUploadItem(file);
        errorItem.status = 'error';
        errorItem.error = scanResult.threats.join('; ');
        setUploadQueue((prev) => [...prev, errorItem]);
        continue;
      }

      // Create upload item (validates file type + size)
      const uploadItem = createUploadItem(file);
      if (uploadItem.status === 'error') {
        setUploadQueue((prev) => [...prev, uploadItem]);
        continue;
      }

      setUploadQueue((prev) => [...prev, uploadItem]);
      trackUploadStart(file.size);

      // Run simulated upload + processing pipeline
      simulateUploadPipeline(
        uploadItem,
        (updated) => {
          setUploadQueue((prev) =>
            prev.map((q) => (q.id === updated.id ? updated : q))
          );
          // Add evidence record when upload completes
          if (updated.record && updated.status === 'processing') {
            setEvidenceRecords((prev) => {
              const exists = prev.some(
                (r) => r.evidenceId === updated.record!.evidenceId
              );
              if (exists) return prev;
              return [...prev, updated.record!];
            });
          }
        },
        (completedRecord, result) => {
          trackUploadEnd();
          // Update evidence record to complete status
          setEvidenceRecords((prev) =>
            prev.map((r) =>
              r.evidenceId === completedRecord.evidenceId ? completedRecord : r
            )
          );
          // Store processing result
          setProcessingResults((prev) => {
            const next = new Map(prev);
            next.set(completedRecord.evidenceId, result);
            return next;
          });
          // Index for search (Phase 24)
          indexEvidence(completedRecord, result);
        }
      );
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Search Handler (Phase 24)
  // ---------------------------------------------------------------------------

  const handleSearch = useCallback(() => {
    if (!globalSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const results = searchEvidence(globalSearchQuery, searchFilters);
    setSearchResults(results);
  }, [globalSearchQuery, searchFilters]);

  // ---------------------------------------------------------------------------
  // Filtered Records
  // ---------------------------------------------------------------------------

  const filteredRecords = evidenceRecords.filter((record) => {
    const matchesType = filterType === 'all' || record.fileType === filterType;
    const matchesSearch =
      !searchQuery ||
      record.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.evidenceId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const stats = {
    total: evidenceRecords.length,
    documents: evidenceRecords.filter((r) => r.fileType === 'document').length,
    images: evidenceRecords.filter((r) => r.fileType === 'image').length,
    audio: evidenceRecords.filter((r) => r.fileType === 'audio').length,
    video: evidenceRecords.filter((r) => r.fileType === 'video').length,
    processing: evidenceRecords.filter((r) => r.processingStatus === 'processing').length,
    complete: evidenceRecords.filter((r) => r.processingStatus === 'complete').length,
  };

  const handleViewEvidence = () => {
    navigate(`/app/cases/${caseId}/evidence-viewer`);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Evidence Intelligence</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload, analyze, and search evidence across all media types
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          <Upload size={16} />
          Upload Evidence
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: BarChart3, color: 'text-gray-600' },
          { label: 'Documents', value: stats.documents, icon: FileText, color: 'text-slate-600' },
          { label: 'Images', value: stats.images, icon: Image, color: 'text-purple-600' },
          { label: 'Audio', value: stats.audio, icon: Mic, color: 'text-amber-600' },
          { label: 'Video', value: stats.video, icon: Video, color: 'text-blue-600' },
          { label: 'Processing', value: stats.processing, icon: Loader2, color: 'text-blue-500' },
          { label: 'Analyzed', value: stats.complete, icon: CheckCircle, color: 'text-green-500' },
        ].map(({ label, value, icon: StatIcon, color }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-lg p-3 text-center">
            <StatIcon size={16} className={`mx-auto mb-1 ${color}`} />
            <p className="text-lg font-bold text-gray-900">{value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Upload Area (Phase 21) */}
      {showUpload && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Upload Evidence</h3>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            <UploadDropzone
              onFilesSelected={handleFilesSelected}
              isUploading={uploadQueue.some((q) => q.status === 'uploading')}
            />
            {uploadQueue.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-500">Upload Queue</h4>
                  {uploadQueue.every(
                    (q) => q.status === 'complete' || q.status === 'error'
                  ) && (
                    <button
                      onClick={() => setUploadQueue([])}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-50">
                  {uploadQueue.map((item) => (
                    <UploadQueueRow key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        {DASHBOARD_TABS.map(({ id, label, icon: TabIcon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <TabIcon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Evidence Tab */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                placeholder="Search evidence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter size={14} className="text-gray-400" />
              {(['all', 'document', 'image', 'audio', 'video'] as FilterType[]).map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterType === type
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {type === 'all' ? 'All' : EVIDENCE_TYPE_LABELS[type]}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Table + Detail Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={selectedRecord ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <Card padding="none">
                <EvidenceTable
                  records={filteredRecords}
                  onSelect={setSelectedRecord}
                  onView={handleViewEvidence}
                  selectedId={selectedRecord?.evidenceId ?? null}
                />
              </Card>
            </div>
            {selectedRecord && (
              <div className="lg:col-span-1">
                <EvidenceDetailPanel
                  record={selectedRecord}
                  processingResult={
                    processingResults.get(selectedRecord.evidenceId) ?? null
                  }
                  onClose={() => setSelectedRecord(null)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Case Evidence Timeline
            </h3>
            <span className="text-xs text-gray-500">{timelineEvents.length} events</span>
          </div>
          <TimelineView events={timelineEvents} />
        </Card>
      )}

      {/* Graph Tab */}
      {activeTab === 'graph' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Evidence Relationships
            </h3>
          </div>
          <GraphView graph={evidenceGraph} />
        </Card>
      )}

      {/* Search Tab (Phase 24) */}
      {activeTab === 'search' && (
        <Card>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Evidence Search</h3>

            {/* Search Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  placeholder="Search across all evidence..."
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-5 py-3 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                Search
              </button>
            </div>

            {/* Search Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <Filter size={12} className="text-gray-400" />
                <span className="text-xs text-gray-500">Type:</span>
                {(['all', 'document', 'image', 'audio', 'video'] as const).map(
                  (type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setSearchFilters({ ...searchFilters, evidenceType: type })
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        searchFilters.evidenceType === type
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {type === 'all' ? 'All' : EVIDENCE_TYPE_LABELS[type]}
                    </button>
                  )
                )}
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-gray-400" />
                <input
                  type="date"
                  value={searchFilters.dateFrom ?? ''}
                  onChange={(e) =>
                    setSearchFilters({
                      ...searchFilters,
                      dateFrom: e.target.value || null,
                    })
                  }
                  className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={searchFilters.dateTo ?? ''}
                  onChange={(e) =>
                    setSearchFilters({
                      ...searchFilters,
                      dateTo: e.target.value || null,
                    })
                  }
                  className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600"
                />
              </div>
              <div className="flex items-center gap-2">
                <User size={12} className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Person mentioned..."
                  value={searchFilters.personMentioned ?? ''}
                  onChange={(e) =>
                    setSearchFilters({
                      ...searchFilters,
                      personMentioned: e.target.value || null,
                    })
                  }
                  className="px-2.5 py-1 rounded border border-gray-200 text-xs text-gray-600 w-40"
                />
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <span className="text-sm font-medium text-gray-700 mb-3 block">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}{' '}
                  found
                </span>
                <SearchResultsList results={searchResults} />
              </div>
            )}

            {globalSearchQuery && searchResults.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                {evidenceRecords.length === 0
                  ? 'Upload and process evidence to enable search.'
                  : 'No results found.'}
              </div>
            )}

            {!globalSearchQuery && (
              <div className="text-center py-8 text-gray-400 text-sm">
                {evidenceRecords.length === 0
                  ? 'Upload and process evidence to enable search.'
                  : `${evidenceRecords.length} evidence items indexed.`}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
