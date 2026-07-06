// ============================================
// Court Access — Dashboard Router (Program 2A v17)
// ============================================

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { StaffDashboard } from './StaffDashboard';
import { getDefaultDashboardForRole, isPortalRole } from '../../config/roleOnboarding';

export function DashboardRouter() {
  const { user } = useAuthStore();

  if (!user) return null;

  if (user.role === 'defendant' || isPortalRole(user.defaultRole)) {
    const target = user.defaultRole
      ? getDefaultDashboardForRole(user.defaultRole)
      : '/client-portal';
    if (target === '/client-portal') {
      return <Navigate to="/client-portal" replace />;
    }
  }

  return <StaffDashboard />;
}
