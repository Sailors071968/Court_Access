// ============================================
// Court Access — Phases 82-83: Evidence Cross-Reference Engine
// Deterministic reference extraction and document comparison
// No scoring, no ranking, no probabilistic models
// ============================================

import { useState } from 'react';
import {
  Link2, FileText, Search,
  Info, Filter, RefreshCw,
} from 'lucide-react';

const REFERENCE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  reference_match: { label: 'Reference Match', color: 'text-green-700 bg-green-50 border-green-200' },
  reference_conflict: { label: 'Reference Conflict', color: 'text-red-700 bg-red-50 border-red-200' },
  missing_reference: { label: 'Missing Reference', color: 'text-amber-700 bg-amber-50 border-amber-200' },
};

const ENTITY_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  incident_number: { label: 'Incident Number', color: 'text-blue-700 bg-blue-50' },
  officer_name: { label: 'Officer Name', color: 'text-purple-700 bg-purple-50' },
  badge_number: { label: 'Badge Number', color: 'text-indigo-700 bg-indigo-50' },
  date: { label: 'Date', color: 'text-gray-700 bg-gray-50' },
  case_number: { label: 'Case Number', color: 'text-emerald-700 bg-emerald-50' },
};

interface CrossReference {
  id: string;
  sourceDocumentId: string;
  relatedDocumentId: string;
  referenceType: string;
  description: string;
  sourceSnippet: string;
  relatedSnippet: string;
  status: string;
}

interface Reference {
  id: string;
  sourceDocumentId: string;
  referenceType: string;
  referenceValue: string;
  sourceContext: string;
}

const AI_DISCLAIMER = 'This system performs deterministic reference extraction and comparison only. It identifies reference matches, conflicts, and missing references across documents. It does not rank, score, assign probabilities, infer intent, or generate accusations.';

export function CrossReferencePage() {
  const [crossRefs] = useState<CrossReference[]>([
    {
      id: '1', sourceDocumentId: 'doc-001', relatedDocumentId: 'doc-002',
      referenceType: 'reference_match', description: 'incident_number "2024-CF-001234" found in both documents',
      sourceSnippet: '...incident report #2024-CF-001234 was filed on...', relatedSnippet: '...pursuant to case 2024-CF-001234, the officer...',
      status: 'active',
    },
    {
      id: '2', sourceDocumentId: 'doc-001', relatedDocumentId: 'doc-003',
      referenceType: 'missing_reference', description: 'officer_name "Officer Martinez" found in source but not in related document',
      sourceSnippet: '...Officer Martinez responded to the scene at...', relatedSnippet: '',
      status: 'active',
    },
  ]);
  const [references] = useState<Reference[]>([
    { id: '1', sourceDocumentId: 'doc-001', referenceType: 'incident_number', referenceValue: '2024-CF-001234', sourceContext: '...incident report #2024-CF-001234 was filed...' },
    { id: '2', sourceDocumentId: 'doc-001', referenceType: 'officer_name', referenceValue: 'Officer Martinez', sourceContext: '...Officer Martinez responded to the scene...' },
    { id: '3', sourceDocumentId: 'doc-002', referenceType: 'incident_number', referenceValue: '2024-CF-001234', sourceContext: '...case 2024-CF-001234, the officer conducted...' },
    { id: '4', sourceDocumentId: 'doc-002', referenceType: 'date', referenceValue: '01/15/2024', sourceContext: '...on 01/15/2024 at approximately 2300 hours...' },
  ]);
  const [activeTab, setActiveTab] = useState<'crossrefs' | 'references'>('crossrefs');
  const [filterType, setFilterType] = useState('');

  const filteredCrossRefs = filterType ? crossRefs.filter(r => r.referenceType === filterType) : crossRefs;

  const summary = {
    matches: crossRefs.filter(r => r.referenceType === 'reference_match').length,
    conflicts: crossRefs.filter(r => r.referenceType === 'reference_conflict').length,
    missing: crossRefs.filter(r => r.referenceType === 'missing_reference').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-600" />
            Document Cross-References
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Deterministic reference extraction and document comparison
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-1">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1">
            <Search className="w-4 h-4" />
            Run Comparison
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">{AI_DISCLAIMER}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{summary.matches}</div>
          <div className="text-xs text-green-600">Reference Matches</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-700">{summary.conflicts}</div>
          <div className="text-xs text-red-600">Reference Conflicts</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-700">{summary.missing}</div>
          <div className="text-xs text-amber-600">Missing References</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('crossrefs')}
          className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'crossrefs' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Cross-References ({crossRefs.length})
        </button>
        <button
          onClick={() => setActiveTab('references')}
          className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'references' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Extracted References ({references.length})
        </button>
      </div>

      {activeTab === 'crossrefs' && (
        <>
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1"
            >
              <option value="">All Types</option>
              {Object.entries(REFERENCE_TYPE_CONFIG).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {filteredCrossRefs.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <Link2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No cross-references found.</p>
                <p className="text-sm text-gray-400 mt-1">Extract references from documents and run comparison.</p>
              </div>
            ) : (
              filteredCrossRefs.map((xref) => {
                const typeConfig = REFERENCE_TYPE_CONFIG[xref.referenceType] || REFERENCE_TYPE_CONFIG.reference_match;
                return (
                  <div key={xref.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded border ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                        <span className="text-xs text-gray-400">{xref.status}</span>
                      </div>
                      <div className="flex gap-1">
                        <button className="px-2 py-0.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100">
                          Confirm
                        </button>
                        <button className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded hover:bg-gray-100">
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 mb-2">{xref.description}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded p-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                          <FileText className="w-3 h-3" />
                          Source: {xref.sourceDocumentId}
                        </div>
                        {xref.sourceSnippet && (
                          <p className="text-xs text-gray-600 italic">"{xref.sourceSnippet}"</p>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                          <FileText className="w-3 h-3" />
                          Related: {xref.relatedDocumentId}
                        </div>
                        {xref.relatedSnippet ? (
                          <p className="text-xs text-gray-600 italic">"{xref.relatedSnippet}"</p>
                        ) : (
                          <p className="text-xs text-gray-400 italic">No matching reference found</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {activeTab === 'references' && (
        <div className="space-y-3">
          {references.map((ref) => {
            const typeConfig = ENTITY_TYPE_CONFIG[ref.referenceType] || { label: ref.referenceType, color: 'text-gray-700 bg-gray-50' };
            return (
              <div key={ref.id} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${typeConfig.color}`}>
                    {typeConfig.label}
                  </span>
                  <span className="font-mono text-sm font-semibold text-gray-900">{ref.referenceValue}</span>
                  <span className="text-xs text-gray-400">from {ref.sourceDocumentId}</span>
                </div>
                <p className="text-xs text-gray-500 italic">"{ref.sourceContext}"</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
