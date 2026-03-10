// ============================================================================
// Phase 56 — Scene Object Library
// Low-poly 3D object definitions for courtroom exhibits.
// All objects are defined as geometry parameters for Three.js rendering.
// ============================================================================

export interface ObjectDefinition {
  id: string;
  name: string;
  category: 'vegetation' | 'vehicle' | 'person' | 'infrastructure' | 'evidence';
  description: string;
  defaultScale: number;
  polyCount: number;
  color: number;
  variants?: ObjectVariant[];
}

export interface ObjectVariant {
  id: string;
  name: string;
  color: number;
  scaleModifier: number;
}

// ---------------------------------------------------------------------------
// Object Definitions
// ---------------------------------------------------------------------------

export const OBJECT_LIBRARY: ObjectDefinition[] = [
  // Vegetation
  {
    id: 'tree_deciduous',
    name: 'Deciduous Tree',
    category: 'vegetation',
    description: 'Standard deciduous tree with round canopy',
    defaultScale: 1.0,
    polyCount: 24,
    color: 0x2d8a2d,
    variants: [
      { id: 'tree_small', name: 'Small Tree', color: 0x3a9a3a, scaleModifier: 0.6 },
      { id: 'tree_large', name: 'Large Tree', color: 0x1a6a1a, scaleModifier: 1.5 },
      { id: 'tree_palm', name: 'Palm Tree', color: 0x4aaa4a, scaleModifier: 1.2 },
    ],
  },
  {
    id: 'bush_round',
    name: 'Round Bush',
    category: 'vegetation',
    description: 'Low round bush for landscaping',
    defaultScale: 1.0,
    polyCount: 12,
    color: 0x3a7a3a,
    variants: [
      { id: 'bush_small', name: 'Small Bush', color: 0x4a8a4a, scaleModifier: 0.5 },
      { id: 'hedge', name: 'Hedge', color: 0x2a6a2a, scaleModifier: 1.0 },
    ],
  },

  // Vehicles
  {
    id: 'car_sedan',
    name: 'Sedan',
    category: 'vehicle',
    description: 'Standard four-door sedan',
    defaultScale: 1.0,
    polyCount: 36,
    color: 0xcc3333,
    variants: [
      { id: 'car_red', name: 'Red Sedan', color: 0xcc3333, scaleModifier: 1.0 },
      { id: 'car_blue', name: 'Blue Sedan', color: 0x3333cc, scaleModifier: 1.0 },
      { id: 'car_white', name: 'White Sedan', color: 0xeeeeee, scaleModifier: 1.0 },
      { id: 'car_black', name: 'Black Sedan', color: 0x222222, scaleModifier: 1.0 },
      { id: 'car_silver', name: 'Silver Sedan', color: 0x999999, scaleModifier: 1.0 },
    ],
  },
  {
    id: 'car_suv',
    name: 'SUV',
    category: 'vehicle',
    description: 'Sport utility vehicle',
    defaultScale: 1.15,
    polyCount: 40,
    color: 0x444444,
  },
  {
    id: 'car_truck',
    name: 'Pickup Truck',
    category: 'vehicle',
    description: 'Standard pickup truck',
    defaultScale: 1.2,
    polyCount: 42,
    color: 0x886633,
  },
  {
    id: 'police_cruiser',
    name: 'Police Cruiser',
    category: 'vehicle',
    description: 'Police patrol vehicle with light bar',
    defaultScale: 1.0,
    polyCount: 48,
    color: 0x1a1a6c,
  },
  {
    id: 'police_suv',
    name: 'Police SUV',
    category: 'vehicle',
    description: 'Police SUV with light bar and markings',
    defaultScale: 1.15,
    polyCount: 52,
    color: 0x1a1a6c,
  },
  {
    id: 'ambulance',
    name: 'Ambulance',
    category: 'vehicle',
    description: 'Emergency medical vehicle',
    defaultScale: 1.3,
    polyCount: 44,
    color: 0xffffff,
  },
  {
    id: 'fire_truck',
    name: 'Fire Truck',
    category: 'vehicle',
    description: 'Fire engine',
    defaultScale: 1.5,
    polyCount: 50,
    color: 0xcc0000,
  },

  // People
  {
    id: 'person_standing',
    name: 'Standing Person',
    category: 'person',
    description: 'Standing human figure',
    defaultScale: 1.0,
    polyCount: 20,
    color: 0xffcc88,
    variants: [
      { id: 'person_blue', name: 'Blue Shirt', color: 0x4466aa, scaleModifier: 1.0 },
      { id: 'person_red', name: 'Red Shirt', color: 0xaa4444, scaleModifier: 1.0 },
      { id: 'person_dark', name: 'Dark Clothing', color: 0x333333, scaleModifier: 1.0 },
    ],
  },
  {
    id: 'officer',
    name: 'Police Officer',
    category: 'person',
    description: 'Police officer figure in uniform',
    defaultScale: 1.0,
    polyCount: 24,
    color: 0x1a1a4c,
  },

  // Infrastructure
  {
    id: 'streetlight',
    name: 'Streetlight',
    category: 'infrastructure',
    description: 'Standard streetlight with overhead lamp',
    defaultScale: 1.0,
    polyCount: 16,
    color: 0x888888,
  },
  {
    id: 'stop_sign',
    name: 'Stop Sign',
    category: 'infrastructure',
    description: 'Octagonal stop sign on post',
    defaultScale: 1.0,
    polyCount: 12,
    color: 0xcc0000,
  },
  {
    id: 'fire_hydrant',
    name: 'Fire Hydrant',
    category: 'infrastructure',
    description: 'Standard fire hydrant',
    defaultScale: 1.0,
    polyCount: 16,
    color: 0xcc0000,
  },
  {
    id: 'barrier',
    name: 'Police Barrier',
    category: 'infrastructure',
    description: 'Police line barrier / barricade',
    defaultScale: 1.0,
    polyCount: 8,
    color: 0xff8800,
  },

  // Evidence markers
  {
    id: 'evidence_pin',
    name: 'Evidence Pin',
    category: 'evidence',
    description: 'Pin marker for evidence location',
    defaultScale: 1.0,
    polyCount: 16,
    color: 0xff0000,
  },
  {
    id: 'evidence_number',
    name: 'Number Marker',
    category: 'evidence',
    description: 'Numbered evidence marker (like crime scene markers)',
    defaultScale: 1.0,
    polyCount: 12,
    color: 0xffcc00,
  },
  {
    id: 'evidence_icon',
    name: 'Evidence Icon',
    category: 'evidence',
    description: 'Diamond-shaped evidence icon',
    defaultScale: 1.0,
    polyCount: 8,
    color: 0xff4444,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getObjectById(id: string): ObjectDefinition | undefined {
  return OBJECT_LIBRARY.find((obj) => obj.id === id);
}

export function getObjectsByCategory(category: ObjectDefinition['category']): ObjectDefinition[] {
  return OBJECT_LIBRARY.filter((obj) => obj.category === category);
}

export function getAllCategories(): ObjectDefinition['category'][] {
  return [...new Set(OBJECT_LIBRARY.map((obj) => obj.category))];
}
