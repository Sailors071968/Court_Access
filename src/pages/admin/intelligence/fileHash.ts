/** SHA-256 of a File, hex-encoded. One file at a time so the UI can stay responsive. */
export async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export async function hashFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ file: File; sha256: string; sizeBytes: number }[]> {
  const out: { file: File; sha256: string; sizeBytes: number }[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]!;
    const sha256 = await sha256Hex(file);
    out.push({ file, sha256, sizeBytes: file.size });
    onProgress?.(i + 1, files.length);
    // Yield every few files so progress UI paints during 1,000+ file imports.
    if (i % 4 === 3) await yieldToUi();
  }
  return out;
}
