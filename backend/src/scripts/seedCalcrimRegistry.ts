// ============================================================================
// Phase C.1 — CALCRIM Registry Seed
// Seeds canonical California criminal charges + CALCRIM instructions + elements
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ElementSeed {
  elementNumber: number;
  label: string;
  description: string;
  prosecutionBurden: string;
  isEssential: boolean;
  weight: number;
  aliases: string[];
  keywords: { keyword: string; category: string; weight: number }[];
}

interface InstructionSeed {
  instructionNumber: number;
  title: string;
  crimeCategory: string;
  description: string;
  penalCode: string;
  intentType: string;
  elements: ElementSeed[];
}

const CALCRIM_INSTRUCTIONS: InstructionSeed[] = [
  // ============================
  // CRIMES AGAINST PROPERTY
  // ============================
  {
    instructionNumber: 1700,
    title: 'Burglary (Pen. Code, § 459)',
    crimeCategory: 'crimes_against_property',
    description: 'Every person who enters any house, room, apartment, tenement, shop, warehouse, store, mill, barn, stable, outhouse or other building with intent to commit grand or petit larceny or any felony is guilty of burglary.',
    penalCode: 'PC 459',
    intentType: 'specific',
    elements: [
      {
        elementNumber: 1,
        label: 'Entry into a structure',
        description: 'The defendant entered a building or structure.',
        prosecutionBurden: 'Must prove defendant entered a building, room, or locked vehicle.',
        isEssential: true,
        weight: 0.4,
        aliases: ['broke into', 'gained entry', 'trespassed into', 'went inside', 'entered the building'],
        keywords: [
          { keyword: 'enter', category: 'action', weight: 1.0 },
          { keyword: 'entered', category: 'action', weight: 1.0 },
          { keyword: 'broke in', category: 'action', weight: 0.9 },
          { keyword: 'forced entry', category: 'action', weight: 0.9 },
          { keyword: 'building', category: 'target', weight: 0.8 },
          { keyword: 'residence', category: 'target', weight: 0.9 },
          { keyword: 'structure', category: 'target', weight: 0.8 },
          { keyword: 'house', category: 'target', weight: 0.9 },
          { keyword: 'apartment', category: 'target', weight: 0.9 },
          { keyword: 'store', category: 'target', weight: 0.7 },
        ],
      },
      {
        elementNumber: 2,
        label: 'Intent to commit theft or felony at entry',
        description: 'When entering, the defendant intended to commit theft or a felony.',
        prosecutionBurden: 'Must prove intent existed at the time of entry, not formed after.',
        isEssential: true,
        weight: 0.6,
        aliases: ['planned to steal', 'intended to commit theft', 'entered with criminal purpose'],
        keywords: [
          { keyword: 'steal', category: 'action', weight: 1.0 },
          { keyword: 'theft', category: 'action', weight: 1.0 },
          { keyword: 'intended', category: 'state', weight: 0.9 },
          { keyword: 'planned', category: 'state', weight: 0.8 },
          { keyword: 'felony', category: 'qualifier', weight: 0.7 },
        ],
      },
    ],
  },
  {
    instructionNumber: 1800,
    title: 'Theft (Pen. Code, §§ 484–488)',
    crimeCategory: 'crimes_against_property',
    description: 'Every person who shall feloniously steal, take, carry, lead, or drive away the personal property of another is guilty of theft.',
    penalCode: 'PC 484',
    intentType: 'specific',
    elements: [
      {
        elementNumber: 1,
        label: 'Taking of property',
        description: 'The defendant took possession of property owned by someone else.',
        prosecutionBurden: 'Must prove actual taking or carrying away of property.',
        isEssential: true,
        weight: 0.4,
        aliases: ['stole', 'removed property', 'took items', 'shoplifted'],
        keywords: [
          { keyword: 'took', category: 'action', weight: 1.0 },
          { keyword: 'stole', category: 'action', weight: 1.0 },
          { keyword: 'removed', category: 'action', weight: 0.8 },
          { keyword: 'shoplifted', category: 'action', weight: 0.9 },
          { keyword: 'property', category: 'target', weight: 0.8 },
          { keyword: 'items', category: 'target', weight: 0.7 },
          { keyword: 'merchandise', category: 'target', weight: 0.8 },
        ],
      },
      {
        elementNumber: 2,
        label: 'Property belonged to another',
        description: 'The property taken belonged to another person.',
        prosecutionBurden: 'Must prove ownership or right to possession by another person.',
        isEssential: true,
        weight: 0.2,
        aliases: ['owned by victim', 'belonged to someone else', 'not defendants property'],
        keywords: [
          { keyword: 'belonged', category: 'state', weight: 0.9 },
          { keyword: 'owned', category: 'state', weight: 0.9 },
          { keyword: 'victim', category: 'target', weight: 0.7 },
        ],
      },
      {
        elementNumber: 3,
        label: 'Intent to permanently deprive',
        description: 'The defendant intended to permanently deprive the owner of the property.',
        prosecutionBurden: 'Must prove intent to keep the property permanently, not temporarily.',
        isEssential: true,
        weight: 0.4,
        aliases: ['intended to keep', 'no intention to return', 'permanent deprivation'],
        keywords: [
          { keyword: 'keep', category: 'action', weight: 0.9 },
          { keyword: 'permanently', category: 'qualifier', weight: 1.0 },
          { keyword: 'deprive', category: 'action', weight: 0.9 },
          { keyword: 'not return', category: 'action', weight: 0.8 },
        ],
      },
    ],
  },

  // ============================
  // CRIMES AGAINST PERSONS
  // ============================
  {
    instructionNumber: 1600,
    title: 'Robbery (Pen. Code, § 211)',
    crimeCategory: 'crimes_against_person',
    description: 'Robbery is the felonious taking of personal property in the possession of another, from his person or immediate presence, and against his will, accomplished by means of force or fear.',
    penalCode: 'PC 211',
    intentType: 'specific',
    elements: [
      {
        elementNumber: 1,
        label: 'Taking of property from person',
        description: 'The defendant took property that was not the defendants own.',
        prosecutionBurden: 'Must prove defendant took property not belonging to them.',
        isEssential: true,
        weight: 0.25,
        aliases: ['grabbed from victim', 'snatched', 'forcibly took'],
        keywords: [
          { keyword: 'took', category: 'action', weight: 1.0 },
          { keyword: 'grabbed', category: 'action', weight: 0.9 },
          { keyword: 'snatched', category: 'action', weight: 0.9 },
        ],
      },
      {
        elementNumber: 2,
        label: 'From person or immediate presence',
        description: 'The property was taken from another person or their immediate presence.',
        prosecutionBurden: 'Must prove property was in the victims possession or immediate presence.',
        isEssential: true,
        weight: 0.25,
        aliases: ['from the victim', 'in their presence', 'on their person'],
        keywords: [
          { keyword: 'person', category: 'target', weight: 0.8 },
          { keyword: 'presence', category: 'target', weight: 0.8 },
          { keyword: 'victim', category: 'target', weight: 0.9 },
          { keyword: 'possession', category: 'state', weight: 0.8 },
        ],
      },
      {
        elementNumber: 3,
        label: 'Against the persons will',
        description: 'The taking was against the other persons will.',
        prosecutionBurden: 'Must prove the owner did not consent to the taking.',
        isEssential: true,
        weight: 0.1,
        aliases: ['without consent', 'involuntary', 'forced'],
        keywords: [
          { keyword: 'against will', category: 'state', weight: 1.0 },
          { keyword: 'without consent', category: 'state', weight: 1.0 },
          { keyword: 'forced', category: 'state', weight: 0.8 },
        ],
      },
      {
        elementNumber: 4,
        label: 'Use of force or fear',
        description: 'The defendant used force or fear to take the property or prevent resistance.',
        prosecutionBurden: 'Must prove force or fear was used to accomplish the taking.',
        isEssential: true,
        weight: 0.25,
        aliases: ['threatened', 'used violence', 'intimidated', 'brandished weapon'],
        keywords: [
          { keyword: 'force', category: 'action', weight: 1.0 },
          { keyword: 'fear', category: 'state', weight: 1.0 },
          { keyword: 'threat', category: 'action', weight: 0.9 },
          { keyword: 'weapon', category: 'target', weight: 0.9 },
          { keyword: 'intimidate', category: 'action', weight: 0.8 },
          { keyword: 'violence', category: 'action', weight: 0.9 },
        ],
      },
      {
        elementNumber: 5,
        label: 'Intent to permanently deprive',
        description: 'The defendant intended to permanently deprive the owner of the property.',
        prosecutionBurden: 'Must prove intent to permanently deprive at time of taking.',
        isEssential: true,
        weight: 0.15,
        aliases: ['intended to keep', 'permanent deprivation'],
        keywords: [
          { keyword: 'permanently', category: 'qualifier', weight: 1.0 },
          { keyword: 'deprive', category: 'action', weight: 0.9 },
          { keyword: 'keep', category: 'action', weight: 0.8 },
        ],
      },
    ],
  },
  {
    instructionNumber: 875,
    title: 'Assault (Pen. Code, § 240)',
    crimeCategory: 'crimes_against_person',
    description: 'An assault is an unlawful attempt, coupled with a present ability, to commit a violent injury on the person of another.',
    penalCode: 'PC 240',
    intentType: 'general',
    elements: [
      {
        elementNumber: 1,
        label: 'Willful act likely to result in force',
        description: 'The defendant did an act that by its nature would directly and probably result in the application of force to a person.',
        prosecutionBurden: 'Must prove defendant performed an act that would naturally result in force being applied.',
        isEssential: true,
        weight: 0.5,
        aliases: ['swung at', 'attempted to hit', 'lunged at', 'attacked'],
        keywords: [
          { keyword: 'hit', category: 'action', weight: 1.0 },
          { keyword: 'struck', category: 'action', weight: 1.0 },
          { keyword: 'punch', category: 'action', weight: 1.0 },
          { keyword: 'swing', category: 'action', weight: 0.9 },
          { keyword: 'kick', category: 'action', weight: 0.9 },
          { keyword: 'shove', category: 'action', weight: 0.8 },
          { keyword: 'attack', category: 'action', weight: 0.9 },
        ],
      },
      {
        elementNumber: 2,
        label: 'Willfulness',
        description: 'The defendant did that act willfully.',
        prosecutionBurden: 'Must prove the act was done on purpose, not accidentally.',
        isEssential: true,
        weight: 0.3,
        aliases: ['intentionally', 'deliberately', 'on purpose'],
        keywords: [
          { keyword: 'willful', category: 'state', weight: 1.0 },
          { keyword: 'intentional', category: 'state', weight: 1.0 },
          { keyword: 'deliberate', category: 'state', weight: 0.9 },
          { keyword: 'purposely', category: 'state', weight: 0.8 },
        ],
      },
      {
        elementNumber: 3,
        label: 'Awareness of facts',
        description: 'When the defendant acted, they were aware of facts that would lead a reasonable person to realize the act would directly and probably result in the application of force.',
        prosecutionBurden: 'Must prove defendant knew or should have known the act would result in force.',
        isEssential: true,
        weight: 0.2,
        aliases: ['knew what they were doing', 'aware of consequences'],
        keywords: [
          { keyword: 'aware', category: 'state', weight: 0.8 },
          { keyword: 'knew', category: 'state', weight: 0.8 },
          { keyword: 'reasonable person', category: 'qualifier', weight: 0.7 },
        ],
      },
    ],
  },
  {
    instructionNumber: 860,
    title: 'Battery (Pen. Code, § 242)',
    crimeCategory: 'crimes_against_person',
    description: 'A battery is any willful and unlawful use of force or violence upon the person of another.',
    penalCode: 'PC 242',
    intentType: 'general',
    elements: [
      {
        elementNumber: 1,
        label: 'Willful and unlawful touching',
        description: 'The defendant willfully and unlawfully touched another person in a harmful or offensive manner.',
        prosecutionBurden: 'Must prove defendant touched another in a harmful or offensive way.',
        isEssential: true,
        weight: 0.6,
        aliases: ['hit', 'struck', 'made contact', 'used force on'],
        keywords: [
          { keyword: 'hit', category: 'action', weight: 1.0 },
          { keyword: 'struck', category: 'action', weight: 1.0 },
          { keyword: 'touched', category: 'action', weight: 0.7 },
          { keyword: 'punched', category: 'action', weight: 1.0 },
          { keyword: 'slapped', category: 'action', weight: 0.9 },
          { keyword: 'kicked', category: 'action', weight: 1.0 },
          { keyword: 'pushed', category: 'action', weight: 0.8 },
        ],
      },
      {
        elementNumber: 2,
        label: 'Not in self-defense',
        description: 'The defendant did not act in self-defense or defense of someone else.',
        prosecutionBurden: 'Must disprove self-defense if raised.',
        isEssential: true,
        weight: 0.4,
        aliases: ['unprovoked', 'aggressor', 'not defending'],
        keywords: [
          { keyword: 'unprovoked', category: 'state', weight: 0.9 },
          { keyword: 'aggressor', category: 'state', weight: 0.8 },
          { keyword: 'self-defense', category: 'qualifier', weight: 1.0 },
        ],
      },
    ],
  },

  // ============================
  // VEHICLE CODE
  // ============================
  {
    instructionNumber: 2110,
    title: 'DUI (Veh. Code, § 23152(a))',
    crimeCategory: 'vehicle_offenses',
    description: 'It is unlawful for a person who is under the influence of any alcoholic beverage to drive a vehicle.',
    penalCode: 'VC 23152',
    intentType: 'general',
    elements: [
      {
        elementNumber: 1,
        label: 'Driving a vehicle',
        description: 'The defendant drove a vehicle.',
        prosecutionBurden: 'Must prove defendant was driving or in actual physical control of a vehicle.',
        isEssential: true,
        weight: 0.5,
        aliases: ['operated a vehicle', 'was behind the wheel', 'was driving'],
        keywords: [
          { keyword: 'drove', category: 'action', weight: 1.0 },
          { keyword: 'driving', category: 'action', weight: 1.0 },
          { keyword: 'vehicle', category: 'target', weight: 0.9 },
          { keyword: 'car', category: 'target', weight: 0.8 },
          { keyword: 'behind the wheel', category: 'action', weight: 0.9 },
        ],
      },
      {
        elementNumber: 2,
        label: 'Under the influence',
        description: 'When the defendant drove, they were under the influence of an alcoholic beverage or drug.',
        prosecutionBurden: 'Must prove mental or physical faculties were impaired to an appreciable degree.',
        isEssential: true,
        weight: 0.5,
        aliases: ['intoxicated', 'drunk', 'impaired', 'under the influence'],
        keywords: [
          { keyword: 'intoxicated', category: 'state', weight: 1.0 },
          { keyword: 'drunk', category: 'state', weight: 1.0 },
          { keyword: 'impaired', category: 'state', weight: 0.9 },
          { keyword: 'bac', category: 'state', weight: 0.9 },
          { keyword: 'blood alcohol', category: 'state', weight: 0.9 },
          { keyword: 'under the influence', category: 'state', weight: 1.0 },
        ],
      },
    ],
  },

  // ============================
  // HEALTH & SAFETY CODE
  // ============================
  {
    instructionNumber: 2300,
    title: 'Possession of Controlled Substance (Health & Saf. Code, § 11350)',
    crimeCategory: 'drug_offenses',
    description: 'Every person who possesses a controlled substance shall be punished.',
    penalCode: 'HSC 11350',
    intentType: 'general',
    elements: [
      {
        elementNumber: 1,
        label: 'Possession of controlled substance',
        description: 'The defendant possessed a controlled substance.',
        prosecutionBurden: 'Must prove defendant had actual or constructive possession.',
        isEssential: true,
        weight: 0.4,
        aliases: ['had drugs', 'found with drugs', 'carrying narcotics', 'drugs on person'],
        keywords: [
          { keyword: 'possessed', category: 'action', weight: 1.0 },
          { keyword: 'found', category: 'action', weight: 0.7 },
          { keyword: 'drugs', category: 'target', weight: 1.0 },
          { keyword: 'cocaine', category: 'target', weight: 1.0 },
          { keyword: 'heroin', category: 'target', weight: 1.0 },
          { keyword: 'methamphetamine', category: 'target', weight: 1.0 },
          { keyword: 'controlled substance', category: 'target', weight: 1.0 },
          { keyword: 'narcotics', category: 'target', weight: 0.9 },
          { keyword: 'fentanyl', category: 'target', weight: 1.0 },
        ],
      },
      {
        elementNumber: 2,
        label: 'Knowledge of presence',
        description: 'The defendant knew of the substances presence.',
        prosecutionBurden: 'Must prove defendant was aware the substance was in their possession.',
        isEssential: true,
        weight: 0.3,
        aliases: ['knew about drugs', 'was aware of', 'knowingly possessed'],
        keywords: [
          { keyword: 'knew', category: 'state', weight: 1.0 },
          { keyword: 'aware', category: 'state', weight: 0.9 },
          { keyword: 'knowledge', category: 'state', weight: 0.9 },
          { keyword: 'knowingly', category: 'state', weight: 1.0 },
        ],
      },
      {
        elementNumber: 3,
        label: 'Knowledge of nature as controlled substance',
        description: 'The defendant knew of the substances nature or character as a controlled substance.',
        prosecutionBurden: 'Must prove defendant knew what they possessed was a controlled substance.',
        isEssential: true,
        weight: 0.3,
        aliases: ['knew it was illegal', 'recognized as drugs', 'understood the substance'],
        keywords: [
          { keyword: 'knew what it was', category: 'state', weight: 0.9 },
          { keyword: 'illegal', category: 'qualifier', weight: 0.7 },
          { keyword: 'controlled', category: 'qualifier', weight: 0.8 },
        ],
      },
    ],
  },
  {
    instructionNumber: 925,
    title: 'Murder — First Degree (Pen. Code, § 187)',
    crimeCategory: 'homicide',
    description: 'Murder is the unlawful killing of a human being with malice aforethought.',
    penalCode: 'PC 187',
    intentType: 'specific',
    elements: [
      {
        elementNumber: 1,
        label: 'Killing of a human being',
        description: 'The defendant caused the death of another person.',
        prosecutionBurden: 'Must prove the defendants act caused the death of another human being.',
        isEssential: true,
        weight: 0.3,
        aliases: ['killed', 'caused death', 'fatally wounded', 'shot and killed'],
        keywords: [
          { keyword: 'killed', category: 'action', weight: 1.0 },
          { keyword: 'death', category: 'state', weight: 1.0 },
          { keyword: 'murdered', category: 'action', weight: 1.0 },
          { keyword: 'fatal', category: 'qualifier', weight: 0.9 },
          { keyword: 'shot', category: 'action', weight: 0.8 },
          { keyword: 'stabbed', category: 'action', weight: 0.8 },
        ],
      },
      {
        elementNumber: 2,
        label: 'Unlawfulness',
        description: 'The killing was unlawful (not justified or excused).',
        prosecutionBurden: 'Must prove killing was not in self-defense or otherwise justified.',
        isEssential: true,
        weight: 0.2,
        aliases: ['unjustified killing', 'not self-defense', 'unlawful act'],
        keywords: [
          { keyword: 'unlawful', category: 'qualifier', weight: 1.0 },
          { keyword: 'unjustified', category: 'qualifier', weight: 0.9 },
          { keyword: 'self-defense', category: 'qualifier', weight: 1.0 },
        ],
      },
      {
        elementNumber: 3,
        label: 'Malice aforethought',
        description: 'The defendant acted with malice aforethought — either express (intent to kill) or implied (conscious disregard for human life).',
        prosecutionBurden: 'Must prove either express malice (intent to kill) or implied malice (dangerous act with conscious disregard for life).',
        isEssential: true,
        weight: 0.3,
        aliases: ['premeditated', 'with intent to kill', 'deliberate', 'conscious disregard'],
        keywords: [
          { keyword: 'premeditated', category: 'state', weight: 1.0 },
          { keyword: 'deliberate', category: 'state', weight: 1.0 },
          { keyword: 'intent to kill', category: 'state', weight: 1.0 },
          { keyword: 'malice', category: 'state', weight: 1.0 },
          { keyword: 'conscious disregard', category: 'state', weight: 0.9 },
          { keyword: 'planned', category: 'state', weight: 0.8 },
        ],
      },
      {
        elementNumber: 4,
        label: 'Premeditation and deliberation (first degree)',
        description: 'The defendant premeditated and deliberated the killing.',
        prosecutionBurden: 'Must prove defendant carefully weighed considerations before deciding to kill.',
        isEssential: true,
        weight: 0.2,
        aliases: ['planned the killing', 'thought about it beforehand', 'preconceived design'],
        keywords: [
          { keyword: 'premeditated', category: 'state', weight: 1.0 },
          { keyword: 'deliberated', category: 'state', weight: 1.0 },
          { keyword: 'planned', category: 'state', weight: 0.9 },
          { keyword: 'preconceived', category: 'state', weight: 0.8 },
        ],
      },
    ],
  },
];

