// ============================================
// Court Access — Phase 71: Agency Intelligence Dashboard
// Staff state selector + agency management + review queue
// ============================================

import { useState } from 'react';
import {
  Building2, MapPin, Phone, Mail, Globe, Search,
  CheckCircle, XCircle, Clock, AlertTriangle, Plus,
  ChevronRight, Shield, Radio,
} from 'lucide-react';

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const AGENCY_TYPES: Record<string, string> = {
  state_police: 'State Police',
  county_sheriff: 'County Sheriff',
  city_police: 'City Police',
  regional_task_force: 'Regional Task Force',
  transit_police: 'Transit Police',
  university_police: 'University Police',
  other: 'Other',
};

interface Agency {
  id: string;
  agencyName: string;
  agencyType: string;
  state: string;
  county: string;
  city: string;
  address: string;
  phoneMain: string;
  phoneRecordsDivision: string;
  emailRecordsDivision: string;
  website: string;
  recordsRequestUrl: string;
  verificationStatus: string;
  dataSource: string;
  lastVerifiedAt: string | null;
}

export function AgencyIntelligencePage() {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'browse' | 'review' | 'add'>('browse');
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Mock data for development
  const mockAgencies: Agency[] = selectedState ? [
    {
      id: '1', agencyName: `${US_STATES[selectedState]} State Police`, agencyType: 'state_police',
      state: selectedState, county: '', city: '', address: '123 Capitol Ave',
      phoneMain: '(555) 100-0001', phoneRecordsDivision: '(555) 100-0002',
      emailRecordsDivision: 'records@statepolice.gov', website: 'https://statepolice.gov',
      recordsRequestUrl: 'https://statepolice.gov/records', verificationStatus: 'approved',
      dataSource: 'state_directory', lastVerifiedAt: '2025-12-01T00:00:00Z',
    },
    {
      id: '2', agencyName: `${US_STATES[selectedState]} County Sheriff`, agencyType: 'county_sheriff',
      state: selectedState, county: 'Central County', city: '',
      address: '456 Justice Blvd', phoneMain: '(555) 200-0001', phoneRecordsDivision: '',
      emailRecordsDivision: '', website: '', recordsRequestUrl: '',
      verificationStatus: 'pending', dataSource: 'county_directory', lastVerifiedAt: null,
    },
  ] : [];

  const displayAgencies = searchQuery
    ? mockAgencies.filter(a => a.agencyName.toLowerCase().includes(searchQuery.toLowerCase()))
    : mockAgencies;

  const pendingReview = mockAgencies.filter(a => a.verificationStatus === 'pending');

  const handleDiscovery = () => {
    if (!selectedState) return;
    setIsDiscovering(true);
    setTimeout(() => setIsDiscovering(false), 2000);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'needs_review': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const missingFields = (agency: Agency) => {
    const missing: string[] = [];
    if (!agency.phoneRecordsDivision) missing.push('Records Phone');
    if (!agency.emailRecordsDivision) missing.push('Records Email');
    if (!agency.recordsRequestUrl) missing.push('Records URL');
    return missing;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            Agency Intelligence Database
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Law enforcement agency records for public records requests
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'browse' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Browse
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'review' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Review Queue ({pendingReview.length})
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'add' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Add Agency
          </button>
        </div>
      </div>

      {/* State Selector (Phase 71) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Select State</h2>
        <div className="grid grid-cols-10 gap-1">
          {Object.entries(US_STATES).map(([abbr, name]) => (
            <button
              key={abbr}
              onClick={() => setSelectedState(abbr)}
              title={name}
              className={`px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                selectedState === abbr
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              {abbr}
            </button>
          ))}
        </div>
        {selectedState && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Selected: <strong>{US_STATES[selectedState]}</strong>
            </span>
            <button
              onClick={handleDiscovery}
              disabled={isDiscovering}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isDiscovering ? (
                <>
                  <Radio className="w-4 h-4 inline mr-1 animate-pulse" />
                  Discovering...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 inline mr-1" />
                  Discover Agencies
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {activeTab === 'browse' && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search agencies by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          {/* Agency List */}
          <div className="space-y-3">
            {displayAgencies.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {selectedState ? 'No agencies found. Run discovery or add manually.' : 'Select a state to view agencies.'}
                </p>
              </div>
            ) : (
              displayAgencies.map((agency) => {
                const missing = missingFields(agency);
                return (
                  <div key={agency.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {statusIcon(agency.verificationStatus)}
                          <h3 className="font-semibold text-gray-900">{agency.agencyName}</h3>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {AGENCY_TYPES[agency.agencyType] || agency.agencyType}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600">
                          {agency.address && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {agency.address}
                            </div>
                          )}
                          {agency.phoneMain && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {agency.phoneMain}
                            </div>
                          )}
                          {agency.emailRecordsDivision && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {agency.emailRecordsDivision}
                            </div>
                          )}
                          {agency.website && (
                            <div className="flex items-center gap-1">
                              <Globe className="w-3.5 h-3.5" />
                              <a href={agency.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">
                                {agency.website}
                              </a>
                            </div>
                          )}
                        </div>
                        {missing.length > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Missing: {missing.join(', ')}
                          </div>
                        )}
                      </div>
                      <button className="text-gray-400 hover:text-indigo-600">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {activeTab === 'review' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Review Queue</h2>
          <p className="text-sm text-gray-500">Agencies pending staff review. Approve, edit, or reject entries.</p>
          {pendingReview.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
              <p className="text-gray-500">No agencies pending review.</p>
            </div>
          ) : (
            pendingReview.map((agency) => (
              <div key={agency.id} className="bg-white border border-amber-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{agency.agencyName}</h3>
                    <p className="text-sm text-gray-500">
                      {agency.city && `${agency.city}, `}{agency.county && `${agency.county}, `}{agency.state}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Source: {agency.dataSource}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 text-sm bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100">
                      Approve
                    </button>
                    <button className="px-3 py-1 text-sm bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100">
                      Edit
                    </button>
                    <button className="px-3 py-1 text-sm bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100">
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Agency</h2>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agency Name *</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" placeholder="e.g. Los Angeles Police Department" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agency Type *</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                  {Object.entries(AGENCY_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                  <option value="">Select state</option>
                  {Object.entries(US_STATES).map(([abbr, name]) => (
                    <option key={abbr} value={abbr}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Main Phone</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Records Division Phone</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Records Division Email</label>
                <input type="email" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input type="url" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Records Request URL</label>
                <input type="url" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" placeholder="URL or source identifier" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button type="button" onClick={() => setActiveTab('browse')} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                Add Agency
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
