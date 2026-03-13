// ============================================================================
// Narrative Deconstruction Engine — Worker 1: Claim Extraction
// Converts police report narratives into atomic factual claims.
// Sources: police reports, supplemental reports, investigator narratives,
//          probable cause statements, arrest affidavits, incident reports
// ============================================================================

import { PrismaClient } from '@prisma/client';
import type { ClaimExtractionJob } from './narrativeProcessingPipeline.js';
import { enqueueClaimNormalization } from './narrativeProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Claim Extraction Patterns
// ---------------------------------------------------------------------------

interface ExtractedClaim {
  claimText: string;
  subject: string;
  action: string;
  object: string | null;
  target: string | null;
  timestampReference: string | null;
  confidence: number;
  sentenceIndex: number;
}

// Subject detection patterns
const SUBJECT_PATTERNS: Array<{ pattern: RegExp; subject: string }> = [
  { pattern: /\b(?:the\s+)?suspect\b/i, subject: 'Suspect' },
  { pattern: /\b(?:the\s+)?defendant\b/i, subject: 'Defendant' },
  { pattern: /\b(?:the\s+)?victim\b/i, subject: 'Victim' },
  { pattern: /\bofficer\s+(\w+)\b/i, subject: 'Officer' },
  { pattern: /\bdeputy\s+(\w+)\b/i, subject: 'Deputy' },
  { pattern: /\bdetective\s+(\w+)\b/i, subject: 'Detective' },
  { pattern: /\bsergeant\s+(\w+)\b/i, subject: 'Sergeant' },
  { pattern: /\b(?:the\s+)?witness\b/i, subject: 'Witness' },
  { pattern: /\b(?:the\s+)?complainant\b/i, subject: 'Complainant' },
  { pattern: /\bI\b/, subject: 'Reporting Officer' },
  { pattern: /\b(?:this\s+)?officer\b/i, subject: 'Reporting Officer' },
];

// Action verb extraction patterns (law enforcement context)
const ACTION_KEYWORDS: Record<string, string[]> = {
  weapon_raised: ['raised', 'brandished', 'pointed', 'drew', 'pulled out', 'displayed'],
  weapon_fired: ['fired', 'discharged', 'shot', 'shots fired'],
  movement: ['ran', 'fled', 'walked', 'approached', 'advanced', 'retreated', 'turned'],
  force_used: ['struck', 'punched', 'kicked', 'tackled', 'tased', 'deployed taser', 'pepper sprayed'],
  verbal: ['said', 'stated', 'yelled', 'screamed', 'ordered', 'commanded', 'told', 'advised'],
  observation: ['observed', 'saw', 'noticed', 'witnessed', 'spotted', 'identified'],
  arrival: ['arrived', 'responded', 'on scene', 'arrived on scene'],
  arrest: ['arrested', 'detained', 'handcuffed', 'placed under arrest', 'taken into custody'],
  search: ['searched', 'pat down', 'patted down', 'frisked'],
  seizure: ['seized', 'confiscated', 'recovered', 'found', 'located', 'discovered'],
  vehicle: ['stopped', 'pulled over', 'initiated a stop', 'traffic stop'],
  pursuit: ['chased', 'pursued', 'foot pursuit', 'vehicle pursuit'],
  compliance: ['complied', 'surrendered', 'submitted', 'cooperated', 'resisted'],
  medical: ['called ambulance', 'administered first aid', 'CPR', 'transported to hospital'],
};

// Object detection (things acted upon)
const OBJECT_PATTERNS: Array<{ pattern: RegExp; object: string }> = [
  { pattern: /\bhandgun\b/i, object: 'Handgun' },
  { pattern: /\bfirearm\b/i, object: 'Firearm' },
  { pattern: /\bweapon\b/i, object: 'Weapon' },
  { pattern: /\bknife\b/i, object: 'Knife' },
  { pattern: /\bvehicle\b/i, object: 'Vehicle' },
  { pattern: /\bcar\b/i, object: 'Vehicle' },
  { pattern: /\btaser\b/i, object: 'Taser' },
  { pattern: /\bbaton\b/i, object: 'Baton' },
  { pattern: /\bdrugs?\b/i, object: 'Drugs' },
  { pattern: /\bcontraband\b/i, object: 'Contraband' },
  { pattern: /\bevidence\b/i, object: 'Evidence' },
  { pattern: /\bbackpack\b/i, object: 'Backpack' },
  { pattern: /\bbag\b/i, object: 'Bag' },
  { pattern: /\bphone\b/i, object: 'Phone' },
  { pattern: /\bwallet\b/i, object: 'Wallet' },
];

// Time reference detection
const TIME_REFERENCE_PATTERNS = [
  /(?:at|around|approximately|approx\.?)\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/gi,
  /(?:at|around|approximately|approx\.?)\s+(\d{4}\s*(?:hours?|hrs?))/gi,
  /\b(\d{2}:\d{2}(?::\d{2})?)\b/g,
  /\b(before|after|during|prior to|following|immediately after)\b/gi,
];

// ---------------------------------------------------------------------------
// Sentence Splitter
// ---------------------------------------------------------------------------

function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

// ---------------------------------------------------------------------------
// Claim Extraction Logic
// ---------------------------------------------------------------------------

