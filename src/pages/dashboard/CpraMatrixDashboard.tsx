// ============================================================================
// CourtAccess — CPRA Policy Matrix Dashboard
// Interactive agency × topic status grid with filters, sorting, sticky headers.
// ============================================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '../../components/common/Card';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Building2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Upload,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PolicyMatrixStatus = 'NOT_REQUESTED' | 'REQUESTED' | 'RECEIVED' | 'UPLOADED' | 'IN_USE';

interface PolicyTopicInfo {
  topicId: string;
  topicName: string;
  description: string | null;
}

interface CpraAgencyInfo {
  agencyId: string;
  agencyName: string;
  state: string;
  city: string | null;
  email: string | null;
  cpraContact: string | null;
  website: string | null;
}

interface MatrixEntry {
  id: string;
  agencyId: string;
  topicId: string;
  status: PolicyMatrixStatus;
  requestDate: string | null;
  receivedDate: string | null;
  uploadedDate: string | null;
  inUseDate: string | null;
  fileUrl: string | null;
  notes: string | null;
}

interface MatrixSummary {
  totalAgencies: number;
  totalTopics: number;
  statusBreakdown: Record<PolicyMatrixStatus, number>;
  coveragePercent: number;
}

// ---------------------------------------------------------------------------
// Status Badge Component
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<PolicyMatrixStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  NOT_REQUESTED: { label: 'Not Requested', color: 'text-gray-500', bg: 'bg-gray-100', icon: <AlertCircle size={12} /> },
  REQUESTED: { label: 'Requested', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: <Clock size={12} /> },
  RECEIVED: { label: 'Received', color: 'text-blue-700', bg: 'bg-blue-100', icon: <Download size={12} /> },
  UPLOADED: { label: 'Uploaded', color: 'text-purple-700', bg: 'bg-purple-100', icon: <Upload size={12} /> },
  IN_USE: { label: 'In Use', color: 'text-green-700', bg: 'bg-green-100', icon: <CheckCircle2 size={12} /> },
};

