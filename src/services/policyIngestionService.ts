// ============================================
// Court Access — Policy Ingestion Service (Phase 3)
// Law Enforcement Policy Canon Ingestion Layer
//
// Isolated module for policy manual upload, parsing,
// chunking, and dual-hashing.
// No UI dependencies. No React imports.
//
// Constitutional boundaries:
//   - No compliance scoring
//   - No agency ranking
//   - No probability assignment
//   - Deterministic only
// ============================================

import type {
  PolicyManualEntity,
  PolicySectionEntity,
  PolicyChunkEntity,
  PolicyIngestionInput,
  PolicyIngestionResult,
} from '../models/PolicyModel';
import { sha3_256 } from 'js-sha3';

// ---------------------------------------------------------------------------
// Text normalization — deterministic canonicalization
// ---------------------------------------------------------------------------

/**
 * Normalize text for deterministic comparison and hashing.
 *
 * Canonicalization rules (documented for evidentiary reproducibility):
 *   1. Replace all Windows line endings (\r\n) with Unix (\n)
 *   2. Replace all remaining carriage returns (\r) with Unix (\n)
 *   3. Collapse all consecutive whitespace (spaces, tabs) into single space
 *   4. Trim leading and trailing whitespace from each line
 *   5. Collapse multiple blank lines into single blank line
 *   6. Trim leading and trailing whitespace from entire text
 *
 * This function is pure — same input always produces same output.
 * No locale-dependent transformations. No case changes.
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')                    // Step 1: Windows → Unix line endings
    .replace(/\r/g, '\n')                       // Step 2: Remaining CR → LF
    .split('\n')                                // Process line by line
    .map((line) => line.replace(/[ \t]+/g, ' ').trim()) // Step 3-4: Collapse whitespace, trim lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')                 // Step 5: Collapse multiple blank lines
    .trim();                                     // Step 6: Trim entire text
}

// ---------------------------------------------------------------------------
// SHA-256 hashing for text content
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of a text string.
 * Encodes text as UTF-8 bytes, then hashes the raw bytes.
 * Returns hex-encoded hash prefixed with "sha256:".
 *
 * Uses TextEncoder for deterministic UTF-8 byte conversion.
 * This is a pure function — same input always produces same output.
 */
