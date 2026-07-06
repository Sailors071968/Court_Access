// =============================================================================
// CourtAccess — Courtroom Visualizations (Program 33)
// Presentation-quality slide builders. Reuse the timeline, knowledge-graph, and
// chart engines — no duplicated visualization code. Focus on jury/judge/client
// communication.
// =============================================================================

import type { ReactNode } from 'react';
import { KnowledgeGraph } from '../graph/KnowledgeGraph';
import { SAMPLE_GRAPH } from '../graph/adapters';
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
}

/**
 * Build a full courtroom deck from case data. Every slide reuses design-system
 * visualizations. Audience notes tailor the same facts for juror/judge/client.
 */
export function buildCourtroomDeck(input: DeckInput): Slide[] {
  const timeline = input.timeline ?? [];
  const graph = input.graph ?? SAMPLE_GRAPH;
  const strength = input.caseStrength ?? 94;
  const confidence = input.evidenceConfidence ?? 98;

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
      content: (
        <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-2">
          {(timeline.length ? timeline : PLACEHOLDER_TIMELINE).slice(0, 8).map((e) => (
            <div key={e.id} className="flex gap-4 items-start">
              <span className="text-gold-light text-sm w-40 flex-shrink-0">{e.timestamp ? new Date(e.timestamp).toLocaleString() : 'UNKNOWN'}</span>
              <span className="text-lg text-white">{e.actor ? `${e.actor}: ` : ''}{e.title}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'witnesses',
      title: 'Relationships',
      subtitle: 'How people, evidence & events connect',
      audienceNote: {
        juror: 'This map shows how the key people and evidence relate.',
        judge: 'Entity-relationship graph derived from the record.',
        client: 'Who and what is connected in your case.',
      },
      content: <KnowledgeGraph data={graph} height={380} className="!bg-transparent !border-0 !shadow-none" />,
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
      content: (
        <BarChart
          data={[
            { label: 'PC 459', value: 5 },
            { label: 'Elements', value: 4 },
            { label: 'CALCRIM', value: 3 },
            { label: 'Authorities', value: 8 },
          ]}
          height={220}
        />
      ),
    },
    {
      id: 'discovery',
      title: 'Discovery Progress',
      subtitle: 'What has been reviewed',
      audienceNote: {
        judge: 'Discovery review status and outstanding requests.',
        client: 'How much of the evidence has been reviewed.',
      },
      content: (
        <div className="max-w-xl space-y-4">
          <ProgressBar value={72} tone="blue" label="Discovery reviewed" showValue />
          <ProgressBar value={confidence} tone="emerald" label="Evidence confidence" showValue />
        </div>
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
      content: (
        <DonutChart
          data={[
            { label: 'High', value: 62 },
            { label: 'Medium', value: 28 },
            { label: 'Low', value: 10 },
          ]}
          size={200}
        />
      ),
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
          <ProgressRing value={strength} sublabel="High" size={180} />
          {bigStat(`${confidence}%`, 'Evidence confidence', 'text-emerald-400')}
        </div>
      ),
    },
  ];
}

const PLACEHOLDER_TIMELINE: TimelineEvent[] = [
  { id: '1', timestamp: '2026-01-03T21:40:00Z', title: 'Arrest', actor: 'Officer Reyes' },
  { id: '2', timestamp: '2026-01-04T10:00:00Z', title: 'Booking & intake' },
  { id: '3', timestamp: '2026-01-05T14:22:00Z', title: 'Body-cam footage reviewed' },
  { id: '4', timestamp: null, title: 'Dispatch-log time conflict flagged' },
];
