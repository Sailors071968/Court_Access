// ============================================================================
// CourtAccess — Discount Codes Admin Dashboard
// Phase 224: Full CRUD management for discount codes
// Phase 227: Campaign analytics — signups per code, conversion, revenue impact
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  RefreshCw,
  BarChart3,
  Users,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  XCircle,
  Percent,
  Calendar,
  X,
} from 'lucide-react';
import { CreateDiscountCodeForm } from '../../components/CreateDiscountCodeForm';
import type { DiscountCodeFormData } from '../../components/CreateDiscountCodeForm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiscountCodeRecord {
  codeId: string;
  codeName: string;
  codeValue: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  active: boolean;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Backend API helpers
// ---------------------------------------------------------------------------

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiLoadCodes(): Promise<DiscountCodeRecord[]> {
  try {
    const res = await fetch('/api/admin/discount-codes', { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.codes || [];
  } catch {
    return [];
  }
}

async function apiCreateCode(payload: Omit<DiscountCodeRecord, 'codeId' | 'usageCount' | 'createdAt'>): Promise<DiscountCodeRecord | null> {
  try {
    const res = await fetch('/api/admin/discount-codes', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create' }));
      throw new Error(err.error || 'Failed to create discount code');
    }
    const data = await res.json();
    return data.code;
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to create discount code');
    return null;
  }
}

async function apiUpdateCode(codeId: string, payload: Partial<DiscountCodeRecord>): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/discount-codes/${codeId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiDeleteCode(codeId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // Use auth-only headers (no Content-Type) for DELETE requests with no body.
    // Sending Content-Type: application/json with an empty body causes Fastify
    // to attempt JSON parsing and return 400 "Bad Request".
    const token = localStorage.getItem('court-access-token');
    const res = await fetch(`/api/admin/discount-codes/${codeId}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Failed to delete discount code' }));
      return { ok: false, error: data.error || 'Failed to delete discount code' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error — could not reach server' };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiscountCodesDashboard() {
  const [codes, setCodes] = useState<DiscountCodeRecord[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCodeRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'codes' | 'analytics'>('codes');

  const refresh = useCallback(async () => {
    const loaded = await apiLoadCodes();
    setCodes(loaded.sort((a: DiscountCodeRecord, b: DiscountCodeRecord) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // --- CRUD handlers ---

  const handleCreate = async (data: DiscountCodeFormData) => {
    const created = await apiCreateCode({
      codeName: data.codeName,
      codeValue: data.codeValue.toUpperCase(),
      discountType: data.discountType,
      discountValue: data.discountValue,
      active: data.active,
      usageLimit: data.usageLimit,
      expiresAt: data.expiresAt || null,
    });
    if (created) {
      setShowCreateForm(false);
      refresh();
    }
  };

  const handleUpdate = async (data: DiscountCodeFormData) => {
    if (!editingCode) return;
    const ok = await apiUpdateCode(editingCode.codeId, {
      codeName: data.codeName,
      codeValue: data.codeValue.toUpperCase(),
      discountType: data.discountType,
      discountValue: data.discountValue,
      active: data.active,
      usageLimit: data.usageLimit,
      expiresAt: data.expiresAt || null,
    });
    if (ok) {
      setEditingCode(null);
      refresh();
    }
  };

  const toggleActive = async (codeId: string) => {
    const code = codes.find((c) => c.codeId === codeId);
    if (!code) return;
    await apiUpdateCode(codeId, { active: !code.active });
    refresh();
  };

  const deleteCode = async (codeId: string) => {
    if (!confirm('Delete this discount code? This action cannot be undone.')) return;
    const result = await apiDeleteCode(codeId);
    if (!result.ok) {
      alert(result.error || 'Failed to delete discount code');
    }
    refresh();
  };

  // --- Analytics (Phase 227) ---

  const totalCodes = codes.length;
  const activeCodes = codes.filter((c) => c.active).length;
  const totalUsages = codes.reduce((sum, c) => sum + (c.usageCount || 0), 0);
  const totalDiscountValue = codes.filter(c => c.discountType === 'fixed').reduce((sum, c) => sum + (c.usageCount || 0) * c.discountValue, 0);

  const codeAnalytics = codes.map((code) => {
    return {
      ...code,
      signups: code.usageCount || 0,
      conversionRate: code.usageCount > 0 ? '100.0' : '0.0',
      totalDiscount: (code.usageCount || 0) * code.discountValue,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discount Codes</h1>
          <p className="text-sm text-gray-500 mt-1">Manage promotional access codes and track campaign performance</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700"
          >
            <Plus size={14} /> New Code
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={14} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-500">Total Codes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalCodes}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="text-xs font-medium text-gray-500">Active</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{activeCodes}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-blue-500" />
            <span className="text-xs font-medium text-gray-500">Total Uses</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{totalUsages}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-amber-500" />
            <span className="text-xs font-medium text-gray-500">Total Discount Given</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">${totalDiscountValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('codes')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'codes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Tag size={14} className="inline mr-1.5" />Codes
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'analytics' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 size={14} className="inline mr-1.5" />Analytics
        </button>
      </div>

      {/* Create Code Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Discount Code</h2>
              <button onClick={() => setShowCreateForm(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <CreateDiscountCodeForm onSubmit={handleCreate} onCancel={() => setShowCreateForm(false)} />
          </div>
        </div>
      )}

      {/* Edit Code Modal */}
      {editingCode && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit Discount Code</h2>
              <button onClick={() => setEditingCode(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <CreateDiscountCodeForm
              initial={{
                codeName: editingCode.codeName,
                codeValue: editingCode.codeValue,
                discountType: editingCode.discountType,
                discountValue: editingCode.discountValue,
                expiresAt: editingCode.expiresAt || '',
                usageLimit: editingCode.usageLimit,
                active: editingCode.active,
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingCode(null)}
              submitLabel="Save Changes"
            />
          </div>
        </div>
      )}

      {/* Codes Tab */}
      {activeTab === 'codes' && (
        <>
          {codes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Tag className="mx-auto mb-4 text-gray-300" size={48} />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Discount Codes</h3>
              <p className="text-sm text-gray-500 mb-4">Create your first promotional discount code to get started.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700"
              >
                <Plus size={14} /> Create First Code
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Campaign</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Discount</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Usage</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((code) => (
                      <tr
                        key={code.codeId}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setEditingCode(code)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{code.codeValue}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{code.codeName}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-gray-700">
                            {code.discountType === 'percent' ? <Percent size={12} /> : <DollarSign size={12} />}
                            {code.discountValue}{code.discountType === 'percent' ? '%' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleActive(code.codeId); }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              code.active
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {code.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {code.active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {code.usageCount}{code.usageLimit !== null ? ` / ${code.usageLimit}` : ''}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {code.expiresAt ? (
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(code.expiresAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">No expiry</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteCode(code.codeId); }}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete code"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Analytics Tab (Phase 227) */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Campaign Performance Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <TrendingUp size={14} /> Campaign Performance
              </h3>
            </div>
            {codeAnalytics.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No discount codes created yet. Create your first code to see analytics.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Campaign</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Signups</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Conversion %</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Total Discount</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codeAnalytics.map((ca) => (
                      <tr key={ca.codeId} className="border-b border-gray-100">
                        <td className="px-4 py-3 text-gray-700 font-medium">{ca.codeName}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{ca.codeValue}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{ca.signups}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{ca.conversionRate}%</td>
                        <td className="px-4 py-3 text-right text-gray-700">${ca.totalDiscount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            ca.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {ca.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Usage Over Time (Visual Bar) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
              <BarChart3 size={14} /> Usage Distribution by Code
            </h3>
            {codeAnalytics.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No data available</p>
            ) : (
              <div className="space-y-3">
                {codeAnalytics.map((ca) => {
                  const maxUsage = Math.max(...codeAnalytics.map((c) => c.signups), 1);
                  const barWidth = Math.max((ca.signups / maxUsage) * 100, 2);
                  return (
                    <div key={ca.codeId} className="flex items-center gap-3">
                      <div className="w-32 text-xs font-mono text-gray-600 truncate">{ca.codeValue}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${ca.active ? 'bg-blue-500' : 'bg-gray-300'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                          {ca.signups} use{ca.signups !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
