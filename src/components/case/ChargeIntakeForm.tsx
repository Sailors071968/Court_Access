// ============================================================================
// Phase D.2.5 — Charge Intake Form
// Searchable California Code dropdown, statute entry, auto-suggest,
// enhancement multi-select, count numbering, offense date, victim field.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CaliforniaCode {
  abbreviation: string;
  fullName: string;
  shortName: string;
  category: string;
  commonInCriminalDefense: boolean;
}

interface StatuteEntry {
  code: string;
  section: string;
  title: string;
  calcrimNumbers: number[];
  severity: string;
  commonEnhancements: string[];
  description: string;
}

interface ChargeFormData {
  code: string;
  section: string;
  title: string;
  dateOfOffense: string;
  victim: string;
  severity: string;
  countNumber: number;
  enhancements: string[];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchCodes(): Promise<CaliforniaCode[]> {
  const res = await fetch(`${API_BASE}/api/codes/california`);
  const data = await res.json();
  return data.codes ?? [];
}

async function fetchStatutes(code: string): Promise<StatuteEntry[]> {
  const res = await fetch(`${API_BASE}/api/codes/statutes/${code}`);
  const data = await res.json();
  return data.statutes ?? [];
}

async function searchStatutesApi(query: string): Promise<StatuteEntry[]> {
  const res = await fetch(`${API_BASE}/api/codes/statutes/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.statutes ?? [];
}

async function submitCharge(caseId: string, formData: ChargeFormData): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/charges/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId,
      code: formData.code,
      section: formData.section,
      title: formData.title || undefined,
      dateOfOffense: formData.dateOfOffense || undefined,
      victim: formData.victim,
      severity: formData.severity || undefined,
      countNumber: formData.countNumber,
      autoLink: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.details || err.error || 'Failed to create charge');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChargeIntakeForm({ onChargeCreated }: { onChargeCreated?: () => void }) {
  const { caseId } = useParams<{ caseId: string }>();

  const [codes, setCodes] = useState<CaliforniaCode[]>([]);
  const [statutes, setStatutes] = useState<StatuteEntry[]>([]);
  const [statuteSuggestions, setStatuteSuggestions] = useState<StatuteEntry[]>([]);
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [codeSearch, setCodeSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const codeDropdownRef = useRef<HTMLDivElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<ChargeFormData>({
    code: 'PC',
    section: '',
    title: '',
    dateOfOffense: '',
    victim: '',
    severity: '',
    countNumber: 1,
    enhancements: [],
  });

  // Load codes on mount
  useEffect(() => {
    fetchCodes().then(setCodes).catch(() => {});
  }, []);

  // Load statutes when code changes
  useEffect(() => {
    if (form.code) {
      fetchStatutes(form.code).then(setStatutes).catch(() => {});
    }
  }, [form.code]);

  // Auto-suggest statutes as user types section
  useEffect(() => {
    if (form.section.length >= 1) {
      const timer = setTimeout(() => {
        const query = `${form.code} ${form.section}`;
        searchStatutesApi(query).then((results) => {
          setStatuteSuggestions(results);
          setShowSuggestions(results.length > 0);
        }).catch(() => {});
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setStatuteSuggestions([]);
      setShowSuggestions(false);
    }
  }, [form.section, form.code]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (codeDropdownRef.current && !codeDropdownRef.current.contains(e.target as Node)) {
        setShowCodeDropdown(false);
      }
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredCodes = codes.filter(
    (c) =>
      c.abbreviation.toLowerCase().includes(codeSearch.toLowerCase()) ||
      c.shortName.toLowerCase().includes(codeSearch.toLowerCase()),
  );

  const selectCode = useCallback((code: CaliforniaCode) => {
    setForm((f) => ({ ...f, code: code.abbreviation, section: '', title: '', severity: '' }));
    setCodeSearch('');
    setShowCodeDropdown(false);
  }, []);

  const selectStatute = useCallback((statute: StatuteEntry) => {
    setForm((f) => ({
      ...f,
      section: statute.section,
      title: statute.title,
      severity: statute.severity,
    }));
    setShowSuggestions(false);
  }, []);

  const toggleEnhancement = useCallback((enhancement: string) => {
    setForm((f) => ({
      ...f,
      enhancements: f.enhancements.includes(enhancement)
        ? f.enhancements.filter((e) => e !== enhancement)
        : [...f.enhancements, enhancement],
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      await submitCharge(caseId, form);
      setSuccess(`Charge ${form.code} ${form.section} created successfully.`);
      setForm((f) => ({
        ...f,
        section: '',
        title: '',
        dateOfOffense: '',
        victim: '',
        severity: '',
        countNumber: f.countNumber + 1,
        enhancements: [],
      }));
      onChargeCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create charge');
    } finally {
      setSubmitting(false);
    }
  };

  // Get available enhancements from selected statute
  const selectedStatute = statutes.find((s) => s.section === form.section);
  const availableEnhancements = selectedStatute?.commonEnhancements ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900">Add Criminal Charge</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Count Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Count #</label>
          <input
            type="number"
            min={1}
            value={form.countNumber}
            onChange={(e) => setForm((f) => ({ ...f, countNumber: parseInt(e.target.value, 10) || 1 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* California Code Dropdown (searchable) */}
        <div className="relative" ref={codeDropdownRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">California Code *</label>
          <button
            type="button"
            onClick={() => setShowCodeDropdown((v) => !v)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-left bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {form.code ? `${form.code} — ${codes.find((c) => c.abbreviation === form.code)?.shortName ?? ''}` : 'Select Code...'}
          </button>
          {showCodeDropdown && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              <div className="sticky top-0 bg-white p-2 border-b">
                <input
                  type="text"
                  value={codeSearch}
                  onChange={(e) => setCodeSearch(e.target.value)}
                  placeholder="Search codes..."
                  className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              {filteredCodes.map((code) => (
                <button
                  key={code.abbreviation}
                  type="button"
                  onClick={() => selectCode(code)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                    code.commonInCriminalDefense ? 'font-medium' : 'text-gray-500'
                  } ${form.code === code.abbreviation ? 'bg-blue-50 text-blue-700' : ''}`}
                >
                  <span className="font-mono">{code.abbreviation}</span>
                  <span className="ml-2">{code.shortName}</span>
                  {code.commonInCriminalDefense && (
                    <span className="ml-2 text-xs text-blue-500">(criminal)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Statute Section with auto-suggest */}
        <div className="relative" ref={suggestionRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Statute Section *</label>
          <input
            type="text"
            value={form.section}
            onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
            placeholder="e.g. 245(a)(4)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
          {showSuggestions && statuteSuggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {statuteSuggestions.map((statute) => (
                <button
                  key={`${statute.code}-${statute.section}`}
                  type="button"
                  onClick={() => selectStatute(statute)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium">{statute.code} {statute.section} — {statute.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{statute.severity} | CALCRIM: {statute.calcrimNumbers.join(', ') || 'unmapped'}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Charge Title (auto-filled from statute) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Charge Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Auto-filled from statute registry"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Severity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
          <select
            value={form.severity}
            onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Auto-detect</option>
            <option value="felony">Felony</option>
            <option value="misdemeanor">Misdemeanor</option>
            <option value="wobbler">Wobbler</option>
            <option value="infraction">Infraction</option>
          </select>
        </div>

        {/* Date of Offense */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Offense</label>
          <input
            type="date"
            value={form.dateOfOffense}
            onChange={(e) => setForm((f) => ({ ...f, dateOfOffense: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Victim */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Victim *</label>
          <input
            type="text"
            value={form.victim}
            onChange={(e) => setForm((f) => ({ ...f, victim: e.target.value }))}
            placeholder="Victim name (or 'State' / 'People')"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>

      {/* Enhancement Multi-Select */}
      {availableEnhancements.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Enhancements</label>
          <div className="flex flex-wrap gap-2">
            {availableEnhancements.map((enh) => (
              <button
                key={enh}
                type="button"
                onClick={() => toggleEnhancement(enh)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  form.enhancements.includes(enh)
                    ? 'bg-red-100 border-red-300 text-red-700'
                    : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {enh}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CALCRIM Preview */}
      {selectedStatute && selectedStatute.calcrimNumbers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 text-sm">
          <span className="font-medium text-blue-800">CALCRIM Auto-Link: </span>
          <span className="text-blue-700">
            {selectedStatute.calcrimNumbers.map((n) => `#${n}`).join(', ')}
          </span>
          <span className="text-blue-600 ml-2">(will link automatically on save)</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !form.code || !form.section || !form.victim}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Creating Charge...' : 'Add Charge'}
      </button>
    </form>
  );
}
