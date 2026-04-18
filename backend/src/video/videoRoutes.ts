// ============================================================================
// CourtAccess — Video Routes (FIXED — CORRECT FILE PATH FLOW)
// ============================================================================

import { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";
import pump from "pump";
import { randomUUID } from "crypto";
import { getQueue } from "../workers/queueManager";

export async function registerVideoRoutes(fastify: FastifyInstance) {

  // ---------------------------------------------------------------------------
  // 📤 VIDEO UPLOAD
  // ---------------------------------------------------------------------------
  fastify.post("/api/video/upload", async (request: any, reply) => {
    try {
      console.log("📥 Upload request received");

      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ error: "No file uploaded" });
      }

      console.log("📄 File received:", data.filename);

      const jobId = randomUUID();

      const uploadDir = "/home/ec2-user/uploads";

      // ✅ Ensure upload directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `${jobId}-${data.filename}`;
      const filePath = path.join(uploadDir, filename);

      // ✅ STREAM FILE (SAFE + CORRECT)
      await pump(data.file, fs.createWriteStream(filePath));

      // 🔥 DEBUG (CRITICAL)
      console.log("📁 SAVED FILE PATH:", filePath);

      // -----------------------------------------------------------------------
      // 🎯 QUEUE JOB (THIS MUST MATCH WORKER EXPECTATION)
      // -----------------------------------------------------------------------
      const videoQueue = getQueue("video");

      await videoQueue.add(
        "process-video",
        {
          jobId,
          caseId: "test-case", // keep for now
          filePath,            // ✅ CRITICAL FIX
          sourceType: "video-upload",
        },
        {
          jobId,
        }
      );

      console.log("🚀 Job queued:", jobId);
      console.log("📤 SENT TO WORKER WITH PATH:", filePath);

      return reply.send({
        status: "queued",
        jobId,
      });

    } catch (err) {
      console.error("❌ Upload error FULL:", err);

      return reply.status(500).send({
        error: "Upload failed",
        details: String(err),
      });
    }
  });

}
