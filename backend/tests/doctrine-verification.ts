// ============================================
// POST Doctrine Intelligence — Full Verification
// Steps 1-5: Ingestion, Vector Search, Evidence
// Analysis, Flag Output, Performance
// ============================================

import { DoctrineIngestionService } from '../src/doctrine/doctrineIngestionService.ts';
import { DoctrineComplianceEngine } from '../src/doctrine/doctrineComplianceEngine.ts';
import { doctrineStore } from '../src/doctrine/doctrineStore.ts';
import { doctrineEmbeddingPipeline } from '../src/doctrine/doctrineEmbeddingPipeline.ts';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function separator(title: string) {
  console.log('\n' + '='.repeat(72));
  console.log(`  ${title}`);
  console.log('='.repeat(72));
}

function subSection(title: string) {
  console.log(`\n--- ${title} ---`);
}

// -----------------------------------------------------------------------
// STEP 1: Doctrine Ingestion Verification
// -----------------------------------------------------------------------

async function step1_ingestionVerification() {
  separator('STEP 1: Doctrine Ingestion Verification');

  // List available domains before loading
  const domains = DoctrineIngestionService.getAvailableDomains();
  console.log('\nAvailable domains:');
  for (const d of domains) {
    console.log(`  ${d.name}: ${d.ruleCount} rules`);
  }

  // Load all seed data
  subSection('Loading all 8 domains...');
  const result = await DoctrineIngestionService.loadAllSeedData();

  console.log(`\nIngestion Result:`);
  console.log(`  Source: ${result.sourceName}`);
  console.log(`  Total Chunks: ${result.totalChunks}`);
  console.log(`  Rules Created: ${result.rulesCreated}`);
  console.log(`  Rules Duplicate: ${result.rulesDuplicate}`);
  console.log(`  Embeddings Generated: ${result.embeddingsGenerated}`);
  console.log(`  Duration: ${result.durationMs}ms`);
  console.log(`  Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('  Error details:');
    for (const err of result.errors.slice(0, 5)) {
      console.log(`    - ${err.chunk}: ${err.error}`);
    }
  }

  // Verify store stats
  subSection('Store Statistics');
  const stats = doctrineStore.getStats();
  console.log(`  Total Rules in Store: ${stats.totalRules}`);
  console.log(`  Total Embeddings: ${doctrineEmbeddingPipeline.size}`);

  console.log('\n  Rules by Source:');
  for (const [src, count] of Object.entries(stats.rulesBySource)) {
    console.log(`    ${src}: ${count}`);
  }

  console.log('\n  Rules by Domain:');
  for (const [dom, count] of Object.entries(stats.rulesByDomain)) {
    console.log(`    ${dom}: ${count}`);
  }

  console.log('\n  Rules by Category:');
  for (const [cat, count] of Object.entries(stats.rulesByCategory)) {
    console.log(`    ${cat}: ${count}`);
  }

  // Verify all 8 domains loaded
  const allLoaded = DoctrineIngestionService.isAllSeedDataLoaded();
  console.log(`\n  All Domains Loaded: ${allLoaded ? 'YES ✓' : 'NO ✗'}`);

  // Verify embeddings match rule count
  const embeddingsMatch = doctrineEmbeddingPipeline.size === stats.totalRules;
  console.log(`  Embeddings Match Rules: ${embeddingsMatch ? 'YES ✓' : 'NO ✗'} (${doctrineEmbeddingPipeline.size}/${stats.totalRules})`);

  return stats;
}

// -----------------------------------------------------------------------
// STEP 2: Vector Search Test
// -----------------------------------------------------------------------

async function step2_vectorSearchTest() {
  separator('STEP 2: Vector Search Test');

  const query = 'Officer stopped suspect because he looked nervous.';
  console.log(`\nQuery: "${query}"`);

  subSection('Embedding Generation');
  const startEmbed = performance.now();
  const queryEmbedding = await doctrineEmbeddingPipeline.embedText(query);
  const embedTime = performance.now() - startEmbed;
  console.log(`  Query embedding generated in ${embedTime.toFixed(1)}ms`);
  console.log(`  Embedding dimensions: ${queryEmbedding.length}`);

  subSection('Similarity Search');
  const startSearch = performance.now();
  const similar = doctrineEmbeddingPipeline.findSimilar(queryEmbedding, 15, 0.1);
  const searchTime = performance.now() - startSearch;
  console.log(`  Found ${similar.length} matches in ${searchTime.toFixed(1)}ms`);

  console.log('\n  Top matches:');
  for (const match of similar.slice(0, 10)) {
    const rule = doctrineStore.getById(match.doctrineId);
    if (rule) {
      console.log(`    [${(match.similarity * 100).toFixed(1)}%] ${rule.sourceName} | ${rule.domain} | ${rule.topic}`);
      console.log(`           Rule: ${rule.ruleText.slice(0, 100)}...`);
    }
  }

  // Check if expected domains are represented
  const matchedDomains = new Set(similar.map(m => {
    const rule = doctrineStore.getById(m.doctrineId);
    return rule?.domain;
  }).filter(Boolean));
  console.log(`\n  Matched Domains: ${[...matchedDomains].join(', ')}`);

  const hasLD15 = [...matchedDomains].some(d => d === 'Laws of Arrest');
  const hasLD21 = [...matchedDomains].some(d => d === 'Patrol Techniques');
  console.log(`  Expected LD-15 (Laws of Arrest): ${hasLD15 ? 'FOUND ✓' : 'NOT FOUND'}`);
  console.log(`  Expected LD-21 (Patrol Techniques): ${hasLD21 ? 'FOUND ✓' : 'NOT FOUND'}`);
}

// -----------------------------------------------------------------------
// STEP 3: Evidence Analysis Integration
// -----------------------------------------------------------------------

async function step3_evidenceAnalysis() {
  separator('STEP 3: Evidence Analysis Integration (case-demo-001)');

  const evidenceTexts = {
    'Police Report': `Officer Johnson observed suspect walking in a known high-crime area at approximately 2300 hours. Suspect appeared nervous and made furtive movements when officer approached. Officer detained suspect based on nervous behavior. During a pat search, officer found contraband in suspect's jacket pocket. Suspect was placed under arrest. No Miranda warnings were administered at the scene. Officer searched the suspect's vehicle without consent or warrant after the arrest, exceeding the scope of the initial stop.`,

    'Bodycam Transcript': `[22:58] Officer approaches individual on sidewalk. "Hey, come here for a second." Individual continues walking. Officer grabs arm. "I said stop." Individual: "What did I do?" Officer: "You looked suspicious. This is a high crime area." Officer conducts pat search without stating reason. "What's this in your pocket?" Individual: "I want a lawyer." Officer continues questioning: "Where did you get this? Who gave it to you?" Individual: "I said I want a lawyer." Officer: "We can do this the easy way or the hard way." Officer struck the compliant suspect while handcuffed.`,

    'Witness Statement': `I saw the officer stop a man who was just walking down the street. The man wasn't doing anything wrong that I could see. He just looked nervous when the cop car pulled up. The officer grabbed him and started searching him right away without asking any questions first. The officer seemed aggressive. The evidence collected from the scene was improperly packaged and the chain of custody had a gap when it was transferred between officers. The crime scene was compromised when multiple officers entered without proper protocols.`,
  };

  for (const [label, text] of Object.entries(evidenceTexts)) {
    subSection(`Analyzing: ${label}`);
    const startTime = performance.now();
    const result = await DoctrineComplianceEngine.analyzeCompliance(text);
    const duration = performance.now() - startTime;

    console.log(`  Analysis Duration: ${duration.toFixed(1)}ms`);
    console.log(`  Rules Checked: ${result.totalRulesChecked}`);
    console.log(`  Overall Compliance: ${result.overallCompliance.toUpperCase()}`);
    console.log(`  Violations: ${result.violations.length}`);
    console.log(`  Concerns: ${result.concerns.length}`);
    console.log(`  Compliant: ${result.compliant.length}`);

    if (result.violations.length > 0) {
      console.log('\n  VIOLATIONS:');
      for (const v of result.violations.slice(0, 5)) {
        console.log(`    [${(v.similarityScore * 100).toFixed(1)}%] ${v.doctrineRule.sourceName} | ${v.doctrineRule.domain}`);
        console.log(`      Topic: ${v.doctrineRule.topic}`);
        console.log(`      Rule: ${v.doctrineRule.ruleText.slice(0, 120)}...`);
        console.log(`      Risk: ${v.doctrineRule.category}`);
      }
    }

    if (result.concerns.length > 0) {
      console.log('\n  CONCERNS:');
      for (const c of result.concerns.slice(0, 5)) {
        console.log(`    [${(c.similarityScore * 100).toFixed(1)}%] ${c.doctrineRule.sourceName} | ${c.doctrineRule.domain}`);
        console.log(`      Topic: ${c.doctrineRule.topic}`);
        console.log(`      Risk: ${c.doctrineRule.category}`);
      }
    }
  }
}

