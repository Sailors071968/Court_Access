// ============================================
// Court Access — Campaign Engine Barrel Export
// ============================================

export { registerCampaignRoutes } from './campaignRoutes.js';
export { sendCampaign } from './campaignService.js';
export { startScheduler, stopScheduler, getSchedulerStatus } from './campaignScheduler.js';
export { sendCpraEmail } from './emailSender.js';
export {
  generateTrackingId,
  createPolicyRequest,
  updateRequestStatus,
  getRequestByTrackingId,
  listPolicyRequests,
  getCampaignStats,
  countSentThisHour,
  getAgenciesWithoutRequests,
} from './requestTracker.js';
export type {
  PolicyRequestStatus,
  PolicyRequestRecord,
  CampaignFilter,
  PaginatedRequestResult,
  CampaignStats,
  SendCampaignInput,
  SendResult,
  CampaignBatchResult,
  RateLimitConfig,
} from './types.js';
