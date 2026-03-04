// ============================================
// Court Access — Extraction Pipeline (Stage 2)
// OCR / text extraction from documents.
// ============================================

import { logger } from '../utils/loggingUtils.js';

/**
 * Stage 2: Extract text from a document buffer.
 * Supports PDF (via pdf-parse) and plain text.
 */
export async function runExtractionPipeline(
  buffer: Buffer,
  fileType: string
): Promise<string> {
  switch (fileType) {
    case 'pdf':
      return extractFromPdf(buffer);
    case 'txt':
      return extractFromText(buffer);
    case 'docx':
      return extractFromDocx(buffer);
    default:
      logger.warn('Unsupported file type for extraction', { fileType });
      return '';
  }
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to handle optional dependency
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    logger.info('PDF text extracted', {
      pages: data.numpages,
      textLength: data.text.length,
    });
    return data.text;
  } catch (error) {
    logger.error('PDF extraction failed', { error: (error as Error).message });
    return '';
  }
}

function extractFromText(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  // Basic DOCX extraction — extracts raw text from the XML
  // For production, use a dedicated DOCX parser
  try {
    const text = buffer.toString('utf-8');
    // Simple XML text extraction — strips tags
    const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    logger.info('DOCX text extracted', { textLength: stripped.length });
    return stripped;
  } catch (error) {
    logger.error('DOCX extraction failed', { error: (error as Error).message });
    return '';
  }
}
