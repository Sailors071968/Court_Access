// ============================================
// Court Access — Timeline Conflict Detection
// Phase 128: Detect contradictions in timelines
// Examples: GPS vs Witness Time, Officer Report vs Surveillance
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Detect timeline conflicts for a case.
 * @param {string} caseId
 * @returns {{ conflicts: object[], summary: object }}
 */
export async function detectTimelineConflicts(caseId) {
  console.log(`[TimelineConflict] Detecting conflicts for case ${caseId}`);

  const timeline = await prisma.courtTimelineEvent.findMany({
    where: { caseId },
    orderBy: { time: 'asc' },
  });

  const conflicts = [];
  const WINDOW_MS = 15 * 60 * 1000;

  for (let i = 0; i < timeline.length; i++) {
    for (let j = i + 1; j < timeline.length; j++) {
      const timeDiff = Math.abs(new Date(timeline[j].time).getTime() - new Date(timeline[i].time).getTime());
      if (timeDiff > WINDOW_MS) continue;

      const sourceA = getSourceType(timeline[i]);
      const sourceB = getSourceType(timeline[j]);

      if (sourceA !== sourceB && hasConflictingContent(timeline[i].event, timeline[j].event)) {
        const conflictType = categorizeConflict(sourceA, sourceB);
        conflicts.push({
          caseId,
          conflictType,
          description: `"${timeline[i].event.substring(0, 80)}" vs "${timeline[j].event.substring(0, 80)}" (${Math.round(timeDiff / 60000)} min apart)`,
          eventAId: timeline[i].id,
          eventBId: timeline[j].id,
          sourceAType: sourceA,
          sourceBType: sourceB,
          severity: calculateSeverity(conflictType, timeDiff),
          metadata: { timeDiffMs: timeDiff },
        });
      }
    }
  }

  const stored = [];
  for (const conflict of conflicts) {
    try {
      const record = await prisma.timelineConflict.create({ data: conflict });
      stored.push(record);
    } catch (err) {
      console.warn(`[TimelineConflict] Store error: ${err.message}`);
    }
  }

  console.log(`[TimelineConflict] Found ${stored.length} conflicts for case ${caseId}`);

  return {
    conflicts: stored,
    summary: {
      total: stored.length,
      bySeverity: {
        critical: stored.filter(c => c.severity === 'critical').length,
        high: stored.filter(c => c.severity === 'high').length,
        medium: stored.filter(c => c.severity === 'medium').length,
        low: stored.filter(c => c.severity === 'low').length,
      },
    },
  };
}

function getSourceType(event) {
  const meta = event.metadata || {};
  if (typeof meta === 'object' && meta.source) return meta.source;
  const t = event.event.toLowerCase();
  if (t.includes('gps') || t.includes('location data')) return 'gps';
  if (t.includes('witness') || t.includes('testified')) return 'witness_statement';
  if (t.includes('officer') || t.includes('report')) return 'officer_report';
  if (t.includes('surveillance') || t.includes('camera')) return 'surveillance';
  return 'unknown';
}

function categorizeConflict(sourceA, sourceB) {
  const pair = [sourceA, sourceB].sort().join('_vs_');
  const typeMap = {
    'gps_vs_witness_statement': 'gps_vs_witness',
    'officer_report_vs_surveillance': 'officer_vs_surveillance',
    'gps_vs_officer_report': 'gps_vs_officer',
    'surveillance_vs_witness_statement': 'surveillance_vs_witness',
  };
  return typeMap[pair] || 'time_impossibility';
}

function hasConflictingContent(textA, textB) {
  const OPPOSING = [
    ['arrived', 'departed'], ['present', 'absent'], ['inside', 'outside'],
    ['before', 'after'], ['left', 'entered'], ['saw', 'did not see'],
    ['armed', 'unarmed'], ['conscious', 'unconscious'],
  ];
  const a = textA.toLowerCase();
  const b = textB.toLowerCase();

  for (const [termA, termB] of OPPOSING) {
    if ((a.includes(termA) && b.includes(termB)) || (a.includes(termB) && b.includes(termA))) return true;
  }

  const negPattern = /\b(?:not|never|no|didn't|wasn't|weren't)\b/;
  if (negPattern.test(a) !== negPattern.test(b)) {
    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 4));
    const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 4));
    let overlap = 0;
    for (const w of wordsA) { if (wordsB.has(w)) overlap++; }
    if (overlap >= 2) return true;
  }
  return false;
}

function calculateSeverity(conflictType, timeDiffMs) {
  if (conflictType === 'gps_vs_witness' || conflictType === 'officer_vs_surveillance') return 'critical';
  if (timeDiffMs < 5 * 60 * 1000) return 'high';
  if (timeDiffMs < 10 * 60 * 1000) return 'medium';
  return 'low';
}

export async function getCaseTimelineConflicts(caseId) {
  return prisma.timelineConflict.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
}
