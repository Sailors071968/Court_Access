// =============================================================================
// CourtAccess — Reusable Media Preview (Program 28)
// Image / video / audio / PDF / text viewers. Renders real media when a URL is
// available; otherwise a rich, honest placeholder with file metadata.
// =============================================================================

import { FileText, Image as ImageIcon, Film, Music, File as FileIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type MediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other';

export function mediaKind(fileName: string, mimeType?: string | null): MediaKind {
  const mt = (mimeType ?? '').toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (mt.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (mt.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return 'video';
  if (mt.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext)) return 'audio';
  if (mt === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mt.startsWith('text/') || ['txt', 'csv', 'json', 'md'].includes(ext)) return 'text';
  return 'other';
}

const KIND_ICON = { image: ImageIcon, video: Film, audio: Music, pdf: FileText, text: FileText, other: FileIcon };

interface MediaPreviewProps {
  fileName: string;
  mimeType?: string | null;
  url?: string;
  pageCount?: number | null;
  duration?: number | null;
  className?: string;
}

export function MediaPreview({ fileName, mimeType, url, pageCount, duration, className }: MediaPreviewProps) {
  const kind = mediaKind(fileName, mimeType);
  const Icon = KIND_ICON[kind];

  if (url) {
    return (
      <div className={cn('rounded-xl overflow-hidden bg-navy-900/60 border border-white/10', className)}>
        {kind === 'image' && <img src={url} alt={fileName} className="w-full h-full object-contain" />}
        {kind === 'video' && <video src={url} controls className="w-full h-full" />}
        {kind === 'audio' && (
          <div className="p-6 flex flex-col items-center gap-3">
            <Music size={28} className="text-gold-light" />
            <audio src={url} controls className="w-full" />
          </div>
        )}
        {kind === 'pdf' && <iframe src={url} title={fileName} className="w-full h-full min-h-[24rem]" />}
        {(kind === 'text' || kind === 'other') && (
          <div className="p-6 text-center">
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-gold-light hover:underline text-sm">
              Open {fileName}
            </a>
          </div>
        )}
      </div>
    );
  }

  // Honest placeholder — bytes not yet loaded; show type + metadata.
  return (
    <div className={cn('rounded-xl bg-navy-900/60 border border-white/10 flex flex-col items-center justify-center text-center p-8 min-h-[16rem]', className)}>
      <div className="w-14 h-14 rounded-2xl ca-icon-gold text-gold-light flex items-center justify-center mb-3">
        <Icon size={24} />
      </div>
      <p className="text-sm font-medium text-white truncate max-w-full">{fileName}</p>
      <p className="text-xs text-slate-400 mt-1 capitalize">{kind} preview</p>
      <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400">
        {pageCount ? <span>{pageCount} pages</span> : null}
        {duration ? <span>{Math.round(duration)}s</span> : null}
      </div>
    </div>
  );
}
