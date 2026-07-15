// ============================================================================
// CourtAccess — Evidence → Chunk → Multi-Event → Queue Pipeline (STABLE v3)
// ============================================================================

import fs from "fs/promises";
import { chunkText } from "./evidenceChunkingService";
import { extractEvents, normalizeEvents } from "./extractEvents";
import { getQueue, QUEUE_NAMES } from "../lib/queues";

// ----------------------------------------------------------------------------
// MAIN PIPELINE
// ----------------------------------------------------------------------------

interface TimelineChunkJob {
  fileId: string;
  caseId?: string;
  chunkId: number;
  rawText: string;
  events: unknown[];
}

export async function processEvidenceToChunks(file: {
  id: string;
  localPath: string;
  mimeType: string;
  caseId?: string;
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
  const timelineQueue = getQueue<TimelineChunkJob>(QUEUE_NAMES.TIMELINE_BUILD);

  let totalEvents = 0;

  // ---------------------------------------------------------------------------
  // 4. PROCESS EACH CHUNK
  // ---------------------------------------------------------------------------
  for (const chunk of chunks) {
    try {
      if (!chunk?.text) continue;

      // Step 1: Extract raw events
      const events = extractEvents(chunk.text);

      // Step 2: Normalize through full pipeline
      // (extract → normalize → resolveActor → classifyAction)
      const normalized = normalizeEvents(events, chunk.text, chunk.index);

      console.log(`🧠 Chunk ${chunk.index} → ${events.length} events → ${normalized.length} normalized`);

      // -----------------------------------------------------------------------
      // DEBUG (SAFE — NORMALIZED OUTPUT)
      // -----------------------------------------------------------------------
      console.log("🔎 Normalized Events:", {
        chunkId: chunk.index,
        sample: normalized.slice(0, 2).map(e => ({
          actor: e.actor,
          action: e.action,
          target: e.target,
          eventId: e.eventId.slice(0, 8) + '...',
        })),
      });

      // -----------------------------------------------------------------------
      // SEND NORMALIZED EVENTS TO WORKER (SOURCE OF TRUTH)
      // -----------------------------------------------------------------------
      await timelineQueue.add("process", {
        fileId: id,
        caseId,
        chunkId: chunk.index,
        rawText: chunk.text,
        events: normalized,
      });

      totalEvents += events.length;
    } catch (err) {
      console.error(`❌ Failed processing chunk ${chunk?.index}:`, err);
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
