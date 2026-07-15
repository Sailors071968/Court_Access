// ---------------------------------------------------------------------------
// Phase 12 — OCR Pipeline / Document Text Extraction Service
// Preferred extraction order:
//   1. pdf-parse (fast, for text-based PDFs)
//   2. AWS Textract (complex scans)
//   3. Tesseract.js (fallback)
// ---------------------------------------------------------------------------

import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';

const S3_REGION = process.env.AWS_REGION ?? 'us-west-2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  fullText: string;
  pageCount: number;
  confidenceScore: number;
  method: 'pdf-parse' | 'textract' | 'tesseract' | 'none';
  extractionTimeMs: number;
}

// ---------------------------------------------------------------------------
// Method 1: pdf-parse (fast, text-based PDFs)
// ---------------------------------------------------------------------------

export async function extractTextFromPDF(
  documentBytes: Buffer,
): Promise<ExtractionResult> {
  const start = Date.now();

  try {
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule as unknown as {
      default: (buf: Buffer) => Promise<{ text: string; numpages: number }>;
    }).default;
    const pdfData = await pdfParse(documentBytes);

    const text = pdfData.text?.trim() || '';
    const pageCount = pdfData.numpages || 1;

    // Confidence: high if substantial text found
    const confidenceScore = text.length > 100 ? 0.95 : text.length > 20 ? 0.7 : 0.1;

    return {
      fullText: text,
      pageCount,
      confidenceScore,
      method: 'pdf-parse',
      extractionTimeMs: Date.now() - start,
    };
  } catch (error) {
    console.warn(
      '[OCR] pdf-parse failed:',
      error instanceof Error ? error.message : error,
    );
    return {
      fullText: '',
      pageCount: 0,
      confidenceScore: 0,
      method: 'pdf-parse',
      extractionTimeMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Method 2: AWS Textract (complex scans, images)
// ---------------------------------------------------------------------------

export async function extractTextWithTextract(
  documentBytes: Buffer,
): Promise<ExtractionResult> {
  const start = Date.now();

  try {
    const textract = new TextractClient({ region: S3_REGION });

    const response = await textract.send(
      new DetectDocumentTextCommand({
        Document: { Bytes: documentBytes },
      }),
    );

    if (!response.Blocks) {
      return {
        fullText: '',
        pageCount: 0,
        confidenceScore: 0,
        method: 'textract',
        extractionTimeMs: Date.now() - start,
      };
    }

    // Extract LINE blocks sorted by page and position
    const lines = response.Blocks
      .filter((block) => block.BlockType === 'LINE')
      .sort((a, b) => {
        const pageA = a.Page ?? 1;
        const pageB = b.Page ?? 1;
        if (pageA !== pageB) return pageA - pageB;
        const topA = a.Geometry?.BoundingBox?.Top ?? 0;
        const topB = b.Geometry?.BoundingBox?.Top ?? 0;
        return topA - topB;
      });

    const fullText = lines.map((block) => block.Text ?? '').filter(Boolean).join('\n');

    // Calculate average confidence
    const confidences = lines
      .map((block) => block.Confidence ?? 0)
      .filter((c) => c > 0);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length / 100
      : 0;

    // Count unique pages
    const pages = new Set(lines.map((b) => b.Page ?? 1));

    return {
      fullText,
      pageCount: pages.size,
      confidenceScore: Math.round(avgConfidence * 100) / 100,
      method: 'textract',
      extractionTimeMs: Date.now() - start,
    };
  } catch (error) {
    console.warn(
      '[OCR] Textract failed:',
      error instanceof Error ? error.message : error,
    );
    return {
      fullText: '',
      pageCount: 0,
      confidenceScore: 0,
      method: 'textract',
      extractionTimeMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Method 3: Tesseract.js (fallback for images)
// ---------------------------------------------------------------------------

export async function extractTextWithTesseract(
  documentBytes: Buffer,
): Promise<ExtractionResult> {
  const start = Date.now();

  try {
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng');

    const result = await worker.recognize(documentBytes);
    await worker.terminate();

    const fullText = result.data.text?.trim() || '';
    const confidenceScore = result.data.confidence
      ? result.data.confidence / 100
      : fullText.length > 50 ? 0.6 : 0.2;

    return {
      fullText,
      pageCount: 1,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      method: 'tesseract',
      extractionTimeMs: Date.now() - start,
    };
  } catch (error) {
    console.warn(
      '[OCR] Tesseract failed:',
      error instanceof Error ? error.message : error,
    );
    return {
      fullText: '',
      pageCount: 0,
      confidenceScore: 0,
      method: 'tesseract',
      extractionTimeMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Unified extraction: tries methods in preferred order
// ---------------------------------------------------------------------------

export async function extractDocumentText(
  documentBytes: Buffer,
  mimeType: string,
): Promise<ExtractionResult> {
  const isPdf = mimeType.includes('pdf');

  // Step 1: Try pdf-parse for PDFs (fastest)
  if (isPdf) {
    const pdfResult = await extractTextFromPDF(documentBytes);
    if (pdfResult.fullText.length > 50) {
      console.log(
        `[OCR] pdf-parse extracted ${pdfResult.fullText.length} chars ` +
        `(${pdfResult.pageCount} pages, confidence ${pdfResult.confidenceScore})`,
      );
      return pdfResult;
    }
  }

  // Step 2: Try AWS Textract (handles scanned documents)
  const textractResult = await extractTextWithTextract(documentBytes);
  if (textractResult.fullText.length > 50) {
    console.log(
      `[OCR] Textract extracted ${textractResult.fullText.length} chars ` +
      `(${textractResult.pageCount} pages, confidence ${textractResult.confidenceScore})`,
    );
    return textractResult;
  }

  // Step 3: Tesseract fallback (for images)
  if (!isPdf) {
    const tesseractResult = await extractTextWithTesseract(documentBytes);
    if (tesseractResult.fullText.length > 20) {
      console.log(
        `[OCR] Tesseract extracted ${tesseractResult.fullText.length} chars ` +
        `(confidence ${tesseractResult.confidenceScore})`,
      );
      return tesseractResult;
    }
  }

  // No method succeeded
  console.warn('[OCR] No extraction method produced usable text');
  return {
    fullText: '',
    pageCount: 0,
    confidenceScore: 0,
    method: 'none',
    extractionTimeMs: 0,
  };
}
