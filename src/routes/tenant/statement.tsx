import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RouteGuard } from "@/components/route-guard";
import { Card } from "@/components/ui/card";
import { ChevronLeft, FileText, Wallet, Receipt } from "lucide-react";
import TenantLayout from "./-tenant-layout";
import { format } from "date-fns";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/tenant/statement")({
  head: () => ({
    meta: [{ title: "كشف الحساب — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={["tenant"]} redirectTo="/login">
      <TenantStatement />
    </RouteGuard>
  ),
});

function TenantStatement() {
  const { customerId } = useAuth();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["tenant-statement", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      if (!customerId) return [];
      // Get invoices (debits) and receipts (credits)
      const [invRes, rcpRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_no, invoice_date, total_amount, paid_amount, remaining_amount")
          .eq("customer_id", customerId)
          .order("invoice_date"),
        supabase
          .from("receipts")
          .select("id, receipt_no, receipt_date, amount")
          .eq("customer_id", customerId)
          .eq("is_active", true)
          .order("receipt_date"),
      ]);
      const invs = (invRes.data ?? []).map(
        (i: {
          id: string;
          invoice_no: string;
          invoice_date: string;
          total_amount: number;
          paid_amount: number | null;
          remaining_amount: number | null;
        }) => ({
          id: i.id,
          type: "invoice" as const,
          date: i.invoice_date,
          ref: i.invoice_no,
          debit: i.total_amount,
          credit: 0,
          balance: 0,
        }),
      );
      const rcps = (rcpRes.data ?? []).map(
        (r: { id: string; receipt_no: string; receipt_date: string; amount: number }) => ({
          id: r.id,
          type: "receipt" as const,
          date: r.receipt_date,
          ref: r.receipt_no,
          debit: 0,
          credit: r.amount,
          balance: 0,
        }),
      );
      const all = [...invs, ...rcps].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      let running = 0;
      for (const e of all) {
        running += e.debit - e.credit;
        e.balance = running;
      }
      return all;
    },
  });

  const balance = entries.length > 0 ? entries[entries.length - 1].balance : 0;

  return (
    <TenantLayout>
      <div className="space-y-4">
        <Link to="/tenant" className="text-xs text-primary inline-flex items-center">
          <ChevronLeft className="h-3 w-3 ml-1" />
          العودة للرئيسية
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          كشف الحساب
        </h1>

        <Card className={`p-5 ${balance > 0 ? "bg-destructive/10" : "bg-emerald-500/10"}`}>
          <div className="text-xs text-muted-foreground">الرصيد الحالي</div>
          <div
            className={`text-2xl font-bold mt-1 ${balance > 0 ? "text-destructive" : "text-emerald-600"}`}
          >
            {balance > 0
              ? `مستحق عليك: ${formatMoney(balance)}`
              : balance < 0
                ? `رصيد دائن: ${formatMoney(Math.abs(balance))}`
                : "رصيدك صفر"}
          </div>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">جارٍ التحميل...</div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد حركات</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right">التاريخ</th>
                  <th className="px-3 py-2 text-right">البيان</th>
                  <th className="px-3 py-2 text-center">مدين</th>
                  <th className="px-3 py-2 text-center">دائن</th>
                  <th className="px-3 py-2 text-center">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2 text-xs">{format(new Date(e.date), "yyyy/MM/dd")}</td>
                    <td className="px-3 py-2">
                      {e.type === "invoice" ? (
                        <Link
                          to="/invoices/$invoiceId/print"
                          params={{ invoiceId: e.id }}
                          target="_blank"
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          <Receipt className="h-3 w-3 text-destructive" />
                          {e.ref}
                        </Link>
                      ) : (
                        <Link
                          to="/receipts/$receiptId/print"
                          params={{ receiptId: e.id }}
                          target="_blank"
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          <Wallet className="h-3 w-3 text-emerald-600" />
                          {e.ref}
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {e.debit > 0 ? formatMoney(e.debit) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums text-emerald-600">
                      {e.credit > 0 ? formatMoney(e.credit) : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-center font-semibold tabular-nums ${e.balance > 0 ? "text-destructive" : "text-emerald-600"}`}
                    >
                      {formatMoney(e.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </TenantLayout>
  );
}
