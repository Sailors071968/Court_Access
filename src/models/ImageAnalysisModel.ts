// ============================================
// Court Access — Image Analysis Model (AI Evidence Intelligence Phase 4)
// OCR text detection, metadata extraction, image classification.
//
// Processing pipeline:
//   Upload → Metadata extraction → OCR text detection
//   → Image classification
//
// Deterministic storage — no probabilistic scoring.
// ============================================

// ---------------------------------------------------------------------------
// Image Analysis Record
// ---------------------------------------------------------------------------

/**
 * Analysis result for an uploaded image.
 * Contains OCR text, detected objects, and metadata.
 */
export interface ImageAnalysis {
  imageId: string;
  evidenceId: string;
  detectedText: string | null;         // OCR-extracted text
  objectsDetected: string[];           // Detected objects/classifications
  analysisTimestamp: string;           // ISO 8601
  imageWidth: number;
  imageHeight: number;
  colorSpace: string;                  // e.g. "sRGB", "Adobe RGB"
  exifData: ImageExifData | null;      // EXIF metadata if available
  ocrConfidence: number | null;        // 0–1 OCR confidence score
  containsHandwriting: boolean;        // Whether handwriting was detected
  containsDocument: boolean;           // Whether a document was detected in the image
}

// ---------------------------------------------------------------------------
// Image EXIF Data
// ---------------------------------------------------------------------------

/**
 * EXIF metadata extracted from an image file.
 * Useful for forensic analysis (location, device, timestamp).
 */
export interface ImageExifData {
  dateTaken: string | null;            // Original date from EXIF (ISO 8601)
  cameraModel: string | null;
  cameraMake: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  orientation: number | null;
  focalLength: string | null;
  exposureTime: string | null;
  isoSpeed: number | null;
}

// ---------------------------------------------------------------------------
// Image Processing Input/Result
// ---------------------------------------------------------------------------

export interface ImageProcessingInput {
  evidenceId: string;
  fileUrl: string;
  mimeType: string;
}

export interface ImageProcessingResult {
  success: boolean;
  analysis: ImageAnalysis | null;
  error: string | null;
}
