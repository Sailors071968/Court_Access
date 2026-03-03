// ============================================
// Court Access — Dashboard Router
// Role-based dashboard rendering
// No duplicated layout trees — shared AppLayout wrapper
// ============================================

import { useAuthStore } from '../../stores/authStore';
import { StaffDashboard } from './StaffDashboard';
import { ClientDashboard } from './ClientDashboard';

export function DashboardRouter() {
  const { user } = useAuthStore();

  if (!user) return null;

  // Client role gets simplified transparency dashboard
  if (user.role === 'client') {
    return <ClientDashboard />;
  }

  // All staff roles (investigator, attorney, admin, staff) get operational dashboard
  return <StaffDashboard />;
}
