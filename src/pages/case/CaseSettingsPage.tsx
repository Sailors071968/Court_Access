// ============================================
// Court Access — Case Settings Tab
// ============================================

import { Card } from '../../components/common/Card';
import { Settings, Users, Shield } from 'lucide-react';

export function CaseSettingsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Case Settings</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Settings size={20} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900">General Settings</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Title</label>
              <input type="text" defaultValue="People v. Smith" className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Number</label>
              <input type="text" defaultValue="2024-CF-001234" className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option>Active</option>
                <option>Pending</option>
                <option>Closed</option>
                <option>Archived</option>
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Users size={20} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900">Team Members</h3>
          </div>
          <div className="space-y-3">
            {['Attorney Jane Doe', 'Agent J. Doe', 'Staff Member'].map((name) => (
              <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-medium">{name.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{name}</span>
                </div>
                <span className="text-xs text-gray-500 capitalize">Member</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900">Permissions</h3>
          </div>
          <p className="text-sm text-gray-500">Manage who can view and edit this case.</p>
          <button className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
            Manage Permissions
          </button>
        </Card>
      </div>
    </div>
  );
}
