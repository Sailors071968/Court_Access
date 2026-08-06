// ============================================================================
// Complaint workspace.
//
// Everything an attorney needs to put a charging document on the record from
// the browser: start a filing or copy the last one, add counts with the code
// selector and the allegations the People plead, paste a complaint and have
// its counts read out for review, check it, then file it.
//
// A draft changes nothing until it is filed. That is the whole point of having
// one: a pleading can be built over several sittings without the case analysis
// moving underneath the person building it.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardPaste, Copy, FilePlus2, Loader2,
  Plus, Send, Trash2, X,
} from 'lucide-react';
import { authorizedFetch, describeFailure } from '../../services/session';

interface CodeOption {
  abbreviation: string;
  name: string;
}

interface DraftCount {
  countNumber: number;
  code: string;
  section: string;
  subdivision: string;
  verbatimText: string;
  defendants: string;
  enhancements: string;
  attempt: boolean;
  strikeAllegation: boolean;
  seriousFelony: boolean;
  violentFelony: boolean;
  gangAllegation: boolean;
  firearmAllegation: boolean;
  greatBodilyInjury: boolean;
  specialCircumstance: boolean;
  threeStrikes: boolean;
  sexRegistration: boolean;
  drugWeight: string;
  restitution: string;
  maximumExposure: string;
  priorConvictions: string;
}

const ALLEGATION_FIELDS: Array<[keyof DraftCount, string]> = [
  ['attempt', 'Attempt'],
  ['strikeAllegation', 'Strike'],
  ['seriousFelony', 'Serious felony'],
  ['violentFelony', 'Violent felony'],
  ['threeStrikes', 'Three strikes'],
  ['gangAllegation', 'Gang'],
  ['firearmAllegation', 'Firearm'],
  ['greatBodilyInjury', 'Great bodily injury'],
  ['specialCircumstance', 'Special circumstance'],
  ['sexRegistration', 'Sex registration'],
];

const DOCUMENT_KINDS: Array<[string, string]> = [
  ['complaint', 'Complaint'],
  ['amended_complaint', 'Amended Complaint'],
  ['information', 'Information'],
  ['amended_information', 'Amended Information'],
  ['dismissal', 'Oral amendment or dismissal'],
];

function emptyCount(n: number): DraftCount {
  return {
    countNumber: n,
    code: 'PEN',
    section: '',
    subdivision: '',
    verbatimText: '',
    defendants: '',
    enhancements: '',
    attempt: false,
    strikeAllegation: false,
    seriousFelony: false,
    violentFelony: false,
    gangAllegation: false,
    firearmAllegation: false,
    greatBodilyInjury: false,
    specialCircumstance: false,
    threeStrikes: false,
    sexRegistration: false,
    drugWeight: '',
    restitution: '',
    maximumExposure: '',
    priorConvictions: '',
  };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authorizedFetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(await describeFailure(res, body));
  return JSON.parse(body) as T;
}

interface Props {
  caseId: string;
  priorFilings: Array<{ chargingDocumentId: string; name: string }>;
  onFiled: () => void;
  onClose: () => void;
}

