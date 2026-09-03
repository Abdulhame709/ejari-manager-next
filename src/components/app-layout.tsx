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
          <p className="mt-4 text-xs text-muted-foreground">
            إذا استمر الانتظار، يمكنك فتح صفحة الدخول مباشرة.
          </p>
          <a
            href="/login"
            className="mt-2 inline-flex rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            فتح صفحة الدخول
          </a>
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
      <main className="min-h-screen lg:mr-64">
        <div className="container mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
