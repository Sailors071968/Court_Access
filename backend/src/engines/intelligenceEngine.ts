// ============================================
// Court Access — Intelligence Engine Bridge
// Calls AI model and enforces constitutional constraints on output.
// Existing constitutional engines (Phases 1-25) remain pure libraries.
// This bridge connects them to the backend pipeline.
// ============================================

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { computeSHA256 } from './hashEngine.js';

export interface AIAnalysisRequest {
  documentText: string;
  caseContext?: string;
}

export interface AIAnalysisResponse {
  structuredAnalysis: Record<string, unknown>;
  modelVersion: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

const SYSTEM_PROMPT = `You are a document analysis engine for a legal documentation platform.
Your role is to extract structured factual information from legal documents.

STRICT RULES:
- Extract ONLY factual content present in the document
- Do NOT provide legal advice
- Do NOT predict outcomes
- Do NOT assess credibility
- Do NOT infer motive or intent
- Do NOT use subjective or interpretive language
- Output must be structured JSON
- Every claim must reference the source location in the document
- Use neutral, evidence-bound language only

OUTPUT FORMAT (JSON):
{
  "documentType": "string",
  "keyEntities": [{"name": "string", "role": "string", "citations": ["string"]}],
  "keyDates": [{"date": "string", "event": "string", "citation": "string"}],
  "keyFacts": [{"fact": "string", "citation": "string", "pageReference": "string"}],
  "charges": [{"code": "string", "description": "string", "citation": "string"}],
  "proceduralHistory": [{"event": "string", "date": "string", "citation": "string"}]
}`;

// Forbidden terms — constitutional engine enforcement
const FORBIDDEN_TERMS = [
  'ADVICE', 'RECOMMEND', 'STRATEGY', 'SHOULD', 'LIKELY', 'SUGGESTS',
  'INDICATES', 'IMPLIES', 'WEAK', 'STRONG', 'CONTRADICTION',
  'VIOLATION', 'MISCONDUCT', 'PATTERN',
];

function deterministicUppercase(input: string): string {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 97 && code <= 122) {
      result = result + String.fromCharCode(code - 32);
    } else {
      result = result + input.charAt(i);
    }
  }
  return result;
}

function containsForbiddenTerm(text: string): { found: boolean; term: string | null } {
  const upper = deterministicUppercase(text);
  for (let t = 0; t < FORBIDDEN_TERMS.length; t++) {
    const term = FORBIDDEN_TERMS[t];
    for (let i = 0; i <= upper.length - term.length; i++) {
      let found = true;
      for (let j = 0; j < term.length; j++) {
        if (upper.charAt(i + j) !== term.charAt(j)) {
          found = false;
          break;
        }
      }
      if (found) {
        return { found: true, term };
      }
    }
  }
  return { found: false, term: null };
}

export async function runAIAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
  if (!env.OPENAI_API_KEY) {
    logger.warn('OpenAI API key not configured — returning placeholder analysis');
    return {
      structuredAnalysis: {
        documentType: 'UNPROCESSED',
        keyEntities: [],
        keyDates: [],
        keyFacts: [],
        charges: [],
        proceduralHistory: [],
        note: 'AI analysis unavailable — API key not configured',
      },
      modelVersion: 'none',
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze the following legal document and extract structured information:\n\n${request.documentText}`,
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('OpenAI API error', { status: response.status, body: errorText });
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
    model: string;
  };

  const content = data.choices[0]?.message?.content || '{}';
  let structuredAnalysis: Record<string, unknown>;
  try {
    structuredAnalysis = JSON.parse(content);
  } catch {
    structuredAnalysis = { rawContent: content, parseError: true };
  }

  return {
    structuredAnalysis,
    modelVersion: data.model,
    tokenUsage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    },
  };
}

/**
 * Validate AI output against constitutional constraints.
 * Returns PASS/FAIL — binary only.
 */
export function validateConstitutionalCompliance(
  analysisData: Record<string, unknown>
): { status: 'PASS' | 'FAIL'; violatingTerm: string | null } {
  const outputText = JSON.stringify(analysisData);
  const forbiddenCheck = containsForbiddenTerm(outputText);
  if (forbiddenCheck.found) {
    return { status: 'FAIL', violatingTerm: forbiddenCheck.term };
  }
  return { status: 'PASS', violatingTerm: null };
}

/**
 * Compute snapshot hash for an analysis result.
 */
export function computeSnapshotHash(analysisData: Record<string, unknown>): string {
  const canonicalJson = JSON.stringify(analysisData);
  return computeSHA256(canonicalJson);
}
