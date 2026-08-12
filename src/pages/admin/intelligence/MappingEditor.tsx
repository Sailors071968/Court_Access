// The parser mapping editor.
//
// What "no code deployment should be required to update a parser profile" means in
// practice: the mapping is data, this screen edits it, and publishing writes a new
// version.
//
// It always publishes a new version and never edits the one in force. That is not
// caution — the version in force is the only accurate description of how the documents
// already imported under it were read, and editing it would make every one of those
// imports misdescribed. The screen says so, because an operator who thinks they are
// correcting a mistake needs to know they are recording a change.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';

import { intelligenceApi, type MappingEditorState } from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th,
} from './shared';

const SOURCE_TYPES = [
  { value: 'csv', label: 'CSV export' },
  { value: 'pdf_text', label: 'PDF roster' },
];

export function MappingEditor() {
  const [facility] = useState('sacramento');
  const [sourceType, setSourceType] = useState('csv');
  const [state, setState] = useState<MappingEditorState | null>(null);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await intelligenceApi.mappings(facility, sourceType);
      setState(result);
      const initial: Record<string, string[]> = {};
      for (const mapping of result.active.mappings) initial[mapping.field] = [...mapping.aliases];
      setDraft(initial);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The mapping could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [facility, sourceType]);

  useEffect(() => {
    void load();
  }, [load]);

  const addAlias = (field: string, alias: string) => {
    const cleaned = alias.trim().toLowerCase();
    if (!cleaned) return;
    setDraft((current) => {
      const existing = current[field] ?? [];
      if (existing.includes(cleaned)) return current;
      return { ...current, [field]: [...existing, cleaned] };
    });
  };

  const removeAlias = (field: string, alias: string) => {
    setDraft((current) => ({
      ...current,
      [field]: (current[field] ?? []).filter((a) => a !== alias),
    }));
  };

  const publish = async () => {
    if (!changeNote.trim()) {
      setError('A change note is required. Years from now it is the only answer to "why does this profile read the bail column from there".');
      return;
    }
    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await intelligenceApi.publishMapping(facility, {
        sourceType,
        mappings: draft,
        changeNote: changeNote.trim(),
        effectiveFrom,
      });
      setNotice(result.message);
      setChangeNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The profile version could not be published.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <Loading label="Loading the mapping" />;
  if (!state) return error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null;

  const changed = state.active.mappings.filter((m) => {
    const before = [...m.aliases].sort().join('|');
    const after = [...(draft[m.field] ?? [])].sort().join('|');
    return before !== after;
  });
  const disabled = state.active.mappings.filter((m) => m.aliases.length > 0 && (draft[m.field] ?? []).length === 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Parser mapping"
        subtitle={`${facility} · ${state.active.isFallback ? 'no published profile — showing the compiled-in map' : `profile v${state.active.version}`}. Publishing writes a new version; the one in force is never edited.`}
        actions={
          <select
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        }
      />

      {error ? <ErrorNotice message={error} /> : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
      ) : null}

      <Panel
        title="Column mappings"
        description="Each canonical field and the header names that mean it. Header matching ignores case and extra spaces. Removing every alias from a field disables it — that is how an obsolete mapping is retired."
      >
        <div className="space-y-3">
          {state.active.mappings.map((mapping) => (
            <FieldRow
              key={mapping.field}
              field={mapping.field}
              label={mapping.label}
              note={mapping.note}
              required={mapping.required}
              aliases={draft[mapping.field] ?? []}
              original={mapping.aliases}
              onAdd={(alias) => addAlias(mapping.field, alias)}
              onRemove={(alias) => removeAlias(mapping.field, alias)}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Publish a new version">
        {changed.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nothing has changed. Edit a mapping above to publish a version.
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <p className="font-medium">{changed.length} field(s) changed:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {changed.map((m) => (
                  <li key={m.field}>
                    <span className="font-medium">{m.label}</span>{' '}
                    {(draft[m.field] ?? []).length === 0
                      ? '— disabled, so this field will not be read from this version on'
                      : `— now ${(draft[m.field] ?? []).join(', ')}`}
                  </li>
                ))}
              </ul>
            </div>

            {disabled.length > 0 ? (
              <p className="mt-3 text-sm text-amber-800">
                {disabled.length} field(s) will no longer be read. Documents already imported keep their values;
                only future imports under this version are affected.
              </p>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Effective from
                </span>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Documents with a roster date from here on are read with the new version. Earlier ones keep the
                  current one.
                </span>
              </label>
              <label className="text-sm">
                <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Why this version exists (required)
                </span>
                <textarea
                  value={changeNote}
                  onChange={(event) => setChangeNote(event.target.value)}
                  rows={3}
                  placeholder="e.g. The county renamed Booking Number to BkgNo in the 12 August export."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  data-testid="change-note"
                />
              </label>
            </div>

            <div className="mt-4">
              <Button
                variant="primary"
                onClick={() => void publish()}
                disabled={publishing || !changeNote.trim()}
                testId="publish-mapping"
              >
                <Save className="h-3.5 w-3.5" />
                {publishing ? 'Publishing…' : `Publish v${(state.active.version ?? 0) + 1}`}
              </Button>
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="Version history"
        description="Every version ever published. None is ever edited or removed — each is the accurate description of how the documents imported under it were read."
      >
        {state.versionHistory.length === 0 ? (
          <EmptyState
            title="No published versions"
            detail="Imports are using the compiled-in map, which records weaker provenance and cannot be reprocessed against a corrected mapping."
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th align="right">Version</Th>
                <Th>Effective</Th>
                <Th align="right">Fields</Th>
                <Th>Why it exists</Th>
              </tr>
            </thead>
            <tbody>
              {state.versionHistory.map((version) => (
                <tr key={version.profileId}>
                  <Td align="right" className="tabular-nums">
                    v{version.version}
                    {version.effectiveTo === null ? <Badge tone="good">in force</Badge> : null}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-xs">
                    {version.effectiveFrom ?? 'any'} → {version.effectiveTo ?? 'present'}
                  </Td>
                  <Td align="right" className="tabular-nums">{version.mappedFields}</Td>
                  <Td className="max-w-lg text-xs text-gray-600">{version.changeNote ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}

function FieldRow({
  field,
  label,
  note,
  required,
  aliases,
  original,
  onAdd,
  onRemove,
}: {
  field: string;
  label: string;
  note: string;
  required: boolean;
  aliases: string[];
  original: string[];
  onAdd: (alias: string) => void;
  onRemove: (alias: string) => void;
}) {
  const [entry, setEntry] = useState('');
  const isChanged = [...aliases].sort().join('|') !== [...original].sort().join('|');

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${isChanged ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200'}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        <span className="font-mono text-xs text-gray-400">{field}</span>
        {required ? <Badge tone="warn">required</Badge> : null}
        {aliases.length === 0 ? <Badge tone="neutral">disabled</Badge> : null}
      </div>
      {note ? <p className="mt-0.5 text-xs text-gray-500">{note}</p> : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {aliases.map((alias) => (
          <span
            key={alias}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs"
          >
            {alias}
            <button
              type="button"
              onClick={() => onRemove(alias)}
              className="text-gray-400 hover:text-red-600"
              aria-label={`Remove ${alias}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <input
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onAdd(entry);
                setEntry('');
              }
            }}
            placeholder="add a header name"
            className="w-40 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
          />
          <button
            type="button"
            onClick={() => { onAdd(entry); setEntry(''); }}
            className="text-gray-400 hover:text-blue-600"
            aria-label={`Add a header for ${label}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    </div>
  );
}

export default MappingEditor;
