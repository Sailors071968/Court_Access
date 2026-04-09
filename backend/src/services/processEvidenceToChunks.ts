// ============================================================================
// CourtAccess — Evidence → Chunk → Multi-Event → Queue Pipeline (STABLE v3)
// ============================================================================

import fs from "fs/promises";
import { chunkText } from "./evidenceChunkingService";
import { extractEvents } from "./extractEvents";
import { getQueue, QUEUE_NAMES } from "../workers/queueManager";

// ----------------------------------------------------------------------------
// MAIN PIPELINE
// ----------------------------------------------------------------------------

export async function processEvidenceToChunks(file: {
  id: string;
  localPath: string;
  mimeType: string;
  caseId: string;
}) {
  const { id, localPath, caseId } = file;

  console.log(`\n📄 Processing file: ${id}`);

  // ---------------------------------------------------------------------------
  // 1. READ FILE
  // ---------------------------------------------------------------------------
  let rawText: string;

  try {
    rawText = await fs.readFile(localPath, "utf-8");
  } catch (err) {
    console.error("❌ Failed to read file:", err);
    throw err;
  }

  // ---------------------------------------------------------------------------
  // 2. CHUNK TEXT
  // ---------------------------------------------------------------------------
  const chunks = chunkText(rawText);

  if (!chunks || chunks.length === 0) {
    console.warn("⚠️ No chunks created — aborting");
    return [];
  }

  console.log(`✂️ Created ${chunks.length} chunks`);

  // ---------------------------------------------------------------------------
  // 3. GET QUEUE
  // ---------------------------------------------------------------------------
  const timelineQueue = getQueue(QUEUE_NAMES.TIMELINE);

  let totalEvents = 0;

  // ---------------------------------------------------------------------------
  // 4. PROCESS EACH CHUNK
  // ---------------------------------------------------------------------------
  for (const chunk of chunks) {
    try {
      if (!chunk?.text) continue;

      const events = extractEvents(chunk.text);

      console.log(`🧠 Chunk ${chunk.id} → ${events.length} events`);

      // -----------------------------------------------------------------------
      // DEBUG (SAFE — RAW EXTRACTION ONLY)
      // -----------------------------------------------------------------------
      console.log("🔎 Extracted Events (RAW):", {
        chunkId: chunk.id,
        sample: events.slice(0, 2), // prevent log flooding
      });

      // -----------------------------------------------------------------------
      // SEND MULTI-EVENTS TO WORKER (SOURCE OF TRUTH)
      // -----------------------------------------------------------------------
      await timelineQueue.add("process", {
        fileId: id,
        caseId,
        chunkId: chunk.id,
        rawText: chunk.text,
        events,
      });

      totalEvents += events.length;
    } catch (err) {
      console.error(`❌ Failed processing chunk ${chunk?.id}:`, err);
    }
  }

  // ---------------------------------------------------------------------------
  // FINAL LOG (NO FAKE TIMELINE)
  // ---------------------------------------------------------------------------
  console.log(
    `🚀 Pipeline complete | chunks=${chunks.length} events=${totalEvents}`
  );

  console.log(
    "📌 NOTE: Timeline preview removed — use DB (Prisma) as source of truth"
  );

  return chunks;
}
