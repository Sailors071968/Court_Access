// ============================================================================
// Phase D.2.5 — California Code Registry
// Authoritative registry of all 29 California Codes with abbreviations,
// common statute sections, and CALCRIM instruction linkage metadata.
// Deterministic. No hallucination. No generative content.
// ============================================================================

// ---------------------------------------------------------------------------
// California Code Definitions
// ---------------------------------------------------------------------------

export interface CaliforniaCode {
  abbreviation: string;
  fullName: string;
  shortName: string;
  category: 'criminal' | 'civil' | 'regulatory' | 'administrative' | 'procedural';
  commonInCriminalDefense: boolean;
  description: string;
}

export const CALIFORNIA_CODES: CaliforniaCode[] = [
  { abbreviation: 'PC', fullName: 'California Penal Code', shortName: 'Penal Code', category: 'criminal', commonInCriminalDefense: true, description: 'Defines crimes, punishments, and criminal procedure in California.' },
  { abbreviation: 'VC', fullName: 'California Vehicle Code', shortName: 'Vehicle Code', category: 'criminal', commonInCriminalDefense: true, description: 'Governs motor vehicle operation, DUI, hit-and-run, and traffic offenses.' },
  { abbreviation: 'HSC', fullName: 'California Health and Safety Code', shortName: 'Health & Safety Code', category: 'criminal', commonInCriminalDefense: true, description: 'Covers controlled substances, drug offenses, and public health crimes.' },
  { abbreviation: 'WIC', fullName: 'California Welfare and Institutions Code', shortName: 'Welfare & Institutions Code', category: 'criminal', commonInCriminalDefense: true, description: 'Juvenile justice, conservatorship, and welfare fraud provisions.' },
  { abbreviation: 'BPC', fullName: 'California Business and Professions Code', shortName: 'Business & Professions Code', category: 'regulatory', commonInCriminalDefense: true, description: 'Professional licensing, unlicensed practice, and business fraud crimes.' },
  { abbreviation: 'FC', fullName: 'California Family Code', shortName: 'Family Code', category: 'civil', commonInCriminalDefense: true, description: 'Domestic violence, protective orders, and family-related criminal provisions.' },
  { abbreviation: 'EC', fullName: 'California Evidence Code', shortName: 'Evidence Code', category: 'procedural', commonInCriminalDefense: true, description: 'Rules of evidence, hearsay, privileges, and admissibility standards.' },
  { abbreviation: 'GOV', fullName: 'California Government Code', shortName: 'Government Code', category: 'administrative', commonInCriminalDefense: false, description: 'Government operations, public records, and official misconduct provisions.' },
  { abbreviation: 'LC', fullName: 'California Labor Code', shortName: 'Labor Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Employment law, workplace safety, and labor-related criminal offenses.' },
  { abbreviation: 'CC', fullName: 'California Civil Code', shortName: 'Civil Code', category: 'civil', commonInCriminalDefense: false, description: 'Property rights, contracts, torts, and civil fraud provisions.' },
  { abbreviation: 'CCP', fullName: 'California Code of Civil Procedure', shortName: 'Code of Civil Procedure', category: 'procedural', commonInCriminalDefense: false, description: 'Civil litigation procedures, statutes of limitations, and court processes.' },
  { abbreviation: 'CORP', fullName: 'California Corporations Code', shortName: 'Corporations Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Corporate governance, securities fraud, and business entity crimes.' },
  { abbreviation: 'EDC', fullName: 'California Education Code', shortName: 'Education Code', category: 'administrative', commonInCriminalDefense: false, description: 'School-related offenses, campus crimes, and education fraud.' },
  { abbreviation: 'ELEC', fullName: 'California Elections Code', shortName: 'Elections Code', category: 'administrative', commonInCriminalDefense: false, description: 'Voter fraud, campaign finance violations, and election crimes.' },
  { abbreviation: 'FIN', fullName: 'California Financial Code', shortName: 'Financial Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Banking fraud, financial institution crimes, and lending violations.' },
  { abbreviation: 'FGC', fullName: 'California Fish and Game Code', shortName: 'Fish & Game Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Wildlife crimes, poaching, and environmental violations.' },
  { abbreviation: 'FAC', fullName: 'California Food and Agricultural Code', shortName: 'Food & Agricultural Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Agricultural crimes, food safety violations, and pesticide offenses.' },
  { abbreviation: 'HNC', fullName: 'California Harbors and Navigation Code', shortName: 'Harbors & Navigation Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Maritime offenses, boating under the influence, and harbor crimes.' },
  { abbreviation: 'IC', fullName: 'California Insurance Code', shortName: 'Insurance Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Insurance fraud, false claims, and insurance-related crimes.' },
  { abbreviation: 'MVC', fullName: 'California Military and Veterans Code', shortName: 'Military & Veterans Code', category: 'administrative', commonInCriminalDefense: false, description: 'Military justice, veterans benefits fraud, and military-related offenses.' },
  { abbreviation: 'PCC', fullName: 'California Public Contract Code', shortName: 'Public Contract Code', category: 'administrative', commonInCriminalDefense: false, description: 'Government contract fraud, bid rigging, and procurement crimes.' },
  { abbreviation: 'PRC', fullName: 'California Public Resources Code', shortName: 'Public Resources Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Environmental crimes, arson on public lands, and resource theft.' },
  { abbreviation: 'PUC', fullName: 'California Public Utilities Code', shortName: 'Public Utilities Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Utility fraud, infrastructure tampering, and utility-related crimes.' },
  { abbreviation: 'RTC', fullName: 'California Revenue and Taxation Code', shortName: 'Revenue & Taxation Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Tax evasion, tax fraud, and revenue-related criminal offenses.' },
  { abbreviation: 'SHC', fullName: 'California Streets and Highways Code', shortName: 'Streets & Highways Code', category: 'administrative', commonInCriminalDefense: false, description: 'Highway-related offenses and transportation infrastructure crimes.' },
  { abbreviation: 'UIC', fullName: 'California Unemployment Insurance Code', shortName: 'Unemployment Insurance Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Unemployment fraud, EDD fraud, and benefit-related crimes.' },
  { abbreviation: 'WC', fullName: 'California Water Code', shortName: 'Water Code', category: 'regulatory', commonInCriminalDefense: false, description: 'Water theft, pollution crimes, and water rights violations.' },
  { abbreviation: 'PROB', fullName: 'California Probate Code', shortName: 'Probate Code', category: 'civil', commonInCriminalDefense: false, description: 'Estate fraud, elder abuse, and probate-related crimes.' },
  { abbreviation: 'CRC', fullName: 'California Rules of Court', shortName: 'Rules of Court', category: 'procedural', commonInCriminalDefense: true, description: 'Court procedures, sentencing rules, and judicial administration.' },
];

