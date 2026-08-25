import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Calendar,
  User as UserIcon,
  Store as StoreIcon,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { canDeleteOperationalRecords, PAGE_ROLES } from "@/lib/access-control";
import { TableSkeleton } from "@/components/data-states";

export const Route = createFileRoute("/contracts")({
  head: () => ({
    meta: [{ title: "العقود — نظام الإيجارات" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={PAGE_ROLES.contracts}>
      <AppLayout>
        <ContractsList />
      </AppLayout>
    </RouteGuard>
  ),
});

type ContractStatus = "active" | "expired" | "cancelled" | "renewed";

interface Contract {
  id: string;
  contract_no: string;
  shop_id: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  holiday_increase: number;
  status: ContractStatus;
  notes: string | null;
  due_day: number | null;
  insurance_amount: number | null;
  renewed_from_id: string | null;
  shops?: { shop_code: string; shop_name: string };
  customers?: { full_name: string; phone: string };
}

interface RenewalForm {
  contract_no: string;
  start_date: string;
  end_date: string;
  monthly_rent: string;
  holiday_increase: string;
  insurance_amount: string;
  notes: string;
}

interface FormData {
  contract_no: string;
  shop_id: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: string;
  holiday_increase: string;
  status: ContractStatus;
  notes: string;
}

const today = new Date().toISOString().slice(0, 10);
const nextYear = new Date();
nextYear.setFullYear(nextYear.getFullYear() + 1);
const emptyForm: FormData = {
  contract_no: "",
  shop_id: "",
  customer_id: "",
  start_date: today,
  end_date: nextYear.toISOString().slice(0, 10),
  monthly_rent: "",
  holiday_increase: "0",
  status: "active",
  notes: "",
};

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<ContractStatus, string> = {
  active: "ساري",
  expired: "منتهي",
  cancelled: "ملغى",
  renewed: "مجدّد",
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildRenewalForm(contract: Contract): RenewalForm {
  const start = new Date(`${contract.end_date}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return {
    contract_no: `${contract.contract_no}-R${start.getUTCFullYear()}`,
    start_date: toIsoDate(start),
    end_date: toIsoDate(end),
    monthly_rent: String(contract.monthly_rent ?? 0),
    holiday_increase: String(contract.holiday_increase ?? 0),
    insurance_amount: String(contract.insurance_amount ?? 0),
    notes: `تجديد للعقد رقم ${contract.contract_no}`,
  };
}

function ContractsList() {
  const { role } = useAuth();
  const canDelete = canDeleteOperationalRecords(role);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [renewTarget, setRenewTarget] = useState<Contract | null>(null);
  const [renewalForm, setRenewalForm] = useState<RenewalForm | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["contracts", search, statusFilter, page],
    queryFn: async () => {
      let q = supabase.from("contracts").select(
        `
        *,
        shops!inner(shop_code, shop_name),
        customers!inner(full_name, phone)
      `,
        { count: "exact" },
      );
      if (search.trim()) q = q.ilike("contract_no", `%${search}%`);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as ContractStatus);
      q = q
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as Contract[], total: count ?? 0 };
    },
  });

  const { data: shops = [] } = useQuery({
    queryKey: ["shops-lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shops")
        .select("id, shop_code, shop_name")
        .eq("is_active", true)
        .order("shop_code");
      return data ?? [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, full_name, phone")
        .eq("is_active", true)
        .order("full_name");
      return data ?? [];
    },
  });

  const contracts = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        contract_no: form.contract_no.trim(),
        shop_id: form.shop_id,
        customer_id: form.customer_id,
        start_date: form.start_date,
        end_date: form.end_date,
        monthly_rent: Number(form.monthly_rent) || 0,
        holiday_increase: Number(form.holiday_increase) || 0,
        status: form.status,
        notes: form.notes.trim() || undefined,
      };
      if (!payload.shop_id || !payload.customer_id) throw new Error("اختر المحل والعميل");
      if (editing) {
        const { error } = await supabase.from("contracts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contracts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "✅ تم تحديث العقد" : "✅ تم إنشاء العقد");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message || "فشل الحفظ"),
  });

  const renewMutation = useMutation({
    mutationFn: async () => {
      if (!renewTarget || !renewalForm) throw new Error("اختر العقد المراد تجديده");
      const { error } = await supabase.rpc("renew_contract", {
        p_contract_id: renewTarget.id,
        p_contract_no: renewalForm.contract_no.trim(),
        p_start_date: renewalForm.start_date,
        p_end_date: renewalForm.end_date,
        p_monthly_rent: Number(renewalForm.monthly_rent) || 0,
        p_holiday_increase: Number(renewalForm.holiday_increase) || 0,
        p_insurance_amount: Number(renewalForm.insurance_amount) || 0,
        p_notes: renewalForm.notes.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تجديد العقد وحفظ ارتباطه بالعقد السابق");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setRenewTarget(null);
      setRenewalForm(null);
    },
    onError: (e: Error) => toast.error(e.message || "فشل تجديد العقد"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("archive_contract", { p_contract_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم أرشفة العقد مع الحفاظ على فواتيره");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "فشل الحذف"),
  });

  function openRenew(contract: Contract) {
    setRenewTarget(contract);
    setRenewalForm(buildRenewalForm(contract));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(c: Contract) {
    setEditing(c);
    setForm({
      contract_no: c.contract_no,
      shop_id: c.shop_id,
      customer_id: c.customer_id,
      start_date: c.start_date,
      end_date: c.end_date,
      monthly_rent: String(c.monthly_rent),
      holiday_increase: String(c.holiday_increase),
      status: c.status,
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            إدارة العقود
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إجمالي {total} عقد</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 ml-2" />
          عقد جديد
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث برقم العقد..."
              className="pr-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع العقود</SelectItem>
              <SelectItem value="active">السارية</SelectItem>
              <SelectItem value="expired">المنتهية</SelectItem>
              <SelectItem value="cancelled">الملغاة</SelectItem>
              <SelectItem value="renewed">المجددة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <TableSkeleton />
      ) : contracts.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          لا توجد عقود — أنشئ عقداً جديداً للبدء
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-right p-3 font-medium">رقم العقد</th>
                  <th className="text-right p-3 font-medium">المحل</th>
                  <th className="text-right p-3 font-medium">العميل</th>
                  <th className="text-right p-3 font-medium">من</th>
                  <th className="text-right p-3 font-medium">إلى</th>
                  <th className="text-right p-3 font-medium">الإيجار الشهري</th>
                  <th className="text-right p-3 font-medium">الحالة</th>
                  <th className="text-right p-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/20">
                    <td className="p-3 font-mono font-semibold">{c.contract_no}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <StoreIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          {c.shops?.shop_code} — {c.shops?.shop_name}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.customers?.full_name}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{formatDate(c.start_date)}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(c.end_date)}</td>
                    <td className="p-3 font-semibold">{formatMoney(c.monthly_rent)}</td>
                    <td className="p-3">
                      <Badge
                        variant={
                          c.status === "active"
                            ? "default"
                            : c.status === "expired"
                              ? "secondary"
                              : c.status === "renewed"
                                ? "outline"
                                : "destructive"
                        }
                      >
                        {STATUS_LABELS[c.status]}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="تعديل العقد">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {canDelete && (c.status === "active" || c.status === "expired") && (
                          <Button size="icon" variant="ghost" onClick={() => openRenew(c)} title="تجديد العقد">
                            <RefreshCw className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {page + 1} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل عقد" : "عقد جديد"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>رقم العقد *</Label>
                <Input
                  value={form.contract_no}
                  onChange={(e) => setForm((f) => ({ ...f, contract_no: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>الحالة</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: ContractStatus) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">ساري</SelectItem>
                    <SelectItem value="expired">منتهي</SelectItem>
                    <SelectItem value="cancelled">ملغى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>المحل *</Label>
                <Select
                  value={form.shop_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, shop_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر محلاً" />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.shop_code} — {s.shop_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>العميل *</Label>
                <Select
                  value={form.customer_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر عميلاً" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name} — {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>تاريخ البداية *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>تاريخ النهاية *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>الإيجار الشهري (ريال) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.monthly_rent}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_rent: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>زيادة العيد (ريال)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.holiday_increase}
                  onChange={(e) => setForm((f) => ({ ...f, holiday_increase: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                {editing ? "حفظ التغييرات" : "إنشاء العقد"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!renewTarget}
        onOpenChange={(open) => {
          if (!open && !renewMutation.isPending) {
            setRenewTarget(null);
            setRenewalForm(null);
          }
        }}
      >
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              تجديد العقد {renewTarget?.contract_no}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              سيُحفظ العقد الحالي بحالة «مجدّد»، وسيُنشأ عقد ساري جديد مرتبط به لأغراض المراجعة.
            </p>
          </DialogHeader>
          {renewalForm && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                renewMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <div className="font-bold">الوحدة والمستأجر</div>
                <div className="mt-1 text-muted-foreground">
                  {renewTarget?.shops?.shop_code} — {renewTarget?.shops?.shop_name} · {renewTarget?.customers?.full_name}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>رقم العقد الجديد *</Label>
                  <Input
                    value={renewalForm.contract_no}
                    onChange={(event) => setRenewalForm((form) => form ? { ...form, contract_no: event.target.value } : form)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ البداية *</Label>
                  <Input
                    type="date"
                    value={renewalForm.start_date}
                    min={renewTarget ? toIsoDate(new Date(`${renewTarget.end_date}T00:00:00.000Z`)) : undefined}
                    onChange={(event) => setRenewalForm((form) => form ? { ...form, start_date: event.target.value } : form)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>تاريخ النهاية *</Label>
                  <Input
                    type="date"
                    value={renewalForm.end_date}
                    min={renewalForm.start_date}
                    onChange={(event) => setRenewalForm((form) => form ? { ...form, end_date: event.target.value } : form)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>الإيجار الشهري *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={renewalForm.monthly_rent}
                    onChange={(event) => setRenewalForm((form) => form ? { ...form, monthly_rent: event.target.value } : form)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>زيادة العيد</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={renewalForm.holiday_increase}
                    onChange={(event) => setRenewalForm((form) => form ? { ...form, holiday_increase: event.target.value } : form)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>التأمين</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={renewalForm.insurance_amount}
                    onChange={(event) => setRenewalForm((form) => form ? { ...form, insurance_amount: event.target.value } : form)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>ملاحظات التجديد</Label>
                <Textarea
                  rows={3}
                  value={renewalForm.notes}
                  onChange={(event) => setRenewalForm((form) => form ? { ...form, notes: event.target.value } : form)}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRenewTarget(null);
                    setRenewalForm(null);
                  }}
                  disabled={renewMutation.isPending}
                >
                  إلغاء
                </Button>
                <Button type="submit" disabled={renewMutation.isPending}>
                  {renewMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  اعتماد التجديد
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد أرشفة العقد</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد أرشفة العقد رقم <strong>{deleteTarget?.contract_no}</strong>؟ ستبقى الفواتير
              المرتبطة محفوظة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
