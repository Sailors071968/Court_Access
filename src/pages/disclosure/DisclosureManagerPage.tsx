// ============================================================================
// Sprint 1 — Disclosure Manager UI
// Publication profiles, preview, version comparison, publication history.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Send, Eye, GitCompare, History } from 'lucide-react';
import {
  fetchDisclosurePackages,
  createDisclosurePackage,
  type DisclosurePackage,
  PUBLICATION_PROFILES,
} from '../../services/membershipApi';

const RECIPIENT_TYPES = [
  'attorney', 'client', 'family', 'expert', 'secretary', 'investigator', 'public',
] as const;

export function DisclosureManagerPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [packages, setPackages] = useState<DisclosurePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [documentId, setDocumentId] = useState('');
  const [recipientType, setRecipientType] = useState<string>('client');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [selectedPkg, setSelectedPkg] = useState<DisclosurePackage | null>(null);
  const [comparePkg, setComparePkg] = useState<DisclosurePackage | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const data = await fetchDisclosurePackages(caseId);
      setPackages(data.packages);
    } catch {
      setMessage('Unable to load disclosure packages');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!caseId || !documentId.trim()) return;
    setCreating(true);
    setMessage('');
    try {
      await createDisclosurePackage(caseId, {
        documentId: documentId.trim(),
        recipientType,
        recipientEmail: recipientEmail || undefined,
      });
      setDocumentId('');
      setRecipientEmail('');
      setMessage('Disclosure package created');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  if (!caseId) {
    return <div className="p-8 text-red-600">Invalid case</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      <div>
        <Link to={`/cases/${caseId}/documents`} className="text-sm text-amber-600 hover:text-amber-300">
          ← Back to documents
        </Link>
        <h1 className="text-2xl font-bold text-white mt-1">Disclosure Manager</h1>
        <p className="text-sm text-slate-400">Controlled publication to authorized recipients only</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-xl border border-white/10 p-5 space-y-4">
          <h2 className="font-semibold text-white">New Disclosure Package</h2>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Document ID</label>
            <input
              type="text"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm"
              placeholder="Evidence or document ID"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Publication Profile</label>
            <select
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value)}
              className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm"
            >
              {RECIPIENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Recipient email (optional)</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Create Package
          </button>
          {message && <p className="text-sm text-slate-300">{message}</p>}
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <h2 className="font-semibold text-white flex items-center gap-2 mb-3">
            <History size={18} /> Publication History
          </h2>
          {loading ? (
            <Loader2 className="animate-spin text-slate-400" size={24} />
          ) : packages.length === 0 ? (
            <p className="text-sm text-slate-400">No disclosure packages yet</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {packages.map((pkg) => (
                <li
                  key={pkg.packageId}
                  className={`text-sm p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPkg?.packageId === pkg.packageId
                      ? 'border-amber-400 bg-amber-500/10'
                      : 'border-white/10 hover:bg-white/5'
                  }`}
                  onClick={() => setSelectedPkg(pkg)}
                >
                  <div className="font-medium">{pkg.recipientType}</div>
                  <div className="text-slate-400 text-xs">Doc {pkg.documentId.slice(0, 8)}… · {pkg.status}</div>
                  {pkg.publishedAt && (
                    <div className="text-xs text-slate-400">
                      Published {new Date(pkg.publishedAt).toLocaleString()}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(selectedPkg || comparePkg) && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-5 grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-2">
              <Eye size={18} /> Preview
            </h3>
            {selectedPkg ? (
              <div className="text-sm space-y-1">
                <p><strong>Profile:</strong> {selectedPkg.recipientType}</p>
                <p><strong>Document:</strong> {selectedPkg.documentId}</p>
                <p><strong>Status:</strong> {selectedPkg.status}</p>
                <p className="text-slate-400 mt-2">
                  Recipient sees redacted copy per {selectedPkg.recipientType} publication profile.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Select a package to preview</p>
            )}
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-2">
              <GitCompare size={18} /> Version Comparison
            </h3>
            <select
              value={comparePkg?.packageId ?? ''}
              onChange={(e) => {
                const pkg = packages.find((p) => p.packageId === e.target.value) ?? null;
                setComparePkg(pkg);
              }}
              className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm mb-2"
            >
              <option value="">Compare with…</option>
              {packages.map((p) => (
                <option key={p.packageId} value={p.packageId}>
                  {p.recipientType} — {p.status}
                </option>
              ))}
            </select>
            {selectedPkg && comparePkg && (
              <div className="text-sm text-slate-300">
                <p>{selectedPkg.recipientType} ({selectedPkg.status}) vs {comparePkg.recipientType} ({comparePkg.status})</p>
                <p className="mt-1 text-xs">Redaction profile: {PUBLICATION_PROFILES.includes(selectedPkg.recipientType as typeof PUBLICATION_PROFILES[number]) ? 'matched' : 'custom'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
