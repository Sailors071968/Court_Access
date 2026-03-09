// ---------------------------------------------------------------------------
// Phase 14 — Neo4j Policy Graph
// Creates graph relationships:
//   Agency → HAS_POLICY → PolicyDocument
//   PolicyDocument → CONTAINS_RULE → PolicyRule
//   PolicyRule → APPLIES_TO → CaseEvidence
// ---------------------------------------------------------------------------

import neo4j, { Driver, Session } from 'neo4j-driver';

let driver: Driver | null = null;

/**
 * Get or create the Neo4j driver instance.
 */
function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER ?? 'neo4j';
    const password = process.env.NEO4J_PASSWORD ?? 'password';
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

/**
 * Get a Neo4j session.
 */
function getSession(): Session {
  return getDriver().session();
}

/**
 * Create indexes for policy graph nodes.
 */
export async function createPolicyGraphIndexes(): Promise<void> {
  const session = getSession();
  try {
    await session.run(
      'CREATE INDEX agency_id_index IF NOT EXISTS FOR (a:Agency) ON (a.agencyId)'
    );
    await session.run(
      'CREATE INDEX policy_doc_id_index IF NOT EXISTS FOR (p:PolicyDocument) ON (p.documentId)'
    );
    await session.run(
      'CREATE INDEX policy_rule_id_index IF NOT EXISTS FOR (r:PolicyRule) ON (r.ruleId)'
    );
    await session.run(
      'CREATE INDEX case_evidence_id_index IF NOT EXISTS FOR (e:CaseEvidence) ON (e.evidenceId)'
    );
    console.log('[Neo4j Policy Graph] Indexes created');
  } finally {
    await session.close();
  }
}

/**
 * Upsert an Agency node in the graph.
 */
export async function upsertAgencyNode(agency: {
  agencyId: string;
  agencyName: string;
  agencyType: string | null;
  city: string | null;
  county: string | null;
  jurisdictionRank: number | null;
}): Promise<void> {
  const session = getSession();
  try {
    await session.run(
      `MERGE (a:Agency {agencyId: $agencyId})
       SET a.agencyName = $agencyName,
           a.agencyType = $agencyType,
           a.city = $city,
           a.county = $county,
           a.jurisdictionRank = $jurisdictionRank,
           a.updatedAt = datetime()`,
      {
        agencyId: agency.agencyId,
        agencyName: agency.agencyName,
        agencyType: agency.agencyType,
        city: agency.city,
        county: agency.county,
        jurisdictionRank: agency.jurisdictionRank
          ? neo4j.int(agency.jurisdictionRank)
          : null,
      }
    );
  } finally {
    await session.close();
  }
}

/**
 * Upsert a PolicyDocument node and create HAS_POLICY relationship to Agency.
 */
export async function upsertPolicyDocumentNode(doc: {
  documentId: string;
  agencyId: string;
  title: string | null;
  documentType: string | null;
  sourceUrl: string;
  s3Url: string | null;
  classificationScore: number | null;
}): Promise<void> {
  const session = getSession();
  try {
    await session.run(
      `MERGE (p:PolicyDocument {documentId: $documentId})
       SET p.title = $title,
           p.documentType = $documentType,
           p.sourceUrl = $sourceUrl,
           p.s3Url = $s3Url,
           p.classificationScore = $classificationScore,
           p.updatedAt = datetime()
       WITH p
       MATCH (a:Agency {agencyId: $agencyId})
       MERGE (a)-[:HAS_POLICY]->(p)`,
      {
        documentId: doc.documentId,
        agencyId: doc.agencyId,
        title: doc.title,
        documentType: doc.documentType,
        sourceUrl: doc.sourceUrl,
        s3Url: doc.s3Url,
        classificationScore: doc.classificationScore,
      }
    );
  } finally {
    await session.close();
  }
}

/**
 * Extract policy rules from document text and create CONTAINS_RULE relationships.
 */
export async function extractAndStorePolicyRules(
  documentId: string,
  textContent: string,
  documentType: string | null
): Promise<number> {
  const rules = extractRulesFromText(documentId, textContent, documentType);
  const session = getSession();
  let created = 0;

  try {
    for (const rule of rules) {
      await session.run(
        `MERGE (r:PolicyRule {ruleId: $ruleId})
         SET r.ruleText = $ruleText,
             r.ruleCategory = $ruleCategory,
             r.documentType = $documentType,
             r.updatedAt = datetime()
         WITH r
         MATCH (p:PolicyDocument {documentId: $documentId})
         MERGE (p)-[:CONTAINS_RULE]->(r)`,
        {
          ruleId: rule.ruleId,
          ruleText: rule.ruleText,
          ruleCategory: rule.ruleCategory,
          documentType,
          documentId,
        }
      );
      created++;
    }
  } finally {
    await session.close();
  }

  return created;
}

