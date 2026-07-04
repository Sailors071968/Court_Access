// ============================================================================
// CourtAccess — Queue Manager (SINGLE SOURCE OF TRUTH)
// ============================================================================

import type { ConnectionOptions } from 'bullmq';
import { Queue } from "bullmq";
import { redisConnection } from "./redis";

// 🔥 VIDEO QUEUE (PRIMARY PIPELINE)
export const videoQueue = new Queue("video", {
  connection: redisConnection as unknown as ConnectionOptions,
});

// (Optional future queues — DO NOT REMOVE)
// export const timelineQueue = new Queue("timeline", { connection: redisConnection });
// export const contradictionQueue = new Queue("contradiction", { connection: redisConnection });

console.log("📦 QueueManager initialized — video queue ready");
