// ============================================================================
// Phase 133 — Policy Rule Engine
// Converts policies into structured rules with conditions and exceptions.
// Phase 134 — Policy Action Mapping (maps officer actions to rules)
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StructuredRule {
  policyId: string;
  agencyId: string;
  ruleType: 'prohibition' | 'requirement' | 'permission' | 'conditional' | 'escalation';
  ruleName: string;
  ruleText: string;
  conditions?: string[];
  exceptions?: string[];
  category: string;
  severity: 'critical' | 'high' | 'standard' | 'low';
  effectiveDate?: Date;
}

export interface ActionMapping {
  eventType: string;
  ruleId: string;
  relevanceScore: number;
  mappingReason: string;
}

// ---------------------------------------------------------------------------
// Rule extraction patterns (NLP-based policy parsing)
// ---------------------------------------------------------------------------

const RULE_EXTRACTION_PATTERNS: Record<string, {
  patterns: RegExp[];
  ruleType: StructuredRule['ruleType'];
  severity: StructuredRule['severity'];
}> = {
  prohibition: {
    patterns: [
      /shall not/i, /prohibited/i, /forbidden/i, /must not/i,
      /is not (permitted|allowed|authorized)/i, /ban(ned|s)?/i,
      /under no circumstances/i, /never/i,
    ],
    ruleType: 'prohibition',
    severity: 'high',
  },
  requirement: {
    patterns: [
      /shall/i, /must/i, /required to/i, /is required/i,
      /obligated/i, /mandatory/i, /will ensure/i,
    ],
    ruleType: 'requirement',
    severity: 'standard',
  },
  permission: {
    patterns: [
      /may/i, /is (permitted|allowed|authorized)/i,
      /has the (right|authority|discretion)/i, /at the officer'?s discretion/i,
    ],
    ruleType: 'permission',
    severity: 'low',
  },
  conditional: {
    patterns: [
      /only (when|if|in cases)/i, /except (when|if|in cases)/i,
      /unless/i, /provided that/i, /in the event/i, /contingent/i,
    ],
    ruleType: 'conditional',
    severity: 'standard',
  },
  escalation: {
    patterns: [
      /escalat/i, /force continuum/i, /level of force/i,
      /proportional/i, /reasonable.*force/i, /minimum.*force/i,
    ],
    ruleType: 'escalation',
    severity: 'high',
  },
};

// Category detection patterns
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  Use_of_Force: [
    /use.?of.?force/i, /deadly force/i, /lethal/i, /non-?lethal/i,
    /less.?lethal/i, /taser/i, /baton/i, /firearm/i, /OC spray/i,
    /chokehold/i, /restraint/i, /neck/i, /prone/i,
  ],
  Pursuit: [
    /pursuit/i, /chase/i, /vehicle pursuit/i, /foot pursuit/i,
    /high.?speed/i, /emergency driving/i,
  ],
  Body_Camera: [
    /body.?cam/i, /BWC/i, /body.?worn/i, /recording/i,
    /camera activation/i,
  ],
  Search_Seizure: [
    /search/i, /seizure/i, /warrant/i, /probable cause/i,
    /consent search/i, /pat.?down/i, /frisk/i, /Terry/i,
  ],
  Arrest: [
    /arrest/i, /detention/i, /custody/i, /handcuff/i,
    /booking/i, /probable cause/i,
  ],
  Interrogation: [
    /interrogat/i, /interview/i, /Miranda/i, /custodial/i,
    /statement/i, /confession/i,
  ],
  Officer_Conduct: [
    /conduct/i, /professionalism/i, /courtesy/i, /bias/i,
    /discrimination/i, /duty/i, /oath/i,
  ],
  Custody: [
    /custody/i, /jail/i, /holding/i, /transport/i,
    /booking/i, /cell/i,
  ],
};

// Exception detection patterns
const EXCEPTION_PATTERNS = [
  /except (when|if|in cases where|during)/i,
  /unless/i,
  /this (does not apply|restriction.*lifted|prohibition.*waived) (when|if|in)/i,
  /in cases of (imminent|deadly|life-threatening)/i,
  /emergency exception/i,
];

