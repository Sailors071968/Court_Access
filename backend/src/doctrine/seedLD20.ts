// ============================================
// POST LD-20: Use of Force — Seed Data
// ============================================

import type { ParsedDoctrineChunk } from './types.ts';

export const LD20_DOCTRINE_RULES: ParsedDoctrineChunk[] = [
  // =========================================================================
  // Reasonableness Standard
  // =========================================================================
  {
    source: 'POST LD-20',
    chapter: 'Reasonableness Standard',
    topic: 'Objective Reasonableness',
    rule: 'Use of force must be objectively reasonable based on the totality of the circumstances known to the officer at the time force was used.',
    explanation: 'The reasonableness of force is judged from the perspective of a reasonable officer on the scene, not with 20/20 hindsight. The calculus of reasonableness allows for the fact that officers must make split-second decisions.',
    legalImplication: 'Force that is not objectively reasonable violates the Fourth Amendment and may result in civil and criminal liability.',
    category: 'use_of_force',
    keywords: ['objective reasonableness', 'use of force', 'totality of circumstances', 'fourth amendment'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Reasonableness Standard',
    topic: 'Proportional Force',
    rule: 'The level of force used must be proportional to the threat faced. Officers must use only the amount of force necessary to control the situation.',
    explanation: 'Force that exceeds what is necessary to address the threat is excessive. Officers should use the minimum force required to gain compliance and control.',
    legalImplication: 'Disproportionate force constitutes excessive force and may result in civil rights violations and criminal prosecution.',
    category: 'use_of_force',
    keywords: ['proportional force', 'minimum force', 'excessive force', 'necessary force', 'compliance'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Reasonableness Standard',
    topic: 'Totality of Circumstances',
    rule: 'The reasonableness of force is evaluated based on the totality of the circumstances, including the severity of the crime, whether the suspect poses an immediate threat, and whether the suspect is actively resisting or attempting to evade arrest.',
    explanation: 'These factors, established in Graham v. Connor, form the framework for evaluating use of force. No single factor is dispositive; all circumstances known to the officer must be considered.',
    legalImplication: 'Failure to consider the totality of circumstances may result in a finding of excessive force.',
    category: 'use_of_force',
    keywords: ['totality of circumstances', 'Graham v Connor', 'severity', 'immediate threat', 'resisting'],
  },

  // =========================================================================
  // Graham v. Connor Factors
  // =========================================================================
  {
    source: 'POST LD-20',
    chapter: 'Graham v Connor',
    topic: 'Severity of Crime',
    rule: 'The severity of the crime at issue is a key factor in determining the reasonableness of force. More serious crimes may justify greater force.',
    explanation: 'An officer confronting a violent felony suspect may use more force than when dealing with a minor infraction. The nature and seriousness of the offense informs the level of permissible force.',
    legalImplication: 'Using significant force for a minor offense may be found excessive.',
    category: 'use_of_force',
    keywords: ['severity of crime', 'Graham v Connor', 'use of force', 'reasonableness', 'felony'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Graham v Connor',
    topic: 'Immediate Threat',
    rule: 'Whether the suspect poses an immediate threat to the safety of officers or others is the most critical factor in evaluating use of force.',
    explanation: 'The immediacy and severity of the threat is the primary consideration. A suspect who is armed, aggressive, or creating danger to others poses a greater immediate threat than one who is passive.',
    legalImplication: 'Force used against a non-threatening suspect is presumptively excessive.',
    category: 'use_of_force',
    keywords: ['immediate threat', 'Graham v Connor', 'safety', 'armed', 'aggressive', 'use of force'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Graham v Connor',
    topic: 'Active Resistance',
    rule: 'Whether the suspect is actively resisting arrest or attempting to evade arrest by flight affects the reasonableness of force.',
    explanation: 'Active resistance (fighting, pulling away, fleeing) may justify greater force than passive resistance (going limp, refusing to move). Verbal resistance alone generally does not justify physical force.',
    legalImplication: 'Force used against a passively resisting or compliant suspect may constitute excessive force.',
    category: 'use_of_force',
    keywords: ['active resistance', 'passive resistance', 'flight', 'Graham v Connor', 'compliance'],
  },

  // =========================================================================
  // Deadly Force Rules
  // =========================================================================
  {
    source: 'POST LD-20',
    chapter: 'Deadly Force',
    topic: 'Deadly Force Standard',
    rule: 'Deadly force may only be used when the officer reasonably believes that the action is in defense of human life, including the officer\'s own life, or to prevent serious bodily injury.',
    explanation: 'Under Tennessee v. Garner, deadly force is constitutionally limited. An officer may not use deadly force to prevent the escape of an unarmed, non-dangerous suspect.',
    legalImplication: 'Unjustified use of deadly force violates the Fourth Amendment and may result in criminal prosecution and civil liability.',
    category: 'use_of_force',
    keywords: ['deadly force', 'defense of life', 'serious bodily injury', 'Tennessee v Garner', 'fourth amendment'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Deadly Force',
    topic: 'Fleeing Felon',
    rule: 'An officer may use deadly force to prevent the escape of a fleeing suspect only if the officer has probable cause to believe the suspect poses a significant threat of death or serious physical injury to the officer or others.',
    explanation: 'The fleeing felon rule was limited by Tennessee v. Garner. Simply fleeing from a felony arrest does not justify deadly force unless the suspect poses an ongoing lethal threat.',
    legalImplication: 'Shooting an unarmed fleeing suspect who poses no imminent danger is unlawful.',
    category: 'use_of_force',
    keywords: ['fleeing felon', 'deadly force', 'Tennessee v Garner', 'significant threat', 'probable cause'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Deadly Force',
    topic: 'Warning Before Deadly Force',
    rule: 'When feasible, officers should give a verbal warning before using deadly force.',
    explanation: 'A warning gives the suspect an opportunity to comply and may prevent the need for deadly force. However, warnings are not required when giving a warning would create additional risk.',
    legalImplication: 'Failure to warn when feasible may be considered in evaluating the reasonableness of deadly force.',
    category: 'use_of_force',
    keywords: ['warning', 'deadly force', 'verbal warning', 'feasible', 'comply'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Deadly Force',
    topic: 'Shooting at Vehicles',
    rule: 'Officers should not discharge firearms at or from a moving vehicle unless a person in the vehicle is immediately threatening the officer or another person with deadly force by means other than the vehicle.',
    explanation: 'Shooting at a moving vehicle is generally ineffective and creates risks to bystanders. A vehicle alone is not sufficient justification for deadly force unless the totality of circumstances demands it.',
    legalImplication: 'Shooting at a vehicle without immediate deadly threat may constitute excessive force.',
    category: 'use_of_force',
    keywords: ['shooting at vehicles', 'moving vehicle', 'deadly force', 'policy', 'bystander risk'],
  },

  // =========================================================================
  // Force Escalation / De-escalation
  // =========================================================================
  {
    source: 'POST LD-20',
    chapter: 'Force Escalation',
    topic: 'De-escalation Duty',
    rule: 'Officers must, when feasible, use de-escalation techniques to reduce the need for force before resorting to physical force.',
    explanation: 'De-escalation includes verbal persuasion, creating distance, slowing down the encounter, calling for additional resources, and using time as a tactical tool.',
    legalImplication: 'Failure to attempt de-escalation when feasible may weigh against the reasonableness of force used.',
    category: 'use_of_force',
    keywords: ['de-escalation', 'force', 'verbal persuasion', 'distance', 'time', 'tactical'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Force Escalation',
    topic: 'Force Continuum',
    rule: 'Officers should escalate force only as necessary in response to the level of resistance encountered and should de-escalate force when the threat diminishes.',
    explanation: 'The force continuum provides a framework for matching force to resistance. As the threat decreases, the level of force should decrease accordingly.',
    legalImplication: 'Continued use of high-level force after the threat has diminished constitutes excessive force.',
    category: 'use_of_force',
    keywords: ['force continuum', 'escalation', 'de-escalation', 'resistance', 'threat level'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Force Escalation',
    topic: 'Duty to Intervene',
    rule: 'Officers who witness another officer using excessive or unnecessary force have a duty to intervene to stop the use of excessive force.',
    explanation: 'The duty to intervene requires officers to take action when they observe force that is clearly excessive. This includes verbal intervention, physical intervention, and reporting.',
    legalImplication: 'Failure to intervene in excessive force may result in individual civil liability and criminal charges.',
    category: 'use_of_force',
    keywords: ['duty to intervene', 'excessive force', 'witness', 'intervention', 'reporting'],
  },

  // =========================================================================
  // Officer Safety
  // =========================================================================
  {
    source: 'POST LD-20',
    chapter: 'Officer Safety',
    topic: 'Tactical Positioning',
    rule: 'Officers should position themselves tactically to reduce the likelihood that force will be necessary.',
    explanation: 'Good tactical positioning includes maintaining distance, using cover and concealment, and approaching from positions of advantage. Poor positioning may create situations requiring force that could have been avoided.',
    legalImplication: 'While tactical decisions are given deference, unnecessarily creating dangerous situations may affect force reasonableness analysis.',
    category: 'use_of_force',
    keywords: ['tactical positioning', 'officer safety', 'cover', 'concealment', 'distance'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Officer Safety',
    topic: 'Medical Aid After Force',
    rule: 'Officers must provide or arrange for medical aid to any person who is injured as a result of use of force as soon as it is safe to do so.',
    explanation: 'The duty to provide medical aid applies regardless of whether the person is a suspect, victim, or bystander. Delay in providing medical aid may aggravate injuries and increase liability.',
    legalImplication: 'Failure to provide timely medical aid after use of force may constitute deliberate indifference and increase liability.',
    category: 'use_of_force',
    keywords: ['medical aid', 'use of force', 'injury', 'duty', 'deliberate indifference'],
  },

  // =========================================================================
  // Force Reporting
  // =========================================================================
  {
    source: 'POST LD-20',
    chapter: 'Force Reporting',
    topic: 'Use of Force Reporting',
    rule: 'All uses of force must be reported and documented in accordance with departmental policy, including a detailed description of the force used and the circumstances justifying it.',
    explanation: 'Use of force reports serve accountability, training, and legal purposes. They must be completed promptly and include all relevant details.',
    legalImplication: 'Failure to report use of force may constitute policy violations and obstruction.',
    category: 'use_of_force',
    keywords: ['use of force', 'reporting', 'documentation', 'accountability', 'policy'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Force Reporting',
    topic: 'Force Review',
    rule: 'All reportable uses of force must be reviewed by a supervisor to determine whether the force was within policy and whether additional training or corrective action is needed.',
    explanation: 'Supervisory review provides an additional layer of accountability. The review should assess the totality of circumstances, the officer\'s decision-making, and whether de-escalation was attempted.',
    legalImplication: 'Inadequate supervisory review may indicate a pattern of tolerance for excessive force.',
    category: 'use_of_force',
    keywords: ['force review', 'supervisory review', 'accountability', 'policy', 'corrective action'],
  },

  // =========================================================================
  // Special Force Situations
  // =========================================================================
  {
    source: 'POST LD-20',
    chapter: 'Special Situations',
    topic: 'Persons in Crisis',
    rule: 'Officers encountering persons experiencing a mental health crisis should use crisis intervention techniques and avoid force when possible.',
    explanation: 'Mental health crises require a modified response. Officers should use time, distance, and verbal techniques to de-escalate. Force should be a last resort.',
    legalImplication: 'Use of force against a person in mental health crisis when alternatives were available may be found excessive.',
    category: 'use_of_force',
    keywords: ['mental health crisis', 'crisis intervention', 'de-escalation', 'force', 'alternatives'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Special Situations',
    topic: 'Restrained Persons',
    rule: 'Officers must not use force against a person who is fully restrained and under control unless the person poses an immediate threat despite restraint.',
    explanation: 'Once a person is handcuffed and compliant, the justification for additional force generally ceases. Continued force against a restrained person is presumptively excessive.',
    legalImplication: 'Force against a restrained, compliant person constitutes excessive force and may result in criminal charges.',
    category: 'use_of_force',
    keywords: ['restrained', 'handcuffed', 'compliant', 'excessive force', 'control'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Special Situations',
    topic: 'Positional Asphyxia',
    rule: 'Officers must be aware of and take steps to prevent positional asphyxia when restraining subjects, particularly those who are prone, obese, or under the influence of substances.',
    explanation: 'Prone restraint with pressure on the back can restrict breathing. Officers should avoid sustained pressure on the chest or back and should place restrained persons in a recovery position.',
    legalImplication: 'Deaths from positional asphyxia may result in criminal prosecution and significant civil liability.',
    category: 'use_of_force',
    keywords: ['positional asphyxia', 'prone restraint', 'breathing', 'recovery position', 'in-custody death'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Special Situations',
    topic: 'Neck Restraints',
    rule: 'Chokeholds and carotid restraints are restricted to situations where deadly force is justified, or prohibited entirely by departmental policy.',
    explanation: 'Neck restraints carry a high risk of death or serious injury. Many agencies have banned them entirely. When permitted, they are classified as deadly force.',
    legalImplication: 'Use of prohibited neck restraints may result in criminal charges regardless of the outcome.',
    category: 'use_of_force',
    keywords: ['chokehold', 'carotid restraint', 'neck restraint', 'deadly force', 'prohibited'],
  },
  {
    source: 'POST LD-20',
    chapter: 'Special Situations',
    topic: 'Less-Lethal Weapons',
    rule: 'Less-lethal weapons such as tasers, bean bag rounds, and pepper spray must be used in accordance with training and policy, and only when lower levels of force have been ineffective or are not feasible.',
    explanation: 'Less-lethal weapons can still cause serious injury or death. Their use must be justified by the circumstances and proportional to the threat.',
    legalImplication: 'Improper use of less-lethal weapons may constitute excessive force.',
    category: 'use_of_force',
    keywords: ['less-lethal', 'taser', 'pepper spray', 'bean bag', 'proportional', 'training'],
  },
];

export const LD20_RULE_COUNT = LD20_DOCTRINE_RULES.length;
