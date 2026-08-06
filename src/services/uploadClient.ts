// ============================================================================
// Chunked upload client.
//
// Sends a local selection — a folder, a set of files, a ZIP — to the
// certification portal a chunk at a time. Chunking keeps memory flat for large
// files and makes an interrupted upload resumable: the server is asked what it
// already holds and the transfer continues from there.
//
// Everything is awaited between chunks, so the main thread is never blocked
// and the page stays responsive throughout.
// ============================================================================

export interface SelectedFile {
  file: File;
  /** Path within the selected folder, as the browser reported it. */
  relativePath: string;
}

export interface FileProgress {
  relativePath: string;
  size: number;
  sent: number;
  status: 'pending' | 'uploading' | 'complete' | 'failed';
  error?: string;
}

export interface UploadProgress {
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  sentBytes: number;
  currentFile: string | null;
  bytesPerSecond: number;
  secondsRemaining: number | null;
  filesRemaining: number;
  files: FileProgress[];
}

export type ProgressHandler = (progress: UploadProgress) => void;

interface StartOptions {
  uploadSessionId: string;
  chunkBytes: number;
  files: SelectedFile[];
  onProgress: ProgressHandler;
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Drives one upload. Pause, resume, cancel and retry are all methods on the
 * returned controller so the UI can wire them to buttons directly.
 */
export class UploadController {
  private paused = false;
  private cancelled = false;
  private running = false;

  private readonly progressByPath = new Map<string, FileProgress>();
  private sentBytes = 0;
  private readonly totalBytes: number;

  /** Sliding window of recent throughput, so the rate shown is not jumpy. */
  private samples: Array<{ at: number; bytes: number }> = [];

  constructor(private readonly options: StartOptions) {
    this.totalBytes = options.files.reduce((s, f) => s + f.file.size, 0);
    for (const f of options.files) {
      this.progressByPath.set(f.relativePath, {
        relativePath: f.relativePath,
        size: f.file.size,
        sent: 0,
        status: 'pending',
      });
    }
  }

  pause(): void {
    this.paused = true;
  }

  isPaused(): boolean {
    return this.paused;
  }

  cancel(): void {
    this.cancelled = true;
    this.paused = false;
  }

  private emit(currentFile: string | null): void {
    const files = [...this.progressByPath.values()];
    const completedFiles = files.filter((f) => f.status === 'complete').length;

    // Throughput over the last few seconds rather than since the beginning, so
    // the estimate reacts to a change in connection speed.
    const now = Date.now();
    this.samples = this.samples.filter((s) => now - s.at < 8000);
    const windowBytes = this.samples.reduce((s, x) => s + x.bytes, 0);
    const windowMs = this.samples.length > 1 ? now - this.samples[0].at : 0;
    const bytesPerSecond = windowMs > 250 ? Math.round((windowBytes / windowMs) * 1000) : 0;

    const remainingBytes = Math.max(0, this.totalBytes - this.sentBytes);
    const secondsRemaining = bytesPerSecond > 0 ? Math.round(remainingBytes / bytesPerSecond) : null;

    this.options.onProgress({
      totalFiles: files.length,
      completedFiles,
      totalBytes: this.totalBytes,
      sentBytes: this.sentBytes,
      currentFile,
      bytesPerSecond,
      secondsRemaining,
      filesRemaining: files.length - completedFiles,
      files,
    });
  }

  /** Ask the server what it already holds, so a resumed run skips it. */
  private async serverOffsets(): Promise<Map<string, number>> {
    const res = await fetch(`/api/certification/uploads/${this.options.uploadSessionId}/manifest`, {
      headers: authHeader(),
    });
    if (!res.ok) return new Map();
    const body = await res.json();
    return new Map<string, number>((body.held ?? []).map((h: { relativePath: string; bytes: number }) => [h.relativePath, h.bytes]));
  }

  private async sendChunk(
    entry: SelectedFile,
    offset: number,
    blob: Blob,
    isFinal: boolean,
  ): Promise<{ ok: boolean; offset: number; message?: string }> {
    const form = new FormData();
    form.append('relativePath', entry.relativePath);
    form.append('offset', String(offset));
    form.append('totalSize', String(entry.file.size));
    form.append('lastModified', String(entry.file.lastModified));
    form.append('isFinal', isFinal ? 'true' : 'false');
    form.append('chunk', blob, 'chunk');

    const res = await fetch(`/api/certification/uploads/${this.options.uploadSessionId}/chunk`, {
      method: 'PUT',
      headers: authHeader(),
      body: form,
    });

    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, offset: body.offset ?? offset + blob.size };

    // The server tells us where it really is; the caller resumes from there.
    if (res.status === 409 && typeof body.offset === 'number') {
      return { ok: false, offset: body.offset, message: body.message };
    }
    return { ok: false, offset, message: body.message || body.error || `Upload failed with status ${res.status}` };
  }

