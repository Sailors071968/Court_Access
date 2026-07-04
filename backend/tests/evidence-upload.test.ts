// ============================================================================
// Evidence Upload Pipeline Tests
// Canonical extractor + processing status mapping
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  guessMimeType,
  isProbablyText,
  extractTextFromBuffer,
} from '../src/evidence/evidenceContentExtractor.ts';
import {
  resolveLocalEvidencePath,
} from '../src/evidence/evidenceProcessingService.ts';

describe('guessMimeType', () => {
  it('should detect PDF files', () => {
    assert.equal(guessMimeType('report.pdf'), 'application/pdf');
  });

  it('should detect JPEG images', () => {
    assert.equal(guessMimeType('photo.jpg'), 'image/jpeg');
    assert.equal(guessMimeType('photo.jpeg'), 'image/jpeg');
  });

  it('should detect video files', () => {
    assert.equal(guessMimeType('bodycam.mp4'), 'video/mp4');
  });

  it('should default to octet-stream for unknown extensions', () => {
    assert.equal(guessMimeType('data.xyz'), 'application/octet-stream');
  });
});

describe('isProbablyText', () => {
  it('should return true for plain ASCII text', () => {
    assert.equal(isProbablyText('Hello, this is readable text.\nLine two.'), true);
  });

  it('should return false for empty string', () => {
    assert.equal(isProbablyText(''), false);
  });

  it('should return false for binary-looking content', () => {
    const binary = '\x00\x01\x02\x03\x04\x05';
    assert.equal(isProbablyText(binary), false);
  });
});

describe('extractTextFromBuffer', () => {
  it('should extract plain text directly', async () => {
    const buffer = Buffer.from('Officer Smith arrived at 14:30.', 'utf-8');
    const result = await extractTextFromBuffer(buffer, 'text/plain');
    assert.equal(result.method, 'direct');
    assert.equal(result.text, 'Officer Smith arrived at 14:30.');
  });

  it('should skip audio files with explicit message', async () => {
    const result = await extractTextFromBuffer(Buffer.from(''), 'audio/mpeg');
    assert.equal(result.method, 'skipped');
    assert.ok(result.error?.includes('transcript'));
  });

  it('should skip video files with explicit message', async () => {
    const result = await extractTextFromBuffer(Buffer.from(''), 'video/mp4');
    assert.equal(result.method, 'skipped');
    assert.ok(result.error?.includes('transcript'));
  });

  it('should skip unsupported binary formats', async () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
    const result = await extractTextFromBuffer(buffer, 'application/octet-stream');
    assert.equal(result.method, 'skipped');
    assert.ok(result.error?.includes('Unsupported'));
  });
});

describe('resolveLocalEvidencePath', () => {
  it('should map s3Key to local upload path', () => {
    const path = resolveLocalEvidencePath(
      'tenant-1',
      'case-1',
      'evidence/tenant-1/case-1/file-id-123/report.pdf',
      'report.pdf',
    );
    assert.ok(path?.endsWith('file-id-123_report.pdf'));
    assert.ok(path?.includes('tenant-1'));
    assert.ok(path?.includes('case-1'));
  });

  it('should return null for malformed s3Key', () => {
    assert.equal(resolveLocalEvidencePath('t', 'c', 'bad-key', 'f.pdf'), null);
  });
});
