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
              <input type="text" placeholder="Enter case title" className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Number</label>
              <input type="text" placeholder="Enter case number" className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
            <p className="text-sm text-gray-500">No team members assigned yet.</p>
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
