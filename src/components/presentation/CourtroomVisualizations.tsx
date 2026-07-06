// =============================================================================
// CourtAccess — Courtroom Visualizations (Program 33)
// Presentation-quality slide builders. Reuse the timeline, knowledge-graph, and
// chart engines — no duplicated visualization code. Focus on jury/judge/client
// communication.
// =============================================================================

import type { ReactNode } from 'react';
import { KnowledgeGraph } from '../graph/KnowledgeGraph';
import type { KnowledgeGraphData } from '../graph/types';
import { BarChart, DonutChart } from '../charts/charts';
import { ProgressRing, ProgressBar } from '../ui/progress';
import { Icon } from '../icons/registry';
import type { Slide } from './PresentationDeck';
import type { TimelineEvent } from '../timeline/types';

function bigStat(value: string, label: string, tone = 'text-gold-light'): ReactNode {
  return (
    <div className="text-center">
      <p className={`text-6xl font-bold ${tone}`}>{value}</p>
      <p className="text-slate-300 mt-2">{label}</p>
    </div>
  );
}

interface DeckInput {
  caseTitle: string;
  timeline?: TimelineEvent[];
  graph?: KnowledgeGraphData;
  caseStrength?: number;
  evidenceConfidence?: number;
  chargeMap?: { label: string; value: number }[];
  confidenceDistribution?: { label: string; value: number }[];
  discoveryReviewed?: number;
}

function pendingNote(label: string): ReactNode {
  return <p className="text-slate-400 text-lg">{label} populates from the case record — no values are estimated.</p>;
}

/**
 * Build a full courtroom deck from case data. Every slide reuses design-system
 * visualizations. Values are shown only when provided from real data; otherwise
 * the slide shows an explicit "pending" note (never fabricated numbers).
 */
export function buildCourtroomDeck(input: DeckInput): Slide[] {
  const timeline = input.timeline ?? [];
  const graph = input.graph;
  const strength = input.caseStrength;
  const confidence = input.evidenceConfidence;

  return [
    {
      id: 'title',
      title: input.caseTitle,
      subtitle: 'CourtAccess · Case Presentation',
      audienceNote: {
        juror: 'A clear, evidence-based walkthrough of the facts.',
        judge: 'Citation-backed summary of the record and legal posture.',
        client: 'Here is what your case shows and where it stands.',
      },
      content: (
        <div className="flex items-center gap-3 text-slate-400">
          <Icon name="attorney" size={20} variant="selected" /> Evidence-governed · citation-backed
        </div>
      ),
    },
    {
      id: 'timeline',
      title: 'Case Timeline',
      subtitle: 'What happened, in order',
      audienceNote: {
        juror: 'The sequence of events as established by the evidence.',
        judge: 'Chronology with source citations and flagged conflicts.',
        client: 'A step-by-step story of your case.',
      },
      content:
        timeline.length > 0 ? (
          <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-2">
            {timeline.slice(0, 8).map((e) => (
              <div key={e.id} className="flex gap-4 items-start">
                <span className="text-gold-light text-sm w-40 flex-shrink-0">{e.timestamp ? new Date(e.timestamp).toLocaleString() : 'UNKNOWN'}</span>
                <span className="text-lg text-white">{e.actor ? `${e.actor}: ` : ''}{e.title}</span>
              </div>
            ))}
          </div>
        ) : (
          pendingNote('The timeline')
        ),
    },
    {
      id: 'relationships',
      title: 'Relationships',
      subtitle: 'How people, evidence & events connect',
      audienceNote: {
        juror: 'This map shows how the key people and evidence relate.',
        judge: 'Entity-relationship graph derived from the record.',
        client: 'Who and what is connected in your case.',
      },
      content: graph && graph.nodes.length > 0
        ? <KnowledgeGraph data={graph} height={380} className="!bg-transparent !border-0 !shadow-none" />
        : pendingNote('The relationship graph'),
    },
    {
      id: 'charges',
      title: 'Charge Map',
      subtitle: 'Charges → elements → authorities',
      audienceNote: {
        juror: 'Each charge must be proven element by element.',
        judge: 'Charges mapped to elements and CALCRIM instructions.',
        client: 'What the prosecution must prove for each charge.',
      },
      content: input.chargeMap && input.chargeMap.length > 0 ? <BarChart data={input.chargeMap} height={220} /> : pendingNote('The charge map'),
    },
    {
      id: 'discovery',
      title: 'Discovery Progress',
      subtitle: 'What has been reviewed',
      audienceNote: {
        judge: 'Discovery review status and outstanding requests.',
        client: 'How much of the evidence has been reviewed.',
      },
      content:
        input.discoveryReviewed !== undefined || confidence !== undefined ? (
          <div className="max-w-xl space-y-4">
            {input.discoveryReviewed !== undefined && <ProgressBar value={input.discoveryReviewed} tone="blue" label="Discovery reviewed" showValue />}
            {confidence !== undefined && <ProgressBar value={confidence} tone="emerald" label="Evidence confidence" showValue />}
          </div>
        ) : (
          pendingNote('Discovery progress')
        ),
    },
    {
      id: 'confidence',
      title: 'Evidence Confidence',
      subtitle: 'How reliable is the evidence',
      audienceNote: {
        juror: 'The strength and reliability of the evidence presented.',
        judge: 'Evidence confidence distribution across the record.',
      },
      content: input.confidenceDistribution && input.confidenceDistribution.length > 0 ? <DonutChart data={input.confidenceDistribution} size={200} /> : pendingNote('Evidence confidence'),
    },
    {
      id: 'strength',
      title: 'Case Strength',
      subtitle: 'Overall assessment',
      audienceNote: {
        client: 'Our overall read on the strength of your position.',
        judge: 'Composite posture across evidence, coverage, and timeline.',
      },
      content: (
        <div className="flex items-center justify-center gap-16">
          <ProgressRing value={strength ?? 0} label={strength !== undefined ? undefined : 'UNKNOWN'} sublabel={strength !== undefined ? 'Strength' : undefined} size={180} />
          {confidence !== undefined ? bigStat(`${confidence}%`, 'Evidence confidence', 'text-emerald-400') : bigStat('UNKNOWN', 'Evidence confidence', 'text-slate-400')}
        </div>
      ),
    },
  ];
}
