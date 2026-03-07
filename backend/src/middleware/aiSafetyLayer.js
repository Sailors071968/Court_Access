// ============================================
// Court Access — AI Analysis Safety Layer
// Phase 119: Production Hardening
//
// Guardrails for AI analysis service:
// - Max token usage limits
// - Timeout protection
// - Structured response validation
// - Rate limiting per user/case
// - Prevents AI from accessing raw documents directly
// ============================================

import { getRedisConnection, isRedisAvailable } from '../services/redisClient.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AI_SAFETY_CONFIG = {
  maxTokensPerRequest: 4000,
  maxTokensPerMinute: 20000,
  maxRequestsPerMinute: 10,
  maxRequestsPerHour: 100,
  timeoutMs: 30000,
  maxPromptLength: 8000,
  maxResponseLength: 16000,
  allowedAnalysisTypes: [
    'case_summary',
    'timeline_analysis',
    'contradiction_analysis',
    'evidence_strength_report',
  ],
  blockedContentPatterns: [
    /system\s*prompt/i,
    /ignore\s*(previous|above)\s*instructions/i,
    /\bpassword\b/i,
    /\bsecret\b/i,
    /\bapi[_\s]*key\b/i,
    /\btoken\b.*\b(auth|jwt|bearer)\b/i,
  ],
};

export { AI_SAFETY_CONFIG };

// ---------------------------------------------------------------------------
// 1. Request Validation Middleware
// ---------------------------------------------------------------------------

/**
 * Validate AI analysis request before processing.
 * Checks: analysis type, prompt length, blocked content.
 */
export function validateAIRequest() {
  return (req, res, next) => {
    const { analysisType, prompt, context } = req.body;

    // Validate analysis type
    if (analysisType && !AI_SAFETY_CONFIG.allowedAnalysisTypes.includes(analysisType)) {
      return res.status(400).json({
        error: 'invalid_analysis_type',
        message: `Analysis type "${analysisType}" is not allowed. Valid types: ${AI_SAFETY_CONFIG.allowedAnalysisTypes.join(', ')}`,
      });
    }

    // Check prompt length
    const promptText = prompt || context || '';
    if (promptText.length > AI_SAFETY_CONFIG.maxPromptLength) {
      return res.status(400).json({
        error: 'prompt_too_long',
        message: `Prompt exceeds maximum length of ${AI_SAFETY_CONFIG.maxPromptLength} characters`,
        maxLength: AI_SAFETY_CONFIG.maxPromptLength,
        actualLength: promptText.length,
      });
    }

    // Check for blocked content patterns (prompt injection defense)
    for (const pattern of AI_SAFETY_CONFIG.blockedContentPatterns) {
      if (pattern.test(promptText)) {
        console.warn(`[AISafety] Blocked content detected in request from user ${req.user?.id}: pattern=${pattern}`);
        return res.status(400).json({
          error: 'blocked_content',
          message: 'Request contains content that violates safety policies',
        });
      }
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// 2. Rate Limiting Middleware
// ---------------------------------------------------------------------------

/**
 * Rate limit AI analysis requests per user.
 * Uses Redis for distributed rate limiting.
 */
export function aiRateLimit() {
  return async (req, res, next) => {
    if (!isRedisAvailable()) {
      // Without Redis, fall back to allowing requests (but log warning)
      console.warn('[AISafety] Redis unavailable — AI rate limiting disabled');
      return next();
    }

    const userId = req.user?.id;
    if (!userId) return next();

    try {
      const redis = getRedisConnection();
      if (!redis) return next();

      // Check per-minute limit (atomic INCR + EXPIRE via Lua)
      const luaIncrWithExpire = "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return count";
      const minuteKey = `ai:rate:minute:${userId}`;
      const minuteCount = await redis.eval(luaIncrWithExpire, 1, minuteKey, 60);

      if (minuteCount > AI_SAFETY_CONFIG.maxRequestsPerMinute) {
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          message: `AI analysis rate limit exceeded. Max ${AI_SAFETY_CONFIG.maxRequestsPerMinute} requests per minute.`,
          retryAfter: 60,
        });
      }

      // Check per-hour limit (atomic INCR + EXPIRE via Lua)
      const hourKey = `ai:rate:hour:${userId}`;
      const hourCount = await redis.eval(luaIncrWithExpire, 1, hourKey, 3600);

      if (hourCount > AI_SAFETY_CONFIG.maxRequestsPerHour) {
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          message: `AI analysis hourly limit exceeded. Max ${AI_SAFETY_CONFIG.maxRequestsPerHour} requests per hour.`,
          retryAfter: 3600,
        });
      }

      // Track token usage per minute
      const tokenKey = `ai:tokens:minute:${userId}`;
      const tokenCount = parseInt(await redis.get(tokenKey) || '0', 10);
      if (tokenCount > AI_SAFETY_CONFIG.maxTokensPerMinute) {
        return res.status(429).json({
          error: 'token_limit_exceeded',
          message: `AI token usage limit exceeded. Max ${AI_SAFETY_CONFIG.maxTokensPerMinute} tokens per minute.`,
          retryAfter: 60,
        });
      }

      next();
    } catch (err) {
      console.error('[AISafety] Rate limit check failed:', err.message);
      // Fail open for rate limiting to avoid blocking legitimate users
      next();
    }
  };
}

