// ---------------------------------------------------------------------------
// Phase 2 — Population Ranking Engine
// Ranks agencies by jurisdiction population (descending).
// State agencies get highest priority (rank 0).
// ---------------------------------------------------------------------------

import {
  CALIFORNIA_CITY_POPULATIONS,
  CALIFORNIA_COUNTY_POPULATIONS,
  CITY_TO_COUNTY,
} from '../data/californiaPopulations.js';

export interface RankResult {
  populationEstimate: number | null;
  jurisdictionRank: number;
  county: string | null;
}

/**
 * Estimate population for an agency based on its type, city, and county.
 */
export function estimatePopulation(
  agencyType: string | null,
  city: string | null,
  county: string | null
): number | null {
  if (!agencyType) return null;

  const type = agencyType.toLowerCase();

  // State agencies — highest population proxy
  if (type === 'state') return 40_000_000; // All of California

  // Sheriff / DA / Coroner — use county population
  if (
    type === 'sheriff' ||
    type === 'district_attorney' ||
    type === 'coroner' ||
    type === 'probation'
  ) {
    if (county) {
      return CALIFORNIA_COUNTY_POPULATIONS[county.toLowerCase()] ?? null;
    }
    return null;
  }

  // City police — use city population
  if (
    type === 'police' ||
    type === 'park_ranger' ||
    type === 'communications'
  ) {
    if (city) {
      return CALIFORNIA_CITY_POPULATIONS[city.toLowerCase()] ?? null;
    }
    return null;
  }

  // University / College — use a default mid-range population
  if (type === 'university' || type === 'community_college') {
    return 30_000; // Average campus population
  }

  // School district — use city population if available
  if (type === 'school_district') {
    if (city) {
      return CALIFORNIA_CITY_POPULATIONS[city.toLowerCase()] ?? 20_000;
    }
    return 20_000;
  }

  // Transit — regional, mid-range
  if (type === 'transit') return 500_000;

  // Airport — regional
  if (type === 'airport') return 200_000;

  // Harbor — smaller
  if (type === 'harbor') return 100_000;

  return null;
}

/**
 * Infer county from city name using the CITY_TO_COUNTY mapping.
 */
export function inferCountyFromCity(city: string | null): string | null {
  if (!city) return null;
  return CITY_TO_COUNTY[city.toLowerCase()] ?? null;
}

/**
 * Rank a list of agencies by population (descending).
 * Returns a map of agencyName → { populationEstimate, jurisdictionRank, county }
 */
export function rankAgencies(
  agencies: Array<{
    agencyName: string;
    agencyType: string | null;
    city: string | null;
    county: string | null;
  }>
): Map<string, RankResult> {
  // Calculate populations and fill in missing counties
  const withPopulation = agencies.map((a) => {
    const county = a.county || inferCountyFromCity(a.city);
    const pop = estimatePopulation(a.agencyType, a.city, county);
    return { ...a, county, populationEstimate: pop };
  });

  // Sort by population descending (nulls last)
  const sorted = [...withPopulation].sort((a, b) => {
    const popA = a.populationEstimate ?? -1;
    const popB = b.populationEstimate ?? -1;
    return popB - popA;
  });

  // Assign ranks
  const results = new Map<string, RankResult>();
  sorted.forEach((agency, index) => {
    results.set(agency.agencyName, {
      populationEstimate: agency.populationEstimate,
      jurisdictionRank: index + 1,
      county: agency.county,
    });
  });

  return results;
}
