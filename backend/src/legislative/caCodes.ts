// ============================================================================
// California Code registry — authoritative abbreviations from leginfo
// ============================================================================

import type { CaliforniaCode } from './types.ts';

export const LEGINFO_BASE_URL = 'https://leginfo.legislature.ca.gov';

export const CALIFORNIA_CODES: CaliforniaCode[] = [
  { abbrev: 'BPC', name: 'Business and Professions Code', criminalPriority: true },
  { abbrev: 'CCP', name: 'Code of Civil Procedure', criminalPriority: false },
  { abbrev: 'CIV', name: 'Civil Code', criminalPriority: false },
  { abbrev: 'COM', name: 'Commercial Code', criminalPriority: false },
  { abbrev: 'CONS', name: 'Constitution', criminalPriority: false },
  { abbrev: 'CORP', name: 'Corporations Code', criminalPriority: false },
  { abbrev: 'EDC', name: 'Education Code', criminalPriority: false },
  { abbrev: 'ELEC', name: 'Elections Code', criminalPriority: false },
  { abbrev: 'EVID', name: 'Evidence Code', criminalPriority: true },
  { abbrev: 'FAC', name: 'Food and Agricultural Code', criminalPriority: false },
  { abbrev: 'FAM', name: 'Family Code', criminalPriority: false },
  { abbrev: 'FGC', name: 'Fish and Game Code', criminalPriority: false },
  { abbrev: 'FIN', name: 'Financial Code', criminalPriority: false },
  { abbrev: 'GOV', name: 'Government Code', criminalPriority: false },
  { abbrev: 'HNC', name: 'Harbors and Navigation Code', criminalPriority: false },
  { abbrev: 'HSC', name: 'Health and Safety Code', criminalPriority: true },
  { abbrev: 'INS', name: 'Insurance Code', criminalPriority: false },
  { abbrev: 'LAB', name: 'Labor Code', criminalPriority: false },
  { abbrev: 'MVC', name: 'Military and Veterans Code', criminalPriority: false },
  { abbrev: 'PCC', name: 'Public Contract Code', criminalPriority: false },
  { abbrev: 'PEN', name: 'Penal Code', criminalPriority: true },
  { abbrev: 'PRC', name: 'Public Resources Code', criminalPriority: false },
  { abbrev: 'PROB', name: 'Probate Code', criminalPriority: false },
  { abbrev: 'PUC', name: 'Public Utilities Code', criminalPriority: false },
  { abbrev: 'RTC', name: 'Revenue and Taxation Code', criminalPriority: false },
  { abbrev: 'SHC', name: 'Streets and Highways Code', criminalPriority: false },
  { abbrev: 'UIC', name: 'Unemployment Insurance Code', criminalPriority: false },
  { abbrev: 'VEH', name: 'Vehicle Code', criminalPriority: true },
  { abbrev: 'WAT', name: 'Water Code', criminalPriority: false },
  { abbrev: 'WIC', name: 'Welfare and Institutions Code', criminalPriority: false },
];

export function getCaliforniaCode(abbrev: string): CaliforniaCode | undefined {
  return CALIFORNIA_CODES.find((c) => c.abbrev === abbrev.toUpperCase());
}

export function getCriminalPriorityCodes(): CaliforniaCode[] {
  return CALIFORNIA_CODES.filter((c) => c.criminalPriority);
}
