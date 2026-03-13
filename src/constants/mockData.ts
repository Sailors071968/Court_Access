// ============================================
// Court Access — Mock Data (Phase 1 — Canonical Types)
// All mock data conforms to canonical model interfaces.
// ============================================

import type { CaseEntity, ChargeEntity, ActivityEntry, NotificationEntry, InvestigativeTaskEntity } from '../models/CaseModel';
import type { DocumentEntity } from '../models/DocumentModel';
import { DOCUMENT_TYPE_LABELS } from '../models/DocumentModel';

// Re-export for consumers that imported from here
export { DOCUMENT_TYPE_LABELS };

// ---------------------------------------------------------------------------
// Cases — REMOVED: Mock cases deleted for production.
// Real cases are fetched from backend API via /api/cases.
// ---------------------------------------------------------------------------

export const MOCK_CASES: CaseEntity[] = [];

// ---------------------------------------------------------------------------
// Charges
// ---------------------------------------------------------------------------

export const MOCK_CHARGES: ChargeEntity[] = [
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
    degree: null,
    calcrimNumber: null,
    elements: [
      { number: 1, description: 'The defendant bought, received, or concealed property', status: 'established', details: 'Property found in defendant\'s possession' },
      { number: 2, description: 'The property had been stolen', status: 'established', details: 'Owner confirmed property was taken during burglary' },
      { number: 3, description: 'Defendant knew the property was stolen', status: 'disputed', details: 'No direct evidence of knowledge' },
    ],
    potentialSentence: '16 months - 3 years',
    enhancement: null,
  },
  {
    id: '3',
    code: 'PC 148(a)(1)',
    title: 'Resisting Arrest',
    degree: null,
    calcrimNumber: null,
    elements: [
      { number: 1, description: 'Officer was lawfully performing duties', status: 'established', details: 'Officer was executing valid arrest warrant' },
      { number: 2, description: 'Defendant willfully resisted or obstructed', status: 'disputed', details: 'Body camera footage unclear' },
    ],
    potentialSentence: 'Up to 1 year county jail',
    enhancement: null,
  },
];

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const MOCK_DOCUMENTS: DocumentEntity[] = [
  { id: '1', tenantId: 'tenant-001', caseId: '1', name: 'Motion to Suppress Evidence', type: 'defense_motion', filedDate: 'Jan 20, 2024', pages: 8, analysisStatus: 'analyzed', fileSize: 250880, fileType: 'pdf', contentHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', sha3Hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', uploadedBy: '1', uploadedAt: '2024-01-20T10:00:00Z', storagePath: '/documents/tenant-001/case-1/1-motion-to-suppress-evidence.pdf', extractedText: null, extractionStatus: 'pending', integrityVerified: false },
  { id: '2', tenantId: 'tenant-001', caseId: '1', name: 'Criminal Complaint', type: 'charging_document', filedDate: 'Dec 15, 2023', pages: 4, analysisStatus: 'analyzed', fileSize: 122880, fileType: 'pdf', contentHash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', sha3Hash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c', uploadedBy: null, uploadedAt: '2023-12-15T08:00:00Z', storagePath: '/documents/tenant-001/case-1/2-criminal-complaint.pdf', extractedText: null, extractionStatus: 'pending', integrityVerified: false },
  { id: '3', tenantId: 'tenant-001', caseId: '1', name: 'Preliminary Hearing Transcript', type: 'transcript', filedDate: 'Jan 18, 2024', pages: 45, analysisStatus: 'analyzed', fileSize: 1258291, fileType: 'pdf', contentHash: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', sha3Hash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d', uploadedBy: null, uploadedAt: '2024-01-18T14:00:00Z', storagePath: '/documents/tenant-001/case-1/3-preliminary-hearing-transcript.pdf', extractedText: null, extractionStatus: 'pending', integrityVerified: false },
  { id: '4', tenantId: 'tenant-001', caseId: '1', name: 'Motion to Exclude Witness Testimony', type: 'prosecution_motion', filedDate: 'Jan 22, 2024', pages: 6, analysisStatus: 'analyzing', fileSize: 184320, fileType: 'pdf', contentHash: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5', sha3Hash: '4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e', uploadedBy: null, uploadedAt: '2024-01-22T09:00:00Z', storagePath: '/documents/tenant-001/case-1/4-motion-to-exclude-witness-testimony.pdf', extractedText: null, extractionStatus: 'pending', integrityVerified: false },
  { id: '5', tenantId: 'tenant-001', caseId: '1', name: 'Arraignment Minutes', type: 'court_order', filedDate: 'Dec 20, 2023', pages: 2, analysisStatus: 'analyzed', fileSize: 87040, fileType: 'pdf', contentHash: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6', sha3Hash: '5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', uploadedBy: null, uploadedAt: '2023-12-20T11:00:00Z', storagePath: '/documents/tenant-001/case-1/5-arraignment-minutes.pdf', extractedText: null, extractionStatus: 'pending', integrityVerified: false },
  { id: '6', tenantId: 'tenant-001', caseId: '1', name: 'Discovery Request Response', type: 'defense_filing', filedDate: 'Jan 10, 2024', pages: 12, analysisStatus: 'analyzed', fileSize: 348160, fileType: 'pdf', contentHash: 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1', sha3Hash: '6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a', uploadedBy: '1', uploadedAt: '2024-01-10T16:00:00Z', storagePath: '/documents/tenant-001/case-1/6-discovery-request-response.pdf', extractedText: null, extractionStatus: 'pending', integrityVerified: false },
];

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export const MOCK_ACTIVITY: ActivityEntry[] = [
  { id: '1', type: 'document', title: 'New Document Filed', description: 'Motion to Exclude Witness Testimony filed by prosecution.', timestamp: '2 hours ago', actionLabel: 'View Document', actionUrl: null },
  { id: '2', type: 'hearing', title: 'Upcoming Court Date', description: 'Preliminary Hearing scheduled for Feb 15, 2024 at 10:00 AM — Courtroom 3B.', timestamp: '1 day ago', actionLabel: 'Add to Calendar', actionUrl: null },
  { id: '3', type: 'analysis', title: 'AI Analysis Complete', description: 'Motion to Suppress Evidence has been analyzed. 3 key insights identified.', timestamp: '3 days ago', actionLabel: 'View Analysis', actionUrl: null },
  { id: '4', type: 'document', title: 'New Document Filed', description: 'Criminal Complaint filed - 3 charges identified.', timestamp: '1 week ago', actionLabel: 'View Document', actionUrl: null },
];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const MOCK_NOTIFICATIONS: NotificationEntry[] = [
  { id: '1', type: 'document', title: 'New Document Filed', description: 'Motion to Exclude Witness Testimony filed by prosecution.', timestamp: '2 hours ago', read: false, actionLabel: 'View Document', actionUrl: null },
  { id: '2', type: 'hearing', title: 'Upcoming Court Date', description: 'Preliminary Hearing scheduled for Feb 15, 2024 at 10:00 AM — Courtroom 3B.', timestamp: '1 day ago', read: false, actionLabel: 'Add to Calendar', actionUrl: null },
  { id: '3', type: 'analysis', title: 'AI Analysis Complete', description: 'Motion to Suppress Evidence has been analyzed. 3 key insights identified.', timestamp: '3 days ago', read: false, actionLabel: 'View Analysis', actionUrl: null },
  { id: '4', type: 'document', title: 'New Document Filed', description: 'Criminal Complaint filed - 3 charges identified.', timestamp: '1 week ago', read: true, actionLabel: 'View Document', actionUrl: null },
];

// ---------------------------------------------------------------------------
// Investigative Tasks
// ---------------------------------------------------------------------------

export const MOCK_TASKS: InvestigativeTaskEntity[] = [
  { id: '1', number: 1, title: 'Canvas 200 block of Oak Street for witnesses - 3 residential buildings may have seen incident at 11:45 PM', description: 'The location is directly across from the incident. Witnesses could provide crucial timeline details and descriptions of potential subjects.', priority: 'high', status: 'pending' },
  { id: '2', number: 2, title: 'Subpoena surveillance footage from QuickMart at 198 Oak St - Camera faces incident location', description: 'The external camera reportedly captures the entire storefront and the street where the incident occurred.', priority: 'high', status: 'pending' },
  { id: '3', number: 3, title: 'Request cell tower records for defendant phone - May establish alibi timeline', description: "Analysis of cell tower pings could corroborate the defendant's claim of being in a different location during the incident.", priority: 'medium', status: 'pending' },
  { id: '4', number: 4, title: 'Interview Maria Santos (witness #2) - Statement inconsistent with officer report', description: 'Review the initial statement provided to police and prepare questions to address discrepancies regarding the sequence of events.', priority: 'medium', status: 'pending' },
  { id: '5', number: 5, title: 'Obtain traffic camera footage from Oak/Main intersection', description: "This camera is located two blocks from the scene and may have captured the defendant's vehicle before or after the incident.", priority: 'medium', status: 'pending' },
  { id: '6', number: 6, title: 'Research Officer Martinez complaint history', description: 'Review internal affairs records and prior court testimony for any patterns of misconduct or bias.', priority: 'standard', status: 'pending' },
  { id: '7', number: 7, title: 'Document lighting conditions at scene - Street lamp outage reported', description: 'Confirm the report of the street lamp outage and take photographs/video of the lighting conditions at the scene at the time of the incident.', priority: 'standard', status: 'pending' },
];
