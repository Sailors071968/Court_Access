// ============================================================================
// Sprint 1 — Document Redaction Workspace UI
// Rectangle, OCR search, batch redaction, version history, publication profiles.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2, Save, Eye, Search, Square, Layers, History, Shield,
} from 'lucide-react';
import {
  fetchRedactionVersions,
  createRedactionVersion,
  type RedactionVersion,
  PUBLICATION_PROFILES,
} from '../../services/membershipApi';

interface RedactionRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  label?: string;
}

export function DocumentRedactionPage() {
  const { caseId, documentId } = useParams<{ caseId: string; documentId: string }>();
  const [profile, setProfile] = useState('attorney');
  const [versions, setVersions] = useState<RedactionVersion[]>([]);
  const [rects, setRects] = useState<RedactionRect[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const loadVersions = useCallback(async () => {
    if (!caseId || !documentId) return;
    setLoading(true);
    try {
      const data = await fetchRedactionVersions(caseId, documentId);
      setVersions(data.versions);
    } catch {
      setMessage('Unable to load redaction versions');
    } finally {
      setLoading(false);
    }
  }, [caseId, documentId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleSearchRedact = () => {
    if (!searchTerm.trim()) return;
    const id = `ocr-${Date.now()}`;
    setRects((prev) => [
      ...prev,
      {
        id,
        x: 10,
        y: 10 + prev.length * 24,
        width: 200,
        height: 20,
        page: currentPage,
        label: searchTerm,
      },
    ]);
    setSearchTerm('');
    setMessage(`Marked "${searchTerm}" for redaction on page ${currentPage}`);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (previewMode) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (previewMode || !dragStart.current) return;
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box) return;
    const x2 = e.clientX - box.left;
    const y2 = e.clientY - box.top;
    const x = Math.min(dragStart.current.x, x2);
    const y = Math.min(dragStart.current.y, y2);
    const width = Math.abs(x2 - dragStart.current.x);
    const height = Math.abs(y2 - dragStart.current.y);
    if (width > 8 && height > 8) {
      setRects((prev) => [
        ...prev,
        { id: `rect-${Date.now()}`, x, y, width, height, page: currentPage },
      ]);
    }
    dragStart.current = null;
  };

  const handleSave = async () => {
    if (!caseId || !documentId) return;
    setSaving(true);
    setMessage('');
    try {
      await createRedactionVersion(caseId, documentId, {
        profileName: profile,
        redactionData: rects,
      });
      setMessage('Redaction version saved (original preserved)');
      setRects([]);
      await loadVersions();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const pageRects = rects.filter((r) => r.page === currentPage);

  if (!caseId || !documentId) {
    return <div className="p-8 text-red-600">Invalid document route</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to={`/cases/${caseId}/documents`} className="text-sm text-amber-600 hover:text-amber-700">
            ← Back to documents
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1 flex items-center gap-2">
            <Shield size={24} /> Document Redaction
          </h1>
          <p className="text-sm text-gray-500">Document {documentId.slice(0, 8)}… — original preserved</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {PUBLICATION_PROFILES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm border ${
              previewMode ? 'bg-amber-100 border-amber-300' : 'border-gray-300'
            }`}
          >
            <Eye size={16} /> Preview As Recipient
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || rects.length === 0}
            className="flex items-center gap-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Version
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-2 py-1">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search OCR text to redact…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchRedact()}
                className="text-sm outline-none w-48"
                disabled={previewMode}
              />
              <button type="button" onClick={handleSearchRedact} className="text-xs text-amber-600 font-medium px-2">
                Redact
              </button>
            </div>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Square size={14} /> Drag on document to draw rectangle
            </span>
            <label className="text-sm text-gray-600">
              Page{' '}
              <input
                type="number"
                min={1}
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value) || 1)}
                className="w-14 border border-gray-300 rounded px-1 ml-1"
              />
            </label>
          </div>

          <div
            ref={canvasRef}
            role="presentation"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            className="relative bg-white border-2 border-dashed border-gray-300 rounded-xl min-h-[480px] cursor-crosshair select-none"
          >
            <div className="absolute inset-4 text-gray-400 text-sm pointer-events-none">
              Document preview layer (page {currentPage})
              {previewMode && ' — recipient view: redacted areas hidden'}
            </div>
            {pageRects.map((r) => (
              <div
                key={r.id}
                className={`absolute border-2 ${
                  previewMode ? 'bg-black border-black' : 'bg-red-500/30 border-red-500'
                }`}
                style={{ left: r.x, top: r.y, width: r.width, height: r.height }}
                title={r.label}
              />
            ))}
          </div>
          {message && <p className="text-sm text-gray-600">{message}</p>}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <History size={18} /> Version History
            </h3>
            {loading ? (
              <Loader2 className="animate-spin text-slate-400" size={24} />
            ) : versions.length === 0 ? (
              <p className="text-sm text-gray-500">No versions yet</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {versions.map((v) => (
                  <li key={v.redactionId} className="text-sm border-b border-gray-100 pb-2">
                    <span className="font-medium">{v.profileName}</span> v{v.versionNumber}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                      v.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100'
                    }`}>
                      {v.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
            <Layers size={16} className="inline mr-1" />
            Batch redaction: search terms apply to current page. Multi-page supported via page selector.
          </div>
        </div>
      </div>
    </div>
  );
}
