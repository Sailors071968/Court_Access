// ============================================
// Court Access — Doctrine-to-Litigation Mapper
// Maps doctrine compliance flags to specific
// litigation strategies, motions, and tasks.
// ============================================

import type {
  DoctrineCategory,
  DoctrineMatch,
  DoctrineToLitigationMapping,
  LitigationMotion,
  LitigationRecommendation,
  InvestigativeTask,
  ExpertRecommendation,
} from './types.ts';

// ---------------------------------------------------------------------------
// Doctrine-to-Litigation Mapping Registry
// ---------------------------------------------------------------------------

const LITIGATION_MAPPINGS: DoctrineToLitigationMapping[] = [
  // =========================================================================
  // LD-15 / LD-16: Search & Seizure — Suppression Motions
  // =========================================================================
  {
    domain: 'POST LD-15',
    category: 'search',
    flagType: 'violation',
    keywordTriggers: ['warrant', 'warrantless', 'consent', 'probable cause', 'search'],
    motions: [
      {
        type: 'motion_to_suppress',
        title: 'Motion to Suppress Evidence — Warrantless Search',
        basis: 'Fourth Amendment: Evidence obtained through warrantless search without valid exception must be suppressed under the exclusionary rule (Mapp v. Ohio).',
        priority: 'critical',
      },
      {
        type: 'motion_for_discovery',
        title: 'Motion for Discovery — Search Warrant Affidavit',
        basis: 'Defendant entitled to review warrant affidavit and supporting documents to challenge probable cause (Franks v. Delaware).',
        priority: 'high',
      },
    ],
    investigativeTasks: [
      {
        task: 'Obtain body-worn camera footage of search',
        description: 'Request all BWC and dashcam footage documenting the search to verify consent and scope.',
        urgency: 'immediate',
      },
      {
        task: 'Interview witnesses to search',
        description: 'Identify and interview any civilians who witnessed the search to corroborate or contradict the official account.',
        urgency: 'standard',
      },
    ],
    expertRecommendations: [
      {
        expertType: 'Fourth Amendment Constitutional Law Expert',
        purpose: 'Analyze the legality of the search under applicable Fourth Amendment standards and California constitutional protections.',
        relevance: 'Expert testimony can establish that the search violated established legal standards.',
      },
    ],
  },
  {
    domain: 'POST LD-16',
    category: 'search',
    flagType: 'violation',
    keywordTriggers: ['consent', 'scope', 'exceeded', 'inventory', 'vehicle search'],
    motions: [
      {
        type: 'motion_to_suppress',
        title: 'Motion to Suppress — Consent Search Exceeded Scope',
        basis: 'Search exceeded the scope of consent granted, rendering evidence beyond that scope inadmissible (Florida v. Jimeno).',
        priority: 'critical',
      },
    ],
    investigativeTasks: [
      {
        task: 'Document scope of consent given',
        description: 'Determine exact words used by the subject when granting consent and whether scope limitations were communicated.',
        urgency: 'immediate',
      },
    ],
    expertRecommendations: [],
  },
  {
    domain: 'POST LD-16',
    category: 'search',
    flagType: 'concern',
    keywordTriggers: ['consent', 'traffic stop', 'extended', 'prolonged', 'dog sniff'],
    motions: [
      {
        type: 'motion_to_suppress',
        title: 'Motion to Suppress — Unlawfully Extended Traffic Stop',
        basis: 'Traffic stop was extended beyond its original purpose without reasonable suspicion, violating Rodriguez v. United States.',
        priority: 'high',
      },
    ],
    investigativeTasks: [
      {
        task: 'Obtain traffic stop timeline',
        description: 'Analyze CAD records, BWC timestamps, and dispatch logs to determine total stop duration and point of extension.',
        urgency: 'immediate',
      },
    ],
    expertRecommendations: [],
  },

  // =========================================================================
  // LD-15: Detention Violations
  // =========================================================================
  {
    domain: 'POST LD-15',
    category: 'detention',
    flagType: 'violation',
    keywordTriggers: ['reasonable suspicion', 'detention', 'stop', 'terry', 'prolonged'],
    motions: [
      {
        type: 'motion_to_suppress',
        title: 'Motion to Suppress — Unlawful Detention',
        basis: 'Detention lacked reasonable suspicion based on specific articulable facts (Terry v. Ohio). All evidence obtained as a result must be suppressed.',
        priority: 'critical',
      },
    ],
    investigativeTasks: [
      {
        task: 'Analyze officer report for articulable facts',
        description: 'Review the police report to determine whether the officer documented specific facts justifying reasonable suspicion.',
        urgency: 'immediate',
      },
      {
        task: 'Check RIPA data for stop',
        description: 'Request RIPA (Racial and Identity Profiling Act) data for the stop to identify potential profiling.',
        urgency: 'standard',
      },
    ],
    expertRecommendations: [
      {
        expertType: 'Police Practices Expert',
        purpose: 'Evaluate whether the facts known to the officer at the time of detention constituted reasonable suspicion under the totality of circumstances.',
        relevance: 'Expert can testify that standard police training would not justify the detention under the described circumstances.',
      },
    ],
  },

  // =========================================================================
  // LD-15: Miranda Violations
  // =========================================================================
  {
    domain: 'POST LD-15',
    category: 'miranda',
    flagType: 'violation',
    keywordTriggers: ['miranda', 'rights', 'custodial', 'interrogation', 'invocation'],
    motions: [
      {
        type: 'motion_to_suppress',
        title: 'Motion to Suppress Statements — Miranda Violation',
        basis: 'Statements obtained during custodial interrogation without proper Miranda advisement must be suppressed (Miranda v. Arizona).',
        priority: 'critical',
      },
      {
        type: 'motion_in_limine',
        title: 'Motion in Limine — Exclude Post-Invocation Statements',
        basis: 'Any statements obtained after defendant invoked right to counsel must be excluded (Edwards v. Arizona).',
        priority: 'critical',
      },
    ],
    investigativeTasks: [
      {
        task: 'Obtain interrogation recordings',
        description: 'Request all audio/video recordings of the interrogation to verify Miranda timing and invocation.',
        urgency: 'immediate',
      },
      {
        task: 'Review custody timeline',
        description: 'Determine exact point of custody to establish when Miranda was required.',
        urgency: 'immediate',
      },
    ],
    expertRecommendations: [
      {
        expertType: 'False Confession Expert',
        purpose: 'Evaluate interrogation techniques for coercive elements that may have produced involuntary statements.',
        relevance: 'Expert can identify psychologically coercive techniques used during the interrogation.',
      },
    ],
  },

  // =========================================================================
  // LD-15: Interrogation Violations
  // =========================================================================
  {
    domain: 'POST LD-15',
    category: 'interrogation',
    flagType: 'violation',
    keywordTriggers: ['coercion', 'deception', 'involuntary', 'confession', 'threat'],
    motions: [
      {
        type: 'motion_to_suppress',
        title: 'Motion to Suppress — Involuntary Confession',
        basis: 'Statement was obtained through coercive interrogation techniques rendering it involuntary under the Due Process Clause.',
        priority: 'critical',
      },
    ],
    investigativeTasks: [
      {
        task: 'Analyze interrogation techniques used',
        description: 'Review recordings for evidence of threats, promises, deception, or other coercive techniques.',
        urgency: 'immediate',
      },
    ],
    expertRecommendations: [
      {
        expertType: 'Forensic Psychologist',
        purpose: 'Evaluate the psychological impact of interrogation techniques on the defendant and the voluntariness of any statements.',
        relevance: 'Expert testimony on false confession research and coercive interrogation practices.',
      },
    ],
  },

  // =========================================================================
  // LD-20: Use of Force Violations
  // =========================================================================
  {
    domain: 'POST LD-20',
    category: 'use_of_force',
    flagType: 'violation',
    keywordTriggers: ['excessive force', 'deadly force', 'taser', 'chokehold', 'restrained', 'handcuffed'],
    motions: [
      {
        type: 'motion_to_dismiss',
        title: 'Motion to Dismiss — Fruit of Excessive Force',
        basis: 'Arrest effectuated through excessive force taints all evidence obtained, warranting dismissal.',
        priority: 'high',
      },
      {
        type: 'motion_for_sanctions',
        title: 'Motion for Sanctions — Spoliation of BWC Evidence',
        basis: 'If body-worn camera was deactivated during use of force, adverse inference requested.',
        priority: 'medium',
      },
    ],
    investigativeTasks: [
      {
        task: 'Obtain all body-worn camera footage',
        description: 'Request BWC footage from all officers present during the use of force incident.',
        urgency: 'immediate',
      },
      {
        task: 'Document injuries with medical records',
        description: 'Obtain medical records documenting injuries sustained during the arrest, including photographs.',
        urgency: 'immediate',
      },
      {
        task: 'Review use of force report',
        description: 'Analyze the department use of force report for inconsistencies with BWC footage.',
        urgency: 'standard',
      },
    ],
    expertRecommendations: [
      {
        expertType: 'Use of Force Expert / Police Practices',
        purpose: 'Evaluate whether the force used was objectively reasonable under Graham v. Connor and California AB 392 standards.',
        relevance: 'Expert can testify that the force was disproportionate to the threat and violated POST training standards.',
      },
      {
        expertType: 'Medical Expert',
        purpose: 'Document and testify regarding injuries consistent with excessive force application.',
        relevance: 'Medical testimony establishes the severity of force used beyond what the officer claims.',
      },
    ],
  },
  {
    domain: 'POST LD-20',
    category: 'use_of_force',
    flagType: 'concern',
    keywordTriggers: ['de-escalation', 'mental health', 'crisis', 'CIT', 'force'],
    motions: [
      {
        type: 'motion_in_limine',
        title: 'Motion in Limine — Exclude Evidence of Resistance',
        basis: 'Officer\'s characterization of "resistance" inconsistent with evidence; prejudicial testimony should be excluded.',
        priority: 'medium',
      },
    ],
    investigativeTasks: [
      {
        task: 'Investigate de-escalation attempts',
        description: 'Determine whether officers attempted de-escalation before force, including CIT training compliance.',
        urgency: 'standard',
      },
    ],
    expertRecommendations: [
      {
        expertType: 'Crisis Intervention Specialist',
        purpose: 'Evaluate whether proper crisis intervention techniques were employed before resorting to force.',
        relevance: 'Expert can identify failures in CIT protocols that led to unnecessary force.',
      },
    ],
  },

  // =========================================================================
  // LD-15: Arrest Violations
  // =========================================================================
  {
    domain: 'POST LD-15',
    category: 'arrest',
    flagType: 'violation',
    keywordTriggers: ['probable cause', 'arrest', 'warrantless', 'unlawful arrest'],
    motions: [
      {
        type: 'motion_to_suppress',
        title: 'Motion to Suppress — Arrest Without Probable Cause',
        basis: 'Warrantless arrest lacked probable cause; all evidence obtained incident to arrest must be suppressed.',
        priority: 'critical',
      },
      {
        type: 'motion_to_dismiss',
        title: 'Motion to Dismiss — Unlawful Arrest',
        basis: 'Charges should be dismissed as they are the fruit of an unlawful arrest lacking probable cause.',
        priority: 'high',
      },
    ],
    investigativeTasks: [
      {
        task: 'Analyze arrest report for probable cause',
        description: 'Review the arrest report to determine whether sufficient probable cause existed at the time of arrest.',
        urgency: 'immediate',
      },
    ],
    expertRecommendations: [
      {
        expertType: 'Police Practices Expert',
        purpose: 'Evaluate whether the facts described in the report establish probable cause under applicable standards.',
        relevance: 'Expert can testify that the facts did not rise to the level of probable cause for arrest.',
      },
    ],
  },

  // =========================================================================
  // LD-17/LD-24: Evidence Handling Violations
  // =========================================================================
  {
    domain: 'POST LD-24',
    category: 'chain_of_custody',
    flagType: 'violation',
    keywordTriggers: ['chain of custody', 'contaminated', 'evidence handling', 'tampered'],
    motions: [
      {
        type: 'motion_to_suppress',
        title: 'Motion to Suppress — Broken Chain of Custody',
        basis: 'Evidence chain of custody is compromised; items cannot be authenticated as the same evidence collected at the scene.',
        priority: 'high',
      },
      {
        type: 'motion_in_limine',
        title: 'Motion in Limine — Exclude Contaminated Evidence',
        basis: 'Evidence was contaminated during collection or storage, rendering forensic analysis unreliable.',
        priority: 'high',
      },
    ],
    investigativeTasks: [
      {
        task: 'Audit evidence chain of custody',
        description: 'Obtain complete chain of custody documentation and identify all gaps or discrepancies.',
        urgency: 'immediate',
      },
      {
        task: 'Request laboratory analysis records',
        description: 'Obtain lab notes, bench notes, and quality control records for all forensic analyses performed.',
        urgency: 'standard',
      },
    ],
    expertRecommendations: [
      {
        expertType: 'Forensic Science Expert',
        purpose: 'Evaluate evidence handling procedures and identify deviations from accepted forensic standards.',
        relevance: 'Expert can testify that improper handling compromised the reliability of forensic results.',
      },
    ],
  },
  {
    domain: 'POST LD-24',
    category: 'evidence_handling',
    flagType: 'violation',
    keywordTriggers: ['improperly', 'stored', 'packaged', 'degraded', 'destroyed'],
    motions: [
      {
        type: 'motion_for_sanctions',
        title: 'Motion for Sanctions — Evidence Spoliation',
        basis: 'Critical evidence was improperly stored or destroyed, warranting adverse inference instruction.',
        priority: 'high',
      },
    ],
    investigativeTasks: [
      {
        task: 'Document evidence storage conditions',
        description: 'Investigate how evidence was stored and whether proper environmental conditions were maintained.',
        urgency: 'standard',
      },
    ],
    expertRecommendations: [
      {
        expertType: 'Evidence Management Expert',
        purpose: 'Evaluate evidence storage and handling procedures against POST and IACIS standards.',
        relevance: 'Expert testimony on proper evidence handling procedures establishes deviation from standards.',
      },
    ],
  },

  // =========================================================================
  // LD-18: Report Writing Violations
  // =========================================================================
  {
    domain: 'POST LD-18',
    category: 'report_writing',
    flagType: 'violation',
    keywordTriggers: ['false', 'misleading', 'omitted', 'altered', 'inaccurate', 'Brady'],
    motions: [
      {
        type: 'motion_for_discovery',
        title: 'Motion for Discovery — Brady/Pitchess Material',
        basis: 'Officer\'s report contains material omissions or inaccuracies; discovery of officer\'s personnel file and prior complaints warranted.',
        priority: 'critical',
      },
      {
        type: 'motion_to_dismiss',
        title: 'Motion to Dismiss — Prosecution Based on False Reports',
        basis: 'Case is built on demonstrably inaccurate reports constituting a Brady violation.',
        priority: 'high',
      },
    ],
    investigativeTasks: [
      {
        task: 'Compare report to BWC footage',
        description: 'Perform detailed comparison of officer report narrative against body-worn camera footage timestamps.',
        urgency: 'immediate',
      },
      {
        task: 'File Pitchess motion for officer records',
        description: 'Seek officer personnel records for history of false reporting or dishonesty complaints.',
        urgency: 'standard',
      },
    ],
    expertRecommendations: [],
  },

  // =========================================================================
  // LD-30: Crime Scene Violations
  // =========================================================================
  {
    domain: 'POST LD-30',
    category: 'crime_scene',
    flagType: 'violation',
    keywordTriggers: ['crime scene', 'contaminated', 'unsecured', 'compromised', 'documentation'],
    motions: [
      {
        type: 'motion_to_suppress',
        title: 'Motion to Suppress — Compromised Crime Scene Evidence',
        basis: 'Crime scene was not properly secured, resulting in contamination that renders evidence unreliable.',
        priority: 'high',
      },
    ],
    investigativeTasks: [
      {
        task: 'Obtain crime scene log',
        description: 'Review the scene entry log to identify unauthorized persons who entered the crime scene.',
        urgency: 'immediate',
      },
      {
        task: 'Review crime scene photographs and video',
        description: 'Analyze scene documentation for evidence of contamination or improper procedures.',
        urgency: 'standard',
      },
    ],
    expertRecommendations: [
      {
        expertType: 'Crime Scene Reconstruction Expert',
        purpose: 'Evaluate crime scene processing procedures and identify deviations from POST standards.',
        relevance: 'Expert can testify that scene contamination undermines the reliability of evidence collected.',
      },
    ],
  },

  // =========================================================================
  // LD-17: Evidence Presentation / Testimony
  // =========================================================================
  {
    domain: 'POST LD-17',
    category: 'testimony',
    flagType: 'violation',
    keywordTriggers: ['inconsistent', 'contradictory', 'perjury', 'credibility', 'impeachment'],
    motions: [
      {
        type: 'motion_in_limine',
        title: 'Motion in Limine — Exclude Unreliable Testimony',
        basis: 'Officer testimony is materially inconsistent with documented evidence, rendering it unreliable.',
        priority: 'high',
      },
    ],
    investigativeTasks: [
      {
        task: 'Prepare impeachment evidence',
        description: 'Compile all prior statements, reports, and testimony for cross-examination preparation.',
        urgency: 'standard',
      },
    ],
    expertRecommendations: [],
  },

  // =========================================================================
  // LD-21: Patrol — Pursuit Violations
  // =========================================================================
  {
    domain: 'POST LD-21',
    category: 'pursuit',
    flagType: 'violation',
    keywordTriggers: ['pursuit', 'chase', 'vehicle', 'PIT', 'spike strips', 'ramming'],
    motions: [
      {
        type: 'motion_to_dismiss',
        title: 'Motion to Dismiss — Unlawful Pursuit',
        basis: 'Pursuit violated department policy and POST training standards, creating unreasonable danger to the public.',
        priority: 'medium',
      },
    ],
    investigativeTasks: [
      {
        task: 'Obtain pursuit records',
        description: 'Request CAD logs, radio transmissions, GPS data, and supervisor authorization records for the pursuit.',
        urgency: 'immediate',
      },
      {
        task: 'Review department pursuit policy',
        description: 'Compare the pursuit to department policy to identify specific violations.',
        urgency: 'standard',
      },
    ],
    expertRecommendations: [
      {
        expertType: 'Police Pursuit Expert',
        purpose: 'Evaluate whether the pursuit decision and conduct complied with POST standards and department policy.',
        relevance: 'Expert can testify that the pursuit created unreasonable risks relative to the severity of the offense.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Litigation Mapper Service
// ---------------------------------------------------------------------------

export class DoctrineLitigationMapper {
  /**
   * Get litigation recommendations for a single doctrine match.
   */
  static getRecommendation(match: DoctrineMatch): LitigationRecommendation | undefined {
    const { doctrineRule, flagType } = match;

    if (flagType === 'compliant') return undefined;

    // Find matching mappings by category + flagType
    const applicableMappings = LITIGATION_MAPPINGS.filter((m) => {
      // Match on category
      if (m.category !== doctrineRule.category) return false;

      // Match on flagType (violations match violation mappings, concerns match both)
      if (flagType === 'violation' && m.flagType !== 'violation') return false;
      if (flagType === 'concern' && m.flagType !== 'concern' && m.flagType !== 'violation') return false;

      return true;
    });

    if (applicableMappings.length === 0) return undefined;

    // Aggregate recommendations from all applicable mappings
    const motions: LitigationMotion[] = [];
    const tasks: InvestigativeTask[] = [];
    const experts: ExpertRecommendation[] = [];
    const seenMotionTitles = new Set<string>();
    const seenTasks = new Set<string>();
    const seenExperts = new Set<string>();

    for (const mapping of applicableMappings) {
      // Check keyword triggers for relevance
      const hasKeywordMatch = mapping.keywordTriggers.some((trigger) => {
        const lowerRule = doctrineRule.ruleText.toLowerCase();
        const lowerTopic = doctrineRule.topic.toLowerCase();
        const lowerTrigger = trigger.toLowerCase();
        return lowerRule.includes(lowerTrigger) || lowerTopic.includes(lowerTrigger) ||
          doctrineRule.keywords.some((kw) => kw.toLowerCase().includes(lowerTrigger));
      });

      if (!hasKeywordMatch && applicableMappings.length > 1) continue;

      for (const motion of mapping.motions) {
        if (!seenMotionTitles.has(motion.title)) {
          seenMotionTitles.add(motion.title);
          motions.push(motion);
        }
      }
      for (const task of mapping.investigativeTasks) {
        if (!seenTasks.has(task.task)) {
          seenTasks.add(task.task);
          tasks.push(task);
        }
      }
      for (const expert of mapping.expertRecommendations) {
        if (!seenExperts.has(expert.expertType)) {
          seenExperts.add(expert.expertType);
          experts.push(expert);
        }
      }
    }

    if (motions.length === 0 && tasks.length === 0 && experts.length === 0) {
      return undefined;
    }

    const strategySummary = DoctrineLitigationMapper.generateStrategySummary(
      doctrineRule.category,
      flagType,
      motions,
      tasks,
    );

    return {
      motions,
      investigativeTasks: tasks,
      expertRecommendations: experts,
      strategySummary,
    };
  }

  /**
   * Get aggregated litigation recommendations for all matches in a compliance result.
   */
  static getAggregatedRecommendations(
    matches: DoctrineMatch[],
  ): LitigationRecommendation {
    const allMotions: LitigationMotion[] = [];
    const allTasks: InvestigativeTask[] = [];
    const allExperts: ExpertRecommendation[] = [];
    const seenMotionTitles = new Set<string>();
    const seenTasks = new Set<string>();
    const seenExperts = new Set<string>();

    for (const match of matches) {
      if (match.flagType === 'compliant') continue;

      const rec = DoctrineLitigationMapper.getRecommendation(match);
      if (!rec) continue;

      for (const motion of rec.motions) {
        if (!seenMotionTitles.has(motion.title)) {
          seenMotionTitles.add(motion.title);
          allMotions.push(motion);
        }
      }
      for (const task of rec.investigativeTasks) {
        if (!seenTasks.has(task.task)) {
          seenTasks.add(task.task);
          allTasks.push(task);
        }
      }
      for (const expert of rec.expertRecommendations) {
        if (!seenExperts.has(expert.expertType)) {
          seenExperts.add(expert.expertType);
          allExperts.push(expert);
        }
      }
    }

    // Sort motions by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    allMotions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Sort tasks by urgency
    const urgencyOrder = { immediate: 0, standard: 1, low: 2 };
    allTasks.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    const violationCount = matches.filter((m) => m.flagType === 'violation').length;
    const concernCount = matches.filter((m) => m.flagType === 'concern').length;

    let strategySummary = '';
    if (violationCount > 0) {
      strategySummary = `Identified ${violationCount} potential doctrine violation(s) and ${concernCount} concern(s). `;
      strategySummary += `${allMotions.length} motion(s) recommended, ${allTasks.length} investigative task(s) identified, `;
      strategySummary += `and ${allExperts.length} expert consultation(s) suggested. `;
      const criticalMotions = allMotions.filter((m) => m.priority === 'critical');
      if (criticalMotions.length > 0) {
        strategySummary += `Priority: File ${criticalMotions.map((m) => m.title).join('; ')}.`;
      }
    } else if (concernCount > 0) {
      strategySummary = `Identified ${concernCount} compliance concern(s) warranting further investigation. `;
      strategySummary += `${allMotions.length} potential motion(s) and ${allTasks.length} investigative task(s) recommended.`;
    } else {
      strategySummary = 'No doctrine violations or concerns identified requiring litigation action.';
    }

    return {
      motions: allMotions,
      investigativeTasks: allTasks,
      expertRecommendations: allExperts,
      strategySummary,
    };
  }

  /**
   * Generate a strategy summary for a single match recommendation.
   */
  private static generateStrategySummary(
    category: DoctrineCategory,
    flagType: string,
    motions: LitigationMotion[],
    tasks: InvestigativeTask[],
  ): string {
    const categoryLabel = category.replace(/_/g, ' ');
    if (flagType === 'violation') {
      return `${categoryLabel} doctrine violation detected. ` +
        `${motions.length} motion(s) recommended. ` +
        `${tasks.length} investigative task(s) required for case preparation.`;
    }
    return `${categoryLabel} compliance concern identified. ` +
      `${motions.length} potential motion(s) available. ` +
      `Further investigation recommended before filing.`;
  }
}
