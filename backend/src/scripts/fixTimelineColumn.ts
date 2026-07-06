import prisma from "../lib/prisma.js";

async function fix() {
  console.log("🔧 Fixing timeline_events schema...");

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE timeline_events
      ADD COLUMN IF NOT EXISTS "timeText" TEXT,
      ADD COLUMN IF NOT EXISTS "action" TEXT,
      ADD COLUMN IF NOT EXISTS "target" TEXT,
      ADD COLUMN IF NOT EXISTS "object" TEXT;
    `);

    console.log("✅ Columns ensured: timeText, action, target, object");
  } catch (err) {
    console.error("❌ Failed to fix schema:", err);
  } finally {
    await prisma.$disconnect();
  }
}

fix();