/**
 * Link a PolicyRule to CaseEvidence (APPLIES_TO relationship).
 */
export async function linkRuleToCaseEvidence(
  ruleId: string,
  evidenceId: string,
  relevanceScore: number
): Promise<void> {
  const session = getSession();
  try {
    await session.run(
      `MATCH (r:PolicyRule {ruleId: $ruleId})
       MATCH (e:CaseEvidence {evidenceId: $evidenceId})
       MERGE (r)-[rel:APPLIES_TO]->(e)
       SET rel.relevanceScore = $relevanceScore,
           rel.linkedAt = datetime()`,
      { ruleId, evidenceId, relevanceScore }
    );
  } finally {
    await session.close();
  }
}

/**
 * Phase 13 — Get all policies for an agency (intelligence linking).
 * When a case references an agency, return all discovered policies.
 */
export async function getAgencyPoliciesGraph(agencyId: string): Promise<{
  agency: Record<string, unknown> | null;
  policies: Array<Record<string, unknown>>;
  rules: Array<Record<string, unknown>>;
}> {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (a:Agency {agencyId: $agencyId})
       OPTIONAL MATCH (a)-[:HAS_POLICY]->(p:PolicyDocument)
       OPTIONAL MATCH (p)-[:CONTAINS_RULE]->(r:PolicyRule)
       RETURN a, collect(DISTINCT p) as policies, collect(DISTINCT r) as rules`,
      { agencyId }
    );

    if (result.records.length === 0) {
      return { agency: null, policies: [], rules: [] };
    }

    const record = result.records[0];
    const agencyNode = record.get('a');
    const policyNodes = record.get('policies') as Array<{ properties: Record<string, unknown> }>;
    const ruleNodes = record.get('rules') as Array<{ properties: Record<string, unknown> }>;

    return {
      agency: agencyNode ? agencyNode.properties : null,
      policies: policyNodes
        .filter((p) => p && p.properties)
        .map((p) => p.properties),
      rules: ruleNodes
        .filter((r) => r && r.properties)
        .map((r) => r.properties),
    };
  } finally {
    await session.close();
  }
}

/**
 * Get policy intelligence for a case — find all relevant policies
 * for agencies referenced in the case.
 */
export async function getCasePolicyIntelligence(
  agencyIds: string[]
): Promise<
  Array<{
    agencyId: string;
    agencyName: string;
    policies: Array<{
      documentId: string;
      title: string | null;
      documentType: string | null;
    }>;
  }>
> {
  const session = getSession();
  try {
    const result = await session.run(
      `UNWIND $agencyIds AS aid
       MATCH (a:Agency {agencyId: aid})
       OPTIONAL MATCH (a)-[:HAS_POLICY]->(p:PolicyDocument)
       RETURN a.agencyId AS agencyId, a.agencyName AS agencyName,
              collect({documentId: p.documentId, title: p.title, documentType: p.documentType}) AS policies`,
      { agencyIds }
    );

    return result.records.map((record) => ({
      agencyId: record.get('agencyId') as string,
      agencyName: record.get('agencyName') as string,
      policies: (record.get('policies') as Array<Record<string, unknown>>).filter(
        (p) => p.documentId != null
      ) as Array<{
        documentId: string;
        title: string | null;
        documentType: string | null;
      }>,
    }));
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------------------
// Internal helper: extract policy rules from text
// ---------------------------------------------------------------------------

interface PolicyRule {
  ruleId: string;
  ruleText: string;
  ruleCategory: string;
}

/**
 * Simple rule extraction from policy text.
 * Looks for numbered sections, bullet points, and key phrases.
 */
function extractRulesFromText(
  documentId: string,
  text: string,
  documentType: string | null
): PolicyRule[] {
  const rules: PolicyRule[] = [];
  if (!text || text.length < 50) return rules;

  // Split into paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 20);

  // Key phrases that indicate rules/policies
  const ruleIndicators = [
    'shall',
    'must',
    'required',
    'prohibited',
    'authorized',
    'permitted',
    'mandatory',
    'officers shall',
    'personnel shall',
    'employees shall',
    'it is the policy',
    'department policy',
  ];

  let ruleIndex = 0;
  for (const para of paragraphs.slice(0, 100)) {
    // Max 100 rules per document
    const lower = para.toLowerCase();
    const isRule = ruleIndicators.some((indicator) =>
      lower.includes(indicator)
    );

    if (isRule) {
      ruleIndex++;
      const ruleId = `rule-${documentId}-${documentType ?? 'UNKNOWN'}-${ruleIndex}`;
      rules.push({
        ruleId,
        ruleText: para.trim().slice(0, 500), // Cap at 500 chars
        ruleCategory: documentType ?? 'GENERAL_POLICY',
      });
    }
  }

  return rules;
}

/**
 * Close the Neo4j driver connection.
 */
export async function closePolicyGraphDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