// -----------------------------------------------------------------------
// STEP 4: Compliance Flag Output Verification
// -----------------------------------------------------------------------

async function step4_complianceFlagOutput() {
  separator('STEP 4: Compliance Flag Output Structure');

  const testInput = 'Officer searched vehicle after driver refusal of consent. No warrant was obtained. Officer found evidence but chain of custody had a gap when transferred. The suspect was shot while fleeing and unarmed.';

  console.log(`\nTest Input: "${testInput.slice(0, 100)}..."`);

  const result = await DoctrineComplianceEngine.analyzeCompliance(testInput, {
    maxResults: 15,
    minSimilarity: 0.1,
  });

  console.log(`\nTotal Matches: ${result.matches.length}`);
  console.log(`Overall: ${result.overallCompliance}`);

  subSection('Full Flag Output Format');
  for (const match of result.matches.slice(0, 8)) {
    console.log(`\n  ┌─ Doctrine Flag ─────────────────────────────`);
    console.log(`  │ POST Domain:      ${match.doctrineRule.sourceName} (${match.doctrineRule.domain})`);
    console.log(`  │ Topic:            ${match.doctrineRule.topic}`);
    console.log(`  │ Rule Summary:     ${match.doctrineRule.ruleText.slice(0, 100)}...`);
    console.log(`  │ Risk Category:    ${match.doctrineRule.category}`);
    console.log(`  │ Confidence Score: ${(match.similarityScore * 100).toFixed(1)}%`);
    console.log(`  │ Flag Type:        ${match.flagType.toUpperCase()}`);
    console.log(`  │ Description:      ${match.flagDescription.slice(0, 120)}...`);
    console.log(`  │ Legal Implication: ${(match.doctrineRule.legalImplication ?? 'N/A').slice(0, 100)}`);
    console.log(`  │ Evidence Citation: "${testInput.slice(0, 80)}..."`);
    console.log(`  └──────────────────────────────────────────────`);
  }
}