function StatusBadge({ status, compact }: { status: PolicyMatrixStatus; compact?: boolean }) {
  const config = STATUS_CONFIG[status];
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${config.color} ${config.bg}`}>
        {config.icon}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color} ${config.bg}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sample Data Generator
// ---------------------------------------------------------------------------

function generateSampleData(): {
  agencies: CpraAgencyInfo[];
  topics: PolicyTopicInfo[];
  entries: MatrixEntry[];
  summary: MatrixSummary;
} {
  const agencies: CpraAgencyInfo[] = [
    { agencyId: 'a1', agencyName: 'Sacramento Police Department', state: 'CA', city: 'Sacramento', email: 'records@sacpd.org', cpraContact: 'Records Division', website: 'https://sacpd.org' },
    { agencyId: 'a2', agencyName: 'Los Angeles Police Department', state: 'CA', city: 'Los Angeles', email: 'records@lapd.online', cpraContact: 'Discovery Unit', website: 'https://lapdonline.org' },
    { agencyId: 'a3', agencyName: 'San Francisco Police Department', state: 'CA', city: 'San Francisco', email: 'sfpdrecords@sfgov.org', cpraContact: 'Records Section', website: 'https://sfpd.org' },
    { agencyId: 'a4', agencyName: 'San Diego Police Department', state: 'CA', city: 'San Diego', email: 'records@pd.sandiego.gov', cpraContact: 'Records Unit', website: 'https://sdpd.org' },
    { agencyId: 'a5', agencyName: 'San Jose Police Department', state: 'CA', city: 'San Jose', email: 'records@sjpd.org', cpraContact: 'Records Bureau', website: 'https://sjpd.org' },
    { agencyId: 'a6', agencyName: 'Oakland Police Department', state: 'CA', city: 'Oakland', email: 'records@oaklandca.gov', cpraContact: 'Records Section', website: 'https://oaklandca.gov/police' },
    { agencyId: 'a7', agencyName: 'Fresno Police Department', state: 'CA', city: 'Fresno', email: 'records@fresno.gov', cpraContact: 'Records Division', website: 'https://fresno.gov/police' },
    { agencyId: 'a8', agencyName: 'Long Beach Police Department', state: 'CA', city: 'Long Beach', email: 'records@longbeach.gov', cpraContact: 'Records Bureau', website: 'https://longbeach.gov/police' },
    { agencyId: 'a9', agencyName: 'California Highway Patrol', state: 'CA', city: null, email: 'records@chp.ca.gov', cpraContact: 'Public Records Unit', website: 'https://chp.ca.gov' },
    { agencyId: 'a10', agencyName: 'Los Angeles County Sheriff', state: 'CA', city: 'Los Angeles', email: 'records@lasd.org', cpraContact: 'Discovery Unit', website: 'https://lasd.org' },
    { agencyId: 'a11', agencyName: 'Orange County Sheriff', state: 'CA', city: 'Santa Ana', email: 'records@ocsd.org', cpraContact: 'Records Bureau', website: 'https://ocsheriff.gov' },
    { agencyId: 'a12', agencyName: 'Riverside Police Department', state: 'CA', city: 'Riverside', email: 'records@riversideca.gov', cpraContact: 'Records Section', website: 'https://riversideca.gov/rpd' },
    { agencyId: 'a13', agencyName: 'Bakersfield Police Department', state: 'CA', city: 'Bakersfield', email: 'records@bakersfieldpd.us', cpraContact: 'Records Division', website: 'https://bakersfieldpd.us' },
    { agencyId: 'a14', agencyName: 'Alameda County Sheriff', state: 'CA', city: 'Oakland', email: 'records@acgov.org', cpraContact: 'Records Division', website: 'https://alamedacountysheriff.org' },
    { agencyId: 'a15', agencyName: 'San Bernardino County Sheriff', state: 'CA', city: 'San Bernardino', email: 'records@sbcsd.org', cpraContact: 'Records Section', website: 'https://sbcounty.gov/sheriff' },
  ];

  const topics: PolicyTopicInfo[] = [
    { topicId: 't1', topicName: 'Use of Force', description: 'General use of force policies' },
    { topicId: 't2', topicName: 'Deadly Force', description: 'Lethal force policies' },
    { topicId: 't3', topicName: 'Body Worn Cameras', description: 'BWC activation/retention' },
    { topicId: 't4', topicName: 'Dash Cameras', description: 'Dashboard camera policies' },
    { topicId: 't5', topicName: 'Vehicle Pursuits', description: 'Pursuit policies' },
    { topicId: 't6', topicName: 'Search and Seizure', description: 'Search policies' },
    { topicId: 't7', topicName: 'Evidence Handling', description: 'Evidence collection/handling' },
    { topicId: 't8', topicName: 'Arrest Procedures', description: 'Arrest policies' },
    { topicId: 't9', topicName: 'Interrogations', description: 'Interrogation procedures' },
    { topicId: 't10', topicName: 'Officer-Involved Shootings', description: 'OIS investigation' },
    { topicId: 't11', topicName: 'Use of Tasers', description: 'Conducted energy devices' },
    { topicId: 't12', topicName: 'De-escalation', description: 'De-escalation techniques' },
    { topicId: 't13', topicName: 'Mental Health Response', description: 'Mental health crisis response' },
    { topicId: 't14', topicName: 'Duty to Intervene', description: 'Officer intervention obligation' },
    { topicId: 't15', topicName: 'Report Writing', description: 'Incident report standards' },
    { topicId: 't16', topicName: 'Public Complaints', description: 'Citizen complaint procedures' },
    { topicId: 't17', topicName: 'Internal Affairs', description: 'Internal investigation procedures' },
    { topicId: 't18', topicName: 'K9 Units', description: 'Police canine deployment' },
    { topicId: 't19', topicName: 'Crowd Control', description: 'Crowd management policies' },
    { topicId: 't20', topicName: 'Racial Profiling', description: 'Anti-bias policing' },
    { topicId: 't21', topicName: 'Foot Pursuit', description: 'Foot pursuit policies' },
    { topicId: 't22', topicName: 'Neck Restraint', description: 'Carotid restraint policies' },
    { topicId: 't23', topicName: 'No-Knock Warrants', description: 'No-knock warrant execution' },
    { topicId: 't24', topicName: 'Juvenile Procedures', description: 'Interaction with minors' },
    { topicId: 't25', topicName: 'Domestic Violence', description: 'DV response policies' },
  ];

  // Generate matrix entries with realistic distribution
  const entries: MatrixEntry[] = [];
  let entryId = 1;
  for (const agency of agencies) {
    for (const topic of topics) {
      // Weighted random status: more NOT_REQUESTED and REQUESTED
      const rand = Math.random();
      let status: PolicyMatrixStatus;
      if (rand < 0.25) status = 'NOT_REQUESTED';
      else if (rand < 0.45) status = 'REQUESTED';
      else if (rand < 0.65) status = 'RECEIVED';
      else if (rand < 0.82) status = 'UPLOADED';
      else status = 'IN_USE';

      entries.push({
        id: `entry-${entryId++}`,
        agencyId: agency.agencyId,
        topicId: topic.topicId,
        status,
        requestDate: status !== 'NOT_REQUESTED' ? '2025-06-15T00:00:00Z' : null,
        receivedDate: ['RECEIVED', 'UPLOADED', 'IN_USE'].includes(status) ? '2025-08-01T00:00:00Z' : null,
        uploadedDate: ['UPLOADED', 'IN_USE'].includes(status) ? '2025-09-10T00:00:00Z' : null,
        inUseDate: status === 'IN_USE' ? '2025-10-01T00:00:00Z' : null,
        fileUrl: ['UPLOADED', 'IN_USE'].includes(status) ? `https://s3.amazonaws.com/policies/${agency.agencyId}/${topic.topicId}.pdf` : null,
        notes: null,
      });
    }
  }

  const statusBreakdown: Record<PolicyMatrixStatus, number> = {
    NOT_REQUESTED: 0, REQUESTED: 0, RECEIVED: 0, UPLOADED: 0, IN_USE: 0,
  };
  for (const e of entries) statusBreakdown[e.status]++;

  return {
    agencies,
    topics,
    entries,
    summary: {
      totalAgencies: agencies.length,
      totalTopics: topics.length,
      statusBreakdown,
      coveragePercent: Math.round(((entries.length - statusBreakdown.NOT_REQUESTED) / entries.length) * 100),
    },
  };
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

