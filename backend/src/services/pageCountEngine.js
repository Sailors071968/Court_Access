// ============================================
// Court Access — Document Page Counting Engine
// Phase 115: Automatic page count detection
//
// Supports:
// - PDF (via pdf-parse)
// - DOCX (via XML word count heuristic)
// - Images (1 page per image)
// ============================================

import pdfParse from 'pdf-parse';

/**
 * Count pages in a document buffer based on content type.
 *
 * @param {Buffer} fileBuffer - The file content
 * @param {string} contentType - MIME type of the file
 * @param {string} filename - Original filename (fallback for type detection)
 * @returns {Promise<{ pageCount: number, method: string }>}
 */
export async function countPages(fileBuffer, contentType, filename = '') {
  if (!fileBuffer || fileBuffer.length === 0) {
    return { pageCount: 0, method: 'empty' };
  }

  // PDF
  if (contentType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    return countPdfPages(fileBuffer);
  }

  // DOCX
  if (
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    filename.toLowerCase().endsWith('.docx')
  ) {
    return countDocxPages(fileBuffer);
  }

  // DOC (legacy Word)
  if (contentType === 'application/msword' || filename.toLowerCase().endsWith('.doc')) {
    return countDocPages(fileBuffer);
  }

  // Plain text
  if (contentType === 'text/plain' || filename.toLowerCase().endsWith('.txt')) {
    return countTextPages(fileBuffer);
  }

  // Images — always 1 page
  if (contentType.startsWith('image/')) {
    return { pageCount: 1, method: 'image' };
  }

  // Unknown type — default to 1 page
  return { pageCount: 1, method: 'unknown_default' };
}

/**
 * Count pages in a PDF using pdf-parse.
 */
async function countPdfPages(fileBuffer) {
  try {
    const data = await pdfParse(fileBuffer);
    return { pageCount: data.numpages || 1, method: 'pdf-parse' };
  } catch (err) {
    console.warn(`[PageCount] PDF parse failed: ${err.message}`);
    // Fallback: estimate from file size (avg ~3KB per page for text PDFs)
    const estimated = Math.max(1, Math.ceil(fileBuffer.length / 3000));
    return { pageCount: estimated, method: 'pdf-estimate' };
  }
}

/**
 * Count pages in a DOCX by estimating from word count.
 * DOCX files are ZIP archives containing XML. We extract the word count
 * from the document properties or estimate from content length.
 * Average page ≈ 250-300 words ≈ 1500-1800 characters.
 */
async function countDocxPages(fileBuffer) {
  try {
    // DOCX is a ZIP file — look for the document.xml inside
    // Simple heuristic: extract text content length and estimate pages
    const content = fileBuffer.toString('utf8', 0, Math.min(fileBuffer.length, 1024 * 1024));

    // Count XML text nodes (rough approximation)
    const textMatches = content.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (textMatches) {
      const totalChars = textMatches.reduce((sum, match) => {
        const text = match.replace(/<[^>]+>/g, '');
        return sum + text.length;
      }, 0);
      // ~1800 characters per page
      const pages = Math.max(1, Math.ceil(totalChars / 1800));
      return { pageCount: pages, method: 'docx-text-estimate' };
    }

    // Fallback: estimate from file size
    const estimated = Math.max(1, Math.ceil(fileBuffer.length / 5000));
    return { pageCount: estimated, method: 'docx-size-estimate' };
  } catch (err) {
    console.warn(`[PageCount] DOCX parse failed: ${err.message}`);
    return { pageCount: 1, method: 'docx-fallback' };
  }
}

/**
 * Estimate pages for legacy .doc files from file size.
 */
function countDocPages(fileBuffer) {
  const estimated = Math.max(1, Math.ceil(fileBuffer.length / 5000));
  return { pageCount: estimated, method: 'doc-size-estimate' };
}

/**
 * Count pages in a text file based on character count.
 * ~1800 characters per page (standard US letter, 12pt).
 */
function countTextPages(fileBuffer) {
  const charCount = fileBuffer.length;
  const pages = Math.max(1, Math.ceil(charCount / 1800));
  return { pageCount: pages, method: 'text-char-estimate' };
}
