import { Link, useLocation } from "@tanstack/react-router";
import {
  BadgeCheck,
  BarChart3,
  Building2,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { EjariLogo } from "@/components/ejari-logo";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth-context";
import { hasAnyRole, PAGE_ROLES } from "@/lib/access-control";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: readonly AppRole[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, roles: PAGE_ROLES.dashboard },
  {
    to: "/properties",
    label: "العقارات والمجمعات",
    icon: Building2,
    roles: PAGE_ROLES.properties,
  },
  { to: "/shops", label: "الوحدات", icon: Store, roles: PAGE_ROLES.shops },
  { to: "/customers", label: "المستأجرون", icon: Users, roles: PAGE_ROLES.customers },
  { to: "/contracts", label: "العقود", icon: FileText, roles: PAGE_ROLES.contracts },
  { to: "/readings", label: "قراءات العدادات", icon: Gauge, roles: PAGE_ROLES.readings },
  { to: "/invoices", label: "الفواتير", icon: Receipt, roles: PAGE_ROLES.invoices },
  {
    to: "/receipts",
    label: "المدفوعات وسندات القبض",
    icon: Wallet,
    roles: PAGE_ROLES.receipts,
  },
  {
    to: "/admin/payment-requests",
    label: "طلبات الدفع",
    icon: BadgeCheck,
    roles: PAGE_ROLES.paymentRequests,
  },
  { to: "/reports", label: "التقارير", icon: BarChart3, roles: PAGE_ROLES.reports },
  { to: "/users", label: "المستخدمون والطلبات", icon: ShieldCheck, roles: PAGE_ROLES.users },
  {
    to: "/permissions",
    label: "صلاحيات المستخدمين",
    icon: ShieldCheck,
    roles: PAGE_ROLES.permissions,
  },
  { to: "/settings", label: "الإعدادات", icon: Settings, roles: PAGE_ROLES.settings },
];

export function AppSidebar() {
  const { fullName, role, signOut, user } = useAuth();
  const location = useLocation();

  if (!user || !role) return null;

  const visibleItems = NAV_ITEMS.filter((item) => hasAnyRole(role, item.roles));

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-64 flex-col gradient-sidebar text-sidebar-foreground shadow-elegant">
      <div className="border-b border-sidebar-border px-5 py-5">
        <EjariLogo className="[&>div>div:first-child]:text-white [&>div>div:last-child]:text-cyan-200" />
      </div>
      <div className="mx-3 mt-4 flex items-center gap-2 rounded-lg border border-cyan-300/10 bg-cyan-300/10 px-3 py-2 text-[11px] text-cyan-100">
        <Building2 className="h-3.5 w-3.5" /> إدارة عقارات متكاملة
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-sidebar-border px-3 py-4">
        <Link
          to="/units"
          className="mb-3 flex items-center gap-2 rounded-lg bg-white/7 px-3 py-2 text-xs font-semibold text-sidebar-foreground/75 transition hover:bg-white/12"
        >
          <UserRound className="h-4 w-4 text-cyan-200" /> معاينة بوابة الزائر
        </Link>
        <div className="mb-3 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <div className="truncate text-sm font-semibold text-sidebar-foreground">
            {fullName ?? "مستخدم"}
          </div>
          <div className="mt-0.5 text-[11px] text-sidebar-foreground/70">{ROLE_LABELS[role]}</div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-destructive/20 hover:text-destructive-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
