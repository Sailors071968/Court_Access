// ============================================================================
// CourtAccess — Job Status Routes (CLEAN REBUILD)
// ============================================================================

import { FastifyInstance } from "fastify";
import { Queue } from "bullmq";

const VIDEO_QUEUE_NAME = "video";

const connection = {
  url: process.env.REDIS_URL,
};

export async function registerJobRoutes(fastify: FastifyInstance) {
  fastify.get("/api/jobs/:jobId", async (request, reply) => {
    try {
      const { jobId } = request.params as { jobId: string };

      const queue = new Queue(VIDEO_QUEUE_NAME, { connection });
      const job = await queue.getJob(jobId);

      if (!job) {
        return reply.status(404).send({ error: "Job not found" });
      }

      const state = await job.getState();

      return {
        id: job.id,
        progress: job.progress || 0,
        state,
        returnvalue: job.returnvalue || null,
        failedReason: job.failedReason || null,
      };
    } catch (err) {
      console.error("❌ Job fetch error:", err);
      return reply.status(500).send({ error: "Failed to fetch job" });
    }
  });
}