async function seedCalcrimRegistry(): Promise<void> {
  console.log('[CALCRIM Seed] Starting CALCRIM registry seeding...');

  let instructionCount = 0;
  let elementCount = 0;
  let aliasCount = 0;
  let keywordCount = 0;

  for (const instr of CALCRIM_INSTRUCTIONS) {
    // Upsert instruction
    const instruction = await prisma.calcrimInstruction.upsert({
      where: { instructionNumber: instr.instructionNumber },
      update: {
        title: instr.title,
        crimeCategory: instr.crimeCategory,
        description: instr.description,
        penalCode: instr.penalCode,
        intentType: instr.intentType,
      },
      create: {
        instructionNumber: instr.instructionNumber,
        title: instr.title,
        crimeCategory: instr.crimeCategory,
        description: instr.description,
        penalCode: instr.penalCode,
        intentType: instr.intentType,
      },
    });
    instructionCount++;

    for (const elem of instr.elements) {
      // Find or create element
      const existing = await prisma.calcrimElement.findUnique({
        where: {
          instructionId_elementNumber: {
            instructionId: instruction.id,
            elementNumber: elem.elementNumber,
          },
        },
      });

      let elementId: string;
      if (existing) {
        await prisma.calcrimElement.update({
          where: { id: existing.id },
          data: {
            label: elem.label,
            description: elem.description,
            prosecutionBurden: elem.prosecutionBurden,
            isEssential: elem.isEssential,
            weight: elem.weight,
          },
        });
        elementId = existing.id;
      } else {
        const created = await prisma.calcrimElement.create({
          data: {
            instructionId: instruction.id,
            elementNumber: elem.elementNumber,
            label: elem.label,
            description: elem.description,
            prosecutionBurden: elem.prosecutionBurden,
            isEssential: elem.isEssential,
            weight: elem.weight,
          },
        });
        elementId = created.id;
      }
      elementCount++;

      // Upsert aliases (delete existing and re-insert for simplicity)
      await prisma.elementAlias.deleteMany({ where: { elementId } });
      for (const alias of elem.aliases) {
        await prisma.elementAlias.create({
          data: { elementId, alias, source: 'manual' },
        });
        aliasCount++;
      }

      // Upsert keywords
      await prisma.elementKeyword.deleteMany({ where: { elementId } });
      for (const kw of elem.keywords) {
        await prisma.elementKeyword.create({
          data: {
            elementId,
            keyword: kw.keyword,
            category: kw.category,
            weight: kw.weight,
          },
        });
        keywordCount++;
      }
    }
  }

  console.log(`[CALCRIM Seed] Complete: ${instructionCount} instructions, ${elementCount} elements, ${aliasCount} aliases, ${keywordCount} keywords`);
}