// ---------------------------------------------------------------------------
// Core rule extraction
// ---------------------------------------------------------------------------

/**
 * Extract structured rules from policy text
 */
export function extractRulesFromPolicy(
  policyText: string,
  policyId: string,
  agencyId: string,
): StructuredRule[] {
  const rules: StructuredRule[] = [];
  const sentences = policyText.split(/[.;]\s+/).filter(s => s.trim().length > 20);

  for (const sentence of sentences) {
    for (const [, config] of Object.entries(RULE_EXTRACTION_PATTERNS)) {
      const matchesPattern = config.patterns.some(p => p.test(sentence));
      if (!matchesPattern) continue;

      const category = detectCategory(sentence);
      const exceptions = extractExceptions(sentence);
      const conditions = extractConditions(sentence);

      // Determine severity based on category and rule type
      let severity = config.severity;
      if (category === 'Use_of_Force' && config.ruleType === 'prohibition') {
        severity = 'critical';
      }

      rules.push({
        policyId,
        agencyId,
        ruleType: config.ruleType,
        ruleName: generateRuleName(sentence, category),
        ruleText: sentence.trim(),
        conditions: conditions.length > 0 ? conditions : undefined,
        exceptions: exceptions.length > 0 ? exceptions : undefined,
        category,
        severity,
      });
      break; // One classification per sentence
    }
  }

  return rules;
}

/**
 * Detect policy category from text
 */
function detectCategory(text: string): string {
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some(p => p.test(text))) return category;
  }
  return 'Officer_Conduct';
}

/**
 * Extract exception clauses
 */
function extractExceptions(text: string): string[] {
  const exceptions: string[] = [];
  for (const pattern of EXCEPTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Get text after the exception keyword
      const idx = text.indexOf(match[0]);
      const exceptionText = text.substring(idx).trim();
      if (exceptionText.length > 10) {
        exceptions.push(exceptionText.substring(0, 200));
      }
    }
  }
  return exceptions;
}

/**
 * Extract conditions
 */
function extractConditions(text: string): string[] {
  const conditions: string[] = [];
  const conditionPatterns = [
    /when\s+(.{10,100})/i,
    /if\s+(.{10,100})/i,
    /only\s+(when|if|in)\s+(.{10,100})/i,
    /provided\s+that\s+(.{10,100})/i,
  ];

  for (const pattern of conditionPatterns) {
    const match = text.match(pattern);
    if (match) {
      const condText = match[1] || match[2];
      if (condText && condText.trim().length > 5) {
        conditions.push(condText.trim().substring(0, 200));
      }
    }
  }
  return conditions;
}

/**
 * Generate a concise rule name from text
 */
