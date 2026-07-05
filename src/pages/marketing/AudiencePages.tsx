// ============================================================================
// Audience-specific public pages — Program 1
// ============================================================================

import { PersonaMarketingPage } from './PersonaMarketingPage';
import {
  ATTORNEY_PERSONA,
  INVESTIGATOR_PERSONA,
  DEFENDANT_PERSONA,
  FAMILIES_PERSONA,
  EXPERTS_PERSONA,
} from './personaConfigs';

export function AttorneyPage() {
  return <PersonaMarketingPage config={ATTORNEY_PERSONA} />;
}

export function InvestigatorPage() {
  return <PersonaMarketingPage config={INVESTIGATOR_PERSONA} />;
}

export function DefendantPage() {
  return <PersonaMarketingPage config={DEFENDANT_PERSONA} />;
}

export function FamiliesPage() {
  return <PersonaMarketingPage config={FAMILIES_PERSONA} />;
}

export function ExpertsPage() {
  return <PersonaMarketingPage config={EXPERTS_PERSONA} />;
}
