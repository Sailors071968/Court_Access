// ============================================================================
// Phase 265 — Evidence Hash Integrity
// Every evidence file receives sha256 + sha3-256 hashes
// Used for chain of custody and court defensibility
// ============================================================================

export interface EvidenceHash {
  evidenceId: string;
  sha256: string;
  sha3_256: string;
  computedAt: string;
  fileSize: number;
  fileName: string;
}

export class EvidenceHashService {
  /**
   * Compute hashes for an evidence file.
   * In production, this uses Node.js crypto module.
   */
  static async computeHashes(evidenceId: string, fileBuffer: Buffer, fileName: string): Promise<EvidenceHash> {
    const crypto = await import('crypto');

    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    // Note: sha3-256 requires Node.js 12+
    const sha3_256 = crypto.createHash('sha3-256').update(fileBuffer).digest('hex');

    return {
      evidenceId,
      sha256,
      sha3_256,
      computedAt: new Date().toISOString(),
      fileSize: fileBuffer.length,
      fileName,
    };
  }

  /**
   * Verify a file against stored hashes.
   */
  static async verifyIntegrity(fileBuffer: Buffer, storedHash: EvidenceHash): Promise<{ valid: boolean; details: string }> {
    const crypto = await import('crypto');
    const currentSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    if (currentSha256 !== storedHash.sha256) {
      return { valid: false, details: `SHA-256 mismatch: expected ${storedHash.sha256}, got ${currentSha256}` };
    }

    const currentSha3 = crypto.createHash('sha3-256').update(fileBuffer).digest('hex');
    if (currentSha3 !== storedHash.sha3_256) {
      return { valid: false, details: `SHA3-256 mismatch: expected ${storedHash.sha3_256}, got ${currentSha3}` };
    }

    return { valid: true, details: 'Hash verification passed — chain of custody intact' };
  }
}
