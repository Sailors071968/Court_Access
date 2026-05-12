// ============================================================================
// Phase O.1 — Billing Operations Cockpit
// 8-pane Stripe billing + subscription operations dashboard.
// Implementation infrastructure. Deterministic. Auditable. Immutable.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface BillingProps {
  customerId: string;
}

interface WebhookEntry { id: string; eventType: string; signatureVerified: boolean; replayProtected: boolean; processingStatus: string; }
interface SubEntry { id: string; planType: string; planTier: string; seatCount: number; lifecycleStatus: string; }
interface EntitleEntry { id: string; featureName: string; currentTier: string; entitled: boolean; usageCount: number; usageLimit: number; }
interface InvoiceEntry { id: string; invoiceNumber: string; invoiceType: string; amountCents: number; invoiceStatus: string; }
interface AuditEntry { id: string; actionType: string; immutable: boolean; createdAt: string; }
interface RecoveryEntry { id: string; failureReason: string; recoveryAction: string; retryCount: number; recoveryStatus: string; }
interface InstitutionalEntry { id: string; institutionName: string; billingPhase: string; contractValue: number; seatsPurchased: number; }
interface CertEntry { id: string; certificationArea: string; certified: boolean; }

type PaneName = 'subscriptions' | 'invoices' | 'webhooks' | 'entitlements' | 'institutional' | 'recovery' | 'audit' | 'certification';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'entitlements', label: 'Entitlements' },
  { key: 'institutional', label: 'Institutional' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'certification', label: 'Certification' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'active' || s === 'paid' || s === 'processed' || s === 'recovered' || s === 'completed' || s === true ? '#22c55e' :
  s === 'trial' || s === 'open' || s === 'pending' || s === 'retrying' || s === 'conditional' ? '#3b82f6' :
  s === 'past_due' || s === 'escalated' || s === 'dunning_email' ? '#f59e0b' :
  s === 'canceled' || s === 'failed' || s === 'void' || s === false ? '#ef4444' : '#64748b';

const fmtCents = (cents: number) => `$${(Math.abs(cents) / 100).toFixed(2)}${cents < 0 ? ' (credit)' : ''}`;

export const BillingOperationsCockpit: React.FC<BillingProps> = ({ customerId }) => {
  const [activePane, setActivePane] = useState<PaneName>('subscriptions');
  const [loading, setLoading] = useState(false);
  const [subs, setSubs] = useState<SubEntry[]>([]);
  const [invoices, setInvoices] = useState<InvoiceEntry[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [entitlements, setEntitlements] = useState<EntitleEntry[]>([]);
  const [institutional, setInstitutional] = useState<InstitutionalEntry[]>([]);
  const [recovery, setRecovery] = useState<RecoveryEntry[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [certs, setCerts] = useState<CertEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sb, iv, wh, en, inst, rec, au, ce] = await Promise.all([
        fetch(`/api/billing/subscriptions/${customerId}`).then(r => r.json()).catch(() => ({ subscriptions: [] })),
        fetch(`/api/billing/invoices/${customerId}`).then(r => r.json()).catch(() => ({ invoices: [] })),
        fetch(`/api/billing/webhooks/${customerId}`).then(r => r.json()).catch(() => ({ events: [] })),
        fetch(`/api/billing/entitlements/${customerId}`).then(r => r.json()).catch(() => ({ entitlements: [] })),
        fetch(`/api/billing/institutional/${customerId}`).then(r => r.json()).catch(() => ({ workflows: [] })),
        fetch(`/api/billing/recovery/${customerId}`).then(r => r.json()).catch(() => ({ recoveries: [] })),
        fetch(`/api/billing/audit/${customerId}`).then(r => r.json()).catch(() => ({ logs: [] })),
        fetch(`/api/billing/certification/${customerId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setSubs(sb.subscriptions || []); setInvoices(iv.invoices || []);
      setWebhooks(wh.events || []); setEntitlements(en.entitlements || []);
      setInstitutional(inst.workflows || []); setRecovery(rec.recoveries || []);
      setAudit(au.logs || []); setCerts(ce.certifications || []);
    } finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/billing/analyze/${customerId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderSubs = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Subscription Lifecycle</h3>
      {subs.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ fontWeight: 600 }}>{s.planTier}</span>
              <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>{s.planType}</span>
            </div>
            <Badge text={s.lifecycleStatus} color={sc(s.lifecycleStatus)} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{s.seatCount} seat{s.seatCount > 1 ? 's' : ''}</div>
        </div>
      ))}
    </div>
  );

  const renderInvoices = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Invoices</h3>
      {invoices.map(i => (
        <div key={i.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ fontWeight: 600 }}>{i.invoiceNumber}</span>
              <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>{i.invoiceType}</span>
            </div>
            <Badge text={i.invoiceStatus} color={sc(i.invoiceStatus)} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: i.amountCents < 0 ? '#ef4444' : '#22c55e' }}>{fmtCents(i.amountCents)}</div>
        </div>
      ))}
    </div>
  );

  const renderWebhooks = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Webhook Events</h3>
      {webhooks.map(w => (
        <div key={w.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{w.eventType}</span>
            <Badge text={w.processingStatus} color={sc(w.processingStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Badge text={w.signatureVerified ? 'SIG VERIFIED' : 'UNVERIFIED'} color={sc(w.signatureVerified)} />
            <Badge text={w.replayProtected ? 'REPLAY SAFE' : 'NO REPLAY'} color={sc(w.replayProtected)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderEntitlements = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Entitlement Enforcement</h3>
      {entitlements.map(e => (
        <div key={e.id} style={{ ...card, borderLeft: `4px solid ${sc(e.entitled)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{e.featureName.replace(/_/g, ' ')}</span>
            <Badge text={e.entitled ? 'ENTITLED' : 'BLOCKED'} color={sc(e.entitled)} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Tier: {e.currentTier} | Usage: {e.usageCount}{e.usageLimit > 0 ? `/${e.usageLimit}` : ' (unlimited)'}
          </div>
        </div>
      ))}
    </div>
  );

  const renderInstitutional = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Institutional Billing</h3>
      {institutional.map(i => (
        <div key={i.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{i.institutionName}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{i.seatsPurchased} seats</div>
            </div>
            <Badge text={i.billingPhase.replace(/_/g, ' ')} color={i.billingPhase === 'payment_received' ? '#22c55e' : '#3b82f6'} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#22c55e' }}>{fmtCents(i.contractValue)}</div>
        </div>
      ))}
    </div>
  );

  const renderRecovery = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Failed Payment Recovery</h3>
      {recovery.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.failureReason.replace(/_/g, ' ')}</span>
            <Badge text={r.recoveryStatus} color={sc(r.recoveryStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <span>Action: {r.recoveryAction.replace(/_/g, ' ')}</span>
            <span>Retries: {r.retryCount}/3</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAudit = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Billing Audit Log</h3>
      {audit.map(a => (
        <div key={a.id} style={{ ...card, borderLeft: `4px solid ${a.immutable ? '#22c55e' : '#ef4444'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{a.actionType.replace(/_/g, ' ')}</span>
            <Badge text={a.immutable ? 'IMMUTABLE' : 'MUTABLE'} color={sc(a.immutable)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderCerts = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Billing Certification</h3>
      {certs.map(c => (
        <div key={c.id} style={{ ...card, borderLeft: `4px solid ${sc(c.certified)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{c.certificationArea.replace(/_/g, ' ')}</span>
            <Badge text={c.certified ? 'CERTIFIED' : 'PENDING'} color={sc(c.certified)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'subscriptions': return renderSubs();
      case 'invoices': return renderInvoices();
      case 'webhooks': return renderWebhooks();
      case 'entitlements': return renderEntitlements();
      case 'institutional': return renderInstitutional();
      case 'recovery': return renderRecovery();
      case 'audit': return renderAudit();
      case 'certification': return renderCerts();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Billing Operations Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Stripe production billing + subscription operations
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Processing...' : 'Run Billing Analysis'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '8px 24px', background: '#1e293b', borderBottom: '1px solid #334155', overflowX: 'auto' }}>
        {PANES.map(p => (
          <button key={p.key} onClick={() => setActivePane(p.key)} style={{
            padding: '8px 16px', cursor: 'pointer', borderRadius: 6,
            background: activePane === p.key ? '#7c3aed' : 'transparent',
            color: activePane === p.key ? '#fff' : '#94a3b8',
            fontWeight: activePane === p.key ? 600 : 400, fontSize: 13, whiteSpace: 'nowrap', border: 'none',
          }}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 24 }}>{renderActive()}</div>
    </div>
  );
};

export default BillingOperationsCockpit;
