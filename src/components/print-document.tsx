import type { ReactNode } from "react";
import { ArrowRight, Printer } from "lucide-react";

export interface PrintSettings {
  company_name: string;
  company_phone: string | null;
  company_address: string | null;
  company_logo: string | null;
  currency: string;
  currency_symbol: string;
  invoice_title: string;
  invoice_subtitle: string | null;
  invoice_footer: string | null;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  company_name: "إيجاري EJARI",
  company_phone: null,
  company_address: null,
  company_logo: null,
  currency: "YER",
  currency_symbol: "ر.ي",
  invoice_title: "فاتورة إيجار وخدمات",
  invoice_subtitle: null,
  invoice_footer: "شكراً لتعاملكم معنا",
};

interface PrintPageShellProps {
  children: ReactNode;
  documentTitle: string;
  onBack: () => void;
}

export function PrintPageShell({ children, documentTitle, onBack }: PrintPageShellProps) {
  return (
    <main className="print-page min-h-screen bg-slate-100 px-4 py-6 text-slate-950" dir="rtl">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800"
        >
          <Printer className="h-4 w-4" />
          طباعة / حفظ PDF
        </button>
      </div>

      <article
        className="print-sheet mx-auto min-h-[280mm] max-w-[210mm] bg-white p-[12mm] shadow-xl"
        aria-label={documentTitle}
      >
        {children}
      </article>
    </main>
  );
}

interface CompanyPrintHeaderProps {
  settings: PrintSettings;
  documentLabel: string;
  documentNumber: string;
  accent?: "blue" | "emerald";
}

export function CompanyPrintHeader({
  settings,
  documentLabel,
  documentNumber,
  accent = "blue",
}: CompanyPrintHeaderProps) {
  const accentClass = accent === "emerald" ? "border-emerald-700" : "border-blue-800";
  return (
    <header className={`flex items-start justify-between gap-6 border-b-4 pb-6 ${accentClass}`}>
      <div className="flex min-w-0 items-center gap-4">
        {settings.company_logo ? (
          <img
            src={settings.company_logo}
            alt={settings.company_name}
            className="h-20 w-20 shrink-0 object-contain"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-center text-sm font-black text-white">
            إيجاري
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-950">{settings.company_name}</h1>
          {settings.company_address && (
            <p className="mt-1 text-sm text-slate-600">{settings.company_address}</p>
          )}
          {settings.company_phone && (
            <p className="mt-1 text-sm text-slate-600" dir="ltr">
              {settings.company_phone}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 text-left">
        <div className="text-sm font-bold text-slate-500">{documentLabel}</div>
        <div className="mt-2 font-mono text-xl font-black tracking-wide text-slate-950">
          {documentNumber}
        </div>
      </div>
    </header>
  );
}

export function PrintInfoGrid({ children }: { children: ReactNode }) {
  return (
    <section className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 rounded-xl bg-slate-50 p-5">
      {children}
    </section>
  );
}

export function PrintInfo({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: ReactNode;
  ltr?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-slate-950" dir={ltr ? "ltr" : undefined}>
        {value || "—"}
      </div>
    </div>
  );
}

export function PrintMoney({
  value,
  settings,
}: {
  value: number | null | undefined;
  settings: PrintSettings;
}) {
  return <span className="tabular-nums">{formatPrintMoney(value, settings)}</span>;
}

export function formatPrintMoney(
  value: number | null | undefined,
  settings: PrintSettings,
): string {
  const amount = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("ar-YE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${formatted} ${settings.currency_symbol || settings.currency || "ر.ي"}`;
}

export function PrintNotice({
  title,
  children,
  tone = "amber",
}: {
  title: string;
  children: ReactNode;
  tone?: "amber" | "emerald" | "rose";
}) {
  const toneClasses = {
    amber: "border-amber-300 bg-amber-50 text-amber-950",
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-950",
    rose: "border-rose-300 bg-rose-50 text-rose-950",
  };

  return (
    <section className={`mt-7 rounded-xl border p-4 text-sm leading-7 ${toneClasses[tone]}`}>
      <h2 className="font-black">{title}</h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}

export function PrintSignatures({
  rightLabel,
  leftLabel,
}: {
  rightLabel: string;
  leftLabel: string;
}) {
  return (
    <section className="mt-14 grid grid-cols-2 gap-20 text-center text-sm">
      <div>
        <div className="font-bold text-slate-700">{rightLabel}</div>
        <div className="mx-auto mt-12 w-40 border-t border-dashed border-slate-500 pt-2 text-xs text-slate-400">
          الاسم والتوقيع
        </div>
      </div>
      <div>
        <div className="font-bold text-slate-700">{leftLabel}</div>
        <div className="mx-auto mt-12 w-40 border-t border-dashed border-slate-500 pt-2 text-xs text-slate-400">
          الاسم والتوقيع
        </div>
      </div>
    </section>
  );
}

export function PrintFooter({ text }: { text: string | null | undefined }) {
  return (
    <footer className="mt-12 border-t border-slate-200 pt-4 text-center text-xs leading-6 text-slate-500">
      {text || "تم إنشاء هذا المستند إلكترونياً بواسطة نظام إيجاري EJARI"}
    </footer>
  );
}
