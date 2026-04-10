// ============================================
// Court Access — Upload Discovery Materials Tab
// ============================================

import { useState, useEffect } from 'react';
import { Upload, FileText, Film, Image, CheckCircle, MoreHorizontal, Eye } from 'lucide-react';
import { Card } from '../../components/common/Card';

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  date: string;
  status: 'analyzed' | 'processing' | 'pending';
  type: 'pdf' | 'mp4' | 'jpg';
}



export function DocumentsPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);

  useEffect(() => {
    async function fetchUploads() {
      try {
        const res = await fetch("/api/evidence/uploads");
        if (res.ok) {
          const json = await res.json();
          if (json.data) setUploads(json.data);
        }
      } catch {
        // API not available yet
      }
    }
    fetchUploads();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const fileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText size={20} className="text-red-500" />;
      case 'mp4': return <Film size={20} className="text-blue-500" />;
      case 'jpg': return <Image size={20} className="text-green-500" />;
      default: return <FileText size={20} className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Upload Discovery Materials</h2>
          <p className="text-sm text-gray-500 mt-1">Securely add digital evidence, documents, and multimedia for analysis.</p>
          <p className="text-sm text-gray-400">Supported formats: PDF, MP4, JPG/PNG.</p>
        </div>
        {uploads.length > 0 && <span className="text-sm text-gray-500">Status: {uploads.length} files uploaded</span>}
      </div>

      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-amber-300 bg-amber-50/30'
        }`}
      >
        <Upload size={40} className="mx-auto mb-4 text-gray-400" />
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded">PDF</span>
          <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded">MP4</span>
          <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded">JPG/PNG</span>
        </div>
        <p className="text-gray-600 font-medium">Drag & Drop files here or Click to browse</p>
        <input type="file" className="hidden" id="file-upload" multiple accept=".pdf,.mp4,.jpg,.jpeg,.png" />
        <label htmlFor="file-upload" className="mt-4 inline-block px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-700 transition-colors">
          Browse Files
        </label>
      </div>

      {/* Recently Uploaded Files */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Uploaded Files</h3>
        <div className="space-y-3">
          {uploads.map((file) => (
            <Card key={file.id} padding="sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {fileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{file.size} | {file.date} | {file.status === 'analyzed' ? 'Analyzed' : file.status === 'processing' ? 'Processing' : 'Pending'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {file.status === 'analyzed' && (
                    <CheckCircle size={20} className="text-green-500" />
                  )}
                  {file.status === 'processing' && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm">
                      <span className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full" />
                      Processing...
                    </div>
                  )}
                  {file.status === 'analyzed' ? (
                    <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 inline-flex items-center gap-1">
                      <Eye size={12} /> View Analysis
                    </button>
                  ) : file.status === 'processing' ? (
                    <button className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-300">
                      Cancel
                    </button>
                  ) : null}
                  <button className="p-1 text-gray-400 hover:text-gray-600" aria-label="More options">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
