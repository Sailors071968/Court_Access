// ============================================
// POST LD-30: Crime Scene Investigation — Seed Data
// ============================================

import type { ParsedDoctrineChunk } from './types.ts';

export const LD30_DOCTRINE_RULES: ParsedDoctrineChunk[] = [
  // =========================================================================
  // Scene Security
  // =========================================================================
  {
    source: 'POST LD-30',
    chapter: 'Scene Security',
    topic: 'Initial Scene Security',
    rule: 'The first officer on scene must secure the crime scene and restrict access to preserve evidence and maintain scene integrity.',
    explanation: 'Scene security involves establishing a perimeter, identifying entry and exit points, and controlling who enters the scene. The first officer\'s actions are critical to the entire investigation.',
    legalImplication: 'Failure to secure the scene may result in evidence contamination, loss, and compromised investigation.',
    category: 'crime_scene',
    keywords: ['scene security', 'first officer', 'perimeter', 'access control', 'evidence preservation'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Scene Security',
    topic: 'Perimeter Establishment',
    rule: 'A crime scene perimeter must be established that is large enough to encompass all evidence, including potential evidence in surrounding areas.',
    explanation: 'The perimeter should err on the side of being too large rather than too small. It can always be reduced but expanding it after people have walked through the area compromises evidence.',
    legalImplication: 'An inadequate perimeter may result in evidence destruction by foot traffic or unauthorized persons.',
    category: 'crime_scene',
    keywords: ['perimeter', 'crime scene', 'boundary', 'evidence', 'surrounding area'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Scene Security',
    topic: 'Crime Scene Log',
    rule: 'A crime scene entry log must be maintained documenting every person who enters and exits the scene, including their name, agency, purpose, and times of entry and exit.',
    explanation: 'The crime scene log is a critical document for chain of custody and accountability. It identifies every person who may have had contact with evidence.',
    legalImplication: 'Failure to maintain a scene log may create chain of custody issues and accountability gaps.',
    category: 'crime_scene',
    keywords: ['crime scene log', 'entry log', 'accountability', 'chain of custody', 'documentation'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Scene Security',
    topic: 'Scene Access Control',
    rule: 'Only authorized personnel with a legitimate purpose should be allowed to enter the crime scene. Unauthorized persons, including non-essential law enforcement, must be excluded.',
    explanation: 'Every person who enters the scene is a potential source of contamination. Limiting access to essential personnel minimizes the risk of evidence compromise.',
    legalImplication: 'Unauthorized access to a crime scene may contaminate evidence and create defense opportunities.',
    category: 'crime_scene',
    keywords: ['access control', 'authorized personnel', 'contamination', 'crime scene', 'exclusion'],
  },

  // =========================================================================
  // Evidence Preservation
  // =========================================================================
  {
    source: 'POST LD-30',
    chapter: 'Evidence Preservation',
    topic: 'Scene Preservation',
    rule: 'The crime scene must be preserved in its original condition until it has been thoroughly documented and processed by investigators.',
    explanation: 'Nothing should be moved, touched, or altered at the scene until documentation (photography, sketching, notes) is complete. Officers should avoid unnecessary contact with anything at the scene.',
    legalImplication: 'Evidence altered before documentation may lose its evidentiary value and support defense challenges.',
    category: 'crime_scene',
    keywords: ['scene preservation', 'original condition', 'documentation', 'processing', 'integrity'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Evidence Preservation',
    topic: 'Weather Protection',
    rule: 'Officers must take steps to protect evidence from weather conditions such as rain, wind, or extreme temperatures that could degrade or destroy evidence.',
    explanation: 'Temporary covers, windbreaks, and other protective measures should be used when evidence is exposed to weather. These measures must not disturb the evidence.',
    legalImplication: 'Evidence destroyed by weather when protective measures were available may indicate negligent evidence preservation.',
    category: 'crime_scene',
    keywords: ['weather protection', 'evidence', 'rain', 'wind', 'degradation', 'preservation'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Evidence Preservation',
    topic: 'Transient Evidence',
    rule: 'Transient evidence such as tire tracks, footprints, and odors must be documented and preserved immediately as they may be lost quickly.',
    explanation: 'Transient evidence is evidence that may change, move, or be lost with time. It must be prioritized for documentation and collection. Photographs and casts should be made promptly.',
    legalImplication: 'Loss of transient evidence due to failure to prioritize preservation may constitute negligent investigation.',
    category: 'crime_scene',
    keywords: ['transient evidence', 'tire tracks', 'footprints', 'time-sensitive', 'preservation'],
  },

  // =========================================================================
  // Evidence Documentation at Scene
  // =========================================================================
  {
    source: 'POST LD-30',
    chapter: 'Scene Documentation',
    topic: 'Photography',
    rule: 'The crime scene must be thoroughly photographed before any evidence is collected or moved, using overview, mid-range, and close-up photographs.',
    explanation: 'Photography documents the scene as it was found. Overview photos show the entire scene, mid-range photos show evidence in context, and close-ups show detail. A measuring scale should be included.',
    legalImplication: 'Inadequate crime scene photography may make it difficult to establish the location and context of evidence.',
    category: 'crime_scene',
    keywords: ['photography', 'crime scene', 'documentation', 'overview', 'close-up', 'scale'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Scene Documentation',
    topic: 'Scene Sketch',
    rule: 'A crime scene sketch must be prepared showing the layout of the scene, the location of evidence, measurements, and the relationship between items of evidence.',
    explanation: 'Sketches complement photographs by providing accurate measurements and spatial relationships. They should include a legend, compass direction, scale, and the sketcher\'s information.',
    legalImplication: 'A missing or inaccurate crime scene sketch may undermine the prosecution\'s ability to present the scene to the jury.',
    category: 'crime_scene',
    keywords: ['crime scene sketch', 'measurements', 'layout', 'spatial relationships', 'documentation'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Scene Documentation',
    topic: 'Note Taking',
    rule: 'Officers must take detailed notes at the crime scene documenting their observations, actions taken, and the conditions at the scene.',
    explanation: 'Notes should be contemporaneous (taken at the time) and include date, time, weather, lighting, persons present, and a description of the scene and evidence observed.',
    legalImplication: 'Absence of contemporaneous notes may weaken the officer\'s testimony and create credibility issues.',
    category: 'crime_scene',
    keywords: ['note taking', 'documentation', 'contemporaneous', 'observations', 'conditions'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Scene Documentation',
    topic: 'Video Documentation',
    rule: 'Video documentation of the crime scene should be conducted to provide a continuous visual record of the scene and evidence.',
    explanation: 'Video provides context that photographs cannot, including spatial relationships and the overall condition of the scene. Narration during video recording should be factual and objective.',
    legalImplication: 'Video documentation supplements but does not replace photography and sketching.',
    category: 'crime_scene',
    keywords: ['video documentation', 'crime scene', 'visual record', 'continuous', 'narration'],
  },

  // =========================================================================
  // Search Patterns
  // =========================================================================
  {
    source: 'POST LD-30',
    chapter: 'Search Patterns',
    topic: 'Systematic Search',
    rule: 'Crime scene searches must be conducted using systematic search patterns to ensure thorough coverage and prevent overlooking evidence.',
    explanation: 'Common search patterns include grid, strip/lane, spiral, zone/quadrant, and wheel/ray patterns. The choice depends on the size and nature of the scene.',
    legalImplication: 'An unsystematic search may result in missed evidence and undermine the investigation.',
    category: 'crime_scene',
    keywords: ['search pattern', 'systematic', 'grid', 'spiral', 'zone', 'thorough'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Search Patterns',
    topic: 'Evidence Marking',
    rule: 'Each item of evidence discovered during a scene search must be marked with a numbered evidence marker before documentation and collection.',
    explanation: 'Evidence markers create a consistent reference system between photographs, sketches, and evidence logs. Markers should be placed near but not on top of evidence.',
    legalImplication: 'Unmarked evidence may be difficult to correlate between documentation methods.',
    category: 'crime_scene',
    keywords: ['evidence marking', 'numbered marker', 'documentation', 'reference system', 'identification'],
  },

  // =========================================================================
  // Special Scene Types
  // =========================================================================
  {
    source: 'POST LD-30',
    chapter: 'Special Scenes',
    topic: 'Homicide Scene',
    rule: 'Homicide scenes require the highest level of scene protection, documentation, and evidence processing due to the severity of the crime.',
    explanation: 'Homicide scenes should be treated as major crime scenes with extensive documentation, specialized evidence collection, and often require crime scene reconstruction.',
    legalImplication: 'Errors at homicide crime scenes may compromise the prosecution of the most serious criminal cases.',
    category: 'crime_scene',
    keywords: ['homicide', 'major crime scene', 'documentation', 'evidence processing', 'reconstruction'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Special Scenes',
    topic: 'Vehicle Crime Scene',
    rule: 'When a vehicle is a crime scene, it must be secured, documented in place, and typically towed to a secure facility for processing.',
    explanation: 'Vehicles contain numerous surfaces for latent prints, DNA, and trace evidence. Processing should occur in a controlled environment when possible.',
    legalImplication: 'Improperly processed vehicle evidence may miss critical forensic evidence.',
    category: 'crime_scene',
    keywords: ['vehicle crime scene', 'secure', 'tow', 'latent prints', 'DNA', 'processing'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Special Scenes',
    topic: 'Outdoor Crime Scene',
    rule: 'Outdoor crime scenes present unique challenges due to weather, terrain, and public access, requiring expanded perimeters and expedited evidence collection.',
    explanation: 'Outdoor evidence is particularly vulnerable to weather, animals, and foot traffic. Evidence collection should be prioritized based on the risk of loss or degradation.',
    legalImplication: 'Failure to expedite outdoor evidence collection may result in evidence loss.',
    category: 'crime_scene',
    keywords: ['outdoor scene', 'weather', 'terrain', 'expanded perimeter', 'expedited collection'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Special Scenes',
    topic: 'Digital Crime Scene',
    rule: 'When digital devices are present at a crime scene, they must be documented, photographed showing their screen state if active, and collected following digital evidence protocols.',
    explanation: 'Active devices may display relevant information that can be lost if the device powers down. Officers should document screen contents, isolate devices from networks when appropriate, and use proper collection methods.',
    legalImplication: 'Improperly handled digital evidence at a crime scene may be altered or rendered inadmissible.',
    category: 'crime_scene',
    keywords: ['digital crime scene', 'digital devices', 'screen state', 'network isolation', 'evidence protocols'],
  },

  // =========================================================================
  // Crime Scene Reconstruction
  // =========================================================================
  {
    source: 'POST LD-30',
    chapter: 'Scene Reconstruction',
    topic: 'Reconstruction Principles',
    rule: 'Crime scene reconstruction must be based on physical evidence, scientific analysis, and logical reasoning, not assumptions or speculation.',
    explanation: 'Reconstruction involves determining the sequence of events based on evidence analysis. Bloodstain patterns, bullet trajectories, and evidence positions all contribute to reconstruction.',
    legalImplication: 'Reconstruction opinions not based on physical evidence may be challenged as speculative.',
    category: 'crime_scene',
    keywords: ['reconstruction', 'physical evidence', 'scientific analysis', 'sequence of events', 'bloodstain'],
  },

  // =========================================================================
  // Scene Release
  // =========================================================================
  {
    source: 'POST LD-30',
    chapter: 'Scene Release',
    topic: 'Scene Release Procedures',
    rule: 'A crime scene should not be released until all evidence has been documented, collected, and the lead investigator has authorized the release.',
    explanation: 'Once a scene is released, it cannot be re-secured. The lead investigator must confirm that all necessary processing is complete before releasing the scene.',
    legalImplication: 'Premature scene release may result in loss of evidence that was not yet collected or documented.',
    category: 'crime_scene',
    keywords: ['scene release', 'lead investigator', 'authorization', 'evidence collection', 'documentation'],
  },
  {
    source: 'POST LD-30',
    chapter: 'Scene Release',
    topic: 'Final Walkthrough',
    rule: 'Before releasing a crime scene, a final walkthrough should be conducted to verify that all evidence has been collected and documented.',
    explanation: 'The final walkthrough serves as a quality control measure. It should be conducted by the lead investigator and documented in case notes.',
    legalImplication: 'Evidence missed during processing may be lost once the scene is released.',
    category: 'crime_scene',
    keywords: ['final walkthrough', 'quality control', 'verification', 'scene release', 'documentation'],
  },
];

export const LD30_RULE_COUNT = LD30_DOCTRINE_RULES.length;
