import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { PAGE_ROLES } from "@/lib/access-control";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  FileText,
  Download,
  Printer,
  TrendingUp,
  AlertTriangle,
  Users,
  Store,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";

type UnpaidInvoiceRow = {
  id: string;
  invoice_no: string;
  total_amount: number;
  paid_amount: number | null;
  remaining_amount: number | null;
  invoice_date: string;
  shops: { shop_code: string; shop_name: string } | null;
  customers: { full_name: string } | null;
};

type CustomerBalanceRow = {
  id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean | null;
  balance: number;
};

type ExpiringContractRow = {
  id: string;
  contract_no: string;
  end_date: string;
  monthly_rent: number;
  shops: { shop_code: string; shop_name: string } | null;
  customers: { full_name: string } | null;
};

type ConsumptionReadingRow = {
  id: string;
  elec_previous_reading: number | null;
  elec_current_reading: number | null;
  elec_consumption: number | null;
  water_previous_reading: number | null;
  water_current_reading: number | null;
  water_consumption: number | null;
  shops: { shop_code: string; shop_name: string } | null;
};

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [{ title: "التقارير — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={PAGE_ROLES.reports}>
      <ReportsPage />
    </RouteGuard>
  ),
});

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const REPORT_TYPES = [
  { id: "revenue", label: "الإيرادات الشهرية", icon: TrendingUp },
  { id: "unpaid", label: "الفواتير غير المسددة", icon: AlertTriangle },
  { id: "occupancy", label: "نسبة الإشغال والوحدات", icon: Store },
  { id: "customers", label: "قائمة العملاء وأرصدتهم", icon: Users },
  { id: "contracts_expiring", label: "العقود قاربت الانتهاء", icon: FileText },
  { id: "readings", label: "استهلاك الكهرباء والمياه", icon: BarChart3 },
];

function ReportsPage() {
  const now = new Date();
  const [reportId, setReportId] = useState("revenue");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            التقارير
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            تقارير مالية وتشغيلية من قاعدة البيانات
          </p>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label>نوع التقرير</Label>
              <Select value={reportId} onValueChange={setReportId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>الشهر</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARABIC_MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>السنة</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || now.getFullYear())}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 ml-1" />
              طباعة
            </Button>
            <Button size="sm" onClick={() => exportCSV(reportId, month, year)}>
              <Download className="h-4 w-4 ml-1" />
              تصدير CSV
            </Button>
          </div>
        </Card>

        <Card className="p-6 print:shadow-none">
          <ReportContent reportId={reportId} month={month} year={year} />
        </Card>
      </div>
    </AppLayout>
  );
}

function ReportContent({
  reportId,
  month,
  year,
}: {
  reportId: string;
  month: number;
  year: number;
}) {
  if (reportId === "revenue") return <RevenueReport month={month} year={year} />;
  if (reportId === "unpaid") return <UnpaidReport month={month} year={year} />;
  if (reportId === "occupancy") return <OccupancyReport />;
  if (reportId === "customers") return <CustomersReport />;
  if (reportId === "contracts_expiring") return <ExpiringContractsReport />;
  if (reportId === "readings") return <ReadingsReport month={month} year={year} />;
  return <p className="text-muted-foreground text-center py-12">اختر تقريراً لعرضه</p>;
}

