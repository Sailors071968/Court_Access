// ============================================
// Court Access — Policy Acquisition: Agency Directory
// Staff dashboard page for managing California law enforcement agencies.
// ============================================

import { useState, useMemo, useCallback } from 'react';
import {
  Building2, Search, ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  Globe, Mail, ExternalLink, X, Shield, MapPin, Phone, FileText, Filter
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { DemoModeBadge } from '../../components/common/DemoModeBadge';
import { TEXT_COLORS } from '../../constants/designTokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgencyType =
  | 'Police'
  | 'Sheriff'
  | 'State'
  | 'TaskForce'
  | 'Probation'
  | 'Corrections'
  | 'District_Attorney'
  | 'University'
  | 'Transit';

interface Agency {
  id: string;
  agencyName: string;
  agencyType: AgencyType;
  county: string;
  city: string | null;
  recordsEmail: string | null;
  recordsRequestUrl: string | null;
  phoneNumber: string | null;
  website: string | null;
  policyUrl: string | null;
  lastRequestSent: string | null;
  lastResponse: string | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Agency Type Config (badge colors)
// ---------------------------------------------------------------------------

const AGENCY_TYPE_CONFIG: Record<AgencyType, { label: string; bg: string; text: string }> = {
  Police: { label: 'Police', bg: 'bg-blue-100', text: 'text-blue-800' },
  Sheriff: { label: 'Sheriff', bg: 'bg-green-100', text: 'text-green-800' },
  State: { label: 'State', bg: 'bg-purple-100', text: 'text-purple-800' },
  TaskForce: { label: 'Task Force', bg: 'bg-orange-100', text: 'text-orange-800' },
  Probation: { label: 'Probation', bg: 'bg-amber-100', text: 'text-amber-800' },
  Corrections: { label: 'Corrections', bg: 'bg-red-100', text: 'text-red-800' },
  District_Attorney: { label: 'DA Bureau', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  University: { label: 'University', bg: 'bg-teal-100', text: 'text-teal-800' },
  Transit: { label: 'Transit', bg: 'bg-cyan-100', text: 'text-cyan-800' },
};

const ALL_AGENCY_TYPES: AgencyType[] = [
  'Police', 'Sheriff', 'State', 'TaskForce', 'Probation',
  'Corrections', 'District_Attorney', 'University', 'Transit',
];

// ---------------------------------------------------------------------------
// Seed data loader (imports from backend seed data at build time)
// For now we embed a representative sample inline. The real implementation
// will fetch from GET /api/policy/agencies.
// ---------------------------------------------------------------------------

function generateSeedAgencies(): Agency[] {
  // Representative seed data for UI demonstration.
  // The real dataset (~600 agencies) is loaded from the backend seed script.
  const seed: Omit<Agency, 'id'>[] = [
    // Sheriffs (sample)
    { agencyName: 'Los Angeles County Sheriff\'s Department', agencyType: 'Sheriff', county: 'Los Angeles', city: 'Los Angeles', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.lasd.org', policyUrl: 'https://pars.lasd.org', lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'San Diego County Sheriff\'s Department', agencyType: 'Sheriff', county: 'San Diego', city: 'San Diego', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.sdsheriff.gov', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Orange County Sheriff\'s Department', agencyType: 'Sheriff', county: 'Orange', city: 'Santa Ana', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.ocsheriff.gov', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Sacramento County Sheriff\'s Department', agencyType: 'Sheriff', county: 'Sacramento', city: 'Sacramento', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.sacsheriff.com', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Alameda County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Alameda', city: 'Oakland', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.alamedacountysheriff.org', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Riverside County Sheriff\'s Department', agencyType: 'Sheriff', county: 'Riverside', city: 'Riverside', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.riversidesheriff.org', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'San Bernardino County Sheriff\'s Department', agencyType: 'Sheriff', county: 'San Bernardino', city: 'San Bernardino', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://wp.sbcounty.gov/sheriff', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Santa Clara County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Santa Clara', city: 'San Jose', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.sccgov.org/sites/sheriff', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Fresno County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Fresno', city: 'Fresno', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.fresnosheriff.org', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Kern County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Kern', city: 'Bakersfield', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.kernsheriff.org', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'San Francisco Sheriff\'s Department', agencyType: 'Sheriff', county: 'San Francisco', city: 'San Francisco', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.sfsheriff.com', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Contra Costa County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Contra Costa', city: 'Martinez', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.cocosheriff.org', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'San Mateo County Sheriff\'s Office', agencyType: 'Sheriff', county: 'San Mateo', city: 'Redwood City', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.smcsheriff.com', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Ventura County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Ventura', city: 'Ventura', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.vcsd.org', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Sonoma County Sheriff\'s Office', agencyType: 'Sheriff', county: 'Sonoma', city: 'Santa Rosa', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.sonomasheriff.org', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    // Police (major cities)
    { agencyName: 'Los Angeles Police Department', agencyType: 'Police', county: 'Los Angeles', city: 'Los Angeles', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.lapdonline.org', policyUrl: 'https://www.lapdonline.org/lapd-manual', lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'San Francisco Police Department', agencyType: 'Police', county: 'San Francisco', city: 'San Francisco', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.sanfranciscopolice.org', policyUrl: 'https://www.sanfranciscopolice.org/your-sfpd/policies', lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'San Diego Police Department', agencyType: 'Police', county: 'San Diego', city: 'San Diego', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.sandiego.gov/police', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'San Jose Police Department', agencyType: 'Police', county: 'Santa Clara', city: 'San Jose', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.sjpd.org', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Oakland Police Department', agencyType: 'Police', county: 'Alameda', city: 'Oakland', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.oaklandca.gov/departments/police', policyUrl: 'https://www.oaklandca.gov/resources/opd-policies', lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Sacramento Police Department', agencyType: 'Police', county: 'Sacramento', city: 'Sacramento', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.cityofsacramento.org/Police', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Fresno Police Department', agencyType: 'Police', county: 'Fresno', city: 'Fresno', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.fresno.gov/police', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Long Beach Police Department', agencyType: 'Police', county: 'Los Angeles', city: 'Long Beach', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.longbeach.gov/police', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Bakersfield Police Department', agencyType: 'Police', county: 'Kern', city: 'Bakersfield', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.bakersfieldpd.us', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Anaheim Police Department', agencyType: 'Police', county: 'Orange', city: 'Anaheim', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.anaheim.net/157/Police-Department', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Riverside Police Department', agencyType: 'Police', county: 'Riverside', city: 'Riverside', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.riversideca.gov/rpd', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Stockton Police Department', agencyType: 'Police', county: 'San Joaquin', city: 'Stockton', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.stocktonca.gov/government/departments/police', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Irvine Police Department', agencyType: 'Police', county: 'Orange', city: 'Irvine', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.irvinepd.org', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Chula Vista Police Department', agencyType: 'Police', county: 'San Diego', city: 'Chula Vista', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Santa Rosa Police Department', agencyType: 'Police', county: 'Sonoma', city: 'Santa Rosa', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.srcity.org/766/Police-Department', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Berkeley Police Department', agencyType: 'Police', county: 'Alameda', city: 'Berkeley', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.cityofberkeley.info/Police', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Glendale Police Department', agencyType: 'Police', county: 'Los Angeles', city: 'Glendale', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.glendaleca.gov/government/departments/police-department', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Pasadena Police Department', agencyType: 'Police', county: 'Los Angeles', city: 'Pasadena', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.cityofpasadena.net/police', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Modesto Police Department', agencyType: 'Police', county: 'Stanislaus', city: 'Modesto', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Huntington Beach Police Department', agencyType: 'Police', county: 'Orange', city: 'Huntington Beach', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Santa Barbara Police Department', agencyType: 'Police', county: 'Santa Barbara', city: 'Santa Barbara', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    // State agencies
    { agencyName: 'California Highway Patrol', agencyType: 'State', county: 'Sacramento', city: 'Sacramento', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.chp.ca.gov', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'California Department of Justice — Bureau of Investigation', agencyType: 'State', county: 'Sacramento', city: 'Sacramento', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://oag.ca.gov', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'California Department of Corrections and Rehabilitation', agencyType: 'State', county: 'Sacramento', city: 'Sacramento', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.cdcr.ca.gov', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'California Department of Fish and Wildlife — Law Enforcement Division', agencyType: 'State', county: 'Sacramento', city: 'Sacramento', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://wildlife.ca.gov/enforcement', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'California State Parks — Law Enforcement Division', agencyType: 'State', county: 'Sacramento', city: 'Sacramento', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.parks.ca.gov/Rangers', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    // DA Bureaus
    { agencyName: 'Los Angeles County District Attorney — Bureau of Investigation', agencyType: 'District_Attorney', county: 'Los Angeles', city: 'Los Angeles', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'San Diego County District Attorney — Bureau of Investigation', agencyType: 'District_Attorney', county: 'San Diego', city: 'San Diego', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Orange County District Attorney — Bureau of Investigation', agencyType: 'District_Attorney', county: 'Orange', city: 'Santa Ana', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Sacramento County District Attorney — Bureau of Investigation', agencyType: 'District_Attorney', county: 'Sacramento', city: 'Sacramento', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Alameda County District Attorney — Inspector Division', agencyType: 'District_Attorney', county: 'Alameda', city: 'Oakland', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    // University Police
    { agencyName: 'UC Berkeley Police Department', agencyType: 'University', county: 'Alameda', city: 'Berkeley', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://ucpd.berkeley.edu', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'UCLA Police Department', agencyType: 'University', county: 'Los Angeles', city: 'Los Angeles', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.ucpd.ucla.edu', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Stanford University Department of Public Safety', agencyType: 'University', county: 'Santa Clara', city: 'Stanford', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://police.stanford.edu', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'UC San Diego Police Department', agencyType: 'University', county: 'San Diego', city: 'La Jolla', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'San Diego State University Police Department', agencyType: 'University', county: 'San Diego', city: 'San Diego', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    // Transit
    { agencyName: 'Bay Area Rapid Transit Police Department', agencyType: 'Transit', county: 'Alameda', city: 'Oakland', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: 'https://www.bart.gov/about/police', policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Los Angeles Metro Transit Security', agencyType: 'Transit', county: 'Los Angeles', city: 'Los Angeles', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Port of San Diego Harbor Police', agencyType: 'Transit', county: 'San Diego', city: 'San Diego', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    // Probation
    { agencyName: 'Los Angeles County Probation Department', agencyType: 'Probation', county: 'Los Angeles', city: 'Los Angeles', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'San Diego County Probation Department', agencyType: 'Probation', county: 'San Diego', city: 'San Diego', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Orange County Probation Department', agencyType: 'Probation', county: 'Orange', city: 'Santa Ana', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    // Task Forces
    { agencyName: 'Los Angeles High Intensity Drug Trafficking Area (HIDTA)', agencyType: 'TaskForce', county: 'Los Angeles', city: 'Los Angeles', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Central Valley HIDTA', agencyType: 'TaskForce', county: 'Fresno', city: 'Fresno', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
    { agencyName: 'Northern California HIDTA', agencyType: 'TaskForce', county: 'Sacramento', city: 'Sacramento', recordsEmail: null, recordsRequestUrl: null, phoneNumber: null, website: null, policyUrl: null, lastRequestSent: null, lastResponse: null, notes: null },
  ];

  return seed.map((a, i) => ({
    ...a,
    id: `agency-${String(i + 1).padStart(4, '0')}`,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 15;

export function PolicyAcquisitionAgencies() {
  // State
  const [agencies] = useState<Agency[]>(() => generateSeedAgencies());
  const [search, setSearch] = useState('');
  const [countyFilter, setCountyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<AgencyType | ''>('');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Agency | null>(null);

  // Derived: distinct counties
  const counties = useMemo(() => {
    const set = new Set(agencies.map((a) => a.county));
    return Array.from(set).sort();
  }, [agencies]);

  // Derived: filtered agencies
  const filtered = useMemo(() => {
    let result = agencies;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.agencyName.toLowerCase().includes(q) ||
          (a.city && a.city.toLowerCase().includes(q)) ||
          a.county.toLowerCase().includes(q)
      );
    }
    if (countyFilter) {
      result = result.filter((a) => a.county === countyFilter);
    }
    if (typeFilter) {
      result = result.filter((a) => a.agencyType === typeFilter);
    }

    return result;
  }, [agencies, search, countyFilter, typeFilter]);

  // Derived: stats
  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    let withWebsite = 0;
    let withPolicyUrl = 0;
    let withEmail = 0;

    for (const a of agencies) {
      byType[a.agencyType] = (byType[a.agencyType] || 0) + 1;
      if (a.website) withWebsite++;
      if (a.policyUrl) withPolicyUrl++;
      if (a.recordsEmail) withEmail++;
    }

    return { total: agencies.length, byType, withWebsite, withPolicyUrl, withEmail };
  }, [agencies]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Reset page on filter change
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const handleCountyFilter = useCallback((val: string) => {
    setCountyFilter(val);
    setPage(1);
  }, []);

  const handleTypeFilter = useCallback((val: AgencyType | '') => {
    setTypeFilter(val);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setCountyFilter('');
    setTypeFilter('');
    setPage(1);
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agency Directory</h1>
          <p className="text-sm text-gray-500 mt-1">
            California law enforcement agency registry for policy acquisition
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DemoModeBadge />
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] text-white rounded-lg text-sm font-medium hover:bg-[#172E4A] transition-colors"
          >
            <Plus size={16} />
            Add Agency
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<Building2 size={28} className={TEXT_COLORS.info} />}
          value={stats.total}
          label="Total Agencies"
        />
        <StatCard
          icon={<Shield size={28} className={TEXT_COLORS.success} />}
          value={stats.byType['Police'] || 0}
          label="Police Depts"
        />
        <StatCard
          icon={<Shield size={28} className={TEXT_COLORS.accent} />}
          value={stats.byType['Sheriff'] || 0}
          label="Sheriff Offices"
        />
        <StatCard
          icon={<Globe size={28} className={TEXT_COLORS.info} />}
          value={stats.withWebsite}
          label="Have Website"
        />
        <StatCard
          icon={<FileText size={28} className={TEXT_COLORS.warning} />}
          value={stats.withPolicyUrl}
          label="Policy URL Known"
        />
        <StatCard
          icon={<Mail size={28} className={TEXT_COLORS.orange} />}
          value={stats.withEmail}
          label="Records Email"
        />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search agencies by name, city, or county..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
            />
          </div>

          {/* County Filter */}
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={countyFilter}
              onChange={(e) => handleCountyFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] appearance-none"
            >
              <option value="">All Counties</option>
              {counties.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => handleTypeFilter(e.target.value as AgencyType | '')}
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] appearance-none"
            >
              <option value="">All Types</option>
              {ALL_AGENCY_TYPES.map((t) => (
                <option key={t} value={t}>{AGENCY_TYPE_CONFIG[t].label}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {(search || countyFilter || typeFilter) && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        {/* Result count */}
        <div className="mt-3 text-xs text-gray-500">
          Showing {paginated.length} of {filtered.length} agencies
          {(search || countyFilter || typeFilter) && ` (filtered from ${stats.total} total)`}
        </div>
      </Card>

      {/* Agency Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Agency Name</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Type</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">County</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold hidden md:table-cell">Records Email</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold hidden lg:table-cell">Website</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold hidden lg:table-cell">Policy URL</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold hidden xl:table-cell">Last Request</th>
                <th className="text-right py-3 px-4 text-gray-600 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <Building2 size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No agencies match your filters</p>
                  </td>
                </tr>
              ) : (
                paginated.map((agency) => {
                  const typeConfig = AGENCY_TYPE_CONFIG[agency.agencyType] || AGENCY_TYPE_CONFIG.Police;
                  return (
                    <tr
                      key={agency.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      {/* Name + City */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{agency.agencyName}</div>
                        {agency.city && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <MapPin size={10} />
                            {agency.city}
                          </div>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.bg} ${typeConfig.text}`}>
                          {typeConfig.label}
                        </span>
                      </td>

                      {/* County */}
                      <td className="py-3 px-4 text-gray-700">{agency.county}</td>

                      {/* Records Email */}
                      <td className="py-3 px-4 hidden md:table-cell">
                        {agency.recordsEmail ? (
                          <a
                            href={`mailto:${agency.recordsEmail}`}
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Mail size={12} />
                            {agency.recordsEmail}
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Website */}
                      <td className="py-3 px-4 hidden lg:table-cell">
                        {agency.website ? (
                          <a
                            href={agency.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Globe size={12} />
                            Visit
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Policy URL */}
                      <td className="py-3 px-4 hidden lg:table-cell">
                        {agency.policyUrl ? (
                          <a
                            href={agency.policyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:underline flex items-center gap-1"
                          >
                            <FileText size={12} />
                            View
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Last Request */}
                      <td className="py-3 px-4 hidden xl:table-cell text-gray-500">
                        {agency.lastRequestSent || <span className="text-gray-300">—</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingAgency(agency)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit agency"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(agency)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete agency"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {(showAddModal || editingAgency) && (
        <AgencyFormModal
          agency={editingAgency}
          onClose={() => {
            setShowAddModal(false);
            setEditingAgency(null);
          }}
          onSave={() => {
            // In real implementation, this would call the API
            setShowAddModal(false);
            setEditingAgency(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          agency={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={() => {
            // In real implementation, this would call DELETE /api/policy/agencies/:id
            setShowDeleteConfirm(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add/Edit Agency Modal
// ---------------------------------------------------------------------------

interface AgencyFormModalProps {
  agency: Agency | null;
  onClose: () => void;
  onSave: (data: Partial<Agency>) => void;
}

function AgencyFormModal({ agency, onClose, onSave }: AgencyFormModalProps) {
  const isEdit = agency !== null;
  const [formData, setFormData] = useState({
    agencyName: agency?.agencyName || '',
    agencyType: agency?.agencyType || 'Police' as AgencyType,
    county: agency?.county || '',
    city: agency?.city || '',
    recordsEmail: agency?.recordsEmail || '',
    recordsRequestUrl: agency?.recordsRequestUrl || '',
    phoneNumber: agency?.phoneNumber || '',
    website: agency?.website || '',
    policyUrl: agency?.policyUrl || '',
    notes: agency?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Agency' : 'Add New Agency'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Agency Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agency Name *</label>
            <input
              type="text"
              required
              value={formData.agencyName}
              onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
              placeholder="e.g., Sacramento Police Department"
            />
          </div>

          {/* Type + County (side by side) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agency Type *</label>
              <select
                required
                value={formData.agencyType}
                onChange={(e) => setFormData({ ...formData, agencyType: e.target.value as AgencyType })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
              >
                {ALL_AGENCY_TYPES.map((t) => (
                  <option key={t} value={t}>{AGENCY_TYPE_CONFIG[t].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">County *</label>
              <input
                type="text"
                required
                value={formData.county}
                onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
                placeholder="e.g., Sacramento"
              />
            </div>
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
              placeholder="e.g., Sacramento"
            />
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1"><Mail size={12} /> Records Email</span>
              </label>
              <input
                type="email"
                value={formData.recordsEmail}
                onChange={(e) => setFormData({ ...formData, recordsEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
                placeholder="records@agency.gov"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1"><Phone size={12} /> Phone Number</span>
              </label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          {/* URLs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1"><Globe size={12} /> Website</span>
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
              placeholder="https://www.agency.gov"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1"><FileText size={12} /> Policy URL</span>
            </label>
            <input
              type="url"
              value={formData.policyUrl}
              onChange={(e) => setFormData({ ...formData, policyUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
              placeholder="https://www.agency.gov/policies"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1"><ExternalLink size={12} /> Records Request URL</span>
            </label>
            <input
              type="url"
              value={formData.recordsRequestUrl}
              onChange={(e) => setFormData({ ...formData, recordsRequestUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
              placeholder="https://www.agency.gov/records-request"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] resize-none"
              placeholder="Any relevant notes about this agency..."
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-[#1E3A5F] rounded-lg hover:bg-[#172E4A] transition-colors font-medium"
            >
              {isEdit ? 'Save Changes' : 'Add Agency'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

interface DeleteConfirmModalProps {
  agency: Agency;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmModal({ agency, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Agency</h2>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <span className="font-semibold">{agency.agencyName}</span>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
