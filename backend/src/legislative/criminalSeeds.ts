// ============================================================================
// Criminal Liability Discovery — Seed Registry (Program 68A)
// High-criminality California statute sections, curated by code. The Criminal
// Liability Discovery Engine acquires THESE FIRST (targeted), instead of
// sequentially crawling millions of administrative sections.
//
// Seeds are starting points only — cross-reference expansion (Phase 3) grows
// coverage outward from each confirmed criminal statute. Nothing here asserts
// criminal liability; the classifier scores each acquired section from its text.
// ============================================================================

export interface CodeSeeds {
  code: string;
  codeName: string;
  sections: string[];
}

export const CRIMINAL_SEEDS: Record<string, CodeSeeds> = {
  VEH: {
    code: 'VEH',
    codeName: 'Vehicle Code',
    // DUI, evading, driving on suspended license, hit-and-run, vehicle theft
    sections: ['23152', '23153', '23103', '2800.1', '2800.2', '2800.3', '14601', '14601.1', '14601.2', '20001', '20002', '10851', '2800', '23140', '23103.5'],
  },
  HSC: {
    code: 'HSC',
    codeName: 'Health and Safety Code',
    // Controlled substances offenses
    sections: ['11350', '11351', '11351.5', '11352', '11357', '11358', '11359', '11360', '11361', '11364', '11364.5', '11365', '11366', '11370.1', '11377', '11378', '11379', '11550'],
  },
  BPC: {
    code: 'BPC',
    codeName: 'Business and Professions Code',
    // Alcohol/minor offenses, unlicensed practice
    sections: ['25658', '25661', '25662', '25663', '25665', '4324', '2052', '7028'],
  },
  PEN: {
    code: 'PEN',
    codeName: 'Penal Code',
    // Core offenses (already broadly ingested; seeds for cross-ref completeness)
    sections: ['187', '211', '215', '245', '459', '470', '484', '487', '496', '667', '25400', '29800'],
  },
  WIC: {
    code: 'WIC',
    codeName: 'Welfare and Institutions Code',
    sections: ['602', '871', '10980', '11482', '14107'],
  },
  FGC: {
    code: 'FGC',
    codeName: 'Fish and Game Code',
    // Unlawful take of wildlife, pollution of waters, penalties
    sections: ['2000', '2001', '2002', '5650', '5652', '12000', '12002', '1602'],
  },
  LAB: {
    code: 'LAB',
    codeName: 'Labor Code',
    // Failure to secure workers' comp, willful safety violations, wage crimes
    sections: ['3700.5', '6425', '1199', '553', '227'],
  },
  PRC: {
    code: 'PRC',
    codeName: 'Public Resources Code',
    // Fire/defensible space, waste, coastal violations
    sections: ['4291', '4421', '4422', '42400', '30820'],
  },
  GOV: {
    code: 'GOV',
    codeName: 'Government Code',
    // Conflict of interest, destruction of public records, misuse of office
    sections: ['1097', '6200', '6201', '8314', '1090'],
  },
};

/** All seeds flattened as {code, section} pairs. */
export function allCriminalSeeds(): Array<{ code: string; section: string; codeName: string }> {
  const out: Array<{ code: string; section: string; codeName: string }> = [];
  for (const entry of Object.values(CRIMINAL_SEEDS)) {
    for (const section of entry.sections) {
      out.push({ code: entry.code, section, codeName: entry.codeName });
    }
  }
  return out;
}
