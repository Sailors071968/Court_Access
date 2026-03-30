import { type EvidenceChunk, chunkText } from './evidenceChunkingService.js';
import { getQueue, QUEUE_NAMES } from '../lib/queues.js';

// Extended chunk type with source tracking for contradiction intelligence
export interface SourcedEvidenceChunk extends EvidenceChunk {
  chunkId: string;
  source: string;
}

// ========================================
// 🚀 MAIN FUNCTION (EXPORT MUST BE EXACT)
// ========================================
export async function processEvidenceToChunks(file: {
  id: string;
  caseId: string;
  s3Key: string;
  mimeType: string;
  tenantId?: string;
}): Promise<SourcedEvidenceChunk[]> {

  console.log("🔥 FILE INPUT RECEIVED:", JSON.stringify(file, null, 2));

  // ========================================
  // ✅ VALIDATION
  // ========================================
  if (!file?.id || !file?.s3Key) {
    console.error("❌ INVALID FILE OBJECT:", file);
    throw new Error("Invalid file input");
  }

  const tenantId = file.tenantId || "default";

  console.log("🔥 PROCESS EVIDENCE TO CHUNKS — INTELLIGENCE TEST MODE");

  // ========================================
  // 🔥 MULTI-SOURCE TEST DATA (CRITICAL)
  // ========================================
  const testDocuments = [
    {
      source: "police_report",
      text: `On March 15, 2026, at approximately 22:40 hours, Officer Smith entered the residence located at 1427 Elm Street.`
    },
    {
      source: "witness_statement",
      text: `I saw Officer Smith enter the house at 10:52 PM.`
    },
    {
      source: "bodycam",
      text: `[22:41:12] Officer Smith: "Entering the residence."`
    }
  ];

  let allChunks: SourcedEvidenceChunk[] = [];

  // ========================================
  // 🔥 PROCESS EACH DOCUMENT SOURCE
  // ========================================
  for (const doc of testDocuments) {
    console.log(`📄 Processing source: ${doc.source}`);

    if (!doc.text || doc.text.trim().length === 0) {
      console.warn(`⚠️ Empty text for source ${doc.source}`);
      continue;
    }

    // 🔥 Chunk the document
    const chunks: EvidenceChunk[] = chunkText(doc.text);

    if (!chunks.length) {
      console.warn(`⚠️ No chunks created for ${doc.source}`);
      continue;
    }

    // 🔥 Attach source to each chunk (CRITICAL FOR INTELLIGENCE)
    const enrichedChunks: SourcedEvidenceChunk[] = chunks.map((chunk) => ({
      ...chunk,
      chunkId: `${file.id}-${chunk.index}`,
      source: doc.source, // 🔥 THIS IS WHAT POWERS CONTRADICTIONS
    }));

    allChunks.push(...enrichedChunks);
  }

  if (!allChunks.length) {
    throw new Error(`❌ No chunks generated for file ${file.id}`);
  }

  console.log(`[Chunking] Total chunks created: ${allChunks.length}`);

// ========================================
// 🔥 TIMELINE QUEUE (DOCUMENT PIPELINE)
// ========================================
try {
  const timelineQueue = getQueue(QUEUE_NAMES.TIMELINE_BUILD);

  await timelineQueue.add("timeline-build", {
    caseId: file.id,
    chunks: allChunks.map((c) => ({
      text: c.text,
      fileId: file.id,
      chunkId: c.chunkId,
      index: c.index,
    })),
    sourceType: "document",
    tenantId: "default",
  });

  console.log(`✅ Timeline job queued for file ${file.id}`);

} catch (err) {
  console.error("❌ Failed to queue timeline job:", err);
}

// ========================================
// 🔥 VIDEO PIPELINE (SIMULATED)
// ========================================
try {
  const videoQueue = getQueue(QUEUE_NAMES.VIDEO_PROCESSING);

  await videoQueue.add("video-analysis", {
    caseId: file.id,
    fileId: file.id,
    tenantId: "default",
    videoText: testDocuments.map((d) => d.text).join("\n"),
    sourceType: "video",
  });

  console.log(`🎥 Video job queued for file ${file.id}`);

} catch (err) {
  console.error("❌ Failed to queue video job:", err);
}

// ========================================
// ✅ RETURN FINAL RESULT
// ========================================
return allChunks;
}
