import { Navigate } from "@tanstack/react-router";
import { AccessDenied } from "@/components/access-denied";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { defaultPathForRole, hasAnyRole, isStaffRole } from "@/lib/access-control";

interface RouteGuardProps {
  children: React.ReactNode;
  /**
   * Roles allowed to view this page.
   * - undefined: any authenticated account with a resolved role.
   * - "staff": any of the five staff roles.
   * - a list: only the listed roles.
   */
  allowedRoles?: readonly AppRole[] | "staff";
  redirectTo?: "/login";
}

export function RouteGuard({ children, allowedRoles, redirectTo = "/login" }: RouteGuardProps) {
  const { user, role, loading, accessError } = useAuth();

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background text-foreground"
        dir="rtl"
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">جارٍ التحقق من الجلسة والصلاحيات...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to={redirectTo} />;
  if (!role) return <AccessDenied message={accessError} />;

  const isAllowed =
    !allowedRoles ||
    (allowedRoles === "staff" ? isStaffRole(role) : hasAnyRole(role, allowedRoles));

  if (!isAllowed) return <Navigate to={defaultPathForRole(role)} replace />;

  return <>{children}</>;
}
