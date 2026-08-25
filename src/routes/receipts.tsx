import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { canDeleteOperationalRecords, PAGE_ROLES } from "@/lib/access-control";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wallet,
  Search,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Printer,
  RotateCcw,
  Eye,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";
import { getErrorMessage, sanitizeSearchTerm } from "@/lib/utils";

export const Route = createFileRoute("/receipts")({
  head: () => ({
    meta: [{ title: "سندات القبض — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={PAGE_ROLES.receipts}>
      <ReceiptsPage />
    </RouteGuard>
  ),
});

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}
interface Invoice {
  id: string;
  invoice_no: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  invoice_month: number;
  invoice_year: number;
  shop_id: string;
  shops?: { shop_code: string; shop_name: string };
}
interface Receipt {
  id: string;
  receipt_no: string;
  receipt_date: string;
  customer_id: string;
  amount: number;
  payment_method: "cash" | "check" | "transfer" | "deposit" | "wallet";
  reference_no: string | null;
  bank_name: string | null;
  check_number: string | null;
  cheque_no: string | null;
  check_date: string | null;
  cheque_date: string | null;
  notes: string | null;
  is_active: boolean;
  status: string;
  created_at: string;
  customers?: { full_name: string };
  receipt_details?: { invoice_id: string; amount_paid: number }[];
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
const METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  check: "شيك",
  transfer: "تحويل",
  deposit: "إيداع",
  wallet: "محفظة",
};

function ReceiptsPage() {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<
    "all" | Database["public"]["Enums"]["payment_method"]
  >("all");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<Receipt | null>(null);
  const [receiptToReverse, setReceiptToReverse] = useState<Receipt | null>(null);
  const [reverseReason, setReverseReason] = useState("");

  const qc = useQueryClient();
  const { role } = useAuth();
  const canReverseReceipts = canDeleteOperationalRecords(role);

  const { data, isLoading } = useQuery({
    queryKey: ["receipts", search, methodFilter, page],
    queryFn: async () => {
      let q = supabase
        .from("receipts")
        .select("*, customers(full_name), receipt_details(invoice_id, amount_paid)", {
          count: "exact",
        })
        .eq("is_active", true);
      if (search.trim())
        q = q.or(
          `receipt_no.ilike.%${sanitizeSearchTerm(search)}%,customers.full_name.ilike.%${sanitizeSearchTerm(search)}%`,
        );
      if (methodFilter !== "all") q = q.eq("payment_method", methodFilter);
      q = q
        .order("receipt_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { receipts: (data ?? []) as unknown as Receipt[], total: count ?? 0 };
    },
  });
  const receipts = useMemo(() => data?.receipts ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const reverseReceiptMutation = useMutation({
    mutationFn: async ({ receiptId, reason }: { receiptId: string; reason: string }) => {
      const { error } = await supabase.rpc("reverse_receipt", {
        p_receipt_id: receiptId,
        p_reason: reason.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["receipts"] }),
        qc.invalidateQueries({ queryKey: ["invoices"] }),
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      ]);
      setDetails(null);
      setReceiptToReverse(null);
      setReverseReason("");
      toast.success("تم عكس السند وإعادة احتساب أرصدة الفواتير");
    },
    onError: (error) => {
      toast.error("تعذر عكس السند: " + getErrorMessage(error, "حدث خطأ غير متوقع"));
    },
  });

  // Customers for picker
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-active"],
    queryFn: async () =>
      (
        await supabase
          .from("customers")
          .select("id,full_name,phone")
          .eq("is_active", true)
          .order("full_name")
      ).data ?? [],
  });

  // Stats
  const stats = useMemo(() => {
    const posted = receipts.filter((receipt) => receipt.status === "posted");
    return {
      total: posted.reduce((sum, receipt) => sum + receipt.amount, 0),
      count: posted.length,
    };
  }, [receipts]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" />
              المدفوعات وسندات القبض
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {stats.count} سند مرحّل في هذه الصفحة — إجمالي المحصل: {formatMoney(stats.total)}
            </p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 ml-1" />
            سند قبض جديد
          </Button>
        </div>

        <Card className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="relative md:col-span-2">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم السند أو المستأجر..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pr-9"
              />
            </div>
            <Select
              value={methodFilter}
              onValueChange={(v) => setMethodFilter(v as typeof methodFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الطرق</SelectItem>
                <SelectItem value="cash">نقدي</SelectItem>
                <SelectItem value="check">شيك</SelectItem>
                <SelectItem value="transfer">تحويل</SelectItem>
                <SelectItem value="deposit">إيداع</SelectItem>
                <SelectItem value="wallet">محفظة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد سندات قبض</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right">رقم السند</th>
                    <th className="px-3 py-2 text-right">التاريخ</th>
                    <th className="px-3 py-2 text-right">المستأجر</th>
                    <th className="px-3 py-2 text-center">الطريقة</th>
                    <th className="px-3 py-2 text-center">المبلغ</th>
                    <th className="px-3 py-2 text-center">المرجع</th>
                    <th className="px-3 py-2 text-center">الحالة</th>
                    <th className="px-3 py-2 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{r.receipt_no}</td>
                      <td className="px-3 py-2 text-xs">
                        {format(new Date(r.receipt_date), "yyyy/MM/dd")}
                      </td>
                      <td className="px-3 py-2 font-medium">{r.customers?.full_name}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="outline">
                          {METHOD_LABELS[r.payment_method] ?? r.payment_method}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-600 tabular-nums">
                        {formatMoney(r.amount)}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                        {r.reference_no || r.check_number || r.cheque_no || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant={r.status === "posted" ? "default" : r.status === "reversal" ? "secondary" : "destructive"}
                        >
                          {r.status === "posted" ? "مرحل" : r.status === "reversal" ? "سند عكسي" : "ملغى"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setDetails(r)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                            <Link
                              to="/receipts/$receiptId/print"
                              params={{ receiptId: r.id }}
                              target="_blank"
                              title="طباعة سند القبض"
                            >
                              <Printer className="h-4 w-4" />
                            </Link>
                          </Button>
                          {canReverseReceipts && r.status === "posted" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setReceiptToReverse(r)}
                              title="عكس السند"
                            >
                              <RotateCcw className="h-4 w-4" />
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

      <ReceiptFormDialog
        open={open}
        onClose={() => setOpen(false)}
        customers={customers}
        onSaved={() => {
          setOpen(false);
          qc.invalidateQueries({ queryKey: ["receipts"] });
          qc.invalidateQueries({ queryKey: ["invoices"] });
          qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }}
      />

      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          {details && (
            <>
              <DialogHeader>
                <DialogTitle>سند قبض {details.receipt_no}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                    <div className="text-xs text-muted-foreground">المستأجر</div>
                    <div className="font-medium">{details.customers?.full_name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">التاريخ</div>
                    <div>{format(new Date(details.receipt_date), "yyyy/MM/dd")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">طريقة الدفع</div>
                    <div>{METHOD_LABELS[details.payment_method]}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">المبلغ</div>
                    <div className="font-bold text-emerald-600">{formatMoney(details.amount)}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">حالة السند</div>
                  <Badge
                    variant={details.status === "posted" ? "default" : details.status === "reversal" ? "secondary" : "destructive"}
                  >
                    {details.status === "posted" ? "مرحل" : details.status === "reversal" ? "سند عكسي" : "ملغى"}
                  </Badge>
                </div>
                {details.bank_name && (
                  <div>
                    <div className="text-xs text-muted-foreground">البنك</div>
                    <div>{details.bank_name}</div>
                  </div>
                )}
                {(details.check_number || details.cheque_no) && (
                  <div>
                    <div className="text-xs text-muted-foreground">رقم الشيك</div>
                    <div>{details.check_number || details.cheque_no}</div>
                  </div>
                )}
                {(details.check_date || details.cheque_date) && (
                  <div>
                    <div className="text-xs text-muted-foreground">تاريخ الشيك</div>
                    <div>{details.check_date || details.cheque_date}</div>
                  </div>
                )}
                {details.reference_no && (
                  <div>
                    <div className="text-xs text-muted-foreground">رقم المرجع</div>
                    <div>{details.reference_no}</div>
                  </div>
                )}
                {details.notes && (
                  <div>
                    <div className="text-xs text-muted-foreground">ملاحظات</div>
                    <div>{details.notes}</div>
                  </div>
                )}
                {details.receipt_details && details.receipt_details.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">الفواتير المغطاة:</div>
                    <div className="border rounded divide-y">
                      {details.receipt_details.map((rd) => (
                        <div key={rd.invoice_id} className="flex justify-between p-2 text-xs">
                          <span>{rd.invoice_id.slice(0, 8)}</span>
                          <span className="tabular-nums">{formatMoney(rd.amount_paid)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetails(null)}>
                  إغلاق
                </Button>
                {canReverseReceipts && details.status === "posted" && (
                  <Button variant="destructive" onClick={() => setReceiptToReverse(details)}>
                    <RotateCcw className="h-4 w-4 ml-1" />
                    عكس السند
                  </Button>
                )}
                <Button asChild>
                  <Link
                    to="/receipts/$receiptId/print"
                    params={{ receiptId: details.id }}
                    target="_blank"
                  >
                    <Printer className="h-4 w-4 ml-1" />
                    طباعة السند
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!receiptToReverse} onOpenChange={(isOpen) => !isOpen && setReceiptToReverse(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد عكس سند القبض</AlertDialogTitle>
            <AlertDialogDescription>
              سيُلغى السند {receiptToReverse?.receipt_no} ويُنشأ سجل عكسي مرتبط به، ثم تُعاد
              احتساب الأرصدة وحالات الفواتير المرتبطة. لا يمكن التراجع عن هذه العملية من الواجهة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reverse-reason">سبب العكس (اختياري)</Label>
            <Input
              id="reverse-reason"
              value={reverseReason}
              onChange={(event) => setReverseReason(event.target.value)}
              placeholder="مثال: إيداع مكرر أو تصحيح قيد"
              disabled={reverseReceiptMutation.isPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reverseReceiptMutation.isPending}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!receiptToReverse || reverseReceiptMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (receiptToReverse) {
                  reverseReceiptMutation.mutate({
                    receiptId: receiptToReverse.id,
                    reason: reverseReason,
                  });
                }
              }}
            >
              {reverseReceiptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <RotateCcw className="h-4 w-4 ml-1" />}
              تأكيد العكس
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// Receipt form dialog
function ReceiptFormDialog({
  open,
  onClose,
  customers,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  onSaved: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "check" | "transfer" | "deposit" | "wallet">(
    "cash",
  );
  const [refNo, setRefNo] = useState("");
  const [bank, setBank] = useState("");
  const [checkNo, setCheckNo] = useState("");
  const [checkDate, setCheckDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["cust-unpaid-invoices", customerId],
    enabled: !!customerId,
    queryFn: async () =>
      ((
        await supabase
          .from("invoices")
          .select(
            "id, invoice_no, total_amount, paid_amount, remaining_amount, invoice_month, invoice_year, shop_id, shops(shop_code, shop_name)",
          )
          .eq("customer_id", customerId)
          .neq("payment_status", "paid")
          .order("invoice_year", { ascending: false })
          .order("invoice_month", { ascending: false })
      ).data as unknown as Invoice[]) ?? [],
  });

  const totalAllocated = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocations],
  );
  const totalAmt = parseFloat(amount) || 0;

  async function handleSave() {
    if (!customerId) {
      toast.error("اختر المستأجر");
      return;
    }
    if (totalAmt <= 0) {
      toast.error("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }
    if (Math.abs(totalAllocated - totalAmt) > 0.01) {
      toast.error(
        `إجمالي التوزيع (${formatMoney(totalAllocated)}) لا يساوي المبلغ (${formatMoney(totalAmt)})`,
      );
      return;
    }

    setSaving(true);
    try {
      // Generate receipt number
      const prefix = `RCP-${format(new Date(), "yyyyMM")}-`;
      const { data: last } = await supabase
        .from("receipts")
        .select("receipt_no")
        .like("receipt_no", prefix + "%")
        .order("receipt_no", { ascending: false })
        .limit(1);
      const seq = last && last[0] ? parseInt(last[0].receipt_no.slice(prefix.length), 10) + 1 : 1;
      const receiptNo = prefix + String(seq).padStart(4, "0");

      const { data: receipt, error } = await supabase
        .from("receipts")
        .insert({
          receipt_no: receiptNo,
          receipt_date: format(new Date(), "yyyy-MM-dd"),
          customer_id: customerId,
          amount: totalAmt,
          payment_method: method,
          reference_no: refNo || null,
          bank_name:
            method === "check" || method === "transfer" || method === "deposit"
              ? bank || null
              : null,
          check_number: method === "check" ? checkNo || null : null,
          cheque_no: method === "check" ? checkNo || null : null,
          check_date: method === "check" ? checkDate || null : null,
          cheque_date: method === "check" ? checkDate || null : null,
          notes: notes || null,
          is_active: true,
          status: "posted",
        })
        .select()
        .single();
      if (error) throw error;

      const details = Object.entries(allocations)
        .filter(([, v]) => Number(v) > 0)
        .map(([iid, v]) => ({
          receipt_id: receipt.id,
          invoice_id: iid,
          amount_paid: Number(v),
        }));
      if (details.length > 0) {
        const { error: de } = await supabase.from("receipt_details").insert(details);
        if (de) throw de;
        // Update each invoice's paid/remaining/status
        for (const { invoice_id, amount_paid } of details) {
          const inv = invoices.find((i) => i.id === invoice_id);
          if (!inv) continue;
          const newPaid = +(inv.paid_amount + amount_paid).toFixed(2);
          const newRemaining = +(inv.total_amount - newPaid).toFixed(2);
          const newStatus = newRemaining <= 0.01 ? "paid" : newPaid > 0 ? "partial" : "unpaid";
          await supabase
            .from("invoices")
            .update({
              paid_amount: newPaid,
              remaining_amount: Math.max(0, newRemaining),
              payment_status: newStatus,
            })
            .eq("id", invoice_id);
        }
      }

      toast.success("✅ تم حفظ سند القبض");
      onSaved();
      // Reset
      setCustomerId("");
      setAmount("");
      setAllocations({});
      setRefNo("");
      setBank("");
      setCheckNo("");
      setNotes("");
    } catch (err) {
      toast.error("❌ " + getErrorMessage(err, "فشل الحفظ"));
    } finally {
      setSaving(false);
    }
  }

  function autoDistribute() {
    let remain = totalAmt;
    const newAlloc: Record<string, number> = {};
    for (const inv of invoices) {
      if (remain <= 0) break;
      const pay = Math.min(remain, inv.remaining_amount);
      newAlloc[inv.id] = +pay.toFixed(2);
      remain = +(remain - pay).toFixed(2);
    }
    setAllocations(newAlloc);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>سند قبض جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>المستأجر *</Label>
              <Select
                value={customerId}
                onValueChange={(v) => {
                  setCustomerId(v);
                  setAllocations({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المستأجر" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>المبلغ (ر.ي) *</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label>طريقة الدفع</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="check">شيك</SelectItem>
                  <SelectItem value="transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="deposit">إيداع</SelectItem>
                  <SelectItem value="wallet">محفظة إلكترونية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(method === "transfer" || method === "deposit") && (
              <div className="space-y-1">
                <Label>رقم المرجع</Label>
                <Input
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="رقم العملية"
                />
              </div>
            )}
            {method === "check" && (
              <>
                <div className="space-y-1">
                  <Label>رقم الشيك</Label>
                  <Input value={checkNo} onChange={(e) => setCheckNo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>تاريخ الشيك</Label>
                  <Input
                    type="date"
                    value={checkDate}
                    onChange={(e) => setCheckDate(e.target.value)}
                  />
                </div>
              </>
            )}
            {(method === "check" || method === "transfer" || method === "deposit") && (
              <div className="space-y-1">
                <Label>البنك</Label>
                <Input value={bank} onChange={(e) => setBank(e.target.value)} />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label>ملاحظات</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {customerId && (
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">توزيع الدفعة على الفواتير</span>
                <Button size="sm" variant="outline" onClick={autoDistribute}>
                  توزيع تلقائي
                </Button>
              </div>
              {invoices.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  لا توجد فواتير مستحقة على هذا المستأجر
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y text-sm">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="flex-1">
                        <div className="font-medium">{inv.invoice_no}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.shops?.shop_code} — {ARABIC_MONTHS[inv.invoice_month - 1]}{" "}
                          {inv.invoice_year}
                        </div>
                      </div>
                      <div className="text-xs text-destructive tabular-nums">
                        {formatMoney(inv.remaining_amount)}
                      </div>
                      <input
                        type="number"
                        value={allocations[inv.id] ?? ""}
                        onChange={(e) =>
                          setAllocations((p) => ({
                            ...p,
                            [inv.id]: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="h-8 w-28 rounded-md border text-center text-sm"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-sm font-bold">
                <span>الإجمالي الموزع</span>
                <span
                  className={
                    Math.abs(totalAllocated - totalAmt) <= 0.01
                      ? "text-emerald-600"
                      : "text-destructive"
                  }
                >
                  {formatMoney(totalAllocated)}
                </span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin ml-1" />
            ) : (
              <CheckCircle2 className="h-4 w-4 ml-1" />
            )}
            حفظ السند
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
