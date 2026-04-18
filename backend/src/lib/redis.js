// ============================================================================
// CourtAccess — Redis Connection (FINAL STABLE)
// ============================================================================

import "dotenv/config"; // 🔥 CRITICAL: ensures env is loaded FIRST
import { Redis } from "ioredis";

// ---------------------------------------------------------------------------
// ENV
// ---------------------------------------------------------------------------

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error("❌ REDIS_URL is not defined at startup");
}

console.log("🔌 [Redis] Connecting to:", redisUrl);

// ---------------------------------------------------------------------------
// CONNECTION
// ---------------------------------------------------------------------------

// ✅ IMPORTANT:
// - DO NOT manually configure TLS
// - redis:// = non-TLS
// - rediss:// = TLS (auto-handled by ioredis)

export const redisConnection = new Redis(redisUrl || "", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// ---------------------------------------------------------------------------
// LOGGING
// ---------------------------------------------------------------------------

redisConnection.on("connect", () => {
  console.log("🔌 [Redis] TCP connected");
});

redisConnection.on("ready", () => {
  console.log("✅ [Redis] Ready");
});

redisConnection.on("error", (err) => {
  console.error("❌ [Redis] Error:", err.message);
});

redisConnection.on("close", () => {
  console.warn("⚠️ [Redis] Connection closed");
});
