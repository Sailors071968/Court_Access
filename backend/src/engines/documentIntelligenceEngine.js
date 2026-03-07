// ============================================
// Court Access — Document Intelligence Extraction Engine
// Phase 116: Evidence Intelligence Engine v1
//
// Extracts structured metadata from uploaded documents:
// - Names (persons)
// - Dates
// - Locations
// - Phone numbers
// - Case numbers
// - Law enforcement agencies
// - Evidence references
//
// Supported: PDF, DOCX, TXT, Images (OCR-ready)
// ============================================

import prisma from '../services/prismaClient.js';

// ---------------------------------------------------------------------------
// Entity Extraction Patterns
// ---------------------------------------------------------------------------

const PATTERNS = {
  // Person names: "Officer Smith", "Detective Ramirez", "Mr. Johnson", "Dr. Lee"
  persons: [
    /(?:Officer|Detective|Sgt\.?|Sergeant|Lt\.?|Lieutenant|Cpl\.?|Corporal|Deputy|Chief|Captain|Agent)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    /(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Judge|Attorney|Atty\.?|Counselor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    /(?:THE COURT|THE WITNESS|THE DEFENDANT|THE CLERK|THE BAILIFF)/g,
    /(?:Defendant|Plaintiff|Witness|Victim|Suspect|Complainant)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  ],

  // Dates: various formats
  dates: [
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,
    /\b(\d{1,2}-\d{1,2}-\d{2,4})\b/g,
    /\b(\d{4}-\d{2}-\d{2})\b/g,
    /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})\b/gi,
  ],

  // Locations: addresses, counties, jails, courthouses
  locations: [
    /\b(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\.?)\b/g,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:County|Parish|District|Township|Borough))\b/g,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Jail|Prison|Penitentiary|Correctional\s+(?:Facility|Center|Institution)))\b/g,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Courthouse|Court\s+House|Superior\s+Court|Municipal\s+Court|District\s+Court))\b/g,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Police\s+(?:Department|Station)|Sheriff(?:'s)?\s+(?:Office|Department)))\b/g,
  ],

  // Phone numbers
  phones: [
    /\b(\(\d{3}\)\s*\d{3}[-.]?\d{4})\b/g,
    /\b(\d{3}[-.]?\d{3}[-.]?\d{4})\b/g,
    /\b(1[-.]?\d{3}[-.]?\d{3}[-.]?\d{4})\b/g,
  ],

  // Case numbers: various court formats
  caseNumbers: [
    /\b(\d{2,4}[A-Z]{1,3}\d{3,8})\b/g,
    /\b(Case\s+(?:No\.?|Number|#)\s*[:\s]?\s*\S+)\b/gi,
    /\b([A-Z]{1,3}-\d{2,4}-\d{3,8})\b/g,
    /\b(\d{1}:\d{2}-[a-z]{2}-\d{4,6})\b/g,
  ],

  // Law enforcement agencies
  agencies: [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Police\s+Department|PD|Sheriff(?:'s)?\s+(?:Office|Department)|Highway\s+Patrol))\b/g,
    /\b((?:FBI|DEA|ATF|ICE|CBP|US\s+Marshals?|Secret\s+Service))\b/g,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:District\s+Attorney(?:'s)?\s+Office|DA(?:'s)?\s+Office|Public\s+Defender(?:'s)?\s+Office))\b/g,
  ],

  // Evidence references
  evidenceRefs: [
    /\b(Exhibit\s+[A-Z0-9]+)\b/gi,
    /\b(Evidence\s+(?:Item|No\.?|#)\s*[:\s]?\s*\S+)\b/gi,
    /\b(People(?:'s)?\s+Exhibit\s+\d+)\b/gi,
    /\b(Defense\s+Exhibit\s+[A-Z0-9]+)\b/gi,
    /\b(Body\s+Camera\s+(?:Footage|Video)\s*(?:#?\s*\d+)?)\b/gi,
  ],
};

// ---------------------------------------------------------------------------
// Core Extraction Functions
// ---------------------------------------------------------------------------

/**
 * Extract all entities from document text.
 *
 * @param {string} text - The full document text
 * @returns {object} Categorized entities with context
 */
export function extractEntities(text) {
  if (!text || typeof text !== 'string') {
    return { persons: [], dates: [], locations: [], phones: [], caseNumbers: [], agencies: [], evidenceRefs: [] };
  }

  const entities = {
    persons: extractByPatterns(text, PATTERNS.persons),
    dates: extractByPatterns(text, PATTERNS.dates),
    locations: extractByPatterns(text, PATTERNS.locations),
    phones: extractByPatterns(text, PATTERNS.phones),
    caseNumbers: extractByPatterns(text, PATTERNS.caseNumbers),
    agencies: extractByPatterns(text, PATTERNS.agencies),
    evidenceRefs: extractByPatterns(text, PATTERNS.evidenceRefs),
  };

  return entities;
}

/**
 * Apply an array of regex patterns to text and return unique matches with context.
 */
function extractByPatterns(text, patterns) {
  const matches = new Map(); // value → { value, count, contexts }

  for (const pattern of patterns) {
    // Reset regex state
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const value = (match[1] || match[0]).trim();
      if (value.length < 2 || value.length > 200) continue;

      const existing = matches.get(value);
      if (existing) {
        existing.count++;
      } else {
        // Extract surrounding context (50 chars before and after)
        const start = Math.max(0, match.index - 50);
        const end = Math.min(text.length, match.index + match[0].length + 50);
        const context = text.substring(start, end).replace(/\n/g, ' ').trim();

        matches.set(value, { value, count: 1, context });
      }
    }
  }

  return Array.from(matches.values());
}

// ---------------------------------------------------------------------------
// Document Processing Pipeline
// ---------------------------------------------------------------------------

/**
 * Process a document and extract + store all entities.
 *
 * @param {string} documentId - Evidence/document ID
 * @param {string} caseId - Case ID
 * @param {string} text - Full document text
 * @returns {object} Extraction results summary
 */
export async function processDocument(documentId, caseId, text) {
  console.log(`[DocIntelligence] Processing document ${documentId} for case ${caseId}`);

  const entities = extractEntities(text);

  // Flatten entities for database storage
  const dbEntities = [];

  for (const [entityType, items] of Object.entries(entities)) {
    // Map plural keys to singular entity types
    const typeMap = {
      persons: 'person',
      dates: 'date',
      locations: 'location',
      phones: 'phone',
      caseNumbers: 'case_number',
      agencies: 'agency',
      evidenceRefs: 'evidence_ref',
    };

    const type = typeMap[entityType] || entityType;

    for (const item of items) {
      dbEntities.push({
        documentId,
        caseId,
        entityType: type,
        entityValue: item.value,
        confidence: Math.min(1.0, 0.7 + (item.count * 0.1)), // Higher confidence with more occurrences
        sourceContext: item.context || '',
      });
    }
  }

  // Store entities in database (batch insert)
  if (dbEntities.length > 0) {
    try {
      await prisma.documentEntity.createMany({
        data: dbEntities,
        skipDuplicates: true,
      });
      console.log(`[DocIntelligence] Stored ${dbEntities.length} entities for document ${documentId}`);
    } catch (err) {
      console.error(`[DocIntelligence] Failed to store entities: ${err.message}`);
    }
  }

  // Build and update entity index
  try {
    await updateEntityIndex(dbEntities);
  } catch (err) {
    console.error(`[DocIntelligence] Failed to update entity index: ${err.message}`);
  }

  const summary = {
    documentId,
    caseId,
    totalEntities: dbEntities.length,
    breakdown: {
      persons: entities.persons.length,
      dates: entities.dates.length,
      locations: entities.locations.length,
      phones: entities.phones.length,
      caseNumbers: entities.caseNumbers.length,
      agencies: entities.agencies.length,
      evidenceRefs: entities.evidenceRefs.length,
    },
  };

  console.log(`[DocIntelligence] Extraction complete: ${dbEntities.length} entities found`);
  return summary;
}

// ---------------------------------------------------------------------------
// Entity Index Management
// ---------------------------------------------------------------------------

/**
 * Update the cross-document entity index with newly extracted entities.
 */
async function updateEntityIndex(entities) {
  for (const entity of entities) {
    const normalizedValue = entity.entityValue.toLowerCase().trim();

    try {
      await prisma.entityIndex.upsert({
        where: {
          entityType_normalizedValue_documentId: {
            entityType: entity.entityType,
            normalizedValue,
            documentId: entity.documentId,
          },
        },
        update: {}, // Already indexed
        create: {
          entityType: entity.entityType,
          entityValue: entity.entityValue,
          normalizedValue,
          documentId: entity.documentId,
          caseId: entity.caseId,
        },
      });
    } catch (err) {
      // Skip duplicate index entries silently
      if (err.code !== 'P2002') {
        console.warn(`[DocIntelligence] Index update failed for ${entity.entityValue}: ${err.message}`);
      }
    }
  }
}

/**
 * Search the entity index across all case documents.
 *
 * @param {string} caseId - Case to search within
 * @param {object} filters - { entityType?, entityValue?, documentId? }
 * @returns {Array} Matching entity index entries
 */
export async function searchEntityIndex(caseId, filters = {}) {
  const where = { caseId };

  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityValue) {
    where.normalizedValue = { contains: filters.entityValue.toLowerCase().trim() };
  }
  if (filters.documentId) where.documentId = filters.documentId;

  const results = await prisma.entityIndex.findMany({
    where,
    orderBy: { firstSeenTimestamp: 'asc' },
    take: 500,
  });

  return results;
}

/**
 * Get all documents that reference a specific entity.
 *
 * @param {string} entityValue - Entity to search for (e.g., "Officer Smith")
 * @param {string} caseId - Optional case filter
 */
export async function findDocumentsByEntity(entityValue, caseId) {
  const where = {
    normalizedValue: { contains: entityValue.toLowerCase().trim() },
  };
  if (caseId) where.caseId = caseId;

  const results = await prisma.entityIndex.findMany({
    where,
    orderBy: { firstSeenTimestamp: 'asc' },
  });

  // Group by document
  const documentMap = new Map();
  for (const entry of results) {
    if (!documentMap.has(entry.documentId)) {
      documentMap.set(entry.documentId, {
        documentId: entry.documentId,
        caseId: entry.caseId,
        entities: [],
        firstSeen: entry.firstSeenTimestamp,
      });
    }
    documentMap.get(entry.documentId).entities.push({
      type: entry.entityType,
      value: entry.entityValue,
    });
  }

  return Array.from(documentMap.values());
}
