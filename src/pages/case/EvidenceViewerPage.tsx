// ============================================
// Court Access — Evidence Viewer Page (Phase 25)
// Full-screen viewer for all evidence types:
// document, audio, video, image.
// ============================================

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Image,
  Mic,
  Video,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  Download,
  Shield,
  Clock,
  ZoomIn,
  ZoomOut,
  Copy,
  CheckCircle,
  Search,
  Maximize2,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import type { EvidenceType } from '../../models/EvidenceModel';

// ---------------------------------------------------------------------------
// Evidence Viewer Props
// ---------------------------------------------------------------------------

interface ViewerProps {
  evidenceId: string;
  fileName: string;
  fileType: EvidenceType;
  fileSize: number;
  mimeType: string;
  uploadTimestamp: string;
  sha256Hash: string;
  extractedText: string;
  summary: string;
  transcript: string | null;
  ocrText: string | null;
  entities: { name: string; type: string; count: number }[];
  keyPoints: string[];
  pageCount: number | null;
  duration: number | null;
}

// ---------------------------------------------------------------------------
// Document Viewer
// ---------------------------------------------------------------------------

function DocumentViewer({
  fileName,
  extractedText,
  summary,
  entities,
  keyPoints,
  pageCount,
}: ViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const totalPages = pageCount ?? 1;

  // Escape HTML to prevent XSS before applying search highlights
  const escapeHtml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const highlightedText = searchQuery
    ? escapeHtml(extractedText).replace(
        new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
        '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>'
      )
    : escapeHtml(extractedText);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Document Content */}
      <div className="lg:col-span-2 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
              aria-label="Toggle search"
            >
              <Search size={14} />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded" aria-label="Download">
              <Download size={14} />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="mb-3">
            <input
              type="search"
              placeholder="Search in document..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="Search document text"
            />
          </div>
        )}

        <Card className="flex-1 overflow-auto">
          <div
            className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: highlightedText }}
          />
        </Card>

        {/* Page Navigation */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Sidebar: AI Analysis */}
      <div className="space-y-4">
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">AI Summary</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
        </Card>

        {keyPoints.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Key Points</h3>
            <ul className="space-y-1.5">
              {keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-blue-500 mt-0.5">&#8226;</span>
                  {point}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {entities.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Detected Entities</h3>
            <div className="flex flex-wrap gap-1.5">
              {entities.map((entity, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {entity.name}
                  <span className="text-gray-400">({entity.count})</span>
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audio Player
// ---------------------------------------------------------------------------

function AudioViewer({
  fileName,
  transcript,
  summary,
  entities,
  keyPoints,
  duration,
}: ViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const totalDuration = duration ?? 300;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Player + Transcript */}
      <div className="lg:col-span-2 space-y-4">
        {/* Audio Player */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Mic size={16} className="text-amber-500" />
            <span className="text-sm font-medium text-gray-700">{fileName}</span>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            {/* Waveform placeholder */}
            <div className="h-16 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
              <div className="flex items-end gap-0.5 h-12">
                {Array.from({ length: 60 }, (_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-amber-400 rounded-full"
                    style={{ height: `${Math.random() * 100}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center hover:bg-amber-600 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <span className="text-xs text-gray-500 w-12">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <input
                  type="range"
                  min={0}
                  max={totalDuration}
                  value={currentTime}
                  onChange={(e) => setCurrentTime(Number(e.target.value))}
                  className="w-full h-1.5 appearance-none bg-transparent cursor-pointer"
                  style={{ position: 'relative', top: '-3px' }}
                  aria-label="Audio seek"
                />
              </div>
              <span className="text-xs text-gray-500 w-12 text-right">{formatTime(totalDuration)}</span>
              <Volume2 size={14} className="text-gray-400" />
            </div>
          </div>
        </Card>

        {/* Transcript */}
        {transcript && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Transcript</h3>
              <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Copy size={12} /> Copy
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {transcript}
              </pre>
            </div>
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">AI Summary</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
        </Card>

        {keyPoints.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Key Points</h3>
            <ul className="space-y-1.5">
              {keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-blue-500 mt-0.5">&#8226;</span>
                  {point}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {entities.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Detected Entities</h3>
            <div className="flex flex-wrap gap-1.5">
              {entities.map((entity, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {entity.name}
                  <span className="text-gray-400">({entity.count})</span>
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Video Player
// ---------------------------------------------------------------------------

function VideoViewer({
  fileName,
  transcript,
  summary,
  entities,
  keyPoints,
  duration,
}: ViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const totalDuration = duration ?? 180;

  const timelineMarkers = [
    { time: 0, label: 'Recording start' },
    { time: Math.floor(totalDuration * 0.2), label: 'Key frame: Document visible' },
    { time: Math.floor(totalDuration * 0.45), label: 'Evidence presented' },
    { time: Math.floor(totalDuration * 0.7), label: 'Scene change' },
    { time: totalDuration, label: 'Recording end' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {/* Video Player */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Video size={16} className="text-blue-500" />
            <span className="text-sm font-medium text-gray-700">{fileName}</span>
          </div>

          {/* Video placeholder */}
          <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center relative">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? <Pause size={24} className="text-white" /> : <Play size={24} className="text-white ml-1" />}
            </button>
            <div className="absolute bottom-3 right-3">
              <button className="p-1.5 bg-white/20 backdrop-blur rounded text-white" aria-label="Fullscreen">
                <Maximize2 size={14} />
              </button>
            </div>
          </div>
        </Card>

        {/* Timeline Markers */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Timeline Markers</h3>
          <div className="space-y-2">
            {timelineMarkers.map((marker, i) => {
              const m = Math.floor(marker.time / 60);
              const s = marker.time % 60;
              return (
                <button
                  key={i}
                  className="flex items-center gap-3 w-full text-left px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xs font-mono text-blue-600 w-10">
                    {m}:{String(s).padStart(2, '0')}
                  </span>
                  <Clock size={12} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{marker.label}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Transcript */}
        {transcript && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Transcript</h3>
              <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Copy size={12} /> Copy
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {transcript}
              </pre>
            </div>
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">AI Summary</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
        </Card>

        {keyPoints.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Key Points</h3>
            <ul className="space-y-1.5">
              {keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-blue-500 mt-0.5">&#8226;</span>
                  {point}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {entities.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Detected Entities</h3>
            <div className="flex flex-wrap gap-1.5">
              {entities.map((entity, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {entity.name}
                  <span className="text-gray-400">({entity.count})</span>
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image Viewer
// ---------------------------------------------------------------------------

function ImageViewer({
  fileName,
  summary,
  entities,
  ocrText,
}: ViewerProps) {
  const [zoom, setZoom] = useState(100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Image Display */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Image size={16} className="text-purple-500" />
              <span className="text-sm font-medium text-gray-700">{fileName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(25, zoom - 25))}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                aria-label="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-xs text-gray-500 w-10 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                aria-label="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
              <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded" aria-label="Download">
                <Download size={14} />
              </button>
            </div>
          </div>

          {/* Image placeholder */}
          <div
            className="bg-gray-100 rounded-xl flex items-center justify-center overflow-auto"
            style={{ minHeight: '400px' }}
          >
            <div
              className="bg-gray-200 rounded-lg flex items-center justify-center"
              style={{
                width: `${Math.round(400 * zoom / 100)}px`,
                height: `${Math.round(300 * zoom / 100)}px`,
              }}
            >
              <div className="text-center">
                <Image size={48} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">{fileName}</p>
                <p className="text-xs text-gray-400 mt-1">Image preview</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Sidebar: OCR + Analysis */}
      <div className="space-y-4">
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">AI Analysis</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
        </Card>

        {ocrText && (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">OCR Extracted Text</h3>
              <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Copy size={12} /> Copy
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{ocrText}</pre>
            </div>
          </Card>
        )}

        {entities.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Detected Entities</h3>
            <div className="flex flex-wrap gap-1.5">
              {entities.map((entity, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {entity.name}
                  <span className="text-gray-400">({entity.count})</span>
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Evidence Viewer Page
// ---------------------------------------------------------------------------

// Demo evidence for viewer (used when navigating directly)
const DEMO_VIEWER_DATA: ViewerProps = {
  evidenceId: 'ev-demo-001',
  fileName: 'Police_Report_2026-01-15.pdf',
  fileType: 'document',
  fileSize: 2457600,
  mimeType: 'application/pdf',
  uploadTimestamp: '2026-01-20T14:30:00Z',
  sha256Hash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  extractedText: `INCIDENT REPORT — Case #2026-CR-4521\n\nDate of Incident: January 15, 2026\nLocation: 1234 Main Street, Los Angeles, CA 90001\nReporting Officer: Officer M. Johnson, Badge #4521\n\nNARRATIVE:\n\nOn January 15, 2026, at approximately 2:30 PM, I responded to a call at the above location regarding a reported disturbance. Upon arrival, I observed the following:\n\n1. The premises appeared to be a residential property with signs of recent activity.\n2. Multiple witnesses were present at the scene.\n3. Physical evidence was collected and documented per department protocol.\n\nEVIDENCE COLLECTED:\n- Item #1: Photographic documentation of the scene (12 images)\n- Item #2: Written witness statements (3 statements)\n- Item #3: Physical evidence samples (logged in evidence locker)\n\nWITNESS STATEMENTS:\n\nWitness 1 (Name redacted): Stated they observed activity at the location beginning at approximately 2:00 PM. Described hearing raised voices followed by the sound of objects being moved.\n\nWitness 2 (Name redacted): Corroborated the timeline provided by Witness 1. Added that they observed two individuals leaving the premises at approximately 2:25 PM.\n\nCONCLUSION:\n\nBased on the evidence collected and witness statements obtained, this case has been classified for further investigation. All evidence has been properly logged and secured per department chain of custody procedures.\n\nReport filed by: Officer M. Johnson\nDate filed: January 15, 2026\nSupervisor review: Sgt. R. Williams`,
  summary: 'Police incident report for Case #2026-CR-4521 dated January 15, 2026. Report documents a disturbance at 1234 Main Street, Los Angeles. Officer M. Johnson collected physical evidence, photographic documentation, and 3 witness statements. Two witnesses corroborate the timeline. Evidence properly logged per chain of custody procedures.',
  transcript: null,
  ocrText: null,
  entities: [
    { name: 'Officer M. Johnson', type: 'person', count: 3 },
    { name: 'Sgt. R. Williams', type: 'person', count: 1 },
    { name: '1234 Main Street, Los Angeles', type: 'location', count: 2 },
    { name: 'January 15, 2026', type: 'date', count: 3 },
    { name: 'Case #2026-CR-4521', type: 'case_number', count: 1 },
    { name: 'Los Angeles PD', type: 'organization', count: 1 },
  ],
  keyPoints: [
    'Incident occurred January 15, 2026 at 2:30 PM',
    '3 witness statements collected and documented',
    'Physical evidence secured per chain of custody',
    'Case classified for further investigation',
    'Photographic documentation includes 12 images',
  ],
  pageCount: 8,
  duration: null,
};

export function EvidenceViewerPage() {
  const { caseId } = useParams();
  const data = DEMO_VIEWER_DATA;

  const VIEWERS: Record<EvidenceType, (props: ViewerProps) => JSX.Element> = {
    document: DocumentViewer,
    image: ImageViewer,
    audio: AudioViewer,
    video: VideoViewer,
  };

  const Viewer = VIEWERS[data.fileType];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`/app/cases/${caseId}/evidence-intelligence`}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{data.fileName}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-gray-500">{data.evidenceId}</span>
              <span className="text-xs text-gray-400">&#8226;</span>
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Shield size={10} /> Integrity Verified
              </span>
              <span className="text-xs text-gray-400">&#8226;</span>
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle size={10} /> Analysis Complete
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={14} />
            Download
          </button>
        </div>
      </div>

      {/* Viewer */}
      <Viewer {...data} />
    </div>
  );
}
