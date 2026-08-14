import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Receipt,
  Search,
  Plus,
  Trash2,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Zap,
  Droplets,
  FileText,
  Calendar,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { canDeleteOperationalRecords, PAGE_ROLES } from "@/lib/access-control";
import { format } from "date-fns";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";
import { sanitizeSearchTerm } from "@/lib/utils";

export const Route = createFileRoute("/invoices")({
  head: () => ({
    meta: [{ title: "الفواتير — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={PAGE_ROLES.invoices}>
      <InvoicesPage />
    </RouteGuard>
  ),
});

interface Invoice {
  id: string;
  invoice_no: string;
  shop_id: string;
  customer_id: string;
  contract_id: string;
  invoice_month: number;
  invoice_year: number;
  invoice_date: string;
  due_date?: string | null;
  rent_amount: number;
  holiday_increase: number;
  elec_amount: number;
  water_amount: number;
  previous_balance: number;
  additional_charges: number;
  discount_amount?: number;
  tax_amount?: number;
  total_amount: number;
  elec_prev_reading: number;
  elec_curr_reading: number;
  elec_consumption: number;
  elec_unit_price: number;
  water_prev_reading: number;
  water_curr_reading: number;
  water_consumption: number;
  water_unit_price: number;
  payment_status: "unpaid" | "paid" | "partial";
  paid_amount: number;
  remaining_amount: number;
  notes?: string | null;
  shops?: { shop_code: string; shop_name: string };
  customers?: { full_name: string; phone: string | null };
  contracts?: { contract_no: string };
}

interface Shop {
  id: string;
  shop_code: string;
  shop_name: string;
  elec_meter_type: number;
  water_meter_type: number;
  fixed_elec_amount: number;
  fixed_water_amount: number;
}

interface Contract {
  id: string;
  contract_no: string;
  shop_id: string;
  customer_id: string;
  monthly_rent: number;
  holiday_increase: number;
  start_date: string;
  end_date: string;
  customers: { full_name: string };
  shops: { shop_code: string; shop_name: string };
}

interface MeterType {
  id: number;
  type_name: string;
  category: "electricity" | "water";
  price_per_unit: number;
  is_fixed_fee: boolean;
  fixed_fee_amount: number;
}

interface Reading {
  shop_id: string;
  elec_current_reading: number;
  elec_previous_reading: number;
  elec_consumption: number;
  water_current_reading: number;
  water_previous_reading: number;
  water_consumption: number;
}

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
const PAGE_SIZE = 30;

function InvoicesPage() {
  const { role } = useAuth();
  const canDelete = canDeleteOperationalRecords(role);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "partial" | "paid">("all");
  const [page, setPage] = useState(0);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailsInv, setDetailsInv] = useState<Invoice | null>(null);
  const [deleteInv, setDeleteInv] = useState<Invoice | null>(null);

  const qc = useQueryClient();

  // Settings for prices
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("settings").select("*").eq("id", 1).single()).data,
  });

  const { data: meterTypes = [] } = useQuery<MeterType[]>({
    queryKey: ["meter-types"],
    queryFn: async () =>
      (await supabase.from("meter_types").select("*").eq("is_active", true)).data ?? [],
  });

  // Invoices for selected month
  const { data, isLoading } = useQuery({
    queryKey: ["invoices", month, year, search, statusFilter, page],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select(
          "*, shops(shop_code, shop_name), customers(full_name, phone), contracts(contract_no)",
          { count: "exact" },
        )
        .eq("invoice_month", month)
        .eq("invoice_year", year);
      if (search.trim()) {
        q = q.or(
          `invoice_no.ilike.%${sanitizeSearchTerm(search)}%,customers.full_name.ilike.%${sanitizeSearchTerm(search)}%,shops.shop_code.ilike.%${sanitizeSearchTerm(search)}%`,
        );
      }
      if (statusFilter !== "all") q = q.eq("payment_status", statusFilter);
      q = q.order("invoice_no").range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { invoices: (data ?? []) as unknown as Invoice[], total: count ?? 0 };
    },
  });

  const invoices = useMemo(() => data?.invoices ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Stats
  const stats = useMemo(() => {
    let totalAmt = 0,
      paidAmt = 0,
      unpaidAmt = 0;
    const count = invoices.length;
    for (const inv of invoices) {
      totalAmt += inv.total_amount;
      paidAmt += inv.paid_amount;
      unpaidAmt += inv.remaining_amount;
    }
    return { totalAmt, paidAmt, unpaidAmt, count };
  }, [invoices]);

  // Generate bulk invoices mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      // Get active contracts for the month
      const monthStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
      const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);
      const { data: contracts, error: cerr } = await supabase
        .from("contracts")
        .select(
          "*, customers(full_name), shops(shop_code, shop_name, elec_meter_type, water_meter_type, fixed_elec_amount, fixed_water_amount)",
        )
        .eq("status", "active")
        .lte("start_date", monthEnd)
        .gte("end_date", monthStart);
      if (cerr) throw cerr;

      // Existing invoices this month (to skip)
      const { data: existing } = await supabase
        .from("invoices")
        .select("shop_id")
        .eq("invoice_month", month)
        .eq("invoice_year", year);
      const existingShopIds = new Set((existing ?? []).map((e: { shop_id: string }) => e.shop_id));

      // Get readings for this month
      const { data: readings } = await supabase
        .from("meter_readings")
        .select("*")
        .eq("reading_month", month)
        .eq("reading_year", year);
      const readingsMap: Record<string, Reading> = {};
      (readings ?? []).forEach((r) => {
        readingsMap[r.shop_id] = r as unknown as Reading;
      });

      // Get previous balances: remaining from last unpaid invoice prior to this month
      const { data: prevInvs } = await supabase
        .from("invoices")
        .select("shop_id, remaining_amount")
        .lt("invoice_year", year)
        .or(`invoice_year.eq.${year},invoice_month.lt.${month}`)
        .neq("payment_status", "paid");

      const prevBalMap: Record<string, number> = {};
      (prevInvs ?? []).forEach((inv: { shop_id: string; remaining_amount: number | null }) => {
        prevBalMap[inv.shop_id] = (prevBalMap[inv.shop_id] ?? 0) + (inv.remaining_amount ?? 0);
      });

      const toInsert: Database["public"]["Tables"]["invoices"]["Insert"][] = [];
      let seq = await nextInvoiceSeq(month, year);

      type ContractWithShop = Contract & { shops: Shop };
      for (const c of (contracts ?? []) as unknown as ContractWithShop[]) {
        if (existingShopIds.has(c.shop_id)) continue;
        const shop: Shop = c.shops;
        const r = readingsMap[c.shop_id];
        const elecMt = meterTypes.find((m) => m.id === shop.elec_meter_type);
        const waterMt = meterTypes.find((m) => m.id === shop.water_meter_type);

        let elecAmt = 0,
          elecCons = 0,
          elecPrice = 0,
          ep = 0,
          ec = 0;
        let waterAmt = 0,
          wCons = 0,
          wPrice = 0,
          wp = 0,
          wc = 0;

        if (elecMt) {
          if (elecMt.is_fixed_fee) {
            elecAmt = shop.fixed_elec_amount || elecMt.fixed_fee_amount;
          } else {
            elecPrice = elecMt.price_per_unit;
            elecCons = r?.elec_consumption ?? 0;
            elecAmt = elecCons * elecPrice;
          }
          ep = r?.elec_previous_reading ?? 0;
          ec = r?.elec_current_reading ?? 0;
        }
        if (waterMt) {
          if (waterMt.is_fixed_fee) {
            waterAmt = shop.fixed_water_amount || waterMt.fixed_fee_amount;
          } else {
            wPrice = waterMt.price_per_unit;
            wCons = r?.water_consumption ?? 0;
            waterAmt = wCons * wPrice;
          }
          wp = r?.water_previous_reading ?? 0;
          wc = r?.water_current_reading ?? 0;
        }

        const prevBal = prevBalMap[c.shop_id] ?? 0;
        const total = +(
          c.monthly_rent +
          (c.holiday_increase || 0) +
          elecAmt +
          waterAmt +
          prevBal
        ).toFixed(2);

        toInsert.push({
          invoice_no: `INV-${year}${String(month).padStart(2, "0")}-${String(seq).padStart(4, "0")}`,
          shop_id: c.shop_id,
          customer_id: c.customer_id,
          contract_id: c.id,
          invoice_month: month,
          invoice_year: year,
          invoice_date: format(new Date(), "yyyy-MM-dd"),
          due_date: format(new Date(year, month - 1, 10), "yyyy-MM-dd"),
          rent_amount: c.monthly_rent,
          holiday_increase: c.holiday_increase ?? 0,
          elec_amount: elecAmt,
          water_amount: waterAmt,
          previous_balance: prevBal,
          additional_charges: 0,
          total_amount: total,
          elec_prev_reading: ep,
          elec_curr_reading: ec,
          elec_consumption: elecCons,
          elec_unit_price: elecPrice,
          water_prev_reading: wp,
          water_curr_reading: wc,
          water_consumption: wCons,
          water_unit_price: wPrice,
          payment_status: total > 0 ? "unpaid" : "paid",
          paid_amount: 0,
          remaining_amount: total,
        });
        seq++;
      }

      if (toInsert.length === 0) {
        return { created: 0, skipped: contracts?.length ?? 0 };
      }
      const { error } = await supabase.from("invoices").insert(toInsert);
      if (error) throw error;
      return { created: toInsert.length, skipped: (contracts?.length ?? 0) - toInsert.length };
    },
    onSuccess: (res) => {
      toast.success(
        `✅ تم إنشاء ${res.created} فاتورة جديدة ${res.skipped ? `(${res.skipped} موجودة مسبقاً)` : ""}`,
      );
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setGenerateOpen(false);
    },
    onError: (err: Error) => toast.error("❌ " + (err.message || "فشل إنشاء الفواتير")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (inv: Invoice) => {
      // Check for linked receipts
      const { count } = await supabase
        .from("receipt_details")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", inv.id);
      if ((count ?? 0) > 0)
        throw new Error("لا يمكن حذف فاتورة لها سندات قبض. ألغِ السندات أولاً.");
      const { error } = await supabase.from("invoices").delete().eq("id", inv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم حذف الفاتورة");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setDeleteInv(null);
      setDetailsInv(null);
    },
    onError: (err: Error) => toast.error("❌ " + (err.message || "فشل الحذف")),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      inv,
      status,
    }: {
      inv: Invoice;
      status: "unpaid" | "paid" | "partial";
    }) => {
      const paid =
        status === "paid"
          ? inv.total_amount - inv.previous_balance + inv.paid_amount
          : status === "unpaid"
            ? 0
            : inv.paid_amount;
      const remaining = status === "paid" ? 0 : Math.max(0, inv.total_amount - paid);
      const { error } = await supabase
        .from("invoices")
        .update({
          payment_status: status,
          paid_amount: paid,
          remaining_amount: remaining,
        })
        .eq("id", inv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم تحديث حالة الدفع");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setDetailsInv(null);
    },
    onError: (err: Error) => toast.error("❌ " + (err.message || "فشل التحديث")),
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" />
              الفواتير
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {ARABIC_MONTHS[month - 1]} {year} — {total} فاتورة
            </p>
          </div>
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Plus className="h-4 w-4 ml-1" />
            إنشاء فواتير الشهر
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">إجمالي الفواتير</div>
            <div className="text-xl font-bold mt-1">{formatMoney(stats.totalAmt)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">المحصل</div>
            <div className="text-xl font-bold mt-1 text-emerald-500">
              {formatMoney(stats.paidAmt)}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">المتبقي</div>
            <div className="text-xl font-bold mt-1 text-destructive">
              {formatMoney(stats.unpaidAmt)}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">عدد الفواتير</div>
            <div className="text-xl font-bold mt-1">{stats.count}</div>
          </Card>
        </div>

        <Card className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="relative md:col-span-2">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الفاتورة/المستأجر/الكود..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pr-9"
              />
            </div>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {ARABIC_MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || now.getFullYear())}
                className="h-9"
              />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | "unpaid" | "paid" | "partial")
                }
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">الكل</option>
                <option value="unpaid">غير مدفوعة</option>
                <option value="partial">جزئي</option>
                <option value="paid">مدفوعة</option>
              </select>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد فواتير في هذا الشهر</p>
              <Button size="sm" className="mt-4" onClick={() => setGenerateOpen(true)}>
                <Plus className="h-4 w-4 ml-1" />
                إنشاء الفواتير
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right">رقم الفاتورة</th>
                    <th className="px-3 py-2 text-right">الوحدة / المستأجر</th>
                    <th className="px-3 py-2 text-center">الإيجار</th>
                    <th className="px-3 py-2 text-center">كهرباء</th>
                    <th className="px-3 py-2 text-center">مياه</th>
                    <th className="px-3 py-2 text-center">الإجمالي</th>
                    <th className="px-3 py-2 text-center">المدفوع</th>
                    <th className="px-3 py-2 text-center">المتبقي</th>
                    <th className="px-3 py-2 text-center">الحالة</th>
                    <th className="px-3 py-2 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{inv.invoice_no}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{inv.customers?.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.shops?.shop_code} — {inv.shops?.shop_name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {formatMoney(inv.rent_amount + inv.holiday_increase)}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {formatMoney(inv.elec_amount)}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {formatMoney(inv.water_amount)}
                      </td>
                      <td className="px-3 py-2 text-center font-bold tabular-nums">
                        {formatMoney(inv.total_amount)}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-emerald-600">
                        {formatMoney(inv.paid_amount)}
                      </td>
                      <td
                        className={`px-3 py-2 text-center tabular-nums font-semibold ${inv.remaining_amount > 0 ? "text-destructive" : "text-emerald-600"}`}
                      >
                        {formatMoney(inv.remaining_amount)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <PaymentBadge status={inv.payment_status} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setDetailsInv(inv)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                            <Link
                              to="/invoices/$invoiceId/print"
                              params={{ invoiceId: inv.id }}
                              target="_blank"
                              title="طباعة الفاتورة"
                            >
                              <Printer className="h-4 w-4" />
                            </Link>
                          </Button>
                          {canDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteInv(inv)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t text-xs">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span>
                {page + 1}/{totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Generate Bulk Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              إنشاء فواتير {ARABIC_MONTHS[month - 1]} {year}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-2 text-sm">
            <p>سيتم إنشاء فواتير تلقائية لجميع العقود النشطة في الشهر المحدد، مع احتساب:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
              <li>قيمة الإيجار من العقد + زيادة العيد</li>
              <li>استهلاك الكهرباء والماء من قراءات الشهر</li>
              <li>الرسوم الثابتة للوحدات بدون عدادات</li>
              <li>الرصيد السابق من آخر فاتورة غير مدفوعة</li>
            </ul>
            <p className="text-warning text-xs bg-yellow-500/10 p-2 rounded">
              سيتم تخطي الوحدات التي تمتلك فاتورة بالفعل لهذا الشهر.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <FileText className="h-4 w-4 ml-1" />
              )}
              إنشاء الفواتير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={!!detailsInv} onOpenChange={(o) => !o && setDetailsInv(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          {detailsInv && (
            <>
              <DialogHeader>
                <DialogTitle>فاتورة {detailsInv.invoice_no}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <InfoRow label="المستأجر" value={detailsInv.customers?.full_name ?? "—"} />
                  <InfoRow
                    label="الوحدة"
                    value={`${detailsInv.shops?.shop_code} - ${detailsInv.shops?.shop_name}`}
                  />
                  <InfoRow label="العقد" value={detailsInv.contracts?.contract_no ?? "—"} />
                  <InfoRow label="التاريخ" value={detailsInv.invoice_date} />
                </div>
                <div className="border rounded-lg p-3 space-y-2">
                  <AmountRow label="الإيجار" value={detailsInv.rent_amount} />
                  {detailsInv.holiday_increase > 0 && (
                    <AmountRow label="زيادة العيد" value={detailsInv.holiday_increase} />
                  )}
                  {detailsInv.elec_amount > 0 && (
                    <AmountRow
                      icon={<Zap className="h-3 w-3 text-yellow-500" />}
                      label="كهرباء"
                      value={detailsInv.elec_amount}
                      sub={
                        detailsInv.elec_consumption
                          ? `${detailsInv.elec_consumption} × ${detailsInv.elec_unit_price}`
                          : undefined
                      }
                    />
                  )}
                  {detailsInv.water_amount > 0 && (
                    <AmountRow
                      icon={<Droplets className="h-3 w-3 text-blue-500" />}
                      label="مياه"
                      value={detailsInv.water_amount}
                      sub={
                        detailsInv.water_consumption
                          ? `${detailsInv.water_consumption} × ${detailsInv.water_unit_price}`
                          : undefined
                      }
                    />
                  )}
                  {detailsInv.previous_balance > 0 && (
                    <AmountRow label="رصيد سابق" value={detailsInv.previous_balance} />
                  )}
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>الإجمالي</span>
                    <span>{formatMoney(detailsInv.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>المدفوع</span>
                    <span>{formatMoney(detailsInv.paid_amount)}</span>
                  </div>
                  <div
                    className={`flex justify-between font-bold ${detailsInv.remaining_amount > 0 ? "text-destructive" : "text-emerald-600"}`}
                  >
                    <span>المتبقي</span>
                    <span>{formatMoney(detailsInv.remaining_amount)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">تغيير الحالة:</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={detailsInv.payment_status === "unpaid" ? "default" : "outline"}
                      onClick={() =>
                        updateStatusMutation.mutate({ inv: detailsInv, status: "unpaid" })
                      }
                    >
                      غير مدفوعة
                    </Button>
                    <Button
                      size="sm"
                      variant={detailsInv.payment_status === "partial" ? "default" : "outline"}
                      onClick={() =>
                        updateStatusMutation.mutate({ inv: detailsInv, status: "partial" })
                      }
                    >
                      جزئي
                    </Button>
                    <Button
                      size="sm"
                      variant={detailsInv.payment_status === "paid" ? "default" : "outline"}
                      onClick={() =>
                        updateStatusMutation.mutate({ inv: detailsInv, status: "paid" })
                      }
                    >
                      مدفوعة
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailsInv(null)}>
                  إغلاق
                </Button>
                <Button asChild variant="outline">
                  <Link
                    to="/invoices/$invoiceId/print"
                    params={{ invoiceId: detailsInv.id }}
                    target="_blank"
                  >
                    <Printer className="h-4 w-4 ml-1" />
                    طباعة
                  </Link>
                </Button>
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteInv(detailsInv);
                    }}
                  >
                    <Trash2 className="h-4 w-4 ml-1" />
                    حذف
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteInv} onOpenChange={(o) => !o && setDeleteInv(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف الفاتورة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الفاتورة <strong>{deleteInv?.invoice_no}</strong>؟ لا يمكن
              التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteInv && deleteMutation.mutate(deleteInv)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// Helpers
async function nextInvoiceSeq(month: number, year: number): Promise<number> {
  const prefix = `INV-${year}${String(month).padStart(2, "0")}-`;
  const { data } = await import("@/integrations/supabase/client").then(({ supabase: sb }) =>
    sb
      .from("invoices")
      .select("invoice_no")
      .like("invoice_no", prefix + "%")
      .order("invoice_no", { ascending: false })
      .limit(1),
  );
  if (!data || data.length === 0) return 1;
  const last = data[0].invoice_no;
  const seqStr = last.slice(prefix.length);
  const n = parseInt(seqStr, 10);
  return isNaN(n) ? 1 : n + 1;
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "paid")
    return (
      <Badge className="bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30">
        <CheckCircle2 className="h-3 w-3 ml-1" />
        مدفوعة
      </Badge>
    );
  if (status === "partial")
    return (
      <Badge className="bg-amber-500/20 text-amber-700 hover:bg-amber-500/30">
        <Clock className="h-3 w-3 ml-1" />
        جزئي
      </Badge>
    );
  return (
    <Badge variant="destructive">
      <AlertCircle className="h-3 w-3 ml-1" />
      غير مدفوعة
    </Badge>
  );
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
function AmountRow({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: number;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="flex items-center gap-1 text-muted-foreground">
        {icon}
        {label}
        {sub && <span className="text-xs opacity-70">({sub})</span>}
      </span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}
