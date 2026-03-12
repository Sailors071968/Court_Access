// ============================================================================
// Autonomous CPRA System — Policy Classification Engine
// Uses OpenAI to classify policy documents and map to canonical topics.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { createNotification } from './cpraNotificationService.js';
import { addTimelineEvent } from './cpraTimelineService.js';
import { CANONICAL_POLICY_TOPICS } from './cpraMatrixService.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassificationResult {
  attachmentId: string;
  policyTitle: string | null;
  policyTopic: string | null;
  agencyName: string | null;
  revisionDate: string | null;
  pageCount: number | null;
  confidence: number;
  error: string | null;
}

// ---------------------------------------------------------------------------
// OpenAI Classification
// ---------------------------------------------------------------------------

async function classifyWithOpenAI(
  fileName: string,
  textContent: string,
  canonicalTopics: string[],
): Promise<{
  policyTitle: string;
  policyTopic: string;
  agencyName: string;
  revisionDate: string;
  confidence: number;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = `You are a legal policy classification system. Given a law enforcement policy document, classify it into the correct policy topic.

Available policy topics:
${canonicalTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Document filename: ${fileName}
Document content (first 3000 chars):
${textContent.slice(0, 3000)}

Respond in JSON format:
{
  "policyTitle": "string - the title of the policy",
  "policyTopic": "string - MUST be one of the available topics above",
  "agencyName": "string - the agency name if detectable",
  "revisionDate": "string - revision/effective date if found (YYYY-MM-DD format)",
  "confidence": number between 0 and 1
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as {
    policyTitle?: string;
    policyTopic?: string;
    agencyName?: string;
    revisionDate?: string;
    confidence?: number;
  };

  return {
    policyTitle: parsed.policyTitle ?? 'Unknown',
    policyTopic: parsed.policyTopic ?? 'Unknown',
    agencyName: parsed.agencyName ?? 'Unknown',
    revisionDate: parsed.revisionDate ?? '',
    confidence: parsed.confidence ?? 0.5,
  };
}

// ---------------------------------------------------------------------------
// Fallback heuristic classification (no OpenAI needed)
// ---------------------------------------------------------------------------

function classifyWithHeuristics(
  fileName: string,
  textContent: string,
): {
  policyTitle: string;
  policyTopic: string;
  confidence: number;
} {
  const combined = `${fileName} ${textContent}`.toLowerCase();
  const topicNames = CANONICAL_POLICY_TOPICS.map((t) => t.topicName);

  for (const topic of topicNames) {
    if (combined.includes(topic.toLowerCase())) {
      return {
        policyTitle: fileName.replace(/\.[^.]+$/, ''),
        policyTopic: topic,
        confidence: 0.65,
      };
    }
  }

  // Partial keyword matches
  const keywordMap: Record<string, string> = {
    'use of force': 'Use of Force',
    'deadly force': 'Deadly Force',
    'body worn': 'Body Worn Cameras',
    'body camera': 'Body Worn Cameras',
    'bwc': 'Body Worn Cameras',
    'pursuit': 'Vehicle Pursuits',
    'search and seizure': 'Search and Seizure',
    'miranda': 'Custodial Interrogation',
    'taser': 'Less Lethal Weapons',
    'k-9': 'Canine (K-9) Operations',
    'canine': 'Canine (K-9) Operations',
    'domestic violence': 'Domestic Violence Response',
    'mental health': 'Mental Health Response',
    'bias': 'Bias-Free Policing',
    'racial profiling': 'Bias-Free Policing',
    'social media': 'Social Media Policy',
    'foot pursuit': 'Foot Pursuits',
    'crowd control': 'Crowd Control',
    'internal affairs': 'Complaint Investigation',
    'discipline': 'Disciplinary Procedures',
  };

  for (const [keyword, topic] of Object.entries(keywordMap)) {
    if (combined.includes(keyword)) {
      return {
        policyTitle: fileName.replace(/\.[^.]+$/, ''),
        policyTopic: topic,
        confidence: 0.55,
      };
    }
  }

  return {
    policyTitle: fileName.replace(/\.[^.]+$/, ''),
    policyTopic: 'Unknown',
    confidence: 0.2,
  };
}

// ---------------------------------------------------------------------------
// Classify a single attachment
// ---------------------------------------------------------------------------

export async function classifyAttachment(
  attachmentId: string,
): Promise<ClassificationResult> {
  const attachment = await prisma.cpraEmailAttachment.findUnique({
    where: { attachmentId },
    include: { Email: true },
  });

  if (!attachment) {
    return {
      attachmentId,
      policyTitle: null,
      policyTopic: null,
      agencyName: null,
      revisionDate: null,
      pageCount: null,
      confidence: 0,
      error: 'Attachment not found',
    };
  }

  const textContent = attachment.Email.body ?? '';
  const canonicalTopics = CANONICAL_POLICY_TOPICS.map((t) => t.topicName);

  let result: {
    policyTitle: string;
    policyTopic: string;
    agencyName?: string;
    revisionDate?: string;
    confidence: number;
  };

  // Try OpenAI first, fall back to heuristics
  try {
    if (process.env.OPENAI_API_KEY) {
      result = await classifyWithOpenAI(attachment.fileName, textContent, canonicalTopics);
    } else {
      result = classifyWithHeuristics(attachment.fileName, textContent);
    }
  } catch (error) {
    console.error(
      `[CPRA Classification] OpenAI classification failed, using heuristics: ${error instanceof Error ? error.message : error}`,
    );
    result = classifyWithHeuristics(attachment.fileName, textContent);
  }

  // Update attachment with classification results
  await prisma.cpraEmailAttachment.update({
    where: { attachmentId },
    data: {
      policyTopicDetected: result.policyTopic,
      classificationConfidence: result.confidence,
      processingStatus: 'classified',
    },
  });

  // If we detected a valid policy topic, update the agency policy matrix
  if (
    result.policyTopic !== 'Unknown' &&
    attachment.Email.agencyId
  ) {
    // Find the topic in canonical list
    const matchedTopic = CANONICAL_POLICY_TOPICS.find(
      (t) => t.topicName.toLowerCase() === result.policyTopic.toLowerCase(),
    );

    if (matchedTopic) {
      // Update matrix status to RECEIVED
      await prisma.agencyPolicyMatrix.upsert({
        where: {
          agencyId_topicId: {
            agencyId: attachment.Email.agencyId,
            topicId: matchedTopic.topicName,
          },
        },
        update: {
          status: 'RECEIVED',
          receivedDate: new Date(),
        },
        create: {
          agencyId: attachment.Email.agencyId,
          topicId: matchedTopic.topicName,
          status: 'RECEIVED',
          receivedDate: new Date(),
        },
      });

      await createNotification({
        agencyId: attachment.Email.agencyId,
        eventType: 'POLICY_PARSED',
        title: `Policy classified: ${result.policyTitle}`,
        message: `Topic: ${result.policyTopic} (confidence: ${(result.confidence * 100).toFixed(0)}%)`,
        metadata: {
          attachmentId,
          policyTopic: result.policyTopic,
          confidence: result.confidence,
        },
      });

      await addTimelineEvent({
        agencyId: attachment.Email.agencyId,
        eventType: 'POLICY_UPLOADED',
        title: `Policy classified: ${result.policyTopic}`,
        description: `"${result.policyTitle}" matched to topic "${result.policyTopic}" with ${(result.confidence * 100).toFixed(0)}% confidence`,
        metadata: { attachmentId, ...result },
      });
    }
  }

  return {
    attachmentId,
    policyTitle: result.policyTitle,
    policyTopic: result.policyTopic,
    agencyName: result.agencyName ?? null,
    revisionDate: result.revisionDate ?? null,
    pageCount: null,
    confidence: result.confidence,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Classify all unclassified attachments
// ---------------------------------------------------------------------------

export async function classifyAllPending(): Promise<{
  classified: number;
  failed: number;
  results: ClassificationResult[];
}> {
  const pending = await prisma.cpraEmailAttachment.findMany({
    where: {
      processingStatus: { in: ['uploaded', 'pending', 'classified'] },
      policyTopicDetected: null,
      documentType: { not: 'non_policy' },
    },
    take: 20,
  });

  const results: ClassificationResult[] = [];
  let failed = 0;

  for (const attachment of pending) {
    const result = await classifyAttachment(attachment.attachmentId);
    results.push(result);
    if (result.error) failed++;
  }

  return { classified: results.length, failed, results };
}