// Validation report generation
async function generateValidationReport(): Promise<void> {
  const instructions = await prisma.calcrimInstruction.findMany({
    include: {
      elements: {
        include: {
          aliases: true,
          keywords: true,
        },
        orderBy: { elementNumber: 'asc' },
      },
    },
    orderBy: { instructionNumber: 'asc' },
  });

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalInstructions: instructions.length,
      totalElements: instructions.reduce((sum, i) => sum + i.elements.length, 0),
      totalAliases: instructions.reduce(
        (sum, i) => sum + i.elements.reduce((s, e) => s + e.aliases.length, 0),
        0,
      ),
      totalKeywords: instructions.reduce(
        (sum, i) => sum + i.elements.reduce((s, e) => s + e.keywords.length, 0),
        0,
      ),
      categories: [...new Set(instructions.map((i) => i.crimeCategory))],
      intentTypes: [...new Set(instructions.map((i) => i.intentType))],
    },
    instructions: instructions.map((instr) => ({
      instructionNumber: instr.instructionNumber,
      title: instr.title,
      penalCode: instr.penalCode,
      crimeCategory: instr.crimeCategory,
      intentType: instr.intentType,
      elementCount: instr.elements.length,
      elements: instr.elements.map((e) => ({
        number: e.elementNumber,
        label: e.label,
        prosecutionBurden: e.prosecutionBurden,
        isEssential: e.isEssential,
        weight: e.weight,
        aliasCount: e.aliases.length,
        keywordCount: e.keywords.length,
        aliases: e.aliases.map((a) => a.alias),
        keywordsByCategory: e.keywords.reduce(
          (acc, k) => {
            if (!acc[k.category]) acc[k.category] = [];
            acc[k.category].push({ keyword: k.keyword, weight: k.weight });
            return acc;
          },
          {} as Record<string, { keyword: string; weight: number }[]>,
        ),
      })),
      validation: {
        hasAllEssentialElements: instr.elements.every((e) => e.isEssential),
        totalWeight: Math.round(instr.elements.reduce((sum, e) => sum + e.weight, 0) * 100) / 100,
        weightNormalized: Math.abs(instr.elements.reduce((sum, e) => sum + e.weight, 0) - 1.0) < 0.01,
        allElementsHaveKeywords: instr.elements.every((e) => e.keywords.length > 0),
        allElementsHaveAliases: instr.elements.every((e) => e.aliases.length > 0),
      },
    })),
  };

  const fs = await import('fs');
  const path = await import('path');
  const reportDir = path.resolve(process.cwd(), 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'calcrim_registry_validation.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[CALCRIM Seed] Validation report written to ${reportPath}`);
}

async function main(): Promise<void> {
  try {
    await seedCalcrimRegistry();
    await generateValidationReport();
  } catch (err) {
    console.error('[CALCRIM Seed] Error:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main();
