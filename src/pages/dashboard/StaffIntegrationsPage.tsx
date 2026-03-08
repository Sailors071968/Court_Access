// ============================================
// Court Access — Staff Integrations Page (API Registry Management)
// Staff Dashboard sub-module for managing external API/AI integrations.
// Provides: provider list, add/edit, credential management, test, usage logs.
// ============================================

import { useState } from 'react';
import {
  Plug, Plus, RefreshCw, Shield, Activity, Trash2, ToggleLeft, ToggleRight,
  Key, RotateCcw, Zap, Clock, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { DemoModeBadge } from '../../components/common/DemoModeBadge';
import { useAuthStore } from '../../stores/authStore';

// ---------------------------------------------------------------------------
// Types (mirrors backend types)
// ---------------------------------------------------------------------------

type ProviderType =
  | 'AI_REASONING'
  | 'AI_PRESENTATION'
  | 'LEGAL_DATA'
  | 'MEDIA_ANALYSIS'
  | 'GRAPH'
  | 'ANALYTICS';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

interface ProviderSummary {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  documentationUrl: string | null;
  enabled: boolean;
  healthStatus: HealthStatus;
  lastHealthCheck: string | null;
  credentialCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CredentialSummary {
  id: string;
  providerId: string;
  environment: string;
  rateLimitPerMinute: number;
  lastValidatedAt: string | null;
  isActive: boolean;
  maskedKey: string;
  createdAt: string;
}

interface UsageLogEntry {
  id: string;
  providerId: string;
  providerName: string;
  endpointUsed: string;
  requestTimestamp: string;
  responseStatus: number;
  latencyMs: number;
  errorMessage: string | null;
}

interface TestResult {
  providerId: string;
  providerName: string;
  status: 'success' | 'error';
  latencyMs: number;
  message: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_TYPES: ProviderType[] = [
  'AI_REASONING', 'AI_PRESENTATION', 'LEGAL_DATA',
  'MEDIA_ANALYSIS', 'GRAPH', 'ANALYTICS',
];

const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  AI_REASONING: 'AI Reasoning',
  AI_PRESENTATION: 'AI Presentation',
  LEGAL_DATA: 'Legal Data',
  MEDIA_ANALYSIS: 'Media Analysis',
  GRAPH: 'Graph',
  ANALYTICS: 'Analytics',
};

const PROVIDER_TYPE_COLORS: Record<ProviderType, string> = {
  AI_REASONING: 'bg-purple-100 text-purple-700',
  AI_PRESENTATION: 'bg-blue-100 text-blue-700',
  LEGAL_DATA: 'bg-amber-100 text-amber-700',
  MEDIA_ANALYSIS: 'bg-green-100 text-green-700',
  GRAPH: 'bg-cyan-100 text-cyan-700',
  ANALYTICS: 'bg-orange-100 text-orange-700',
};

const HEALTH_STATUS_CONFIG: Record<HealthStatus, { color: string; icon: typeof CheckCircle; label: string }> = {
  healthy: { color: 'text-green-600', icon: CheckCircle, label: 'Healthy' },
  degraded: { color: 'text-amber-500', icon: AlertTriangle, label: 'Degraded' },
  unhealthy: { color: 'text-red-600', icon: XCircle, label: 'Unhealthy' },
  unknown: { color: 'text-gray-400', icon: Clock, label: 'Unknown' },
};

// ---------------------------------------------------------------------------
// Demo Data (used when no backend is connected)
// ---------------------------------------------------------------------------

const DEMO_PROVIDERS: ProviderSummary[] = [
  {
    id: 'demo-1',
    name: 'NotebookLM',
    providerType: 'AI_REASONING',
    baseUrl: 'https://notebooklm.google.com/api',
    documentationUrl: 'https://notebooklm.google.com/docs',
    enabled: true,
    healthStatus: 'healthy',
    lastHealthCheck: new Date(Date.now() - 120_000).toISOString(),
    credentialCount: 1,
    createdAt: new Date(Date.now() - 86400_000 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 120_000).toISOString(),
  },
  {
    id: 'demo-2',
    name: 'OpenAI GPT-4',
    providerType: 'AI_REASONING',
    baseUrl: 'https://api.openai.com/v1',
    documentationUrl: 'https://platform.openai.com/docs',
    enabled: true,
    healthStatus: 'healthy',
    lastHealthCheck: new Date(Date.now() - 180_000).toISOString(),
    credentialCount: 2,
    createdAt: new Date(Date.now() - 86400_000 * 14).toISOString(),
    updatedAt: new Date(Date.now() - 180_000).toISOString(),
  },
  {
    id: 'demo-3',
    name: 'GammaAI',
    providerType: 'AI_PRESENTATION',
    baseUrl: 'https://api.gamma.app/v1',
    documentationUrl: 'https://docs.gamma.app',
    enabled: true,
    healthStatus: 'degraded',
    lastHealthCheck: new Date(Date.now() - 300_000).toISOString(),
    credentialCount: 1,
    createdAt: new Date(Date.now() - 86400_000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 300_000).toISOString(),
  },
  {
    id: 'demo-4',
    name: 'CourtListener',
    providerType: 'LEGAL_DATA',
    baseUrl: 'https://www.courtlistener.com/api/rest/v4',
    documentationUrl: 'https://www.courtlistener.com/api/',
    enabled: true,
    healthStatus: 'healthy',
    lastHealthCheck: new Date(Date.now() - 240_000).toISOString(),
    credentialCount: 1,
    createdAt: new Date(Date.now() - 86400_000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 240_000).toISOString(),
  },
  {
    id: 'demo-5',
    name: 'NanoBanana',
    providerType: 'AI_PRESENTATION',
    baseUrl: 'https://api.nanobanana.com/v1',
    documentationUrl: null,
    enabled: false,
    healthStatus: 'unknown',
    lastHealthCheck: null,
    credentialCount: 0,
    createdAt: new Date(Date.now() - 86400_000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400_000 * 1).toISOString(),
  },
  {
    id: 'demo-6',
    name: 'AWS Rekognition',
    providerType: 'MEDIA_ANALYSIS',
    baseUrl: 'https://rekognition.us-east-1.amazonaws.com',
    documentationUrl: 'https://docs.aws.amazon.com/rekognition/',
    enabled: true,
    healthStatus: 'healthy',
    lastHealthCheck: new Date(Date.now() - 60_000).toISOString(),
    credentialCount: 1,
    createdAt: new Date(Date.now() - 86400_000 * 21).toISOString(),
    updatedAt: new Date(Date.now() - 60_000).toISOString(),
  },
];

const DEMO_CREDENTIALS: CredentialSummary[] = [
  { id: 'cred-1', providerId: 'demo-1', environment: 'production', rateLimitPerMinute: 60, lastValidatedAt: new Date(Date.now() - 120_000).toISOString(), isActive: true, maskedKey: 'sk-not...3x7z', createdAt: new Date(Date.now() - 86400_000 * 7).toISOString() },
  { id: 'cred-2', providerId: 'demo-2', environment: 'production', rateLimitPerMinute: 120, lastValidatedAt: new Date(Date.now() - 180_000).toISOString(), isActive: true, maskedKey: 'sk-pro...9k2m', createdAt: new Date(Date.now() - 86400_000 * 14).toISOString() },
  { id: 'cred-3', providerId: 'demo-2', environment: 'staging', rateLimitPerMinute: 30, lastValidatedAt: null, isActive: false, maskedKey: 'sk-stg...1a4b', createdAt: new Date(Date.now() - 86400_000 * 10).toISOString() },
  { id: 'cred-4', providerId: 'demo-3', environment: 'production', rateLimitPerMinute: 45, lastValidatedAt: new Date(Date.now() - 300_000).toISOString(), isActive: true, maskedKey: 'gm-key...7j8k', createdAt: new Date(Date.now() - 86400_000 * 5).toISOString() },
  { id: 'cred-5', providerId: 'demo-4', environment: 'production', rateLimitPerMinute: 100, lastValidatedAt: new Date(Date.now() - 240_000).toISOString(), isActive: true, maskedKey: 'cl-tok...2n5p', createdAt: new Date(Date.now() - 86400_000 * 30).toISOString() },
  { id: 'cred-6', providerId: 'demo-6', environment: 'production', rateLimitPerMinute: 200, lastValidatedAt: new Date(Date.now() - 60_000).toISOString(), isActive: true, maskedKey: 'AKIA5...X9QR', createdAt: new Date(Date.now() - 86400_000 * 21).toISOString() },
];

const DEMO_USAGE_LOGS: UsageLogEntry[] = [
  { id: 'log-1', providerId: 'demo-1', providerName: 'NotebookLM', endpointUsed: '/analyze', requestTimestamp: new Date(Date.now() - 60_000).toISOString(), responseStatus: 200, latencyMs: 342, errorMessage: null },
  { id: 'log-2', providerId: 'demo-2', providerName: 'OpenAI GPT-4', endpointUsed: '/chat/completions', requestTimestamp: new Date(Date.now() - 120_000).toISOString(), responseStatus: 200, latencyMs: 1250, errorMessage: null },
  { id: 'log-3', providerId: 'demo-3', providerName: 'GammaAI', endpointUsed: '/presentations', requestTimestamp: new Date(Date.now() - 300_000).toISOString(), responseStatus: 503, latencyMs: 5100, errorMessage: 'Service temporarily unavailable' },
  { id: 'log-4', providerId: 'demo-4', providerName: 'CourtListener', endpointUsed: '/opinions/', requestTimestamp: new Date(Date.now() - 600_000).toISOString(), responseStatus: 200, latencyMs: 189, errorMessage: null },
  { id: 'log-5', providerId: 'demo-2', providerName: 'OpenAI GPT-4', endpointUsed: '/embeddings', requestTimestamp: new Date(Date.now() - 900_000).toISOString(), responseStatus: 429, latencyMs: 45, errorMessage: 'Rate limit exceeded' },
  { id: 'log-6', providerId: 'demo-6', providerName: 'AWS Rekognition', endpointUsed: '/detect-labels', requestTimestamp: new Date(Date.now() - 1800_000).toISOString(), responseStatus: 200, latencyMs: 890, errorMessage: null },
  { id: 'log-7', providerId: 'demo-1', providerName: 'NotebookLM', endpointUsed: 'health-check/scheduled', requestTimestamp: new Date(Date.now() - 120_000).toISOString(), responseStatus: 200, latencyMs: 156, errorMessage: null },
  { id: 'log-8', providerId: 'demo-4', providerName: 'CourtListener', endpointUsed: '/search/', requestTimestamp: new Date(Date.now() - 3600_000).toISOString(), responseStatus: 200, latencyMs: 412, errorMessage: null },
];

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function HealthBadge({ status }: { status: HealthStatus }) {
  const config = HEALTH_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.color}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

function ProviderTypeBadge({ type }: { type: ProviderType }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PROVIDER_TYPE_COLORS[type]}`}>
      {PROVIDER_TYPE_LABELS[type]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add Provider Form
// ---------------------------------------------------------------------------

function AddProviderForm({ onAdd, onCancel }: {
  onAdd: (provider: ProviderSummary) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [providerType, setProviderType] = useState<ProviderType>('AI_REASONING');
  const [baseUrl, setBaseUrl] = useState('');
  const [documentationUrl, setDocumentationUrl] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim()) return;

    const newProvider: ProviderSummary = {
      id: `demo-${Date.now()}`,
      name: name.trim(),
      providerType,
      baseUrl: baseUrl.trim(),
      documentationUrl: documentationUrl.trim() || null,
      enabled: true,
      healthStatus: 'unknown',
      lastHealthCheck: null,
      credentialCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onAdd(newProvider);
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Provider</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. NotebookLM"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider Type</label>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value as ProviderType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {PROVIDER_TYPES.map((t) => (
                <option key={t} value={t}>{PROVIDER_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Documentation URL (optional)</label>
            <input
              type="url"
              value={documentationUrl}
              onChange={(e) => setDocumentationUrl(e.target.value)}
              placeholder="https://docs.example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Add Provider</button>
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Credential Manager
// ---------------------------------------------------------------------------

function CredentialManager({ providerId, credentials: initialCredentials }: {
  providerId: string;
  credentials: CredentialSummary[];
}) {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [showAddKey, setShowAddKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotateKeyValue, setRotateKeyValue] = useState('');

  function handleAddKey() {
    if (!newKeyValue.trim()) return;
    const masked = newKeyValue.length > 10
      ? `${newKeyValue.substring(0, 6)}...${newKeyValue.substring(newKeyValue.length - 4)}`
      : '****';
    const newCred: CredentialSummary = {
      id: `cred-${Date.now()}`,
      providerId,
      environment: 'production',
      rateLimitPerMinute: 60,
      lastValidatedAt: null,
      isActive: true,
      maskedKey: masked,
      createdAt: new Date().toISOString(),
    };
    setCredentials([newCred, ...credentials]);
    setNewKeyValue('');
    setShowAddKey(false);
  }

  function handleRotate(credId: string) {
    if (!rotateKeyValue.trim()) return;
    const masked = rotateKeyValue.length > 10
      ? `${rotateKeyValue.substring(0, 6)}...${rotateKeyValue.substring(rotateKeyValue.length - 4)}`
      : '****';
    setCredentials(credentials.map((c) =>
      c.id === credId
        ? { ...c, isActive: false }
        : c
    ));
    const oldCred = credentials.find((c) => c.id === credId);
    const newCred: CredentialSummary = {
      id: `cred-${Date.now()}`,
      providerId,
      environment: oldCred?.environment ?? 'production',
      rateLimitPerMinute: oldCred?.rateLimitPerMinute ?? 60,
      lastValidatedAt: null,
      isActive: true,
      maskedKey: masked,
      createdAt: new Date().toISOString(),
    };
    setCredentials((prev) => [newCred, ...prev.map((c) => c.id === credId ? { ...c, isActive: false } : c)]);
    setRotateKeyValue('');
    setRotatingId(null);
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">Credentials</h4>
        <button
          onClick={() => setShowAddKey(!showAddKey)}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          <Key size={12} /> Add Key
        </button>
      </div>

      {showAddKey && (
        <div className="flex gap-2 mb-3">
          <input
            type="password"
            value={newKeyValue}
            onChange={(e) => setNewKeyValue(e.target.value)}
            placeholder="Enter API key..."
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button onClick={handleAddKey} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save</button>
          <button onClick={() => { setShowAddKey(false); setNewKeyValue(''); }} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
        </div>
      )}

      {credentials.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No credentials configured</p>
      ) : (
        <div className="space-y-2">
          {credentials.map((cred) => (
            <div key={cred.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${cred.isActive ? 'bg-gray-50' : 'bg-gray-100 opacity-60'}`}>
              <div className="flex items-center gap-3">
                <Shield size={12} className={cred.isActive ? 'text-green-500' : 'text-gray-400'} />
                <span className="font-mono text-gray-600">{cred.maskedKey}</span>
                <span className="text-gray-400">{cred.environment}</span>
                <span className="text-gray-400">{cred.rateLimitPerMinute} req/min</span>
                {!cred.isActive && <span className="text-red-500 font-medium">Revoked</span>}
              </div>
              {cred.isActive && (
                <div className="flex items-center gap-2">
                  {rotatingId === cred.id ? (
                    <div className="flex gap-1">
                      <input
                        type="password"
                        value={rotateKeyValue}
                        onChange={(e) => setRotateKeyValue(e.target.value)}
                        placeholder="New key..."
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-xs outline-none"
                      />
                      <button onClick={() => handleRotate(cred.id)} className="px-2 py-1 text-xs text-white bg-amber-600 rounded hover:bg-amber-700">Rotate</button>
                      <button onClick={() => { setRotatingId(null); setRotateKeyValue(''); }} className="px-2 py-1 text-xs text-gray-600 bg-gray-200 rounded">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRotatingId(cred.id)}
                      className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800"
                    >
                      <RotateCcw size={10} /> Rotate
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider Row (Expandable)
// ---------------------------------------------------------------------------

function ProviderRow({ provider, credentials, onToggle, onDelete, onTest }: {
  provider: ProviderSummary;
  credentials: CredentialSummary[];
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    // Simulate test connection
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
    const latency = Math.round(100 + Math.random() * 900);
    const success = Math.random() > 0.2;
    setTestResult({
      providerId: provider.id,
      providerName: provider.name,
      status: success ? 'success' : 'error',
      latencyMs: latency,
      message: success ? 'Connection successful' : 'Connection timeout',
      timestamp: new Date().toISOString(),
    });
    setTesting(false);
    onTest(provider.id);
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Row Header */}
      <div
        className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Plug size={16} className={provider.enabled ? 'text-blue-500' : 'text-gray-300'} />
            <span className="font-semibold text-gray-900 text-sm">{provider.name}</span>
          </div>
          <ProviderTypeBadge type={provider.providerType} />
          <HealthBadge status={provider.healthStatus} />
          <span className="text-xs text-gray-400 hidden lg:inline">
            {provider.credentialCount} credential{provider.credentialCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Test Button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleTest(); }}
            disabled={testing || !provider.enabled}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testing ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
            Test
          </button>

          {/* Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(provider.id, !provider.enabled); }}
            className="text-gray-500 hover:text-gray-700"
            title={provider.enabled ? 'Disable' : 'Enable'}
          >
            {provider.enabled
              ? <ToggleRight size={24} className="text-green-500" />
              : <ToggleLeft size={24} className="text-gray-300" />
            }
          </button>

          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(provider.id); }}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Remove provider"
          >
            <Trash2 size={14} />
          </button>

          {/* Expand */}
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-xs text-gray-600">
            <div>
              <span className="font-medium text-gray-500">Base URL:</span>{' '}
              <span className="font-mono">{provider.baseUrl}</span>
            </div>
            {provider.documentationUrl && (
              <div>
                <span className="font-medium text-gray-500">Docs:</span>{' '}
                <a href={provider.documentationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                  {provider.documentationUrl} <ExternalLink size={10} />
                </a>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-500">Created:</span>{' '}
              {new Date(provider.createdAt).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium text-gray-500">Last Health Check:</span>{' '}
              {provider.lastHealthCheck ? new Date(provider.lastHealthCheck).toLocaleString() : 'Never'}
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`mt-3 p-3 rounded-lg text-xs ${testResult.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <div className="flex items-center gap-2">
                {testResult.status === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                <span className="font-medium">{testResult.message}</span>
                <span className="text-gray-500 ml-auto">{testResult.latencyMs}ms</span>
              </div>
            </div>
          )}

          {/* Credentials */}
          <CredentialManager
            providerId={provider.id}
            credentials={credentials}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usage Logs Table
// ---------------------------------------------------------------------------

function UsageLogsTable({ logs }: { logs: UsageLogEntry[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Usage Logs</h3>
        <span className="text-xs text-gray-400">{logs.length} entries</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 text-gray-500 font-medium">Provider</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">Endpoint</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">Status</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">Latency</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">Time</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 px-2 font-medium text-gray-900">{log.providerName}</td>
                <td className="py-2 px-2 font-mono text-gray-600">{log.endpointUsed}</td>
                <td className="py-2 px-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                    log.responseStatus >= 200 && log.responseStatus < 300
                      ? 'bg-green-100 text-green-700'
                      : log.responseStatus >= 400
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}>
                    {log.responseStatus === -1 ? 'ERR' : log.responseStatus}
                  </span>
                </td>
                <td className="py-2 px-2 text-gray-600">{log.latencyMs}ms</td>
                <td className="py-2 px-2 text-gray-400">{new Date(log.requestTimestamp).toLocaleString()}</td>
                <td className="py-2 px-2 text-red-500 max-w-[200px] truncate">{log.errorMessage ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function StaffIntegrationsPage() {
  const { user } = useAuthStore();
  const [providers, setProviders] = useState<ProviderSummary[]>(DEMO_PROVIDERS);
  const [usageLogs] = useState<UsageLogEntry[]>(DEMO_USAGE_LOGS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'providers' | 'logs'>('providers');

  // Check role access
  if (user && user.role !== 'admin' && user.role !== 'staff') {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card>
          <div className="text-center py-12">
            <Shield size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
            <p className="text-sm text-gray-500 mt-2">Staff or Admin role required to access API Registry.</p>
          </div>
        </Card>
      </div>
    );
  }

  const credentialsByProvider = DEMO_CREDENTIALS.reduce<Record<string, CredentialSummary[]>>((acc, cred) => {
    if (!acc[cred.providerId]) acc[cred.providerId] = [];
    acc[cred.providerId].push(cred);
    return acc;
  }, {});

  // Stats
  const enabledCount = providers.filter((p) => p.enabled).length;
  const healthyCount = providers.filter((p) => p.healthStatus === 'healthy').length;
  const degradedCount = providers.filter((p) => p.healthStatus === 'degraded' || p.healthStatus === 'unhealthy').length;
  const totalCredentials = providers.reduce((sum, p) => sum + p.credentialCount, 0);

  function handleAddProvider(provider: ProviderSummary) {
    setProviders([...providers, provider]);
    setShowAddForm(false);
  }

  function handleToggle(id: string, enabled: boolean) {
    setProviders(providers.map((p) =>
      p.id === id ? { ...p, enabled, healthStatus: enabled ? p.healthStatus : 'unknown' } : p,
    ));
  }

  function handleDelete(id: string) {
    setProviders(providers.filter((p) => p.id !== id));
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Plug size={24} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">API Integration Registry</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">Manage external API/AI integrations, credentials, and health monitoring</p>
        </div>
        <DemoModeBadge />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Plug size={16} className="text-blue-500" />
            <span className="text-xs text-gray-500">Total Providers</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{providers.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ToggleRight size={16} className="text-green-500" />
            <span className="text-xs text-gray-500">Enabled</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{enabledCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-green-500" />
            <span className="text-xs text-gray-500">Healthy</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{healthyCount}</div>
          {degradedCount > 0 && <div className="text-xs text-amber-500 mt-0.5">{degradedCount} degraded</div>}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Key size={16} className="text-amber-500" />
            <span className="text-xs text-gray-500">Total Credentials</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalCredentials}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('providers')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'providers'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Providers ({providers.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Usage Logs ({usageLogs.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'providers' && (
        <div className="space-y-4">
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} /> Add Provider
            </button>
            <div className="text-xs text-gray-400">
              Health checks run every 5 minutes
            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <AddProviderForm onAdd={handleAddProvider} onCancel={() => setShowAddForm(false)} />
          )}

          {/* Provider List */}
          <div className="space-y-2">
            {providers.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                credentials={credentialsByProvider[provider.id] ?? []}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onTest={() => {}}
              />
            ))}
          </div>

          {providers.length === 0 && (
            <Card>
              <div className="text-center py-12">
                <Plug size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No providers configured. Add your first API integration.</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'logs' && <UsageLogsTable logs={usageLogs} />}
    </div>
  );
}
