// ============================================
// Court Access — Charges Tab
// Wired to canonical /api/charges backend
// ============================================

import { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import { fetchCharges, createCharge, deleteCharge, type ApiCharge } from '../../services/caseApi';

export function ChargesPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeChargeIndex, setActiveChargeIndex] = useState(0);
  const [charges, setCharges] = useState<ApiCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    section: '',
    title: '',
    victim: '',
    dateOfOffense: '',
  });

  const loadCharges = async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCharges(caseId);
      setCharges(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load charges');
      setCharges([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCharges();
  }, [caseId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId) return;
    try {
      setSaving(true);
      setError(null);
      await createCharge({
        caseId,
        code: form.code,
        section: form.section,
        title: form.title || undefined,
        victim: form.victim,
        dateOfOffense: form.dateOfOffense || undefined,
      });
      setForm({ code: '', section: '', title: '', victim: '', dateOfOffense: '' });
      setShowForm(false);
      await loadCharges();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create charge');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (chargeId: string) => {
    try {
      await deleteCharge(chargeId);
      await loadCharges();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete charge');
    }
  };

  const activeCharge = charges[activeChargeIndex];

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">Loading charges...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Charges</h2>
          <p className="text-sm text-gray-500 mt-1">{charges.length} charge(s) on this case</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700"
        >
          <Plus size={16} />
          Add Charge
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4">
            <input required placeholder="Code (e.g. PC 245)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input required placeholder="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input required placeholder="Victim" value={form.victim} onChange={(e) => setForm({ ...form, victim: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input type="date" value={form.dateOfOffense} onChange={(e) => setForm({ ...form, dateOfOffense: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Charge'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {charges.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">No charges on this case yet. Add at least one charge before uploading evidence via presigned URL.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {charges.map((charge, idx) => (
              <button
                key={charge.id}
                onClick={() => setActiveChargeIndex(idx)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeChargeIndex === idx ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {charge.code} {charge.title ?? charge.section}
              </button>
            ))}
          </div>

          {activeCharge && (
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{activeCharge.code} — {activeCharge.title ?? activeCharge.section}</h3>
                  <p className="text-sm text-gray-500 mt-1">Section: {activeCharge.section}</p>
                  <p className="text-sm text-gray-500">Victim: {activeCharge.victim}</p>
                  {activeCharge.dateOfOffense && (
                    <p className="text-sm text-gray-500">Date of offense: {new Date(activeCharge.dateOfOffense).toLocaleDateString()}</p>
                  )}
                  <p className="text-xs text-amber-700 mt-3">
                    Element-level CALCRIM analysis requires evidence processing — UNKNOWN until intelligence pipeline completes.
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(activeCharge.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  aria-label="Delete charge"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