// ---------------------------------------------------------------------------
// Common Criminal Statute Registry (deterministic linkage to CALCRIM)
// ---------------------------------------------------------------------------

export interface StatuteEntry {
  code: string;
  section: string;
  title: string;
  calcrimNumbers: number[];
  severity: 'felony' | 'misdemeanor' | 'wobbler' | 'infraction';
  commonEnhancements: string[];
  description: string;
}

export const COMMON_CRIMINAL_STATUTES: StatuteEntry[] = [
  // PENAL CODE — Crimes Against Persons
  { code: 'PC', section: '187(a)', title: 'Murder', calcrimNumbers: [520, 521, 522], severity: 'felony', commonEnhancements: ['PC 12022.53', 'PC 186.22'], description: 'Unlawful killing of a human being with malice aforethought.' },
  { code: 'PC', section: '192(a)', title: 'Voluntary Manslaughter', calcrimNumbers: [570, 571], severity: 'felony', commonEnhancements: ['PC 12022.53'], description: 'Unlawful killing upon a sudden quarrel or heat of passion.' },
  { code: 'PC', section: '192(b)', title: 'Involuntary Manslaughter', calcrimNumbers: [580, 581], severity: 'felony', commonEnhancements: [], description: 'Unlawful killing without malice in the commission of an unlawful act.' },
  { code: 'PC', section: '245(a)(1)', title: 'Assault with a Deadly Weapon', calcrimNumbers: [875], severity: 'wobbler', commonEnhancements: ['PC 12022(b)(1)', 'PC 186.22'], description: 'Assault upon another person with a deadly weapon or instrument.' },
  { code: 'PC', section: '245(a)(4)', title: 'Assault by Means of Force Likely to Produce GBI', calcrimNumbers: [875], severity: 'wobbler', commonEnhancements: ['PC 12022.7', 'PC 186.22'], description: 'Assault by means of force likely to produce great bodily injury.' },
  { code: 'PC', section: '243(d)', title: 'Battery Causing Serious Bodily Injury', calcrimNumbers: [925], severity: 'wobbler', commonEnhancements: ['PC 12022.7'], description: 'Battery resulting in serious bodily injury to the victim.' },
  { code: 'PC', section: '243(e)(1)', title: 'Domestic Battery', calcrimNumbers: [841], severity: 'misdemeanor', commonEnhancements: [], description: 'Battery against a spouse, cohabitant, or dating partner.' },
  { code: 'PC', section: '273.5(a)', title: 'Corporal Injury to Spouse/Cohabitant', calcrimNumbers: [840], severity: 'wobbler', commonEnhancements: ['PC 12022.7'], description: 'Willful infliction of corporal injury on a spouse, cohabitant, or co-parent.' },
  { code: 'PC', section: '261(a)', title: 'Rape', calcrimNumbers: [1000, 1001], severity: 'felony', commonEnhancements: ['PC 667.61'], description: 'Nonconsensual sexual intercourse accomplished by force, threat, or fraud.' },
  { code: 'PC', section: '288(a)', title: 'Lewd Acts with a Minor', calcrimNumbers: [1110, 1111], severity: 'felony', commonEnhancements: ['PC 667.61'], description: 'Lewd or lascivious acts upon a child under 14 years of age.' },
  { code: 'PC', section: '422', title: 'Criminal Threats', calcrimNumbers: [1300], severity: 'wobbler', commonEnhancements: ['PC 186.22'], description: 'Threatening to commit a crime which would result in death or great bodily injury.' },
  { code: 'PC', section: '211', title: 'Robbery', calcrimNumbers: [1600], severity: 'felony', commonEnhancements: ['PC 12022.53', 'PC 186.22'], description: 'Taking of personal property from another by force or fear.' },

  // PENAL CODE — Crimes Against Property
  { code: 'PC', section: '459', title: 'Burglary', calcrimNumbers: [1700], severity: 'wobbler', commonEnhancements: ['PC 667.5(c)'], description: 'Entry into a structure with intent to commit a felony or theft.' },
  { code: 'PC', section: '487(a)', title: 'Grand Theft', calcrimNumbers: [1800], severity: 'wobbler', commonEnhancements: [], description: 'Theft of property valued at $950 or more.' },
  { code: 'PC', section: '488', title: 'Petty Theft', calcrimNumbers: [1800], severity: 'misdemeanor', commonEnhancements: [], description: 'Theft of property valued at less than $950.' },
  { code: 'PC', section: '496(a)', title: 'Receiving Stolen Property', calcrimNumbers: [1750], severity: 'wobbler', commonEnhancements: [], description: 'Buying or receiving property known to be stolen.' },
  { code: 'PC', section: '451', title: 'Arson', calcrimNumbers: [1515], severity: 'felony', commonEnhancements: ['PC 12022.7'], description: 'Willful and malicious setting of fire to any structure or property.' },
  { code: 'PC', section: '594', title: 'Vandalism', calcrimNumbers: [2900], severity: 'wobbler', commonEnhancements: [], description: 'Maliciously damaging, destroying, or defacing property.' },

  // PENAL CODE — Weapons
  { code: 'PC', section: '29800(a)(1)', title: 'Felon in Possession of Firearm', calcrimNumbers: [2510], severity: 'wobbler', commonEnhancements: ['PC 186.22'], description: 'Person convicted of a felony possessing a firearm.' },
  { code: 'PC', section: '25400(a)', title: 'Carrying a Concealed Weapon', calcrimNumbers: [2520], severity: 'wobbler', commonEnhancements: [], description: 'Carrying a concealed firearm on person or in vehicle.' },
  { code: 'PC', section: '25850(a)', title: 'Carrying a Loaded Firearm', calcrimNumbers: [2530], severity: 'wobbler', commonEnhancements: [], description: 'Carrying a loaded firearm in public.' },

  // PENAL CODE — Other
  { code: 'PC', section: '148(a)(1)', title: 'Resisting Arrest', calcrimNumbers: [2656], severity: 'misdemeanor', commonEnhancements: [], description: 'Willfully resisting, delaying, or obstructing a peace officer.' },
  { code: 'PC', section: '69', title: 'Resisting Executive Officer', calcrimNumbers: [2651, 2652], severity: 'wobbler', commonEnhancements: [], description: 'Using threats or violence to deter or resist an executive officer.' },
  { code: 'PC', section: '368(b)(1)', title: 'Elder Abuse', calcrimNumbers: [830, 831], severity: 'wobbler', commonEnhancements: ['PC 12022.7'], description: 'Willful infliction of unjustifiable physical pain on an elder.' },

  // VEHICLE CODE
  { code: 'VC', section: '23152(a)', title: 'DUI — Alcohol', calcrimNumbers: [2110], severity: 'misdemeanor', commonEnhancements: ['VC 23578', 'PC 12022.7'], description: 'Driving under the influence of alcohol.' },
  { code: 'VC', section: '23152(b)', title: 'DUI — BAC .08+', calcrimNumbers: [2111], severity: 'misdemeanor', commonEnhancements: ['VC 23578'], description: 'Driving with blood alcohol concentration of .08% or greater.' },
  { code: 'VC', section: '23152(f)', title: 'DUI — Drugs', calcrimNumbers: [2110], severity: 'misdemeanor', commonEnhancements: [], description: 'Driving under the influence of drugs.' },
  { code: 'VC', section: '23153(a)', title: 'DUI Causing Injury', calcrimNumbers: [2100, 2101], severity: 'wobbler', commonEnhancements: ['PC 12022.7'], description: 'Driving under the influence causing bodily injury.' },
  { code: 'VC', section: '20001(a)', title: 'Hit and Run — Injury/Death', calcrimNumbers: [2140], severity: 'wobbler', commonEnhancements: [], description: 'Leaving the scene of an accident resulting in injury or death.' },
  { code: 'VC', section: '10851(a)', title: 'Vehicle Theft', calcrimNumbers: [1820], severity: 'wobbler', commonEnhancements: [], description: 'Taking or driving a vehicle without owner consent.' },

  // HEALTH & SAFETY CODE
  { code: 'HSC', section: '11350(a)', title: 'Possession of Controlled Substance', calcrimNumbers: [2304], severity: 'misdemeanor', commonEnhancements: [], description: 'Possession of a controlled substance (non-marijuana).' },
  { code: 'HSC', section: '11351', title: 'Possession for Sale — Narcotics', calcrimNumbers: [2302], severity: 'felony', commonEnhancements: ['HSC 11370.4'], description: 'Possession of a narcotic controlled substance for purposes of sale.' },
  { code: 'HSC', section: '11352(a)', title: 'Sale/Transport of Narcotics', calcrimNumbers: [2300], severity: 'felony', commonEnhancements: ['HSC 11370.4', 'PC 186.22'], description: 'Sale, transport, or furnishing of a narcotic controlled substance.' },
  { code: 'HSC', section: '11377(a)', title: 'Possession of Methamphetamine', calcrimNumbers: [2304], severity: 'misdemeanor', commonEnhancements: [], description: 'Possession of methamphetamine or other specified controlled substance.' },
  { code: 'HSC', section: '11378', title: 'Possession for Sale — Meth/Other', calcrimNumbers: [2302], severity: 'felony', commonEnhancements: ['HSC 11370.4'], description: 'Possession of methamphetamine or other controlled substance for sale.' },
  { code: 'HSC', section: '11379(a)', title: 'Sale/Transport of Meth/Other', calcrimNumbers: [2300], severity: 'felony', commonEnhancements: ['HSC 11370.4', 'PC 186.22'], description: 'Sale, transport, or furnishing of methamphetamine or controlled substance.' },

  // WELFARE & INSTITUTIONS CODE
  { code: 'WIC', section: '10980(c)(2)', title: 'Welfare Fraud', calcrimNumbers: [2040], severity: 'wobbler', commonEnhancements: [], description: 'Knowingly making a false statement to receive welfare benefits.' },
];

