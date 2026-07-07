// ============================================
// Court Access — Protected Route Wrapper
// Subscription gate: users without active/trial subscription are redirected to /pricing
// ============================================

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { RolePermissions } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: keyof RolePermissions;
  /** If true, skip subscription check (used for /pricing route itself) */
  skipSubscriptionCheck?: boolean;
}

export function ProtectedRoute({ children, requiredPermission, skipSubscriptionCheck }: ProtectedRouteProps) {
  const { isAuthenticated, hasPermission, subscriptionStatus } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Subscription gate: redirect to /pricing if no active or trial subscription
  // Skip this check for admin/staff roles (they manage the platform, not clients)
  const { user } = useAuthStore.getState();
  const isStaffOrAdmin = user?.role === 'admin' || user?.role === 'staff';
  if (!skipSubscriptionCheck && !isStaffOrAdmin && subscriptionStatus !== 'active' && subscriptionStatus !== 'trial' && subscriptionStatus !== 'trialing') {
    return <Navigate to="/pricing" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400">You do not have permission to access this page.</p>
          <p className="text-sm text-slate-400 mt-2">Contact your administrator for access.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
