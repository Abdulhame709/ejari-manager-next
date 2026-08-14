import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Settings,
  Save,
  Building2,
  Wallet,
  Image as ImageIcon,
  Plus,
  Trash2,
  Loader2,
  Upload,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "الإعدادات — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={["admin", "manager"]}>
      <SettingsPage />
    </RouteGuard>
  ),
});

interface Settings {
  id: number;
  company_name: string;
  company_phone: string | null;
  company_address: string | null;
  company_logo: string | null;
  currency: string;
  currency_symbol: string;
  elec_price_3phase: number;
  elec_price_normal: number;
  fixed_elec_fee: number;
  water_price_per_unit: number;
  fixed_water_fee: number;
  invoice_title: string;
  invoice_subtitle: string | null;
  invoice_footer: string | null;
  updated_at: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string | null;
  iban: string | null;
  wallet_phone: string | null;
  is_active: boolean;
  display_order: number;
}

function SettingsPage() {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () =>
      (await supabase.from("settings").select("*").eq("id", 1).single()).data as Settings,
  });

  const { data: banks = [], isLoading: banksLoading } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: async () =>
      (await supabase.from("bank_accounts").select("*").order("display_order")).data ?? [],
  });

  // Local form state for company/prices
  const [form, setForm] = useState<Partial<Settings> | null>(null);
  React.useEffect(() => {
    // Sync the local form only on first load (avoid clobbering user edits).
    setForm((prev) => prev ?? settings ?? null);
  }, [settings]);

  // When settings reload and form hasn't been touched, sync
  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await supabase.from("settings").update(form).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم حفظ الإعدادات");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل الحفظ")),
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const path = `company-logo/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("unit-images")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("unit-images").getPublicUrl(path);
      const { error: ue } = await supabase
        .from("settings")
        .update({ company_logo: data.publicUrl })
        .eq("id", 1);
      if (ue) throw ue;
      return data.publicUrl;
    },
    onSuccess: (url) => {
      toast.success("✅ تم رفع الشعار");
      setForm((p) => (p ? { ...p, company_logo: url } : p));
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل رفع الشعار")),
  });

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadLogo.mutate(file);
  }

  // Bank account dialog
  const [bankDialog, setBankDialog] = useState<Partial<BankAccount> | null>(null);
  const [deleteBank, setDeleteBank] = useState<BankAccount | null>(null);

  const saveBank = useMutation({
    mutationFn: async () => {
      if (!bankDialog) return;
      if (!bankDialog.bank_name || !bankDialog.account_name)
        throw new Error("اسم البنك واسم الحساب مطلوبان");
      const payload = {
        bank_name: bankDialog.bank_name,
        account_name: bankDialog.account_name,
        account_number: bankDialog.account_number ?? null,
        iban: bankDialog.iban ?? null,
        wallet_phone: bankDialog.wallet_phone ?? null,
        is_active: bankDialog.is_active ?? true,
      };
      if (bankDialog.id) {
        const { error } = await supabase
          .from("bank_accounts")
          .update(payload)
          .eq("id", bankDialog.id);
        if (error) throw error;
      } else {
        const maxOrder = Math.max(0, ...banks.map((b) => b.display_order));
        const { error } = await supabase
          .from("bank_accounts")
          .insert({ ...payload, display_order: maxOrder + 1, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("✅ تم حفظ الحساب البنكي");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      setBankDialog(null);
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل الحفظ")),
  });

  const deleteBankMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم حذف الحساب");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      setDeleteBank(null);
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل الحذف")),
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!form) return null;

  const f = form;
  const set = (k: keyof Settings, v: Settings[keyof Settings]) =>
    setForm((p) => (p ? { ...p, [k]: v } : p));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            الإعدادات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            بيانات الشركة والأسعار والحسابات البنكية
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Company */}
          <Card className="p-5 lg:col-span-2 space-y-4">
            <h2 className="font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              بيانات الشركة
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label>اسم الشركة *</Label>
                <Input
                  value={f.company_name ?? ""}
                  onChange={(e) => set("company_name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>الهاتف</Label>
                <Input
                  value={f.company_phone ?? ""}
                  onChange={(e) => set("company_phone", e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <Label>العملة</Label>
                <div className="flex gap-2">
                  <Input
                    value={f.currency ?? "YER"}
                    onChange={(e) => set("currency", e.target.value)}
                    placeholder="YER"
                    className="w-24"
                  />
                  <Input
                    value={f.currency_symbol ?? "ريال"}
                    onChange={(e) => set("currency_symbol", e.target.value)}
                    placeholder="ريال"
                  />
                </div>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>العنوان</Label>
                <Input
                  value={f.company_address ?? ""}
                  onChange={(e) => set("company_address", e.target.value)}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>شعار الشركة</Label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                    {f.company_logo ? (
                      <img
                        src={f.company_logo}
                        alt="شعار الشركة"
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onLogoChange}
                      disabled={uploadLogo.isPending}
                    />
                    <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent">
                      {uploadLogo.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      رفع شعار
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick save */}
          <Card className="p-5 space-y-3 h-fit">
            <h2 className="font-bold">حفظ التغييرات</h2>
            <p className="text-xs text-muted-foreground">اضغط حفظ بعد تعديل أي من الإعدادات.</p>
            <Button
              className="w-full"
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
            >
              {saveSettings.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <Save className="h-4 w-4 ml-1" />
              )}
              حفظ الإعدادات
            </Button>
          </Card>

          {/* Utility prices */}
          <Card className="p-5 lg:col-span-2 space-y-4">
            <h2 className="font-bold flex items-center gap-2">
              <span className="text-yellow-500">⚡</span>أسعار الخدمات
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>سعر الكهرباء (3 طور) لكل وحدة</Label>
                <Input
                  type="number"
                  value={f.elec_price_3phase ?? 0}
                  onChange={(e) => set("elec_price_3phase", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label>سعر الكهرباء (عادي) لكل وحدة</Label>
                <Input
                  type="number"
                  value={f.elec_price_normal ?? 0}
                  onChange={(e) => set("elec_price_normal", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label>رسوم كهرباء ثابتة (بدون عداد)</Label>
                <Input
                  type="number"
                  value={f.fixed_elec_fee ?? 0}
                  onChange={(e) => set("fixed_elec_fee", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label>سعر الماء لكل وحدة</Label>
                <Input
                  type="number"
                  value={f.water_price_per_unit ?? 0}
                  onChange={(e) => set("water_price_per_unit", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label>رسوم ماء ثابتة</Label>
                <Input
                  type="number"
                  value={f.fixed_water_fee ?? 0}
                  onChange={(e) => set("fixed_water_fee", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </Card>

          {/* Invoice */}
          <Card className="p-5 lg:col-span-3 space-y-4">
            <h2 className="font-bold">إعدادات الفاتورة</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>عنوان الفاتورة</Label>
                <Input
                  value={f.invoice_title ?? ""}
                  onChange={(e) => set("invoice_title", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>عنوان فرعي</Label>
                <Input
                  value={f.invoice_subtitle ?? ""}
                  onChange={(e) => set("invoice_subtitle", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>تذييل الفاتورة</Label>
              <Textarea
                value={f.invoice_footer ?? ""}
                onChange={(e) => set("invoice_footer", e.target.value)}
                rows={3}
              />
            </div>
          </Card>

          {/* Bank accounts */}
          <Card className="p-5 lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                الحسابات البنكية
              </h2>
              <Button size="sm" onClick={() => setBankDialog({})}>
                <Plus className="h-4 w-4 ml-1" />
                إضافة حساب
              </Button>
            </div>
            {banksLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">جارٍ التحميل...</p>
            ) : banks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                لا توجد حسابات بنكية بعد
              </p>
            ) : (
              <div className="divide-y border rounded-lg">
                {banks.map((b) => (
                  <div key={b.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      <div>
                        <div className="font-semibold text-sm">{b.bank_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.account_name} • {b.account_number ?? b.iban ?? b.wallet_phone ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.is_active ? (
                        <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-600 px-2 py-0.5">
                          نشط
                        </span>
                      ) : (
                        <span className="text-[10px] rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                          معطل
                        </span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setBankDialog(b)}
                      >
                        ✏️
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteBank(b)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              هذه الحسابات ستظهر للمستأجر في بوابته عند رفع إيصال الدفع.
            </p>
          </Card>
        </div>
      </div>

      {/* Bank dialog */}
      <Dialog open={!!bankDialog} onOpenChange={(o) => !o && setBankDialog(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          {bankDialog && (
            <>
              <DialogHeader>
                <DialogTitle>{bankDialog.id ? "تعديل حساب بنكي" : "إضافة حساب بنكي"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label>اسم البنك *</Label>
                  <Input
                    value={bankDialog.bank_name ?? ""}
                    onChange={(e) => setBankDialog((p) => ({ ...p!, bank_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>اسم صاحب الحساب *</Label>
                  <Input
                    value={bankDialog.account_name ?? ""}
                    onChange={(e) =>
                      setBankDialog((p) => ({ ...p!, account_name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>رقم الحساب</Label>
                  <Input
                    value={bankDialog.account_number ?? ""}
                    onChange={(e) =>
                      setBankDialog((p) => ({ ...p!, account_number: e.target.value }))
                    }
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <Label>IBAN</Label>
                  <Input
                    value={bankDialog.iban ?? ""}
                    onChange={(e) => setBankDialog((p) => ({ ...p!, iban: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <Label>رقم المحفظة/الهاتف</Label>
                  <Input
                    value={bankDialog.wallet_phone ?? ""}
                    onChange={(e) =>
                      setBankDialog((p) => ({ ...p!, wallet_phone: e.target.value }))
                    }
                    dir="ltr"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bankDialog.is_active !== false}
                    onChange={(e) => setBankDialog((p) => ({ ...p!, is_active: e.target.checked }))}
                    className="accent-primary"
                  />
                  الحساب نشط
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBankDialog(null)}>
                  إلغاء
                </Button>
                <Button onClick={() => saveBank.mutate()} disabled={saveBank.isPending}>
                  {saveBank.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-1" />
                  ) : (
                    <Save className="h-4 w-4 ml-1" />
                  )}
                  حفظ
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteBank} onOpenChange={(o) => !o && setDeleteBank(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف الحساب البنكي</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الحساب "{deleteBank?.bank_name}" نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteBank && deleteBankMutation.mutate(deleteBank.id)}
            >
              {deleteBankMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
