import { FastifyInstance } from "fastify";
import { analyzeCase } from "../services/calcrimEngine";

export async function registerCalcrimRoutes(fastify: FastifyInstance) {
  fastify.get("/api/calcrim/analyze/:caseId", async (req, reply) => {
    try {
      const { caseId } = req.params as any;

      const result = await analyzeCase(caseId);

      return result;
    } catch (err: any) {
      reply.code(500).send({
        error: err.message
      });
    }
  });
}
