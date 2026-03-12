// ============================================
// POST LD-24: Handling Evidence — Expansion
// Additional doctrine rules to reach ~60 total
// ============================================

import type { ParsedDoctrineChunk } from './types.ts';

export const LD24_EXPANSION_RULES: ParsedDoctrineChunk[] = [
  // =========================================================================
  // CHAPTER: Chain of Custody
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Chain of Custody',
    topic: 'Chain of Custody Requirements',
    rule: 'Every transfer of evidence must be documented with the name of the person transferring, the name of the person receiving, the date and time, and the reason for the transfer.',
    explanation: 'Chain of custody is the chronological record of who handled evidence and when. Each link in the chain must be documented to ensure integrity.',
    legalImplication: 'A break in the chain of custody may result in evidence being excluded or its weight significantly diminished.',
    category: 'chain_of_custody',
    keywords: ['chain of custody', 'transfer', 'documentation', 'evidence integrity'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Chain of Custody',
    topic: 'Evidence Booking',
    rule: 'Evidence must be booked into the evidence facility as soon as practical after collection, with each item individually packaged, labeled, and entered into the evidence tracking system.',
    explanation: 'Prompt booking reduces the risk of loss, contamination, or tampering. The evidence tracking system provides a permanent record of custody.',
    legalImplication: 'Delayed booking may create a gap in the chain of custody that could be exploited by the defense.',
    category: 'chain_of_custody',
    keywords: ['evidence booking', 'evidence facility', 'tracking system', 'prompt'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Chain of Custody',
    topic: 'Evidence Seals',
    rule: 'Evidence containers must be sealed with tamper-evident seals that show any attempt to open or access the contents. Each seal must be initialed and dated by the person applying it.',
    explanation: 'Tamper-evident seals provide assurance that evidence has not been accessed or altered. Broken seals must be documented and re-sealed.',
    legalImplication: 'Evidence found with broken or missing seals without documented explanation may be challenged as compromised.',
    category: 'chain_of_custody',
    keywords: ['evidence seals', 'tamper-evident', 'integrity', 'packaging'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Chain of Custody',
    topic: 'Laboratory Submission',
    rule: 'When evidence is submitted to a crime laboratory for analysis, the submission must be documented with the specific analysis requested, the evidence description, and the chain of custody form.',
    explanation: 'Laboratory submission continues the chain of custody. The lab documents receipt, analysis performed, and return of evidence.',
    legalImplication: 'Gaps in documentation between field collection and laboratory analysis may compromise evidence admissibility.',
    category: 'chain_of_custody',
    keywords: ['laboratory submission', 'analysis', 'crime lab', 'documentation'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Chain of Custody',
    topic: 'Court Evidence',
    rule: 'When evidence is transported to court for trial, the chain of custody must be maintained through check-out from the evidence facility, transport, and return after court proceedings.',
    explanation: 'Evidence officers or detectives typically transport evidence to court. The evidence must be secured during transport and in the courtroom.',
    legalImplication: 'Evidence presented in court without proper chain of custody documentation may be objected to and excluded.',
    category: 'chain_of_custody',
    keywords: ['court evidence', 'transport', 'check-out', 'trial', 'authentication'],
  },

  // =========================================================================
  // CHAPTER: Evidence Storage
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Evidence Storage',
    topic: 'Storage Facility Requirements',
    rule: 'Evidence storage facilities must be secure, access-controlled, and environmentally appropriate for the types of evidence stored. Only authorized personnel may access the facility.',
    explanation: 'A secure evidence facility prevents theft, tampering, and environmental damage. Access logs must be maintained for all entries.',
    legalImplication: 'An insecure evidence facility may compromise the integrity of all evidence stored within it.',
    category: 'evidence_handling',
    keywords: ['evidence storage', 'secure facility', 'access control', 'authorized personnel'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Storage',
    topic: 'Temperature-Sensitive Evidence',
    rule: 'Biological evidence, drug evidence, and other temperature-sensitive items must be stored in appropriate conditions, including refrigeration or freezing as required.',
    explanation: 'Biological evidence containing DNA degrades rapidly at room temperature. Drug evidence may deteriorate in extreme conditions. Proper storage preserves analytical value.',
    legalImplication: 'Evidence stored in improper conditions may be degraded beyond usefulness, potentially destroying critical evidence.',
    category: 'evidence_handling',
    keywords: ['temperature-sensitive', 'refrigeration', 'biological', 'drug evidence', 'preservation'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Storage',
    topic: 'Firearm Storage',
    rule: 'Firearms held as evidence must be stored in a separate, secure area with additional access restrictions. Each weapon must be rendered safe and individually stored.',
    explanation: 'Firearm evidence requires enhanced security due to the risk of theft and misuse. Weapons should be stored unloaded with the condition (loaded/unloaded) documented.',
    legalImplication: 'Loss or theft of firearm evidence may result in significant liability and criminal investigation.',
    category: 'evidence_handling',
    keywords: ['firearm storage', 'weapons', 'secure area', 'rendered safe'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Storage',
    topic: 'Narcotics Storage',
    rule: 'Narcotics and controlled substances must be stored in a double-locked container within the evidence facility, with separate access records and periodic inventory audits.',
    explanation: 'Controlled substances are high-value items subject to theft. Double-lock systems require two separate persons to access the narcotics vault.',
    legalImplication: 'Missing narcotics evidence may result in case dismissal and criminal investigation of evidence facility personnel.',
    category: 'evidence_handling',
    keywords: ['narcotics storage', 'controlled substances', 'double-locked', 'audit'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Storage',
    topic: 'Large Item Storage',
    rule: 'Large items such as vehicles, furniture, and equipment must be stored in a secure, weatherproof area with the same chain of custody requirements as smaller evidence items.',
    explanation: 'Large items present unique storage challenges but must receive the same level of security and documentation as other evidence.',
    legalImplication: 'Failure to properly secure large evidence items may result in damage, contamination, or theft.',
    category: 'evidence_handling',
    keywords: ['large items', 'vehicles', 'weatherproof', 'storage', 'security'],
  },

  // =========================================================================
  // CHAPTER: Evidence Disposition
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Evidence Disposition',
    topic: 'Retention Periods',
    rule: 'Evidence must be retained for the duration specified by law and department policy. For homicide cases, biological evidence must be retained for the life of the convicted person.',
    explanation: 'California Penal Code Section 1417.9 requires preservation of biological evidence in cases punishable by life imprisonment. Other evidence retention varies by case type.',
    legalImplication: 'Premature destruction of evidence may violate statutory requirements and may constitute spoliation.',
    category: 'evidence_handling',
    keywords: ['retention periods', 'evidence preservation', 'homicide', 'biological evidence'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Disposition',
    topic: 'Evidence Destruction',
    rule: 'Evidence may only be destroyed after all legal requirements are satisfied, case dispositions are confirmed, and proper authorization is obtained from the evidence custodian and supervisor.',
    explanation: 'Evidence destruction must follow a documented process. Destruction methods must ensure complete elimination of the evidence.',
    legalImplication: 'Unauthorized destruction of evidence may constitute a criminal offense and may result in civil liability.',
    category: 'evidence_handling',
    keywords: ['evidence destruction', 'authorization', 'disposition', 'legal requirements'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Disposition',
    topic: 'Return of Property',
    rule: 'Property seized as evidence must be returned to its rightful owner when it is no longer needed for court proceedings, unless it is contraband or subject to forfeiture.',
    explanation: 'California Penal Code Section 1536 requires return of property when it is no longer needed. Owners must be notified and given an opportunity to claim their property.',
    legalImplication: 'Failure to return property may constitute an unlawful taking and expose the department to civil liability.',
    category: 'evidence_handling',
    keywords: ['return of property', 'rightful owner', 'penal code 1536', 'forfeiture'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Disposition',
    topic: 'Forfeiture Procedures',
    rule: 'Asset forfeiture proceedings must comply with California Health and Safety Code Section 11470 et seq. and require proof that the property is connected to criminal activity.',
    explanation: 'California law imposes strict requirements on asset forfeiture, including judicial oversight and a conviction requirement for most forfeitures.',
    legalImplication: 'Forfeiture proceedings that fail to comply with statutory requirements may be voided.',
    category: 'evidence_handling',
    keywords: ['forfeiture', 'asset forfeiture', 'conviction requirement', 'health and safety code'],
  },

  // =========================================================================
  // CHAPTER: Special Evidence Types
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Special Evidence',
    topic: 'Currency Evidence',
    rule: 'Currency seized as evidence must be counted by two officers, the amount documented, serial numbers recorded for significant bills, and the currency stored in a secure evidence container.',
    explanation: 'Currency is highly susceptible to theft allegations. Dual-officer counting and detailed documentation protects against false claims.',
    legalImplication: 'Discrepancies in currency amounts may result in criminal investigation and civil liability.',
    category: 'evidence_handling',
    keywords: ['currency', 'money', 'dual counting', 'serial numbers', 'documentation'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Special Evidence',
    topic: 'Digital Device Evidence',
    rule: 'Digital devices must be handled by trained personnel, stored in anti-static bags, kept away from magnets and extreme temperatures, and their data preserved through forensic imaging.',
    explanation: 'Digital evidence is fragile and can be altered by improper handling. Forensic imaging creates an exact copy for analysis while preserving the original.',
    legalImplication: 'Improperly handled digital devices may have corrupted data, undermining the evidence value.',
    category: 'evidence_handling',
    keywords: ['digital devices', 'anti-static', 'forensic imaging', 'data preservation'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Special Evidence',
    topic: 'Biohazard Evidence',
    rule: 'Evidence contaminated with blood, body fluids, or other biohazards must be handled with universal precautions, properly labeled with biohazard warnings, and stored separately from non-hazardous evidence.',
    explanation: 'Biohazard evidence poses health risks to evidence handlers. Universal precautions protect personnel while preserving evidence integrity.',
    legalImplication: 'Failure to properly handle biohazard evidence may expose personnel to health risks and create liability.',
    category: 'evidence_handling',
    keywords: ['biohazard', 'blood', 'body fluids', 'universal precautions', 'labeling'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Special Evidence',
    topic: 'Sexual Assault Kit Evidence',
    rule: 'Sexual assault kits (SAKs) must be refrigerated within two hours of collection and submitted to the crime laboratory within 20 days, in compliance with California law.',
    explanation: 'California Penal Code Section 680.3 mandates timely processing of SAKs. Agencies must track all SAKs and report untested kits.',
    legalImplication: 'Failure to timely process sexual assault kits may violate state law and the victim\'s rights.',
    category: 'evidence_handling',
    keywords: ['sexual assault kit', 'SAK', 'refrigeration', 'timely processing', 'penal code 680.3'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Special Evidence',
    topic: 'Explosive Evidence',
    rule: 'Explosive devices, components, and residue must be handled only by trained bomb technicians and stored in appropriate facilities separate from other evidence.',
    explanation: 'Explosive evidence poses extreme safety risks. Only personnel with EOD (Explosive Ordnance Disposal) training should handle such evidence.',
    legalImplication: 'Improper handling of explosive evidence may endanger lives and compromise the investigation.',
    category: 'evidence_handling',
    keywords: ['explosives', 'bomb', 'EOD', 'safety', 'trained personnel'],
  },

  // =========================================================================
  // CHAPTER: Evidence Integrity Audits
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Evidence Audits',
    topic: 'Annual Audit',
    rule: 'Evidence facilities must be audited at least annually by an independent reviewer to verify inventory accuracy, security measures, and compliance with evidence handling policies.',
    explanation: 'Regular audits detect discrepancies, identify security weaknesses, and ensure compliance. The audit should include random sampling of evidence items.',
    legalImplication: 'An evidence facility that has not been audited may face challenges to the integrity of all evidence stored within it.',
    category: 'evidence_handling',
    keywords: ['annual audit', 'inventory', 'security', 'compliance', 'independent reviewer'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Audits',
    topic: 'Change of Custodian Audit',
    rule: 'When the evidence custodian changes, a complete inventory audit must be conducted and signed by both the outgoing and incoming custodians.',
    explanation: 'The change-of-custodian audit establishes accountability and documents the condition of the evidence facility at the time of transfer.',
    legalImplication: 'Missing items discovered during a custodian change may result in investigation of the outgoing custodian.',
    category: 'evidence_handling',
    keywords: ['custodian change', 'inventory audit', 'accountability', 'transfer'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Audits',
    topic: 'Discrepancy Resolution',
    rule: 'Any discrepancies discovered during evidence audits must be investigated immediately, documented, and reported to command staff. Missing evidence triggers a formal investigation.',
    explanation: 'Evidence discrepancies may indicate theft, mishandling, or administrative errors. Prompt investigation is essential to determine the cause.',
    legalImplication: 'Missing evidence may result in case dismissal, departmental sanctions, and criminal prosecution.',
    category: 'evidence_handling',
    keywords: ['discrepancy', 'missing evidence', 'investigation', 'audit', 'accountability'],
  },

  // =========================================================================
  // CHAPTER: Found Property
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Found Property',
    topic: 'Found Property Procedures',
    rule: 'Found property that is not connected to criminal activity must be documented, booked into the property facility, and efforts made to locate and notify the rightful owner.',
    explanation: 'California Civil Code Section 2080 requires finders to attempt to locate the owner. After a statutory waiting period, the property may be disposed of.',
    legalImplication: 'Failure to properly handle found property may constitute conversion or misappropriation.',
    category: 'evidence_handling',
    keywords: ['found property', 'rightful owner', 'notification', 'civil code 2080'],
  },

  // =========================================================================
  // CHAPTER: Evidence Technology
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Evidence Technology',
    topic: 'Body-Worn Camera Evidence',
    rule: 'Body-worn camera footage is evidence and must be retained, stored, and managed in accordance with department policy, with retention periods consistent with the underlying incident type.',
    explanation: 'BWC footage is subject to the same chain of custody requirements as physical evidence. Agencies must have policies for retention, access, and redaction.',
    legalImplication: 'Deletion or alteration of BWC footage may constitute destruction of evidence.',
    category: 'evidence_handling',
    keywords: ['body-worn camera', 'BWC footage', 'retention', 'digital evidence', 'storage'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Technology',
    topic: 'Evidence Tracking Systems',
    rule: 'Agencies must use electronic evidence tracking systems that provide real-time inventory, audit trails, and automated alerts for evidence approaching disposition dates.',
    explanation: 'Modern evidence tracking systems replace paper-based systems and provide superior accountability, searchability, and reporting capabilities.',
    legalImplication: 'Agencies using inadequate tracking systems may fail to meet statutory retention requirements.',
    category: 'evidence_handling',
    keywords: ['tracking system', 'electronic', 'audit trail', 'inventory', 'automated alerts'],
  },
];