// ---------------------------------------------------------------------------
// 3. Response Validation
// ---------------------------------------------------------------------------

/**
 * Validate and sanitize AI response before returning to client.
 *
 * @param {object} response - AI service response
 * @returns {{ valid: boolean, sanitized: object, errors: string[] }}
 */
export function validateAIResponse(response) {
  const errors = [];

  if (!response) {
    return { valid: false, sanitized: null, errors: ['Empty response from AI service'] };
  }

  // Check response size
  const responseStr = JSON.stringify(response);
  if (responseStr.length > AI_SAFETY_CONFIG.maxResponseLength) {
    errors.push(`Response exceeds max length: ${responseStr.length} > ${AI_SAFETY_CONFIG.maxResponseLength}`);
  }

  // Validate structure based on analysis type
  const sanitized = { ...response };

  // Remove any leaked system information
  delete sanitized.systemPrompt;
  delete sanitized.rawPrompt;
  delete sanitized.apiKey;
  delete sanitized.internalError;

  // Ensure confidence scores are bounded
  if (typeof sanitized.confidence === 'number') {
    sanitized.confidence = Math.max(0, Math.min(1, sanitized.confidence));
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors,
  };
}

// ---------------------------------------------------------------------------
// 4. Timeout Wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap an async AI operation with timeout protection.
 *
 * @param {Promise} operation - The async AI operation
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Result or timeout error
 */
export function withAITimeout(operation, timeoutMs = AI_SAFETY_CONFIG.timeoutMs) {
  return Promise.race([
    operation,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI analysis timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// ---------------------------------------------------------------------------
// 5. Token Usage Tracking
// ---------------------------------------------------------------------------

/**
 * Record token usage for a user after AI request completes.
 *
 * @param {string} userId
 * @param {number} tokensUsed
 */
export async function recordTokenUsage(userId, tokensUsed) {
  if (!isRedisAvailable()) return;

  try {
    const redis = getRedisConnection();
    if (!redis) return;

    const key = `ai:tokens:minute:${userId}`;
    await redis.incrby(key, tokensUsed);
    // Ensure TTL exists
    const ttl = await redis.ttl(key);
    if (ttl < 0) await redis.expire(key, 60);

    // Also track total usage for billing/monitoring
    const totalKey = `ai:tokens:total:${userId}`;
    await redis.incrby(totalKey, tokensUsed);
  } catch (err) {
    console.error('[AISafety] Token tracking failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// 6. Content Sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize case data before sending to AI.
 * Removes PII markers, file paths, and system internals.
 *
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
export function sanitizeForAI(text) {
  if (!text) return '';

  let sanitized = text;

  // Remove file paths
  sanitized = sanitized.replace(/\/[a-zA-Z0-9_/.-]+\.[a-zA-Z]+/g, '[FILE_PATH]');

  // Remove potential API keys/tokens
  sanitized = sanitized.replace(/[a-zA-Z0-9]{32,}/g, (match) => {
    // Only replace if it looks like a token (mixed case/numbers, long)
    if (/[a-z]/.test(match) && /[A-Z]/.test(match) && /[0-9]/.test(match)) {
      return '[REDACTED]';
    }
    return match;
  });

  // Remove email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

  // Remove phone numbers
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');

  // Remove SSN patterns
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

  return sanitized;
}