function generateRuleName(text: string, category: string): string {
  const words = text.trim().split(/\s+/).slice(0, 8);
  const prefix = category.replace(/_/g, ' ');
  return `${prefix}: ${words.join(' ')}...`;
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

/**
 * Store extracted rules in the database
 */
export async function storeRules(rules: StructuredRule[]): Promise<number> {
  let stored = 0;
  for (const rule of rules) {
    await prisma.policyRule.create({
      data: {
        policyId: rule.policyId,
        agencyId: rule.agencyId,
        ruleType: rule.ruleType,
        ruleName: rule.ruleName,
        ruleText: rule.ruleText,
        conditions: rule.conditions ? JSON.stringify(rule.conditions) : null,
        exceptions: rule.exceptions ? JSON.stringify(rule.exceptions) : null,
        category: rule.category,
        severity: rule.severity,
        effectiveDate: rule.effectiveDate,
      },
    });
    stored++;
  }
  return stored;
}

/**
 * Get rules for an agency by category
 */
export async function getAgencyRules(agencyId: string, category?: string) {
  return prisma.policyRule.findMany({
    where: {
      agencyId,
      ...(category ? { category } : {}),
    },
    orderBy: [{ severity: 'asc' }, { category: 'asc' }],
  });
}

/**
 * Get all rules for a specific policy
 */
export async function getPolicyRules(policyId: string) {
  return prisma.policyRule.findMany({
    where: { policyId },
    orderBy: { ruleType: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Phase 134 — Policy Action Mapping
// ---------------------------------------------------------------------------

/** Default mappings between event types and rule categories */
const DEFAULT_ACTION_RULE_MAPPINGS: Record<string, string[]> = {
  suspect_restrained: ['Use_of_Force', 'Arrest'],
  taser_deployed: ['Use_of_Force'],
  neck_restraint: ['Use_of_Force'],
  vehicle_search: ['Search_Seizure'],
  verbal_command: ['Officer_Conduct', 'Use_of_Force'],
  miranda_warning: ['Interrogation', 'Arrest'],
  weapon_drawn: ['Use_of_Force'],
  handcuffing: ['Arrest', 'Use_of_Force'],
  physical_strike: ['Use_of_Force'],
  officer_proximity: ['Officer_Conduct'],
  threat_language: ['Officer_Conduct', 'Use_of_Force'],
  compliance_command: ['Officer_Conduct'],
  uof_warning: ['Use_of_Force'],
  foot_pursuit: ['Pursuit'],
  vehicle_pursuit: ['Pursuit'],
  baton_strike: ['Use_of_Force'],
  pepper_spray: ['Use_of_Force'],
  k9_deployment: ['Use_of_Force'],
  shots_fired: ['Use_of_Force'],
  prone_restraint: ['Use_of_Force'],
  pat_down_search: ['Search_Seizure'],
};

/**
 * Generate action-to-rule mappings for an agency
 */
export async function generateActionMappings(agencyId: string): Promise<number> {
  const rules = await prisma.policyRule.findMany({ where: { agencyId } });
  let created = 0;

  for (const [eventType, categories] of Object.entries(DEFAULT_ACTION_RULE_MAPPINGS)) {
    for (const rule of rules) {
      if (!categories.includes(rule.category)) continue;

      const relevanceScore = calculateRelevanceScore(eventType, rule.ruleType, rule.category);

      try {
        await prisma.policyActionMapping.upsert({
          where: {
            eventType_ruleId: { eventType, ruleId: rule.ruleId },
          },
          update: { relevanceScore },
          create: {
            eventType,
            ruleId: rule.ruleId,
            relevanceScore,
            mappingReason: `${eventType} maps to ${rule.category} rule: ${rule.ruleName}`,
          },
        });
        created++;
      } catch {
        // Skip duplicates
      }
    }
  }

  return created;
}

/**
 * Calculate relevance score for action-to-rule mapping
 */
function calculateRelevanceScore(
  eventType: string,
  ruleType: string,
  category: string,
): number {
  let score = 0.5;

  // Higher relevance for prohibitions matching detected actions
  if (ruleType === 'prohibition') score += 0.2;
  if (ruleType === 'requirement') score += 0.15;
  if (ruleType === 'escalation') score += 0.1;

  // Direct category matches are more relevant
  const directMappings = DEFAULT_ACTION_RULE_MAPPINGS[eventType] || [];
  if (directMappings[0] === category) score += 0.15;

  // Critical events mapped to UoF rules get highest relevance
  const criticalEvents = ['neck_restraint', 'shots_fired', 'taser_deployed', 'prone_restraint'];
  if (criticalEvents.includes(eventType) && category === 'Use_of_Force') score += 0.1;

  return Math.min(0.98, score);
}

/**
 * Get relevant rules for an event type
 */
export async function getRelevantRules(eventType: string, agencyId: string) {
  const mappings = await prisma.policyActionMapping.findMany({
    where: { eventType },
  });

  const ruleIds = mappings.map(m => m.ruleId);
  const rules = await prisma.policyRule.findMany({
    where: {
      ruleId: { in: ruleIds },
      agencyId,
    },
  });

  return rules.map(rule => {
    const mapping = mappings.find(m => m.ruleId === rule.ruleId);
    return {
      ...rule,
      relevanceScore: mapping?.relevanceScore ?? 0,
      mappingReason: mapping?.mappingReason ?? '',
    };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}
