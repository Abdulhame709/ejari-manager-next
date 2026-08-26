import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, MessageCircle, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";

export type InvoiceNotificationData = {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string | null;
  shopName: string;
  monthLabel: string;
  totalAmount: number;
  remainingAmount: number;
  dueDate: string | null;
};

type InvoiceNotificationDialogProps = {
  invoice: InvoiceNotificationData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InvoiceNotificationDialog({
  invoice,
  open,
  onOpenChange,
}: InvoiceNotificationDialogProps) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !invoice) return;
    setPhone(invoice.customerPhone ?? "");
    setMessage(buildInvoiceMessage(invoice));
  }, [invoice, open]);

  const normalizedPhone = useMemo(() => normalizeWhatsAppPhone(phone), [phone]);
  const hasRecipient = normalizedPhone.length >= 8;
  const whatsappHref = hasRecipient
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
    : undefined;
  const smsHref = hasRecipient ? `sms:${normalizedPhone}?body=${encodeURIComponent(message)}` : undefined;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("تم نسخ نص الإشعار");
    } catch {
      toast.error("تعذر نسخ النص تلقائياً؛ انسخه من مربع الرسالة");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            إشعار فاتورة للمستأجر
          </DialogTitle>
          <DialogDescription>
            راجع الرقم والنص أولاً. لن تُرسل أي رسالة تلقائياً؛ يفتح الزر التطبيق المختار لتراجع الإرسال وتؤكده بنفسك.
          </DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="rounded-lg border bg-muted/35 p-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <span><strong>الفاتورة:</strong> {invoice.invoiceNo}</span>
              <span><strong>المستأجر:</strong> {invoice.customerName}</span>
              <span><strong>الوحدة:</strong> {invoice.shopName}</span>
              <span><strong>المتبقي:</strong> {formatMoney(invoice.remainingAmount)}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notification-phone">رقم الجوال</Label>
          <Input
            id="notification-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            dir="ltr"
            inputMode="tel"
            placeholder="مثال: 777123456 أو +967777123456"
          />
          <p className="text-xs text-muted-foreground">
            يتم تحويل الرقم اليمني المحلي الذي يبدأ بـ 7 تلقائياً إلى صيغة واتساب الدولية +967. عدّل الرقم عند الحاجة قبل الإرسال.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="notification-message">نص الإشعار</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => void copyMessage()}>
              <Copy className="ml-1 h-4 w-4" /> نسخ النص
            </Button>
          </div>
          <Textarea
            id="notification-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-36 leading-7"
          />
        </div>

        {!hasRecipient && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
            أدخل رقم جوال صحيحاً لإتاحة أزرار فتح تطبيقات الرسائل.
          </p>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-start">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button type="button" variant="outline" disabled={!smsHref} asChild={!!smsHref}>
            {smsHref ? (
              <a href={smsHref}>
                <MessageSquareText className="ml-1 h-4 w-4" /> فتح تطبيق SMS
              </a>
            ) : (
              <span><MessageSquareText className="ml-1 inline h-4 w-4" /> فتح تطبيق SMS</span>
            )}
          </Button>
          <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" disabled={!whatsappHref} asChild={!!whatsappHref}>
            {whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <ExternalLink className="ml-1 h-4 w-4" /> فتح واتساب
              </a>
            ) : (
              <span><ExternalLink className="ml-1 inline h-4 w-4" /> فتح واتساب</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildInvoiceMessage(invoice: InvoiceNotificationData) {
  const dueDateText = invoice.dueDate ? ` موعد الاستحقاق: ${invoice.dueDate}.` : "";
  const balanceText = invoice.remainingAmount > 0
    ? ` المبلغ المتبقي: ${formatMoney(invoice.remainingAmount)}.`
    : " الفاتورة مسددة بالكامل.";

  return `عزيزي/عزيزتي ${invoice.customerName}، فاتورة الوحدة ${invoice.shopName} لشهر ${invoice.monthLabel} برقم ${invoice.invoiceNo} بإجمالي ${formatMoney(invoice.totalAmount)}.${balanceText}${dueDateText} يرجى السداد في أقرب وقت ممكن. إدارة إيجاري.`;
}

function normalizeWhatsAppPhone(value: string) {
  const raw = value.trim();
  let digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^7\d{8}$/.test(digits)) return `967${digits}`;
  return digits;
}