// -----------------------------------------------------------------------
// STEP 5: Performance Check
// -----------------------------------------------------------------------

async function step5_performanceCheck() {
  separator('STEP 5: Performance Check');

  const fullTranscript = `At approximately 2245 hours, Officers Johnson and Martinez responded to a report of suspicious activity at 1200 Main Street. Upon arrival, officers observed a male subject standing near a parked vehicle in a known high-crime area. The subject appeared nervous and made furtive movements as officers approached. Officer Johnson initiated contact, identifying himself and asking for identification. The subject stated he was waiting for a friend. Officer Johnson believed the subject matched the description of a burglary suspect from an earlier call. Based on this belief, Officer Johnson detained the subject and conducted a pat-down search for weapons. During the pat search, Officer Johnson felt a hard object in the subject's front pocket. Without asking permission, the officer reached into the pocket and retrieved a small bag containing a white substance. The subject was placed under arrest. Miranda rights were not administered at the scene. Officer Martinez searched the subject's vehicle, which was parked nearby, without obtaining a warrant or consent. During the vehicle search, additional contraband was found under the passenger seat. The evidence was collected but the packaging was improper and chain of custody documentation showed a gap between Officer Martinez handling and the evidence technician. At the station, the subject requested an attorney but questioning continued for approximately 45 minutes. The subject eventually made incriminating statements. The crime scene was accessed by multiple unauthorized personnel before the forensic team arrived, compromising potential evidence. Officer Johnson's report contained subjective language describing the suspect's demeanor without objective behavioral observations. The use of force report indicated the officer struck the handcuffed suspect during transport.`;

  console.log(`\nTranscript length: ${fullTranscript.length} characters`);

  // Memory before
  const memBefore = process.memoryUsage();

  // Vector search latency
  subSection('Vector Search Latency');
  const iterations = 5;
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await DoctrineComplianceEngine.analyzeCompliance(fullTranscript);
    const elapsed = performance.now() - start;
    latencies.push(elapsed);
    console.log(`  Run ${i + 1}: ${elapsed.toFixed(1)}ms`);
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  console.log(`\n  Average: ${avgLatency.toFixed(1)}ms`);
  console.log(`  Min: ${minLatency.toFixed(1)}ms`);
  console.log(`  Max: ${maxLatency.toFixed(1)}ms`);
  console.log(`  Target <200ms: ${avgLatency < 200 ? 'PASS ✓' : 'FAIL ✗'}`);

  // Memory usage
  subSection('Memory Usage');
  const memAfter = process.memoryUsage();
  console.log(`  Heap Used: ${(memAfter.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  Heap Total: ${(memAfter.heapTotal / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  RSS: ${(memAfter.rss / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  External: ${(memAfter.external / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  Heap Delta: ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)}MB`);

  // Match count
  subSection('Match Count');
  const finalResult = await DoctrineComplianceEngine.analyzeCompliance(fullTranscript, {
    maxResults: 50,
    minSimilarity: 0.1,
  });
  console.log(`  Total Matches (min 0.1 sim): ${finalResult.matches.length}`);
  console.log(`  Violations: ${finalResult.violations.length}`);
  console.log(`  Concerns: ${finalResult.concerns.length}`);
  console.log(`  Compliant: ${finalResult.compliant.length}`);

  // Unique domains in results
  const matchDomains = new Set(finalResult.matches.map(m => m.doctrineRule.domain));
  console.log(`  Domains Matched: ${matchDomains.size} — ${[...matchDomains].join(', ')}`);
}

// -----------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  POST Doctrine Intelligence — Full Verification Suite               ║');
  console.log('║  PR #32: LD-15 + LD-16 through LD-30 Multi-Domain Expansion        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const stats = await step1_ingestionVerification();
  await step2_vectorSearchTest();
  await step3_evidenceAnalysis();
  await step4_complianceFlagOutput();
  await step5_performanceCheck();

  separator('VERIFICATION SUMMARY');
  console.log(`\n  Total Doctrine Rules: ${stats.totalRules}`);
  console.log(`  Total Embeddings: ${doctrineEmbeddingPipeline.size}`);
  console.log(`  Domains: ${Object.keys(stats.rulesByDomain).length}`);
  console.log(`  Categories: ${Object.keys(stats.rulesByCategory).length}`);
  console.log(`  Sources: ${Object.keys(stats.rulesBySource).length}`);
  console.log(`\n  Pipeline: Evidence → Officer Actions → Doctrine Comparison → Compliance Flags → Litigation Recommendations`);
  console.log(`  Status: OPERATIONAL`);
}

main().catch(console.error);