export function ComplaintWorkspace({ caseId, priorFilings, onFiled, onClose }: Props) {
  const [codes, setCodes] = useState<CodeOption[]>([]);
  const [kind, setKind] = useState('complaint');
  const [name, setName] = useState('Complaint');
  const [filedAt, setFiledAt] = useState(new Date().toISOString().slice(0, 10));
  const [court, setCourt] = useState('');
  const [courtCaseNumber, setCourtCaseNumber] = useState('');
  const [counts, setCounts] = useState<DraftCount[]>([emptyCount(1)]);
  const [duplicateOf, setDuplicateOf] = useState('');

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parseNotes, setParseNotes] = useState<string[]>([]);
  const [parseConfidence, setParseConfidence] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    void call<{ codes: CodeOption[] }>('/api/charging/codes')
      .then((r) => setCodes(r.codes))
      .catch(() => {});
  }, []);

  const update = useCallback((i: number, patch: Partial<DraftCount>) => {
    setCounts((prev) => prev.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  }, []);

  // ---------------------------------------------------------------- parsing
  const parse = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await call<{
        charges: Array<{
          countNumber: number | null; code: string | null; section: string | null; subdivision: string | null;
          verbatimText: string; defendants: string[]; enhancements: string[]; attempt: boolean;
        }>;
        overallConfidence: number;
        notes: string[];
        courtCaseNumber: string | null;
        court: string | null;
      }>(`/api/cases/${caseId}/charges/parse`, { method: 'POST', body: JSON.stringify({ text: pasteText }) });

      setParseNotes(r.notes);
      setParseConfidence(r.overallConfidence);
      if (r.courtCaseNumber) setCourtCaseNumber(r.courtCaseNumber);
      if (r.court) setCourt(r.court);

      if (r.charges.length > 0) {
        setCounts(
          r.charges.map((c, i) => ({
            ...emptyCount(c.countNumber ?? i + 1),
            code: c.code ?? 'PEN',
            section: c.section ?? '',
            subdivision: c.subdivision ?? '',
            verbatimText: c.verbatimText,
            defendants: c.defendants.join(', '),
            enhancements: c.enhancements.join('; '),
            attempt: c.attempt,
          })),
        );
      }
      setPasteOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The document could not be read.');
    } finally {
      setBusy(false);
    }
  };

  // ----------------------------------------------------------------- filing
  const file = async () => {
    setBusy(true);
    setError(null);
    try {
      const draft = await call<{ document: { chargingDocumentId: string } }>(
        `/api/cases/${caseId}/charges/drafts`,
        {
          method: 'POST',
          body: JSON.stringify({
            kind,
            name,
            filedAt: new Date(filedAt).toISOString(),
            court: court || undefined,
            courtCaseNumber: courtCaseNumber || undefined,
            ...(duplicateOf ? { duplicateOf } : {}),
          }),
        },
      );
      const id = draft.document.chargingDocumentId;

      if (!duplicateOf) {
        for (const c of counts) {
          if (!c.section.trim() || !c.verbatimText.trim()) continue;
          await call(`/api/charging/documents/${id}/counts`, {
            method: 'POST',
            body: JSON.stringify({
              countNumber: c.countNumber,
              code: c.code,
              section: c.section.trim(),
              subdivision: c.subdivision.trim() || null,
              verbatimText: c.verbatimText.trim(),
              enhancements: c.enhancements ? c.enhancements.split(';').map((e) => e.trim()).filter(Boolean) : [],
              priorConvictions: c.priorConvictions ? c.priorConvictions.split(';').map((e) => e.trim()).filter(Boolean) : [],
              attempt: c.attempt,
              strikeAllegation: c.strikeAllegation,
              seriousFelony: c.seriousFelony,
              violentFelony: c.violentFelony,
              gangAllegation: c.gangAllegation,
              firearmAllegation: c.firearmAllegation,
              greatBodilyInjury: c.greatBodilyInjury,
              specialCircumstance: c.specialCircumstance,
              threeStrikes: c.threeStrikes,
              sexRegistration: c.sexRegistration,
              drugWeight: c.drugWeight.trim() || null,
              restitution: c.restitution.trim() || null,
              maximumExposure: c.maximumExposure.trim() || null,
              defendants: c.defendants
                .split(',')
                .map((d) => d.trim())
                .filter(Boolean)
                .map((d) => ({ name: d })),
            }),
          });
        }
      }

      await call(`/api/charging/documents/${id}/finalize`, { method: 'POST', body: '{}' });
      onFiled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The document could not be filed.');
    } finally {
      setBusy(false);
    }
  };

  const usable = counts.filter((c) => c.section.trim() && c.verbatimText.trim());

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-300 p-5 space-y-5" data-testid="complaint-workspace">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <FilePlus2 size={17} className="text-indigo-600" /> New charging document
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Nothing changes on the case until you file this.
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800" data-testid="workspace-error">
          {error}
        </div>
      )}

      {/* Document ---------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Document</span>
          <select
            data-testid="doc-kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setName(DOCUMENT_KINDS.find(([k]) => k === e.target.value)?.[1] ?? '');
            }}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {DOCUMENT_KINDS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Title</span>
          <input
            data-testid="doc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Filed</span>
          <input
            data-testid="doc-filed"
            type="date"
            value={filedAt}
            onChange={(e) => setFiledAt(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Court case number</span>
          <input
            data-testid="doc-number"
            value={courtCaseNumber}
            onChange={(e) => setCourtCaseNumber(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </div>

      {/* Shortcuts ----------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          data-testid="paste-complaint"
          onClick={() => setPasteOpen((v) => !v)}
          className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
        >
          <ClipboardPaste size={14} /> Read counts from a document
        </button>
        {priorFilings.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <Copy size={14} className="text-gray-500" />
            <select
              data-testid="duplicate-of"
              value={duplicateOf}
              onChange={(e) => setDuplicateOf(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">Start from scratch</option>
              {priorFilings.map((f) => (
                <option key={f.chargingDocumentId} value={f.chargingDocumentId}>
                  Copy counts from {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {pasteOpen && (
        <div className="border border-gray-200 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-600">
            Paste the text of the charging document. The counts read out are a proposal for you to check, never a
            filing.
          </p>
          <textarea
            data-testid="paste-text"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono"
            placeholder="COUNT 1&#10;On or about ... in violation of PENAL CODE SECTION 211 ..."
          />
          <button
            data-testid="do-parse"
            onClick={() => void parse()}
            disabled={busy || pasteText.trim().length === 0}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg disabled:opacity-40"
          >
            {busy ? 'Reading…' : 'Read counts'}
          </button>
        </div>
      )}

      {parseConfidence !== null && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3" data-testid="parse-result">
          <p className="text-xs font-medium text-amber-900 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Read from the document with {(parseConfidence * 100).toFixed(0)}% overall
            confidence — check every count before filing
          </p>
          {parseNotes.length > 0 && (
            <ul className="text-xs text-amber-800 mt-1.5 space-y-0.5">
              {parseNotes.slice(0, 6).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Counts -------------------------------------------------------------- */}
      {!duplicateOf && (
        <div className="space-y-4" data-testid="count-editor">
          {counts.map((c, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">Count {c.countNumber}</p>
                {counts.length > 1 && (
                  <button
                    onClick={() => setCounts((prev) => prev.filter((_, k) => k !== i))}
                    className="text-gray-400 hover:text-red-600"
                    aria-label="Remove this count from the draft"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-600">Count number</span>
                  <input
                    type="number"
                    value={c.countNumber}
                    onChange={(e) => update(i, { countNumber: parseInt(e.target.value, 10) || 1 })}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs text-gray-600">California code</span>
                  <select
                    data-testid={`count-code-${i}`}
                    value={c.code}
                    onChange={(e) => update(i, { code: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    {codes.map((o) => (
                      <option key={o.abbreviation} value={o.abbreviation}>
                        {o.name} ({o.abbreviation})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-gray-600">Section</span>
                    <input
                      data-testid={`count-section-${i}`}
                      value={c.section}
                      onChange={(e) => update(i, { section: e.target.value })}
                      placeholder="245"
                      className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-600">Subdivision</span>
                    <input
                      value={c.subdivision}
                      onChange={(e) => update(i, { subdivision: e.target.value })}
                      placeholder="(a)(4)"
                      className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
              </div>

              <label className="block">
                <span className="text-xs text-gray-600">
                  Wording exactly as it appears in the document — stored verbatim, never paraphrased
                </span>
                <textarea
                  data-testid={`count-text-${i}`}
                  value={c.verbatimText}
                  onChange={(e) => update(i, { verbatimText: e.target.value })}
                  rows={3}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-600">Defendants, comma separated</span>
                  <input
                    data-testid={`count-defendants-${i}`}
                    value={c.defendants}
                    onChange={(e) => update(i, { defendants: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-600">Enhancements, separated by semicolons</span>
                  <input
                    value={c.enhancements}
                    onChange={(e) => update(i, { enhancements: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </label>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1.5">Allegations pleaded with this count</p>
                <div className="flex flex-wrap gap-2">
                  {ALLEGATION_FIELDS.map(([field, label]) => (
                    <label key={field} className="flex items-center gap-1.5 text-xs border border-gray-200 rounded px-2 py-1">
                      <input
                        type="checkbox"
                        data-testid={`allegation-${field}-${i}`}
                        checked={Boolean(c[field])}
                        onChange={(e) => update(i, { [field]: e.target.checked } as Partial<DraftCount>)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-600">Weight alleged</span>
                  <input
                    value={c.drugWeight}
                    onChange={(e) => update(i, { drugWeight: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-600">Prior convictions, semicolon separated</span>
                  <input
                    value={c.priorConvictions}
                    onChange={(e) => update(i, { priorConvictions: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-600">Maximum exposure, as the People plead it</span>
                  <input
                    value={c.maximumExposure}
                    onChange={(e) => update(i, { maximumExposure: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
            </div>
          ))}

          <button
            data-testid="add-count"
            onClick={() => setCounts((prev) => [...prev, emptyCount(prev.length + 1)])}
            className="px-3 py-1.5 border border-dashed border-gray-300 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Plus size={14} /> Add another count
          </button>
        </div>
      )}

      {duplicateOf && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
          The counts from the selected filing will be carried forward with their allegations. You can correct any of
          them once this document is filed.
        </p>
      )}

      {/* Preview and file ------------------------------------------------------ */}
      {preview && !duplicateOf && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50" data-testid="filing-preview">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {name}, to be filed {new Date(filedAt).toLocaleDateString()}
          </p>
          {usable.length === 0 ? (
            <p className="text-sm text-red-700">No count is complete. Each needs a section and its wording.</p>
          ) : (
            <ul className="space-y-2">
              {usable.map((c, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium">
                    Count {c.countNumber} — {codes.find((o) => o.abbreviation === c.code)?.name ?? c.code} section{' '}
                    {c.section}
                    {c.subdivision}
                  </span>
                  <p className="text-gray-600 mt-0.5 italic">{c.verbatimText}</p>
                  {c.defendants && <p className="text-gray-500">Defendants: {c.defendants}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        {!duplicateOf && (
          <button
            data-testid="preview-filing"
            onClick={() => setPreview((v) => !v)}
            className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
          >
            {preview ? 'Hide preview' : 'Preview'}
          </button>
        )}
        <button
          data-testid="file-document"
          onClick={() => void file()}
          disabled={busy || (!duplicateOf && usable.length === 0)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-2"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} File this document
        </button>
        {!duplicateOf && usable.length > 0 && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-600" /> {usable.length} count(s) ready
          </span>
        )}
      </div>
    </div>
  );
}

export default ComplaintWorkspace;
