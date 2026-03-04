// ============================================
// Court Access — Drizzle Kit Configuration
// ============================================

import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

export default {
  schema: './models/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://courtaccess:courtaccess@localhost:5432/courtaccess',
  },
} satisfies Config;
