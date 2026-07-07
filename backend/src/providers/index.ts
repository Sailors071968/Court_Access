// ============================================================================
// Provider registration — wires all Legal Intelligence providers into the
// canonical registry. Active providers implement real capabilities; declared
// providers are registered honestly (0 active capabilities) with the reason
// they are not yet active (credentials, upstream availability, or planned).
// ============================================================================

import { providerRegistry } from './registry.js';
import { CourtListenerProvider } from './courtListenerProvider.js';
import { CaliforniaLegislativeProvider } from './californiaLegislativeProvider.js';
import { DeclaredProvider } from './declaredProvider.js';

let registered = false;

export function registerAllProviders(): void {
  if (registered) return;
  registered = true;

  // ── Active, runtime-verifiable providers ──────────────────────────────────
  providerRegistry.register(new CourtListenerProvider());
  providerRegistry.register(new CaliforniaLegislativeProvider());

  // ── Declared adapters (framework-registered, not yet active) ──────────────
  providerRegistry.register(new DeclaredProvider({
    id: 'cap', name: 'Caselaw Access Project (CAP)', description: 'Historical U.S. case law (Harvard LIL).',
    documentationUrl: 'https://case.law/', authMethod: 'api_token', authEnvVar: 'CAP_API_TOKEN', authConfigured: false,
    jurisdictions: ['US'], plannedRecordTypes: ['opinion'], healthStatus: 'degraded',
    reason: 'CAP REST API was sunset in 2024 (api.case.law redirects); bulk data at static.case.law. Adapter declared pending bulk-sync implementation.',
  }));
  providerRegistry.register(new DeclaredProvider({
    id: 'openlaws', name: 'OpenLaws', description: 'Statutes, regulations, and cases with cross-jurisdiction linking.',
    documentationUrl: 'https://openlaws.us/', authMethod: 'api_token', authEnvVar: 'OPENLAWS_API_KEY', authConfigured: false,
    jurisdictions: ['US', 'US-states'], plannedRecordTypes: ['statute', 'regulation', 'opinion'], healthStatus: 'unknown',
    reason: 'Requires OPENLAWS_API_KEY; adapter declared pending credentials.',
  }));
  providerRegistry.register(new DeclaredProvider({
    id: 'pacer', name: 'PACER', description: 'Federal court dockets and filings (fee-based).',
    documentationUrl: 'https://pacer.uscourts.gov/', authMethod: 'credentials', authEnvVar: 'PACER_USERNAME', authConfigured: false,
    jurisdictions: ['US-federal'], plannedRecordTypes: ['docket', 'filing'], healthStatus: 'unknown',
    reason: 'Requires PACER credentials + billing controls; adapter declared, not activated.',
  }));
  providerRegistry.register(new DeclaredProvider({
    id: 'recap', name: 'RECAP', description: 'Free mirror of PACER documents via CourtListener/RECAP.',
    documentationUrl: 'https://free.law/recap/', authMethod: 'api_token', authEnvVar: 'COURTLISTENER_API_TOKEN', authConfigured: false,
    jurisdictions: ['US-federal'], plannedRecordTypes: ['docket', 'filing'], healthStatus: 'degraded',
    reason: 'RECAP is served via CourtListener; token-gated docket/document endpoints pending COURTLISTENER_API_TOKEN.',
  }));
  providerRegistry.register(new DeclaredProvider({
    id: 'ca-judicial-council', name: 'California Judicial Council', description: 'CALCRIM instructions, Judicial Council forms, California Rules of Court.',
    documentationUrl: 'https://courts.ca.gov/', authMethod: 'none', authEnvVar: null, authConfigured: false,
    jurisdictions: ['US-CA'], plannedRecordTypes: ['jury_instruction', 'form', 'rule'], healthStatus: 'unknown',
    reason: 'Declared pending CALCRIM/forms/rules acquisition into the repository (Phase 9).',
  }));
  providerRegistry.register(new DeclaredProvider({
    id: 'westlaw', name: 'Westlaw (enterprise, optional)', description: 'Commercial legal research — optional enterprise adapter.',
    documentationUrl: 'https://legal.thomsonreuters.com/', authMethod: 'credentials', authEnvVar: 'WESTLAW_API_KEY', authConfigured: false,
    jurisdictions: ['US'], plannedRecordTypes: ['opinion', 'statute', 'secondary'], healthStatus: 'unknown',
    reason: 'Optional commercial provider; no hard dependency. Requires enterprise license.',
  }));
  providerRegistry.register(new DeclaredProvider({
    id: 'lexis', name: 'LexisNexis (enterprise, optional)', description: 'Commercial legal research — optional enterprise adapter.',
    documentationUrl: 'https://www.lexisnexis.com/', authMethod: 'credentials', authEnvVar: 'LEXIS_API_KEY', authConfigured: false,
    jurisdictions: ['US'], plannedRecordTypes: ['opinion', 'statute', 'secondary'], healthStatus: 'unknown',
    reason: 'Optional commercial provider; no hard dependency. Requires enterprise license.',
  }));
}
