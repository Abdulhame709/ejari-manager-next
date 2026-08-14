import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RouteGuard } from "@/components/route-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  ChevronLeft,
  Upload,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import TenantLayout from "./-tenant-layout";
import { formatMoney } from "@/lib/format";
import { getErrorMessage } from "@/lib/utils";

type TenantInvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_month: number;
  invoice_year: number;
  total_amount: number;
  paid_amount: number | null;
  remaining_amount: number | null;
  payment_status: "unpaid" | "paid" | "partial";
  shops: { shop_name: string; shop_code: string } | null;
};

export const Route = createFileRoute("/tenant/invoices")({
  head: () => ({
    meta: [{ title: "فواتيري — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={["tenant"]} redirectTo="/login">
      <TenantInvoices />
    </RouteGuard>
  ),
});

function TenantInvoices() {
  const { customerId } = useAuth();
  const [payOpen, setPayOpen] = useState<TenantInvoiceRow | null>(null);
  const [method, setMethod] = useState("transfer");
  const [refNo, setRefNo] = useState("");
  const [bank, setBank] = useState("");
  const [amount, setAmount] = useState("");
  const [filePath, setFilePath] = useState("");
  const [uploading, setUploading] = useState(false);

  const {
    data: invoices = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["tenant-invoices", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      if (!customerId) return [];
      const { data } = await supabase
        .from("invoices")
        .select(
          "id, invoice_no, invoice_month, invoice_year, total_amount, paid_amount, remaining_amount, payment_status, shops(shop_name, shop_code)",
        )
        .eq("customer_id", customerId)
        .order("invoice_year", { ascending: false })
        .order("invoice_month", { ascending: false });
      return (data ?? []) as unknown as TenantInvoiceRow[];
    },
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts-public"],
    queryFn: async () =>
      (
        await supabase
          .from("bank_accounts")
          .select("*")
          .eq("is_active", true)
          .order("display_order")
      ).data ?? [],
  });

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

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!ta?.id) throw new Error("حساب المستأجر غير موجود");
      const amt = parseFloat(amount);
      const remaining = Number(payOpen?.remaining_amount ?? 0);
      if (!amt || amt <= 0) throw new Error("أدخل مبلغاً صحيحاً");
      if (remaining > 0 && amt > remaining + 0.01) {
        throw new Error("لا يمكن أن يتجاوز المبلغ الرصيد المتبقي على الفاتورة");
      }
      const { error } = await supabase.from("payment_requests").insert({
        tenant_account_id: ta.id,
        invoice_id: payOpen?.id ?? null,
        amount: amt,
        method,
        reference_no: refNo || null,
        bank_name: bank || null,
        attachment_path: filePath || null,
        status: "pending_review",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم إرسال إشعار الدفع، سيتم مراجعته قريباً");
      setPayOpen(null);
      setRefNo("");
      setBank("");
      setAmount("");
      setFilePath("");
      refetch();
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل الإرسال")),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !ta?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("❌ يجب ألا يتجاوز حجم الإيصال 5 ميجابايت");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      // payment-proofs is private: store the object path, never a public URL.
      // Staff receive a short-lived signed URL when they open the proof.
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${ta.id}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from("payment-proofs").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (error) throw error;
      setFilePath(path);
      toast.success("✅ تم رفع الإيصال");
    } catch (err) {
      toast.error("❌ فشل رفع الملف: " + getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <TenantLayout>
      <div className="space-y-4">
        <div>
          <Link to="/tenant" className="text-xs text-primary inline-flex items-center mb-2">
            <ChevronLeft className="h-3 w-3 ml-1" />
            العودة للرئيسية
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            فواتيري
          </h1>
          <p className="text-sm text-muted-foreground mt-1">جميع فواتيرك ومدفوعاتك</p>
        </div>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">جارٍ التحميل...</div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد فواتير بعد</div>
          ) : (
            <div className="divide-y">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{inv.invoice_no}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {inv.shops?.shop_name} — شهر {inv.invoice_month}/{inv.invoice_year}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className="font-bold tabular-nums">{formatMoney(inv.total_amount)}</div>
                      <div className="text-xs mt-0.5">
                        {inv.payment_status === "paid" ? (
                          <span className="text-emerald-600">
                            <CheckCircle2 className="h-3 w-3 inline ml-1" />
                            مدفوعة
                          </span>
                        ) : inv.payment_status === "partial" ? (
                          <span className="text-amber-600">
                            <Clock className="h-3 w-3 inline ml-1" />
                            جزئي — متبقي {formatMoney(inv.remaining_amount)}
                          </span>
                        ) : (
                          <span className="text-destructive">
                            <AlertCircle className="h-3 w-3 inline ml-1" />
                            مستحقة — {formatMoney(inv.remaining_amount)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to="/invoices/$invoiceId/print"
                        params={{ invoiceId: inv.id }}
                        target="_blank"
                      >
                        <Printer className="h-4 w-4 ml-1" />
                        طباعة
                      </Link>
                    </Button>
                    {inv.payment_status !== "paid" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setPayOpen(inv);
                          setAmount(String(inv.remaining_amount ?? 0));
                        }}
                      >
                        <Upload className="h-4 w-4 ml-1" />
                        دفع
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>إرسال إشعار دفع</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="bg-muted/50 p-3 rounded text-xs">
              <div className="font-semibold">{payOpen?.invoice_no}</div>
              <div>
                المبلغ المستحق:{" "}
                <span className="font-bold text-destructive">
                  {formatMoney(payOpen?.remaining_amount)}
                </span>
              </div>
            </div>

            {banks.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs font-bold text-blue-700 mb-2">
                  🏦 حساباتنا البنكية للتحويل/الإيداع:
                </div>
                <div className="space-y-2">
                  {banks.map((b) => (
                    <div key={b.id} className="text-xs bg-white rounded p-2 border border-blue-100">
                      <div className="font-bold text-blue-900">{b.bank_name}</div>
                      {b.account_name && (
                        <div className="text-muted-foreground">باسم: {b.account_name}</div>
                      )}
                      {b.account_number && (
                        <div className="font-mono" dir="ltr">
                          رقم الحساب: {b.account_number}
                        </div>
                      )}
                      {b.iban && (
                        <div className="text-muted-foreground font-mono" dir="ltr">
                          IBAN: {b.iban}
                        </div>
                      )}
                      {b.wallet_phone && (
                        <div className="font-mono" dir="ltr">
                          📱 {b.wallet_phone}
                        </div>
                      )}
                      {b.branch && <div className="text-muted-foreground">الفرع: {b.branch}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>المبلغ (ر.ي)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>طريقة الدفع</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="deposit">إيداع بنكي</SelectItem>
                  <SelectItem value="cheque">شيك</SelectItem>
                  <SelectItem value="wallet">محفظة إلكترونية</SelectItem>
                  <SelectItem value="cash">نقدي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {banks.length > 0 ? (
              <div className="space-y-1">
                <Label>الحساب الذي دفعتَ إليه</Label>
                <Select value={bank} onValueChange={setBank}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحساب" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.bank_name}>
                        {b.bank_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>اسم البنك/المحفظة</Label>
                <Input value={bank} onChange={(e) => setBank(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Label>رقم المرجع / العملية</Label>
              <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>صورة الإيصال</Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={handleUpload}
                disabled={uploading}
              />
              {filePath && <div className="text-xs text-emerald-600">✅ تم رفع الإيصال</div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(null)}>
              إلغاء
            </Button>
            <Button
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending || uploading}
            >
              {payMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <Upload className="h-4 w-4 ml-1" />
              )}
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
}
