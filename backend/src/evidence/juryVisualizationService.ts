// ============================================================================
// Phase 176 — Jury Visualization Mode
// Simplified, non-legal visual explanation of scene and timeline.
// Displays scene reconstruction, timeline, and highlighted events
// without legal terminology — purely visual explanation for jury consumption.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JuryVisualization {
  visualizationId?: string;
  caseId: string;
  title: string;
  generatedAt: string;
  sceneView: JurySceneView;
  timeline: JuryTimeline;
  highlightedEvents: JuryHighlight[];
  narrativeCards: NarrativeCard[];
  viewerSettings: ViewerSettings;
  metadata: JuryViewMetadata;
}

export interface JurySceneView {
  viewType: 'overhead' | 'street_level' | 'split_view';
  sceneDescription: string;
  keyLocations: JuryLocation[];
  personPositions: JuryPerson[];
  vehiclePositions: JuryVehicle[];
  annotationLabels: JuryAnnotation[];
  compassDirection: number;
  scaleBarFeet: number;
}

export interface JuryLocation {
  locationId: string;
  label: string;
  description: string;
  position: { x: number; y: number };
  iconType: 'star' | 'circle' | 'arrow' | 'pin' | 'flag';
  color: string;
}

export interface JuryPerson {
  personId: string;
  label: string;
  role: 'officer' | 'individual' | 'witness' | 'bystander';
  color: string;
  positions: Array<{
    timestamp: string;
    x: number;
    y: number;
    label?: string;
  }>;
  showPath: boolean;
}

export interface JuryVehicle {
  vehicleId: string;
  label: string;
  vehicleType: string;
  color: string;
  position: { x: number; y: number };
  rotation: number;
}

export interface JuryAnnotation {
  annotationId: string;
  text: string;
  position: { x: number; y: number };
  fontSize: 'small' | 'medium' | 'large';
  color: string;
  arrowTo?: { x: number; y: number };
}

export interface JuryTimeline {
  startLabel: string;
  endLabel: string;
  totalDurationLabel: string;
  entries: JuryTimelineEntry[];
}

export interface JuryTimelineEntry {
  entryId: string;
  timeLabel: string;
  description: string;
  icon: TimelineIcon;
  color: string;
  isHighlighted: boolean;
  detailText?: string;
}

export type TimelineIcon =
  | 'person_walking'
  | 'car'
  | 'speech_bubble'
  | 'hand'
  | 'eye'
  | 'clock'
  | 'alert'
  | 'camera'
  | 'document'
  | 'location';

export interface JuryHighlight {
  highlightId: string;
  timestamp: string;
  title: string;
  description: string;
  visualCue: 'pulse' | 'glow' | 'zoom' | 'spotlight' | 'border';
  color: string;
  durationSeconds: number;
  relatedPersonIds: string[];
  relatedLocationIds: string[];
}

export interface NarrativeCard {
  cardId: string;
  order: number;
  title: string;
  bodyText: string;
  imageReference?: string;
  timestamp?: string;
  backgroundColor: string;
  textColor: string;
}

export interface ViewerSettings {
  autoPlay: boolean;
  playbackSpeed: number;
  showTimeline: boolean;
  showAnnotations: boolean;
  showPersonPaths: boolean;
  showDistanceMarkers: boolean;
  enablePauseOnHighlight: boolean;
  theme: 'light' | 'dark' | 'high_contrast';
  fontSize: 'normal' | 'large' | 'extra_large';
}

export interface JuryViewMetadata {
  generatedBy: string;
  version: string;
  simplificationLevel: 'standard' | 'simplified' | 'highly_simplified';
  languageLevel: 'plain' | 'elementary';
  totalCards: number;
  totalHighlights: number;
  estimatedViewingMinutes: number;
}

// ---------------------------------------------------------------------------
// Color palette for jury-friendly display
// ---------------------------------------------------------------------------

const JURY_COLORS = {
  officer: '#2563EB',          // blue
  individual: '#DC2626',       // red
  witness: '#059669',          // green
  bystander: '#6B7280',       // gray
  vehicle_patrol: '#1E40AF',  // dark blue
  vehicle_civilian: '#4B5563', // dark gray
  highlight_critical: '#EF4444',
  highlight_notable: '#F59E0B',
  highlight_routine: '#3B82F6',
  card_background: '#F9FAFB',
  card_text: '#111827',
  annotation: '#374151',
} as const;

// ---------------------------------------------------------------------------
// Core visualization generation
// ---------------------------------------------------------------------------

/**
 * Generate a jury-friendly visualization for a case.
 * Uses plain language, clear visuals, no legal terminology.
 */
