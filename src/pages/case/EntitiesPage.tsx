// ============================================
// Court Access — Phase B: Entity Linking Page
// Cross-evidence entity detection and relationship mapping.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Users, Building2, MapPin, Phone, Car, Calendar, Mail, Hash, RefreshCw, ChevronDown, ChevronUp, Link2, FileText } from 'lucide-react';
import { Card } from '../../components/common/Card';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvidenceEntityLink {
  id: string;
  entityId: string;
  evidenceId: string;
  detectionConfidence: number;
  contextSnippet: string;
  createdAt: string;
}

interface Entity {
  id: string;
  caseId: string;
  entityType: string;
  entityValue: string;
  firstDetectedEvidenceId: string | null;
  createdAt: string;
  links: EvidenceEntityLink[];
}

const ENTITY_TYPE_CONFIG: Record<string, { icon: typeof Users; color: string; label: string }> = {
  person: { icon: Users, color: 'bg-blue-100 text-blue-700', label: 'Person' },
  organization: { icon: Building2, color: 'bg-purple-100 text-purple-700', label: 'Organization' },
  location: { icon: MapPin, color: 'bg-green-100 text-green-700', label: 'Location' },
  phone_number: { icon: Phone, color: 'bg-amber-100 text-amber-700', label: 'Phone' },
  vehicle: { icon: Car, color: 'bg-red-100 text-red-700', label: 'Vehicle' },
  date: { icon: Calendar, color: 'bg-slate-100 text-slate-700', label: 'Date' },
  email_address: { icon: Mail, color: 'bg-indigo-100 text-indigo-700', label: 'Email' },
};

// ---------------------------------------------------------------------------
// Entity Card
// ---------------------------------------------------------------------------

function EntityCard({ entity }: { entity: Entity }) {
  const [expanded, setExpanded] = useState(false);
  const config = ENTITY_TYPE_CONFIG[entity.entityType] || { icon: Hash, color: 'bg-gray-100 text-gray-600', label: entity.entityType };
  const Icon = config.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}`}>
            <Icon size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{entity.entityValue}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                {config.label}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Link2 size={10} />
                {entity.links.length} evidence link{entity.links.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
          aria-label="Toggle details"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && entity.links.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <p className="text-xs font-medium text-gray-500">Evidence References</p>
          {entity.links.map((link) => (
            <div key={link.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
              <FileText size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">
                  Evidence: {link.evidenceId}
                </p>
                {link.contextSnippet && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    &ldquo;{link.contextSnippet}&rdquo;
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  Confidence: {Math.round(link.detectionConfidence * 100)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Entities Page
// ---------------------------------------------------------------------------

export function EntitiesPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');

  const fetchEntities = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('entityType', filterType);

      const res = await fetch(`${API_BASE}/api/entities/${caseId}?${params}`);
      const data = await res.json();
      setEntities(data.entities || []);
    } catch (err) {
      console.error('Failed to fetch entities:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId, filterType]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // Group entities by type
  const typeCounts: Record<string, number> = {};
  for (const entity of entities) {
    typeCounts[entity.entityType] = (typeCounts[entity.entityType] || 0) + 1;
  }

  const filteredEntities = filterType
    ? entities.filter((e) => e.entityType === filterType)
    : entities;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            Entity Linking
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {entities.length} entit{entities.length !== 1 ? 'ies' : 'y'} detected across evidence
          </p>
        </div>
        <button
          onClick={fetchEntities}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          aria-label="Refresh entities"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Type Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {Object.entries(ENTITY_TYPE_CONFIG).map(([type, cfg]) => {
          const TypeIcon = cfg.icon;
          const count = typeCounts[type] || 0;
          return (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? '' : type)}
              className={`p-3 rounded-lg border text-center transition-all ${
                filterType === type
                  ? 'border-blue-300 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <TypeIcon size={16} className={`mx-auto mb-1 ${filterType === type ? 'text-blue-600' : 'text-gray-400'}`} />
              <p className="text-lg font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-500">{cfg.label}s</p>
            </button>
          );
        })}
      </div>

      {/* Entity List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading entities...</div>
      ) : filteredEntities.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Users size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">No entities detected yet.</p>
            <p className="text-gray-400 text-xs mt-1">Upload and process evidence to auto-detect entities.</p>
          </div>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredEntities.map((entity) => (
            <EntityCard key={entity.id} entity={entity} />
          ))}
        </div>
      )}
    </div>
  );
}
