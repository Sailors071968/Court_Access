// ---------------------------------------------------------------------------
// Phase 19 — Intelligence Flag Detection
// Detects policy deviations between agencies and CHP canonical baseline.
// Example: agency allows chokehold but CHP prohibits → flag deviation
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlagSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface IntelligenceFlag {
  flagId: string;
  agencyId: string;
  agencyName: string;
  topicId: string;
  topicName: string;
  category: string;
  severity: FlagSeverity;
  flagType: string;
  title: string;
  description: string;
  chpPosition: string | null;
  agencyPosition: string | null;
  recommendation: string;
  detectedAt: Date;
}

export interface AgencyFlagReport {
  agencyId: string;
  agencyName: string;
  totalFlags: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  flags: IntelligenceFlag[];
}

export interface SystemFlagSummary {
  totalFlags: number;
  agenciesWithFlags: number;
  bySeverity: Record<FlagSeverity, number>;
  byCategory: Record<string, number>;
  topFlaggedTopics: { topicName: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Deviation detection rules
// ---------------------------------------------------------------------------

interface DeviationRule {
  topicPattern: RegExp;
  category: string;
  check: (agencyText: string, chpText: string) => DeviationResult | null;
}

interface DeviationResult {
  flagType: string;
  severity: FlagSeverity;
  title: string;
  description: string;
  chpPosition: string;
  agencyPosition: string;
  recommendation: string;
}

const DEVIATION_RULES: DeviationRule[] = [
  {
    topicPattern: /chokehold|carotid|neck restraint/i,
    category: 'USE_OF_FORCE',
    check: (agencyText, chpText) => {
      const chpBans = /prohibit|ban|forbidden|not permitted|shall not/i.test(chpText);
      const agencyAllows = /allow|authorize|permitted|may use|officer may/i.test(agencyText);
      if (chpBans && agencyAllows) {
        return {
          flagType: 'CHOKEHOLD_DEVIATION',
          severity: 'critical',
          title: 'Chokehold/Neck Restraint Policy Deviation',
          description: 'Agency policy allows chokehold or neck restraint techniques that CHP prohibits.',
          chpPosition: 'CHP prohibits chokehold/neck restraint techniques',
          agencyPosition: 'Agency appears to allow chokehold/neck restraint',
          recommendation: 'Review and align with CHP prohibition on chokehold/neck restraint techniques.',
        };
      }
      return null;
    },
  },
  {
    topicPattern: /body.?worn|body.?camera|bwc/i,
    category: 'TECHNOLOGY',
    check: (agencyText, chpText) => {
      const chpRequires = /require|mandatory|shall activate|must record/i.test(chpText);
      const agencyOptional = /optional|discretion|may activate|officer.+decide/i.test(agencyText);
      if (chpRequires && agencyOptional) {
        return {
          flagType: 'BWC_ACTIVATION_DEVIATION',
          severity: 'high',
          title: 'Body Camera Activation Policy Gap',
          description: 'CHP requires mandatory camera activation; agency leaves it to officer discretion.',
          chpPosition: 'CHP requires mandatory body camera activation',
          agencyPosition: 'Agency leaves body camera activation to officer discretion',
          recommendation: 'Strengthen body camera activation requirements to mandatory for all enforcement contacts.',
        };
      }
      return null;
    },
  },
  {
    topicPattern: /pursuit|vehicle.?chase/i,
    category: 'USE_OF_FORCE',
    check: (agencyText, chpText) => {
      const chpRestricts = /restrict|limit|supervisor.+approval|only when/i.test(chpText);
      const agencyBroad = /any felony|broad discretion|officer.+determine/i.test(agencyText);
      if (chpRestricts && agencyBroad) {
        return {
          flagType: 'PURSUIT_POLICY_DEVIATION',
          severity: 'high',
          title: 'Vehicle Pursuit Policy Deviation',
          description: 'Agency pursuit policy is broader than CHP restrictions.',
          chpPosition: 'CHP restricts pursuits with specific criteria',
          agencyPosition: 'Agency allows broader pursuit discretion',
          recommendation: 'Review pursuit policy against CHP restrictions and modern best practices.',
        };
      }
      return null;
    },
  },
  {
    topicPattern: /de.?escalation/i,
    category: 'USE_OF_FORCE',
    check: (agencyText, _chpText) => {
      const noPolicy = agencyText.length < 50;
      if (noPolicy) {
        return {
          flagType: 'MISSING_DEESCALATION',
          severity: 'high',
          title: 'Missing De-escalation Policy',
          description: 'Agency lacks a substantive de-escalation policy that CHP maintains.',
          chpPosition: 'CHP maintains comprehensive de-escalation requirements',
          agencyPosition: 'No substantive de-escalation policy found',
          recommendation: 'Develop comprehensive de-escalation policy aligned with CHP standards.',
        };
      }
      return null;
    },
  },
  {
    topicPattern: /internal affairs|complaint/i,
    category: 'ACCOUNTABILITY',
    check: (agencyText, chpText) => {
      const chpTimeline = /timeline|days|deadline|within \d+/i.test(chpText);
      const agencyNoTimeline = !(/timeline|days|deadline|within \d+/i.test(agencyText));
      if (chpTimeline && agencyNoTimeline && agencyText.length > 50) {
        return {
          flagType: 'IA_TIMELINE_GAP',
          severity: 'medium',
          title: 'Internal Affairs Investigation Timeline Gap',
          description: 'CHP specifies investigation timelines; agency policy lacks defined timelines.',
          chpPosition: 'CHP specifies investigation completion timelines',
          agencyPosition: 'Agency lacks defined investigation timelines',
          recommendation: 'Add specific investigation completion deadlines to internal affairs policy.',
        };
      }
      return null;
    },
  },
  {
    topicPattern: /discipline|disciplinary/i,
    category: 'ACCOUNTABILITY',
    check: (agencyText, chpText) => {
      const chpProgressive = /progressive|graduated|escalat/i.test(chpText);
      const agencyNone = !(/progressive|graduated|escalat/i.test(agencyText));
      if (chpProgressive && agencyNone && agencyText.length > 50) {
        return {
          flagType: 'DISCIPLINE_FRAMEWORK_GAP',
          severity: 'medium',
          title: 'Progressive Discipline Framework Gap',
          description: 'CHP uses progressive discipline; agency lacks structured discipline framework.',
          chpPosition: 'CHP uses progressive discipline framework',
          agencyPosition: 'No progressive discipline framework detected',
          recommendation: 'Implement progressive discipline framework aligned with CHP standards.',
        };
      }
      return null;
    },
  },
];

// ---------------------------------------------------------------------------
// Detect flags for a single agency
// ---------------------------------------------------------------------------

export async function detectAgencyFlags(
  agencyId: string,
): Promise<AgencyFlagReport> {
  const agency = await prisma.agency.findUnique({
    where: { agencyId },
  });

  if (!agency) {
    throw new Error(`Agency not found: ${agencyId}`);
  }

  // Get CHP agency
  const chp = await prisma.agency.findFirst({
    where: { agencyName: { contains: 'California Highway Patrol' } },
  });

  const flags: IntelligenceFlag[] = [];

  // Get all topics
  const topics = await prisma.policyTopic.findMany();

  for (const topic of topics) {
    // Get agency document for this topic
    const agencyDoc = await prisma.policyDocument.findFirst({
      where: { agencyId, topicId: topic.id, classificationStatus: 'completed' },
    });

    // Get CHP canonical document for this topic
    const chpDoc = chp
      ? await prisma.policyDocument.findFirst({
          where: { agencyId: chp.agencyId, topicId: topic.id, isChpCanonical: true },
        })
      : null;

    // Check: missing policy that CHP has
    if (!agencyDoc && chpDoc) {
      flags.push({
        flagId: `${agencyId}-missing-${topic.id}`,
        agencyId,
        agencyName: agency.agencyName,
        topicId: topic.id,
        topicName: topic.topicName,
        category: topic.category,
        severity: 'medium',
        flagType: 'MISSING_POLICY',
        title: `Missing Policy: ${topic.topicName}`,
        description: `Agency does not have a policy for "${topic.topicName}" which CHP maintains as a canonical policy.`,
        chpPosition: 'CHP has canonical policy',
        agencyPosition: 'No matching policy found',
        recommendation: `Develop a ${topic.topicName} policy aligned with CHP standards.`,
        detectedAt: new Date(),
      });
      continue;
    }

    // Run deviation rules
    if (agencyDoc && chpDoc) {
      const agencyText = agencyDoc.textContent || '';
      const chpText = chpDoc.textContent || '';

      for (const rule of DEVIATION_RULES) {
        if (rule.topicPattern.test(topic.topicName)) {
          const deviation = rule.check(agencyText, chpText);
          if (deviation) {
            flags.push({
              flagId: `${agencyId}-${deviation.flagType}-${topic.id}`,
              agencyId,
              agencyName: agency.agencyName,
              topicId: topic.id,
              topicName: topic.topicName,
              category: topic.category,
              severity: deviation.severity,
              flagType: deviation.flagType,
              title: deviation.title,
              description: deviation.description,
              chpPosition: deviation.chpPosition,
              agencyPosition: deviation.agencyPosition,
              recommendation: deviation.recommendation,
              detectedAt: new Date(),
            });
          }
        }
      }
    }
  }

  // Count by severity
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const flag of flags) {
    severityCounts[flag.severity]++;
  }

  return {
    agencyId,
    agencyName: agency.agencyName,
    totalFlags: flags.length,
    ...severityCounts,
    flags,
  };
}

// ---------------------------------------------------------------------------
// Detect flags across all agencies
// ---------------------------------------------------------------------------

export async function detectSystemFlags(): Promise<SystemFlagSummary> {
  const agencies = await prisma.agency.findMany({
    where: {
      agencyName: { not: { contains: 'California Highway Patrol' } },
    },
  });

  const allFlags: IntelligenceFlag[] = [];
  let agenciesWithFlags = 0;

  for (const agency of agencies) {
    try {
      const report = await detectAgencyFlags(agency.agencyId);
      if (report.totalFlags > 0) {
        agenciesWithFlags++;
        allFlags.push(...report.flags);
      }
    } catch (error) {
      console.error(
        `[Intelligence Flags] Failed for ${agency.agencyName}: ` +
        (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  // Aggregate by severity
  const bySeverity: Record<FlagSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  // Aggregate by category
  const byCategory: Record<string, number> = {};

  // Count flagged topics
  const topicCounts = new Map<string, number>();

  for (const flag of allFlags) {
    bySeverity[flag.severity]++;
    byCategory[flag.category] = (byCategory[flag.category] || 0) + 1;
    topicCounts.set(flag.topicName, (topicCounts.get(flag.topicName) || 0) + 1);
  }

  const topFlaggedTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topicName, count]) => ({ topicName, count }));

  return {
    totalFlags: allFlags.length,
    agenciesWithFlags,
    bySeverity,
    byCategory,
    topFlaggedTopics,
  };
}
