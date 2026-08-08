#!/usr/bin/env node
// Confirms that when an instruction does exist, elements are organised from
// real timeline events, and that an element is never marked supported without
// evidence behind it.

import { req, registerUser, login } from '../lib/harness.mjs';
import { PrismaClient } from '../../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const u = await registerUser({ prefix: 'cal-mapped', defaultRole: 'attorney' });
const s = await login(u.email, u.password);
const token = s.token;

const r = await req('POST', '/api/cases', {
  token,
  body: { title: 'Burglary count', caseNumber: `CALM-${Date.now()}`, jurisdiction: 'Alameda County', caseType: 'felony' },
});
const caseId = r.json.case.caseId;

// Charged with the short code the UI would send; the analyzer must still find
// the "Penal Code 459" instruction.
await req('POST', '/api/charges', {
  token,
  body: { caseId, code: 'PC', section: '459', title: 'Burglary', victim: 'Homeowner' },
});

console.log('--- with the charge but no timeline events ---');
let res = await req('GET', `/api/calcrim/analyze/${caseId}`, { token, timeoutMs: 60000 });
let charge = res.json?.charges?.[0];
console.log('instruction found :', charge ? `CALCRIM ${charge.calcrim} (${charge.title})` : 'none');
if (charge) {
  for (const e of charge.elements) {
    console.log(`  element ${e.elementId.padEnd(10)} supported=${String(e.supported).padEnd(5)} evidence=${e.supportingEvidence.length}`);
  }
  console.log('  strength:', charge.strength, ' caseStrength:', res.json.overallCaseStrength);
}

// Now give the case a timeline event that speaks to the entry element.
await prisma.timelineEvent.create({
  data: {
    caseId,
    tenantId: u.user.tenantId,
    timestamp: new Date('2026-03-14T22:47:00Z'),
    description: 'Defendant entered the residence through the rear door',
    action: 'enter',
    target: 'residence',
    actor: 'Defendant',
    sourceDoc: 'police-report.pdf',
    sourceType: 'police_report',
    confidence: 0.9,
  },
});

console.log('\n--- after adding one supporting event ---');
res = await req('GET', `/api/calcrim/analyze/${caseId}`, { token, timeoutMs: 60000 });
charge = res.json?.charges?.[0];
if (charge) {
  for (const e of charge.elements) {
    const cited = e.supportingEvidence.map((x) => x.sourceType).join(', ');
    console.log(`  element ${e.elementId.padEnd(10)} supported=${String(e.supported).padEnd(5)} evidence=${e.supportingEvidence.length}${cited ? ` [${cited}]` : ''}`);
  }
  console.log('  missing elements:', charge.missingElements.map((m) => m.elementId).join(', ') || 'none');
  console.log('  strength:', charge.strength, ' caseStrength:', res.json.overallCaseStrength);
}

await prisma.$disconnect();
