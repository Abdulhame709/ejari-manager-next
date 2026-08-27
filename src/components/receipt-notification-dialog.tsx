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

export type ReceiptNotificationData = {
  id: string;
  receiptNo: string;
  customerName: string;
  customerPhone: string | null;
  receiptDate: string;
  amount: number;
  paymentMethod: string;
};

type ReceiptNotificationDialogProps = {
  receipt: ReceiptNotificationData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  check: "شيك",
  cheque: "شيك",
  transfer: "تحويل",
  deposit: "إيداع",
  wallet: "محفظة",
};

export function ReceiptNotificationDialog({
  receipt,
  open,
  onOpenChange,
}: ReceiptNotificationDialogProps) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !receipt) return;
    setPhone(receipt.customerPhone ?? "");
    setMessage(buildReceiptMessage(receipt));
  }, [open, receipt]);

  const normalizedPhone = useMemo(() => normalizeWhatsAppPhone(phone), [phone]);
  const hasRecipient = normalizedPhone.length >= 8;
  const whatsappHref = hasRecipient
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
    : undefined;
  const smsHref = hasRecipient
    ? `sms:${normalizedPhone}?body=${encodeURIComponent(message)}`
    : undefined;

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
            إشعار استلام دفعة
          </DialogTitle>
          <DialogDescription>
            راجع الرقم والنص ثم افتح التطبيق المناسب. الإرسال لا يتم تلقائياً من النظام.
          </DialogDescription>
        </DialogHeader>

        {receipt && (
          <div className="grid gap-2 rounded-lg border bg-muted/35 p-3 text-sm sm:grid-cols-2">
            <span>
              <strong>السند:</strong> {receipt.receiptNo}
            </span>
            <span>
              <strong>المستأجر:</strong> {receipt.customerName}
            </span>
            <span>
              <strong>التاريخ:</strong> {receipt.receiptDate}
            </span>
            <span>
              <strong>المبلغ:</strong> {formatMoney(receipt.amount)}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="receipt-notification-phone">رقم الجوال</Label>
          <Input
            id="receipt-notification-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            dir="ltr"
            inputMode="tel"
            placeholder="مثال: 777123456 أو +967777123456"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="receipt-notification-message">نص الإشعار</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => void copyMessage()}>
              <Copy className="ml-1 h-4 w-4" /> نسخ النص
            </Button>
          </div>
          <Textarea
            id="receipt-notification-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-32 leading-7"
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
              <span>
                <MessageSquareText className="ml-1 inline h-4 w-4" /> فتح تطبيق SMS
              </span>
            )}
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!whatsappHref}
            asChild={!!whatsappHref}
          >
            {whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <ExternalLink className="ml-1 h-4 w-4" /> فتح واتساب
              </a>
            ) : (
              <span>
                <ExternalLink className="ml-1 inline h-4 w-4" /> فتح واتساب
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildReceiptMessage(receipt: ReceiptNotificationData) {
  const method = PAYMENT_METHOD_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod;
  return `عزيزي/عزيزتي ${receipt.customerName}، تم استلام مبلغ ${formatMoney(receipt.amount)} بتاريخ ${receipt.receiptDate} بموجب سند القبض رقم ${receipt.receiptNo} وطريقة الدفع ${method}. شكراً لتعاونكم. إدارة إيجاري.`;
}

function normalizeWhatsAppPhone(value: string) {
  let digits = value.trim().replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^7\d{8}$/.test(digits)) return `967${digits}`;
  return digits;
}
