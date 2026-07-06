// =============================================================================
// CourtAccess — Report Builder (Program 30)
// THE single source of report logic. buildReport(type, bundle) → ReportDoc.
// Every report type is derived here so no report logic is duplicated in the UI.
// =============================================================================

import type { WorkbenchBundle } from '../../services/workbenchApi';
import type { ReportDoc, ReportSection, ReportType } from './types';

function overviewSection(b: WorkbenchBundle): ReportSection {
  const o = b.caseOverview;
  return {
    id: 'overview',
    title: 'Case Overview',
    icon: 'attorney',
    blocks: [
      {
        kind: 'keyvalue',
        rows: [
          { label: 'Case', value: `${o.case.title} (${o.case.caseNumber})` },
          { label: 'Status', value: o.case.status },
          { label: 'Phase', value: o.case.phase },
          { label: 'Court', value: o.court ?? '—' },
          { label: 'Judge', value: o.judge ?? '—' },
          { label: 'Prosecutor', value: o.prosecutor ?? '—' },
          { label: 'Client', value: o.client?.name ?? '—' },
        ],
      },
      ...(o.intelligenceSummary.unknownCount + o.intelligenceSummary.contradictionCount > 0
        ? [
            {
              kind: 'humanReview' as const,
              count: o.intelligenceSummary.unknownCount + o.intelligenceSummary.contradictionCount,
              note: 'Unknowns and contradictions require attorney review.',
            },
          ]
        : []),
    ],
  };
}

function chronologySection(b: WorkbenchBundle): ReportSection {
  const events = b.caseOverview.caseTimeline;
  return {
    id: 'chronology',
    title: 'Chronology',
    icon: 'timeline',
    blocks: [
      {
        kind: 'table',
        headers: ['Time', 'Actor', 'Event', 'Flag'],
        rows: events.map((e) => [
          e.timestamp ? new Date(e.timestamp).toLocaleString() : 'UNKNOWN',
          e.actor ?? '—',
          e.description,
          e.conflictFlag ? 'Conflict' : '',
        ]),
      },
    ],
  };
}

function evidenceSection(b: WorkbenchBundle): ReportSection {
  return {
    id: 'evidence',
    title: 'Evidence Index',
    icon: 'evidence',
    blocks: [
      {
        kind: 'table',
        headers: ['File', 'Type', 'Status', 'Confidence'],
        rows: b.evidenceWorkbench.items.map((i) => [i.fileName, i.evidenceType, i.processingStatus, i.confidence]),
      },
    ],
  };
}

function witnessSection(b: WorkbenchBundle): ReportSection {
  return {
    id: 'witnesses',
    title: 'Witness Index',
    icon: 'witness',
    blocks: [
      {
        kind: 'table',
        headers: ['Witness', 'Detail'],
        rows: b.trialPreparation.witnessList.map((w) => [w.title, w.detail]),
      },
    ],
  };
}

function discoverySection(b: WorkbenchBundle): ReportSection {
  return {
    id: 'discovery',
    title: 'Discovery Index',
    icon: 'discovery',
    blocks: [
      {
        kind: 'table',
        headers: ['Request', 'Status', 'Priority'],
        rows: b.investigation.discoveryRequests.map((d) => [d.title, d.status, d.priority]),
      },
      ...(b.investigation.recommendedDiscovery.length
        ? [{ kind: 'list' as const, items: b.investigation.recommendedDiscovery }]
        : []),
    ],
  };
}

function exhibitSection(b: WorkbenchBundle): ReportSection {
  return {
    id: 'exhibits',
    title: 'Exhibit List',
    icon: 'documents',
    blocks: [
      {
        kind: 'table',
        headers: ['Exhibit', 'Detail'],
        rows: b.trialPreparation.exhibitList.map((e) => [e.title, e.detail]),
      },
    ],
  };
}

function authoritySection(b: WorkbenchBundle): ReportSection {
  return {
    id: 'authorities',
    title: 'Authority Index',
    icon: 'authorities',
    blocks: [
      { kind: 'list', items: b.legalAuthority.authorities.map((a) => a.finding) },
      ...(b.legalAuthority.calcrim.length
        ? [{ kind: 'list' as const, items: b.legalAuthority.calcrim.map((c) => c.finding) }]
        : []),
    ],
  };
}

