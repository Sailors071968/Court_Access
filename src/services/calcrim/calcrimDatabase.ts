// ============================================================================
// CALCRIM Jury Instruction Database
// Contains the elements of common California criminal charges per CALCRIM.
// Each instruction maps a Penal Code section to its required elements that
// the prosecution must prove beyond a reasonable doubt.
// ============================================================================

export interface CalcrimElement {
  number: number;
  text: string;
  /** Keywords that evidence might address or refute */
  keywords: string[];
}

export interface CalcrimInstruction {
  calcrimNumber: string;
  title: string;
  penalCode: string;
  category: string;
  elements: CalcrimElement[];
  /** Common defense strategies for this charge */
  commonDefenses: string[];
  /** Potential legal instruments (motions, etc.) */
  legalInstruments: string[];
}

// ---------------------------------------------------------------------------
// CALCRIM Instructions Database
// ---------------------------------------------------------------------------

export const CALCRIM_DATABASE: CalcrimInstruction[] = [
  // --- Drug Offenses ---
  {
    calcrimNumber: 'CALCRIM 2300',
    title: 'Possession of a Controlled Substance',
    penalCode: 'HS 11350',
    category: 'drug_offense',
    elements: [
      { number: 1, text: 'The defendant possessed a controlled substance', keywords: ['possess', 'controlled substance', 'drug', 'narcotic', 'found', 'recovered'] },
      { number: 2, text: 'The defendant knew of the substance\'s presence', keywords: ['knowledge', 'aware', 'knew', 'conscious', 'presence'] },
      { number: 3, text: 'The defendant knew of the substance\'s nature or character as a controlled substance', keywords: ['knew', 'nature', 'character', 'controlled', 'illegal'] },
      { number: 4, text: 'The substance was in a usable amount', keywords: ['usable', 'amount', 'quantity', 'weight', 'measurable'] },
    ],
    commonDefenses: [
      'Lack of knowledge of presence (substance belonged to another person)',
      'Lack of knowledge of nature (defendant did not know substance was illegal)',
      'Not a usable amount (trace/residue only)',
      'Illegal search and seizure (4th Amendment violation)',
      'Temporary or momentary possession',
      'Valid prescription defense',
    ],
    legalInstruments: [
      'Motion to Suppress Evidence (PC 1538.5) — Challenge legality of search',
      'Motion for Lab Analysis Discovery — Verify substance identity and weight',
      'Pitchess Motion — Officer credibility if possession was planted',
      'Prop 36 / Drug Court Diversion — Alternative sentencing',
    ],
  },
  {
    calcrimNumber: 'CALCRIM 2302',
    title: 'Possession of a Controlled Substance for Sale',
    penalCode: 'HS 11351',
    category: 'drug_offense',
    elements: [
      { number: 1, text: 'The defendant possessed a controlled substance', keywords: ['possess', 'controlled substance', 'drug'] },
      { number: 2, text: 'The defendant knew of the substance\'s presence', keywords: ['knowledge', 'aware', 'knew', 'presence'] },
      { number: 3, text: 'The defendant knew of the substance\'s nature or character as a controlled substance', keywords: ['knew', 'nature', 'character', 'controlled'] },
      { number: 4, text: 'When the defendant possessed the substance, he/she intended to sell it', keywords: ['intent', 'sell', 'sale', 'distribute', 'packaging', 'scale', 'baggies', 'large quantity'] },
      { number: 5, text: 'The substance was in a usable amount', keywords: ['usable', 'amount', 'quantity', 'weight'] },
    ],
    commonDefenses: [
      'Possession for personal use, not sale (challenge intent element)',
      'Illegal search and seizure',
      'No indicia of sales (no scales, baggies, pay-owe sheets, large cash)',
      'Quantity consistent with personal use',
      'Lack of knowledge',
    ],
    legalInstruments: [
      'Motion to Suppress Evidence (PC 1538.5)',
      'Expert witness on drug use patterns vs. sales indicators',
      'Motion to Exclude Expert Testimony on intent to sell',
      'Challenge lab results — chain of custody, weight, substance ID',
    ],
  },
  // --- DUI Offenses ---
  {
    calcrimNumber: 'CALCRIM 2110',
    title: 'Driving Under the Influence',
    penalCode: 'VC 23152(a)',
    category: 'dui',
    elements: [
      { number: 1, text: 'The defendant drove a vehicle', keywords: ['drove', 'driving', 'vehicle', 'car', 'operate', 'behind the wheel'] },
      { number: 2, text: 'When the defendant drove, he/she was under the influence of an alcoholic beverage or drug', keywords: ['under the influence', 'intoxicated', 'impaired', 'alcohol', 'BAC', 'blood alcohol', 'drug'] },
    ],
    commonDefenses: [
      'Rising blood alcohol defense (BAC was below .08 while driving)',
      'Not actually driving or in control of the vehicle',
      'Mouth alcohol contamination of breath test',
      'Medical condition mimicking impairment (diabetes, GERD, fatigue)',
      'Improper field sobriety test administration',
      'Title 17 violations in blood/breath testing',
    ],
    legalInstruments: [
      'Motion to Suppress — Challenge traffic stop legality',
      'Motion to Exclude BAC Results — Title 17 compliance',
      'Subpoena maintenance records for breath testing device',
      'Expert witness on blood alcohol pharmacology',
      'Motion for Independent Blood Split Sample Testing',
    ],
  },
  {
    calcrimNumber: 'CALCRIM 2111',
    title: 'Driving with Blood Alcohol of 0.08 Percent or More',
    penalCode: 'VC 23152(b)',
    category: 'dui',
    elements: [
      { number: 1, text: 'The defendant drove a vehicle', keywords: ['drove', 'driving', 'vehicle', 'car', 'operate'] },
      { number: 2, text: 'When the defendant drove, his/her blood alcohol level was 0.08 percent or more by weight', keywords: ['BAC', 'blood alcohol', '0.08', '.08', 'percent', 'breathalyzer', 'blood test'] },
    ],
    commonDefenses: [
      'Rising blood alcohol — BAC at time of test was higher than while driving',
      'Breath test inaccuracy (mouth alcohol, GERD, residual mouth alcohol)',
      'Blood test contamination or fermentation',
      'Title 17 violations in testing protocol',
      'Not driving at the time',
    ],
    legalInstruments: [
      'Motion to Suppress — Challenge traffic stop',
      'Motion to Exclude BAC Results — Title 17 violations',
      'Expert witness on retrograde extrapolation',
      'Discovery of calibration and maintenance logs',
    ],
  },
  // --- Assault / Battery ---
  {
    calcrimNumber: 'CALCRIM 875',
    title: 'Assault with a Deadly Weapon',
    penalCode: 'PC 245(a)(1)',
    category: 'assault',
    elements: [
      { number: 1, text: 'The defendant did an act with a deadly weapon that by its nature would directly and probably result in the application of force to a person', keywords: ['act', 'weapon', 'deadly', 'force', 'assault', 'strike', 'swing', 'point'] },
      { number: 2, text: 'The defendant did that act willfully', keywords: ['willful', 'intentional', 'purpose', 'deliberate'] },
      { number: 3, text: 'When the defendant acted, he/she was aware of facts that would lead a reasonable person to realize the act would directly and probably result in force', keywords: ['aware', 'reasonable person', 'probable', 'result', 'force'] },
      { number: 4, text: 'When the defendant acted, he/she had the present ability to apply force with a deadly weapon', keywords: ['present ability', 'capable', 'proximity', 'reach', 'weapon'] },
    ],
    commonDefenses: [
      'Self-defense / defense of others',
      'Object was not a deadly weapon as used',
      'No present ability to apply force',
      'Accident — lack of willfulness',
      'Misidentification of defendant',
    ],
    legalInstruments: [
      'Motion for Self-Defense Jury Instruction (CALCRIM 3470)',
      'Motion to Reduce to Simple Assault (misdemeanor)',
      'Motion to Exclude Witness Identification — unreliable procedure',
      'Subpoena surveillance footage / BWC footage',
    ],
  },
  {
    calcrimNumber: 'CALCRIM 925',
    title: 'Battery Causing Serious Bodily Injury',
    penalCode: 'PC 243(d)',
    category: 'assault',
    elements: [
      { number: 1, text: 'The defendant willfully and unlawfully touched another person in a harmful or offensive manner', keywords: ['touch', 'contact', 'strike', 'hit', 'willful', 'unlawful', 'harmful', 'offensive'] },
      { number: 2, text: 'The touching resulted in serious bodily injury to the other person', keywords: ['serious bodily injury', 'injury', 'broken', 'fracture', 'wound', 'hospital', 'concussion'] },
    ],
    commonDefenses: [
      'Self-defense',
      'Injury was not "serious bodily injury" as legally defined',
      'Consent (e.g., mutual combat)',
      'Accidental contact — no willfulness',
      'Misidentification',
    ],
    legalInstruments: [
      'Motion for Self-Defense Instruction',
      'Motion to Reduce to Simple Battery (PC 242)',
      'Medical expert on nature and severity of injuries',
      'Discovery of victim medical records',
    ],
  },
  // --- Theft Offenses ---
  {
    calcrimNumber: 'CALCRIM 1800',
    title: 'Theft by Larceny',
    penalCode: 'PC 484/488',
    category: 'theft',
    elements: [
      { number: 1, text: 'The defendant took possession of property owned by someone else', keywords: ['took', 'possession', 'property', 'owned', 'stolen', 'removed'] },
      { number: 2, text: 'The defendant took the property without the owner\'s consent', keywords: ['without consent', 'unauthorized', 'without permission'] },
      { number: 3, text: 'When the defendant took the property, he/she intended to deprive the owner of it permanently', keywords: ['intended', 'deprive', 'permanently', 'keep', 'not return'] },
      { number: 4, text: 'The defendant moved the property, even a small distance, and kept it for any period of time, however brief', keywords: ['moved', 'carried', 'transported', 'asportation'] },
    ],
    commonDefenses: [
      'Claim of right — believed property was theirs',
      'Consent of owner',
      'No intent to permanently deprive (intended to borrow/return)',
      'Mistaken identity',
      'Value below threshold for charged offense level',
    ],
    legalInstruments: [
      'Motion to Reduce Grand Theft to Petty Theft (Prop 47)',
      'Motion to Suppress — Illegal detention/search',
      'Subpoena store surveillance footage',
      'Discovery of loss prevention records',
    ],
  },
  {
    calcrimNumber: 'CALCRIM 1700',
    title: 'Burglary',
    penalCode: 'PC 459',
    category: 'theft',
    elements: [
      { number: 1, text: 'The defendant entered a building or room', keywords: ['entered', 'building', 'room', 'structure', 'dwelling', 'house', 'store'] },
      { number: 2, text: 'When the defendant entered, he/she intended to commit theft or a felony', keywords: ['intended', 'commit', 'theft', 'felony', 'steal', 'purpose'] },
    ],
    commonDefenses: [
      'No intent to commit theft/felony at time of entry',
      'Consent to enter',
      'Mistaken identity',
      'Structure does not qualify as a "building" under PC 459',
    ],
    legalInstruments: [
      'Motion to Reduce to Second Degree Burglary (commercial vs. residential)',
      'Prop 47 Reduction for shoplifting (PC 459.5)',
      'Motion to Suppress — Evidence obtained through illegal search',
      'Alibi evidence / surveillance footage review',
    ],
  },
  // --- Resisting / Obstruction ---
  {
    calcrimNumber: 'CALCRIM 2656',
    title: 'Resisting, Obstructing, or Delaying a Peace Officer',
    penalCode: 'PC 148(a)(1)',
    category: 'obstruction',
    elements: [
      { number: 1, text: 'The person who was resisted/obstructed/delayed was a peace officer lawfully performing their duties', keywords: ['peace officer', 'lawful', 'duties', 'performing', 'police', 'officer', 'deputy'] },
      { number: 2, text: 'The defendant willfully resisted, obstructed, or delayed the officer', keywords: ['willful', 'resist', 'obstruct', 'delay', 'interfere', 'refuse', 'flee', 'pull away'] },
      { number: 3, text: 'The defendant knew or reasonably should have known the person was a peace officer performing their duties', keywords: ['knew', 'reasonably', 'peace officer', 'uniform', 'badge', 'identified'] },
    ],
    commonDefenses: [
      'Officer was NOT lawfully performing duties (unlawful detention/arrest)',
      'Defendant did not willfully resist (involuntary reaction, fear)',
      'Did not know person was an officer',
      'Exercising constitutional rights (filming, verbal protest)',
      'Excessive force by officer negates lawful performance',
    ],
    legalInstruments: [
      'Motion to Dismiss — Officer not performing lawful duties',
      'Pitchess Motion — Officer disciplinary records',
      'Subpoena body-worn camera footage',
      'Motion to Suppress — Fruit of unlawful arrest',
      'Expert testimony on police use-of-force standards',
    ],
  },
  // --- Domestic Violence ---
  {
    calcrimNumber: 'CALCRIM 840',
    title: 'Inflicting Corporal Injury on Spouse/Cohabitant',
    penalCode: 'PC 273.5',
    category: 'domestic_violence',
    elements: [
      { number: 1, text: 'The defendant willfully inflicted a physical injury on his/her spouse, cohabitant, or partner', keywords: ['willful', 'inflict', 'injury', 'physical', 'spouse', 'cohabitant', 'partner', 'domestic'] },
      { number: 2, text: 'The injury inflicted resulted in a traumatic condition', keywords: ['traumatic condition', 'wound', 'injury', 'bruise', 'mark', 'physical evidence'] },
      { number: 3, text: 'The defendant did not act in self-defense', keywords: ['self-defense', 'defend', 'protect', 'threat', 'aggressor'] },
    ],
    commonDefenses: [
      'Self-defense — victim was the initial aggressor',
      'Injuries were accidental, not willful',
      'Injuries are not a "traumatic condition" as legally defined',
      'False accusation (motivated by custody dispute, anger, etc.)',
      'Misidentification of the aggressor (mutual combat)',
    ],
    legalInstruments: [
      'Motion for Self-Defense Jury Instruction',
      'Subpoena 911 call recordings and dispatch logs',
      'Expert testimony on domestic violence dynamics',
      'Discovery of prior false allegations by complainant',
      'Motion to Exclude Hearsay Statements (Crawford v. Washington)',
    ],
  },
  // --- Weapons Offenses ---
  {
    calcrimNumber: 'CALCRIM 2500',
    title: 'Possession of a Firearm by a Prohibited Person',
    penalCode: 'PC 29800',
    category: 'weapons',
    elements: [
      { number: 1, text: 'The defendant possessed a firearm', keywords: ['possess', 'firearm', 'gun', 'weapon', 'pistol', 'rifle', 'shotgun'] },
      { number: 2, text: 'The defendant knew that he/she possessed the firearm', keywords: ['knew', 'knowledge', 'aware', 'possess'] },
      { number: 3, text: 'The defendant had previously been convicted of a felony', keywords: ['convicted', 'felony', 'prior', 'record', 'prohibited person'] },
    ],
    commonDefenses: [
      'Firearm belonged to another person',
      'Lack of knowledge that firearm was present',
      'Momentary/transitory possession (e.g., disarming someone)',
      'Challenge the underlying felony conviction',
      'Illegal search and seizure',
    ],
    legalInstruments: [
      'Motion to Suppress Evidence (PC 1538.5)',
      'Motion to Bifurcate Prior Conviction from Trial',
      'Challenge certified copy of prior conviction',
      'Prop 63 / PC 1170.1 sentencing considerations',
    ],
  },
  // --- Vehicle Offenses ---
  {
    calcrimNumber: 'CALCRIM 2100',
    title: 'Evading a Peace Officer',
    penalCode: 'VC 2800.2',
    category: 'vehicle',
    elements: [
      { number: 1, text: 'A peace officer driving a motor vehicle was pursuing the defendant', keywords: ['peace officer', 'pursuing', 'chase', 'patrol', 'lights', 'siren'] },
      { number: 2, text: 'The defendant, who was also driving a motor vehicle, willfully fled from or tried to elude the officer', keywords: ['willful', 'fled', 'elude', 'escape', 'speed', 'ran'] },
      { number: 3, text: 'The defendant intended to evade the officer', keywords: ['intended', 'evade', 'escape', 'avoid', 'elude'] },
      { number: 4, text: 'While so driving, the defendant drove with willful or wanton disregard for the safety of persons or property', keywords: ['wanton disregard', 'reckless', 'safety', 'dangerous', 'speed', 'ran red light', 'wrong way'] },
    ],
    commonDefenses: [
      'Did not see or hear police lights/siren',
      'Was looking for a safe place to pull over',
      'Driving was not reckless (reduce to misdemeanor evasion)',
      'Officer was not in a marked vehicle or identifiable as law enforcement',
      'Mistaken identity — wrong vehicle',
    ],
    legalInstruments: [
      'Motion to Reduce to Misdemeanor Evasion (VC 2800.1)',
      'Subpoena dashcam and helicopter footage',
      'GPS/speed data analysis',
      'Expert on vehicle identification / pursuit conditions',
    ],
  },
  // --- Fraud ---
  {
    calcrimNumber: 'CALCRIM 1900',
    title: 'Identity Theft',
    penalCode: 'PC 530.5',
    category: 'fraud',
    elements: [
      { number: 1, text: 'The defendant willfully obtained personal identifying information of another person', keywords: ['obtain', 'personal identifying information', 'identity', 'name', 'SSN', 'credit card', 'account'] },
      { number: 2, text: 'The defendant used that information for an unlawful purpose', keywords: ['used', 'unlawful purpose', 'fraud', 'purchase', 'open account', 'impersonate'] },
      { number: 3, text: 'The defendant did so without the consent of the person whose information was used', keywords: ['without consent', 'unauthorized', 'without permission'] },
    ],
    commonDefenses: [
      'Had consent/authorization to use the information',
      'Did not use it for an unlawful purpose',
      'Mistaken identity — someone else used the information',
      'Lack of knowledge that information belonged to another',
    ],
    legalInstruments: [
      'Discovery of digital forensics / IP address records',
      'Motion to Suppress — How was evidence obtained?',
      'Expert testimony on cybersecurity / digital identity',
      'Challenge victim identification of defendant',
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup Helpers
// ---------------------------------------------------------------------------

/**
 * Find a CALCRIM instruction by its number (e.g., "CALCRIM 2300").
 */
export function findByCalcrimNumber(calcrimNumber: string): CalcrimInstruction | null {
  return CALCRIM_DATABASE.find((i) => i.calcrimNumber === calcrimNumber) ?? null;
}

/**
 * Find CALCRIM instruction(s) by penal code (e.g., "HS 11350").
 */
export function findByPenalCode(penalCode: string): CalcrimInstruction[] {
  const normalized = penalCode.toUpperCase().replace(/\s+/g, ' ').trim();
  return CALCRIM_DATABASE.filter((i) => i.penalCode.toUpperCase() === normalized);
}

/**
 * Find CALCRIM instructions by category.
 */
export function findByCategory(category: string): CalcrimInstruction[] {
  return CALCRIM_DATABASE.filter((i) => i.category === category);
}

/**
 * Search CALCRIM instructions by keyword in title or penal code.
 */
export function searchCalcrim(query: string): CalcrimInstruction[] {
  const q = query.toLowerCase();
  return CALCRIM_DATABASE.filter(
    (i) =>
      i.title.toLowerCase().includes(q) ||
      i.penalCode.toLowerCase().includes(q) ||
      i.calcrimNumber.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
  );
}

/**
 * Get all available CALCRIM categories.
 */
export function getCategories(): string[] {
  const cats = new Set(CALCRIM_DATABASE.map((i) => i.category));
  return [...cats].sort();
}