export async function generateJuryVisualization(
  caseId: string,
  title: string,
  options?: {
    simplificationLevel?: JuryViewMetadata['simplificationLevel'];
    theme?: ViewerSettings['theme'];
    fontSize?: ViewerSettings['fontSize'];
  },
): Promise<JuryVisualization> {
  const config = {
    simplificationLevel: 'standard' as JuryViewMetadata['simplificationLevel'],
    theme: 'light' as ViewerSettings['theme'],
    fontSize: 'large' as ViewerSettings['fontSize'],
    ...options,
  };

  // Fetch evidence events
  const evidenceEvents = await prisma.evidenceEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });

  // Build scene view
  const sceneView = buildJurySceneView(evidenceEvents);

  // Build timeline
  const timeline = buildJuryTimeline(evidenceEvents, config.simplificationLevel);

  // Build highlights
  const highlights = buildJuryHighlights(evidenceEvents);

  // Build narrative cards
  const narrativeCards = buildNarrativeCards(evidenceEvents, config.simplificationLevel);

  // Viewer settings
  const viewerSettings: ViewerSettings = {
    autoPlay: false,
    playbackSpeed: 1.0,
    showTimeline: true,
    showAnnotations: true,
    showPersonPaths: true,
    showDistanceMarkers: false,
    enablePauseOnHighlight: true,
    theme: config.theme,
    fontSize: config.fontSize,
  };

  // Metadata
  const estimatedMinutes = Math.max(2, Math.ceil(narrativeCards.length * 0.5 + highlights.length * 0.3));
  const metadata: JuryViewMetadata = {
    generatedBy: 'CourtAccess Jury Visualization Engine v1.0',
    version: '1.0.0',
    simplificationLevel: config.simplificationLevel,
    languageLevel: config.simplificationLevel === 'highly_simplified' ? 'elementary' : 'plain',
    totalCards: narrativeCards.length,
    totalHighlights: highlights.length,
    estimatedViewingMinutes: estimatedMinutes,
  };

  return {
    caseId,
    title,
    generatedAt: new Date().toISOString(),
    sceneView,
    timeline,
    highlightedEvents: highlights,
    narrativeCards,
    viewerSettings,
    metadata,
  };
}

/**
 * Store jury visualization in database
 */
export async function storeJuryVisualization(viz: JuryVisualization): Promise<string> {
  const record = await prisma.juryVisualization.create({
    data: {
      caseId: viz.caseId,
      title: viz.title,
      sceneView: JSON.stringify(viz.sceneView),
      timeline: JSON.stringify(viz.timeline),
      highlightedEvents: JSON.stringify(viz.highlightedEvents),
      narrativeCards: JSON.stringify(viz.narrativeCards),
      viewerSettings: JSON.stringify(viz.viewerSettings),
      metadata: JSON.stringify(viz.metadata),
    },
  });
  return record.visualizationId;
}

/**
 * Get jury visualizations for a case
 */
