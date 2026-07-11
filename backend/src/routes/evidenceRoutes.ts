import { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";
import pump from "pump";
import { processEvidenceToChunks } from "../services/processEvidenceToChunks.js";

export default async function evidenceRoutes(fastify: FastifyInstance) {
  fastify.post("/api/evidence/upload", async (request: any, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ error: "No file uploaded" });
      }

      const caseId: string | undefined =
        data.fields?.caseId?.value ?? request.query?.caseId;

      if (!caseId) {
        return reply.status(400).send({ error: "caseId is required" });
      }

      const uploadDir = "/home/ec2-user/uploads";

      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, data.filename);

      // Save file
      await new Promise((resolve, reject) => {
        pump(data.file, fs.createWriteStream(filePath), (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });

      console.log(`📄 File saved: ${filePath}`);

      // 🚀 TRIGGER PIPELINE
      await processEvidenceToChunks({
        id: `file-${Date.now()}`,
        localPath: filePath,
        mimeType: data.mimetype,
        caseId,
      });

      console.log("🚀 Pipeline triggered");

      return {
        success: true,
        message: "File uploaded and processing started",
        path: filePath,
      };
    } catch (err) {
      console.error("❌ Upload failed:", err);
      return reply.status(500).send({ error: "Upload failed" });
    }
  });
}
