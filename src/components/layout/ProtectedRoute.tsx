// ============================================
// Court Access — Protected Route Wrapper
// ============================================

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { RolePermissions } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: keyof RolePermissions;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, hasPermission, sessionChecked } = useAuthStore();
  const location = useLocation();

  // Wait for session restoration to complete before making auth decisions
  if (!sessionChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">You do not have permission to access this page.</p>
          <p className="text-sm text-gray-400 mt-2">Contact your administrator for access.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