function contradictionSection(b: WorkbenchBundle): ReportSection {
  return {
    id: 'contradictions',
    title: 'Contradictions',
    icon: 'contradiction',
    blocks: [
      b.evidenceWorkbench.contradictions.length
        ? {
            kind: 'table',
            headers: ['Finding', 'Status'],
            rows: b.evidenceWorkbench.contradictions.map((c) => [c.finding, c.status]),
          }
        : { kind: 'callout', tone: 'info', text: 'No contradictions detected.' },
    ],
  };
}

function unknownSection(b: WorkbenchBundle): ReportSection {
  const unknowns = b.intelligence.unknowns.all;
  return {
    id: 'unknowns',
    title: 'Unknowns',
    icon: 'unknown',
    blocks: [
      unknowns.length
        ? { kind: 'list', items: unknowns }
        : { kind: 'callout', tone: 'info', text: 'No open unknowns.' },
    ],
  };
}

function motionSection(b: WorkbenchBundle): ReportSection {
  return {
    id: 'motions',
    title: 'Motion Support',
    icon: 'statutes',
    blocks: [
      b.intelligence.recommendedMotions.length
        ? { kind: 'list', items: b.intelligence.recommendedMotions }
        : { kind: 'callout', tone: 'info', text: 'No motion opportunities identified yet.' },
    ],
  };
}

function trialNotebookSections(b: WorkbenchBundle): ReportSection[] {
  const tp = b.trialPreparation;
  const fromItems = (id: string, title: string, items: { title: string; detail: string }[]): ReportSection => ({
    id,
    title,
    icon: 'reports',
    blocks: [{ kind: 'table', headers: ['Item', 'Detail'], rows: items.map((i) => [i.title, i.detail]) }],
  });
  return [
    fromItems('opening', 'Opening Outline', tp.openingOutline),
    fromItems('cross', 'Cross-Examination Topics', tp.crossExaminationTopics),
    fromItems('impeach', 'Impeachment Opportunities', tp.impeachmentOpportunities),
    fromItems('closing', 'Closing Outline', tp.closingOutline),
  ];
}

/** Single entry point: derive any report type from the workbench bundle. */
export function buildReport(type: ReportType, b: WorkbenchBundle): ReportDoc {
  const base = {
    type,
    generatedAt: b.generatedAt,
    subtitle: `${b.caseOverview.case.title} · ${b.caseOverview.case.caseNumber}`,
  };

  switch (type) {
    case 'attorney_report':
      return {
        ...base,
        title: 'Attorney Report',
        sections: [
          overviewSection(b),
          chronologySection(b),
          evidenceSection(b),
          contradictionSection(b),
          authoritySection(b),
          motionSection(b),
          unknownSection(b),
        ],
      };
    case 'client_report':
      return {
        ...base,
        title: 'Client Report',
        sections: [overviewSection(b), chronologySection(b), unknownSection(b)],
      };
    case 'chronology':
      return { ...base, title: 'Chronology', sections: [chronologySection(b)] };
    case 'evidence_index':
      return { ...base, title: 'Evidence Index', sections: [evidenceSection(b)] };
    case 'witness_index':
      return { ...base, title: 'Witness Index', sections: [witnessSection(b)] };
    case 'discovery_index':
      return { ...base, title: 'Discovery Index', sections: [discoverySection(b)] };
    case 'exhibit_list':
      return { ...base, title: 'Exhibit List', sections: [exhibitSection(b)] };
    case 'authority_index':
      return { ...base, title: 'Authority Index', sections: [authoritySection(b)] };
    case 'contradictions':
      return { ...base, title: 'Contradictions', sections: [contradictionSection(b)] };
    case 'unknowns':
      return { ...base, title: 'Unknowns', sections: [unknownSection(b)] };
    case 'motion_support':
      return { ...base, title: 'Motion Support', sections: [motionSection(b)] };
    case 'trial_notebook':
      return {
        ...base,
        title: 'Trial Notebook',
        sections: [witnessSection(b), exhibitSection(b), ...trialNotebookSections(b)],
      };
    default:
      return { ...base, title: 'Report', sections: [overviewSection(b)] };
  }
}
