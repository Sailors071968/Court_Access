// ============================================
// Court Access — Settings Page
// ============================================

import { Card } from '../components/common/Card';
import { useAuthStore } from '../stores/authStore';
import { buildInfo } from '../buildInfo';
import { User, Lock, Palette, Info } from 'lucide-react';

export function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <User size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input type="text" defaultValue={user?.name} className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" defaultValue={user?.email} className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input type="text" value={user?.role || ''} readOnly className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-500 capitalize" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" placeholder="(555) 000-0000" className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <button className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
          Save Changes
        </button>
      </Card>

      {/* Security */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Lock size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Security</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input type="password" className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input type="password" className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input type="password" className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
        <button className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
          Update Password
        </button>
      </Card>

      {/* Preferences */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Palette size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
        </div>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Enable AI insights</span>
            <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Show document analysis automatically</span>
            <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Compact sidebar</span>
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          </label>
        </div>
      </Card>

      {/* About / Build */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Info size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">About</h2>
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">Version</dt>
            <dd className="font-medium text-gray-900">{buildInfo.version}</dd>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">Environment</dt>
            <dd className="font-medium text-gray-900 capitalize">{buildInfo.mode}</dd>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">Git commit</dt>
            <dd className="font-mono text-gray-900">{buildInfo.commit}</dd>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">Branch</dt>
            <dd className="font-mono text-gray-900">{buildInfo.branch}</dd>
          </div>
          <div className="flex justify-between sm:col-span-2">
            <dt className="text-gray-500">Build timestamp</dt>
            <dd className="font-medium text-gray-900">{buildInfo.builtAt || 'UNKNOWN'}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
