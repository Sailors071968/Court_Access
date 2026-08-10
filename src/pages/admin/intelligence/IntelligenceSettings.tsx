// Settings: what this version does and does not do.
//
// Read-only on purpose. Version 1 has nothing worth configuring from a browser — the
// parser profiles are versioned records rather than editable settings, and a screen
// that let an operator edit one would let them misdescribe how already-imported
// documents were read. What the page is for is stating the scope, so an operator
// looking for the scheduler finds out it does not exist rather than assuming it is
// broken.

import { useCallback, useEffect, useState } from 'react';

import { intelligenceApi, type IntelligenceSettings as Settings } from '@/services/inmateIntelligenceApi';
import {
  Badge, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th, formatBytes,
} from './shared';

export function IntelligenceSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSettings(await intelligenceApi.settings());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading settings" />;
  if (error) return <ErrorNotice message={error} onRetry={() => void load()} />;
  if (!settings) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Settings"
        subtitle="What this version supports. Read-only: parser profiles are versioned records, not editable settings."
      />

      <Panel title="Version 1 scope" description="Deliberate limits, not missing work.">
        <ul className="space-y-2 text-sm">
          <Scope on label="Sacramento County" detail={`Configured facilities: ${settings.scope.facilities.join(', ')}`} />
          <Scope on label="Manual upload" detail={`CSV and PDF, up to ${formatBytes(settings.scope.maxUploadBytes)} per file`} />
          <Scope on label="Manual processing" detail="Process Import runs the pipeline from the dashboard. No CLI required." />
          <Scope on={settings.scope.schedulerEnabled} label="Scheduled imports" detail="Not in this version. Rosters are uploaded by hand." />
          <Scope
            on={settings.scope.watchListNotificationsEnabled}
            label="Watch list notifications"
            detail="Matches are recorded and visible, but nothing is sent anywhere yet."
          />
          <Scope on={false} label="OCR tuning" detail="Scanned PDFs fall back to OCR unoptimised. Text-layer PDFs are read directly." />
        </ul>
      </Panel>

      <Panel title="Facilities" description="A facility must exist before its documents can be recorded.">
        {settings.facilities.length === 0 ? (
          <EmptyState title="No facilities registered" detail="Run the Sacramento seed script." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>County</Th>
                <Th>Roster type</Th>
                <Th>Active</Th>
              </tr>
            </thead>
            <tbody>
              {settings.facilities.map((facility) => (
                <tr key={facility.code}>
                  <Td className="font-mono text-xs">{facility.code}</Td>
                  <Td className="font-medium text-gray-900">{facility.name}</Td>
                  <Td>{facility.county ?? '—'}</Td>
                  <Td>
                    {facility.rostersAreFullPopulation ? (
                      <span title="Everyone in custody is listed, so a booking that stops appearing is a departure.">
                        Full population
                      </span>
                    ) : (
                      <span title="Only changes are listed, so an absence means nothing.">Incremental</span>
                    )}
                  </Td>
                  <Td>{facility.active ? <Badge tone="good">Yes</Badge> : <Badge tone="neutral">No</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      <Panel
        title="Parser profiles"
        description="How each source's documents are read. A layout change is a new version with its own effective window, never an edit — the old version is the only accurate description of how last year's documents were read."
      >
        {settings.parserProfiles.length === 0 ? (
          <EmptyState
            title="No parser profiles published"
            detail="Imports will fall back to the compiled-in column map, and their provenance will be weaker."
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Facility</Th>
                <Th>Source</Th>
                <Th align="right">Version</Th>
                <Th>Effective</Th>
                <Th>Why this version exists</Th>
              </tr>
            </thead>
            <tbody>
              {settings.parserProfiles.map((profile) => (
                <tr key={profile.profileId}>
                  <Td className="font-mono text-xs">{profile.facility}</Td>
                  <Td className="text-xs uppercase text-gray-500">{profile.sourceType}</Td>
                  <Td align="right" className="tabular-nums">v{profile.version}</Td>
                  <Td className="whitespace-nowrap tabular-nums text-xs">
                    {profile.effectiveFrom ?? 'any'} → {profile.effectiveTo ?? 'present'}
                  </Td>
                  <Td className="max-w-md text-xs text-gray-600">{profile.changeNote ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      <Panel title="Totals">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Files uploaded</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{settings.totals.uploads}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Imports run</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{settings.totals.imports}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}

function Scope({ on, label, detail }: { on: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5">
        {on ? <Badge tone="good">In scope</Badge> : <Badge tone="neutral">Not yet</Badge>}
      </span>
      <span>
        <span className="text-sm font-medium text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500">{detail}</span>
      </span>
    </li>
  );
}

export default IntelligenceSettings;