  /**
   * Send everything not already held. Safe to call again after a pause or a
   * failure: it re-reads the server's position first and only sends what is
   * missing.
   */
  async run(): Promise<{ completed: boolean; failed: FileProgress[] }> {
    if (this.running) return { completed: false, failed: [] };
    this.running = true;
    this.paused = false;

    try {
      const held = await this.serverOffsets();

      // Account for anything already on the server before we start.
      this.sentBytes = 0;
      for (const entry of this.options.files) {
        const p = this.progressByPath.get(entry.relativePath)!;
        const already = held.get(entry.relativePath) ?? 0;
        if (already >= entry.file.size && entry.file.size > 0) {
          p.sent = entry.file.size;
          p.status = 'complete';
        } else if (p.status !== 'failed') {
          p.sent = already;
          p.status = already > 0 ? 'uploading' : 'pending';
        }
        this.sentBytes += p.sent;
      }
      this.emit(null);

      for (const entry of this.options.files) {
        if (this.cancelled) break;
        const p = this.progressByPath.get(entry.relativePath)!;
        if (p.status === 'complete') continue;

        p.status = 'uploading';
        p.error = undefined;
        let offset = p.sent;

        // A zero-byte file still has to be sent, as one final empty chunk,
        // otherwise it never arrives at all.
        if (entry.file.size === 0) {
          const res = await this.sendChunk(entry, 0, new Blob([]), true);
          if (res.ok) {
            p.status = 'complete';
          } else {
            p.status = 'failed';
            p.error = res.message;
          }
          this.emit(entry.relativePath);
          continue;
        }

        while (offset < entry.file.size) {
          if (this.cancelled) break;
          if (this.paused) {
            this.emit(entry.relativePath);
            this.running = false;
            return { completed: false, failed: this.failedFiles() };
          }

          const end = Math.min(offset + this.options.chunkBytes, entry.file.size);
          const isFinal = end === entry.file.size;
          const before = offset;

          const res = await this.sendChunk(entry, offset, entry.file.slice(offset, end), isFinal);

          if (!res.ok) {
            if (res.offset !== before) {
              // Server is ahead of or behind us; realign and carry on.
              offset = res.offset;
              p.sent = offset;
              continue;
            }
            p.status = 'failed';
            p.error = res.message ?? 'The chunk was rejected.';
            break;
          }

          this.sentBytes += res.offset - offset;
          this.samples.push({ at: Date.now(), bytes: res.offset - offset });
          offset = res.offset;
          p.sent = offset;
          this.emit(entry.relativePath);

          // Yield to the event loop so the page stays responsive on very
          // large files.
          await new Promise((r) => setTimeout(r, 0));
        }

        if (p.status !== 'failed' && offset >= entry.file.size) p.status = 'complete';
        this.emit(entry.relativePath);
      }

      this.emit(null);
      const failed = this.failedFiles();
      return { completed: !this.cancelled && failed.length === 0, failed };
    } finally {
      this.running = false;
    }
  }

  private failedFiles(): FileProgress[] {
    return [...this.progressByPath.values()].filter((f) => f.status === 'failed');
  }

  /** Clear the failures so `run` will attempt them again. */
  retryFailed(): void {
    for (const p of this.progressByPath.values()) {
      if (p.status === 'failed') {
        p.status = 'pending';
        p.error = undefined;
      }
    }
  }
}

/**
 * Flatten a drop or a file input into the selection, keeping the folder path.
 * A dropped folder arrives as a directory entry that has to be walked.
 */
export async function collectFromDataTransfer(
  items: DataTransferItemList,
  fallbackFiles?: FileList | null,
): Promise<SelectedFile[]> {
  const out: SelectedFile[] = [];

  async function walkEntry(entry: FileSystemEntry, prefix: string): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      ).catch(() => null);
      if (file) out.push({ file, relativePath: `${prefix}${entry.name}` });
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns at most 100 at a time, so it has to be drained.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve) =>
          reader.readEntries(resolve, () => resolve([])),
        );
        if (batch.length === 0) break;
        for (const child of batch) await walkEntry(child, `${prefix}${entry.name}/`);
      }
    }
  }

  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  for (const entry of entries) await walkEntry(entry, '');

  // Not every browser or drag source exposes filesystem entries. When none are
  // available the plain file list still is, and dropping files has to work.
  if (out.length === 0 && fallbackFiles && fallbackFiles.length > 0) {
    for (let i = 0; i < fallbackFiles.length; i++) {
      const file = fallbackFiles[i];
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      out.push({ file, relativePath: rel && rel.length > 0 ? rel : file.name });
    }
  }

  return out;
}

/** Flatten a file input, honouring webkitdirectory when a folder was chosen. */
export function collectFromInput(fileList: FileList): SelectedFile[] {
  const out: SelectedFile[] = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    out.push({ file, relativePath: rel && rel.length > 0 ? rel : file.name });
  }
  return out;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
