import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BadgeCheck,
  Loader2,
  XCircle,
  Eye,
  CheckCircle2,
  Clock,
  Ban,
  Search,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";
import { sanitizeSearchTerm } from "@/lib/utils";

export const Route = createFileRoute("/admin/payment-requests")({
  head: () => ({
    meta: [{ title: "طلبات الدفع — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={["admin", "manager", "accountant"]}>
      <AdminPaymentRequests />
    </RouteGuard>
  ),
});

interface PaymentRequest {
  id: string;
  tenant_account_id: string | null;
  amount: number;
  method: string;
  reference_no: string | null;
  bank_name: string | null;
  receipt_path: string | null;
  attachment_path: string | null;
  status: "pending_review" | "approved" | "rejected" | "cancelled";
  notes: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  tenant_accounts?: { customers?: { full_name: string; phone: string | null } } | null;
}

const PAGE_SIZE = 30;
const STATUS_LABELS: Record<string, string> = {
  pending_review: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

function AdminPaymentRequests() {
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [viewId, setViewId] = useState<PaymentRequest | null>(null);
  const [rejectOpen, setRejectOpen] = useState<PaymentRequest | null>(null);
  const [reason, setReason] = useState("");

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["payment-requests", statusFilter, search, page],
    queryFn: async () => {
      let q = supabase
        .from("payment_requests")
        .select("*, tenant_accounts(customers(full_name, phone))", { count: "exact" });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const term = sanitizeSearchTerm(search);
      if (term) q = q.or(`reference_no.ilike.%${term}%,bank_name.ilike.%${term}%`);
      q = q
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { items: (data ?? []) as unknown as PaymentRequest[], total: count ?? 0 };
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const approveMutation = useMutation({
    mutationFn: async (pr: PaymentRequest) => {
      // Create a receipt for this payment, then mark approved
      if (!pr.tenant_accounts?.customers) throw new Error("لا يوجد مستأجر مرتبط");
      if (!pr.tenant_account_id) throw new Error("لا يوجد حساب مستأجر مرتبط");
      const { data: tenantAccount, error: taError } = await supabase
        .from("tenant_accounts")
        .select("customer_id")
        .eq("id", pr.tenant_account_id)
        .single();
      if (taError) throw taError;
      const customerId = tenantAccount?.customer_id;
      if (!customerId) throw new Error("لا يوجد زبون مرتبط");

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

      // Find invoices for this customer that are unpaid, allocate
      const { data: unpaidInvoices } = await supabase
        .from("invoices")
        .select("id, total_amount, paid_amount, remaining_amount")
        .eq("customer_id", customerId)
        .neq("payment_status", "paid")
        .order("invoice_year")
        .order("invoice_month");

      let remain = pr.amount;
      const details: { invoice_id: string; amount_paid: number }[] = [];
      for (const inv of unpaidInvoices ?? []) {
        if (remain <= 0) break;
        const pay = Math.min(remain, inv.remaining_amount);
        details.push({ invoice_id: inv.id, amount_paid: +pay.toFixed(2) });
        const newPaid = +(inv.paid_amount + pay).toFixed(2);
        const newRemaining = +(inv.total_amount - newPaid).toFixed(2);
        await supabase
          .from("invoices")
          .update({
            paid_amount: newPaid,
            remaining_amount: Math.max(0, newRemaining),
            payment_status: newRemaining <= 0.01 ? "paid" : newPaid > 0 ? "partial" : "unpaid",
          })
          .eq("id", inv.id);
        remain = +(remain - pay).toFixed(2);
      }

      // Create the receipt
      const { data: receipt, error: re } = await supabase
        .from("receipts")
        .insert({
          receipt_no: receiptNo,
          receipt_date: format(new Date(), "yyyy-MM-dd"),
          customer_id: customerId,
          amount: pr.amount,
          payment_method: (pr.method === "cheque"
            ? "check"
            : pr.method) as Database["public"]["Enums"]["payment_method"],
          reference_no: pr.reference_no,
          bank_name: pr.bank_name,
          is_active: true,
          status: "posted",
          notes: `اعتماد طلب دفع ${pr.id}`,
        })
        .select()
        .single();
      if (re) throw re;

      if (details.length > 0) {
        await supabase
          .from("receipt_details")
          .insert(details.map((d) => ({ ...d, receipt_id: receipt.id })));
      }

      // Update request
      await supabase
        .from("payment_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          receipt_id: receipt.id,
        })
        .eq("id", pr.id);
    },
    onSuccess: () => {
      toast.success("✅ تم اعتماد طلب الدفع وإنشاء سند القبض");
      qc.invalidateQueries({ queryKey: ["payment-requests"] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setViewId(null);
    },
    onError: (err: Error) => toast.error("❌ " + (err.message || "فشل الاعتماد")),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectOpen) return;
      const { error } = await supabase
        .from("payment_requests")
        .update({
          status: "rejected",
          rejection_reason: reason || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", rejectOpen.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم رفض الطلب");
      qc.invalidateQueries({ queryKey: ["payment-requests"] });
      setRejectOpen(null);
      setReason("");
      setViewId(null);
    },
    onError: (err: Error) => toast.error("❌ " + (err.message || "فشل الرفض")),
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-primary" />
            طلبات الدفع والتحويلات
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            مراجعة إشعارات التحويل والإيداع المرفوعة من المستأجرين
          </p>
        </div>

        <Card className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالمرجع أو البنك..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">جميع الحالات</option>
              <option value="pending_review">قيد المراجعة</option>
              <option value="approved">معتمدة</option>
              <option value="rejected">مرفوضة</option>
              <option value="cancelled">ملغاة</option>
            </select>
            <div className="text-xs text-muted-foreground flex items-center">
              إجمالي: {total} طلب
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد طلبات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right">التاريخ</th>
                    <th className="px-3 py-2 text-right">المستأجر</th>
                    <th className="px-3 py-2 text-center">الطريقة</th>
                    <th className="px-3 py-2 text-center">المبلغ</th>
                    <th className="px-3 py-2 text-center">البنك/المرجع</th>
                    <th className="px-3 py-2 text-center">الحالة</th>
                    <th className="px-3 py-2 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((pr) => {
                    const tenant = pr.tenant_accounts;
                    return (
                      <tr key={pr.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 text-xs">
                          {format(new Date(pr.created_at), "yyyy/MM/dd HH:mm")}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {tenant?.customers?.full_name ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-center">{methodLabel(pr.method)}</td>
                        <td className="px-3 py-2 text-center font-bold tabular-nums">
                          {formatMoney(pr.amount)}
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {pr.bank_name || pr.reference_no || "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <StatusBadge status={pr.status} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setViewId(pr)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {pr.status === "pending_review" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-emerald-600"
                                  onClick={() => approveMutation.mutate(pr)}
                                  disabled={approveMutation.isPending}
                                >
                                  {approveMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => setRejectOpen(pr)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* View Dialog */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          {viewId && (
            <>
              <DialogHeader>
                <DialogTitle>طلب دفع</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <InfoRow
                  label="المستأجر"
                  value={viewId.tenant_accounts?.customers?.full_name ?? "—"}
                />
                <InfoRow label="المبلغ" value={formatMoney(viewId.amount)} />
                <InfoRow label="الطريقة" value={methodLabel(viewId.method)} />
                {viewId.bank_name && <InfoRow label="البنك" value={viewId.bank_name} />}
                {viewId.reference_no && <InfoRow label="رقم المرجع" value={viewId.reference_no} />}
                {viewId.notes && <InfoRow label="ملاحظات" value={viewId.notes} />}
                {viewId.rejection_reason && (
                  <InfoRow label="سبب الرفض" value={viewId.rejection_reason} />
                )}
                {viewId.attachment_path && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">إيصال الدفع:</div>
                    <button
                      type="button"
                      onClick={async () => {
                        const { data, error } = await supabase.storage
                          .from("payment-proofs")
                          .createSignedUrl(viewId.attachment_path!, 300);
                        if (error || !data?.signedUrl) {
                          toast.error("❌ تعذر فتح إيصال الدفع");
                          return;
                        }
                        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                      }}
                      className="text-primary text-xs underline"
                    >
                      فتح الإيصال (رابط آمن مؤقت)
                    </button>
                  </div>
                )}
                <div className="pt-2">
                  <StatusBadge status={viewId.status} />
                </div>
              </div>
              {viewId.status === "pending_review" && (
                <DialogFooter className="gap-2">
                  <Button variant="destructive" onClick={() => setRejectOpen(viewId)}>
                    <XCircle className="h-4 w-4 ml-1" />
                    رفض
                  </Button>
                  <Button
                    onClick={() => approveMutation.mutate(viewId)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-1" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 ml-1" />
                    )}
                    اعتماد
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectOpen} onOpenChange={(o) => !o && setRejectOpen(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض طلب الدفع</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>سبب الرفض (سيظهر للمستأجر)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: رقم المرجع غير صحيح"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <XCircle className="h-4 w-4 ml-1" />
              )}
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return (
      <Badge className="bg-emerald-500/20 text-emerald-600">
        <CheckCircle2 className="h-3 w-3 ml-1" />
        معتمد
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 ml-1" />
        مرفوض
      </Badge>
    );
  if (status === "cancelled")
    return (
      <Badge variant="secondary">
        <Ban className="h-3 w-3 ml-1" />
        ملغي
      </Badge>
    );
  return (
    <Badge className="bg-amber-500/20 text-amber-700">
      <Clock className="h-3 w-3 ml-1" />
      قيد المراجعة
    </Badge>
  );
}
function methodLabel(m: string | null): string {
  const labels: Record<string, string> = {
    transfer: "تحويل",
    cash: "نقدي",
    cheque: "شيك",
    check: "شيك",
    deposit: "إيداع",
    wallet: "محفظة",
  };
  return labels[m ?? ""] ?? m ?? "—";
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
