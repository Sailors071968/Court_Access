// ============================================
// Court Access — Exhibit Idea Generator
// Transforms detected patterns into actionable
// exhibit ideas with titles, descriptions, and
// recommended visual styles.
// ============================================

import { createHash } from 'node:crypto';
import type {
  DetectedPattern,
  ExhibitIdea,
  ExhibitType,
} from './types.ts';

// ---------------------------------------------------------------------------
// Exhibit Templates — predefined templates for each exhibit type
// ---------------------------------------------------------------------------

interface ExhibitTemplate {
  titlePrefix: string;
  descriptionTemplate: string;
  visualStyle: string;
}

const EXHIBIT_TEMPLATES: Record<ExhibitType, ExhibitTemplate> = {
  timeline_comparison: {
    titlePrefix: 'Timeline Comparison',
    descriptionTemplate:
      'A side-by-side timeline showing conflicting accounts or unexplained gaps. ' +
      'This exhibit helps the jury visualize temporal inconsistencies.',
    visualStyle: 'dual-timeline',
  },
  testimony_vs_transcript: {
    titlePrefix: 'Testimony vs. Record Comparison',
    descriptionTemplate:
      'A comparison chart placing official testimony beside physical evidence ' +
      '(transcripts, bodycam, dispatch logs). Highlights direct contradictions.',
    visualStyle: 'split-comparison',
  },
  officer_movement_map: {
    titlePrefix: 'Officer Movement Reconstruction',
    descriptionTemplate:
      'A chronological map of officer actions, positions, and timestamps. ' +
      'Reveals gaps in activity and inconsistencies in reported movements.',
    visualStyle: 'annotated-map',
  },
  chain_of_custody_flow: {
    titlePrefix: 'Chain of Custody Flow Diagram',
    descriptionTemplate:
      'A flow diagram tracing evidence handling from collection to court. ' +
      'Exposes missing signatures, unexplained gaps, and handler mismatches.',
    visualStyle: 'flow-diagram',
  },
  evidence_relationship_graph: {
    titlePrefix: 'Evidence Relationship Graph',
    descriptionTemplate:
      'A network visualization showing how evidence items connect to each other, ' +
      'witnesses, and events. Reveals hidden patterns in the evidence.',
    visualStyle: 'network-graph',
  },
  narrative_conflict_visualization: {
    titlePrefix: 'Narrative Conflict Visualization',
    descriptionTemplate:
      'A visualization showing how multiple contradictions cluster around the ' +
      'same event or individual. Demonstrates a pattern of inconsistency.',
    visualStyle: 'conflict-web',
  },
};

// ---------------------------------------------------------------------------
// Exhibit Idea Generator
// ---------------------------------------------------------------------------

export class ExhibitIdeaGenerator {
  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Generate exhibit ideas from detected patterns.
   * Each pattern produces one exhibit idea with a descriptive title,
   * explanation of why it matters, and recommended visual type.
   */
  generateIdeas(patterns: DetectedPattern[]): ExhibitIdea[] {
    const ideas: ExhibitIdea[] = [];

    for (const pattern of patterns) {
      const idea = this.patternToIdea(pattern);
      ideas.push(idea);
    }

    return ideas;
  }

  // -----------------------------------------------------------------------
  // Pattern → Idea Conversion
  // -----------------------------------------------------------------------

  private patternToIdea(pattern: DetectedPattern): ExhibitIdea {
    const template = EXHIBIT_TEMPLATES[pattern.patternType];
    const title = this.generateTitle(pattern, template);
    const description = this.generateDescription(pattern, template);
    const id = this.generateId(pattern);

    return {
      id,
      caseId: pattern.caseId,
      title,
      description,
      exhibitType: pattern.patternType,
      evidenceIds: pattern.evidenceIds,
      conflictIds: pattern.conflictIds,
      priorityScore: 0, // Will be set by the priority scorer
      status: 'suggested',
    };
  }

  // -----------------------------------------------------------------------
  // Title Generation
  // -----------------------------------------------------------------------

  private generateTitle(pattern: DetectedPattern, template: ExhibitTemplate): string {
    switch (pattern.patternType) {
      case 'timeline_comparison':
        return `${template.titlePrefix}: ${pattern.summary}`;
      case 'testimony_vs_transcript':
        return `${template.titlePrefix}: ${pattern.summary}`;
      case 'officer_movement_map':
        return `${template.titlePrefix}: ${pattern.summary}`;
      case 'chain_of_custody_flow':
        return `${template.titlePrefix}: ${pattern.summary}`;
      case 'evidence_relationship_graph':
        return `${template.titlePrefix}: ${pattern.summary}`;
      case 'narrative_conflict_visualization':
        return `${template.titlePrefix}: ${pattern.summary}`;
    }
  }

  // -----------------------------------------------------------------------
  // Description Generation
  // -----------------------------------------------------------------------

  private generateDescription(pattern: DetectedPattern, template: ExhibitTemplate): string {
    const whyItMatters = pattern.details;
    const visualRecommendation = template.descriptionTemplate;
    const evidenceCount = pattern.evidenceIds.length;
    const conflictCount = pattern.conflictIds.length;

    let description = `${whyItMatters}\n\n`;
    description += `Recommended Visual: ${visualRecommendation}\n\n`;
    description += `Evidence Items: ${evidenceCount}`;
    if (conflictCount > 0) {
      description += ` | Conflicts Referenced: ${conflictCount}`;
    }

    return description;
  }

  // -----------------------------------------------------------------------
  // ID Generation
  // -----------------------------------------------------------------------

  private generateId(pattern: DetectedPattern): string {
    const hash = createHash('sha256')
      .update(`idea:${pattern.id}:${pattern.caseId}`)
      .digest('hex')
      .slice(0, 16);
    return `exhibit-idea-${hash}`;
  }
}
