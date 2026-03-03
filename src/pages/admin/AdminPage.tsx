// ============================================
// Court Access — Admin Dashboard
// ============================================

import { Card, StatCard } from '../../components/common/Card';
import { Users, Briefcase, FileText, Shield, Activity } from 'lucide-react';

export function AdminPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">System overview and management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users size={28} className="text-blue-500" />} value={24} label="Total Users" />
        <StatCard icon={<Briefcase size={28} className="text-amber-600" />} value={12} label="Active Cases" />
        <StatCard icon={<FileText size={28} className="text-green-500" />} value={156} label="Documents" />
        <StatCard icon={<Activity size={28} className="text-purple-500" />} value="99.8%" label="Uptime" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Users */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Users</h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">Manage</button>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Attorney Jane Doe', role: 'Attorney', status: 'active' },
              { name: 'Agent J. Doe', role: 'Investigator', status: 'active' },
              { name: 'Admin User', role: 'Admin', status: 'active' },
              { name: 'Staff Member', role: 'Staff', status: 'inactive' },
            ].map((user) => (
              <div key={user.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-medium">{user.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.role}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {user.status}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* System */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'API Server', status: 'Operational' },
              { label: 'AI Analysis Engine', status: 'Operational' },
              { label: 'Document Processing', status: 'Operational' },
              { label: 'Search Index', status: 'Operational' },
              { label: 'Notification Service', status: 'Operational' },
            ].map((service) => (
              <div key={service.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">{service.label}</span>
                <span className="text-xs text-green-600 font-medium">{service.status}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
