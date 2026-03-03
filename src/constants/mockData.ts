// ============================================
// Court Access — Mock Data
// ============================================

import type {
  Case,
  Charge,
  CaseDocument,
  ActivityItem,
  Notification,
  InvestigativeTask,
} from '../types';

export const MOCK_CASES: Case[] = [
  {
    id: '1',
    caseNumber: '2024-CF-001234',
    title: 'People v. Smith',
    status: 'active',
    jurisdiction: 'Superior Court of California',
    court: 'County of Los Angeles',
    judge: 'Hon. Patricia Williams',
    department: '23',
    nextHearing: 'Feb 15, 2024',
    nextHearingLocation: '10:00 AM, Courtroom 3B',
    documentsCount: 12,
    chargesCount: 3,
    createdAt: '2023-12-01',
    updatedAt: '2024-01-22',
  },
  {
    id: '2',
    caseNumber: '2024-CF-002345',
    title: 'People v. Johnson',
    status: 'active',
    jurisdiction: 'Superior Court of California',
    court: 'County of San Diego',
    judge: 'Hon. Robert Chen',
    department: '15',
    nextHearing: 'Mar 1, 2024',
    nextHearingLocation: '2:00 PM, Courtroom 7A',
    documentsCount: 8,
    chargesCount: 2,
    createdAt: '2024-01-05',
    updatedAt: '2024-01-20',
  },
  {
    id: '3',
    caseNumber: '2023-CF-009876',
    title: 'People v. Garcia',
    status: 'pending',
    jurisdiction: 'Superior Court of California',
    court: 'County of Orange',
    judge: 'Hon. Sarah Kim',
    department: '8',
    documentsCount: 5,
    chargesCount: 1,
    createdAt: '2023-11-15',
    updatedAt: '2024-01-10',
  },
];

export const MOCK_CHARGES: Charge[] = [
  {
    id: '1',
    code: 'PC 459',
    title: 'Burglary (1st Degree)',
    degree: '1st Degree',
    calcrimNumber: 'CALCRIM 1700',
    elements: [
      { number: 1, description: 'The defendant entered a building', status: 'established', details: 'Supported by witness testimony in preliminary hearing transcript' },
      { number: 2, description: 'When entering, defendant intended to commit theft', status: 'disputed', details: 'No direct evidence of intent at time of entry' },
      { number: 3, description: 'The building was an inhabited dwelling', status: 'established', details: 'Confirmed in criminal complaint' },
      { number: 4, description: 'Entry occurred during nighttime (after sunset, before sunrise)', status: 'unclear', details: 'Time of entry not specified in documents' },
    ],
    potentialSentence: '2-6 years state prison',
    enhancement: 'First-degree (inhabited dwelling)',
  },
  {
    id: '2',
    code: 'PC 496(a)',
    title: 'Receiving Stolen Property',
    elements: [
      { number: 1, description: 'The defendant bought, received, or concealed property', status: 'established', details: 'Property found in defendant\'s possession' },
      { number: 2, description: 'The property had been stolen', status: 'established', details: 'Owner confirmed property was taken during burglary' },
      { number: 3, description: 'Defendant knew the property was stolen', status: 'disputed', details: 'No direct evidence of knowledge' },
    ],
    potentialSentence: '16 months - 3 years',
  },
  {
    id: '3',
    code: 'PC 148(a)(1)',
    title: 'Resisting Arrest',
    elements: [
      { number: 1, description: 'Officer was lawfully performing duties', status: 'established', details: 'Officer was executing valid arrest warrant' },
      { number: 2, description: 'Defendant willfully resisted or obstructed', status: 'disputed', details: 'Body camera footage unclear' },
    ],
    potentialSentence: 'Up to 1 year county jail',
  },
];