// 1. Monthly revenue
function RevenueReport({ month, year }: { month: number; year: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-revenue", month, year],
    queryFn: async () => {
      const { data: invs } = await supabase
        .from("invoices")
        .select("total_amount, paid_amount, remaining_amount, payment_status")
        .eq("invoice_month", month)
        .eq("invoice_year", year)
        .neq("status", "cancelled");
      const { data: rcps } = await supabase
        .from("receipts")
        .select("amount")
        .gte("receipt_date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lte("receipt_date", `${year}-${String(month).padStart(2, "0")}-31`)
        .eq("is_active", true);
      const total = (invs ?? []).reduce((s, i) => s + (i.total_amount || 0), 0);
      const billed = invs?.length ?? 0;
      const receipts = (rcps ?? []).reduce((s, r) => s + (r.amount || 0), 0);
      const unpaid = (invs ?? []).reduce((s, i) => s + (i.remaining_amount || 0), 0);
      return { total, receipts, unpaid, billed, paid: total - unpaid };
    },
  });
  if (isLoading) return <Loader />;
  return (
    <div>
      <ReportHeader
        title="تقرير الإيرادات الشهرية"
        subtitle={`${ARABIC_MONTHS[month - 1]} ${year}`}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatBox label="إجمالي الفواتير" value={formatMoney(data?.total ?? 0)} />
        <StatBox label="المحصل" value={formatMoney(data?.paid ?? 0)} color="emerald" />
        <StatBox
          label="المدفوعات الفعلية (سندات)"
          value={formatMoney(data?.receipts ?? 0)}
          color="blue"
        />
        <StatBox label="المتبقي" value={formatMoney(data?.unpaid ?? 0)} color="rose" />
      </div>
      <p className="text-xs text-muted-foreground">
        عدد الفواتير المصدرة هذا الشهر: <strong>{data?.billed}</strong>
      </p>
    </div>
  );
}

// 2. Unpaid invoices
function UnpaidReport({ month, year }: { month: number; year: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-unpaid", month, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select(
          "id, invoice_no, total_amount, paid_amount, remaining_amount, invoice_date, shops(shop_code, shop_name), customers(full_name)",
        )
        .in("payment_status", ["unpaid", "partial"])
        .neq("status", "cancelled")
        .order("remaining_amount", { ascending: false });
      return data ?? [];
    },
  });
  if (isLoading) return <Loader />;
  const rows = (data ?? []) as unknown as UnpaidInvoiceRow[];
  const total = rows.reduce((s: number, i) => s + (i.remaining_amount || 0), 0);
  return (
    <div>
      <ReportHeader
        title="الفواتير غير المسددة"
        subtitle={`${(data ?? []).length} فاتورة — الإجمالي ${formatMoney(total)}`}
      />
      <ReportTable
        columns={[
          "رقم الفاتورة",
          "المستأجر",
          "الوحدة",
          "التاريخ",
          "الإجمالي",
          "المدفوع",
          "المتبقي",
        ]}
      >
        {rows.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="px-3 py-2 font-mono text-xs">{r.invoice_no}</td>
            <td className="px-3 py-2">{r.customers?.full_name}</td>
            <td className="px-3 py-2">
              {r.shops?.shop_code} — {r.shops?.shop_name}
            </td>
            <td className="px-3 py-2 text-xs">{r.invoice_date}</td>
            <td className="px-3 py-2 text-center tabular-nums">{formatMoney(r.total_amount)}</td>
            <td className="px-3 py-2 text-center tabular-nums text-emerald-600">
              {formatMoney(r.paid_amount)}
            </td>
            <td className="px-3 py-2 text-center tabular-nums font-bold text-rose-600">
              {formatMoney(r.remaining_amount)}
            </td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

// 3. Occupancy
function OccupancyReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-occupancy"],
    queryFn: async () => {
      const [{ count: total }, { count: active }, { count: rented }] = await Promise.all([
        supabase.from("shops").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "unpaid")
          .neq("status", "cancelled"),
      ]);
      return {
        totalUnits: total ?? 0,
        rentedUnits: active ?? 0,
        available: Math.max(0, (total ?? 0) - (active ?? 0)),
        occupancyRate: total ? Math.round(((active ?? 0) / (total ?? 1)) * 100) : 0,
      };
    },
  });
  if (isLoading) return <Loader />;
  return (
    <div>
      <ReportHeader title="تقرير الإشغال والحالة العامة" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="إجمالي الوحدات النشطة" value={String(data?.totalUnits ?? 0)} />
        <StatBox label="الوحدات المؤجرة" value={String(data?.rentedUnits ?? 0)} color="emerald" />
        <StatBox label="الوحدات المتاحة" value={String(data?.available ?? 0)} color="blue" />
        <StatBox label="نسبة الإشغال" value={`${data?.occupancyRate ?? 0}%`} color="amber" />
      </div>
    </div>
  );
}

