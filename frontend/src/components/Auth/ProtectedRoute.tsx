import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { TenantRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** @deprecated Use requiredRoles instead */
  adminOnly?: boolean;
  /** Minimum role(s) required. User must have at least one of these roles. */
  requiredRoles?: TenantRole[];
  /** Require JWT auth (enterprise users only, no access code) */
  requireJwt?: boolean;
  /** Redirect path when access is denied (default: /home) */
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  adminOnly = false,
  requiredRoles,
  requireJwt = false,
  redirectTo = '/home',
}: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, authMethod, checkRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="border-2 border-black shadow-[4px_4px_0px_#000] px-6 py-4 flex items-center gap-3">
          <div className="w-3 h-3 bg-yellow-400 animate-pulse" />
          <span className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: "'Space Mono', monospace" }}>
            Loading...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Require JWT auth (enterprise pages like billing, org settings)
  if (requireJwt && authMethod !== 'jwt') {
    return <Navigate to={redirectTo} replace />;
  }

  // Role-based access: check if user has at least one of the required roles
  if (requiredRoles && requiredRoles.length > 0) {
    const hasAccess = requiredRoles.some(role => checkRole(role));
    if (!hasAccess) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  // Backward compat: adminOnly
  if (adminOnly && !isAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