function detectSubject(sentence: string): { subject: string; confidence: number } {
  for (const { pattern, subject } of SUBJECT_PATTERNS) {
    const match = sentence.match(pattern);
    if (match) {
      // If we captured a name (e.g., "Officer Ramirez"), append it
      const fullSubject = match[1] ? `${subject} ${match[1]}` : subject;
      return { subject: fullSubject, confidence: 0.8 };
    }
  }
  return { subject: 'Unknown', confidence: 0.3 };
}

function detectAction(sentence: string): { action: string; actionCategory: string; confidence: number } {
  const lowerSentence = sentence.toLowerCase();
  let bestAction = '';
  let bestCategory = 'other';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(ACTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerSentence.includes(keyword.toLowerCase())) {
        const score = keyword.length; // Longer matches are more specific
        if (score > bestScore) {
          bestScore = score;
          bestAction = keyword;
          bestCategory = category;
        }
      }
    }
  }

  if (!bestAction) {
    return { action: 'unclassified', actionCategory: 'other', confidence: 0.2 };
  }

  return {
    action: bestAction.charAt(0).toUpperCase() + bestAction.slice(1),
    actionCategory: bestCategory,
    confidence: Math.min(0.5 + bestScore * 0.05, 0.95),
  };
}

function detectObject(sentence: string): string | null {
  for (const { pattern, object } of OBJECT_PATTERNS) {
    if (pattern.test(sentence)) {
      return object;
    }
  }
  return null;
}

function detectTarget(sentence: string): string | null {
  // Look for "at/toward/against [Person]" patterns
  const targetPatterns = [
    /(?:at|toward|towards|against)\s+(Officer\s+\w+)/i,
    /(?:at|toward|towards|against)\s+(Deputy\s+\w+)/i,
    /(?:at|toward|towards|against)\s+(Detective\s+\w+)/i,
    /(?:at|toward|towards|against)\s+(?:the\s+)?(suspect|defendant|victim|witness|complainant)/i,
  ];

  for (const pattern of targetPatterns) {
    const match = sentence.match(pattern);
    if (match) {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1);
    }
  }
  return null;
}

function detectTimeReference(sentence: string): string | null {
  for (const pattern of TIME_REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(sentence);
    if (match) {
      return match[1] || match[0];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main Extraction Function
// ---------------------------------------------------------------------------

export function extractClaims(text: string, evidenceType: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  const sentences = extractSentences(text);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];

    const { action, actionCategory, confidence: actionConf } = detectAction(sentence);
    if (actionCategory === 'other' && actionConf < 0.3) {
      continue; // Skip sentences with no identifiable action
    }

    const { subject, confidence: subjectConf } = detectSubject(sentence);
    const object = detectObject(sentence);
    const target = detectTarget(sentence);
    const timestampReference = detectTimeReference(sentence);

    // Overall confidence: weighted average of subject and action detection
    const confidence = Math.min(subjectConf * 0.4 + actionConf * 0.6, 0.95);

    // Boost confidence for structured report types
    const typeBoost = ['police_report', 'probable_cause', 'arrest_affidavit'].includes(evidenceType)
      ? 0.05
      : 0;

    claims.push({
      claimText: sentence.substring(0, 500),
      subject,
      action,
      object,
      target,
      timestampReference,
      confidence: Math.min(confidence + typeBoost, 1.0),
      sentenceIndex: i,
    });
  }

  return claims;
}

// ---------------------------------------------------------------------------
// Worker Processor
// ---------------------------------------------------------------------------

export async function processClaimExtraction(job: ClaimExtractionJob): Promise<{
  claimsExtracted: number;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  console.log(
    `[NarrativeEngine] Claim extraction started` +
    ` caseId=${job.caseId}` +
    ` evidenceId=${job.evidenceId}` +
    ` evidenceType=${job.evidenceType}` +
    ` fileName=${job.fileName}`
  );

  // Verify evidence exists
  const evidence = await prisma.evidence.findUnique({
    where: { evidenceId: job.evidenceId },
  });

  if (!evidence) {
    console.error(`[ClaimExtraction] Evidence ${job.evidenceId} not found`);
    return { claimsExtracted: 0 };
  }

  // In production: download document from R2, extract text using PDF/DOCX parser.
  // For now, log the processing intent and trigger downstream normalization.
  console.log(
    `[NarrativeEngine] Would extract claims from ${job.fileName} (${job.evidenceType})` +
    ` s3Key=${job.s3Key}`
  );

  // After extraction, trigger normalization
  try {
    await enqueueClaimNormalization({
      caseId: job.caseId,
      tenantId: job.tenantId,
      triggerEvidenceId: job.evidenceId,
    });
  } catch (err) {
    console.error(`[NarrativeEngine] Failed to enqueue normalization:`, err);
  }

  const processingTimeMs = Date.now() - startTime;
  console.log(
    `[NarrativeEngine] Claim extraction completed` +
    ` caseId=${job.caseId}` +
    ` evidenceId=${job.evidenceId}` +
    ` claims=0` +
    ` processingTime=${(processingTimeMs / 1000).toFixed(1)}s`
  );

  return { claimsExtracted: 0, processingTimeMs };
}
