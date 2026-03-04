// ============================================
// Court Access — AI Service (OpenAI)
// Constitutional constraints enforced on all AI output.
// ============================================

import { aiConfig } from '../config/ai.js';
import { logger } from '../utils/loggingUtils.js';

export interface AIAnalysisRequest {
  documentText: string;
  caseContext?: string;
}

export interface AIAnalysisResponse {
  structuredAnalysis: Record<string, unknown>;
  modelVersion: string;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
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

/**
 * Run AI analysis on document text.
 * Returns structured analysis with model version and token usage.
 */
export async function runAIAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
  if (!aiConfig.apiKey) {
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

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        max_tokens: aiConfig.maxTokens,
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
  } catch (error) {
    logger.error('AI analysis failed', { error: (error as Error).message });
    throw error;
  }
}
