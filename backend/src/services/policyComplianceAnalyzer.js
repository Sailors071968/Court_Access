// ============================================
// Court Access — Phase 54: Policy Compliance Analyzer
// Parses department policies and evaluates evidence
// against indexed policy sections.
// ============================================

import { config } from '../config/index.js';
import prisma from './prismaClient.js';
import { captureException } from './errorMonitoring.js';

/**
 * Parse a policy document into indexed sections.
 *
 * @param {string} content - Raw text content of the policy document
 * @returns {Array<{sectionId: string, title: string, content: string}>}
 */
export function parsePolicySections(content) {
  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;
  let sectionIndex = 0;

  // Detect section headers by common patterns:
  // "Section X:", "Article X.", "X.Y", numbered items, ALL CAPS headers
  const sectionPattern = /^(?:section\s+\d+|article\s+\d+|\d+\.\d+|\d+\)\s|[A-Z][A-Z\s]{5,}$|#{1,3}\s)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (sectionPattern.test(trimmed)) {
      // Save previous section
      if (currentSection && currentSection.content.trim()) {
        sections.push(currentSection);
      }

      sectionIndex++;
      currentSection = {
        sectionId: `section-${sectionIndex}`,
        title: trimmed.replace(/^#+\s*/, '').replace(/[:.]$/, '').trim(),
        content: '',
      };
    } else if (currentSection) {
      currentSection.content += trimmed + '\n';
    } else {
      // Content before any section header — create an intro section
      if (sections.length === 0) {
        currentSection = {
          sectionId: 'section-0',
          title: 'General Provisions',
          content: trimmed + '\n',
        };
      }
    }
  }

  // Save last section
  if (currentSection && currentSection.content.trim()) {
    sections.push(currentSection);
  }

  // If no sections detected, treat entire document as one section
  if (sections.length === 0) {
    sections.push({
      sectionId: 'section-1',
      title: 'Full Document',
      content: content,
    });
  }

  return sections;
}

/**
 * Upload and index a policy document.
 *
 * @param {Object} params
 * @param {string} params.caseId
 * @param {string} params.title
 * @param {string} params.documentType
 * @param {string} params.content
 * @param {string} [params.uploadedBy]
 * @returns {Promise<Object>} Created PolicyDocument
 */
export async function indexPolicyDocument({ caseId, title, documentType, content, uploadedBy }) {
  const sections = parsePolicySections(content);

  const doc = await prisma.policyDocument.create({
    data: {
      caseId,
      title,
      documentType,
      content,
      sections,
      uploadedBy: uploadedBy || null,
    },
  });

  console.log(`[PolicyCompliance] Indexed policy: "${title}" — ${sections.length} sections`);
  return doc;
}

/**
 * Analyze evidence against all policy documents for a case.
 *
 * @param {string} caseId
 * @param {string} [evidenceId] - Specific evidence to analyze, or all if omitted
 * @returns {Promise<{findings: Array, count: number}>}
 */
export async function analyzeCompliance(caseId, evidenceId) {
  console.log(`[PolicyCompliance] Starting analysis for case=${caseId}, evidence=${evidenceId || 'all'}`);

  try {
    // Get policy documents
    const policies = await prisma.policyDocument.findMany({
      where: { caseId, status: 'active' },
    });

    if (policies.length === 0) {
      console.log('[PolicyCompliance] No policy documents found for case');
      return { findings: [], count: 0 };
    }

    // Get evidence to analyze
    const evidenceWhere = { caseId, status: 'complete' };
    if (evidenceId) evidenceWhere.id = evidenceId;

    const evidence = await prisma.evidenceRecord.findMany({ where: evidenceWhere });

    // Get transcripts for media evidence
    const transcripts = await prisma.mediaTranscript.findMany({
      where: {
        caseId,
        fullTranscript: true,
        status: 'complete',
        ...(evidenceId ? { evidenceId } : {}),
      },
    });

    const newFindings = [];

    if (config.openaiApiKey) {
      // AI-powered compliance analysis
      const aiFindings = await aiComplianceAnalysis(caseId, policies, evidence, transcripts);
      newFindings.push(...aiFindings);
    } else {
      // Deterministic keyword-based analysis
      const keywordFindings = keywordComplianceAnalysis(policies, evidence, transcripts);
      newFindings.push(...keywordFindings);
    }

    // Persist findings
    const created = [];
    for (const finding of newFindings) {
      try {
        const record = await prisma.policyComplianceFinding.create({
          data: {
            caseId,
            evidenceId: finding.evidenceId,
            policyDocumentId: finding.policyDocumentId,
            policySection: finding.policySection,
            description: finding.description,
            confidenceScore: finding.confidenceScore,
            severity: finding.severity,
            metadata: finding.metadata || {},
          },
        });
        created.push(record);
      } catch (dbErr) {
        console.warn('[PolicyCompliance] DB insert failed:', dbErr.message);
      }
    }

    console.log(`[PolicyCompliance] Analysis complete: ${created.length} findings for case=${caseId}`);
    return { findings: created, count: created.length };
  } catch (err) {
    console.error(`[PolicyCompliance] Analysis failed for case=${caseId}:`, err.message);
    captureException(err, { caseId, evidenceId });
    throw err;
  }
}

