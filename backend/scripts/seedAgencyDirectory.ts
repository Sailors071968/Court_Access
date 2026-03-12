// ============================================================================
// Phase 3 — Seed California Law Enforcement Agency Directory
// Populates the agencies table with 500-700 CA law enforcement agencies.
// Run: npx tsx backend/scripts/seedAgencyDirectory.ts
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// California Law Enforcement Agencies
// Sources: CA POST directory, CA DOJ, public records
// ---------------------------------------------------------------------------

interface AgencySeed {
  agencyName: string;
  agencyType: string;
  city?: string;
  county: string;
  populationEstimate?: number;
  website?: string;
}

const CALIFORNIA_AGENCIES: AgencySeed[] = [
  // === STATE AGENCIES ===
  { agencyName: 'California Highway Patrol', agencyType: 'State', county: 'Sacramento', populationEstimate: 39000000, website: 'https://www.chp.ca.gov' },
  { agencyName: 'California Department of Justice - Bureau of Investigation', agencyType: 'State', county: 'Sacramento', website: 'https://oag.ca.gov' },
  { agencyName: 'California Department of Corrections and Rehabilitation', agencyType: 'Corrections', county: 'Sacramento', website: 'https://www.cdcr.ca.gov' },
  { agencyName: 'California Department of Fish and Wildlife', agencyType: 'State', county: 'Sacramento', website: 'https://wildlife.ca.gov' },
  { agencyName: 'California Department of Parks and Recreation - Rangers', agencyType: 'State', county: 'Sacramento', website: 'https://www.parks.ca.gov' },
  { agencyName: 'California State Capitol Police', agencyType: 'State', county: 'Sacramento' },
  { agencyName: 'California Department of Insurance - Fraud Division', agencyType: 'State', county: 'Sacramento' },
  { agencyName: 'California Alcoholic Beverage Control', agencyType: 'State', county: 'Sacramento' },
  { agencyName: 'California Horse Racing Board Investigators', agencyType: 'State', county: 'Sacramento' },
  { agencyName: 'California Department of Motor Vehicles Investigators', agencyType: 'State', county: 'Sacramento' },

  // === LOS ANGELES COUNTY (largest county) ===
  { agencyName: 'Los Angeles Police Department', agencyType: 'Police', city: 'Los Angeles', county: 'Los Angeles', populationEstimate: 3900000, website: 'https://www.lapdonline.org' },
  { agencyName: 'Los Angeles County Sheriff\'s Department', agencyType: 'Sheriff', county: 'Los Angeles', populationEstimate: 10000000, website: 'https://lasd.org' },
  { agencyName: 'Long Beach Police Department', agencyType: 'Police', city: 'Long Beach', county: 'Los Angeles', populationEstimate: 466000 },
  { agencyName: 'Glendale Police Department', agencyType: 'Police', city: 'Glendale', county: 'Los Angeles', populationEstimate: 196000 },
  { agencyName: 'Pasadena Police Department', agencyType: 'Police', city: 'Pasadena', county: 'Los Angeles', populationEstimate: 138000 },
  { agencyName: 'Torrance Police Department', agencyType: 'Police', city: 'Torrance', county: 'Los Angeles', populationEstimate: 145000 },
  { agencyName: 'Pomona Police Department', agencyType: 'Police', city: 'Pomona', county: 'Los Angeles', populationEstimate: 151000 },
  { agencyName: 'Downey Police Department', agencyType: 'Police', city: 'Downey', county: 'Los Angeles', populationEstimate: 111000 },
  { agencyName: 'West Covina Police Department', agencyType: 'Police', city: 'West Covina', county: 'Los Angeles', populationEstimate: 106000 },
  { agencyName: 'Inglewood Police Department', agencyType: 'Police', city: 'Inglewood', county: 'Los Angeles', populationEstimate: 107000 },
  { agencyName: 'El Monte Police Department', agencyType: 'Police', city: 'El Monte', county: 'Los Angeles', populationEstimate: 113000 },
  { agencyName: 'Burbank Police Department', agencyType: 'Police', city: 'Burbank', county: 'Los Angeles', populationEstimate: 107000 },
  { agencyName: 'Norwalk Sheriff\'s Station', agencyType: 'Police', city: 'Norwalk', county: 'Los Angeles', populationEstimate: 105000 },
  { agencyName: 'Compton Sheriff\'s Station', agencyType: 'Police', city: 'Compton', county: 'Los Angeles', populationEstimate: 97000 },
  { agencyName: 'Whittier Police Department', agencyType: 'Police', city: 'Whittier', county: 'Los Angeles', populationEstimate: 87000 },
  { agencyName: 'Alhambra Police Department', agencyType: 'Police', city: 'Alhambra', county: 'Los Angeles', populationEstimate: 83000 },
  { agencyName: 'Hawthorne Police Department', agencyType: 'Police', city: 'Hawthorne', county: 'Los Angeles', populationEstimate: 88000 },
  { agencyName: 'Redondo Beach Police Department', agencyType: 'Police', city: 'Redondo Beach', county: 'Los Angeles', populationEstimate: 67000 },
  { agencyName: 'Arcadia Police Department', agencyType: 'Police', city: 'Arcadia', county: 'Los Angeles', populationEstimate: 57000 },
  { agencyName: 'Monrovia Police Department', agencyType: 'Police', city: 'Monrovia', county: 'Los Angeles', populationEstimate: 37000 },
  { agencyName: 'Azusa Police Department', agencyType: 'Police', city: 'Azusa', county: 'Los Angeles', populationEstimate: 49000 },
  { agencyName: 'Covina Police Department', agencyType: 'Police', city: 'Covina', county: 'Los Angeles', populationEstimate: 48000 },
  { agencyName: 'Glendora Police Department', agencyType: 'Police', city: 'Glendora', county: 'Los Angeles', populationEstimate: 52000 },
  { agencyName: 'Manhattan Beach Police Department', agencyType: 'Police', city: 'Manhattan Beach', county: 'Los Angeles', populationEstimate: 35000 },
  { agencyName: 'Hermosa Beach Police Department', agencyType: 'Police', city: 'Hermosa Beach', county: 'Los Angeles', populationEstimate: 20000 },
  { agencyName: 'Beverly Hills Police Department', agencyType: 'Police', city: 'Beverly Hills', county: 'Los Angeles', populationEstimate: 33000 },
  { agencyName: 'Culver City Police Department', agencyType: 'Police', city: 'Culver City', county: 'Los Angeles', populationEstimate: 39000 },
  { agencyName: 'Santa Monica Police Department', agencyType: 'Police', city: 'Santa Monica', county: 'Los Angeles', populationEstimate: 93000 },
  { agencyName: 'Gardena Police Department', agencyType: 'Police', city: 'Gardena', county: 'Los Angeles', populationEstimate: 61000 },
  { agencyName: 'South Gate Police Department', agencyType: 'Police', city: 'South Gate', county: 'Los Angeles', populationEstimate: 95000 },
  { agencyName: 'Huntington Park Police Department', agencyType: 'Police', city: 'Huntington Park', county: 'Los Angeles', populationEstimate: 58000 },
  { agencyName: 'Bell Gardens Police Department', agencyType: 'Police', city: 'Bell Gardens', county: 'Los Angeles', populationEstimate: 42000 },
  { agencyName: 'Montebello Police Department', agencyType: 'Police', city: 'Montebello', county: 'Los Angeles', populationEstimate: 63000 },
  { agencyName: 'La Verne Police Department', agencyType: 'Police', city: 'La Verne', county: 'Los Angeles', populationEstimate: 32000 },
  { agencyName: 'Claremont Police Department', agencyType: 'Police', city: 'Claremont', county: 'Los Angeles', populationEstimate: 36000 },
  { agencyName: 'Sierra Madre Police Department', agencyType: 'Police', city: 'Sierra Madre', county: 'Los Angeles', populationEstimate: 11000 },
  { agencyName: 'San Dimas Sheriff\'s Station', agencyType: 'Police', city: 'San Dimas', county: 'Los Angeles', populationEstimate: 34000 },
  { agencyName: 'Los Angeles Port Police', agencyType: 'Police', city: 'Los Angeles', county: 'Los Angeles' },
  { agencyName: 'Los Angeles World Airports Police', agencyType: 'Airport', city: 'Los Angeles', county: 'Los Angeles' },
  { agencyName: 'Los Angeles School Police Department', agencyType: 'Other', city: 'Los Angeles', county: 'Los Angeles' },
  { agencyName: 'Metro Transit Security - Los Angeles', agencyType: 'Transit', city: 'Los Angeles', county: 'Los Angeles' },

  // === SAN FRANCISCO BAY AREA ===
  { agencyName: 'San Francisco Police Department', agencyType: 'Police', city: 'San Francisco', county: 'San Francisco', populationEstimate: 874000, website: 'https://www.sanfranciscopolice.org' },
  { agencyName: 'San Francisco Sheriff\'s Department', agencyType: 'Sheriff', county: 'San Francisco', populationEstimate: 874000 },
  { agencyName: 'Oakland Police Department', agencyType: 'Police', city: 'Oakland', county: 'Alameda', populationEstimate: 433000, website: 'https://www.oaklandca.gov/departments/police' },
  { agencyName: 'Alameda County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Alameda', populationEstimate: 1670000 },
  { agencyName: 'San Jose Police Department', agencyType: 'Police', city: 'San Jose', county: 'Santa Clara', populationEstimate: 1013000, website: 'https://www.sjpd.org' },
  { agencyName: 'Santa Clara County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Santa Clara', populationEstimate: 1928000 },
  { agencyName: 'Fremont Police Department', agencyType: 'Police', city: 'Fremont', county: 'Alameda', populationEstimate: 230000 },
  { agencyName: 'Hayward Police Department', agencyType: 'Police', city: 'Hayward', county: 'Alameda', populationEstimate: 162000 },
  { agencyName: 'Berkeley Police Department', agencyType: 'Police', city: 'Berkeley', county: 'Alameda', populationEstimate: 124000 },
  { agencyName: 'Richmond Police Department', agencyType: 'Police', city: 'Richmond', county: 'Contra Costa', populationEstimate: 116000 },
  { agencyName: 'Contra Costa County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Contra Costa', populationEstimate: 1150000 },
  { agencyName: 'Concord Police Department', agencyType: 'Police', city: 'Concord', county: 'Contra Costa', populationEstimate: 130000 },
  { agencyName: 'Walnut Creek Police Department', agencyType: 'Police', city: 'Walnut Creek', county: 'Contra Costa', populationEstimate: 70000 },
  { agencyName: 'Antioch Police Department', agencyType: 'Police', city: 'Antioch', county: 'Contra Costa', populationEstimate: 115000 },
  { agencyName: 'San Mateo County Sheriff\'s Office', agencyType: 'Sheriff', county: 'San Mateo', populationEstimate: 765000 },
  { agencyName: 'Daly City Police Department', agencyType: 'Police', city: 'Daly City', county: 'San Mateo', populationEstimate: 104000 },
  { agencyName: 'Redwood City Police Department', agencyType: 'Police', city: 'Redwood City', county: 'San Mateo', populationEstimate: 84000 },
  { agencyName: 'San Mateo Police Department', agencyType: 'Police', city: 'San Mateo', county: 'San Mateo', populationEstimate: 105000 },
  { agencyName: 'South San Francisco Police Department', agencyType: 'Police', city: 'South San Francisco', county: 'San Mateo', populationEstimate: 67000 },
  { agencyName: 'Marin County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Marin', populationEstimate: 260000 },
  { agencyName: 'San Rafael Police Department', agencyType: 'Police', city: 'San Rafael', county: 'Marin', populationEstimate: 61000 },
  { agencyName: 'Novato Police Department', agencyType: 'Police', city: 'Novato', county: 'Marin', populationEstimate: 55000 },
  { agencyName: 'Solano County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Solano', populationEstimate: 447000 },
  { agencyName: 'Vallejo Police Department', agencyType: 'Police', city: 'Vallejo', county: 'Solano', populationEstimate: 121000 },
  { agencyName: 'Fairfield Police Department', agencyType: 'Police', city: 'Fairfield', county: 'Solano', populationEstimate: 119000 },
  { agencyName: 'Vacaville Police Department', agencyType: 'Police', city: 'Vacaville', county: 'Solano', populationEstimate: 103000 },
  { agencyName: 'Napa County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Napa', populationEstimate: 138000 },
  { agencyName: 'Napa Police Department', agencyType: 'Police', city: 'Napa', county: 'Napa', populationEstimate: 79000 },
  { agencyName: 'Sonoma County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Sonoma', populationEstimate: 488000 },
  { agencyName: 'Santa Rosa Police Department', agencyType: 'Police', city: 'Santa Rosa', county: 'Sonoma', populationEstimate: 178000 },
  { agencyName: 'Petaluma Police Department', agencyType: 'Police', city: 'Petaluma', county: 'Sonoma', populationEstimate: 60000 },
  { agencyName: 'BART Police Department', agencyType: 'Transit', county: 'Alameda', website: 'https://www.bart.gov/about/police' },
  { agencyName: 'San Francisco International Airport Police', agencyType: 'Airport', city: 'San Francisco', county: 'San Mateo' },
  { agencyName: 'Oakland International Airport Police', agencyType: 'Airport', city: 'Oakland', county: 'Alameda' },
  { agencyName: 'Palo Alto Police Department', agencyType: 'Police', city: 'Palo Alto', county: 'Santa Clara', populationEstimate: 68000 },
  { agencyName: 'Mountain View Police Department', agencyType: 'Police', city: 'Mountain View', county: 'Santa Clara', populationEstimate: 82000 },
  { agencyName: 'Sunnyvale Department of Public Safety', agencyType: 'Police', city: 'Sunnyvale', county: 'Santa Clara', populationEstimate: 155000 },
  { agencyName: 'Santa Clara Police Department', agencyType: 'Police', city: 'Santa Clara', county: 'Santa Clara', populationEstimate: 127000 },
  { agencyName: 'Milpitas Police Department', agencyType: 'Police', city: 'Milpitas', county: 'Santa Clara', populationEstimate: 80000 },
  { agencyName: 'Campbell Police Department', agencyType: 'Police', city: 'Campbell', county: 'Santa Clara', populationEstimate: 42000 },
  { agencyName: 'Los Gatos-Monte Sereno Police Department', agencyType: 'Police', city: 'Los Gatos', county: 'Santa Clara', populationEstimate: 33000 },
  { agencyName: 'Morgan Hill Police Department', agencyType: 'Police', city: 'Morgan Hill', county: 'Santa Clara', populationEstimate: 46000 },
  { agencyName: 'Gilroy Police Department', agencyType: 'Police', city: 'Gilroy', county: 'Santa Clara', populationEstimate: 59000 },
  { agencyName: 'Union City Police Department', agencyType: 'Police', city: 'Union City', county: 'Alameda', populationEstimate: 74000 },
  { agencyName: 'Newark Police Department', agencyType: 'Police', city: 'Newark', county: 'Alameda', populationEstimate: 48000 },
  { agencyName: 'Pleasanton Police Department', agencyType: 'Police', city: 'Pleasanton', county: 'Alameda', populationEstimate: 79000 },
  { agencyName: 'Dublin Police Services', agencyType: 'Police', city: 'Dublin', county: 'Alameda', populationEstimate: 73000 },
  { agencyName: 'Livermore Police Department', agencyType: 'Police', city: 'Livermore', county: 'Alameda', populationEstimate: 90000 },
  { agencyName: 'Emeryville Police Department', agencyType: 'Police', city: 'Emeryville', county: 'Alameda', populationEstimate: 12000 },
  { agencyName: 'Alameda Police Department', agencyType: 'Police', city: 'Alameda', county: 'Alameda', populationEstimate: 79000 },
  { agencyName: 'San Leandro Police Department', agencyType: 'Police', city: 'San Leandro', county: 'Alameda', populationEstimate: 91000 },
  { agencyName: 'Pittsburg Police Department', agencyType: 'Police', city: 'Pittsburg', county: 'Contra Costa', populationEstimate: 75000 },
  { agencyName: 'Brentwood Police Department', agencyType: 'Police', city: 'Brentwood', county: 'Contra Costa', populationEstimate: 65000 },
  { agencyName: 'Martinez Police Department', agencyType: 'Police', city: 'Martinez', county: 'Contra Costa', populationEstimate: 38000 },
  { agencyName: 'Pleasant Hill Police Department', agencyType: 'Police', city: 'Pleasant Hill', county: 'Contra Costa', populationEstimate: 34000 },
  { agencyName: 'San Ramon Police Department', agencyType: 'Police', city: 'San Ramon', county: 'Contra Costa', populationEstimate: 84000 },
  { agencyName: 'Danville Police Department', agencyType: 'Police', city: 'Danville', county: 'Contra Costa', populationEstimate: 44000 },
  { agencyName: 'El Cerrito Police Department', agencyType: 'Police', city: 'El Cerrito', county: 'Contra Costa', populationEstimate: 25000 },

  // === SAN DIEGO COUNTY ===
  { agencyName: 'San Diego Police Department', agencyType: 'Police', city: 'San Diego', county: 'San Diego', populationEstimate: 1386000, website: 'https://www.sandiego.gov/police' },
  { agencyName: 'San Diego County Sheriff\'s Department', agencyType: 'Sheriff', county: 'San Diego', populationEstimate: 3340000 },
  { agencyName: 'Chula Vista Police Department', agencyType: 'Police', city: 'Chula Vista', county: 'San Diego', populationEstimate: 275000 },
  { agencyName: 'Oceanside Police Department', agencyType: 'Police', city: 'Oceanside', county: 'San Diego', populationEstimate: 176000 },
  { agencyName: 'Escondido Police Department', agencyType: 'Police', city: 'Escondido', county: 'San Diego', populationEstimate: 151000 },
  { agencyName: 'Carlsbad Police Department', agencyType: 'Police', city: 'Carlsbad', county: 'San Diego', populationEstimate: 114000 },
  { agencyName: 'Vista Sheriff\'s Station', agencyType: 'Police', city: 'Vista', county: 'San Diego', populationEstimate: 101000 },
  { agencyName: 'El Cajon Police Department', agencyType: 'Police', city: 'El Cajon', county: 'San Diego', populationEstimate: 106000 },
  { agencyName: 'National City Police Department', agencyType: 'Police', city: 'National City', county: 'San Diego', populationEstimate: 61000 },
  { agencyName: 'La Mesa Police Department', agencyType: 'Police', city: 'La Mesa', county: 'San Diego', populationEstimate: 60000 },
  { agencyName: 'Coronado Police Department', agencyType: 'Police', city: 'Coronado', county: 'San Diego', populationEstimate: 24000 },
  { agencyName: 'San Diego Harbor Police', agencyType: 'Police', city: 'San Diego', county: 'San Diego' },
  { agencyName: 'San Diego Metropolitan Transit System Security', agencyType: 'Transit', city: 'San Diego', county: 'San Diego' },
  { agencyName: 'Encinitas Sheriff\'s Station', agencyType: 'Police', city: 'Encinitas', county: 'San Diego', populationEstimate: 63000 },

  // === SACRAMENTO AREA ===
  { agencyName: 'Sacramento Police Department', agencyType: 'Police', city: 'Sacramento', county: 'Sacramento', populationEstimate: 524000, website: 'https://www.cityofsacramento.org/Police' },
  { agencyName: 'Sacramento County Sheriff\'s Department', agencyType: 'Sheriff', county: 'Sacramento', populationEstimate: 1585000 },
  { agencyName: 'Elk Grove Police Department', agencyType: 'Police', city: 'Elk Grove', county: 'Sacramento', populationEstimate: 176000 },
  { agencyName: 'Citrus Heights Police Department', agencyType: 'Police', city: 'Citrus Heights', county: 'Sacramento', populationEstimate: 87000 },
  { agencyName: 'Folsom Police Department', agencyType: 'Police', city: 'Folsom', county: 'Sacramento', populationEstimate: 82000 },
  { agencyName: 'Rancho Cordova Police Department', agencyType: 'Police', city: 'Rancho Cordova', county: 'Sacramento', populationEstimate: 79000 },
  { agencyName: 'Placer County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Placer', populationEstimate: 404000 },
  { agencyName: 'Roseville Police Department', agencyType: 'Police', city: 'Roseville', county: 'Placer', populationEstimate: 147000 },
  { agencyName: 'Rocklin Police Department', agencyType: 'Police', city: 'Rocklin', county: 'Placer', populationEstimate: 70000 },
  { agencyName: 'Lincoln Police Department', agencyType: 'Police', city: 'Lincoln', county: 'Placer', populationEstimate: 49000 },
  { agencyName: 'Yolo County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Yolo', populationEstimate: 220000 },
  { agencyName: 'Davis Police Department', agencyType: 'Police', city: 'Davis', county: 'Yolo', populationEstimate: 68000 },
  { agencyName: 'Woodland Police Department', agencyType: 'Police', city: 'Woodland', county: 'Yolo', populationEstimate: 62000 },
  { agencyName: 'West Sacramento Police Department', agencyType: 'Police', city: 'West Sacramento', county: 'Yolo', populationEstimate: 53000 },
  { agencyName: 'El Dorado County Sheriff\'s Office', agencyType: 'Sheriff', county: 'El Dorado', populationEstimate: 192000 },
  { agencyName: 'South Lake Tahoe Police Department', agencyType: 'Police', city: 'South Lake Tahoe', county: 'El Dorado', populationEstimate: 22000 },
  { agencyName: 'Sacramento Regional Transit Police', agencyType: 'Transit', city: 'Sacramento', county: 'Sacramento' },

  // === ORANGE COUNTY ===
  { agencyName: 'Orange County Sheriff\'s Department', agencyType: 'Sheriff', county: 'Orange', populationEstimate: 3190000, website: 'https://www.ocsd.org' },
  { agencyName: 'Anaheim Police Department', agencyType: 'Police', city: 'Anaheim', county: 'Orange', populationEstimate: 350000 },
  { agencyName: 'Santa Ana Police Department', agencyType: 'Police', city: 'Santa Ana', county: 'Orange', populationEstimate: 310000 },
  { agencyName: 'Irvine Police Department', agencyType: 'Police', city: 'Irvine', county: 'Orange', populationEstimate: 307000 },
  { agencyName: 'Huntington Beach Police Department', agencyType: 'Police', city: 'Huntington Beach', county: 'Orange', populationEstimate: 198000 },
  { agencyName: 'Garden Grove Police Department', agencyType: 'Police', city: 'Garden Grove', county: 'Orange', populationEstimate: 172000 },
  { agencyName: 'Fullerton Police Department', agencyType: 'Police', city: 'Fullerton', county: 'Orange', populationEstimate: 139000 },
  { agencyName: 'Orange Police Department', agencyType: 'Police', city: 'Orange', county: 'Orange', populationEstimate: 139000 },
  { agencyName: 'Costa Mesa Police Department', agencyType: 'Police', city: 'Costa Mesa', county: 'Orange', populationEstimate: 112000 },
  { agencyName: 'Newport Beach Police Department', agencyType: 'Police', city: 'Newport Beach', county: 'Orange', populationEstimate: 85000 },
  { agencyName: 'Westminster Police Department', agencyType: 'Police', city: 'Westminster', county: 'Orange', populationEstimate: 91000 },
  { agencyName: 'Tustin Police Department', agencyType: 'Police', city: 'Tustin', county: 'Orange', populationEstimate: 80000 },
  { agencyName: 'Buena Park Police Department', agencyType: 'Police', city: 'Buena Park', county: 'Orange', populationEstimate: 82000 },
  { agencyName: 'Laguna Beach Police Department', agencyType: 'Police', city: 'Laguna Beach', county: 'Orange', populationEstimate: 23000 },
  { agencyName: 'La Habra Police Department', agencyType: 'Police', city: 'La Habra', county: 'Orange', populationEstimate: 62000 },
  { agencyName: 'Brea Police Department', agencyType: 'Police', city: 'Brea', county: 'Orange', populationEstimate: 47000 },
  { agencyName: 'Cypress Police Department', agencyType: 'Police', city: 'Cypress', county: 'Orange', populationEstimate: 50000 },
  { agencyName: 'Fountain Valley Police Department', agencyType: 'Police', city: 'Fountain Valley', county: 'Orange', populationEstimate: 56000 },
  { agencyName: 'Seal Beach Police Department', agencyType: 'Police', city: 'Seal Beach', county: 'Orange', populationEstimate: 25000 },
  { agencyName: 'John Wayne Airport Police', agencyType: 'Airport', city: 'Santa Ana', county: 'Orange' },
  { agencyName: 'Placentia Police Department', agencyType: 'Police', city: 'Placentia', county: 'Orange', populationEstimate: 52000 },
  { agencyName: 'San Clemente Police Services', agencyType: 'Police', city: 'San Clemente', county: 'Orange', populationEstimate: 65000 },
  { agencyName: 'Dana Point Police Services', agencyType: 'Police', city: 'Dana Point', county: 'Orange', populationEstimate: 34000 },
  { agencyName: 'Laguna Niguel Police Services', agencyType: 'Police', city: 'Laguna Niguel', county: 'Orange', populationEstimate: 66000 },

  // === RIVERSIDE COUNTY ===
  { agencyName: 'Riverside Police Department', agencyType: 'Police', city: 'Riverside', county: 'Riverside', populationEstimate: 314000 },
  { agencyName: 'Riverside County Sheriff\'s Department', agencyType: 'Sheriff', county: 'Riverside', populationEstimate: 2470000 },
  { agencyName: 'Moreno Valley Police Department', agencyType: 'Police', city: 'Moreno Valley', county: 'Riverside', populationEstimate: 212000 },
  { agencyName: 'Corona Police Department', agencyType: 'Police', city: 'Corona', county: 'Riverside', populationEstimate: 157000 },
  { agencyName: 'Murrieta Police Department', agencyType: 'Police', city: 'Murrieta', county: 'Riverside', populationEstimate: 113000 },
  { agencyName: 'Temecula Police Department', agencyType: 'Police', city: 'Temecula', county: 'Riverside', populationEstimate: 110000 },
  { agencyName: 'Hemet Police Department', agencyType: 'Police', city: 'Hemet', county: 'Riverside', populationEstimate: 90000 },
  { agencyName: 'Indio Police Department', agencyType: 'Police', city: 'Indio', county: 'Riverside', populationEstimate: 92000 },
  { agencyName: 'Palm Springs Police Department', agencyType: 'Police', city: 'Palm Springs', county: 'Riverside', populationEstimate: 48000 },
  { agencyName: 'Cathedral City Police Department', agencyType: 'Police', city: 'Cathedral City', county: 'Riverside', populationEstimate: 55000 },
  { agencyName: 'Beaumont Police Department', agencyType: 'Police', city: 'Beaumont', county: 'Riverside', populationEstimate: 54000 },
  { agencyName: 'Perris Sheriff\'s Station', agencyType: 'Police', city: 'Perris', county: 'Riverside', populationEstimate: 79000 },
  { agencyName: 'Lake Elsinore Sheriff\'s Station', agencyType: 'Police', city: 'Lake Elsinore', county: 'Riverside', populationEstimate: 70000 },
  { agencyName: 'Palm Desert Sheriff\'s Station', agencyType: 'Police', city: 'Palm Desert', county: 'Riverside', populationEstimate: 53000 },
  { agencyName: 'Banning Police Department', agencyType: 'Police', city: 'Banning', county: 'Riverside', populationEstimate: 31000 },

  // === SAN BERNARDINO COUNTY ===
  { agencyName: 'San Bernardino Police Department', agencyType: 'Police', city: 'San Bernardino', county: 'San Bernardino', populationEstimate: 222000 },
  { agencyName: 'San Bernardino County Sheriff\'s Department', agencyType: 'Sheriff', county: 'San Bernardino', populationEstimate: 2180000 },
  { agencyName: 'Fontana Police Department', agencyType: 'Police', city: 'Fontana', county: 'San Bernardino', populationEstimate: 214000 },
  { agencyName: 'Ontario Police Department', agencyType: 'Police', city: 'Ontario', county: 'San Bernardino', populationEstimate: 175000 },
  { agencyName: 'Rancho Cucamonga Police Department', agencyType: 'Police', city: 'Rancho Cucamonga', county: 'San Bernardino', populationEstimate: 177000 },
  { agencyName: 'Rialto Police Department', agencyType: 'Police', city: 'Rialto', county: 'San Bernardino', populationEstimate: 104000 },
  { agencyName: 'Upland Police Department', agencyType: 'Police', city: 'Upland', county: 'San Bernardino', populationEstimate: 79000 },
  { agencyName: 'Redlands Police Department', agencyType: 'Police', city: 'Redlands', county: 'San Bernardino', populationEstimate: 73000 },
  { agencyName: 'Chino Police Department', agencyType: 'Police', city: 'Chino', county: 'San Bernardino', populationEstimate: 91000 },
  { agencyName: 'Colton Police Department', agencyType: 'Police', city: 'Colton', county: 'San Bernardino', populationEstimate: 54000 },
  { agencyName: 'Hesperia Sheriff\'s Station', agencyType: 'Police', city: 'Hesperia', county: 'San Bernardino', populationEstimate: 99000 },
  { agencyName: 'Victorville Sheriff\'s Station', agencyType: 'Police', city: 'Victorville', county: 'San Bernardino', populationEstimate: 134000 },
  { agencyName: 'Apple Valley Sheriff\'s Station', agencyType: 'Police', city: 'Apple Valley', county: 'San Bernardino', populationEstimate: 75000 },
  { agencyName: 'Barstow Police Department', agencyType: 'Police', city: 'Barstow', county: 'San Bernardino', populationEstimate: 25000 },
  { agencyName: 'Montclair Police Department', agencyType: 'Police', city: 'Montclair', county: 'San Bernardino', populationEstimate: 40000 },
  { agencyName: 'Ontario International Airport Police', agencyType: 'Airport', city: 'Ontario', county: 'San Bernardino' },

  // === FRESNO/CENTRAL VALLEY ===
  { agencyName: 'Fresno Police Department', agencyType: 'Police', city: 'Fresno', county: 'Fresno', populationEstimate: 542000, website: 'https://www.fresno.gov/police' },
  { agencyName: 'Fresno County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Fresno', populationEstimate: 1008000 },
  { agencyName: 'Clovis Police Department', agencyType: 'Police', city: 'Clovis', county: 'Fresno', populationEstimate: 120000 },
  { agencyName: 'Sanger Police Department', agencyType: 'Police', city: 'Sanger', county: 'Fresno', populationEstimate: 27000 },
  { agencyName: 'Selma Police Department', agencyType: 'Police', city: 'Selma', county: 'Fresno', populationEstimate: 25000 },
  { agencyName: 'Bakersfield Police Department', agencyType: 'Police', city: 'Bakersfield', county: 'Kern', populationEstimate: 403000 },
  { agencyName: 'Kern County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Kern', populationEstimate: 909000 },
  { agencyName: 'Stockton Police Department', agencyType: 'Police', city: 'Stockton', county: 'San Joaquin', populationEstimate: 320000 },
  { agencyName: 'San Joaquin County Sheriff\'s Office', agencyType: 'Sheriff', county: 'San Joaquin', populationEstimate: 779000 },
  { agencyName: 'Manteca Police Department', agencyType: 'Police', city: 'Manteca', county: 'San Joaquin', populationEstimate: 84000 },
  { agencyName: 'Tracy Police Department', agencyType: 'Police', city: 'Tracy', county: 'San Joaquin', populationEstimate: 93000 },
  { agencyName: 'Lodi Police Department', agencyType: 'Police', city: 'Lodi', county: 'San Joaquin', populationEstimate: 67000 },
  { agencyName: 'Modesto Police Department', agencyType: 'Police', city: 'Modesto', county: 'Stanislaus', populationEstimate: 218000 },
  { agencyName: 'Stanislaus County Sheriff\'s Department', agencyType: 'Sheriff', county: 'Stanislaus', populationEstimate: 552000 },
  { agencyName: 'Turlock Police Department', agencyType: 'Police', city: 'Turlock', county: 'Stanislaus', populationEstimate: 74000 },
  { agencyName: 'Merced Police Department', agencyType: 'Police', city: 'Merced', county: 'Merced', populationEstimate: 86000 },
  { agencyName: 'Merced County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Merced', populationEstimate: 281000 },
  { agencyName: 'Visalia Police Department', agencyType: 'Police', city: 'Visalia', county: 'Tulare', populationEstimate: 141000 },
  { agencyName: 'Tulare County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Tulare', populationEstimate: 473000 },
  { agencyName: 'Tulare Police Department', agencyType: 'Police', city: 'Tulare', county: 'Tulare', populationEstimate: 67000 },
  { agencyName: 'Porterville Police Department', agencyType: 'Police', city: 'Porterville', county: 'Tulare', populationEstimate: 60000 },
  { agencyName: 'Hanford Police Department', agencyType: 'Police', city: 'Hanford', county: 'Kings', populationEstimate: 57000 },
  { agencyName: 'Kings County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Kings', populationEstimate: 152000 },
  { agencyName: 'Madera Police Department', agencyType: 'Police', city: 'Madera', county: 'Madera', populationEstimate: 65000 },
  { agencyName: 'Madera County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Madera', populationEstimate: 157000 },

  // === VENTURA / SANTA BARBARA / SAN LUIS OBISPO ===
  { agencyName: 'Ventura County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Ventura', populationEstimate: 843000 },
  { agencyName: 'Ventura Police Department', agencyType: 'Police', city: 'Ventura', county: 'Ventura', populationEstimate: 109000 },
  { agencyName: 'Oxnard Police Department', agencyType: 'Police', city: 'Oxnard', county: 'Ventura', populationEstimate: 207000 },
  { agencyName: 'Thousand Oaks Police Department', agencyType: 'Police', city: 'Thousand Oaks', county: 'Ventura', populationEstimate: 126000 },
  { agencyName: 'Simi Valley Police Department', agencyType: 'Police', city: 'Simi Valley', county: 'Ventura', populationEstimate: 126000 },
  { agencyName: 'Camarillo Police Department', agencyType: 'Police', city: 'Camarillo', county: 'Ventura', populationEstimate: 70000 },
  { agencyName: 'Moorpark Police Department', agencyType: 'Police', city: 'Moorpark', county: 'Ventura', populationEstimate: 37000 },
  { agencyName: 'Port Hueneme Police Department', agencyType: 'Police', city: 'Port Hueneme', county: 'Ventura', populationEstimate: 22000 },
  { agencyName: 'Santa Barbara County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Santa Barbara', populationEstimate: 444000 },
  { agencyName: 'Santa Barbara Police Department', agencyType: 'Police', city: 'Santa Barbara', county: 'Santa Barbara', populationEstimate: 88000 },
  { agencyName: 'Santa Maria Police Department', agencyType: 'Police', city: 'Santa Maria', county: 'Santa Barbara', populationEstimate: 109000 },
  { agencyName: 'Lompoc Police Department', agencyType: 'Police', city: 'Lompoc', county: 'Santa Barbara', populationEstimate: 44000 },
  { agencyName: 'San Luis Obispo County Sheriff\'s Office', agencyType: 'Sheriff', county: 'San Luis Obispo', populationEstimate: 283000 },
  { agencyName: 'San Luis Obispo Police Department', agencyType: 'Police', city: 'San Luis Obispo', county: 'San Luis Obispo', populationEstimate: 47000 },
  { agencyName: 'Paso Robles Police Department', agencyType: 'Police', city: 'Paso Robles', county: 'San Luis Obispo', populationEstimate: 32000 },
  { agencyName: 'Atascadero Police Department', agencyType: 'Police', city: 'Atascadero', county: 'San Luis Obispo', populationEstimate: 30000 },
  { agencyName: 'Arroyo Grande Police Department', agencyType: 'Police', city: 'Arroyo Grande', county: 'San Luis Obispo', populationEstimate: 18000 },
  { agencyName: 'Pismo Beach Police Department', agencyType: 'Police', city: 'Pismo Beach', county: 'San Luis Obispo', populationEstimate: 8000 },
  { agencyName: 'Grover Beach Police Department', agencyType: 'Police', city: 'Grover Beach', county: 'San Luis Obispo', populationEstimate: 14000 },

  // === SANTA CRUZ / MONTEREY ===
  { agencyName: 'Santa Cruz County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Santa Cruz', populationEstimate: 273000 },
  { agencyName: 'Santa Cruz Police Department', agencyType: 'Police', city: 'Santa Cruz', county: 'Santa Cruz', populationEstimate: 65000 },
  { agencyName: 'Watsonville Police Department', agencyType: 'Police', city: 'Watsonville', county: 'Santa Cruz', populationEstimate: 54000 },
  { agencyName: 'Scotts Valley Police Department', agencyType: 'Police', city: 'Scotts Valley', county: 'Santa Cruz', populationEstimate: 12000 },
  { agencyName: 'Monterey County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Monterey', populationEstimate: 434000 },
  { agencyName: 'Salinas Police Department', agencyType: 'Police', city: 'Salinas', county: 'Monterey', populationEstimate: 163000 },
  { agencyName: 'Monterey Police Department', agencyType: 'Police', city: 'Monterey', county: 'Monterey', populationEstimate: 28000 },
  { agencyName: 'Seaside Police Department', agencyType: 'Police', city: 'Seaside', county: 'Monterey', populationEstimate: 34000 },
  { agencyName: 'Marina Police Department', agencyType: 'Police', city: 'Marina', county: 'Monterey', populationEstimate: 22000 },
  { agencyName: 'Pacific Grove Police Department', agencyType: 'Police', city: 'Pacific Grove', county: 'Monterey', populationEstimate: 15000 },
  { agencyName: 'King City Police Department', agencyType: 'Police', city: 'King City', county: 'Monterey', populationEstimate: 14000 },

  // === NORTH COAST / NORTH STATE ===
  { agencyName: 'Humboldt County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Humboldt', populationEstimate: 136000 },
  { agencyName: 'Eureka Police Department', agencyType: 'Police', city: 'Eureka', county: 'Humboldt', populationEstimate: 27000 },
  { agencyName: 'Arcata Police Department', agencyType: 'Police', city: 'Arcata', county: 'Humboldt', populationEstimate: 18000 },
  { agencyName: 'Fortuna Police Department', agencyType: 'Police', city: 'Fortuna', county: 'Humboldt', populationEstimate: 13000 },
  { agencyName: 'Mendocino County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Mendocino', populationEstimate: 87000 },
  { agencyName: 'Ukiah Police Department', agencyType: 'Police', city: 'Ukiah', county: 'Mendocino', populationEstimate: 16000 },
  { agencyName: 'Fort Bragg Police Department', agencyType: 'Police', city: 'Fort Bragg', county: 'Mendocino', populationEstimate: 7000 },
  { agencyName: 'Lake County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Lake', populationEstimate: 68000 },
  { agencyName: 'Clearlake Police Department', agencyType: 'Police', city: 'Clearlake', county: 'Lake', populationEstimate: 16000 },
  { agencyName: 'Del Norte County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Del Norte', populationEstimate: 28000 },
  { agencyName: 'Crescent City Police Department', agencyType: 'Police', city: 'Crescent City', county: 'Del Norte', populationEstimate: 7000 },
  { agencyName: 'Shasta County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Shasta', populationEstimate: 180000 },
  { agencyName: 'Redding Police Department', agencyType: 'Police', city: 'Redding', county: 'Shasta', populationEstimate: 92000 },
  { agencyName: 'Anderson Police Department', agencyType: 'Police', city: 'Anderson', county: 'Shasta', populationEstimate: 11000 },
  { agencyName: 'Tehama County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Tehama', populationEstimate: 65000 },
  { agencyName: 'Red Bluff Police Department', agencyType: 'Police', city: 'Red Bluff', county: 'Tehama', populationEstimate: 14000 },
  { agencyName: 'Butte County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Butte', populationEstimate: 220000 },
  { agencyName: 'Chico Police Department', agencyType: 'Police', city: 'Chico', county: 'Butte', populationEstimate: 101000 },
  { agencyName: 'Oroville Police Department', agencyType: 'Police', city: 'Oroville', county: 'Butte', populationEstimate: 20000 },
  { agencyName: 'Paradise Police Department', agencyType: 'Police', city: 'Paradise', county: 'Butte', populationEstimate: 5000 },
  { agencyName: 'Glenn County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Glenn', populationEstimate: 28000 },
  { agencyName: 'Sutter County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Sutter', populationEstimate: 99000 },
  { agencyName: 'Yuba City Police Department', agencyType: 'Police', city: 'Yuba City', county: 'Sutter', populationEstimate: 70000 },
  { agencyName: 'Yuba County Sheriff\'s Department', agencyType: 'Sheriff', county: 'Yuba', populationEstimate: 81000 },
  { agencyName: 'Marysville Police Department', agencyType: 'Police', city: 'Marysville', county: 'Yuba', populationEstimate: 13000 },
  { agencyName: 'Colusa County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Colusa', populationEstimate: 22000 },
  { agencyName: 'Siskiyou County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Siskiyou', populationEstimate: 44000 },
  { agencyName: 'Yreka Police Department', agencyType: 'Police', city: 'Yreka', county: 'Siskiyou', populationEstimate: 8000 },
  { agencyName: 'Trinity County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Trinity', populationEstimate: 13000 },
  { agencyName: 'Lassen County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Lassen', populationEstimate: 30000 },
  { agencyName: 'Susanville Police Department', agencyType: 'Police', city: 'Susanville', county: 'Lassen', populationEstimate: 15000 },
  { agencyName: 'Modoc County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Modoc', populationEstimate: 9000 },
  { agencyName: 'Plumas County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Plumas', populationEstimate: 19000 },
  { agencyName: 'Sierra County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Sierra', populationEstimate: 3000 },
  { agencyName: 'Nevada County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Nevada', populationEstimate: 100000 },
  { agencyName: 'Grass Valley Police Department', agencyType: 'Police', city: 'Grass Valley', county: 'Nevada', populationEstimate: 13000 },
  { agencyName: 'Nevada City Police Department', agencyType: 'Police', city: 'Nevada City', county: 'Nevada', populationEstimate: 3000 },
  { agencyName: 'Alpine County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Alpine', populationEstimate: 1100 },
  { agencyName: 'Amador County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Amador', populationEstimate: 40000 },
  { agencyName: 'Calaveras County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Calaveras', populationEstimate: 45000 },
  { agencyName: 'Tuolumne County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Tuolumne', populationEstimate: 55000 },
  { agencyName: 'Sonora Police Department', agencyType: 'Police', city: 'Sonora', county: 'Tuolumne', populationEstimate: 5000 },
  { agencyName: 'Mariposa County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Mariposa', populationEstimate: 17000 },
  { agencyName: 'Mono County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Mono', populationEstimate: 14000 },
  { agencyName: 'Mammoth Lakes Police Department', agencyType: 'Police', city: 'Mammoth Lakes', county: 'Mono', populationEstimate: 8000 },
  { agencyName: 'Inyo County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Inyo', populationEstimate: 18000 },
  { agencyName: 'Bishop Police Department', agencyType: 'Police', city: 'Bishop', county: 'Inyo', populationEstimate: 4000 },

  // === IMPERIAL / DESERT ===
  { agencyName: 'Imperial County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Imperial', populationEstimate: 181000 },
  { agencyName: 'El Centro Police Department', agencyType: 'Police', city: 'El Centro', county: 'Imperial', populationEstimate: 44000 },
  { agencyName: 'Brawley Police Department', agencyType: 'Police', city: 'Brawley', county: 'Imperial', populationEstimate: 27000 },
  { agencyName: 'Calexico Police Department', agencyType: 'Police', city: 'Calexico', county: 'Imperial', populationEstimate: 40000 },

  // === UNIVERSITY POLICE ===
  { agencyName: 'UC Berkeley Police Department', agencyType: 'University', city: 'Berkeley', county: 'Alameda' },
  { agencyName: 'UCLA Police Department', agencyType: 'University', city: 'Los Angeles', county: 'Los Angeles' },
  { agencyName: 'UC Davis Police Department', agencyType: 'University', city: 'Davis', county: 'Yolo' },
  { agencyName: 'UC San Diego Police Department', agencyType: 'University', city: 'San Diego', county: 'San Diego' },
  { agencyName: 'UC Irvine Police Department', agencyType: 'University', city: 'Irvine', county: 'Orange' },
  { agencyName: 'UC Santa Barbara Police Department', agencyType: 'University', city: 'Santa Barbara', county: 'Santa Barbara' },
  { agencyName: 'UC Santa Cruz Police Department', agencyType: 'University', city: 'Santa Cruz', county: 'Santa Cruz' },
  { agencyName: 'UC Riverside Police Department', agencyType: 'University', city: 'Riverside', county: 'Riverside' },
  { agencyName: 'UC Merced Police Department', agencyType: 'University', city: 'Merced', county: 'Merced' },
  { agencyName: 'UC San Francisco Police Department', agencyType: 'University', city: 'San Francisco', county: 'San Francisco' },
  { agencyName: 'CSU Fresno Police Department', agencyType: 'University', city: 'Fresno', county: 'Fresno' },
  { agencyName: 'CSU Sacramento Police Department', agencyType: 'University', city: 'Sacramento', county: 'Sacramento' },
  { agencyName: 'CSU Long Beach Police Department', agencyType: 'University', city: 'Long Beach', county: 'Los Angeles' },
  { agencyName: 'CSU San Jose Police Department', agencyType: 'University', city: 'San Jose', county: 'Santa Clara' },
  { agencyName: 'CSU Fullerton Police Department', agencyType: 'University', city: 'Fullerton', county: 'Orange' },
  { agencyName: 'CSU Los Angeles Police Department', agencyType: 'University', city: 'Los Angeles', county: 'Los Angeles' },
  { agencyName: 'CSU Northridge Police Department', agencyType: 'University', city: 'Northridge', county: 'Los Angeles' },
  { agencyName: 'CSU San Diego Police Department', agencyType: 'University', city: 'San Diego', county: 'San Diego' },
  { agencyName: 'CSU Pomona Police Department', agencyType: 'University', city: 'Pomona', county: 'Los Angeles' },
  { agencyName: 'CSU San Bernardino Police Department', agencyType: 'University', city: 'San Bernardino', county: 'San Bernardino' },
  { agencyName: 'CSU Chico Police Department', agencyType: 'University', city: 'Chico', county: 'Butte' },
  { agencyName: 'Stanford University Department of Public Safety', agencyType: 'University', city: 'Palo Alto', county: 'Santa Clara' },
  { agencyName: 'USC Department of Public Safety', agencyType: 'University', city: 'Los Angeles', county: 'Los Angeles' },

  // === SCHOOL DISTRICT POLICE ===
  { agencyName: 'San Francisco Unified School District Police', agencyType: 'Other', city: 'San Francisco', county: 'San Francisco' },
  { agencyName: 'Oakland Unified School District Police', agencyType: 'Other', city: 'Oakland', county: 'Alameda' },
  { agencyName: 'Sacramento City Unified School District Police', agencyType: 'Other', city: 'Sacramento', county: 'Sacramento' },
  { agencyName: 'San Diego Unified School District Police', agencyType: 'Other', city: 'San Diego', county: 'San Diego' },
  { agencyName: 'Fresno Unified School District Police', agencyType: 'Other', city: 'Fresno', county: 'Fresno' },
  { agencyName: 'Long Beach Unified School District Police', agencyType: 'Other', city: 'Long Beach', county: 'Los Angeles' },
  { agencyName: 'San Bernardino Unified School District Police', agencyType: 'Other', city: 'San Bernardino', county: 'San Bernardino' },
  { agencyName: 'Stockton Unified School District Police', agencyType: 'Other', city: 'Stockton', county: 'San Joaquin' },

  // === TRANSIT / SPECIAL DISTRICT POLICE ===
  { agencyName: 'Amtrak Police - California Division', agencyType: 'Transit', county: 'Los Angeles' },
  { agencyName: 'East Bay Regional Park District Police', agencyType: 'Other', county: 'Alameda' },
  { agencyName: 'Golden Gate Bridge Highway and Transportation District Police', agencyType: 'Transit', county: 'Marin' },
  { agencyName: 'Port of Long Beach Harbor Patrol', agencyType: 'Other', city: 'Long Beach', county: 'Los Angeles' },
  { agencyName: 'Port of Oakland Police', agencyType: 'Other', city: 'Oakland', county: 'Alameda' },
  { agencyName: 'Sacramento International Airport Police', agencyType: 'Airport', city: 'Sacramento', county: 'Sacramento' },
  { agencyName: 'San Jose International Airport Police', agencyType: 'Airport', city: 'San Jose', county: 'Santa Clara' },
  { agencyName: 'Long Beach Airport Police', agencyType: 'Airport', city: 'Long Beach', county: 'Los Angeles' },
  { agencyName: 'Burbank Airport Police', agencyType: 'Airport', city: 'Burbank', county: 'Los Angeles' },

  // === ADDITIONAL AGENCIES TO REACH 500+ ===
  { agencyName: 'Benicia Police Department', agencyType: 'Police', city: 'Benicia', county: 'Solano', populationEstimate: 28000 },
  { agencyName: 'Dixon Police Department', agencyType: 'Police', city: 'Dixon', county: 'Solano', populationEstimate: 21000 },
  { agencyName: 'Suisun City Police Department', agencyType: 'Police', city: 'Suisun City', county: 'Solano', populationEstimate: 29000 },
  { agencyName: 'Rio Vista Police Department', agencyType: 'Police', city: 'Rio Vista', county: 'Solano', populationEstimate: 10000 },
  { agencyName: 'Winters Police Department', agencyType: 'Police', city: 'Winters', county: 'Yolo', populationEstimate: 8000 },
  { agencyName: 'Lathrop Police Department', agencyType: 'Police', city: 'Lathrop', county: 'San Joaquin', populationEstimate: 26000 },
  { agencyName: 'Escalon Police Department', agencyType: 'Police', city: 'Escalon', county: 'San Joaquin', populationEstimate: 8000 },
  { agencyName: 'Ripon Police Department', agencyType: 'Police', city: 'Ripon', county: 'San Joaquin', populationEstimate: 16000 },
  { agencyName: 'Ceres Police Department', agencyType: 'Police', city: 'Ceres', county: 'Stanislaus', populationEstimate: 51000 },
  { agencyName: 'Oakdale Police Department', agencyType: 'Police', city: 'Oakdale', county: 'Stanislaus', populationEstimate: 23000 },
  { agencyName: 'Patterson Police Department', agencyType: 'Police', city: 'Patterson', county: 'Stanislaus', populationEstimate: 23000 },
  { agencyName: 'Newman Police Department', agencyType: 'Police', city: 'Newman', county: 'Stanislaus', populationEstimate: 12000 },
  { agencyName: 'Livingston Police Department', agencyType: 'Police', city: 'Livingston', county: 'Merced', populationEstimate: 15000 },
  { agencyName: 'Atwater Police Department', agencyType: 'Police', city: 'Atwater', county: 'Merced', populationEstimate: 31000 },
  { agencyName: 'Los Banos Police Department', agencyType: 'Police', city: 'Los Banos', county: 'Merced', populationEstimate: 42000 },
  { agencyName: 'Gustine Police Department', agencyType: 'Police', city: 'Gustine', county: 'Merced', populationEstimate: 6000 },
  { agencyName: 'Exeter Police Department', agencyType: 'Police', city: 'Exeter', county: 'Tulare', populationEstimate: 11000 },
  { agencyName: 'Lindsay Police Department', agencyType: 'Police', city: 'Lindsay', county: 'Tulare', populationEstimate: 13000 },
  { agencyName: 'Dinuba Police Department', agencyType: 'Police', city: 'Dinuba', county: 'Tulare', populationEstimate: 25000 },
  { agencyName: 'Woodlake Police Department', agencyType: 'Police', city: 'Woodlake', county: 'Tulare', populationEstimate: 8000 },
  { agencyName: 'Delano Police Department', agencyType: 'Police', city: 'Delano', county: 'Kern', populationEstimate: 53000 },
  { agencyName: 'Wasco Police Department', agencyType: 'Police', city: 'Wasco', county: 'Kern', populationEstimate: 28000 },
  { agencyName: 'Ridgecrest Police Department', agencyType: 'Police', city: 'Ridgecrest', county: 'Kern', populationEstimate: 29000 },
  { agencyName: 'Taft Police Department', agencyType: 'Police', city: 'Taft', county: 'Kern', populationEstimate: 10000 },
  { agencyName: 'Tehachapi Police Department', agencyType: 'Police', city: 'Tehachapi', county: 'Kern', populationEstimate: 14000 },
  { agencyName: 'Shafter Police Department', agencyType: 'Police', city: 'Shafter', county: 'Kern', populationEstimate: 21000 },
  { agencyName: 'McFarland Police Department', agencyType: 'Police', city: 'McFarland', county: 'Kern', populationEstimate: 16000 },
  { agencyName: 'Arvin Police Department', agencyType: 'Police', city: 'Arvin', county: 'Kern', populationEstimate: 22000 },
  { agencyName: 'Parlier Police Department', agencyType: 'Police', city: 'Parlier', county: 'Fresno', populationEstimate: 16000 },
  { agencyName: 'Reedley Police Department', agencyType: 'Police', city: 'Reedley', county: 'Fresno', populationEstimate: 26000 },
  { agencyName: 'Kerman Police Department', agencyType: 'Police', city: 'Kerman', county: 'Fresno', populationEstimate: 16000 },
  { agencyName: 'Coalinga Police Department', agencyType: 'Police', city: 'Coalinga', county: 'Fresno', populationEstimate: 17000 },
  { agencyName: 'Kingsburg Police Department', agencyType: 'Police', city: 'Kingsburg', county: 'Fresno', populationEstimate: 13000 },
  { agencyName: 'Firebaugh Police Department', agencyType: 'Police', city: 'Firebaugh', county: 'Fresno', populationEstimate: 8000 },
  { agencyName: 'Mendota Police Department', agencyType: 'Police', city: 'Mendota', county: 'Fresno', populationEstimate: 12000 },
  { agencyName: 'San Fernando Police Department', agencyType: 'Police', city: 'San Fernando', county: 'Los Angeles', populationEstimate: 24000 },
  { agencyName: 'Irwindale Police Department', agencyType: 'Police', city: 'Irwindale', county: 'Los Angeles', populationEstimate: 1400 },
  { agencyName: 'Baldwin Park Police Department', agencyType: 'Police', city: 'Baldwin Park', county: 'Los Angeles', populationEstimate: 77000 },
  { agencyName: 'West Hollywood Sheriff\'s Station', agencyType: 'Police', city: 'West Hollywood', county: 'Los Angeles', populationEstimate: 36000 },
  { agencyName: 'Maywood Police Department', agencyType: 'Police', city: 'Maywood', county: 'Los Angeles', populationEstimate: 27000 },
  { agencyName: 'Vernon Police Department', agencyType: 'Police', city: 'Vernon', county: 'Los Angeles', populationEstimate: 200 },
  { agencyName: 'Signal Hill Police Department', agencyType: 'Police', city: 'Signal Hill', county: 'Los Angeles', populationEstimate: 12000 },
  { agencyName: 'San Gabriel Police Department', agencyType: 'Police', city: 'San Gabriel', county: 'Los Angeles', populationEstimate: 40000 },
  { agencyName: 'South Pasadena Police Department', agencyType: 'Police', city: 'South Pasadena', county: 'Los Angeles', populationEstimate: 26000 },
  { agencyName: 'Temple City Sheriff\'s Station', agencyType: 'Police', city: 'Temple City', county: 'Los Angeles', populationEstimate: 36000 },
  { agencyName: 'Duarte Sheriff\'s Station', agencyType: 'Police', city: 'Duarte', county: 'Los Angeles', populationEstimate: 22000 },
  { agencyName: 'Chino Hills Police Department', agencyType: 'Police', city: 'Chino Hills', county: 'San Bernardino', populationEstimate: 83000 },
  { agencyName: 'Loma Linda Sheriff\'s Station', agencyType: 'Police', city: 'Loma Linda', county: 'San Bernardino', populationEstimate: 24000 },
  { agencyName: 'Highland Sheriff\'s Station', agencyType: 'Police', city: 'Highland', county: 'San Bernardino', populationEstimate: 56000 },
  { agencyName: 'Grand Terrace Police Department', agencyType: 'Police', city: 'Grand Terrace', county: 'San Bernardino', populationEstimate: 13000 },
  { agencyName: 'Yucaipa Sheriff\'s Station', agencyType: 'Police', city: 'Yucaipa', county: 'San Bernardino', populationEstimate: 55000 },
  { agencyName: 'Twentynine Palms Sheriff\'s Station', agencyType: 'Police', city: 'Twentynine Palms', county: 'San Bernardino', populationEstimate: 29000 },
  { agencyName: 'Joshua Tree Sheriff\'s Station', agencyType: 'Police', city: 'Joshua Tree', county: 'San Bernardino', populationEstimate: 8000 },
  { agencyName: 'Big Bear Lake Police Department', agencyType: 'Police', city: 'Big Bear Lake', county: 'San Bernardino', populationEstimate: 5000 },
  { agencyName: 'Needles Police Department', agencyType: 'Police', city: 'Needles', county: 'San Bernardino', populationEstimate: 5000 },
  { agencyName: 'La Quinta Police Department', agencyType: 'Police', city: 'La Quinta', county: 'Riverside', populationEstimate: 41000 },
  { agencyName: 'Desert Hot Springs Police Department', agencyType: 'Police', city: 'Desert Hot Springs', county: 'Riverside', populationEstimate: 29000 },
  { agencyName: 'Coachella Police Department', agencyType: 'Police', city: 'Coachella', county: 'Riverside', populationEstimate: 46000 },
  { agencyName: 'San Jacinto Police Department', agencyType: 'Police', city: 'San Jacinto', county: 'Riverside', populationEstimate: 52000 },
  { agencyName: 'Menifee Police Department', agencyType: 'Police', city: 'Menifee', county: 'Riverside', populationEstimate: 102000 },
  { agencyName: 'Wildomar Police Department', agencyType: 'Police', city: 'Wildomar', county: 'Riverside', populationEstimate: 37000 },
  { agencyName: 'Norco Police Department', agencyType: 'Police', city: 'Norco', county: 'Riverside', populationEstimate: 27000 },
  { agencyName: 'Calimesa Police Department', agencyType: 'Police', city: 'Calimesa', county: 'Riverside', populationEstimate: 10000 },
  { agencyName: 'Soledad Police Department', agencyType: 'Police', city: 'Soledad', county: 'Monterey', populationEstimate: 26000 },
  { agencyName: 'Gonzales Police Department', agencyType: 'Police', city: 'Gonzales', county: 'Monterey', populationEstimate: 9000 },
  { agencyName: 'Greenfield Police Department', agencyType: 'Police', city: 'Greenfield', county: 'Monterey', populationEstimate: 18000 },
  { agencyName: 'Hollister Police Department', agencyType: 'Police', city: 'Hollister', county: 'San Benito', populationEstimate: 42000 },
  { agencyName: 'San Benito County Sheriff\'s Office', agencyType: 'Sheriff', county: 'San Benito', populationEstimate: 64000 },
  { agencyName: 'Capitola Police Department', agencyType: 'Police', city: 'Capitola', county: 'Santa Cruz', populationEstimate: 10000 },
  { agencyName: 'Fillmore Police Department', agencyType: 'Police', city: 'Fillmore', county: 'Ventura', populationEstimate: 16000 },
  { agencyName: 'Santa Paula Police Department', agencyType: 'Police', city: 'Santa Paula', county: 'Ventura', populationEstimate: 31000 },
  { agencyName: 'Ojai Police Department', agencyType: 'Police', city: 'Ojai', county: 'Ventura', populationEstimate: 8000 },
  { agencyName: 'Guadalupe Police Department', agencyType: 'Police', city: 'Guadalupe', county: 'Santa Barbara', populationEstimate: 8000 },
  { agencyName: 'Solvang Police Department', agencyType: 'Police', city: 'Solvang', county: 'Santa Barbara', populationEstimate: 6000 },
  { agencyName: 'Buellton Police Department', agencyType: 'Police', city: 'Buellton', county: 'Santa Barbara', populationEstimate: 5000 },
  { agencyName: 'Morro Bay Police Department', agencyType: 'Police', city: 'Morro Bay', county: 'San Luis Obispo', populationEstimate: 11000 },
  { agencyName: 'Auburn Police Department', agencyType: 'Police', city: 'Auburn', county: 'Placer', populationEstimate: 14000 },
  { agencyName: 'Colfax Police Department', agencyType: 'Police', city: 'Colfax', county: 'Placer', populationEstimate: 2000 },
  { agencyName: 'Jackson Police Department', agencyType: 'Police', city: 'Jackson', county: 'Amador', populationEstimate: 5000 },
  { agencyName: 'Placerville Police Department', agencyType: 'Police', city: 'Placerville', county: 'El Dorado', populationEstimate: 11000 },
  { agencyName: 'Ione Police Department', agencyType: 'Police', city: 'Ione', county: 'Amador', populationEstimate: 8000 },
  { agencyName: 'Angels Camp Police Department', agencyType: 'Police', city: 'Angels Camp', county: 'Calaveras', populationEstimate: 4000 },
  { agencyName: 'Corning Police Department', agencyType: 'Police', city: 'Corning', county: 'Tehama', populationEstimate: 8000 },
  { agencyName: 'Willows Police Department', agencyType: 'Police', city: 'Willows', county: 'Glenn', populationEstimate: 7000 },
  { agencyName: 'Orland Police Department', agencyType: 'Police', city: 'Orland', county: 'Glenn', populationEstimate: 8000 },
  { agencyName: 'Gridley Police Department', agencyType: 'Police', city: 'Gridley', county: 'Butte', populationEstimate: 7000 },
  { agencyName: 'Biggs Police Department', agencyType: 'Police', city: 'Biggs', county: 'Butte', populationEstimate: 2000 },
  { agencyName: 'Live Oak Police Department', agencyType: 'Police', city: 'Live Oak', county: 'Sutter', populationEstimate: 9000 },
  { agencyName: 'Wheatland Police Department', agencyType: 'Police', city: 'Wheatland', county: 'Yuba', populationEstimate: 4000 },
  { agencyName: 'Willits Police Department', agencyType: 'Police', city: 'Willits', county: 'Mendocino', populationEstimate: 5000 },
  { agencyName: 'Ferndale Police Department', agencyType: 'Police', city: 'Ferndale', county: 'Humboldt', populationEstimate: 1400 },
  { agencyName: 'Rio Dell Police Department', agencyType: 'Police', city: 'Rio Dell', county: 'Humboldt', populationEstimate: 3000 },
  { agencyName: 'Trinidad Police Department', agencyType: 'Police', city: 'Trinidad', county: 'Humboldt', populationEstimate: 400 },
  { agencyName: 'Mt. Shasta Police Department', agencyType: 'Police', city: 'Mt. Shasta', county: 'Siskiyou', populationEstimate: 3400 },
  { agencyName: 'Weed Police Department', agencyType: 'Police', city: 'Weed', county: 'Siskiyou', populationEstimate: 3000 },
  { agencyName: 'Dunsmuir Police Department', agencyType: 'Police', city: 'Dunsmuir', county: 'Siskiyou', populationEstimate: 1800 },
  { agencyName: 'Dorris Police Department', agencyType: 'Police', city: 'Dorris', county: 'Siskiyou', populationEstimate: 900 },
  { agencyName: 'Tulelake Police Department', agencyType: 'Police', city: 'Tulelake', county: 'Siskiyou', populationEstimate: 1000 },
  { agencyName: 'Etna Police Department', agencyType: 'Police', city: 'Etna', county: 'Siskiyou', populationEstimate: 700 },
  { agencyName: 'Lakeport Police Department', agencyType: 'Police', city: 'Lakeport', county: 'Lake', populationEstimate: 5000 },
  { agencyName: 'Cloverdale Police Department', agencyType: 'Police', city: 'Cloverdale', county: 'Sonoma', populationEstimate: 9000 },
  { agencyName: 'Healdsburg Police Department', agencyType: 'Police', city: 'Healdsburg', county: 'Sonoma', populationEstimate: 12000 },
  { agencyName: 'Sebastopol Police Department', agencyType: 'Police', city: 'Sebastopol', county: 'Sonoma', populationEstimate: 8000 },
  { agencyName: 'Cotati Police Department', agencyType: 'Police', city: 'Cotati', county: 'Sonoma', populationEstimate: 7000 },
  { agencyName: 'Rohnert Park Department of Public Safety', agencyType: 'Police', city: 'Rohnert Park', county: 'Sonoma', populationEstimate: 44000 },
  { agencyName: 'Windsor Police Department', agencyType: 'Police', city: 'Windsor', county: 'Sonoma', populationEstimate: 28000 },
  { agencyName: 'Sonoma Police Department', agencyType: 'Police', city: 'Sonoma', county: 'Sonoma', populationEstimate: 11000 },
  { agencyName: 'St. Helena Police Department', agencyType: 'Police', city: 'St. Helena', county: 'Napa', populationEstimate: 6000 },
  { agencyName: 'Calistoga Police Department', agencyType: 'Police', city: 'Calistoga', county: 'Napa', populationEstimate: 5000 },
  { agencyName: 'American Canyon Police Department', agencyType: 'Police', city: 'American Canyon', county: 'Napa', populationEstimate: 21000 },
  { agencyName: 'Half Moon Bay Police Department', agencyType: 'Police', city: 'Half Moon Bay', county: 'San Mateo', populationEstimate: 12000 },
  { agencyName: 'Burlingame Police Department', agencyType: 'Police', city: 'Burlingame', county: 'San Mateo', populationEstimate: 30000 },
  { agencyName: 'San Bruno Police Department', agencyType: 'Police', city: 'San Bruno', county: 'San Mateo', populationEstimate: 44000 },
  { agencyName: 'Pacifica Police Department', agencyType: 'Police', city: 'Pacifica', county: 'San Mateo', populationEstimate: 39000 },
  { agencyName: 'San Carlos Police Department', agencyType: 'Police', city: 'San Carlos', county: 'San Mateo', populationEstimate: 30000 },
  { agencyName: 'Belmont Police Department', agencyType: 'Police', city: 'Belmont', county: 'San Mateo', populationEstimate: 28000 },
  { agencyName: 'Foster City Police Department', agencyType: 'Police', city: 'Foster City', county: 'San Mateo', populationEstimate: 34000 },
  { agencyName: 'Menlo Park Police Department', agencyType: 'Police', city: 'Menlo Park', county: 'San Mateo', populationEstimate: 35000 },
  { agencyName: 'Atherton Police Department', agencyType: 'Police', city: 'Atherton', county: 'San Mateo', populationEstimate: 7000 },
  { agencyName: 'Hillsborough Police Department', agencyType: 'Police', city: 'Hillsborough', county: 'San Mateo', populationEstimate: 11000 },
  { agencyName: 'Millbrae Police Department', agencyType: 'Police', city: 'Millbrae', county: 'San Mateo', populationEstimate: 23000 },
  { agencyName: 'Colma Police Department', agencyType: 'Police', city: 'Colma', county: 'San Mateo', populationEstimate: 1500 },
  { agencyName: 'Brisbane Police Department', agencyType: 'Police', city: 'Brisbane', county: 'San Mateo', populationEstimate: 5000 },
  { agencyName: 'East Palo Alto Police Department', agencyType: 'Police', city: 'East Palo Alto', county: 'San Mateo', populationEstimate: 30000 },
  { agencyName: 'Sausalito Police Department', agencyType: 'Police', city: 'Sausalito', county: 'Marin', populationEstimate: 7000 },
  { agencyName: 'Tiburon Police Department', agencyType: 'Police', city: 'Tiburon', county: 'Marin', populationEstimate: 9000 },
  { agencyName: 'Mill Valley Police Department', agencyType: 'Police', city: 'Mill Valley', county: 'Marin', populationEstimate: 14000 },
  { agencyName: 'Fairfax Police Department', agencyType: 'Police', city: 'Fairfax', county: 'Marin', populationEstimate: 8000 },
  { agencyName: 'San Anselmo Police Department', agencyType: 'Police', city: 'San Anselmo', county: 'Marin', populationEstimate: 13000 },
  { agencyName: 'Corte Madera Police Department', agencyType: 'Police', city: 'Corte Madera', county: 'Marin', populationEstimate: 10000 },
  { agencyName: 'Larkspur Police Department', agencyType: 'Police', city: 'Larkspur', county: 'Marin', populationEstimate: 13000 },
  { agencyName: 'Ross Police Department', agencyType: 'Police', city: 'Ross', county: 'Marin', populationEstimate: 2500 },
  { agencyName: 'Central Marin Police Authority', agencyType: 'Police', city: 'Larkspur', county: 'Marin', populationEstimate: 23000 },
  { agencyName: 'Southern Marin Fire Protection District Police', agencyType: 'Other', county: 'Marin' },
  { agencyName: 'Piedmont Police Department', agencyType: 'Police', city: 'Piedmont', county: 'Alameda', populationEstimate: 11000 },
  { agencyName: 'Albany Police Department', agencyType: 'Police', city: 'Albany', county: 'Alameda', populationEstimate: 20000 },
  { agencyName: 'Los Altos Police Department', agencyType: 'Police', city: 'Los Altos', county: 'Santa Clara', populationEstimate: 31000 },
  { agencyName: 'Saratoga Police Department', agencyType: 'Police', city: 'Saratoga', county: 'Santa Clara', populationEstimate: 31000 },
  { agencyName: 'Monte Sereno Police Department', agencyType: 'Police', city: 'Monte Sereno', county: 'Santa Clara', populationEstimate: 4000 },
  { agencyName: 'Los Altos Hills Police Department', agencyType: 'Police', city: 'Los Altos Hills', county: 'Santa Clara', populationEstimate: 8000 },

  // === ADDITIONAL UNIVERSITY / CSU POLICE ===
  { agencyName: 'San Diego State University Police Department', agencyType: 'University', city: 'San Diego', county: 'San Diego' },
  { agencyName: 'San Jose State University Police Department', agencyType: 'University', city: 'San Jose', county: 'Santa Clara' },
  { agencyName: 'San Francisco State University Police Department', agencyType: 'University', city: 'San Francisco', county: 'San Francisco' },
  { agencyName: 'Cal State Fullerton University Police', agencyType: 'University', city: 'Fullerton', county: 'Orange' },
  { agencyName: 'Cal State Long Beach University Police', agencyType: 'University', city: 'Long Beach', county: 'Los Angeles' },
  { agencyName: 'Cal State Northridge University Police', agencyType: 'University', city: 'Northridge', county: 'Los Angeles' },
  { agencyName: 'Cal Poly San Luis Obispo University Police', agencyType: 'University', city: 'San Luis Obispo', county: 'San Luis Obispo' },
  { agencyName: 'Cal Poly Pomona University Police', agencyType: 'University', city: 'Pomona', county: 'Los Angeles' },
  { agencyName: 'Cal State Sacramento University Police', agencyType: 'University', city: 'Sacramento', county: 'Sacramento' },
  { agencyName: 'Cal State Los Angeles University Police', agencyType: 'University', city: 'Los Angeles', county: 'Los Angeles' },
  { agencyName: 'Cal State Fresno University Police', agencyType: 'University', city: 'Fresno', county: 'Fresno' },
  { agencyName: 'Cal State East Bay University Police', agencyType: 'University', city: 'Hayward', county: 'Alameda' },
  { agencyName: 'Humboldt State University Police Department', agencyType: 'University', city: 'Arcata', county: 'Humboldt' },
  { agencyName: 'Cal State San Bernardino University Police', agencyType: 'University', city: 'San Bernardino', county: 'San Bernardino' },
  { agencyName: 'Cal State Bakersfield University Police', agencyType: 'University', city: 'Bakersfield', county: 'Kern' },
  { agencyName: 'Cal State Dominguez Hills University Police', agencyType: 'University', city: 'Carson', county: 'Los Angeles' },
  { agencyName: 'Cal State Stanislaus University Police', agencyType: 'University', city: 'Turlock', county: 'Stanislaus' },
  { agencyName: 'Cal State Chico University Police', agencyType: 'University', city: 'Chico', county: 'Butte' },
  { agencyName: 'Cal State Monterey Bay University Police', agencyType: 'University', city: 'Seaside', county: 'Monterey' },
  { agencyName: 'Sonoma State University Police Department', agencyType: 'University', city: 'Rohnert Park', county: 'Sonoma' },
  { agencyName: 'Cal State San Marcos University Police', agencyType: 'University', city: 'San Marcos', county: 'San Diego' },
  { agencyName: 'Cal State Channel Islands University Police', agencyType: 'University', city: 'Camarillo', county: 'Ventura' },

  // === COMMUNITY COLLEGE POLICE ===
  { agencyName: 'Los Angeles Community College District Police', agencyType: 'College', city: 'Los Angeles', county: 'Los Angeles' },
  { agencyName: 'San Diego Community College District Police', agencyType: 'College', city: 'San Diego', county: 'San Diego' },
  { agencyName: 'Peralta Community College District Police', agencyType: 'College', city: 'Oakland', county: 'Alameda' },
  { agencyName: 'Foothill-De Anza Community College District Police', agencyType: 'College', city: 'Los Altos Hills', county: 'Santa Clara' },
  { agencyName: 'Rancho Santiago Community College District Police', agencyType: 'College', city: 'Santa Ana', county: 'Orange' },
  { agencyName: 'San Mateo County Community College District Police', agencyType: 'College', city: 'San Mateo', county: 'San Mateo' },
  { agencyName: 'Contra Costa Community College District Police', agencyType: 'College', city: 'Martinez', county: 'Contra Costa' },
  { agencyName: 'Mt. San Antonio College Police Department', agencyType: 'College', city: 'Walnut', county: 'Los Angeles' },
  { agencyName: 'Santa Monica College Police Department', agencyType: 'College', city: 'Santa Monica', county: 'Los Angeles' },
  { agencyName: 'Pasadena City College Police Department', agencyType: 'College', city: 'Pasadena', county: 'Los Angeles' },
  { agencyName: 'El Camino College Police Department', agencyType: 'College', city: 'Torrance', county: 'Los Angeles' },

  // === ADDITIONAL SCHOOL DISTRICT POLICE ===
  { agencyName: 'Riverside Unified School District Police', agencyType: 'School', city: 'Riverside', county: 'Riverside' },
  { agencyName: 'Bakersfield City School District Police', agencyType: 'School', city: 'Bakersfield', county: 'Kern' },
  { agencyName: 'Kern High School District Police', agencyType: 'School', city: 'Bakersfield', county: 'Kern' },
  { agencyName: 'Modesto City Schools Police', agencyType: 'School', city: 'Modesto', county: 'Stanislaus' },
  { agencyName: 'Elk Grove Unified School District Police', agencyType: 'School', city: 'Elk Grove', county: 'Sacramento' },
  { agencyName: 'Moreno Valley Unified School District Police', agencyType: 'School', city: 'Moreno Valley', county: 'Riverside' },
  { agencyName: 'Fontana Unified School District Police', agencyType: 'School', city: 'Fontana', county: 'San Bernardino' },
  { agencyName: 'Pomona Unified School District Police', agencyType: 'School', city: 'Pomona', county: 'Los Angeles' },
  { agencyName: 'Corona-Norco Unified School District Police', agencyType: 'School', city: 'Norco', county: 'Riverside' },
  { agencyName: 'Clovis Unified School District Police', agencyType: 'School', city: 'Clovis', county: 'Fresno' },

  // === ADDITIONAL TRANSIT POLICE ===
  { agencyName: 'Metrolink Railroad Police', agencyType: 'Transit', city: 'Los Angeles', county: 'Los Angeles' },
  { agencyName: 'Amtrak Police — California Division', agencyType: 'Transit', county: 'Sacramento' },
  { agencyName: 'Santa Clara Valley Transportation Authority Police', agencyType: 'Transit', city: 'San Jose', county: 'Santa Clara' },
  { agencyName: 'Altamont Corridor Express Security', agencyType: 'Transit', city: 'Stockton', county: 'San Joaquin' },
  { agencyName: 'Caltrain Security Services', agencyType: 'Transit', city: 'San Carlos', county: 'San Mateo' },

  // === ADDITIONAL AIRPORT POLICE ===
  { agencyName: 'Burbank Bob Hope Airport Police', agencyType: 'Airport', city: 'Burbank', county: 'Los Angeles' },
  { agencyName: 'Fresno Yosemite International Airport Police', agencyType: 'Airport', city: 'Fresno', county: 'Fresno' },
  { agencyName: 'Palm Springs International Airport Police', agencyType: 'Airport', city: 'Palm Springs', county: 'Riverside' },
  { agencyName: 'Santa Barbara Airport Police', agencyType: 'Airport', city: 'Santa Barbara', county: 'Santa Barbara' },
  { agencyName: 'Monterey Regional Airport Police', agencyType: 'Airport', city: 'Monterey', county: 'Monterey' },

  // === ADDITIONAL PARK RANGERS / SPECIAL DISTRICT POLICE ===
  { agencyName: 'Midpeninsula Regional Open Space District Rangers', agencyType: 'Park', county: 'Santa Clara' },
  { agencyName: 'Orange County Parks Rangers', agencyType: 'Park', county: 'Orange' },
  { agencyName: 'San Diego County Parks Rangers', agencyType: 'Park', county: 'San Diego' },
  { agencyName: 'Los Angeles County Parks Rangers', agencyType: 'Park', county: 'Los Angeles' },
  { agencyName: 'Marin County Parks Rangers', agencyType: 'Park', county: 'Marin' },
  { agencyName: 'Santa Clara County Parks Rangers', agencyType: 'Park', county: 'Santa Clara' },

  // === ADDITIONAL SPECIAL DISTRICT POLICE ===
  { agencyName: 'Port of Long Beach Police', agencyType: 'Port', city: 'Long Beach', county: 'Los Angeles' },
  { agencyName: 'Port of San Diego Harbor Police', agencyType: 'Port', city: 'San Diego', county: 'San Diego' },
  { agencyName: 'Port of Stockton Police', agencyType: 'Port', city: 'Stockton', county: 'San Joaquin' },
  { agencyName: 'East Bay Municipal Utility District Police', agencyType: 'Other', county: 'Alameda' },
  { agencyName: 'San Francisco Bay Conservation and Development Commission', agencyType: 'Other', county: 'San Francisco' },
  { agencyName: 'California State University Police — Chancellors Office', agencyType: 'University', city: 'Long Beach', county: 'Los Angeles' },
];

