// ============================================
// Court Access — Agency Directory Module Barrel
// ============================================

export { registerAgencyRoutes } from './agencyRoutes.js';
export {
  listAgencies,
  getAgencyById,
  createAgency,
  updateAgency,
  deleteAgency,
  getAgencyStats,
  getDistinctCounties,
} from './agencyService.js';
export { allCaliforniaAgencies } from './californiaAgencies.js';
export type {
  AgencyRecord,
  AgencyFilter,
  PaginatedAgencyResult,
  CreateAgencyInput,
  UpdateAgencyInput,
  AgencyStats,
  AgencyType,
  SeedAgency,
} from './types.js';
