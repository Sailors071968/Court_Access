// ============================================
// Court Access — Phases 63-69: Email System Admin Dashboard
// Verified emails, sandbox status, email logs, queue
// ============================================

import { useState } from 'react';
import {
  Mail, CheckCircle, Clock, XCircle, AlertTriangle,
  Send, Shield, Activity, Plus,
} from 'lucide-react';

interface VerifiedEmail {
  id: string;
  emailAddress: string;
  verificationStatus: string;
  verifiedAt: string | null;
}

interface EmailLogEntry {
  id: string;
  recipient: string;
  emailType: string;
  subject: string;
  deliveryStatus: string;
  errorMessage: string | null;
  createdAt: string;
}

export function EmailAdminPage() {
  const [activeTab, setActiveTab] = useState<'status' | 'verified' | 'logs'>('status');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [sandboxMode] = useState(true);

  const [verifiedEmails] = useState<VerifiedEmail[]>([
    { id: '1', emailAddress: 'attorney@courtaccess.com', verificationStatus: 'verified', verifiedAt: '2025-01-10T00:00:00Z' },
    { id: '2', emailAddress: 'admin@courtaccess.com', verificationStatus: 'verified', verifiedAt: '2025-01-10T00:00:00Z' },
    { id: '3', emailAddress: 'newuser@example.com', verificationStatus: 'pending', verifiedAt: null },
  ]);

  const [emailLogs] = useState<EmailLogEntry[]>([
    { id: '1', recipient: 'attorney@courtaccess.com', emailType: 'invite', subject: 'Court Access — Beta Invite', deliveryStatus: 'sent', errorMessage: null, createdAt: '2025-01-15T10:00:00Z' },
    { id: '2', recipient: 'newuser@example.com', emailType: 'invite', subject: 'Court Access — Beta Invite', deliveryStatus: 'blocked', errorMessage: 'Recipient not verified (SES sandbox mode)', createdAt: '2025-01-15T11:00:00Z' },
    { id: '3', recipient: 'admin@courtaccess.com', emailType: 'notification', subject: 'New agency discovered', deliveryStatus: 'sent', errorMessage: null, createdAt: '2025-01-14T09:00:00Z' },
  ]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'verified':
      case 'sent':
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'blocked':
        return <Shield className="w-4 h-4 text-red-500" />;
      case 'failed':
      case 'bounced':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-indigo-600" />
            Email System
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            SES sandbox compliance, verified emails, and delivery logs
          </p>
        </div>
      </div>

      {/* Sandbox Status Banner */}
      <div className={`rounded-lg p-4 flex items-center justify-between ${
        sandboxMode ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'
      }`}>
        <div className="flex items-center gap-2">
          <Shield className={`w-5 h-5 ${sandboxMode ? 'text-amber-600' : 'text-green-600'}`} />
          <div>
            <p className={`font-semibold ${sandboxMode ? 'text-amber-800' : 'text-green-800'}`}>
              {sandboxMode ? 'SES Sandbox Mode Active' : 'Production Mode'}
            </p>
            <p className={`text-sm ${sandboxMode ? 'text-amber-600' : 'text-green-600'}`}>
              {sandboxMode
                ? 'Emails can only be sent to verified recipients. Set EMAIL_SANDBOX_MODE=false when SES production approved.'
                : 'All email restrictions removed. SES production access active.'
              }
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono text-gray-500">
            EMAIL_SANDBOX_MODE={sandboxMode ? 'true' : 'false'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Verified: {verifiedEmails.filter(e => e.verificationStatus === 'verified').length} |
            Pending: {verifiedEmails.filter(e => e.verificationStatus === 'pending').length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'status' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          <Activity className="w-4 h-4 inline mr-1" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('verified')}
          className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'verified' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          <CheckCircle className="w-4 h-4 inline mr-1" />
          Verified Emails ({verifiedEmails.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'logs' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          <Send className="w-4 h-4 inline mr-1" />
          Email Logs ({emailLogs.length})
        </button>
      </div>

      {activeTab === 'status' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold text-gray-900">Verified</h3>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {verifiedEmails.filter(e => e.verificationStatus === 'verified').length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Emails can receive messages</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-gray-900">Pending</h3>
            </div>
            <p className="text-3xl font-bold text-amber-600">
              {verifiedEmails.filter(e => e.verificationStatus === 'pending').length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Awaiting verification</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-5 h-5 text-indigo-500" />
              <h3 className="font-semibold text-gray-900">Sent</h3>
            </div>
            <p className="text-3xl font-bold text-indigo-600">
              {emailLogs.filter(e => e.deliveryStatus === 'sent').length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Emails delivered</p>
          </div>
        </div>
      )}

      {activeTab === 'verified' && (
        <div className="space-y-4">
          {/* Add verification form */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Request Email Verification</h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={verificationEmail}
                onChange={(e) => setVerificationEmail(e.target.value)}
                placeholder="Enter email to verify..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm"
              />
              <button className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1">
                <Plus className="w-4 h-4" />
                Verify
              </button>
            </div>
          </div>

          {/* Verified emails list */}
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {verifiedEmails.map((email) => (
              <div key={email.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {statusIcon(email.verificationStatus)}
                  <span className="text-sm font-medium text-gray-900">{email.emailAddress}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    email.verificationStatus === 'verified' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {email.verificationStatus}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {email.verifiedAt ? `Verified ${new Date(email.verifiedAt).toLocaleDateString()}` : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {emailLogs.map((log) => (
            <div key={log.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {statusIcon(log.deliveryStatus)}
                  <span className="text-sm font-medium text-gray-900">{log.recipient}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{log.emailType}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{log.subject}</p>
              {log.errorMessage && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {log.errorMessage}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
