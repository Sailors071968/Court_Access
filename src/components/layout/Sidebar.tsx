// ============================================
// Court Access — Sidebar Navigation
// Phase 230-235: Added admin sub-nav for CPRA,
// Discount Codes, Evidence Management
// ============================================

import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Search, Bell, Settings, Shield, LogOut,
  ChevronLeft, ChevronRight, ChevronDown,
  FileText, Tag, Upload, BarChart3, Globe, Activity, Server, BookOpen, CheckSquare, FileQuestion,
  ShieldCheck, LayoutList,
} from 'lucide-react';
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

interface NavChild {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: keyof RolePermissions;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  permission: keyof RolePermissions | null;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', permission: null },
  { id: 'cases', label: 'Cases', path: '/cases', icon: 'Briefcase', permission: null },
  { id: 'search', label: 'Search', path: '/search', icon: 'Search', permission: null },
  { id: 'notifications', label: 'Notifications & Alerts', path: '/notifications', icon: 'Bell', permission: null },
  { id: 'firm', label: 'Law Firm Platform', path: '/firm', icon: 'Settings', permission: 'canViewSettings' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'Settings', permission: 'canViewSettings' },
  // Evidence Management — separate top-level item for staff who lack canViewAdmin
  {
    id: 'evidence-mgmt-standalone',
    label: 'Evidence Management',
    path: '/dashboard/evidence-management',
    icon: 'Shield',
    permission: 'canViewEvidenceManagement',
  },
  // AI Evidence Requests — separate top-level item for non-admin users with canViewEvidence
  {
    id: 'evidence-requests-standalone',
    label: 'AI Evidence Requests',
    path: '/dashboard/evidence-requests',
    icon: 'Shield',
    permission: 'canViewEvidence',
  },
  {
    id: 'admin',
    label: 'Admin',
    path: '/admin',
    icon: 'Shield',
    permission: 'canViewAdmin',
    children: [
      { id: 'admin-dashboard', label: 'Admin Dashboard', path: '/admin', icon: <LayoutList size={16} />, permission: 'canViewAdmin' },
      { id: 'gold-standard', label: 'Gold Standard Certification', path: '/admin/gold-standard', icon: <ShieldCheck size={16} />, permission: 'canViewAdmin' },
      { id: 'operations', label: 'Production Operations', path: '/admin/operations', icon: <Activity size={16} />, permission: 'canViewAdmin' },
      { id: 'cpra', label: 'CPRA Campaigns', path: '/dashboard/cpra', icon: <Globe size={16} /> },
      { id: 'policy-ops', label: 'Policy Operations', path: '/dashboard/policy-operations', icon: <FileText size={16} /> },
      { id: 'discount-codes', label: 'Discount Codes', path: '/dashboard/discount-codes', icon: <Tag size={16} /> },
      { id: 'evidence-mgmt', label: 'Evidence Management', path: '/dashboard/evidence-management', icon: <Upload size={16} />, permission: 'canViewEvidenceManagement' },
      { id: 'system-health', label: 'System Health', path: '/dashboard/system-health', icon: <BarChart3 size={16} /> },
      { id: 'evidence-processing', label: 'Evidence Processing', path: '/dashboard/evidence-processing', icon: <Activity size={16} /> },
      { id: 'worker-queues', label: 'Worker Queues', path: '/dashboard/system/workers', icon: <Server size={16} /> },
      { id: 'policy-registry', label: 'Policy Topic Registry', path: '/dashboard/policy-topic-registry', icon: <BookOpen size={16} /> },
      { id: 'beta-verification', label: 'Beta Verification', path: '/dashboard/beta-verification', icon: <CheckSquare size={16} /> },
      { id: 'policy-matrix', label: 'Policy Matrix', path: '/dashboard/policy-matrix', icon: <BarChart3 size={16} /> },
      { id: 'cpra-timeline', label: 'CPRA Timeline', path: '/dashboard/cpra-timeline', icon: <Globe size={16} /> },
      { id: 'cpra-autonomous', label: 'CPRA Autonomous', path: '/dashboard/cpra-autonomous', icon: <Globe size={16} /> },
      { id: 'evidence-requests', label: 'AI Evidence Requests', path: '/dashboard/evidence-requests', icon: <FileQuestion size={16} />, permission: 'canViewEvidence' },
    ],
  },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ admin: true });

  if (!user) return null;

  const permissions = ROLE_PERMISSIONS[user.role];

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
          // Hide standalone evidence-mgmt for admins (they see it under Admin sub-nav)
          if (item.id === 'evidence-mgmt-standalone' && permissions.canViewAdmin) return null;
          if (item.id === 'evidence-requests-standalone' && permissions.canViewAdmin) return null;

          const Icon = iconMap[item.icon as keyof typeof iconMap];
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedSections[item.id] ?? false;
          // Filter children by permission
          const visibleChildren = item.children?.filter((c) => !c.permission || permissions[c.permission]);
          const childActive = hasChildren && visibleChildren?.some((c) => location.pathname === c.path);

          return (
            <div key={item.id}>
              {hasChildren ? (
                <>
                  <button
                    onClick={() => toggleSection(item.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                      isActive || childActive
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={20} className="flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          size={14}
                          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </>
                    )}
                  </button>
                  {!collapsed && isExpanded && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-700 pl-3">
                      {visibleChildren?.map((child) => {
                        const isChildActive = location.pathname === child.path;
                        return (
                          <NavLink
                            key={child.id}
                            to={child.path}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                              isChildActive
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                            }`}
                          >
                            <span className="flex-shrink-0">{child.icon}</span>
                            <span>{child.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <NavLink
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
              )}
            </div>
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
