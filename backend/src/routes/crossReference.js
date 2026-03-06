// ============================================
// Court Access — Phases 82-83: Evidence Reference Linking + Cross-Reference Engine
// Deterministic extraction and comparison of references across documents.
// No scoring, no ranking, no probabilistic models.
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Phase 82: Reference type patterns (deterministic extraction)
// ---------------------------------------------------------------------------

const REFERENCE_PATTERNS = {
  incident_number: /(?:incident|report|case)\s*(?:#|no\.?|number)?\s*[:.]?\s*([A-Z0-9][\w-]{3,20})/gi,
  officer_name: /(?:officer|ofc\.?|deputy|det\.?|sergeant|sgt\.?|lieutenant|lt\.?|captain|cpt\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
  badge_number: /(?:badge|shield)\s*(?:#|no\.?|number)?\s*[:.]?\s*([A-Z0-9]{2,10})/gi,
  date: /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g,
  case_number: /(?:case)\s*(?:#|no\.?|number)?\s*[:.]?\s*([A-Z0-9][\w-]{3,20})/gi,
};

// ---------------------------------------------------------------------------
// Phase 82: POST /api/cross-reference/:caseId/extract — Extract references from text
// ---------------------------------------------------------------------------

router.post('/:caseId/extract', authenticate, async (req, res) => {
  try {
    const { caseId } = req.params;
    const tenantId = req.user.id;
    const { sourceDocumentId, text } = req.body;

    if (!sourceDocumentId || !text) {
      return res.status(400).json({ error: 'sourceDocumentId and text are required' });
    }

    const extractedRefs = [];

    for (const [refType, pattern] of Object.entries(REFERENCE_PATTERNS)) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const value = match[1].trim();
        const startIdx = Math.max(0, match.index - 50);
        const endIdx = Math.min(text.length, match.index + match[0].length + 50);
        const context = text.substring(startIdx, endIdx);

        extractedRefs.push({
          caseId,
          tenantId,
          sourceDocumentId,
          referenceType: refType,
          referenceValue: value,
          sourceContext: context,
          extractionMethod: 'deterministic',
        });
      }
    }

    // Deduplicate by type+value per document
    const uniqueRefs = [];
    const seen = new Set();
    for (const ref of extractedRefs) {
      const key = `${ref.referenceType}:${ref.referenceValue}:${ref.sourceDocumentId}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRefs.push(ref);
      }
    }

    // Store references
    const created = [];
    for (const ref of uniqueRefs) {
      try {
        const record = await prisma.evidenceReference.create({ data: ref });
        created.push(record);
      } catch (err) {
        // Skip duplicates
        if (err.code !== 'P2002') throw err;
      }
    }

    console.log(JSON.stringify({
      event: 'references_extracted',
      caseId,
      sourceDocumentId,
      count: created.length,
      types: [...new Set(created.map(r => r.referenceType))],
      timestamp: new Date().toISOString(),
    }));

    res.json({
      extracted: created.length,
      references: created,
    });
  } catch (err) {
    console.error('[CrossRef] Extract error:', err.message);
    res.status(500).json({ error: 'Failed to extract references' });
  }
});

// ---------------------------------------------------------------------------
// Phase 82: GET /api/cross-reference/:caseId/references — List references
// ---------------------------------------------------------------------------

router.get('/:caseId/references', authenticate, async (req, res) => {
  try {
    const { caseId } = req.params;
    const tenantId = req.user.id;
    const { referenceType, sourceDocumentId } = req.query;

    const where = { caseId, tenantId };
    if (referenceType) where.referenceType = referenceType;
    if (sourceDocumentId) where.sourceDocumentId = sourceDocumentId;

    const references = await prisma.evidenceReference.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ references, count: references.length });
  } catch (err) {
    console.error('[CrossRef] List references error:', err.message);
    res.status(500).json({ error: 'Failed to list references' });
  }
});

// ---------------------------------------------------------------------------
// Phase 83: POST /api/cross-reference/:caseId/compare — Run cross-reference comparison
// Compares references across documents. Allowed outputs:
// - reference_match: same reference found in multiple documents
// - reference_conflict: conflicting values for same reference type
// - missing_reference: reference in one doc not found in related docs
// No scoring, no accusations.
// ---------------------------------------------------------------------------

router.post('/:caseId/compare', authenticate, async (req, res) => {
  try {
    const { caseId } = req.params;
    const tenantId = req.user.id;

    // Get all references for this case
    const references = await prisma.evidenceReference.findMany({
      where: { caseId, tenantId },
      orderBy: { referenceType: 'asc' },
    });

    if (references.length === 0) {
      return res.json({
        crossReferences: [],
        count: 0,
        message: 'No references found. Extract references from documents first.',
      });
    }

    // Group by reference type and value
    const byTypeValue = {};
    for (const ref of references) {
      const key = `${ref.referenceType}:${ref.referenceValue}`;
      if (!byTypeValue[key]) byTypeValue[key] = [];
      byTypeValue[key].push(ref);
    }

    // Group by document
    const byDocument = {};
    for (const ref of references) {
      if (!byDocument[ref.sourceDocumentId]) byDocument[ref.sourceDocumentId] = [];
      byDocument[ref.sourceDocumentId].push(ref);
    }

    const crossRefs = [];

    // Find reference matches (same value in multiple documents)
    for (const [key, refs] of Object.entries(byTypeValue)) {
      if (refs.length < 2) continue;

      const documents = [...new Set(refs.map(r => r.sourceDocumentId))];
      if (documents.length < 2) continue;

      // Create match entries for each pair
      for (let i = 0; i < documents.length; i++) {
        for (let j = i + 1; j < documents.length; j++) {
          const sourceRef = refs.find(r => r.sourceDocumentId === documents[i]);
          const relatedRef = refs.find(r => r.sourceDocumentId === documents[j]);

          crossRefs.push({
            caseId,
            tenantId,
            sourceDocumentId: documents[i],
            relatedDocumentId: documents[j],
            referenceType: 'reference_match',
            sourceReferenceId: sourceRef.id,
            relatedReferenceId: relatedRef.id,
            description: `${sourceRef.referenceType} "${sourceRef.referenceValue}" found in both documents`,
            sourceSnippet: sourceRef.sourceContext,
            relatedSnippet: relatedRef.sourceContext,
            status: 'active',
          });
        }
      }
    }

    // Find reference conflicts (same type, different values, related context)
    const byType = {};
    for (const ref of references) {
      if (!byType[ref.referenceType]) byType[ref.referenceType] = [];
      byType[ref.referenceType].push(ref);
    }

    for (const [refType, refs] of Object.entries(byType)) {
      if (refType === 'date') continue; // Dates are expected to differ
      const documents = [...new Set(refs.map(r => r.sourceDocumentId))];
      if (documents.length < 2) continue;

      // Check for conflicting values across documents
      for (let i = 0; i < documents.length; i++) {
        for (let j = i + 1; j < documents.length; j++) {
          const docARefs = refs.filter(r => r.sourceDocumentId === documents[i]);
          const docBRefs = refs.filter(r => r.sourceDocumentId === documents[j]);

          // Find values in A not in B
          for (const aRef of docARefs) {
            const matchInB = docBRefs.find(b => b.referenceValue === aRef.referenceValue);
            if (!matchInB && docBRefs.length > 0) {
              crossRefs.push({
                caseId,
                tenantId,
                sourceDocumentId: documents[i],
                relatedDocumentId: documents[j],
                referenceType: 'missing_reference',
                sourceReferenceId: aRef.id,
                relatedReferenceId: null,
                description: `${refType} "${aRef.referenceValue}" found in source but not in related document`,
                sourceSnippet: aRef.sourceContext,
                relatedSnippet: '',
                status: 'active',
              });
            }
          }
        }
      }
    }

    // Store cross-references
    const stored = [];
    for (const xref of crossRefs) {
      try {
        const record = await prisma.documentCrossReference.create({ data: xref });
        stored.push(record);
      } catch (err) {
        if (err.code !== 'P2002') {
          console.error('[CrossRef] Store error:', err.message);
        }
      }
    }

    console.log(JSON.stringify({
      event: 'cross_reference_complete',
      caseId,
      matches: stored.filter(r => r.referenceType === 'reference_match').length,
      conflicts: stored.filter(r => r.referenceType === 'reference_conflict').length,
      missing: stored.filter(r => r.referenceType === 'missing_reference').length,
      timestamp: new Date().toISOString(),
    }));

    res.json({
      crossReferences: stored,
      count: stored.length,
      summary: {
        matches: stored.filter(r => r.referenceType === 'reference_match').length,
        conflicts: stored.filter(r => r.referenceType === 'reference_conflict').length,
        missing: stored.filter(r => r.referenceType === 'missing_reference').length,
      },
    });
  } catch (err) {
    console.error('[CrossRef] Compare error:', err.message);
    res.status(500).json({ error: 'Failed to run cross-reference comparison' });
  }
});

// ---------------------------------------------------------------------------
// Phase 83: GET /api/cross-reference/:caseId — List cross-references
// ---------------------------------------------------------------------------

router.get('/:caseId', authenticate, async (req, res) => {
  try {
    const { caseId } = req.params;
    const tenantId = req.user.id;
    const { referenceType, status } = req.query;

    const where = { caseId, tenantId };
    if (referenceType) where.referenceType = referenceType;
    if (status) where.status = status;

    const crossReferences = await prisma.documentCrossReference.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      crossReferences,
      count: crossReferences.length,
      summary: {
        matches: crossReferences.filter(r => r.referenceType === 'reference_match').length,
        conflicts: crossReferences.filter(r => r.referenceType === 'reference_conflict').length,
        missing: crossReferences.filter(r => r.referenceType === 'missing_reference').length,
      },
    });
  } catch (err) {
    console.error('[CrossRef] List error:', err.message);
    res.status(500).json({ error: 'Failed to list cross-references' });
  }
});

// ---------------------------------------------------------------------------
// Phase 83: PATCH /api/cross-reference/:caseId/:crossRefId — Update status
// ---------------------------------------------------------------------------

router.patch('/:caseId/:crossRefId', authenticate, async (req, res) => {
  try {
    const { caseId, crossRefId } = req.params;
    const tenantId = req.user.id;
    const { status } = req.body;

    if (!status || !['active', 'dismissed', 'confirmed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required: active, dismissed, confirmed' });
    }

    const result = await prisma.documentCrossReference.updateMany({
      where: { id: crossRefId, caseId, tenantId },
      data: { status },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Cross-reference not found' });
    }

    res.json({ updated: true, count: result.count });
  } catch (err) {
    console.error('[CrossRef] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update cross-reference' });
  }
});

export default router;