// 4. Customers list with balances
function CustomersReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-customers"],
    queryFn: async () => {
      const { data: custs } = await supabase
        .from("customers")
        .select("id, full_name, phone, is_active")
        .eq("is_active", true)
        .order("full_name");
      // For each customer compute balance (sum unpaid invoices)
      const { data: invs } = await supabase
        .from("invoices")
        .select("customer_id, remaining_amount")
        .in("payment_status", ["unpaid", "partial"])
        .neq("status", "cancelled");
      const balanceMap: Record<string, number> = {};
      (invs ?? []).forEach((i: { customer_id: string; remaining_amount: number | null }) => {
        balanceMap[i.customer_id] = (balanceMap[i.customer_id] ?? 0) + (i.remaining_amount || 0);
      });
      return (custs ?? []).map((c) => ({
        ...c,
        balance: balanceMap[c.id] ?? 0,
      })) as CustomerBalanceRow[];
    },
  });
  if (isLoading) return <Loader />;
  return (
    <div>
      <ReportHeader title="قائمة العملاء والأرصدة" subtitle={`${(data ?? []).length} عميل نشط`} />
      <ReportTable columns={["الاسم", "الهاتف", "الحالة", "الرصيد المستحق"]}>
        {(data ?? []).map((r) => (
          <tr key={r.id} className="border-t">
            <td className="px-3 py-2 font-medium">{r.full_name}</td>
            <td className="px-3 py-2 text-xs" dir="ltr">
              {r.phone ?? "—"}
            </td>
            <td className="px-3 py-2">{r.is_active ? "نشط" : "معطل"}</td>
            <td
              className={`px-3 py-2 text-center tabular-nums font-bold ${r.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}
            >
              {formatMoney(r.balance)}
            </td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

// 5. Expiring contracts
function ExpiringContractsReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-expiring"],
    queryFn: async () => {
      const in90 = new Date();
      in90.setDate(in90.getDate() + 90);
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("contracts")
        .select(
          "id, contract_no, end_date, monthly_rent, shops(shop_code, shop_name), customers(full_name)",
        )
        .eq("status", "active")
        .lte("end_date", in90.toISOString().slice(0, 10))
        .gte("end_date", today)
        .order("end_date");
      return data ?? [];
    },
  });
  if (isLoading) return <Loader />;
  return (
    <div>
      <ReportHeader
        title="العقود قاربت الانتهاء (خلال 90 يوماً)"
        subtitle={`${(data ?? []).length} عقد`}
      />
      <ReportTable columns={["رقم العقد", "المستأجر", "الوحدة", "ينتهي في", "الإيجار الشهري"]}>
        {((data ?? []) as unknown as ExpiringContractRow[]).map((r) => {
          const days = Math.ceil(
            (new Date(r.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );
          return (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2 font-mono text-xs">{r.contract_no}</td>
              <td className="px-3 py-2">{r.customers?.full_name}</td>
              <td className="px-3 py-2">
                {r.shops?.shop_code} — {r.shops?.shop_name}
              </td>
              <td className="px-3 py-2 text-xs">
                {r.end_date}{" "}
                <span
                  className={`mr-2 text-[10px] ${days <= 30 ? "text-rose-600 font-bold" : "text-amber-600"}`}
                >
                  (بعد {days} يوم)
                </span>
              </td>
              <td className="px-3 py-2 text-center tabular-nums">{formatMoney(r.monthly_rent)}</td>
            </tr>
          );
        })}
      </ReportTable>
    </div>
  );
}

// 6. Meter readings / consumption
function ReadingsReport({ month, year }: { month: number; year: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-readings", month, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("meter_readings")
        .select(
          "id, elec_consumption, water_consumption, elec_current_reading, elec_previous_reading, water_current_reading, water_previous_reading, shops(shop_code, shop_name)",
        )
        .eq("reading_month", month)
        .eq("reading_year", year);
      const r = data ?? [];
      const totalElec = r.reduce((s, i) => s + (i.elec_consumption || 0), 0);
      const totalWater = r.reduce((s, i) => s + (i.water_consumption || 0), 0);
      return { readings: r, totalElec, totalWater, count: r.length };
    },
  });
  if (isLoading) return <Loader />;
  return (
    <div>
      <ReportHeader
        title="استهلاك العدادات"
        subtitle={`${ARABIC_MONTHS[month - 1]} ${year} — ${data?.count ?? 0} قراءة`}
      />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatBox
          label="إجمالي استهلاك الكهرباء"
          value={`${Math.round(data?.totalElec ?? 0).toLocaleString("ar-EG")} وحدة`}
          color="amber"
        />
        <StatBox
          label="إجمالي استهلاك المياه"
          value={`${Math.round(data?.totalWater ?? 0).toLocaleString("ar-EG")} وحدة`}
          color="blue"
        />
      </div>
      <ReportTable
        columns={[
          "الوحدة",
          "قراءة كهرباء سابقة",
          "حالية",
          "استهلاك",
          "قراءة ماء سابقة",
          "حالية",
          "استهلاك",
        ]}
      >
        {((data?.readings ?? []) as unknown as ConsumptionReadingRow[]).map((r) => (
          <tr key={r.id} className="border-t">
            <td className="px-3 py-2">
              {r.shops?.shop_code} — {r.shops?.shop_name}
            </td>
            <td className="px-3 py-2 text-center tabular-nums">
              {r.elec_previous_reading?.toLocaleString()}
            </td>
            <td className="px-3 py-2 text-center tabular-nums">
              {r.elec_current_reading?.toLocaleString()}
            </td>
            <td className="px-3 py-2 text-center tabular-nums font-bold text-amber-600">
              {(r.elec_consumption || 0).toLocaleString()}
            </td>
            <td className="px-3 py-2 text-center tabular-nums">
              {r.water_previous_reading?.toLocaleString()}
            </td>
            <td className="px-3 py-2 text-center tabular-nums">
              {r.water_current_reading?.toLocaleString()}
            </td>
            <td className="px-3 py-2 text-center tabular-nums font-bold text-blue-600">
              {(r.water_consumption || 0).toLocaleString()}
            </td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

// Shared components
function ReportHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 pb-4 border-b print:border-b-2">
      <h2 className="text-xl font-bold flex items-center gap-2">📊 {title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      <p className="text-xs text-muted-foreground mt-2">
        تقرير مطبوع من إيجاري EJARI — {format(new Date(), "yyyy/MM/dd HH:mm")}
      </p>
    </div>
  );
}
function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "emerald" | "rose" | "blue" | "amber";
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-500/10",
    rose: "text-rose-600 bg-rose-500/10",
    blue: "text-blue-600 bg-blue-500/10",
    amber: "text-amber-600 bg-amber-500/10",
  };
  return (
    <div className={`rounded-lg p-4 ${color ? colorMap[color] : "bg-primary/10 text-primary"}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
function ReportTable({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-right">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Loader() {
  return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function exportCSV(reportId: string, month: number, year: number) {
  const table = document.querySelector("main table") as HTMLTableElement | null;
  if (!table) {
    toast.error("لا يوجد جدول قابل للتصدير لهذا التقرير");
    return;
  }

  const rows = Array.from(table.rows).map((row) =>
    Array.from(row.cells).map((cell) => {
      const value = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
      return `"${value.replace(/"/g, '""')}"`;
    }),
  );
  const csv = "\uFEFF" + rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ejari-${reportId}-${year}-${String(month).padStart(2, "0")}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast.success("✅ تم تصدير التقرير بصيغة CSV");
}
