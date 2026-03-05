// ============================================
// Court Access — Court Hearings Page
// Allows clients to manage up to 5 hearings per case
// with configurable SMS reminder toggles.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, MapPin, Clock, Bell, Plus, Trash2, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from '../../components/common/Card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Hearing {
  id: string;
  caseId: string;
  courthouseName: string;
  courthouseAddress: string;
  hearingName: string;
  hearingDatetime: string;
  department: string;
  reminder1Enabled: boolean;
  reminder2Enabled: boolean;
  reminder3Enabled: boolean;
  reminder1DaysBefore: number;
  reminder2DaysBefore: number;
  reminder3DaysBefore: number;
  createdAt: string;
  updatedAt: string;
}

interface HearingFormData {
  courthouseName: string;
  courthouseAddress: string;
  hearingName: string;
  hearingDate: string;
  hearingTime: string;
  department: string;
  reminder1Enabled: boolean;
  reminder2Enabled: boolean;
  reminder3Enabled: boolean;
  reminder1DaysBefore: number;
  reminder2DaysBefore: number;
  reminder3DaysBefore: number;
}

const EMPTY_FORM: HearingFormData = {
  courthouseName: '',
  courthouseAddress: '',
  hearingName: '',
  hearingDate: '',
  hearingTime: '',
  department: '',
  reminder1Enabled: true,
  reminder2Enabled: true,
  reminder3Enabled: true,
  reminder1DaysBefore: 7,
  reminder2DaysBefore: 3,
  reminder3DaysBefore: 1,
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MAX_HEARINGS = 5;

// ---------------------------------------------------------------------------
// Helper: combine date + time into ISO datetime
// ---------------------------------------------------------------------------

function combineDatetime(date: string, time: string): string {
  if (!date || !time) return '';
  return new Date(`${date}T${time}`).toISOString();
}

function splitDatetime(iso: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const dt = new Date(iso);
  const date = dt.toISOString().split('T')[0];
  const hours = dt.getHours().toString().padStart(2, '0');
  const minutes = dt.getMinutes().toString().padStart(2, '0');
  return { date, time: `${hours}:${minutes}` };
}

function formatHearingDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatHearingTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function daysUntil(iso: string): number {
  const now = new Date();
  const target = new Date(iso);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Toggle Switch Component
// ---------------------------------------------------------------------------

function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Reminder Config Panel
// ---------------------------------------------------------------------------

function ReminderConfig({
  reminderNumber,
  enabled,
  daysBefore,
  onToggle,
  onDaysChange,
}: {
  reminderNumber: number;
  enabled: boolean;
  daysBefore: number;
  onToggle: (v: boolean) => void;
  onDaysChange: (v: number) => void;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      enabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center gap-3">
        <Bell size={16} className={enabled ? 'text-blue-600' : 'text-gray-400'} />
        <span className={`text-sm font-medium ${enabled ? 'text-blue-900' : 'text-gray-500'}`}>
          Reminder {reminderNumber}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {enabled && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={30}
              value={daysBefore}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 1 && val <= 30) onDaysChange(val);
              }}
              className="w-16 px-2 py-1 text-sm border border-blue-300 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`Days before hearing for reminder ${reminderNumber}`}
            />
            <span className="text-xs text-blue-700">days before</span>
          </div>
        )}
        <Toggle enabled={enabled} onChange={onToggle} label={`Toggle reminder ${reminderNumber}`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hearing Form (Add / Edit)
// ---------------------------------------------------------------------------

function HearingForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  isEditing,
  isSaving,
}: {
  form: HearingFormData;
  onChange: (f: HearingFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
  isSaving: boolean;
}) {
  const updateField = (field: keyof HearingFormData, value: string | boolean | number) => {
    onChange({ ...form, [field]: value });
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        {isEditing ? 'Edit Hearing' : 'Add New Hearing'}
      </h3>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hearing Name *</label>
          <input
            type="text"
            value={form.hearingName}
            onChange={(e) => updateField('hearingName', e.target.value)}
            placeholder="e.g. Preliminary Hearing"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <input
            type="text"
            value={form.department}
            onChange={(e) => updateField('department', e.target.value)}
            placeholder="e.g. 23"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Courthouse Name *</label>
          <input
            type="text"
            value={form.courthouseName}
            onChange={(e) => updateField('courthouseName', e.target.value)}
            placeholder="e.g. Sacramento Superior Court"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Courthouse Address *</label>
          <input
            type="text"
            value={form.courthouseAddress}
            onChange={(e) => updateField('courthouseAddress', e.target.value)}
            placeholder="e.g. 720 9th St, Sacramento CA"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hearing Date *</label>
          <input
            type="date"
            value={form.hearingDate}
            onChange={(e) => updateField('hearingDate', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hearing Time *</label>
          <input
            type="time"
            value={form.hearingTime}
            onChange={(e) => updateField('hearingTime', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Reminder Configuration */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Bell size={14} />
          SMS Reminder Settings
        </h4>
        <div className="space-y-2">
          <ReminderConfig
            reminderNumber={1}
            enabled={form.reminder1Enabled}
            daysBefore={form.reminder1DaysBefore}
            onToggle={(v) => updateField('reminder1Enabled', v)}
            onDaysChange={(v) => updateField('reminder1DaysBefore', v)}
          />
          <ReminderConfig
            reminderNumber={2}
            enabled={form.reminder2Enabled}
            daysBefore={form.reminder2DaysBefore}
            onToggle={(v) => updateField('reminder2Enabled', v)}
            onDaysChange={(v) => updateField('reminder2DaysBefore', v)}
          />
          <ReminderConfig
            reminderNumber={3}
            enabled={form.reminder3Enabled}
            daysBefore={form.reminder3DaysBefore}
            onToggle={(v) => updateField('reminder3Enabled', v)}
            onDaysChange={(v) => updateField('reminder3DaysBefore', v)}
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex gap-3">
        <button
          onClick={onSubmit}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={14} />
          {isSaving ? 'Saving...' : isEditing ? 'Update Hearing' : 'Add Hearing'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Hearing Card (display mode)
// ---------------------------------------------------------------------------

function HearingCard({
  hearing,
  onEdit,
  onDelete,
}: {
  hearing: Hearing;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const days = daysUntil(hearing.hearingDatetime);
  const isPast = days < 0;
  const isUrgent = days >= 0 && days <= 3;

  const activeReminders = [
    hearing.reminder1Enabled ? hearing.reminder1DaysBefore : null,
    hearing.reminder2Enabled ? hearing.reminder2DaysBefore : null,
    hearing.reminder3Enabled ? hearing.reminder3DaysBefore : null,
  ].filter((d): d is number => d !== null);

  return (
    <Card className={`${isPast ? 'opacity-60' : ''} ${isUrgent ? 'border-amber-300 bg-amber-50/30' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-base font-semibold text-gray-900">{hearing.hearingName}</h4>
          <div className="flex items-center gap-1 mt-1">
            {isPast ? (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">Past</span>
            ) : isUrgent ? (
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days away`}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                {days} days away
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            aria-label="Edit hearing"
          >
            <Calendar size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="Delete hearing"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-medium text-gray-900">{hearing.courthouseName}</span>
            <p className="text-gray-500 text-xs">{hearing.courthouseAddress}</p>
          </div>
        </div>
        {hearing.department && (
          <div className="flex items-center gap-2 text-gray-600">
            <span className="text-gray-400 text-xs">Dept:</span>
            <span className="font-medium">{hearing.department}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          <span className="text-gray-900">{formatHearingDate(hearing.hearingDatetime)}</span>
          <span className="text-gray-500">at</span>
          <span className="font-medium text-gray-900">{formatHearingTime(hearing.hearingDatetime)}</span>
        </div>
      </div>

      {/* Reminder Status */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          <Bell size={12} className="text-gray-400" />
          {activeReminders.length > 0 ? (
            activeReminders.map((d) => (
              <span key={d} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                {d}d before
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-400">No reminders set</span>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main HearingsPage
// ---------------------------------------------------------------------------

export function HearingsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HearingFormData>({ ...EMPTY_FORM });
  const [isSaving, setIsSaving] = useState(false);

  const fetchHearings = useCallback(async () => {
    if (!caseId) return;
    try {
      const res = await fetch(`${API_BASE}/api/hearings/${caseId}`);
      if (!res.ok) throw new Error('Failed to load hearings');
      const data = await res.json();
      setHearings(data.hearings || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hearings');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchHearings();
  }, [fetchHearings]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  const handleAdd = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
    setError(null);
  };

  const handleEdit = (hearing: Hearing) => {
    const { date, time } = splitDatetime(hearing.hearingDatetime);
    setForm({
      courthouseName: hearing.courthouseName,
      courthouseAddress: hearing.courthouseAddress,
      hearingName: hearing.hearingName,
      hearingDate: date,
      hearingTime: time,
      department: hearing.department,
      reminder1Enabled: hearing.reminder1Enabled,
      reminder2Enabled: hearing.reminder2Enabled,
      reminder3Enabled: hearing.reminder3Enabled,
      reminder1DaysBefore: hearing.reminder1DaysBefore,
      reminder2DaysBefore: hearing.reminder2DaysBefore,
      reminder3DaysBefore: hearing.reminder3DaysBefore,
    });
    setEditingId(hearing.id);
    setShowForm(true);
    setError(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError(null);
  };

  const handleSubmit = async () => {
    if (!caseId) return;

    // Client-side validation
    if (!form.hearingName.trim()) { setError('Hearing name is required'); return; }
    if (!form.courthouseName.trim()) { setError('Courthouse name is required'); return; }
    if (!form.courthouseAddress.trim()) { setError('Courthouse address is required'); return; }
    if (!form.hearingDate) { setError('Hearing date is required'); return; }
    if (!form.hearingTime) { setError('Hearing time is required'); return; }

    const hearingDatetime = combineDatetime(form.hearingDate, form.hearingTime);
    if (new Date(hearingDatetime).getTime() <= Date.now()) {
      setError('Hearing date must be in the future');
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      courthouseName: form.courthouseName,
      courthouseAddress: form.courthouseAddress,
      hearingName: form.hearingName,
      hearingDatetime,
      department: form.department,
      reminder1Enabled: form.reminder1Enabled,
      reminder2Enabled: form.reminder2Enabled,
      reminder3Enabled: form.reminder3Enabled,
      reminder1DaysBefore: form.reminder1DaysBefore,
      reminder2DaysBefore: form.reminder2DaysBefore,
      reminder3DaysBefore: form.reminder3DaysBefore,
    };

    try {
      const url = editingId
        ? `${API_BASE}/api/hearings/${caseId}/${editingId}`
        : `${API_BASE}/api/hearings/${caseId}`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save hearing');
      }

      setSuccessMsg(editingId ? 'Hearing updated successfully' : 'Hearing added successfully');
      handleCancel();
      await fetchHearings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hearing');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (hearingId: string) => {
    if (!caseId) return;
    if (!window.confirm('Remove this hearing? This cannot be undone.')) return;

    try {
      const res = await fetch(`${API_BASE}/api/hearings/${caseId}/${hearingId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete hearing');
      setSuccessMsg('Hearing removed');
      await fetchHearings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete hearing');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Court Hearings</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {hearings.length} of {MAX_HEARINGS} hearings scheduled
          </p>
        </div>
        {hearings.length < MAX_HEARINGS && !showForm && (
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Hearing
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle size={16} className="flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <HearingForm
          form={form}
          onChange={setForm}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isEditing={!!editingId}
          isSaving={isSaving}
        />
      )}

      {/* Hearings List */}
      {hearings.length === 0 && !showForm ? (
        <Card className="text-center py-12">
          <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-semibold text-gray-700">No hearings scheduled</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Add your upcoming court hearings to receive SMS reminders.
          </p>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add First Hearing
          </button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {hearings.map((hearing) => (
            <HearingCard
              key={hearing.id}
              hearing={hearing}
              onEdit={() => handleEdit(hearing)}
              onDelete={() => handleDelete(hearing.id)}
            />
          ))}
        </div>
      )}

      {/* SMS Info Banner */}
      <Card className="bg-gray-50 border-gray-200">
        <div className="flex items-start gap-3">
          <Bell size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-gray-800">SMS Reminders</h4>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Reminders are sent to the phone number on your account. Each hearing supports up to 3 customizable
              reminders. You can set each reminder to trigger 1-30 days before the hearing date. Toggle
              individual reminders on or off at any time.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
