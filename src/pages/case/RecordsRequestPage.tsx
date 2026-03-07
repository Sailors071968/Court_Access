// ============================================
// Court Access — Phases 76-81: Public Records Request System
// Request tracking, templates, timeline integration
// ============================================

import { useState } from 'react';
import {
  FileText, Send, Clock, CheckCircle, XCircle, AlertTriangle,
  Building2, Calendar, Hash, Eye, Plus, Filter, FileSearch,
  Info,
} from 'lucide-react';

const REQUEST_TYPES: Record<string, string> = {
  public_records: 'Public Records Request',
  body_camera: 'Body Camera Request',
  dispatch_logs: 'Dispatch Logs Request',
  policy_manual: 'Policy Manual Request',
  incident_report: 'Incident Report Request',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  submitted: { label: 'Submitted', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Send },
  acknowledged: { label: 'Acknowledged', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: CheckCircle },
  fulfilled: { label: 'Fulfilled', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle },
  partial_response: { label: 'Partial Response', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertTriangle },
  denied: { label: 'Denied', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
  no_response: { label: 'No Response', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: Clock },
};

interface RecordsRequest {
  id: string;
  agencyName: string;
  requestType: string;
  submissionDate: string;
  status: string;
  deliveryMethod: string;
  responseReceivedDate: string | null;
  requestDocumentHash: string | null;
  responseHash: string | null;
  staffApproved: boolean;
  notes: string;
}

const AI_DISCLAIMER = 'This system collects, preserves, compares, and references structured information only. It does not rank agencies, score officers, assign probabilities, infer intent, or generate accusations. All data should be independently verified.';

export function RecordsRequestPage() {
  const [requests] = useState<RecordsRequest[]>([
    {
      id: '1', agencyName: 'Los Angeles Police Department', requestType: 'body_camera',
      submissionDate: '2025-01-15T10:00:00Z', status: 'submitted', deliveryMethod: 'email',
      responseReceivedDate: null, requestDocumentHash: 'a1b2c3d4e5f6...', responseHash: null,
      staffApproved: true, notes: 'Incident #2024-12345',
    },
    {
      id: '2', agencyName: 'LA County Sheriff', requestType: 'dispatch_logs',
      submissionDate: '2025-01-10T14:00:00Z', status: 'fulfilled', deliveryMethod: 'portal',
      responseReceivedDate: '2025-01-25T09:00:00Z', requestDocumentHash: 'f6e5d4c3b2a1...',
      responseHash: '1234abcd5678...', staffApproved: true, notes: '',
    },
    {
      id: '3', agencyName: 'California Highway Patrol', requestType: 'incident_report',
      submissionDate: '2025-01-20T08:00:00Z', status: 'no_response', deliveryMethod: 'mail',
      responseReceivedDate: null, requestDocumentHash: 'abcdef123456...', responseHash: null,
      staffApproved: false, notes: 'Follow up needed',
    },
  ]);
  const [activeTab, setActiveTab] = useState<'requests' | 'templates' | 'new'>('requests');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  const filteredRequests = requests.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterType && r.requestType !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-indigo-600" />
            Public Records Requests
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Track FOIA and public records requests to law enforcement agencies
          </p>
        </div>
        <button
          onClick={() => setActiveTab('new')}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {/* Disclaimer Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">{AI_DISCLAIMER}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'requests' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'templates' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Templates
        </button>
      </div>

      {activeTab === 'requests' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Filters:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1"
            >
              <option value="">All Types</option>
              {Object.entries(REQUEST_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Request List */}
          <div className="space-y-3">
            {filteredRequests.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No records requests found.</p>
                <p className="text-sm text-gray-400 mt-1">Create a new request to get started.</p>
              </div>
            ) : (
              filteredRequests.map((request) => {
                const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.submitted;
                const StatusIcon = statusConfig.icon;
                return (
                  <div key={request.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold text-gray-900">{request.agencyName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded border ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3 inline mr-1" />
                            {statusConfig.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {REQUEST_TYPES[request.requestType] || request.requestType}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(request.submissionDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Send className="w-3.5 h-3.5" />
                            {request.deliveryMethod}
                          </span>
                        </div>
                        {/* Document hashes (Phase 78/79) */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          {request.requestDocumentHash && (
                            <span className="flex items-center gap-1" title="Request document hash">
                              <Hash className="w-3 h-3" />
                              Request: {request.requestDocumentHash}
                            </span>
                          )}
                          {request.responseHash && (
                            <span className="flex items-center gap-1" title="Response document hash">
                              <Hash className="w-3 h-3" />
                              Response: {request.responseHash}
                            </span>
                          )}
                        </div>
                        {request.notes && (
                          <p className="text-xs text-gray-500 mt-1">Note: {request.notes}</p>
                        )}
                        {!request.staffApproved && (
                          <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Pending staff approval
                          </div>
                        )}
                      </div>
                      <button className="text-sm text-indigo-600 hover:text-indigo-800">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Request Templates</h3>
            <button className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100">
              Seed Default Templates
            </button>
          </div>
          {Object.entries(REQUEST_TYPES).map(([key, label]) => (
            <div key={key} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{label}</h4>
                <p className="text-sm text-gray-500 mt-0.5">
                  Merge fields: {'{{agency_name}}'}, {'{{records_email}}'}, {'{{records_phone}}'}, {'{{county}}'}, {'{{state}}'}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-sm bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100">
                  Edit
                </button>
                <button className="px-3 py-1 text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100">
                  Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'new' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Records Request</h3>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agency *</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                  <option value="">Select agency</option>
                  <option value="1">Los Angeles Police Department</option>
                  <option value="2">LA County Sheriff</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Request Type *</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                  {Object.entries(REQUEST_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Method</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                  <option value="email">Email</option>
                  <option value="mail">Mail</option>
                  <option value="portal">Agency Portal</option>
                  <option value="fax">Fax</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                  <option value="">No template</option>
                  {Object.entries(REQUEST_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Request Content</label>
              <textarea
                rows={8}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                placeholder="Enter or paste the full text of your records request..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" placeholder="Internal notes" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button type="button" onClick={() => setActiveTab('requests')} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                Create Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