export const MOCK_DOCUMENTS: CaseDocument[] = [
  { id: '1', name: 'Motion to Suppress Evidence', type: 'defense_motion', filedDate: 'Jan 20, 2024', pages: 8, aiStatus: 'analyzed' },
  { id: '2', name: 'Criminal Complaint', type: 'charging_document', filedDate: 'Dec 15, 2023', pages: 4, aiStatus: 'analyzed' },
  { id: '3', name: 'Preliminary Hearing Transcript', type: 'transcript', filedDate: 'Jan 18, 2024', pages: 45, aiStatus: 'analyzed' },
  { id: '4', name: 'Motion to Exclude Witness Testimony', type: 'prosecution_motion', filedDate: 'Jan 22, 2024', pages: 6, aiStatus: 'analyzing' },
  { id: '5', name: 'Arraignment Minutes', type: 'court_order', filedDate: 'Dec 20, 2023', pages: 2, aiStatus: 'analyzed' },
  { id: '6', name: 'Discovery Request Response', type: 'defense_filing', filedDate: 'Jan 10, 2024', pages: 12, aiStatus: 'analyzed' },
];

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: '1', type: 'document', title: 'New Document Filed', description: 'Motion to Exclude Witness Testimony filed by prosecution.', timestamp: '2 hours ago', actionLabel: 'View Document', actionUrl: '/cases/1/documents' },
  { id: '2', type: 'hearing', title: 'Upcoming Court Date', description: 'Preliminary Hearing scheduled for Feb 15, 2024 at 10:00 AM — Courtroom 3B.', timestamp: '1 day ago', actionLabel: 'Add to Calendar' },
  { id: '3', type: 'analysis', title: 'AI Analysis Complete', description: 'Motion to Suppress Evidence has been analyzed. 3 key insights identified.', timestamp: '3 days ago', actionLabel: 'View Analysis', actionUrl: '/cases/1/documents' },
  { id: '4', type: 'document', title: 'New Document Filed', description: 'Criminal Complaint filed - 3 charges identified.', timestamp: '1 week ago', actionLabel: 'View Document', actionUrl: '/cases/1/documents' },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'document', title: 'New Document Filed', description: 'Motion to Exclude Witness Testimony filed by prosecution.', timestamp: '2 hours ago', read: false, actionLabel: 'View Document' },
  { id: '2', type: 'hearing', title: 'Upcoming Court Date', description: 'Preliminary Hearing scheduled for Feb 15, 2024 at 10:00 AM — Courtroom 3B.', timestamp: '1 day ago', read: false, actionLabel: 'Add to Calendar' },
  { id: '3', type: 'analysis', title: 'AI Analysis Complete', description: 'Motion to Suppress Evidence has been analyzed. 3 key insights identified.', timestamp: '3 days ago', read: false, actionLabel: 'View Analysis' },
  { id: '4', type: 'document', title: 'New Document Filed', description: 'Criminal Complaint filed - 3 charges identified.', timestamp: '1 week ago', read: true, actionLabel: 'View Document' },
];

export const MOCK_TASKS: InvestigativeTask[] = [
  { id: '1', number: 1, title: 'Canvas 200 block of Oak Street for witnesses - 3 residential buildings may have seen incident at 11:45 PM', description: 'The location is directly across from the incident. Witnesses could provide crucial timeline details and descriptions of potential subjects.', priority: 'high', status: 'pending' },
  { id: '2', number: 2, title: 'Subpoena surveillance footage from QuickMart at 198 Oak St - Camera faces incident location', description: 'The external camera reportedly captures the entire storefront and the street where the incident occurred.', priority: 'high', status: 'pending' },
  { id: '3', number: 3, title: 'Request cell tower records for defendant phone - May establish alibi timeline', description: "Analysis of cell tower pings could corroborate the defendant's claim of being in a different location during the incident.", priority: 'medium', status: 'pending' },
  { id: '4', number: 4, title: 'Interview Maria Santos (witness #2) - Statement inconsistent with officer report', description: 'Review the initial statement provided to police and prepare questions to address discrepancies regarding the sequence of events.', priority: 'medium', status: 'pending' },
  { id: '5', number: 5, title: 'Obtain traffic camera footage from Oak/Main intersection', description: "This camera is located two blocks from the scene and may have captured the defendant's vehicle before or after the incident.", priority: 'medium', status: 'pending' },
  { id: '6', number: 6, title: 'Research Officer Martinez complaint history', description: 'Review internal affairs records and prior court testimony for any patterns of misconduct or bias.', priority: 'standard', status: 'pending' },
  { id: '7', number: 7, title: 'Document lighting conditions at scene - Street lamp outage reported', description: 'Confirm the report of the street lamp outage and take photographs/video of the lighting conditions at the scene at the time of the incident.', priority: 'standard', status: 'pending' },
];

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  defense_motion: 'Defense Motion',
  charging_document: 'Charging Document',
  transcript: 'Transcript',
  prosecution_motion: 'Prosecution Motion',
  court_order: 'Court Order',
  defense_filing: 'Defense Filing',
  other: 'Other',
};
