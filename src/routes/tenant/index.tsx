import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RouteGuard } from "@/components/route-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  FileText,
  Wallet,
  Gauge,
  AlertCircle,
  ChevronLeft,
  Receipt,
  CreditCard,
  User,
} from "lucide-react";
import { format } from "date-fns";
import TenantLayout from "./-tenant-layout";
import { formatMoney } from "@/lib/format";

type TenantInvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_month: number;
  invoice_year: number;
  total_amount: number;
  paid_amount: number | null;
  remaining_amount: number | null;
  payment_status: "unpaid" | "paid" | "partial";
  due_date: string | null;
  shops: { shop_name: string; shop_code: string } | null;
};

type TenantContractRow = {
  id: string;
  contract_no: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  status: string;
  shops: { shop_name: string; shop_code: string } | null;
};

export const Route = createFileRoute("/tenant/")({
  head: () => ({
    meta: [{ title: "لوحة المستأجر — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={["tenant"]} redirectTo="/login">
      <TenantDashboard />
    </RouteGuard>
  ),
});

function TenantDashboard() {
  const { customerId, user } = useAuth();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["tenant-invoices-summary", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      if (!customerId) return [];
      const { data } = await supabase
        .from("invoices")
        .select(
          "id, invoice_no, invoice_month, invoice_year, total_amount, paid_amount, remaining_amount, payment_status, due_date, shops(shop_name, shop_code)",
        )
        .eq("customer_id", customerId)
        .order("invoice_year", { ascending: false })
        .order("invoice_month", { ascending: false })
        .limit(10);
      return (data ?? []) as unknown as TenantInvoiceRow[];
    },
  });

  const { data: contract } = useQuery({
    queryKey: ["tenant-contract", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      if (!customerId) return null;
      const { data } = await supabase
        .from("contracts")
        .select("*, shops(shop_name, shop_code)")
        .eq("customer_id", customerId)
        .eq("status", "active")
        .maybeSingle();
      return data as unknown as TenantContractRow | null;
    },
  });

  const stats = {
    totalDue: invoices
      .filter((i) => i.payment_status !== "paid")
      .reduce((s, i) => s + (i.remaining_amount || 0), 0),
    paidThisMonth: invoices
      .filter((i) => i.payment_status === "paid")
      .reduce((s, i) => s + (i.paid_amount || 0), 0),
    openInvoices: invoices.filter((i) => i.payment_status !== "paid").length,
  };

  return (
    <TenantLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">مرحباً بك 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">هذه لوحة التحكم الخاصة بك في إيجاري</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">المبلغ المستحق</div>
                <div className="text-xl font-bold mt-1">{formatMoney(stats.totalDue)}</div>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">إجمالي المدفوع</div>
                <div className="text-xl font-bold mt-1">{formatMoney(stats.paidThisMonth)}</div>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">فواتير مفتوحة</div>
                <div className="text-xl font-bold mt-1">{stats.openInvoices}</div>
              </div>
            </div>
          </Card>
        </div>

        {contract && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="font-bold">العقد الحالي</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">الوحدة</div>
                <div className="font-medium mt-0.5">
                  {contract.shops?.shop_name} ({contract.shops?.shop_code})
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">رقم العقد</div>
                <div className="font-medium mt-0.5">{contract.contract_no}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">الإيجار الشهري</div>
                <div className="font-medium mt-0.5">{formatMoney(contract.monthly_rent)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">ينتهي في</div>
                <div className="font-medium mt-0.5">
                  {format(new Date(contract.end_date), "yyyy/MM/dd")}
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              آخر الفواتير
            </h2>
            <Link to="/tenant/invoices">
              <Button variant="ghost" size="sm" className="text-xs">
                عرض الكل
                <ChevronLeft className="h-3 w-3 mr-1" />
              </Button>
            </Link>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">جارٍ التحميل...</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">لا توجد فواتير</p>
          ) : (
            <div className="divide-y">
              {invoices.slice(0, 5).map((inv) => (
                <Link
                  to="/tenant/invoices"
                  key={inv.id}
                  className="flex items-center justify-between py-3 hover:bg-muted/30 px-2 rounded"
                >
                  <div>
                    <div className="font-medium text-sm">{inv.invoice_no}</div>
                    <div className="text-xs text-muted-foreground">
                      {inv.shops?.shop_name} — شهر {inv.invoice_month}/{inv.invoice_year}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="font-bold tabular-nums">{formatMoney(inv.total_amount)}</div>
                    <div className="text-xs mt-0.5">
                      {inv.payment_status === "paid" ? (
                        <span className="text-emerald-600">مدفوعة</span>
                      ) : inv.payment_status === "partial" ? (
                        <span className="text-amber-600">
                          مدفوعة جزئياً ({formatMoney(inv.remaining_amount)} متبقي)
                        </span>
                      ) : (
                        <span className="text-destructive">
                          غير مدفوعة ({formatMoney(inv.remaining_amount)})
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 text-center">
            <CreditCard className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-bold mb-1">إرسال إشعار دفع</h3>
            <p className="text-xs text-muted-foreground mb-3">
              قمت بالتحويل أو الإيداع؟ أرسل لنا الإيصال وسنراجعه خلال وقت قصير.
            </p>
            <Link to="/tenant/invoices">
              <Button size="sm">رفع إيصال دفع</Button>
            </Link>
          </Card>
          <Card className="p-5 text-center">
            <Gauge className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-bold mb-1">قراءات العدادات</h3>
            <p className="text-xs text-muted-foreground mb-3">
              تابع استهلاك الكهرباء والمياه شهرياً.
            </p>
            <Link to="/tenant/statement">
              <Button size="sm" variant="outline">
                عرض الاستهلاك
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </TenantLayout>
  );
}
