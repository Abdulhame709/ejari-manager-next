import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RouteGuard } from "@/components/route-guard";
import {
  CompanyPrintHeader,
  DEFAULT_PRINT_SETTINGS,
  PrintFooter,
  PrintInfo,
  PrintInfoGrid,
  PrintMoney,
  PrintNotice,
  PrintPageShell,
  PrintSignatures,
  type PrintSettings,
} from "@/components/print-document";
import { PAGE_ROLES } from "@/lib/access-control";
import { ARABIC_MONTHS, formatDate } from "@/lib/format";

const RECEIPT_PRINT_ROLES = [...PAGE_ROLES.receipts, "tenant"] as const;

export const Route = createFileRoute("/receipts_/$receiptId/print")({
  head: () => ({
    meta: [{ title: "طباعة سند القبض — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={RECEIPT_PRINT_ROLES}>
      <ReceiptPrintPage />
    </RouteGuard>
  ),
});

interface ReceiptPrintData {
  id: string;
  receipt_no: string;
  receipt_date: string;
  amount: number;
  payment_method: "cash" | "check" | "cheque" | "transfer" | "deposit" | "wallet";
  reference_no: string | null;
  bank_name: string | null;
  check_number: string | null;
  cheque_no: string | null;
  check_date: string | null;
  cheque_date: string | null;
  notes: string | null;
  status: string | null;
  reversal_of: string | null;
  customers: {
    full_name: string;
    phone: string | null;
    email: string | null;
    id_number: string | null;
    address: string | null;
  } | null;
  receipt_details: Array<{
    amount_paid: number;
    invoices: {
      id: string;
      invoice_no: string;
      invoice_month: number;
      invoice_year: number;
      total_amount: number;
      shops: { shop_code: string; shop_name: string } | null;
    } | null;
  }>;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً",
  check: "شيك",
  cheque: "شيك",
  transfer: "تحويل بنكي",
  deposit: "إيداع بنكي",
  wallet: "محفظة إلكترونية",
};

function ReceiptPrintPage() {
  const { receiptId } = Route.useParams();
  const router = useRouter();

  const receiptQuery = useQuery<ReceiptPrintData>({
    queryKey: ["receipt-print", receiptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select(
          `
          *,
          customers(full_name, phone, email, id_number, address),
          receipt_details(
            amount_paid,
            invoices(id, invoice_no, invoice_month, invoice_year, total_amount, shops(shop_code, shop_name))
          )
        `,
        )
        .eq("id", receiptId)
        .single();
      if (error) throw error;
      return data as unknown as ReceiptPrintData;
    },
  });

  const settingsQuery = useQuery<PrintSettings>({
    queryKey: ["print-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select(
          "company_name,company_phone,company_address,company_logo,currency,currency_symbol,invoice_title,invoice_subtitle,invoice_footer",
        )
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_PRINT_SETTINGS, ...(data ?? {}) } as PrintSettings;
    },
  });

  if (receiptQuery.isLoading || settingsQuery.isLoading) return <PrintLoading />;
  if (receiptQuery.isError || !receiptQuery.data) {
    return <PrintError message="تعذر تحميل سند القبض أو لا تملك صلاحية عرضه." />;
  }

  const receipt = receiptQuery.data;
  const settings = settingsQuery.data ?? DEFAULT_PRINT_SETTINGS;
  const reference = receipt.reference_no || receipt.check_number || receipt.cheque_no;
  const checkDate = receipt.check_date || receipt.cheque_date;
  const isReversal = receipt.status === "reversal" || receipt.amount < 0;

  return (
    <PrintPageShell
      documentTitle={`سند قبض ${receipt.receipt_no}`}
      onBack={() => {
        if (window.opener) window.close();
        else router.history.back();
      }}
    >
      <CompanyPrintHeader
        settings={settings}
        documentLabel={isReversal ? "سند عكس قبض" : "سند قبض"}
        documentNumber={receipt.receipt_no}
        accent="emerald"
      />

      <PrintInfoGrid>
        <PrintInfo label="استلمنا من السيد/السيدة" value={receipt.customers?.full_name} />
        <PrintInfo label="رقم الهاتف" value={receipt.customers?.phone} ltr />
        <PrintInfo label="تاريخ السند" value={formatDate(receipt.receipt_date)} />
        <PrintInfo
          label="طريقة الدفع"
          value={PAYMENT_METHOD_LABELS[receipt.payment_method] ?? receipt.payment_method}
        />
        <PrintInfo label="رقم المرجع / الشيك" value={reference} ltr />
        <PrintInfo label="البنك" value={receipt.bank_name} />
        {checkDate && <PrintInfo label="تاريخ الشيك" value={formatDate(checkDate)} />}
        <PrintInfo
          label="حالة السند"
          value={isReversal ? "سند عكسي" : receipt.status === "cancelled" ? "ملغي" : "مرحل"}
        />
      </PrintInfoGrid>

      <section className="mt-7 rounded-2xl border-2 border-emerald-700 bg-emerald-50 px-6 py-7 text-center">
        <div className="text-sm font-bold text-emerald-900">
          {isReversal ? "مبلغ العكس" : "المبلغ المستلم"}
        </div>
        <div className="mt-3 text-3xl font-black text-emerald-950">
          <PrintMoney value={Math.abs(receipt.amount)} settings={settings} />
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 text-base font-black text-slate-900">توزيع المبلغ على الفواتير</h2>
        {receipt.receipt_details.length > 0 ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="border border-slate-300 px-3 py-3 text-right">رقم الفاتورة</th>
                <th className="border border-slate-300 px-3 py-3 text-right">الوحدة</th>
                <th className="border border-slate-300 px-3 py-3 text-right">الفترة</th>
                <th className="border border-slate-300 px-3 py-3 text-left">المبلغ المسدد</th>
              </tr>
            </thead>
            <tbody>
              {receipt.receipt_details.map((detail, index) => {
                const invoice = detail.invoices;
                return (
                  <tr key={`${invoice?.id ?? "allocation"}-${index}`}>
                    <td className="border border-slate-300 px-3 py-3 font-mono font-bold">
                      {invoice?.invoice_no ?? "—"}
                    </td>
                    <td className="border border-slate-300 px-3 py-3">
                      {invoice?.shops
                        ? `${invoice.shops.shop_code} — ${invoice.shops.shop_name}`
                        : "—"}
                    </td>
                    <td className="border border-slate-300 px-3 py-3">
                      {invoice
                        ? `${ARABIC_MONTHS[invoice.invoice_month - 1] ?? invoice.invoice_month} ${invoice.invoice_year}`
                        : "—"}
                    </td>
                    <td className="border border-slate-300 px-3 py-3 text-left font-black">
                      <PrintMoney value={Math.abs(detail.amount_paid)} settings={settings} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 text-base font-black">
                <td colSpan={3} className="border border-slate-300 px-3 py-3">
                  إجمالي المبلغ الموزع
                </td>
                <td className="border border-slate-300 px-3 py-3 text-left">
                  <PrintMoney
                    value={receipt.receipt_details.reduce(
                      (sum, detail) => sum + Math.abs(detail.amount_paid),
                      0,
                    )}
                    settings={settings}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            دفعة عامة غير موزعة على فاتورة محددة
          </div>
        )}
      </section>

      {isReversal ? (
        <PrintNotice title="تنبيه محاسبي" tone="rose">
          هذا سند عكسي مرتبط بسند قبض سابق. يحتفظ النظام بالسندين لأغراض المراجعة ولا يعد هذا
          المستند إقراراً بقبض مبلغ جديد.
        </PrintNotice>
      ) : receipt.status === "cancelled" ? (
        <PrintNotice title="سند ملغي" tone="rose">
          هذا السند ملغي ولا يثبت قبضاً قائماً. يرجى الرجوع إلى السند العكسي أو سجل العمليات
          المحاسبي عند الحاجة.
        </PrintNotice>
      ) : (
        <PrintNotice title="إقرار استلام" tone="emerald">
          يثبت هذا السند استلام المبلغ الموضح أعلاه وتوزيعه على الفواتير المدرجة، وفق حالة السند
          المسجلة في نظام إيجاري.
        </PrintNotice>
      )}

      {receipt.notes && (
        <section className="mt-7 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm">
          <div className="font-bold text-slate-800">البيان / الملاحظات</div>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{receipt.notes}</p>
        </section>
      )}

      <PrintSignatures rightLabel="المستلم / المحاسب" leftLabel="الدافع / المستأجر" />
      <PrintFooter text={settings.invoice_footer} />
    </PrintPageShell>
  );
}

function PrintLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100" dir="rtl">
      <div className="text-center">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-emerald-700" />
        <p className="mt-3 text-sm font-bold text-slate-600">جارٍ تجهيز سند القبض...</p>
      </div>
    </div>
  );
}

function PrintError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4" dir="rtl">
      <div className="max-w-md rounded-xl border border-rose-200 bg-white p-8 text-center shadow">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-4 text-lg font-black">تعذر تجهيز سند القبض</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}
