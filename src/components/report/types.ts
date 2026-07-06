// =============================================================================
// CourtAccess — Report Engine types (Program 30)
// One document model powers every report. No duplicated report logic.
// =============================================================================

import type { IconName } from '../icons/registry';
import type { CitationRef } from '../../services/workbenchApi';

export type ReportType =
  | 'attorney_report'
  | 'client_report'
  | 'chronology'
  | 'evidence_index'
  | 'witness_index'
  | 'discovery_index'
  | 'exhibit_list'
  | 'authority_index'
  | 'contradictions'
  | 'unknowns'
  | 'motion_support'
  | 'trial_notebook';

export type ReportBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'keyvalue'; rows: { label: string; value: string }[] }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'citations'; refs: CitationRef[] }
  | { kind: 'callout'; tone: 'info' | 'warning' | 'danger'; text: string }
  | { kind: 'humanReview'; count: number; note?: string };

export interface ReportSection {
  id: string;
  title: string;
  icon?: IconName;
  blocks: ReportBlock[];
}

export interface ReportDoc {
  type: ReportType;
  title: string;
  subtitle?: string;
  generatedAt: string;
  sections: ReportSection[];
}

export type ReportPreviewMode = 'document' | 'pdf' | 'word' | 'presentation';

export const REPORT_TYPES: { id: ReportType; label: string; icon: IconName }[] = [
  { id: 'attorney_report', label: 'Attorney Report', icon: 'attorney' },
  { id: 'client_report', label: 'Client Report', icon: 'defendant' },
  { id: 'chronology', label: 'Chronology', icon: 'timeline' },
  { id: 'evidence_index', label: 'Evidence Index', icon: 'evidence' },
  { id: 'witness_index', label: 'Witness Index', icon: 'witness' },
  { id: 'discovery_index', label: 'Discovery Index', icon: 'discovery' },
  { id: 'exhibit_list', label: 'Exhibit List', icon: 'documents' },
  { id: 'authority_index', label: 'Authority Index', icon: 'authorities' },
  { id: 'contradictions', label: 'Contradictions', icon: 'contradiction' },
  { id: 'unknowns', label: 'Unknowns', icon: 'unknown' },
  { id: 'motion_support', label: 'Motion Support', icon: 'statutes' },
  { id: 'trial_notebook', label: 'Trial Notebook', icon: 'reports' },
];
