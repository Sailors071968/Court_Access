import { FastifyInstance } from "fastify";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export async function registerVideoProgressRoutes(fastify: FastifyInstance) {

  fastify.get("/api/video/progress/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    try {
      const progress = await redis.get(`video:progress:${jobId}`);

      return {
        success: true,
        progress: progress ? Number(progress) : 0,
      };

    } catch (error) {
      console.error("❌ Error fetching progress:", error);

      return reply.status(500).send({
        error: "Failed to fetch progress",
      });
    }
  });

}
