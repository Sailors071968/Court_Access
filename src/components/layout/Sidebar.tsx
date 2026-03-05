// ============================================
// Court Access — Sidebar Navigation
// ============================================

import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Search, Bell, Settings, Shield, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { ROLE_PERMISSIONS } from '../../constants';
import type { RolePermissions } from '../../types';
import { useState } from 'react';

const iconMap = {
  LayoutDashboard,
  Briefcase,
  Search,
  Bell,
  Settings,
  Shield,
};

const navItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/app/dashboard', icon: 'LayoutDashboard', permission: null },
  { id: 'cases', label: 'Cases', path: '/app/cases', icon: 'Briefcase', permission: null },
  { id: 'search', label: 'Search', path: '/app/search', icon: 'Search', permission: null },
  { id: 'notifications', label: 'Notifications & Alerts', path: '/app/notifications', icon: 'Bell', permission: null },
  { id: 'settings', label: 'Settings', path: '/app/settings', icon: 'Settings', permission: 'canViewSettings' as keyof RolePermissions },
  { id: 'admin', label: 'Admin', path: '/app/admin', icon: 'Shield', permission: 'canViewAdmin' as keyof RolePermissions },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const permissions = ROLE_PERMISSIONS[user.role];

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-slate-800 text-white flex flex-col z-40 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">CA</span>
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Court Access</h1>
          </div>
        )}
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium">{user.name.charAt(0)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.permission && !permissions[item.permission]) return null;

          const Icon = iconMap[item.icon as keyof typeof iconMap];
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/app/dashboard' && location.pathname.startsWith(item.path));

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-slate-700 space-y-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors w-full"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors w-full"
        >
          <LogOut size={20} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
