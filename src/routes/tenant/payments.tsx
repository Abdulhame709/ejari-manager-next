import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RouteGuard } from "@/components/route-guard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ChevronLeft,
  Upload,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import TenantLayout from "./-tenant-layout";

export const Route = createFileRoute("/tenant/payments")({
  head: () => ({
    meta: [{ title: "طلبات الدفع — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={["tenant"]} redirectTo="/login">
      <TenantPayments />
    </RouteGuard>
  ),
});

interface PaymentRequest {
  id: string;
  amount: number;
  method: string | null;
  reference_no: string | null;
  bank_name: string | null;
  status: "pending_review" | "approved" | "rejected" | "cancelled";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  attachment_path: string | null;
}

function TenantPayments() {
  const { customerId } = useAuth();

  const { data: ta } = useQuery({
    queryKey: ["tenant-account", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      if (!customerId) return null;
      return (
        await supabase
          .from("tenant_accounts")
          .select("id")
          .eq("customer_id", customerId)
          .maybeSingle()
      ).data;
    },
  });

  const { data: requests = [], isLoading } = useQuery<PaymentRequest[]>({
    queryKey: ["tenant-payment-requests", ta?.id],
    enabled: !!ta?.id,
    queryFn: async () => {
      if (!ta?.id) return [];
      const { data } = await supabase
        .from("payment_requests")
        .select("*")
        .eq("tenant_account_id", ta.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as PaymentRequest[];
    },
  });

  const statusMeta = {
    pending_review: { label: "قيد المراجعة", color: "bg-amber-500/20 text-amber-700", icon: Clock },
    approved: { label: "معتمد", color: "bg-emerald-500/20 text-emerald-600", icon: CheckCircle2 },
    rejected: { label: "مرفوض", color: "bg-rose-500/20 text-rose-600", icon: XCircle },
    cancelled: { label: "ملغي", color: "bg-muted text-muted-foreground", icon: Ban },
  };

  return (
    <TenantLayout>
      <div className="space-y-4">
        <Link to="/tenant" className="text-xs text-primary inline-flex items-center">
          <ChevronLeft className="h-3 w-3 ml-1" />
          العودة للرئيسية
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          طلبات الدفع
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          متابعة إشعارات التحويل والإيداع التي أرسلتها وحالة اعتمادها.
        </p>

        <Card className="p-4">
          <Link
            to="/tenant/invoices"
            className="inline-flex items-center gap-2 text-sm text-primary font-semibold"
          >
            <Upload className="h-4 w-4" />
            رفع إشعار دفع جديد
          </Link>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لم تقم بإرسال أي طلب دفع بعد.</p>
            </div>
          ) : (
            <div className="divide-y">
              {requests.map((r) => {
                const meta = statusMeta[r.status] ?? statusMeta.pending_review;
                const Icon = meta.icon;
                return (
                  <div key={r.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={meta.color + " text-xs"}>
                          <Icon className="h-3 w-3 ml-1" />
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "yyyy/MM/dd HH:mm")}
                        </span>
                      </div>
                      <div className="mt-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">المبلغ:</span>{" "}
                          <strong className="tabular-nums">
                            {Math.round(r.amount).toLocaleString("ar-EG")} ر.ي
                          </strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">الطريقة:</span>{" "}
                          {(r.method === "transfer"
                            ? "تحويل"
                            : r.method === "deposit"
                              ? "إيداع"
                              : r.method === "cheque"
                                ? "شيك"
                                : r.method) ?? "—"}
                        </div>
                        {r.bank_name && (
                          <div>
                            <span className="text-muted-foreground">البنك:</span> {r.bank_name}
                          </div>
                        )}
                        {r.reference_no && (
                          <div>
                            <span className="text-muted-foreground">رقم المرجع:</span>{" "}
                            <span dir="ltr">{r.reference_no}</span>
                          </div>
                        )}
                        {r.rejection_reason && (
                          <div className="mt-1 text-rose-600 text-xs bg-rose-500/10 rounded p-2">
                            <strong>سبب الرفض:</strong> {r.rejection_reason}
                          </div>
                        )}
                        {r.attachment_path && (
                          <div className="mt-1">
                            <a
                              href={r.attachment_path}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary underline"
                            >
                              عرض الإيصال المرفق
                            </a>
                          </div>
                        )}
                        {r.reviewed_at && (
                          <div className="text-xs text-muted-foreground mt-1">
                            تم المراجعة في {format(new Date(r.reviewed_at), "yyyy/MM/dd HH:mm")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </TenantLayout>
  );
}
