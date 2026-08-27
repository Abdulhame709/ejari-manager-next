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
import { ARABIC_MONTHS, formatDate, formatNumber } from "@/lib/format";

const INVOICE_PRINT_ROLES = [...PAGE_ROLES.invoices, "tenant"] as const;

export const Route = createFileRoute("/invoices_/$invoiceId/print")({
  head: () => ({
    meta: [{ title: "طباعة الفاتورة — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={INVOICE_PRINT_ROLES}>
      <InvoicePrintPage />
    </RouteGuard>
  ),
});

interface InvoicePrintData {
  id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  invoice_month: number;
  invoice_year: number;
  rent_amount: number;
  holiday_increase: number;
  elec_amount: number;
  water_amount: number;
  previous_balance: number;
  additional_charges: number;
  additional_charges_desc: string | null;
  discount_amount: number | null;
  tax_amount: number | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: "unpaid" | "partial" | "paid";
  elec_prev_reading: number;
  elec_curr_reading: number;
  elec_consumption: number;
  elec_unit_price: number;
  water_prev_reading: number;
  water_curr_reading: number;
  water_consumption: number;
  water_unit_price: number;
  notes: string | null;
  customers: {
    full_name: string;
    phone: string | null;
    email: string | null;
    id_number: string | null;
    address: string | null;
  } | null;
  shops: {
    shop_code: string;
    shop_name: string;
    location_details: string | null;
  } | null;
  contracts: {
    contract_no: string;
    start_date: string;
    end_date: string;
  } | null;
}

const PAYMENT_LABELS: Record<InvoicePrintData["payment_status"], string> = {
  unpaid: "غير مدفوعة",
  partial: "مدفوعة جزئياً",
  paid: "مدفوعة",
};

function InvoicePrintPage() {
  const { invoiceId } = Route.useParams();
  const router = useRouter();

  const invoiceQuery = useQuery<InvoicePrintData>({
    queryKey: ["invoice-print", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          `
          *,
          customers(full_name, phone, email, id_number, address),
          shops(shop_code, shop_name, location_details),
          contracts(contract_no, start_date, end_date)
        `,
        )
        .eq("id", invoiceId)
        .single();
      if (error) throw error;
      return data as unknown as InvoicePrintData;
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

  if (invoiceQuery.isLoading || settingsQuery.isLoading) return <PrintLoading />;
  if (invoiceQuery.isError || !invoiceQuery.data) {
    return <PrintError message="تعذر تحميل الفاتورة أو لا تملك صلاحية عرضها." />;
  }

  const invoice = invoiceQuery.data;
  const settings = settingsQuery.data ?? DEFAULT_PRINT_SETTINGS;
  const lineItems = [
    { label: "إيجار الوحدة", description: "القيمة الإيجارية الشهرية", amount: invoice.rent_amount },
    {
      label: "زيادة موسمية",
      description: "الزيادة المحددة في العقد",
      amount: invoice.holiday_increase,
    },
    {
      label: "استهلاك الكهرباء",
      description: invoice.elec_consumption
        ? `${formatNumber(invoice.elec_consumption)} وحدة × ${formatNumber(invoice.elec_unit_price)}`
        : "رسوم كهرباء ثابتة",
      amount: invoice.elec_amount,
    },
    {
      label: "استهلاك المياه",
      description: invoice.water_consumption
        ? `${formatNumber(invoice.water_consumption)} وحدة × ${formatNumber(invoice.water_unit_price)}`
        : "رسوم مياه ثابتة",
      amount: invoice.water_amount,
    },
    {
      label: "رصيد سابق",
      description: "الرصيد المرحّل قبل هذه الفاتورة",
      amount: invoice.previous_balance,
    },
    {
      label: "رسوم إضافية",
      description: invoice.additional_charges_desc || "رسوم وخدمات إضافية",
      amount: invoice.additional_charges,
    },
    { label: "ضريبة", description: "الضريبة المضافة", amount: invoice.tax_amount ?? 0 },
    {
      label: "خصم",
      description: "خصم على إجمالي الفاتورة",
      amount: -(invoice.discount_amount ?? 0),
    },
  ].filter((item) => Math.abs(item.amount) > 0.001);

  return (
    <PrintPageShell
      documentTitle={`فاتورة ${invoice.invoice_no}`}
      onBack={() => {
        if (window.opener) window.close();
        else router.history.back();
      }}
    >
      <CompanyPrintHeader
        settings={settings}
        documentLabel={settings.invoice_title || "فاتورة إيجار وخدمات"}
        documentNumber={invoice.invoice_no}
      />

      {settings.invoice_subtitle && (
        <p className="mt-4 text-center text-sm font-semibold text-slate-600">
          {settings.invoice_subtitle}
        </p>
      )}

      <PrintInfoGrid>
        <PrintInfo label="المستأجر" value={invoice.customers?.full_name} />
        <PrintInfo label="رقم الهاتف" value={invoice.customers?.phone} ltr />
        <PrintInfo
          label="الوحدة"
          value={`${invoice.shops?.shop_code ?? "—"} — ${invoice.shops?.shop_name ?? "—"}`}
        />
        <PrintInfo label="رقم العقد" value={invoice.contracts?.contract_no} ltr />
        <PrintInfo label="تاريخ الفاتورة" value={formatDate(invoice.invoice_date)} />
        <PrintInfo label="تاريخ الاستحقاق" value={formatDate(invoice.due_date)} />
        <PrintInfo
          label="فترة الفاتورة"
          value={`${ARABIC_MONTHS[invoice.invoice_month - 1] ?? invoice.invoice_month} ${invoice.invoice_year}`}
        />
        <PrintInfo label="حالة الدفع" value={PAYMENT_LABELS[invoice.payment_status]} />
      </PrintInfoGrid>

      <section className="mt-7">
        <h2 className="mb-3 text-base font-black text-slate-900">تفاصيل الفاتورة</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="border border-slate-300 px-3 py-3 text-right">البيان</th>
              <th className="border border-slate-300 px-3 py-3 text-right">التفاصيل</th>
              <th className="border border-slate-300 px-3 py-3 text-left">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.label}>
                <td className="border border-slate-300 px-3 py-3 font-bold">{item.label}</td>
                <td className="border border-slate-300 px-3 py-3 text-slate-600">
                  {item.description}
                </td>
                <td className="border border-slate-300 px-3 py-3 text-left font-bold">
                  <PrintMoney value={item.amount} settings={settings} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 text-base font-black">
              <td colSpan={2} className="border border-slate-300 px-3 py-3">
                إجمالي الفاتورة
              </td>
              <td className="border border-slate-300 px-3 py-3 text-left">
                <PrintMoney value={invoice.total_amount} settings={settings} />
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {(invoice.elec_consumption > 0 || invoice.water_consumption > 0) && (
        <section className="mt-7 grid grid-cols-2 gap-4 text-sm">
          {invoice.elec_consumption > 0 && (
            <MeterBox
              title="قراءة الكهرباء"
              previous={invoice.elec_prev_reading}
              current={invoice.elec_curr_reading}
              consumption={invoice.elec_consumption}
            />
          )}
          {invoice.water_consumption > 0 && (
            <MeterBox
              title="قراءة المياه"
              previous={invoice.water_prev_reading}
              current={invoice.water_curr_reading}
              consumption={invoice.water_consumption}
            />
          )}
        </section>
      )}

      <section className="mt-7 mr-auto w-full max-w-sm overflow-hidden rounded-xl border border-slate-300 text-sm">
        <SummaryRow
          label="إجمالي الفاتورة"
          value={<PrintMoney value={invoice.total_amount} settings={settings} />}
        />
        <SummaryRow
          label="المبلغ المدفوع"
          value={<PrintMoney value={invoice.paid_amount} settings={settings} />}
        />
        <SummaryRow
          label="المبلغ المتبقي"
          value={<PrintMoney value={invoice.remaining_amount} settings={settings} />}
          strong
        />
      </section>

      {invoice.remaining_amount > 0.01 ? (
        <PrintNotice title="تنبيه استحقاق" tone="amber">
          يرجى سداد الرصيد المتبقي وقدره{" "}
          <PrintMoney value={invoice.remaining_amount} settings={settings} /> في أقرب وقت ممكن
          {invoice.due_date ? `، وموعد الاستحقاق هو ${formatDate(invoice.due_date)}.` : "."}
        </PrintNotice>
      ) : (
        <PrintNotice title="حالة السداد" tone="emerald">
          تم سداد هذه الفاتورة بالكامل وفق الرصيد المسجل في النظام.
        </PrintNotice>
      )}

      {invoice.notes && (
        <section className="mt-7 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="font-bold text-amber-900">ملاحظات</div>
          <p className="mt-1 whitespace-pre-wrap text-amber-950">{invoice.notes}</p>
        </section>
      )}

      <PrintSignatures rightLabel="المحاسب" leftLabel="المستأجر" />
      <PrintFooter text={settings.invoice_footer} />
    </PrintPageShell>
  );
}

function MeterBox({
  title,
  previous,
  current,
  consumption,
}: {
  title: string;
  previous: number;
  current: number;
  consumption: number;
}) {
  return (
    <div className="rounded-xl border border-slate-300 p-4">
      <h3 className="font-black text-slate-900">{title}</h3>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <ReadingValue label="السابقة" value={previous} />
        <ReadingValue label="الحالية" value={current} />
        <ReadingValue label="الاستهلاك" value={consumption} strong />
      </div>
    </div>
  );
}

function ReadingValue({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 tabular-nums ${strong ? "font-black text-blue-800" : "font-bold"}`}>
        {formatNumber(value)}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 border-b border-slate-200 px-4 py-3 last:border-0 ${strong ? "bg-blue-800 font-black text-white" : ""}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PrintLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100" dir="rtl">
      <div className="text-center">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-blue-700" />
        <p className="mt-3 text-sm font-bold text-slate-600">جارٍ تجهيز الفاتورة...</p>
      </div>
    </div>
  );
}

function PrintError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4" dir="rtl">
      <div className="max-w-md rounded-xl border border-rose-200 bg-white p-8 text-center shadow">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-4 text-lg font-black">تعذر تجهيز الفاتورة</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}