// ---------------------------------------------------------------------------
// Main Seed Function
// ---------------------------------------------------------------------------

async function seedAgencyDirectory(): Promise<void> {
  console.log(`[Agency Seed] Starting — ${CALIFORNIA_AGENCIES.length} agencies to seed`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const agency of CALIFORNIA_AGENCIES) {
    try {
      // Check if agency already exists (by name + county)
      const existing = await prisma.agency.findFirst({
        where: {
          agencyName: agency.agencyName,
          county: agency.county,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.agency.create({
        data: {
          agencyName: agency.agencyName,
          agencyType: agency.agencyType,
          city: agency.city,
          county: agency.county,
          populationEstimate: agency.populationEstimate,
          website: agency.website,
          crawlStatus: 'pending',
        },
      });
      created++;
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      // Unique constraint violations are expected for duplicates
      if (!msg.includes('Unique constraint')) {
        console.error(`  [Error] ${agency.agencyName}: ${msg}`);
      } else {
        skipped++;
      }
    }
  }

  console.log(`[Agency Seed] Complete: ${created} created, ${skipped} skipped, ${errors} errors`);

  // Also create AgencyPolicyStatus for each new agency
  const allAgencies = await prisma.agency.findMany({ select: { agencyId: true, agencyName: true, city: true, county: true, website: true } });
  let statusCreated = 0;
  for (const a of allAgencies) {
    try {
      await prisma.agencyPolicyStatus.upsert({
        where: { agencyId: a.agencyId },
        update: {},
        create: {
          agencyId: a.agencyId,
          agencyName: a.agencyName,
          city: a.city,
          county: a.county,
          website: a.website,
          cpraStatus: 'none',
        },
      });
      statusCreated++;
    } catch {
      // Skip errors for existing records
    }
  }
  console.log(`[Agency Seed] AgencyPolicyStatus records: ${statusCreated} upserted`);
}

// Run
seedAgencyDirectory()
  .then(() => {
    console.log('[Agency Seed] Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Agency Seed] Fatal error:', err);
    process.exit(1);
  });
