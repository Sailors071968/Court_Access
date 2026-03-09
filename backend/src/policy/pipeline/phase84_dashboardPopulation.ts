// ============================================================================
// Phase 84 — Dashboard Population
// Populate all 4 dashboard pages with real metrics from the intelligence system.
// Usage: npx tsx backend/src/policy/pipeline/phase84_dashboardPopulation.ts
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { getPipelineStats } from './pipelineOrchestrator.js';
import { getSystemCoverageStats } from '../taxonomy/policyCoverageTracker.js';
import { getCoverageSummary } from '../taxonomy/coveragePopulator.js';
import { getClassificationAccuracySummary } from './classificationValidator.js';
import { getCpraQueueStatus } from './cpraRequestPreparation.js';
import { getActiveCampaignStatus } from './cpraCampaignLauncher.js';
import { getResponsePipelineHealth } from './documentResponsePipeline.js';
import { getChpImportStatus } from './chpPolicyImportService.js';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(80));
  console.log('Phase 84 — Dashboard Population');
  console.log('Populating: policy-intelligence, policy-acquisition, system-health, cpra');
  console.log('='.repeat(80));
  console.log();

  // -------------------------------------------------------------------------
  // Page 1: Policy Intelligence Dashboard
  // -------------------------------------------------------------------------
  console.log('━'.repeat(60));
  console.log('Dashboard: /dashboard/policy-intelligence');
  console.log('━'.repeat(60));

  try {
    const coverageStats = await getSystemCoverageStats();
    const coverageSummary = await getCoverageSummary();
    const classificationAccuracy = await getClassificationAccuracySummary();
    const chpStatus = await getChpImportStatus();

    console.log();
    console.log('  System Coverage:');
    console.log(`    Total Topics:          ${coverageStats.totalTopics}`);
    console.log(`    Total Agencies:        ${coverageStats.totalAgencies}`);
    console.log(`    Avg Coverage:          ${coverageStats.averageCoveragePercent.toFixed(1)}%`);
    console.log(`    Full Coverage:         ${coverageStats.agenciesWithFullCoverage}`);
    console.log(`    Partial Coverage:      ${coverageStats.agenciesWithPartialCoverage}`);
    console.log(`    No Coverage:           ${coverageStats.agenciesWithNoCoverage}`);

    console.log();
    console.log('  Coverage Summary:');
    console.log(`    Total Agencies:        ${coverageSummary.totalAgencies}`);
    console.log(`    Agencies w/ Coverage:  ${coverageSummary.agenciesWithCoverage}`);
    console.log(`    Total Topics:          ${coverageSummary.totalTopics}`);
    console.log(`    Avg Coverage:          ${coverageSummary.averageCoveragePercent.toFixed(1)}%`);

    console.log();
    console.log('  Classification Accuracy:');
    console.log(`    Documents Classified:  ${classificationAccuracy.totalClassified}`);
    console.log(`    Avg Confidence:        ${(classificationAccuracy.averageConfidence * 100).toFixed(1)}%`);
    console.log(`    High Confidence %:     ${classificationAccuracy.highConfidencePercent.toFixed(1)}%`);
    console.log(`    Estimated Accuracy:    ${classificationAccuracy.estimatedAccuracy.toFixed(1)}%`);
    console.log(`    Above 85% Threshold:   ${classificationAccuracy.aboveThreshold ? 'YES' : 'NO'}`);

    console.log();
    console.log('  CHP Baseline:');
    console.log(`    Import Complete:       ${chpStatus.isComplete}`);
    console.log(`    Total Documents:       ${chpStatus.totalDocuments}`);
    console.log(`    Classified:            ${chpStatus.classifiedDocuments}`);
    console.log(`    Coverage Entries:      ${chpStatus.coverageEntries}`);
    console.log(`    Topics Seeded:         ${chpStatus.topicsSeeded}`);
  } catch (error) {
    console.error('  Error loading policy intelligence data:', error);
  }

  // -------------------------------------------------------------------------
  // Page 2: Policy Acquisition Dashboard
  // -------------------------------------------------------------------------
  console.log();
  console.log('━'.repeat(60));
  console.log('Dashboard: /dashboard/policy-acquisition');
  console.log('━'.repeat(60));

  try {
    const pipelineStats = await getPipelineStats();

    console.log();
    console.log('  Pipeline Statistics:');
    console.log(`    Total Agencies:        ${pipelineStats.totalAgencies}`);
    console.log(`    Websites Found:        ${pipelineStats.websitesFound}`);
    console.log(`    Sites Crawled:         ${pipelineStats.sitesCrawled}`);
    console.log(`    Crawl In Progress:     ${pipelineStats.crawlInProgress}`);
    console.log(`    Crawl Failed:          ${pipelineStats.crawlFailed}`);
    console.log(`    Documents Found:       ${pipelineStats.documentsFound}`);
    console.log(`    Documents Downloaded:  ${pipelineStats.documentsDownloaded}`);
    console.log(`    Documents OCR'd:       ${pipelineStats.documentsOcr}`);
    console.log(`    Documents Classified:  ${pipelineStats.documentsClassified}`);

    // Additional counts
    const [totalPolicies, ocrPending, classificationPending] = await Promise.all([
      prisma.policyDocument.count(),
      prisma.policyDocument.count({ where: { ocrStatus: 'pending' } }),
      prisma.policyDocument.count({ where: { classificationStatus: 'pending' } }),
    ]);

    console.log();
    console.log('  Document Pipeline Status:');
    console.log(`    Total Policy Docs:     ${totalPolicies}`);
    console.log(`    OCR Pending:           ${ocrPending}`);
    console.log(`    Classification Pending: ${classificationPending}`);
  } catch (error) {
    console.error('  Error loading acquisition data:', error);
  }

  // -------------------------------------------------------------------------
  // Page 3: System Health Dashboard
  // -------------------------------------------------------------------------
  console.log();
  console.log('━'.repeat(60));
  console.log('Dashboard: /dashboard/system-health');
  console.log('━'.repeat(60));

  try {
    const pipelineHealth = await getResponsePipelineHealth();

    console.log();
    console.log('  Pipeline Health:');
    console.log(`    Inbound Email:         ${pipelineHealth.inboundEmailStatus}`);
    console.log(`    OCR Pipeline:          ${pipelineHealth.ocrStatus}`);
    console.log(`    Classification:        ${pipelineHealth.classificationStatus}`);
    console.log(`    Coverage Updates:      ${pipelineHealth.coverageUpdateStatus}`);
    console.log(`    Pending OCR:           ${pipelineHealth.pendingOcr}`);
    console.log(`    Pending Classification: ${pipelineHealth.pendingClassification}`);
    console.log(`    Recent Responses:      ${pipelineHealth.recentResponses}`);
    console.log(`    Last Response:         ${pipelineHealth.lastResponseAt || 'None'}`);

    // Database health
    const [agencyCount, docCount, topicCount, coverageCount] = await Promise.all([
      prisma.agency.count(),
      prisma.policyDocument.count(),
      prisma.policyTopic.count(),
      prisma.policyCoverage.count(),
    ]);

    console.log();
    console.log('  Database Health:');
    console.log(`    Agencies:              ${agencyCount}`);
    console.log(`    Policy Documents:      ${docCount}`);
    console.log(`    Policy Topics:         ${topicCount}`);
    console.log(`    Coverage Entries:      ${coverageCount}`);
  } catch (error) {
    console.error('  Error loading system health data:', error);
  }

  // -------------------------------------------------------------------------
  // Page 4: CPRA Dashboard
  // -------------------------------------------------------------------------
  console.log();
  console.log('━'.repeat(60));
  console.log('Dashboard: /dashboard/cpra');
  console.log('━'.repeat(60));

  try {
    const cpraQueue = await getCpraQueueStatus();
    const campaignStatus = await getActiveCampaignStatus();

    console.log();
    console.log('  CPRA Queue Status:');
    console.log(`    Pending Requests:      ${cpraQueue.pendingRequests}`);
    console.log(`    Sent Requests:         ${cpraQueue.sentRequests}`);
    console.log(`    Responses Received:    ${cpraQueue.responsesReceived}`);
    console.log(`    Closed Requests:       ${cpraQueue.closedRequests}`);
    console.log(`    Agencies in Queue:     ${cpraQueue.agenciesInQueue}`);

    console.log();
    console.log('  Campaign Status:');
    console.log(`    Active Campaigns:      ${campaignStatus.activeCampaigns}`);
    console.log(`    Total Requests Sent:   ${campaignStatus.totalRequestsSent}`);
    console.log(`    Responses Received:    ${campaignStatus.totalResponsesReceived}`);
    console.log(`    Pending Follow-Ups:    ${campaignStatus.pendingFollowUps}`);
    console.log(`    Daily Send Count:      ${campaignStatus.dailySendCount}/${campaignStatus.dailyLimit}`);
    if (campaignStatus.campaigns.length > 0) {
      console.log();
      console.log('  Campaign Details:');
      for (const c of campaignStatus.campaigns) {
        console.log(`    ${c.campaignName}: ${c.sentCount}/${c.requestCount} sent, ${c.respondedCount} responded, ${c.closedCount} closed`);
      }
    }
  } catch (error) {
    console.error('  Error loading CPRA data:', error);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log();
  console.log('='.repeat(80));
  console.log('Dashboard Population Summary');
  console.log('='.repeat(80));

  try {
    const [agencies, docs, topics, coverage, campaigns, requests] = await Promise.all([
      prisma.agency.count(),
      prisma.policyDocument.count(),
      prisma.policyTopic.count(),
      prisma.policyCoverage.count(),
      prisma.cPRARequestCampaign.count(),
      prisma.cPRAAgencyRequest.count(),
    ]);

    console.log();
    console.log(`  Agencies Indexed:        ${agencies}`);
    console.log(`  Policies Discovered:     ${docs}`);
    console.log(`  Policy Topics:           ${topics}`);
    console.log(`  Coverage Matrix Entries: ${coverage}`);
    console.log(`  CPRA Campaigns:          ${campaigns}`);
    console.log(`  CPRA Requests:           ${requests}`);
    console.log();
    console.log('  All 4 dashboard pages ready for data display.');
  } catch (error) {
    console.error('  Error generating summary:', error);
  }

  console.log();
  console.log('='.repeat(80));
  console.log('Phase 84 Complete');
  console.log('='.repeat(80));

  await prisma.$disconnect();
  process.exit(0);
}

main();
