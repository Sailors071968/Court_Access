// ============================================================================
// Audience persona page configurations — Program 1 Public Website
// ============================================================================

import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Search,
  Users,
  Microscope,
  FileText,
  Scale,
  Shield,
  Eye,
  MessageSquare,
  Clock,
  Gavel,
  BookOpen,
  MapPin,
} from 'lucide-react';

export interface PersonaFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface PersonaConfig {
  badge: string;
  title: string;
  highlight: string;
  subtitle: string;
  features: PersonaFeature[];
}

export const ATTORNEY_PERSONA: PersonaConfig = {
  badge: 'For Attorneys',
  title: 'Command Center for',
  highlight: 'Criminal Defense',
  subtitle:
    'Organize discovery, map charges to elements and CALCRIM, surface contradictions, and generate attorney reports — every conclusion linked to supporting evidence.',
  features: [
    { icon: Gavel, title: 'Charge & Element Mapping', description: 'Map every charged offense to statutory elements, mens rea, and jury instructions.' },
    { icon: FileText, title: 'Discovery Intelligence', description: 'Upload, classify, and search case documents with immutable originals and audit trails.' },
    { icon: Scale, title: 'Authority Linking', description: 'Connect facts to California statutes, case law, and CALCRIM instructions.' },
    { icon: Eye, title: 'Contradiction Detection', description: 'Surface inconsistent statements across witnesses, reports, and body-camera footage.' },
    { icon: Briefcase, title: 'Motion Preparation', description: 'Track motions, deadlines, and supporting exhibits in one evidence-governed workspace.' },
    { icon: Shield, title: 'Publication Controls', description: 'Redact and publish evidence to clients, investigators, and experts with independent permissions.' },
  ],
};

export const INVESTIGATOR_PERSONA: PersonaConfig = {
  badge: 'For Investigators',
  title: 'Investigation Workspace for',
  highlight: 'Defense Teams',
  subtitle:
    'Manage interviews, surveillance, OSINT, crime scene analysis, and evidence requests — every finding tied to the case record.',
  features: [
    { icon: Search, title: 'OSINT & Lead Tracking', description: 'Research people, locations, and digital footprints with auditable notes.' },
    { icon: MapPin, title: 'Crime Scene Analysis', description: 'Document scenes, vehicles, and physical evidence with geotagged exhibits.' },
    { icon: Eye, title: 'Surveillance Management', description: 'Log observations, photos, and video with chain-of-custody metadata.' },
    { icon: MessageSquare, title: 'Interview Management', description: 'Schedule, record, and cross-reference witness and subject interviews.' },
    { icon: Clock, title: 'Task Management', description: 'Assign and track investigative tasks with evidence-linked deliverables.' },
    { icon: FileText, title: 'Evidence Requests', description: 'Submit and monitor CPRA and discovery requests with delivery tracking.' },
  ],
};

export const DEFENDANT_PERSONA: PersonaConfig = {
  badge: 'For Defendants',
  title: 'Understand Your',
  highlight: 'Criminal Case',
  subtitle:
    'Review charges, evidence, court dates, and attorney communications in a secure client portal — full platform access with permission-based visibility.',
  features: [
    { icon: Scale, title: 'Charge Breakdown', description: 'See every charge, element, and potential penalty in plain language.' },
    { icon: FileText, title: 'Shared Documents', description: 'Access documents your attorney publishes — hidden material never appears.' },
    { icon: Clock, title: 'Court Dates & Timeline', description: 'Track hearings, deadlines, and case milestones in one timeline.' },
    { icon: MessageSquare, title: 'Secure Messaging', description: 'Communicate with your defense team without email exposure.' },
    { icon: Eye, title: 'Evidence Review', description: 'Review published evidence with redactions applied per publication profile.' },
    { icon: Shield, title: 'Privacy by Design', description: 'Tenant isolation and encryption protect your case from unauthorized access.' },
  ],
};

export const FAMILIES_PERSONA: PersonaConfig = {
  badge: 'For Families',
  title: 'Support Your Loved One\'s',
  highlight: 'Defense',
  subtitle:
    'Authorized family members receive delegated access to court dates, published documents, and case updates — without seeing attorney-only material.',
  features: [
    { icon: Users, title: 'Collaborators', description: 'Attorneys invite unlimited collaborators with independent permission levels.' },
    { icon: Clock, title: 'Court Date Alerts', description: 'Receive notifications for hearings and critical deadlines.' },
    { icon: FileText, title: 'Published Documents', description: 'View only what the defense team publishes to the family profile.' },
    { icon: MessageSquare, title: 'Secure Communication', description: 'Message the defense team through encrypted in-platform channels.' },
    { icon: Eye, title: 'Case Timeline', description: 'Follow case progress without accessing privileged work product.' },
    { icon: Shield, title: 'Non-Disclosure by Design', description: 'Recipients never know excluded information exists.' },
  ],
};

export const EXPERTS_PERSONA: PersonaConfig = {
  badge: 'For Experts',
  title: 'Expert Review',
  highlight: 'Workspace',
  subtitle:
    'Forensic, medical, and technical experts receive scoped access to relevant evidence, reports, and analysis tools for California criminal cases.',
  features: [
    { icon: Microscope, title: 'Scoped Evidence Access', description: 'Review only evidence published to your expert publication profile.' },
    { icon: FileText, title: 'Report Generation', description: 'Produce expert reports linked to source exhibits and chain of custody.' },
    { icon: BookOpen, title: 'Technical Analysis', description: 'Access CALCRIM, statutory context, and case background for your specialty.' },
    { icon: Eye, title: 'Redacted Publications', description: 'Receive permanently redacted copies suitable for expert review.' },
    { icon: MessageSquare, title: 'Attorney Collaboration', description: 'Communicate findings directly within the case workspace.' },
    { icon: Shield, title: 'Audit Trail', description: 'Every view and export logged for litigation integrity.' },
  ],
};
