// ============================================================================
// CourtAccess — Client Portal Layout (Program 41 — dark design system)
// Dedicated /client-portal route for criminal defendants and authorized clients.
// ============================================================================

import { NavLink, Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, MessageSquare, FileText, FolderOpen,
  Clock, CheckSquare, CreditCard, Bell, Upload,
} from 'lucide-react';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { TrustBar } from '../../components/brand/TrustBar';

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
    <div className="min-h-screen bg-navy-800 text-slate-200 flex flex-col lg:flex-row">
      <aside className="lg:w-64 bg-navy-900 border-b lg:border-b-0 lg:border-r border-white/5 shrink-0">
        <div className="p-6 border-b border-white/5">
          <BrandLogo variant="light" size="sm" linkTo="/client-portal/dashboard" />
          <p className="text-xs text-slate-400 mt-3">Your case information</p>
        </div>
        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto" aria-label="Client portal navigation">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/client-portal/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border ${
                  isActive
                    ? 'bg-gold/10 text-gold-light border-gold/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white border-transparent'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
        <TrustBar />
      </div>
    </div>
  );
}

export function ClientPortalIndex() {
  return <Navigate to="/client-portal/dashboard" replace />;
}
