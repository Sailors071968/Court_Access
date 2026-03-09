// ---------------------------------------------------------------------------
// CPRA Request System — Public API
// Phases 31-45: Autonomous CPRA request engine
// ---------------------------------------------------------------------------

// Services
export {
  sendCpraRequestEmail,
  sendFollowUpEmail,
  sendThankYouEmail,
  loadTemplate,
  mergeTemplate,
  type TemplateVariables,
  type SendResult,
} from './services/cpraEmailSender.js';

export {
  CPRA_SAFEGUARDS,
  checkDailyLimit,
  checkMinuteLimit,
  checkDuplicateRequest,
  checkFollowUpEligibility,
  getCpraSafetyStatus,
  type CpraSafeguards,
} from './services/cpraSafeguards.js';

export {
  addBusinessDays,
  countBusinessDays,
  calculateDeadline,
  getDeadlineInfo,
  findOverdueRequests,
  getCampaignDeadlineSummary,
  type DeadlineInfo,
  type CampaignDeadlineSummary,
} from './services/cpraDeadlineService.js';

export {
  processIncomingCpraResponse,
  markResponseReceived,
  closeRequestNoResponse,
  getCpraRequestStatus,
  type CpraResponseResult,
  type DocumentAttachment,
} from './services/cpraResponseProcessor.js';

export {
  scheduleAnnualPolicyUpdate,
  findDueAnnualUpdates,
  findAnnualUpdatesNeedingFollowUp,
  markAnnualUpdateReceived,
  restartAnnualCycle,
  getAnnualUpdateSummary,
} from './services/cpraAnnualUpdateService.js';

// Workers
export {
  createCpraCampaignWorker,
  enqueueCampaignBatch,
  scheduleOverdueCheck,
  CPRA_CAMPAIGN_QUEUE,
  type CpraCampaignJobData,
  type CpraCampaignResult,
} from './workers/cpraCampaignWorker.js';

export {
  createCpraAnnualUpdateWorker,
  scheduleDailyAnnualCheck,
  CPRA_ANNUAL_UPDATE_QUEUE,
  type CpraAnnualJobData,
  type CpraAnnualJobResult,
} from './workers/cpraAnnualUpdateWorker.js';

// Route handlers
export {
  handleCreateCampaign,
  handleGetCampaigns,
  handleGetCampaignDetail,
  handleLaunchCampaign,
  handleMarkResponseReceived,
  handleCloseRequest,
  handleGetRequestStatus,
  handleGetCpraDashboard,
  handleProcessOverdue,
  handleGetAnnualUpdateDashboard,
  handleGetAnnualUpdates,
  handleMarkAnnualUpdateReceived,
  handleTriggerAnnualCheck,
} from './cpraRoutes.js';
