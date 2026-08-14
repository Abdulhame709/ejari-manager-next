export const CURRENCY = "ر.ي";

export function formatMoney(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return (
    new Intl.NumberFormat("ar-EG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n) +
    " " +
    CURRENCY
  );
}

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("ar-EG").format(Number(n ?? 0));
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export const ARABIC_MONTHS = [
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
