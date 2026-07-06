import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config(); // 🔥 CRITICAL

const prisma = new PrismaClient();

export default prisma;
