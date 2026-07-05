// ============================================================================
// Sprint 1 — Client Portal Layout
// Dedicated /client-portal route for criminal defendants and authorized clients.
// ============================================================================

import { NavLink, Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, MessageSquare, FileText, FolderOpen,
  Clock, CheckSquare, CreditCard, Bell, Upload,
} from 'lucide-react';

const NAV = [
  { to: '/client-portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/client-portal/court-dates', label: 'Court Dates', icon: Calendar },
  { to: '/client-portal/messages', label: 'Messages', icon: MessageSquare },
  { to: '/client-portal/documents', label: 'Documents', icon: FileText },
  { to: '/client-portal/evidence', label: 'Evidence', icon: FolderOpen },
  { to: '/client-portal/timeline', label: 'Timeline', icon: Clock },
  { to: '/client-portal/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/client-portal/billing', label: 'Billing', icon: CreditCard },
  { to: '/client-portal/notifications', label: 'Notifications', icon: Bell },
  { to: '/client-portal/uploads', label: 'Uploads', icon: Upload },
];

export function ClientPortalLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <aside className="lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-gray-200 shrink-0">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Client Portal</h1>
          <p className="text-xs text-gray-500 mt-1">Your case information</p>
        </div>
        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/client-portal/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export function ClientPortalIndex() {
  return <Navigate to="/client-portal/dashboard" replace />;
}
