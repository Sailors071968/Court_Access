// ============================================================================
// Narrative Deconstruction Engine — Worker 2: Claim Normalization
// Converts raw claims into standardized ontology events compatible
// with the timeline engine.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import type { ClaimNormalizationJob } from './narrativeProcessingPipeline.js';
import { enqueueEvidenceValidation } from './narrativeProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Event Type Ontology
// ---------------------------------------------------------------------------

const ACTION_TO_EVENT_TYPE: Record<string, string> = {
  // Weapon actions
  raised: 'WeaponRaised',
  brandished: 'WeaponBrandished',
  pointed: 'WeaponPointed',
  drew: 'WeaponDrawn',
  fired: 'WeaponFired',
  discharged: 'WeaponDischarged',
  shot: 'WeaponFired',

  // Movement
  ran: 'SubjectFled',
  fled: 'SubjectFled',
  walked: 'SubjectMoved',
  approached: 'SubjectApproached',
  advanced: 'SubjectAdvanced',
  retreated: 'SubjectRetreated',
  turned: 'SubjectTurned',

  // Force
  struck: 'ForceUsed',
  punched: 'ForceUsed',
  kicked: 'ForceUsed',
  tackled: 'ForceUsed',
  tased: 'TaserDeployed',
  'deployed taser': 'TaserDeployed',
  'pepper sprayed': 'OcSprayDeployed',

  // Verbal
  said: 'VerbalStatement',
  stated: 'VerbalStatement',
  yelled: 'VerbalCommand',
  screamed: 'VerbalCommand',
  ordered: 'VerbalCommand',
  commanded: 'VerbalCommand',
  told: 'VerbalStatement',
  advised: 'MirandaAdvisement',

  // Observation
  observed: 'Observation',
  saw: 'Observation',
  noticed: 'Observation',
  witnessed: 'Observation',

  // Arrival
  arrived: 'OfficerArrival',
  responded: 'OfficerArrival',
  'on scene': 'OfficerArrival',

  // Arrest/Detention
  arrested: 'Arrest',
  detained: 'Detention',
  handcuffed: 'Handcuffing',
  'placed under arrest': 'Arrest',

  // Search/Seizure
  searched: 'Search',
  'pat down': 'PatDown',
  frisked: 'PatDown',
  seized: 'Seizure',
  confiscated: 'Seizure',
  recovered: 'EvidenceRecovery',
  found: 'EvidenceRecovery',
  located: 'EvidenceRecovery',
  discovered: 'EvidenceRecovery',

  // Vehicle
  stopped: 'VehicleStop',
  'pulled over': 'VehicleStop',
  'traffic stop': 'TrafficStop',

  // Pursuit
  chased: 'Pursuit',
  pursued: 'Pursuit',

  // Compliance
  complied: 'SubjectComplied',
  surrendered: 'SubjectSurrendered',
  resisted: 'SubjectResisted',

  // Medical
  'called ambulance': 'MedicalRequested',
  'administered first aid': 'FirstAidAdministered',
  cpr: 'CPRAdministered',
  transported: 'MedicalTransport',
  'transported to hospital': 'MedicalTransport',
  'requested medical': 'MedicalRequested',
};

// ---------------------------------------------------------------------------
// Normalization Logic
// ---------------------------------------------------------------------------

function normalizeAction(rawAction: string): string {
  const lower = rawAction.toLowerCase().trim();

  // Direct match
  if (ACTION_TO_EVENT_TYPE[lower]) {
    return ACTION_TO_EVENT_TYPE[lower];
  }

  // Word-boundary partial match (avoids substring false positives like 'transported' matching 'ran')
  for (const [key, eventType] of Object.entries(ACTION_TO_EVENT_TYPE)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`);
    if (regex.test(lower)) {
      return eventType;
    }
  }

  return 'OtherAction';
}

function normalizeActor(subject: string): string {
  const lower = subject.toLowerCase();
  if (lower.includes('officer') || lower.includes('deputy') || lower.includes('detective') || lower.includes('sergeant')) {
    return subject; // Keep the specific officer name
  }
  if (lower.includes('suspect') || lower.includes('defendant')) {
    return 'Suspect';
  }
  if (lower.includes('victim')) {
    return 'Victim';
  }
  if (lower.includes('witness')) {
    return 'Witness';
  }
  if (lower.includes('reporting')) {
    return 'Reporting Officer';
  }
  return subject;
}

// ---------------------------------------------------------------------------
// Worker Processor
// ---------------------------------------------------------------------------

export async function processClaimNormalization(
  job: ClaimNormalizationJob,
  options?: { enqueueDownstream?: boolean },
): Promise<{
  eventsNormalized: number;
}> {
  console.log(`[ClaimNormalization] Processing claims for case ${job.caseId}`);

  // Fetch all claims for this case that don't yet have normalized events
  const claims = await prisma.narrativeClaim.findMany({
    where: { caseId: job.caseId, tenantId: job.tenantId },
  });

  if (claims.length === 0) {
    console.log(`[ClaimNormalization] No claims found for case ${job.caseId}`);
    return { eventsNormalized: 0 };
  }

  // Check which claims already have normalized events
  const existingNormalized = await prisma.normalizedClaimEvent.findMany({
    where: { caseId: job.caseId, tenantId: job.tenantId },
    select: { claimId: true },
  });
  const normalizedClaimIds = new Set(existingNormalized.map((e) => e.claimId));

  let count = 0;
  for (const claim of claims) {
    if (normalizedClaimIds.has(claim.claimId)) {
      continue; // Already normalized
    }

    const eventType = normalizeAction(claim.action);
    const actor = normalizeActor(claim.subject);

    await prisma.normalizedClaimEvent.create({
      data: {
        claimId: claim.claimId,
        caseId: claim.caseId,
        tenantId: claim.tenantId,
        eventType,
        actor,
        actionNorm: eventType,
        object: claim.object,
        target: claim.target,
        confidence: claim.confidence,
      },
    });
    count++;
  }

  console.log(`[ClaimNormalization] Normalized ${count} claims for case ${job.caseId}`);

  // Trigger evidence validation (queue-chained worker mode)
  if (options?.enqueueDownstream !== false) {
    try {
      await enqueueEvidenceValidation({
        caseId: job.caseId,
        tenantId: job.tenantId,
      });
    } catch (err) {
      console.error(`[ClaimNormalization] Failed to enqueue validation:`, err);
    }
  }

  return { eventsNormalized: count };
}
