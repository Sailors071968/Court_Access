// ============================================
// Court Access — Dashboard Router (Program 2A)
// Role-based default dashboard — capabilities are never restricted.
// ============================================

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { StaffDashboard } from './StaffDashboard';
import { getDefaultDashboardForRole } from '../../config/roleOnboarding';

export function DashboardRouter() {
  const { user } = useAuthStore();

  if (!user) return null;

  const defaultRole = user.defaultRole;
  const portalRoles = new Set(['criminal_defendant', 'family_member']);

  if (defaultRole && portalRoles.has(defaultRole)) {
    return <Navigate to="/client-portal" replace />;
  }

  if (user.role === 'defendant') {
    return <Navigate to="/client-portal" replace />;
  }

  if (defaultRole) {
    const dashboard = getDefaultDashboardForRole(defaultRole);
    if (dashboard === '/client-portal') {
      return <Navigate to="/client-portal" replace />;
    }
  }

  return <StaffDashboard />;
}
