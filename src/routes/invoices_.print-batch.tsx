import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Printer,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RouteGuard } from "@/components/route-guard";
import {
  DEFAULT_PRINT_SETTINGS,
  formatPrintMoney,
  type PrintSettings,
} from "@/components/print-document";
import { PAGE_ROLES } from "@/lib/access-control";
import { ARABIC_MONTHS, formatDate, formatNumber } from "@/lib/format";

const MAX_BATCH_INVOICES = 120;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BatchLayout = 2 | 4 | 6;
type SortMode = "customer" | "shop" | "invoice_no" | "date";

export const Route = createFileRoute("/invoices_/print-batch")({
  validateSearch: (search: Record<string, unknown>) => ({
    ids: typeof search.ids === "string" ? search.ids : "",
  }),
  head: () => ({
    meta: [
      { title: "طباعة جماعية للفواتير — إيجاري" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <RouteGuard allowedRoles={PAGE_ROLES.invoices}>
      <InvoiceBatchPrintPage />
    </RouteGuard>
  ),
});

interface BatchInvoice {
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
  customers: { full_name: string; phone: string | null } | null;
  shops: { shop_code: string; shop_name: string } | null;
  contracts: { contract_no: string } | null;
}

const PAYMENT_LABELS: Record<BatchInvoice["payment_status"], string> = {
  unpaid: "غير مدفوعة",
  partial: "مدفوعة جزئياً",
  paid: "مدفوعة",
};

function InvoiceBatchPrintPage() {
  const { ids: rawIds } = Route.useSearch();
  const router = useRouter();
  const [layout, setLayout] = useState<BatchLayout>(4);
  const [sortMode, setSortMode] = useState<SortMode>("customer");
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);

  const invoiceIds = useMemo(
    () =>
      [...new Set(rawIds.split(",").filter((id) => UUID_PATTERN.test(id)))].slice(
        0,
        MAX_BATCH_INVOICES,
      ),
    [rawIds],
  );

  const invoicesQuery = useQuery<BatchInvoice[]>({
    queryKey: ["invoice-batch-print", invoiceIds],
    enabled: invoiceIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          `
          *,
          customers(full_name, phone),
          shops(shop_code, shop_name),
          contracts(contract_no)
        `,
        )
        .in("id", invoiceIds);
      if (error) throw error;
      return (data ?? []) as unknown as BatchInvoice[];
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

  const invoices = useMemo(() => invoicesQuery.data ?? [], [invoicesQuery.data]);
  const automaticallySortedInvoices = useMemo(
    () => sortInvoices(invoices, sortMode),
    [invoices, sortMode],
  );
  const orderedInvoices = useMemo(() => {
    if (!manualOrder) return automaticallySortedInvoices;
    const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    const manuallyOrdered = manualOrder
      .map((invoiceId) => invoicesById.get(invoiceId))
      .filter((invoice): invoice is BatchInvoice => Boolean(invoice));
    const manuallyOrderedIds = new Set(manuallyOrdered.map((invoice) => invoice.id));
    return [
      ...manuallyOrdered,
      ...automaticallySortedInvoices.filter((invoice) => !manuallyOrderedIds.has(invoice.id)),
    ];
  }, [automaticallySortedInvoices, invoices, manualOrder]);
  const printPages = useMemo(() => chunk(orderedInvoices, layout), [orderedInvoices, layout]);

  function moveInvoice(invoiceId: string, direction: "up" | "down") {
    setManualOrder((currentOrder) => {
      const nextOrder = currentOrder
        ? [...currentOrder]
        : orderedInvoices.map((invoice) => invoice.id);
      const index = nextOrder.indexOf(invoiceId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= nextOrder.length) return nextOrder;
      [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
      return nextOrder;
    });
  }

  if (invoiceIds.length === 0) {
    return <BatchPrintError message="لم يتم اختيار فواتير صالحة للطباعة الجماعية." />;
  }
  if (invoicesQuery.isLoading || settingsQuery.isLoading) return <BatchPrintLoading />;
  if (invoicesQuery.isError || settingsQuery.isError) {
    return <BatchPrintError message="تعذر تجهيز الفواتير أو لا تملك صلاحية عرض إحداها." />;
  }
  if (invoices.length === 0) {
    return (
      <BatchPrintError message="لم تعد الفواتير المحددة متاحة للطباعة أو لا تملك صلاحية عرضها." />
    );
  }

  const settings = settingsQuery.data ?? DEFAULT_PRINT_SETTINGS;
  const inaccessibleCount = invoiceIds.length - invoices.length;

  return (
    <main className="batch-print-page min-h-screen bg-slate-100 px-4 py-6 text-slate-950" dir="rtl">
      <style>{BATCH_PRINT_CSS}</style>
      <section className="no-print mx-auto mb-4 max-w-[210mm] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-black">طباعة جماعية للفواتير</h1>
            <p className="mt-1 text-xs text-slate-500">
              {invoices.length} فاتورة مرتبة على {printPages.length} صفحة A4
              {inaccessibleCount > 0 ? ` — تم استبعاد ${inaccessibleCount} فاتورة غير متاحة.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.opener) window.close();
                else router.history.back();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowRight className="h-4 w-4" /> رجوع
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800"
            >
              <Printer className="h-4 w-4" /> طباعة / حفظ PDF
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            ترتيب الفواتير
            <select
              value={sortMode}
              onChange={(event) => {
                setSortMode(event.target.value as SortMode);
                setManualOrder(null);
              }}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
            >
              <option value="customer">المستأجر ثم الوحدة</option>
              <option value="shop">كود الوحدة ثم المستأجر</option>
              <option value="invoice_no">رقم الفاتورة</option>
              <option value="date">تاريخ الإصدار</option>
            </select>
          </label>
          <fieldset className="text-xs font-bold text-slate-600">
            <legend>عدد الفواتير في صفحة A4</legend>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {([2, 4, 6] as BatchLayout[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLayout(value)}
                  className={`h-10 rounded-md border text-sm font-black transition ${
                    layout === value
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {value} فواتير
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-black text-slate-700">ترتيب يدوي قبل الطباعة</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                قدّم أو أخّر أي فاتورة؛ يتغير توزيعها بين صفحات الطباعة فوراً.
              </p>
            </div>
            {manualOrder && (
              <button
                type="button"
                onClick={() => setManualOrder(null)}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" /> إعادة للترتيب التلقائي
              </button>
            )}
          </div>
          <ol className="mt-3 grid max-h-52 gap-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 sm:grid-cols-2">
            {orderedInvoices.map((invoice, index) => (
              <li
                key={invoice.id}
                className="flex min-w-0 items-center gap-2 rounded border border-slate-100 px-2 py-1.5 text-xs"
              >
                <span className="w-5 shrink-0 text-center font-mono text-slate-400">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold" title={invoice.invoice_no}>
                  {invoice.invoice_no} — {invoice.shops?.shop_code ?? "—"} —{" "}
                  {invoice.customers?.full_name ?? "—"}
                </span>
                <span className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveInvoice(invoice.id, "up")}
                    className="rounded p-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`تقديم الفاتورة ${invoice.invoice_no}`}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === orderedInvoices.length - 1}
                    onClick={() => moveInvoice(invoice.id, "down")}
                    className="rounded p-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`تأخير الفاتورة ${invoice.invoice_no}`}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </section>

      <div className="mx-auto max-w-[210mm] space-y-6">
        {printPages.map((pageInvoices, pageIndex) => (
          <section
            key={`${layout}-${pageIndex}-${pageInvoices.map((invoice) => invoice.id).join("-")}`}
            className={`batch-print-sheet batch-layout-${layout}`}
            aria-label={`صفحة الطباعة ${pageIndex + 1}`}
          >
            {pageInvoices.map((invoice) => (
              <BatchInvoiceCard key={invoice.id} invoice={invoice} settings={settings} />
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}

function BatchInvoiceCard({
  invoice,
  settings,
}: {
  invoice: BatchInvoice;
  settings: PrintSettings;
}) {
  const lineItems = [
    { label: "الإيجار", amount: invoice.rent_amount },
    { label: "زيادة موسمية", amount: invoice.holiday_increase },
    { label: "كهرباء", amount: invoice.elec_amount },
    { label: "مياه", amount: invoice.water_amount },
    { label: "رصيد سابق", amount: invoice.previous_balance },
    { label: invoice.additional_charges_desc || "رسوم إضافية", amount: invoice.additional_charges },
    { label: "ضريبة", amount: invoice.tax_amount ?? 0 },
    { label: "خصم", amount: -(invoice.discount_amount ?? 0) },
  ].filter((item) => Math.abs(item.amount) > 0.001);

  return (
    <article className="batch-invoice-card">
      <header className="batch-invoice-header">
        <div className="min-w-0">
          <div className="truncate font-black">{settings.company_name}</div>
          <div className="text-[0.65em] text-slate-600">
            {settings.invoice_title || "فاتورة إيجار وخدمات"}
          </div>
        </div>
        {settings.company_logo ? (
          <img
            src={settings.company_logo}
            alt={settings.company_name}
            className="h-8 w-8 shrink-0 object-contain"
          />
        ) : null}
        <div className="shrink-0 text-left font-mono text-[0.7em] font-black">
          {invoice.invoice_no}
        </div>
      </header>

      <div className="batch-invoice-meta">
        <span>
          المستأجر: <strong>{invoice.customers?.full_name ?? "—"}</strong>
        </span>
        <span>
          الوحدة:{" "}
          <strong>
            {invoice.shops?.shop_code ?? "—"} — {invoice.shops?.shop_name ?? "—"}
          </strong>
        </span>
        <span>
          الفترة:{" "}
          <strong>
            {ARABIC_MONTHS[invoice.invoice_month - 1] ?? invoice.invoice_month}{" "}
            {invoice.invoice_year}
          </strong>
        </span>
      </div>

      <table className="batch-invoice-table">
        <thead>
          <tr>
            <th>البيان</th>
            <th>التفاصيل</th>
            <th>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td className="text-slate-600">
                {item.label === "كهرباء" && invoice.elec_consumption > 0
                  ? `${formatNumber(invoice.elec_consumption)} × ${formatNumber(invoice.elec_unit_price)}`
                  : item.label === "مياه" && invoice.water_consumption > 0
                    ? `${formatNumber(invoice.water_consumption)} × ${formatNumber(invoice.water_unit_price)}`
                    : "—"}
              </td>
              <td className="text-left font-bold">{formatPrintMoney(item.amount, settings)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>إجمالي الفاتورة</td>
            <td className="text-left">{formatPrintMoney(invoice.total_amount, settings)}</td>
          </tr>
        </tfoot>
      </table>

      <footer className="batch-invoice-footer">
        <span>
          {PAYMENT_LABELS[invoice.payment_status]} — المتبقي:{" "}
          {formatPrintMoney(invoice.remaining_amount, settings)}
        </span>
        <span>تاريخ الإصدار: {formatDate(invoice.invoice_date)}</span>
      </footer>
    </article>
  );
}

function sortInvoices(invoices: BatchInvoice[], mode: SortMode) {
  const copy = [...invoices];
  const compareText = (left: string | null | undefined, right: string | null | undefined) =>
    (left ?? "").localeCompare(right ?? "", "ar");

  return copy.sort((left, right) => {
    if (mode === "customer") {
      return (
        compareText(left.customers?.full_name, right.customers?.full_name) ||
        compareText(left.shops?.shop_code, right.shops?.shop_code) ||
        compareText(left.invoice_no, right.invoice_no)
      );
    }
    if (mode === "shop") {
      return (
        compareText(left.shops?.shop_code, right.shops?.shop_code) ||
        compareText(left.customers?.full_name, right.customers?.full_name) ||
        compareText(left.invoice_no, right.invoice_no)
      );
    }
    if (mode === "date") {
      return (
        new Date(left.invoice_date).getTime() - new Date(right.invoice_date).getTime() ||
        compareText(left.invoice_no, right.invoice_no)
      );
    }
    return compareText(left.invoice_no, right.invoice_no);
  });
}

function chunk<T>(items: T[], size: number) {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    pages.push(items.slice(index, index + size));
  return pages;
}

function BatchPrintLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100" dir="rtl">
      <div className="text-center">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-blue-700" />
        <p className="mt-3 text-sm font-bold text-slate-600">جارٍ تجهيز دفعة الطباعة...</p>
      </div>
    </div>
  );
}

function BatchPrintError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4" dir="rtl">
      <div className="max-w-md rounded-xl border border-rose-200 bg-white p-8 text-center shadow">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-4 text-lg font-black">تعذر تجهيز الطباعة الجماعية</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}

const BATCH_PRINT_CSS = `
.batch-print-sheet {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  background: white;
  padding: 10px;
  box-shadow: 0 12px 28px rgb(15 23 42 / 0.16);
}
.batch-invoice-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: white;
  padding: 10px;
  font-size: 12px;
}
.batch-invoice-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; }
.batch-invoice-meta { display: grid; gap: 3px; margin: 7px 0; font-size: 0.9em; }
.batch-invoice-table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
.batch-invoice-table th { background: #1e3a8a; color: white; padding: 4px; text-align: right; }
.batch-invoice-table td { border-bottom: 1px solid #e2e8f0; padding: 4px; vertical-align: top; }
.batch-invoice-table tfoot td { background: #ecfdf5; border-top: 1px solid #86efac; font-weight: 900; }
.batch-invoice-footer { display: flex; justify-content: space-between; gap: 8px; margin-top: auto; border-top: 1px dashed #cbd5e1; padding-top: 6px; font-size: 0.75em; color: #475569; }
@media print {
  @page { size: A4 portrait; margin: 5mm; }
  body { background: white !important; }
  .no-print { display: none !important; }
  .batch-print-page { background: white !important; padding: 0 !important; }
  .batch-print-page > div { max-width: none !important; margin: 0 !important; }
  .batch-print-sheet { width: 200mm; height: 287mm; box-sizing: border-box; break-after: page; page-break-after: always; gap: 0; padding: 0; box-shadow: none; }
  .batch-print-sheet:last-child { break-after: auto; page-break-after: auto; }
  .batch-layout-2 { grid-template-rows: repeat(1, 287mm); }
  .batch-layout-4 { grid-template-rows: repeat(2, 143.5mm); }
  .batch-layout-6 { grid-template-rows: repeat(3, 95.66mm); }
  .batch-invoice-card { height: 100%; box-sizing: border-box; border: 0.3pt solid #94a3b8; border-radius: 0; padding: 3mm; break-inside: avoid; page-break-inside: avoid; }
  .batch-layout-2 .batch-invoice-card { font-size: 11pt; }
  .batch-layout-4 .batch-invoice-card { font-size: 8pt; }
  .batch-layout-6 .batch-invoice-card { font-size: 5.6pt; padding: 2mm; }
  .batch-invoice-table th, .batch-invoice-table td { padding: 1mm; }
  .batch-layout-6 .batch-invoice-table th, .batch-layout-6 .batch-invoice-table td { padding: 0.55mm; }
  .batch-invoice-header, .batch-invoice-table th, .batch-invoice-table tfoot td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