// ---------------------------------------------------------------------------
// Lookup Functions
// ---------------------------------------------------------------------------

export function getCodeByAbbreviation(abbreviation: string): CaliforniaCode | undefined {
  return CALIFORNIA_CODES.find((c) => c.abbreviation === abbreviation.toUpperCase());
}

export function getCriminalDefenseCodes(): CaliforniaCode[] {
  return CALIFORNIA_CODES.filter((c) => c.commonInCriminalDefense);
}

export function getAllCodes(): CaliforniaCode[] {
  return [...CALIFORNIA_CODES].sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
}

export function searchCodes(query: string): CaliforniaCode[] {
  const q = query.toLowerCase();
  return CALIFORNIA_CODES.filter(
    (c) =>
      c.abbreviation.toLowerCase().includes(q) ||
      c.fullName.toLowerCase().includes(q) ||
      c.shortName.toLowerCase().includes(q),
  );
}

export function getStatutesByCode(codeAbbreviation: string): StatuteEntry[] {
  return COMMON_CRIMINAL_STATUTES.filter((s) => s.code === codeAbbreviation.toUpperCase());
}

export function searchStatutes(query: string): StatuteEntry[] {
  const q = query.toLowerCase();
  return COMMON_CRIMINAL_STATUTES.filter(
    (s) =>
      s.section.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      `${s.code} ${s.section}`.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q),
  );
}

export function getStatute(code: string, section: string): StatuteEntry | undefined {
  return COMMON_CRIMINAL_STATUTES.find(
    (s) => s.code === code.toUpperCase() && s.section === section,
  );
}

export function getCalcrimNumbersForStatute(code: string, section: string): number[] {
  const statute = getStatute(code, section);
  return statute?.calcrimNumbers ?? [];
}
