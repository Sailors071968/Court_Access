// ============================================================================
// TEMP — Trigger Video Job (TEST SCRIPT - FULLY FIXED)
// ============================================================================

import "dotenv/config";

import fs from "fs";
import { QUEUE_NAMES, getQueue } from "./lib/queues.js";

// ---------------------------------------------------------------------------

async function run() {
  try {
    const jobId = "test-video-1";

    console.log("🚀 Starting video trigger...");

    // ============================================================
    // VALIDATE ENV
    // ============================================================
    if (!process.env.REDIS_URL) {
      throw new Error("REDIS_URL is missing in environment");
    }

    console.log("🔌 REDIS_URL detected");

    // ============================================================
    // VALIDATE FILE
    // ============================================================
    const localPath =
      "/home/ec2-user/uploads/incident_info_video_-_incident_number_pa2023-13545 (1080p).mp4";

    if (!fs.existsSync(localPath)) {
      throw new Error(`Video file not found at path: ${localPath}`);
    }

    console.log("📁 Video file found");

    // ============================================================
    // GET QUEUE
    // ============================================================
    const queue = getQueue(QUEUE_NAMES.VIDEO_PROCESSING);

    if (!queue) {
      throw new Error("Failed to initialize video queue");
    }

    console.log("📦 Queue initialized");

    // ============================================================
    // ADD JOB
    // ============================================================
    await queue.add(
      "video-process",
      {
        jobId,
        caseId: "test-case",
        fileId: "test-file",
        localPath,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      }
    );

    console.log("🚀 Video job queued successfully:", jobId);
  } catch (err: any) {
    console.error("❌ Failed to queue video job:");
    console.error(err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------

run();
