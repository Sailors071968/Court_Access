// ============================================
// Court Access — OpenAI Analysis Service
// Phase 30: Real AI Analysis
//
// Replaces simulated AI with real OpenAI API calls.
// - Document summarization
// - Key point extraction
// - Entity detection (people, dates, organizations)
// - Transcript summarization
// ============================================

import { config } from '../config/index.js';

let openaiClient = null;

/**
 * Lazy-initialize the OpenAI client.
 */
async function getClient() {
  if (openaiClient) return openaiClient;

  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const { default: OpenAI } = await import('openai');
  openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
  console.log('[OpenAI] Client initialized');
  return openaiClient;
}

/**
 * Analyze a document's extracted text.
 * Returns summary, key points, and detected entities.
 *
 * @param text - Extracted text content from the document
 * @param metadata - Additional context (filename, type, etc.)
 * @returns {{ summary: string, keyPoints: string[], entities: Entity[] }}
 */
export async function analyzeDocument(text, metadata = {}) {
  const client = await getClient();

  // Truncate very long texts to stay within token limits
  const maxChars = 12000;
  const truncatedText = text.length > maxChars
    ? text.substring(0, maxChars) + '\n\n[... truncated for analysis ...]'
    : text;

  const systemPrompt = `You are a legal document analysis assistant for Court Access, a platform used by defense attorneys. Your job is to extract structured information from legal documents, evidence, and case materials.

You must respond with valid JSON only. No markdown, no explanation outside the JSON.

Response format:
{
  "summary": "A concise 2-3 sentence summary of the document's content and significance.",
  "keyPoints": ["Array of 3-7 key factual points from the document."],
  "entities": [
    {
      "name": "Entity name",
      "type": "person|organization|date|location|case_number|statute",
      "context": "Brief context of how this entity appears in the document."
    }
  ]
}`;

  const userPrompt = `Analyze the following document.

Filename: ${metadata.filename || 'Unknown'}
Document type: ${metadata.documentType || 'Unknown'}
${metadata.pageCount ? `Pages: ${metadata.pageCount}` : ''}

--- Document Text ---
${truncatedText}
--- End Document Text ---

Provide your structured analysis as JSON.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const result = JSON.parse(content);
    console.log(`[OpenAI] Document analyzed: ${metadata.filename || 'unknown'} — ${result.keyPoints?.length || 0} key points, ${result.entities?.length || 0} entities`);
    return result;
  } catch (err) {
    console.error(`[OpenAI] Document analysis failed: ${err.message}`);
    throw err;
  }
}

/**
 * Summarize an audio/video transcript.
 *
 * @param transcript - Full transcript text
 * @param metadata - Additional context
 * @returns {{ summary: string, keyPoints: string[], entities: Entity[], speakers: string[] }}
 */
export async function analyzeTranscript(transcript, metadata = {}) {
  const client = await getClient();

  const maxChars = 12000;
  const truncatedTranscript = transcript.length > maxChars
    ? transcript.substring(0, maxChars) + '\n\n[... truncated for analysis ...]'
    : transcript;

  const systemPrompt = `You are a legal transcript analysis assistant for Court Access. Analyze transcripts from depositions, interviews, body camera footage, and other audio/video evidence.

You must respond with valid JSON only.

Response format:
{
  "summary": "A concise 2-3 sentence summary of the transcript content.",
  "keyPoints": ["Array of 3-7 key statements or events from the transcript."],
  "entities": [
    {
      "name": "Entity name",
      "type": "person|organization|date|location|case_number|statute",
      "context": "Brief context."
    }
  ],
  "speakers": ["List of identified speakers if discernible."]
}`;

  const userPrompt = `Analyze the following transcript.

Source: ${metadata.filename || 'Unknown'}
Type: ${metadata.mediaType || 'audio/video'}
${metadata.duration ? `Duration: ${metadata.duration}` : ''}

--- Transcript ---
${truncatedTranscript}
--- End Transcript ---

Provide your structured analysis as JSON.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const result = JSON.parse(content);
    console.log(`[OpenAI] Transcript analyzed: ${metadata.filename || 'unknown'}`);
    return result;
  } catch (err) {
    console.error(`[OpenAI] Transcript analysis failed: ${err.message}`);
    throw err;
  }
}

/**
 * Extract entities from a short text snippet (e.g., OCR output from an image).
 *
 * @param text - OCR or extracted text
 * @param metadata - Context
 * @returns {{ description: string, entities: Entity[], textContent: string }}
 */
export async function analyzeImageText(text, metadata = {}) {
  const client = await getClient();

  const systemPrompt = `You are a legal evidence analysis assistant. Analyze text extracted from images (via OCR) that may be part of legal evidence — photos of documents, handwritten notes, screenshots, etc.

You must respond with valid JSON only.

Response format:
{
  "description": "Brief description of what the image text appears to be.",
  "entities": [
    {
      "name": "Entity name",
      "type": "person|organization|date|location|case_number|statute",
      "context": "Brief context."
    }
  ],
  "textContent": "Cleaned-up version of the OCR text with obvious OCR errors corrected."
}`;

  const userPrompt = `Analyze the following text extracted from an image.

Filename: ${metadata.filename || 'Unknown'}

--- OCR Text ---
${text}
--- End OCR Text ---

Provide your structured analysis as JSON.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const result = JSON.parse(content);
    console.log(`[OpenAI] Image text analyzed: ${metadata.filename || 'unknown'}`);
    return result;
  } catch (err) {
    console.error(`[OpenAI] Image text analysis failed: ${err.message}`);
    throw err;
  }
}