export async function computeTextSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex}`;
}

// ---------------------------------------------------------------------------
// SHA3-256 hashing for text content
// ---------------------------------------------------------------------------

/**
 * Compute SHA3-256 hash of a text string.
 * Encodes text as UTF-8 bytes, then hashes the raw bytes.
 * Returns hex-encoded hash prefixed with "sha3-256:".
 *
 * Uses js-sha3 (pure JavaScript Keccak). No network dependency.
 * This is a pure function — same input always produces same output.
 */
export function computeTextSHA3_256(text: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashHex = sha3_256(data);
  return `sha3-256:${hashHex}`;
}

// ---------------------------------------------------------------------------
// Section parsing — deterministic text segmentation
// ---------------------------------------------------------------------------

/**
 * Parsed section from raw text.
 * Intermediate type used during ingestion pipeline.
 */
interface ParsedSection {
  title: string;
  rawText: string;
  sectionNumber: number;
}

/**
 * Parse raw policy text into sections.
 *
 * Section detection rules (deterministic):
 *   1. Split on lines that match section header patterns
 *   2. Headers: lines starting with "Section", "Article", "Chapter",
 *      "Part", or numbered patterns like "1.", "1.1", "I.", "A."
 *   3. Each header starts a new section
 *   4. Text before the first header becomes "Preamble" (section 0 → renumbered to 1)
 *   5. Sections are numbered sequentially (1-indexed)
 *
 * This is a pure function — same input always produces same output.
 */
export function parseSections(rawText: string): ParsedSection[] {
  const normalized = normalizeText(rawText);
  const lines = normalized.split('\n');
  const sections: ParsedSection[] = [];

  // Pattern matches section headers deterministically
  const headerPattern = /^(?:(?:Section|Article|Chapter|Part)\s+\d+|(?:\d+\.)+\s|[IVXLCDM]+\.\s|[A-Z]\.\s)/i;

  let currentTitle = 'Preamble';
  let currentLines: string[] = [];

  for (const line of lines) {
    if (headerPattern.test(line.trim()) && line.trim().length > 0) {
      // Save previous section if it has content
      if (currentLines.length > 0) {
        const rawSectionText = currentLines.join('\n').trim();
        if (rawSectionText.length > 0) {
          sections.push({
            title: currentTitle,
            rawText: rawSectionText,
            sectionNumber: sections.length + 1,
          });
        }
      }
      // Start new section
      currentTitle = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Final section
  if (currentLines.length > 0) {
    const rawSectionText = currentLines.join('\n').trim();
    if (rawSectionText.length > 0) {
      sections.push({
        title: currentTitle,
        rawText: rawSectionText,
        sectionNumber: sections.length + 1,
      });
    }
  }

  // If no sections were detected, treat entire text as one section
  if (sections.length === 0 && normalized.length > 0) {
    sections.push({
      title: 'Full Document',
      rawText: normalized,
      sectionNumber: 1,
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Chunk generation — deterministic text segmentation
// ---------------------------------------------------------------------------

/**
 * Default chunk size in characters.
 * Chosen to balance granularity with comparison utility.
 * Each chunk represents a comparison-ready text segment.
 */
const DEFAULT_CHUNK_SIZE = 1000;

/**
 * Split section text into canonical chunks.
 *
 * Chunking rules (deterministic):
 *   1. Text is normalized before chunking
 *   2. Split on paragraph boundaries (double newline) first
 *   3. If a paragraph exceeds chunk size, split on sentence boundaries
 *   4. Chunks are indexed sequentially (0-indexed)
 *   5. No overlap between chunks — each character appears in exactly one chunk
 *   6. Empty chunks are discarded
 *
 * This is a pure function — same input always produces same output.
 */
export function chunkText(text: string, maxChunkSize: number = DEFAULT_CHUNK_SIZE): string[] {
  const normalized = normalizeText(text);
  if (normalized.length === 0) return [];

  // Split on paragraph boundaries
  const paragraphs = normalized.split('\n\n').filter((p) => p.trim().length > 0);

  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    // If adding this paragraph would exceed chunk size
    if (currentChunk.length > 0 && currentChunk.length + trimmed.length + 2 > maxChunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }

    // If single paragraph exceeds chunk size, split on sentences
    if (trimmed.length > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      const sentences = splitSentences(trimmed);
      for (const sentence of sentences) {
        if (currentChunk.length > 0 && currentChunk.length + sentence.length + 1 > maxChunkSize) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        currentChunk = currentChunk.length > 0
          ? `${currentChunk} ${sentence}`
          : sentence;
      }
    } else {
      currentChunk = currentChunk.length > 0
        ? `${currentChunk}\n\n${trimmed}`
        : trimmed;
    }
  }

  // Final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Split text into sentences deterministically.
 * Uses a forward-scan algorithm (no regex lookbehind).
 *
 * Algorithm:
 *   1. Scan each character left-to-right (deterministic, index-based)
 *   2. When a sentence terminator (.!?) is found followed by whitespace,
 *      mark the split point AFTER the terminator (preserving punctuation)
 *   3. Collect text between split points as sentences
 *   4. Discard empty results
 *
 * No lookbehind. No lookahead. No regex groups.
 * No locale-dependent behavior. No environment variance.
 * This is a pure function — same input always produces same output.
 */
function splitSentences(text: string): string[] {
  const terminators = new Set(['.', '!', '?']);
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    // Check: current char is a terminator AND next char is whitespace (or end of string)
    if (terminators.has(text[i]) && (i + 1 >= text.length || text[i + 1] === ' ' || text[i + 1] === '\t' || text[i + 1] === '\n')) {
      // Split point is after the terminator (i + 1)
      const sentence = text.slice(start, i + 1).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      // Skip whitespace after terminator to find start of next sentence
      let next = i + 1;
      while (next < text.length && (text[next] === ' ' || text[next] === '\t' || text[next] === '\n')) {
        next++;
      }
      start = next;
      i = next - 1; // -1 because for-loop will increment
    }
  }

  // Final segment (text after last terminator, if any)
  if (start < text.length) {
    const remaining = text.slice(start).trim();
    if (remaining.length > 0) {
      sentences.push(remaining);
    }
  }

  return sentences;
}

// ---------------------------------------------------------------------------
// ID generation — deterministic from hash
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic ID from a content hash.
 * Extracts 16 hex characters from the hash (after the prefix).
 *
 * This is a pure function — same input always produces same output.
 */
function idFromHash(contentHash: string): string {
  // Skip the "sha256:" or "sha3-256:" prefix
  const prefixEnd = contentHash.indexOf(':');
  return contentHash.slice(prefixEnd + 1, prefixEnd + 17);
}

// ---------------------------------------------------------------------------
// Policy Ingestion Pipeline
// ---------------------------------------------------------------------------

/**
 * Ingest a policy manual into the system.
 *
 * Pipeline:
 *   1. Read file as text
 *   2. Compute dual hashes of entire file (SHA-256 + SHA3-256)
 *   3. Parse text into sections
 *   4. For each section: normalize, dual-hash, generate entity
 *   5. For each section: chunk text, dual-hash each chunk, generate entities
 *   6. Return complete entity hierarchy
 *
 * Phase 3: File is NOT physically stored (no backend yet).
 * All entities are returned for the caller to persist.
 *
 * Constitutional constraints:
 *   - All IDs derived deterministically from content hashes
 *   - All hashes computed from normalized text bytes
 *   - No randomness. No Date.now(). No non-deterministic branching.
 */
export async function ingestPolicyManual(
  input: PolicyIngestionInput
): Promise<PolicyIngestionResult> {
  try {
    // Step 1: Read file as text
    const rawText = await input.file.text();

    // Step 2: Compute dual hashes of entire file (raw bytes, not text)
    const fileBuffer = await input.file.arrayBuffer();
    const fileHashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
    const fileHashArray = Array.from(new Uint8Array(fileHashBuffer));
    const fileContentHash = `sha256:${fileHashArray.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
    const fileSha3Hash = `sha3-256:${sha3_256(fileBuffer)}`;

    const manualId = idFromHash(fileContentHash);

    // Step 3: Parse text into sections
    const parsedSections = parseSections(rawText);

    // Step 4 & 5: Process sections and chunks
    const sections: PolicySectionEntity[] = [];
    const allChunks: PolicyChunkEntity[] = [];

    for (const parsed of parsedSections) {
      // Dual-hash the section raw text
      const sectionContentHash = await computeTextSHA256(parsed.rawText);
      const sectionSha3Hash = computeTextSHA3_256(parsed.rawText);
      const sectionId = idFromHash(sectionContentHash);

      // Chunk the section text
      const chunkTexts = chunkText(parsed.rawText);

      // Build chunk entities
      const sectionChunks: PolicyChunkEntity[] = [];
      for (let i = 0; i < chunkTexts.length; i++) {
        const normalizedChunkText = normalizeText(chunkTexts[i]);
        const chunkContentHash = await computeTextSHA256(normalizedChunkText);
        const chunkSha3Hash = computeTextSHA3_256(normalizedChunkText);
        const chunkId = idFromHash(chunkContentHash);

        sectionChunks.push({
          id: chunkId,
          tenantId: input.tenantId,
          manualId,
          sectionId,
          agencyId: input.agencyId,
          chunkIndex: i,
          normalizedText: normalizedChunkText,
          contentHash: chunkContentHash,
          sha3Hash: chunkSha3Hash,
          integrityVerified: false,
        });
      }

      allChunks.push(...sectionChunks);

      // Build section entity
      sections.push({
        id: sectionId,
        tenantId: input.tenantId,
        manualId,
        agencyId: input.agencyId,
        sectionNumber: parsed.sectionNumber,
        title: parsed.title,
        rawText: parsed.rawText,
        contentHash: sectionContentHash,
        sha3Hash: sectionSha3Hash,
        chunkCount: sectionChunks.length,
        integrityVerified: false,
      });
    }

    // Step 6: Build manual entity
    const manual: PolicyManualEntity = {
      id: manualId,
      tenantId: input.tenantId,
      agencyId: input.agencyId,
      title: input.title,
      version: input.version,
      effectiveDate: input.effectiveDate,
      supersededDate: null,
      sourceFileName: input.file.name,
      fileSize: input.file.size,
      fileType: input.file.name.split('.').pop() || 'txt',
      contentHash: fileContentHash,
      sha3Hash: fileSha3Hash,
      totalSections: sections.length,
      totalChunks: allChunks.length,
      ingestedAt: input.effectiveDate, // Deterministic — server timestamp in Phase 6+
      integrityVerified: false,
    };

    return {
      success: true,
      manual,
      sections,
      chunks: allChunks,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      manual: null,
      sections: [],
      chunks: [],
      error: err instanceof Error ? err.message : 'Unknown policy ingestion error',
    };
  }
}
