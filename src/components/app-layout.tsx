import type { ReactNode } from "react";
import { Navigate, useLocation } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { AccessDenied } from "@/components/access-denied";
import { useAuth } from "@/lib/auth-context";
import { canAccessPath, defaultPathForRole, isStaffRole } from "@/lib/access-control";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, role, loading, accessError } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background text-foreground"
        dir="rtl"
      >
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">جارٍ التحقق من الجلسة والصلاحيات...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (!role) return <AccessDenied message={accessError} />;
  if (!isStaffRole(role)) return <Navigate to={defaultPathForRole(role)} replace />;
  if (!canAccessPath(role, location.pathname)) {
    return <Navigate to={defaultPathForRole(role)} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="mr-64 min-h-screen">
        <div className="container mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