export async function getCaseJuryVisualizations(caseId: string) {
  return prisma.juryVisualization.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Scene view builder
// ---------------------------------------------------------------------------

function buildJurySceneView(
  events: Array<{ eventId: string; timestamp: string; eventType: string; sourceType: string }>,
): JurySceneView {
  const keyLocations: JuryLocation[] = [
    {
      locationId: 'loc-start',
      label: 'Starting Point',
      description: 'Where the event began',
      position: { x: 100, y: 300 },
      iconType: 'flag',
      color: JURY_COLORS.highlight_routine,
    },
    {
      locationId: 'loc-contact',
      label: 'Contact Point',
      description: 'Where contact was made',
      position: { x: 300, y: 250 },
      iconType: 'star',
      color: JURY_COLORS.highlight_critical,
    },
  ];

  // Generate officer path from events
  const bodycamEvents = events.filter(e => e.sourceType === 'bodycam');
  const officerPositions = bodycamEvents.slice(0, 30).map((e, i) => ({
    timestamp: e.timestamp,
    x: 100 + i * 10,
    y: 300 - i * 3,
    label: i === 0 ? 'Start' : undefined,
  }));

  const personPositions: JuryPerson[] = [
    {
      personId: 'officer-1',
      label: 'Officer',
      role: 'officer',
      color: JURY_COLORS.officer,
      positions: officerPositions,
      showPath: true,
    },
    {
      personId: 'individual-1',
      label: 'Individual',
      role: 'individual',
      color: JURY_COLORS.individual,
      positions: [
        { timestamp: '00:00:00', x: 350, y: 250 },
      ],
      showPath: false,
    },
  ];

  const vehiclePositions: JuryVehicle[] = [
    {
      vehicleId: 'vehicle-patrol',
      label: 'Patrol Vehicle',
      vehicleType: 'patrol_car',
      color: JURY_COLORS.vehicle_patrol,
      position: { x: 50, y: 320 },
      rotation: 90,
    },
  ];

  return {
    viewType: 'overhead',
    sceneDescription: 'Overhead view of the incident location showing positions and movements',
    keyLocations,
    personPositions,
    vehiclePositions,
    annotationLabels: [],
    compassDirection: 0,
    scaleBarFeet: 50,
  };
}

// ---------------------------------------------------------------------------
// Timeline builder (jury-friendly)
// ---------------------------------------------------------------------------

function buildJuryTimeline(
  events: Array<{ eventId: string; timestamp: string; eventType: string; description: string | null; sourceType: string; confidence: number }>,
  simplificationLevel: JuryViewMetadata['simplificationLevel'],
): JuryTimeline {
  const entries: JuryTimelineEntry[] = [];

  for (const [idx, event] of events.entries()) {
    const simplified = simplifyEventDescription(event.eventType, event.description, simplificationLevel);
    if (!simplified) continue; // Skip non-significant events in simplified mode

    const icon = getTimelineIcon(event.eventType);
    const isHighlighted = isSignificantEvent(event.eventType);
    const color = isHighlighted ? JURY_COLORS.highlight_critical : JURY_COLORS.highlight_routine;

    entries.push({
      entryId: `jury-entry-${idx + 1}`,
      timeLabel: formatTimeForJury(event.timestamp),
      description: simplified,
      icon,
      color,
      isHighlighted,
    });
  }

  const startLabel = events.length > 0 ? formatTimeForJury(events[0].timestamp) : 'Start';
  const endLabel = events.length > 0 ? formatTimeForJury(events[events.length - 1].timestamp) : 'End';

  return {
    startLabel,
    endLabel,
    totalDurationLabel: calculateDurationLabel(events),
    entries,
  };
}

// ---------------------------------------------------------------------------
// Highlight builder
// ---------------------------------------------------------------------------

function buildJuryHighlights(
  events: Array<{ eventId: string; timestamp: string; eventType: string; description: string | null; confidence: number }>,
): JuryHighlight[] {
  const highlights: JuryHighlight[] = [];
  let counter = 0;

  for (const event of events) {
    if (!isSignificantEvent(event.eventType)) continue;

    counter++;
    highlights.push({
      highlightId: `highlight-${counter}`,
      timestamp: event.timestamp,
      title: simplifyEventType(event.eventType),
      description: event.description
        ? simplifyText(event.description)
        : simplifyEventType(event.eventType),
      visualCue: event.confidence > 0.8 ? 'spotlight' : 'glow',
      color: JURY_COLORS.highlight_critical,
      durationSeconds: 3,
      relatedPersonIds: ['officer-1'],
      relatedLocationIds: [],
    });
  }

  return highlights;
}

// ---------------------------------------------------------------------------
// Narrative card builder
// ---------------------------------------------------------------------------

function buildNarrativeCards(
  events: Array<{ eventId: string; timestamp: string; eventType: string; description: string | null }>,
  simplificationLevel: JuryViewMetadata['simplificationLevel'],
): NarrativeCard[] {
  const cards: NarrativeCard[] = [];

  // Opening card
  cards.push({
    cardId: 'card-intro',
    order: 0,
    title: 'What Happened',
    bodyText: 'This presentation shows the sequence of events based on available camera footage and other evidence. Each event is shown in the order it occurred.',
    backgroundColor: JURY_COLORS.card_background,
    textColor: JURY_COLORS.card_text,
  });

  // Event cards — group by significant moments
  let cardOrder = 1;
  const significantEvents = events.filter(e => isSignificantEvent(e.eventType));

  for (const event of significantEvents) {
    const simplified = simplifyEventDescription(event.eventType, event.description, simplificationLevel);
    if (!simplified) continue;

    cards.push({
      cardId: `card-event-${cardOrder}`,
      order: cardOrder,
      title: `At ${formatTimeForJury(event.timestamp)}`,
      bodyText: simplified,
      timestamp: event.timestamp,
      backgroundColor: JURY_COLORS.card_background,
      textColor: JURY_COLORS.card_text,
    });
    cardOrder++;
  }

  // Closing card
  cards.push({
    cardId: 'card-conclusion',
    order: cardOrder,
    title: 'End of Sequence',
    bodyText: 'This concludes the visual presentation of the event sequence.',
    backgroundColor: JURY_COLORS.card_background,
    textColor: JURY_COLORS.card_text,
  });

  return cards;
}

// ---------------------------------------------------------------------------
// Simplification helpers — plain language, no legal terminology
// ---------------------------------------------------------------------------

function simplifyEventType(eventType: string): string {
  const simplifications: Record<string, string> = {
    physical_restraint: 'Physical Contact',
    weapon_deployment: 'Weapon Drawn',
    physical_strike: 'Physical Strike',
    handcuffing: 'Handcuffing',
    vehicle_search: 'Vehicle Search',
    officer_proximity: 'Officer Approached',
    neck_restraint: 'Neck Contact',
    prone_restraint: 'Person Held on Ground',
    k9_deployment: 'Police Dog Used',
    taser_deployed: 'Taser Used',
    firearm_drawn: 'Firearm Drawn',
    verbal_command: 'Verbal Command Given',
    suspect_restrained: 'Person Restrained',
    officer_posture: 'Officer Position Changed',
    hand_movement: 'Hand Movement',
    subject_distance: 'Distance Changed',
    suspect_position: 'Person Position',
    restraint_technique: 'Restraint Applied',
    de_escalation_posture: 'Calming Gesture',
    crowd_formation: 'Group Movement',
    vehicle_interaction: 'Vehicle Activity',
  };

  return simplifications[eventType] ?? eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function simplifyEventDescription(
  eventType: string,
  description: string | null,
  level: JuryViewMetadata['simplificationLevel'],
): string | null {
  // Filter out routine events in simplified modes
  if (level !== 'standard' && !isSignificantEvent(eventType)) return null;

  const base = description
    ? simplifyText(description)
    : simplifyEventType(eventType);

  return base;
}

function simplifyText(text: string): string {
  // Remove legal and technical jargon
  return text
    .replace(/potential policy inconsistency/gi, 'notable action')
    .replace(/compliance finding/gi, 'observation')
    .replace(/evidence event/gi, 'event')
    .replace(/bodycam footage/gi, 'camera footage')
    .replace(/subject/gi, 'individual')
    .replace(/suspect/gi, 'individual')
    .replace(/deployment/gi, 'use')
    .replace(/pursuant to/gi, 'according to')
    .replace(/utilize/gi, 'use')
    .replace(/initiate/gi, 'start')
    .replace(/terminate/gi, 'end')
    .replace(/\b(?:thereof|therein|herein|aforementioned)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isSignificantEvent(eventType: string): boolean {
  const significantTypes = [
    'physical_restraint', 'weapon_deployment', 'physical_strike',
    'handcuffing', 'neck_restraint', 'prone_restraint', 'k9_deployment',
    'taser_deployed', 'firearm_drawn', 'suspect_restrained',
    'restraint_technique', 'physical_contact',
  ];
  return significantTypes.includes(eventType);
}

function getTimelineIcon(eventType: string): TimelineIcon {
  const iconMap: Record<string, TimelineIcon> = {
    physical_restraint: 'hand',
    weapon_deployment: 'alert',
    physical_strike: 'alert',
    handcuffing: 'hand',
    vehicle_search: 'car',
    officer_proximity: 'person_walking',
    verbal_command: 'speech_bubble',
    vehicle_interaction: 'car',
    officer_posture: 'person_walking',
    suspect_position: 'person_walking',
  };
  return iconMap[eventType] ?? 'clock';
}

function formatTimeForJury(timestamp: string): string {
  const parts = timestamp.split(':');
  if (parts.length === 3) {
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    if (parseInt(parts[0], 10) === 0) {
      return `${minutes} min ${seconds} sec`;
    }
    return `${parts[0]}:${parts[1]}:${parts[2]}`;
  }
  return timestamp;
}

function calculateDurationLabel(
  events: Array<{ timestamp: string }>,
): string {
  if (events.length < 2) return 'Brief';

  const first = events[0].timestamp.split(':').map(Number);
  const last = events[events.length - 1].timestamp.split(':').map(Number);

  const startSec = (first[0] ?? 0) * 3600 + (first[1] ?? 0) * 60 + (first[2] ?? 0);
  const endSec = (last[0] ?? 0) * 3600 + (last[1] ?? 0) * 60 + (last[2] ?? 0);
  const totalSec = endSec - startSec;

  if (totalSec < 60) return `${totalSec} seconds`;
  if (totalSec < 3600) return `${Math.floor(totalSec / 60)} minutes ${totalSec % 60} seconds`;
  return `${Math.floor(totalSec / 3600)} hours ${Math.floor((totalSec % 3600) / 60)} minutes`;
}
