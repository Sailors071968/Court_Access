// ============================================================================
// Program 135 — Prompt Optimization / Context Builder
// Assembles the deterministic context CourtAccess already knows (repository
// intelligence, evidence metadata, Knowledge Graph, CALCRIM, statutes, prior
// findings, human-review status) so that ONLY genuinely unresolved questions
// require AI reasoning. This minimizes prompt tokens and avoids re-asking the
// model anything the repository has already resolved. Nothing is fabricated:
// resolved findings are passed through as context, not re-generated.
// ============================================================================

export interface ContextQuestion {
  id: string;
  question: string;
  resolved: boolean;
  /** Repository-backed answer when resolved (passed as context, not re-asked). */
  answer?: string;
}

export interface PromptContextInput {
  repositoryIntelligence?: string[];
  evidenceMetadata?: string[];
  knowledgeGraph?: string[];
  calcrim?: string[];
  statutes?: string[];
  priorFindings?: string[];
  humanReviewStatus?: string[];
  questions: ContextQuestion[];
}

export interface OptimizedPrompt {
  systemContext: string;
  unresolvedQuestions: ContextQuestion[];
  includedSections: string[];
  estimatedPromptTokens: number;
  /** True when there is nothing left for the model to reason about. */
  fullyResolved: boolean;
}

function section(title: string, items?: string[]): string | null {
  if (!items || items.length === 0) return null;
  return `## ${title}\n${items.map((i) => `- ${i}`).join('\n')}`;
}

/** ~4 chars/token rough estimate (matches orchestrator). */
function estimateTokens(text: string): number {
  return Math.max(0, Math.ceil(text.length / 4));
}

export function buildOptimizedContext(input: PromptContextInput): OptimizedPrompt {
  const blocks: Array<[string, string[] | undefined]> = [
    ['Repository Intelligence', input.repositoryIntelligence],
    ['Evidence Metadata', input.evidenceMetadata],
    ['Knowledge Graph', input.knowledgeGraph],
    ['CALCRIM', input.calcrim],
    ['Statutes', input.statutes],
    ['Prior Findings', input.priorFindings],
    ['Human Review Status', input.humanReviewStatus],
  ];
  const resolved = input.questions.filter((q) => q.resolved);
  const unresolved = input.questions.filter((q) => !q.resolved);

  const sections: string[] = [];
  const included: string[] = [];
  for (const [title, items] of blocks) {
    const s = section(title, items);
    if (s) { sections.push(s); included.push(title); }
  }
  if (resolved.length) {
    sections.push(section('Already-Resolved (do not re-answer)', resolved.map((q) => `${q.question} → ${q.answer ?? 'resolved'}`))!);
    included.push('Already-Resolved');
  }

  const systemContext = [
    'You are assisting a licensed attorney. Use ONLY the repository-backed context below.',
    'Never fabricate evidence, citations, or legal conclusions. If the context is insufficient, answer UNKNOWN.',
    '',
    ...sections,
  ].join('\n');

  return {
    systemContext,
    unresolvedQuestions: unresolved,
    includedSections: included,
    estimatedPromptTokens: estimateTokens(systemContext) + unresolved.reduce((s, q) => s + estimateTokens(q.question), 0),
    fullyResolved: unresolved.length === 0,
  };
}
