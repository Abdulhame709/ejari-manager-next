import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  Store,
  Users,
  FileText,
  Receipt,
  Wallet,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { canAccessPath } from "@/lib/access-control";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — إيجاري EJARI" },
      { name: "description", content: "نظرة شاملة على العقارات والعقود والفواتير والإيرادات." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}

function Dashboard() {
  const { role } = useAuth();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
  });

  const now = new Date();
  const monthName = new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(
    now,
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground mt-1">
            نظرة شاملة على أداء النظام — {monthName}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border rounded-lg px-3 py-2 shadow-card">
          <Clock className="h-3.5 w-3.5" />
          آخر تحديث الآن
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Store}
          label="المحلات النشطة"
          value={isLoading ? "—" : formatNumber(stats?.activeShops ?? 0)}
          subtitle={`من إجمالي ${formatNumber(stats?.totalShops ?? 0)}`}
          accent="primary"
        />
        <StatCard
          icon={Users}
          label="العملاء"
          value={isLoading ? "—" : formatNumber(stats?.totalCustomers ?? 0)}
          subtitle="عميل مسجّل"
          accent="info"
        />
        <StatCard
          icon={FileText}
          label="العقود السارية"
          value={isLoading ? "—" : formatNumber(stats?.activeContracts ?? 0)}
          subtitle="عقد ساري المفعول"
          accent="success"
        />
        <StatCard
          icon={Receipt}
          label="فواتير الشهر"
          value={isLoading ? "—" : formatNumber(stats?.thisMonthInvoices ?? 0)}
          subtitle="فاتورة مُصدرة"
          accent="warning"
        />
      </div>

      {/* Financial cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FinanceCard
          icon={TrendingUp}
          label="إيرادات الشهر الحالي"
          amount={stats?.thisMonthRevenue ?? 0}
          loading={isLoading}
          color="success"
        />
        <FinanceCard
          icon={Wallet}
          label="مُحصَّل هذا الشهر"
          amount={stats?.thisMonthCollected ?? 0}
          loading={isLoading}
          color="primary"
        />
        <FinanceCard
          icon={AlertTriangle}
          label="مبالغ مستحقة (غير مدفوعة)"
          amount={stats?.totalUnpaid ?? 0}
          loading={isLoading}
          color="destructive"
        />
      </div>

      {/* Alerts + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2 shadow-card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-foreground">التنبيهات والمتابعة</h2>
          </div>
          <div className="space-y-3">
            {canAccessPath(role, "/invoices") && (
              <AlertRow
                icon={AlertTriangle}
                tone="warning"
                title="فواتير غير مسددة"
                count={stats?.unpaidInvoicesCount ?? 0}
                description="فاتورة تنتظر الدفع"
                link="/invoices"
              />
            )}
            {canAccessPath(role, "/contracts") && (
              <AlertRow
                icon={Clock}
                tone="info"
                title="عقود قاربت على الانتهاء"
                count={stats?.expiringContracts ?? 0}
                description="عقد ينتهي خلال 30 يوماً"
                link="/contracts"
              />
            )}
            {canAccessPath(role, "/readings") && (
              <AlertRow
                icon={Gauge}
                tone="warning"
                title="قراءات عدادات مطلوبة"
                count={stats?.missingReadings ?? 0}
                description="وحدة نشطة لم تسجل لها قراءة هذا الشهر"
                link="/readings"
              />
            )}
            {canAccessPath(role, "/invoices") && (
              <AlertRow
                icon={CheckCircle2}
                tone="success"
                title="فواتير مدفوعة بالكامل"
                count={stats?.paidInvoicesCount ?? 0}
                description="فاتورة مُسددة"
                link="/invoices"
              />
            )}
            {!canAccessPath(role, "/invoices") && !canAccessPath(role, "/contracts") && (
              <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                لا توجد تنبيهات متاحة ضمن صلاحية حسابك.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6 shadow-card">
          <h2 className="text-lg font-bold text-foreground mb-5">إجراءات سريعة</h2>
          <div className="space-y-2">
            {canAccessPath(role, "/shops") && (
              <QuickLink to="/shops" icon={Store} label="إضافة وحدة جديدة" />
            )}
            {canAccessPath(role, "/customers") && (
              <QuickLink to="/customers" icon={Users} label="إضافة مستأجر" />
            )}
            {canAccessPath(role, "/contracts") && (
              <QuickLink to="/contracts" icon={FileText} label="عقد جديد" />
            )}
            {canAccessPath(role, "/readings") && (
              <QuickLink to="/readings" icon={Receipt} label="إدخال قراءات" />
            )}
            {canAccessPath(role, "/receipts") && (
              <QuickLink to="/receipts" icon={Wallet} label="سند قبض" />
            )}
            {role === "viewer" && (
              <QuickLink to="/reports" icon={TrendingUp} label="عرض التقارير" />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- Sub-components ----------

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle: string;
  accent: "primary" | "info" | "success" | "warning";
}

function StatCard({ icon: Icon, label, value, subtitle, accent }: StatCardProps) {
  const tones: Record<typeof accent, string> = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
  };
  return (
    <Card className="p-5 shadow-card hover:shadow-elegant transition-shadow gradient-card border-0">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function FinanceCard({
  icon: Icon,
  label,
  amount,
  loading,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  amount: number;
  loading: boolean;
  color: "primary" | "success" | "destructive";
}) {
  const ringClass = {
    primary: "from-primary/15 to-primary/5 border-primary/20",
    success: "from-success/15 to-success/5 border-success/20",
    destructive: "from-destructive/15 to-destructive/5 border-destructive/20",
  }[color];
  const iconClass = {
    primary: "bg-primary text-primary-foreground",
    success: "bg-success text-success-foreground",
    destructive: "bg-destructive text-destructive-foreground",
  }[color];
  return (
    <Card className={`p-5 shadow-card border bg-gradient-to-br ${ringClass}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums">
        {loading ? "—" : formatMoney(amount)}
      </div>
    </Card>
  );
}

function AlertRow({
  icon: Icon,
  tone,
  title,
  count,
  description,
  link,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "warning" | "info" | "success";
  title: string;
  count: number;
  description: string;
  link: string;
}) {
  const tones = {
    warning: "bg-warning/10 text-warning border-warning/20",
    info: "bg-info/10 text-info border-info/20",
    success: "bg-success/10 text-success border-success/20",
  };
  return (
    <Link
      to={link}
      className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-card ${tones[tone]}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/60">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="text-2xl font-bold tabular-nums">{formatNumber(count)}</div>
    </Link>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all group"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-foreground flex-1">{label}</span>
    </Link>
  );
}

// ---------- Data fetching ----------

interface DashboardStats {
  totalShops: number;
  activeShops: number;
  totalCustomers: number;
  activeContracts: number;
  thisMonthInvoices: number;
  thisMonthRevenue: number;
  thisMonthCollected: number;
  totalUnpaid: number;
  unpaidInvoicesCount: number;
  paidInvoicesCount: number;
  expiringContracts: number;
  missingReadings: number;
}

async function fetchStats(): Promise<DashboardStats> {
  const now = new Date();
  const { data, error } = await supabase.rpc("get_dashboard_stats", {
    p_month: now.getMonth() + 1,
    p_year: now.getFullYear(),
  });

  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("تعذر تحميل إحصاءات لوحة التحكم");
  }

  const payload = data as Record<string, unknown>;
  const numberValue = (key: string) => Number(payload[key] ?? 0);

  return {
    totalShops: numberValue("total_shops"),
    activeShops: numberValue("active_shops"),
    totalCustomers: numberValue("total_customers"),
    activeContracts: numberValue("active_contracts"),
    thisMonthInvoices: numberValue("this_month_invoices"),
    thisMonthRevenue: numberValue("this_month_revenue"),
    thisMonthCollected: numberValue("this_month_collected"),
    totalUnpaid: numberValue("total_unpaid"),
    unpaidInvoicesCount: numberValue("unpaid_invoices_count"),
    paidInvoicesCount: numberValue("paid_invoices_count"),
    expiringContracts: numberValue("expiring_contracts"),
    missingReadings: numberValue("missing_readings"),
  };
}
