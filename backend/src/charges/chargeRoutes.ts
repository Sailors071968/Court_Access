// ============================================================================
// CourtAccess — Charge Routes
// ============================================================================

import { FastifyInstance } from "fastify";
import prisma from "../lib/prisma.js";

export async function registerChargeRoutes(fastify: FastifyInstance) {

  // CREATE CHARGE
  fastify.post("/api/charges", async (req, res) => {
    try {
      const { caseId, code, section, title, victim, dateOfOffense } = req.body as any;

      if (!caseId || !code || !section || !victim) {
        return res.status(400).send({
          error: "Missing required fields",
          required: ["caseId", "code", "section", "victim"]
        });
      }

      const charge = await prisma.charge.create({
        data: {
          caseId,
          code,
          section,
          title,
          victim,
          dateOfOffense: dateOfOffense ? new Date(dateOfOffense) : null,
        },
      });

      return { success: true, charge };

    } catch (err) {
      console.error("CREATE CHARGE ERROR:", err);
      return res.status(500).send({ error: "Failed to create charge" });
    }
  });

  // GET CHARGES
  fastify.get("/api/charges/:caseId", async (req, res) => {
    try {
      const { caseId } = req.params as any;

      const charges = await prisma.charge.findMany({
        where: { caseId },
        orderBy: { createdAt: "desc" },
      });

      return { success: true, charges };

    } catch (err) {
      console.error("GET CHARGES ERROR:", err);
      return res.status(500).send({ error: "Failed to fetch charges" });
    }
  });

  // DELETE CHARGE
  fastify.delete("/api/charges/:id", async (req, res) => {
    try {
      const { id } = req.params as any;

      await prisma.charge.delete({ where: { id } });

      return { success: true };

    } catch (err) {
      console.error("DELETE CHARGE ERROR:", err);
      return res.status(500).send({ error: "Failed to delete charge" });
    }
  });
}
