import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Building2, FileText, Receipt, User, LogOut, Wallet } from "lucide-react";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const { fullName, signOut } = useAuth();
  const location = useLocation();

  const items = [
    { to: "/tenant/", label: "الرئيسية", icon: Building2 },
    { to: "/tenant/invoices", label: "فواتيري", icon: FileText },
    { to: "/tenant/payments", label: "طلبات الدفع", icon: Wallet },
    { to: "/tenant/statement", label: "كشف الحساب", icon: Receipt },
    { to: "/tenant/profile", label: "ملفي الشخصي", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 right-0 z-30 w-64 bg-[#0a1e3d] text-white flex flex-col">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg">
              <Building2 className="h-5 w-5 text-white" strokeWidth={2.4} />
            </div>
            <div className="leading-none">
              <div className="text-lg font-extrabold text-white">إيجاري</div>
              <div className="mt-1 text-[10px] font-bold tracking-[0.18em] text-cyan-200" dir="ltr">
                EJARI
              </div>
            </div>
          </div>
        </div>
        <div className="mx-3 mt-4 rounded-lg border border-cyan-300/10 bg-cyan-300/10 px-3 py-2 text-[11px] text-cyan-100">
          بوابة المستأجر
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === "/tenant/"
                ? location.pathname === "/tenant/" || location.pathname === "/tenant"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-white/10 text-white" : "text-blue-100/80 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="mb-3 rounded-lg bg-white/5 p-3">
            <div className="text-sm font-semibold">{fullName ?? "مستأجر"}</div>
            <div className="text-[11px] text-cyan-200">مسجل في إيجاري</div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-200 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="mr-64 min-h-screen">
        <div className="container mx-auto px-6 py-8 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
