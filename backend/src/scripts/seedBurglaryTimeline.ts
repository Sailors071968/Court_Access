// ============================================================================
// CourtAccess — Seed Burglary Timeline (CALCRIM-READY)
// Inserts realistic structured events for testing CALCRIM engine
// ============================================================================

import "dotenv/config";
import prisma from "../lib/prisma.js";

async function seed() {
  const caseId = "test-case";
  const tenantId = "tenant-bc529059-d7bd-4b64-9526-468bf4bcbe63";

  console.log("🌱 Seeding burglary timeline events...");

  // 🧨 OPTIONAL: Clear existing events (safe for dev)
  await prisma.timelineEvent.deleteMany({
    where: { caseId },
  });

  const events = [
    {
      timestamp: new Date("2024-01-01T22:45:00Z"),
      description: "Security camera shows a male entering the front door of the residence",
      actor: "Unknown Male",
      action: "enter",
      target: "residence",
      sourceType: "video",
      confidence: 0.92,
    },
    {
      timestamp: new Date("2024-01-01T22:47:00Z"),
      description: "Neighbor reports seeing suspect inside the home through window",
      actor: "Witness",
      action: "observe",
      target: "suspect inside home",
      sourceType: "witness",
      confidence: 0.85,
    },
    {
      timestamp: new Date("2024-01-01T22:50:00Z"),
      description: "Victim reports missing laptop and jewelry",
      actor: "Victim",
      action: "report",
      target: "stolen property",
      sourceType: "statement",
      confidence: 0.88,
    },
    {
      timestamp: new Date("2024-01-01T22:52:00Z"),
      description: "Defendant claims he was not present at the location",
      actor: "Defendant",
      action: "deny",
      target: "presence at scene",
      sourceType: "statement",
      confidence: 0.70,
    },
    {
      timestamp: new Date("2024-01-01T22:55:00Z"),
      description: "Officer observes forced entry marks on front door",
      actor: "Officer",
      action: "observe",
      target: "forced entry",
      sourceType: "report",
      confidence: 0.95,
    },
  ];

  for (const e of events) {
    await prisma.timelineEvent.create({
      data: {
        caseId,
        tenantId,
        description: e.description,
        actor: e.actor,
        timestamp: e.timestamp,
        sourceType: e.sourceType,
        sourceDoc: `seed-${e.sourceType}`, // ✅ REQUIRED (fixes your previous error)
        confidence: e.confidence,

        // 🔥 CRITICAL: CALCRIM ENGINE FIELDS (TOP LEVEL)
        action: e.action,
        target: e.target,
        object: e.target,
        timeText: e.timestamp.toISOString(),

        // 🔁 Still keep metadata for flexibility
        metadata: {
          action: e.action,
          target: e.target,
        },
      },
    });
  }

  console.log("✅ Burglary timeline seeded successfully");

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
