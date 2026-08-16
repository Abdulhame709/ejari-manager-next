import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Loader2, Pencil, Plus, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { PAGE_ROLES } from "@/lib/access-control";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/meter-types")({
  head: () => ({
    meta: [{ title: "أنواع العدادات — EJARI" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={PAGE_ROLES.meterTypes}>
      <AppLayout>
        <MeterTypesPage />
      </AppLayout>
    </RouteGuard>
  ),
});

type Category = "electricity" | "water";
interface MeterType {
  id: number;
  type_name: string;
  category: Category;
  price_per_unit: number;
  is_fixed_fee: boolean;
  fixed_fee_amount: number;
  is_active: boolean;
}
interface MeterForm {
  id: string;
  type_name: string;
  category: Category;
  price_per_unit: string;
  is_fixed_fee: boolean;
  fixed_fee_amount: string;
  is_active: boolean;
}
const emptyForm: MeterForm = {
  id: "",
  type_name: "",
  category: "electricity",
  price_per_unit: "0",
  is_fixed_fee: false,
  fixed_fee_amount: "0",
  is_active: true,
};

function MeterTypesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MeterType | null>(null);
  const [form, setForm] = useState<MeterForm>(emptyForm);
  const { data: meterTypes = [], isLoading } = useQuery<MeterType[]>({
    queryKey: ["meter-types-management"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meter_types")
        .select("*")
        .order("category")
        .order("id");
      if (error) throw error;
      return (data ?? []) as MeterType[];
    },
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      const id = Number(form.id);
      if (!Number.isInteger(id) || id < 1) throw new Error("أدخل رقم نوع عداد صحيحاً");
      if (!form.type_name.trim()) throw new Error("اسم نوع العداد مطلوب");
      const { error } = await supabase.from("meter_types").upsert({
        id,
        type_name: form.type_name.trim(),
        category: form.category,
        price_per_unit: Math.max(0, Number(form.price_per_unit) || 0),
        is_fixed_fee: form.is_fixed_fee,
        fixed_fee_amount: Math.max(0, Number(form.fixed_fee_amount) || 0),
        is_active: form.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم حفظ نوع العداد");
      qc.invalidateQueries({ queryKey: ["meter-types-management"] });
      qc.invalidateQueries({ queryKey: ["meter-types"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message || "فشل حفظ نوع العداد"),
  });
  const toggleMutation = useMutation({
    mutationFn: async (meter: MeterType) => {
      const { error } = await supabase
        .from("meter_types")
        .update({ is_active: !meter.is_active })
        .eq("id", meter.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم تحديث حالة نوع العداد");
      qc.invalidateQueries({ queryKey: ["meter-types-management"] });
      qc.invalidateQueries({ queryKey: ["meter-types"] });
    },
    onError: (e: Error) => toast.error(e.message || "فشل تحديث الحالة"),
  });
  function openEditor(meter?: MeterType) {
    setEditing(meter ?? null);
    setForm(
      meter
        ? {
            id: String(meter.id),
            type_name: meter.type_name,
            category: meter.category,
            price_per_unit: String(meter.price_per_unit),
            is_fixed_fee: meter.is_fixed_fee,
            fixed_fee_amount: String(meter.fixed_fee_amount),
            is_active: meter.is_active,
          }
        : emptyForm,
    );
    setOpen(true);
  }
  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Gauge className="h-8 w-8 text-primary" />
            أنواع العدادات والتسعير
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة أسعار الكهرباء والماء والرسوم الثابتة من مصدر واحد.
          </p>
        </div>
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4 ml-2" />
          نوع عداد جديد
        </Button>
      </div>
      <Card className="p-4 border-amber-200 bg-amber-50/50 text-sm text-amber-950">
        تغيير السعر يؤثر في الفواتير الجديدة فقط؛ لا تتم إعادة كتابة الفواتير السابقة تلقائياً
        حفاظاً على السجل المالي.
      </Card>
      {isLoading ? (
        <Card className="p-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {meterTypes.map((meter) => (
            <Card key={meter.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-lg">{meter.type_name}</h2>
                  <p className="text-xs text-muted-foreground">
                    #{meter.id} · {meter.category === "electricity" ? "كهرباء" : "ماء"}
                  </p>
                </div>
                <Badge variant={meter.is_active ? "default" : "secondary"}>
                  {meter.is_active ? "نشط" : "موقوف"}
                </Badge>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>النمط</span>
                  <strong>{meter.is_fixed_fee ? "رسم ثابت" : "حسب الاستهلاك"}</strong>
                </div>
                <div className="flex justify-between">
                  <span>{meter.is_fixed_fee ? "الرسم الشهري" : "سعر الوحدة"}</span>
                  <strong>
                    {(meter.is_fixed_fee
                      ? meter.fixed_fee_amount
                      : meter.price_per_unit
                    ).toLocaleString()}{" "}
                    ر.ي
                  </strong>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t">
                <Button size="sm" variant="outline" onClick={() => openEditor(meter)}>
                  <Pencil className="h-3.5 w-3.5 ml-1" />
                  تعديل
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(meter)}>
                  <ToggleLeft className="h-3.5 w-3.5 ml-1" />
                  {meter.is_active ? "إيقاف" : "تفعيل"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل نوع العداد" : "نوع عداد جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>المعرّف الرقمي</Label>
                <Input
                  type="number"
                  min="1"
                  disabled={!!editing}
                  value={form.id}
                  onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select
                  value={form.category}
                  onValueChange={(v: Category) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electricity">كهرباء</SelectItem>
                    <SelectItem value="water">ماء</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>اسم النوع</Label>
              <Input
                value={form.type_name}
                onChange={(e) => setForm((f) => ({ ...f, type_name: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>رسم ثابت</Label>
              <Switch
                checked={form.is_fixed_fee}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_fixed_fee: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>سعر الوحدة</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={form.is_fixed_fee}
                  value={form.price_per_unit}
                  onChange={(e) => setForm((f) => ({ ...f, price_per_unit: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>الرسم الثابت</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!form.is_fixed_fee}
                  value={form.fixed_fee_amount}
                  onChange={(e) => setForm((f) => ({ ...f, fixed_fee_amount: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>مفعّل للاستخدام</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
