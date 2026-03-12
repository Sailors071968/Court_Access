// ============================================
// POST LD-24: Handling Evidence — Seed Data
// ============================================

import type { ParsedDoctrineChunk } from './types.ts';

export const LD24_DOCTRINE_RULES: ParsedDoctrineChunk[] = [
  // =========================================================================
  // Evidence Collection
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Evidence Collection',
    topic: 'Collection Standards',
    rule: 'Evidence must be collected using methods that preserve its integrity and prevent contamination or alteration.',
    explanation: 'Officers must use proper collection techniques appropriate to the type of evidence. This includes wearing gloves, using clean tools, and following established forensic protocols.',
    legalImplication: 'Evidence collected using improper methods may be challenged as unreliable or contaminated.',
    category: 'evidence_collection',
    keywords: ['evidence collection', 'integrity', 'contamination', 'forensic protocols', 'preservation'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Collection',
    topic: 'Biological Evidence Collection',
    rule: 'Biological evidence such as blood, saliva, and tissue must be collected using sterile instruments and stored in appropriate containers to prevent degradation.',
    explanation: 'Biological evidence is highly sensitive to contamination and degradation. Officers must follow specific protocols for different types of biological material.',
    legalImplication: 'Improperly collected biological evidence may yield unreliable forensic results and be excluded.',
    category: 'evidence_collection',
    keywords: ['biological evidence', 'blood', 'DNA', 'sterile', 'degradation', 'contamination'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Collection',
    topic: 'Trace Evidence',
    rule: 'Trace evidence such as fibers, hair, and particulates must be collected carefully to avoid cross-contamination between items of evidence.',
    explanation: 'Trace evidence is easily transferred between objects. Officers must change gloves between handling different items and use separate collection tools for each item.',
    legalImplication: 'Cross-contamination of trace evidence may render forensic analysis unreliable and inadmissible.',
    category: 'evidence_collection',
    keywords: ['trace evidence', 'fibers', 'hair', 'cross-contamination', 'collection'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Collection',
    topic: 'Firearm Evidence',
    rule: 'Firearms must be handled safely during collection, rendered safe, and documented in their found condition before being moved or processed.',
    explanation: 'Officers must note the condition of the firearm (loaded/unloaded, safety on/off, chamber status) before making it safe. Serial numbers and markings should be documented.',
    legalImplication: 'Improper handling of firearm evidence may compromise ballistic analysis and chain of custody.',
    category: 'evidence_collection',
    keywords: ['firearm', 'evidence', 'safe handling', 'ballistic', 'documentation', 'serial number'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Collection',
    topic: 'Digital Evidence Collection',
    rule: 'Digital evidence must be collected in a manner that preserves the data in its original state, including using write-blocking devices when appropriate.',
    explanation: 'Accessing digital devices without write protection may alter metadata or file contents. Forensic imaging creates an exact copy while preserving the original.',
    legalImplication: 'Digital evidence that has been altered during collection may be excluded or its integrity challenged.',
    category: 'evidence_collection',
    keywords: ['digital evidence', 'write-blocking', 'forensic imaging', 'metadata', 'original state'],
  },

  // =========================================================================
  // Evidence Packaging
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Evidence Packaging',
    topic: 'Packaging Standards',
    rule: 'Evidence must be packaged to prevent contamination, degradation, or damage during storage and transport.',
    explanation: 'Different types of evidence require different packaging: paper bags for biological evidence (to allow air circulation), airtight containers for volatile substances, and rigid containers for fragile items.',
    legalImplication: 'Evidence that is damaged or degraded due to improper packaging may lose its evidentiary value.',
    category: 'evidence_handling',
    keywords: ['evidence packaging', 'contamination', 'degradation', 'paper bags', 'containers'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Packaging',
    topic: 'Wet Evidence',
    rule: 'Wet biological evidence must be air-dried before packaging in paper containers. Plastic packaging must not be used for wet biological evidence as it promotes bacterial growth and degradation.',
    explanation: 'Moisture in sealed plastic containers creates conditions for bacterial growth that degrades DNA evidence. Air drying followed by paper packaging is the standard protocol.',
    legalImplication: 'DNA evidence degraded by improper packaging may be unusable for forensic analysis.',
    category: 'evidence_handling',
    keywords: ['wet evidence', 'biological', 'air dry', 'paper packaging', 'plastic', 'DNA degradation'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Packaging',
    topic: 'Narcotics Packaging',
    rule: 'Suspected narcotics must be packaged in sealed, tamper-evident containers with accurate weight documentation.',
    explanation: 'Proper narcotics packaging prevents contamination, loss, and ensures accurate quantity measurements. Chain of custody for narcotics is especially scrutinized.',
    legalImplication: 'Improperly packaged narcotics may lead to challenges regarding weight, purity, and chain of custody.',
    category: 'evidence_handling',
    keywords: ['narcotics', 'packaging', 'sealed', 'tamper-evident', 'weight', 'chain of custody'],
  },

  // =========================================================================
  // Evidence Labeling
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Evidence Labeling',
    topic: 'Labeling Requirements',
    rule: 'All evidence must be labeled with a unique identifier, the case number, the collecting officer\'s name and badge number, the date and time of collection, a description of the item, and the location where it was found.',
    explanation: 'Proper labeling is essential for chain of custody and ensures each item can be uniquely identified and tracked throughout the process.',
    legalImplication: 'Mislabeled or unlabeled evidence may create chain of custody issues and be excluded.',
    category: 'evidence_handling',
    keywords: ['evidence labeling', 'unique identifier', 'case number', 'collecting officer', 'chain of custody'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Labeling',
    topic: 'Seal Integrity',
    rule: 'Evidence containers must be sealed with tamper-evident seals that show any unauthorized opening. The seal must be signed and dated by the collecting officer.',
    explanation: 'Tamper-evident seals provide assurance that the evidence has not been accessed or altered since packaging. Any break in the seal must be documented.',
    legalImplication: 'Broken or missing seals may indicate tampering and undermine the evidence\'s integrity.',
    category: 'evidence_handling',
    keywords: ['seal', 'tamper-evident', 'integrity', 'signed', 'dated', 'unauthorized'],
  },

  // =========================================================================
  // Evidence Transport
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Evidence Transport',
    topic: 'Transport Security',
    rule: 'Evidence must be transported in a secure manner that maintains chain of custody and prevents damage, contamination, or loss.',
    explanation: 'During transport, evidence must be kept in the officer\'s control or in a secured area. Transport vehicles should be clean and evidence should be separated by case.',
    legalImplication: 'Evidence lost or contaminated during transport may be excluded or its reliability challenged.',
    category: 'evidence_handling',
    keywords: ['evidence transport', 'security', 'chain of custody', 'contamination', 'loss'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Transport',
    topic: 'Temperature-Sensitive Evidence',
    rule: 'Temperature-sensitive evidence such as biological samples and certain chemicals must be transported under appropriate temperature conditions.',
    explanation: 'Heat or cold can degrade biological evidence, alter chemical compositions, or destroy volatile evidence. Refrigerated transport may be necessary.',
    legalImplication: 'Evidence degraded during transport due to improper temperature control may be unreliable.',
    category: 'evidence_handling',
    keywords: ['temperature', 'biological samples', 'refrigerated', 'degradation', 'transport'],
  },

  // =========================================================================
  // Evidence Storage
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Evidence Storage',
    topic: 'Storage Facility Standards',
    rule: 'Evidence storage facilities must be secure, access-controlled, and environmentally appropriate for the types of evidence stored.',
    explanation: 'Evidence rooms require controlled access with sign-in logs, security cameras, appropriate shelving, and environmental controls for temperature and humidity.',
    legalImplication: 'Evidence stored in inadequate facilities may be challenged as potentially compromised.',
    category: 'evidence_handling',
    keywords: ['evidence storage', 'secure', 'access control', 'environmental controls', 'evidence room'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Storage',
    topic: 'Long-Term Preservation',
    rule: 'Evidence in serious felony cases must be preserved for the duration required by law, including biological evidence that may be subject to future DNA testing.',
    explanation: 'California law requires preservation of biological evidence in serious felony cases. Agencies must have policies for long-term preservation and retention.',
    legalImplication: 'Destruction of evidence that should have been preserved may result in sanctions and case dismissal.',
    category: 'evidence_handling',
    keywords: ['long-term preservation', 'biological evidence', 'DNA', 'retention', 'felony', 'destruction'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Storage',
    topic: 'Evidence Release',
    rule: 'Evidence may only be released from storage in accordance with established procedures, with proper documentation of who released it, who received it, and the reason for the release.',
    explanation: 'Evidence release requires authorization and documentation. All transfers in and out of the evidence room must be logged.',
    legalImplication: 'Unauthorized evidence release may constitute a break in chain of custody.',
    category: 'evidence_handling',
    keywords: ['evidence release', 'authorization', 'documentation', 'chain of custody', 'transfer'],
  },

  // =========================================================================
  // Contamination Prevention
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Contamination Prevention',
    topic: 'Cross-Contamination Prevention',
    rule: 'Officers must take precautions to prevent cross-contamination between evidence items, including changing gloves between items, using clean instruments, and separating items from different sources.',
    explanation: 'Cross-contamination occurs when material from one evidence item is transferred to another. This is particularly critical for DNA evidence, where even trace amounts can produce misleading results.',
    legalImplication: 'Cross-contaminated evidence may produce false forensic results and may be excluded.',
    category: 'evidence_handling',
    keywords: ['cross-contamination', 'gloves', 'clean instruments', 'DNA', 'separation', 'forensic'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Contamination Prevention',
    topic: 'Officer Contamination',
    rule: 'Officers must not eat, drink, smoke, or use the restroom near evidence or within the crime scene to prevent contamination.',
    explanation: 'Officer DNA, fingerprints, or other biological material can contaminate evidence. Officers should also avoid touching their face or other body parts while handling evidence.',
    legalImplication: 'Evidence contaminated by officer DNA may produce misleading forensic results.',
    category: 'evidence_handling',
    keywords: ['contamination', 'officer DNA', 'crime scene', 'biological material', 'prevention'],
  },

  // =========================================================================
  // Evidence Documentation
  // =========================================================================
  {
    source: 'POST LD-24',
    chapter: 'Evidence Documentation',
    topic: 'Evidence Log',
    rule: 'A comprehensive evidence log must be maintained for all items collected, documenting each item with a unique number, description, location found, time collected, and collecting officer.',
    explanation: 'The evidence log serves as the master record of all items collected during an investigation. It must be complete, accurate, and legible.',
    legalImplication: 'An incomplete evidence log may create chain of custody gaps and opportunities for defense challenges.',
    category: 'evidence_handling',
    keywords: ['evidence log', 'documentation', 'unique number', 'description', 'location', 'time'],
  },
  {
    source: 'POST LD-24',
    chapter: 'Evidence Documentation',
    topic: 'Photographic Documentation',
    rule: 'Evidence must be photographed in place before being collected, showing its location, condition, and relationship to the scene.',
    explanation: 'Photographs document the original condition and position of evidence. Multiple angles and scales should be used. A measuring device should be included for reference.',
    legalImplication: 'Evidence collected without pre-collection photographs may be challenged regarding its original position and condition.',
    category: 'evidence_handling',
    keywords: ['photography', 'documentation', 'in place', 'condition', 'location', 'scale'],
  },
];

export const LD24_RULE_COUNT = LD24_DOCTRINE_RULES.length;