/**
 * AI-powered compliance analysis using OpenAI.
 */
async function aiComplianceAnalysis(caseId, policies, evidence, transcripts) {
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: config.openaiApiKey });

    const findings = [];

    for (const policy of policies) {
      const policySections = Array.isArray(policy.sections) ? policy.sections : [];
      const policySummary = policySections
        .map((s) => `[${s.title}]: ${s.content.substring(0, 500)}`)
        .join('\n\n');

      // Build evidence context from transcripts and processing results
      const evidenceContext = transcripts.slice(0, 5).map((t) => {
        const ev = evidence.find((e) => e.id === t.evidenceId);
        return `Evidence: ${ev?.filename || t.evidenceId}\nTranscript excerpt: ${t.transcriptText.substring(0, 1500)}`;
      }).join('\n\n---\n\n');

      if (!evidenceContext) continue;

      const prompt = `You are a legal compliance analyst. Evaluate the following evidence against the department policy document.

POLICY: "${policy.title}" (Type: ${policy.documentType})
${policySummary}

EVIDENCE FROM CASE:
${evidenceContext}

Identify any instances where officer actions, statements, or procedures described in the evidence may deviate from the policy requirements. Focus on:
- Procedural violations
- Use-of-force policy deviations
- Required language or advisements not given
- Sequence of actions not following protocol
- Evidence handling procedures not followed

Respond with valid JSON:
{
  "findings": [
    {
      "policySection": "Section title or number",
      "description": "Description of the potential deviation",
      "severity": "low|medium|high|critical",
      "confidence": 0.8,
      "evidenceIndex": 0
    }
  ]
}

If no deviations found, return: {"findings": []}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.2,
      });

      const result = JSON.parse(response.choices[0].message.content);

      for (const f of (result.findings || [])) {
        const targetTranscript = transcripts[f.evidenceIndex || 0];
        if (!targetTranscript) continue;

        findings.push({
          evidenceId: targetTranscript.evidenceId,
          policyDocumentId: policy.id,
          policySection: f.policySection || '',
          description: f.description,
          confidenceScore: f.confidence || 0.5,
          severity: f.severity || 'medium',
          metadata: { aiDetected: true, model: 'gpt-4o-mini', policyTitle: policy.title },
        });
      }
    }

    return findings;
  } catch (err) {
    console.warn('[PolicyCompliance] AI analysis failed:', err.message);
    return [];
  }
}

/**
 * Deterministic keyword-based compliance analysis (fallback).
 */
function keywordComplianceAnalysis(policies, evidence, transcripts) {
  const findings = [];

  // Common compliance keywords to check for
  const complianceKeywords = {
    use_of_force: ['force', 'restrain', 'taser', 'baton', 'pepper spray', 'firearm', 'physical', 'tackle', 'strike', 'choke'],
    arrest_procedure: ['miranda', 'rights', 'probable cause', 'warrant', 'consent', 'search', 'seizure', 'detained', 'arrest'],
    bodycam_rules: ['body camera', 'bodycam', 'body-worn', 'recording', 'activate', 'deactivate', 'footage'],
    evidence_handling: ['chain of custody', 'evidence bag', 'sealed', 'contaminated', 'logged', 'inventoried'],
  };

  for (const policy of policies) {
    const policyType = policy.documentType;
    const keywords = complianceKeywords[policyType] || [];
    if (keywords.length === 0) continue;

    const sections = Array.isArray(policy.sections) ? policy.sections : [];

    for (const transcript of transcripts) {
      const text = transcript.transcriptText.toLowerCase();

      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          // Find which policy section is most relevant
          const relevantSection = sections.find((s) =>
            s.content.toLowerCase().includes(keyword)
          );

          findings.push({
            evidenceId: transcript.evidenceId,
            policyDocumentId: policy.id,
            policySection: relevantSection?.title || 'General',
            description: `Keyword "${keyword}" detected in transcript — review against ${policy.title} policy requirements.`,
            confidenceScore: 0.5,
            severity: 'medium',
            metadata: { keyword, detectionMethod: 'keyword', policyType },
          });
          break; // One finding per keyword per transcript
        }
      }
    }
  }

  return findings;
}
