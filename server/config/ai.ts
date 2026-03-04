// ============================================
// Court Access — AI Configuration
// ============================================

import { env } from './env.js';

export const aiConfig = {
  apiKey: env.OPENAI_API_KEY,
  model: 'gpt-4o',
  temperature: 0.1,
  maxTokens: 4096,
  maxInputTokens: 128000,
} as const;