type SortField = 'agencyName' | 'city' | 'coverage';
type SortDir = 'asc' | 'desc';

export function CpraMatrixDashboard() {
  const [data, setData] = useState<ReturnType<typeof generateSampleData> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PolicyMatrixStatus | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<SortField>('agencyName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setData(generateSampleData());
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      setData(generateSampleData());
      setIsLoading(false);
    }, 500);
  }, []);

  // Computed: filtered and sorted agencies
  const filteredAgencies = useMemo(() => {
    if (!data) return [];
    let agencies = [...data.agencies];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      agencies = agencies.filter(
        (a) =>
          a.agencyName.toLowerCase().includes(q) ||
          (a.city?.toLowerCase().includes(q) ?? false),
      );
    }

    // Sort
    agencies.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'agencyName') {
        cmp = a.agencyName.localeCompare(b.agencyName);
      } else if (sortField === 'city') {
        cmp = (a.city ?? '').localeCompare(b.city ?? '');
      } else if (sortField === 'coverage') {
        const aCoverage = data.entries.filter((e) => e.agencyId === a.agencyId && e.status !== 'NOT_REQUESTED').length;
        const bCoverage = data.entries.filter((e) => e.agencyId === b.agencyId && e.status !== 'NOT_REQUESTED').length;
        cmp = aCoverage - bCoverage;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return agencies;
  }, [data, searchQuery, sortField, sortDir]);

  // Computed: status-filtered entries
  const filteredEntries = useMemo(() => {
    if (!data) return [];
    if (statusFilter === 'ALL') return data.entries;
    return data.entries.filter((e) => e.status === statusFilter);
  }, [data, statusFilter]);

  const getEntryForCell = useCallback(
    (agencyId: string, topicId: string): MatrixEntry | undefined => {
      return filteredEntries.find((e) => e.agencyId === agencyId && e.topicId === topicId);
    },
    [filteredEntries],
  );

  if (isLoading || !data) {
    return (
      <div className="max-w-full mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CPRA Policy Matrix</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track policy acquisition status across {data.summary.totalAgencies} agencies and{' '}
            {data.summary.totalTopics} policy topics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(Object.entries(data.summary.statusBreakdown) as [PolicyMatrixStatus, number][]).map(
          ([status, count]) => (
            <Card key={status}>
              <div className="flex items-center gap-3 p-2">
                <StatusBadge status={status} />
                <div>
                  <p className="text-xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500">
                    {Math.round((count / data.entries.length) * 100)}%
                  </p>
                </div>
              </div>
            </Card>
          ),
        )}
      </div>

      {/* Coverage bar */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Coverage</span>
          <span className="text-sm font-bold text-gray-900">{data.summary.coveragePercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${data.summary.coveragePercent}%` }}
          />
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search agencies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PolicyMatrixStatus | 'ALL')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="NOT_REQUESTED">Not Requested</option>
            <option value="REQUESTED">Requested</option>
            <option value="RECEIVED">Received</option>
            <option value="UPLOADED">Uploaded</option>
            <option value="IN_USE">In Use</option>
          </select>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="border border-gray-200 rounded-lg overflow-auto max-h-[600px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 bg-gray-50">
            <tr>
              <th
                className="sticky left-0 z-30 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700 border-b border-r border-gray-200 cursor-pointer hover:bg-gray-100 min-w-[250px]"
                onClick={() => handleSort('agencyName')}
              >
                <div className="flex items-center gap-1">
                  <Building2 size={14} />
                  Agency
                  <SortIcon field="agencyName" />
                </div>
              </th>
              <th
                className="sticky left-[250px] z-30 bg-gray-50 px-3 py-3 text-left font-semibold text-gray-700 border-b border-r border-gray-200 cursor-pointer hover:bg-gray-100 min-w-[100px]"
                onClick={() => handleSort('city')}
              >
                <div className="flex items-center gap-1">
                  City
                  <SortIcon field="city" />
                </div>
              </th>
              {data.topics.map((topic) => (
                <th
                  key={topic.topicId}
                  className="px-2 py-3 text-center font-medium text-gray-600 border-b border-gray-200 min-w-[80px] max-w-[100px]"
                  title={topic.description ?? topic.topicName}
                >
                  <div className="flex items-center justify-center gap-1">
                    <FileText size={12} />
                    <span className="truncate text-xs">{topic.topicName}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAgencies.map((agency, idx) => (
              <tr
                key={agency.agencyId}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
              >
                <td className="sticky left-0 z-10 px-4 py-2 font-medium text-gray-900 border-r border-gray-200 min-w-[250px]"
                    style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <div className="truncate" title={agency.agencyName}>
                    {agency.agencyName}
                  </div>
                </td>
                <td className="sticky left-[250px] z-10 px-3 py-2 text-gray-600 border-r border-gray-200 min-w-[100px]"
                    style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                  {agency.city ?? '—'}
                </td>
                {data.topics.map((topic) => {
                  const entry = getEntryForCell(agency.agencyId, topic.topicId);
                  return (
                    <td
                      key={topic.topicId}
                      className="px-1 py-2 text-center border-gray-100"
                    >
                      {entry ? (
                        <StatusBadge status={entry.status} compact />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="font-medium">Legend:</span>
        {(Object.entries(STATUS_CONFIG) as [PolicyMatrixStatus, typeof STATUS_CONFIG[PolicyMatrixStatus]][]).map(
          ([status, config]) => (
            <span key={status} className="flex items-center gap-1">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${config.color} ${config.bg}`}>
                {config.icon}
              </span>
              {config.label}
            </span>
          ),
        )}
      </div>

      {/* Stats Footer */}
      <div className="text-xs text-gray-400 text-center">
        Showing {filteredAgencies.length} of {data.agencies.length} agencies |{' '}
        {data.topics.length} policy topics | {data.entries.length} total matrix cells
      </div>
    </div>
  );
}
