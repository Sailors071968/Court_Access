// ============================================================================
// CourtAccess — Notifications & Alerts (Program 35 — API-wired)
// Loads and persists real notification settings via the membership API.
// No hardcoded contact details; unknown values render as UNKNOWN/empty.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Phone, Mail, Bell } from 'lucide-react';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Spinner } from '../components/ui/spinner';
import { EmptyState } from '../components/ui/empty-state';
import { Icon } from '../components/icons/registry';
import { useToast } from '../components/ui/toast';
import { fetchMembershipAccount, updateMembershipSettings } from '../services/membershipApi';
import { useAuthStore } from '../stores/authStore';

type Bool = boolean;

interface NotifSettings {
  smsEnabled: Bool;
  emailEnabled: Bool;
  oneWeek: Bool;
  twentyFourHours: Bool;
  twoHours: Bool;
  newDocumentAlerts: Bool;
  aiAnalysisUpdates: Bool;
}

const DEFAULTS: NotifSettings = {
  smsEnabled: false,
  emailEnabled: false,
  oneWeek: false,
  twentyFourHours: false,
  twoHours: false,
  newDocumentAlerts: false,
  aiAnalysisUpdates: false,
};

export function NotificationsPage() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<NotifSettings>(DEFAULTS);
  const [contact, setContact] = useState<{ email: string; phone: string }>({ email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const account = await fetchMembershipAccount();
        if (cancelled) return;
        const s = (account.settings ?? {}) as Record<string, unknown>;
        setSettings({
          smsEnabled: Boolean(s.smsEnabled),
          emailEnabled: Boolean(s.emailEnabled),
          oneWeek: Boolean(s.oneWeek),
          twentyFourHours: Boolean(s.twentyFourHours),
          twoHours: Boolean(s.twoHours),
          newDocumentAlerts: Boolean(s.newDocumentAlerts),
          aiAnalysisUpdates: Boolean(s.aiAnalysisUpdates),
        });
        setContact({ email: account.user?.email ?? user?.email ?? '', phone: (s.phone as string) ?? '' });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load notification settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const persist = useCallback(
    async (next: NotifSettings) => {
      try {
        await updateMembershipSettings(next as unknown as Record<string, boolean | string>);
        toast({ variant: 'success', title: 'Settings saved' });
      } catch {
        toast({ variant: 'error', title: 'Could not save', description: 'Your change was not persisted.' });
      }
    },
    [toast],
  );

  const toggle = (key: keyof NotifSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      void persist(next);
      return next;
    });
  };

  if (loading) return <Spinner label="Loading notification settings…" />;

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <Card>
          <EmptyState icon={<Icon name="notifications" size={24} />} title="Unable to load settings" description={error} />
        </Card>
      </div>
    );
  }

  const Toggle = ({ label, icon, k }: { label: string; icon: React.ReactNode; k: keyof NotifSettings }) => (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-sm text-slate-300">{label}:</span>
      <button
        onClick={() => toggle(k)}
        className={`relative w-12 h-6 rounded-full transition-colors ${settings[k] ? 'bg-gold-light' : 'bg-white/15'}`}
        role="switch"
        aria-checked={settings[k]}
        aria-label={`Toggle ${label}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${settings[k] ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Notifications & Alerts"
        overline="Settings"
        subtitle="Stay informed about your case"
        action={
          <div className="flex items-center gap-4">
            <Toggle label="SMS" icon={<Phone size={16} className="text-slate-400" />} k="smsEnabled" />
            <Toggle label="Email" icon={<Mail size={16} className="text-slate-400" />} k="emailEnabled" />
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <EmptyState
              icon={<Bell size={24} />}
              title="No notifications yet"
              description="Notifications appear here when there are case updates, new evidence, or analysis results."
            />
          </Card>
        </div>

        <div>
          <Card>
            <h3 className="text-base font-semibold text-white mb-4">Notification Settings</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Court Date Reminders</h4>
                <div className="space-y-2 ml-1">
                  {([
                    { key: 'oneWeek', label: '1 week before' },
                    { key: 'twentyFourHours', label: '24 hours before' },
                    { key: 'twoHours', label: '2 hours before' },
                  ] as { key: keyof NotifSettings; label: string }[]).map((item) => (
                    <label key={item.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings[item.key]}
                        onChange={() => toggle(item.key)}
                        className="rounded border-white/20 bg-navy-900 text-gold-light"
                      />
                      <span className="text-sm text-slate-300">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={settings.newDocumentAlerts} onChange={() => toggle('newDocumentAlerts')} className="rounded border-white/20 bg-navy-900 text-gold-light" />
                <span className="text-sm text-slate-200 font-medium">New Document Alerts</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={settings.aiAnalysisUpdates} onChange={() => toggle('aiAnalysisUpdates')} className="rounded border-white/20 bg-navy-900 text-gold-light" />
                <span className="text-sm text-slate-200 font-medium">AI Analysis Updates</span>
              </label>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <div className="flex items-center gap-2 px-3 py-2 border border-white/10 rounded-lg bg-navy-900/60">
                    <Mail size={14} className="text-slate-500" />
                    <span className="flex-1 text-sm text-slate-200">{contact.email || 'UNKNOWN'}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Phone number</label>
                  <div className="flex items-center gap-2 px-3 py-2 border border-white/10 rounded-lg bg-navy-900/60">
                    <Phone size={14} className="text-slate-500" />
                    <span className="flex-1 text-sm text-slate-200">{contact.phone || 'Not set'}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
