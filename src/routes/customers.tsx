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
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Phone,
  Mail,
  MapPin,
  Loader2,
  ToggleLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { canDeleteOperationalRecords, PAGE_ROLES } from "@/lib/access-control";
import { sanitizeSearchTerm } from "@/lib/utils";
import { TableSkeleton } from "@/components/data-states";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [{ title: "العملاء — نظام الإيجارات" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={PAGE_ROLES.customers}>
      <CustomersPage />
    </RouteGuard>
  ),
});

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  id_number: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

interface FormData {
  full_name: string;
  phone: string;
  email: string;
  id_number: string;
  address: string;
  is_active: boolean;
}

const emptyForm: FormData = {
  full_name: "",
  phone: "",
  email: "",
  id_number: "",
  address: "",
  is_active: true,
};

const PAGE_SIZE = 20;

function CustomersPage() {
  return (
    <AppLayout>
      <CustomersList />
    </AppLayout>
  );
}

function CustomersList() {
  const { role } = useAuth();
  const canDelete = canDeleteOperationalRecords(role);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, statusFilter, page],
    queryFn: async () => {
      let q = supabase.from("customers").select("*", { count: "exact" });
      if (search.trim())
        q = q.or(
          `full_name.ilike.%${sanitizeSearchTerm(search)}%,phone.ilike.%${sanitizeSearchTerm(search)}%,id_number.ilike.%${sanitizeSearchTerm(search)}%`,
        );
      if (statusFilter === "active") q = q.eq("is_active", true);
      if (statusFilter === "inactive") q = q.eq("is_active", false);
      q = q
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Customer[], total: count ?? 0 };
    },
  });

  const customers = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        id_number: form.id_number.trim() || null,
        address: form.address.trim() || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "✅ تم تحديث العميل" : "✅ تمت إضافة العميل");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message || "فشل الحفظ"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("archive_customer", { p_customer_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم أرشفة العميل مع الحفاظ على سجله");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "فشل الحذف"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (c: Customer) => {
      const { error } = await supabase
        .from("customers")
        .update({ is_active: !c.is_active })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم تغيير الحالة");
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      full_name: c.full_name,
      phone: c.phone,
      email: c.email ?? "",
      id_number: c.id_number ?? "",
      address: c.address ?? "",
      is_active: c.is_active,
    });
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            إدارة العملاء
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إجمالي {total} عميل</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 ml-2" />
          عميل جديد
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الجوال أو الهوية..."
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
              <SelectItem value="all">جميع العملاء</SelectItem>
              <SelectItem value="active">النشطون فقط</SelectItem>
              <SelectItem value="inactive">غير النشطين</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* List */}
      {isLoading ? (
        <TableSkeleton />
      ) : customers.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          لا توجد عملاء — أضف عميلاً جديداً للبدء
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <Card key={c.id} className="p-5 hover:shadow-elegant transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">{c.full_name}</h3>
                  {c.id_number && (
                    <p className="text-xs text-muted-foreground mt-0.5">هوية: {c.id_number}</p>
                  )}
                </div>
                <Badge variant={c.is_active ? "default" : "secondary"}>
                  {c.is_active ? "نشط" : "موقوف"}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span dir="ltr">{c.phone}</span>
                </div>
                {c.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span dir="ltr" className="truncate">
                      {c.email}
                    </span>
                  </div>
                )}
                {c.address && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{c.address}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-1 mt-4 pt-3 border-t">
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5 ml-1" />
                  تعديل
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(c)}>
                  <ToggleLeft className="h-3.5 w-3.5 ml-1" />
                  {c.is_active ? "إيقاف" : "تفعيل"}
                </Button>
                {canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل عميل" : "عميل جديد"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>الاسم الكامل *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>رقم الجوال *</Label>
                <Input
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الهوية</Label>
                <Input
                  dir="ltr"
                  value={form.id_number}
                  onChange={(e) => setForm((f) => ({ ...f, id_number: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Textarea
                rows={2}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                {editing ? "حفظ التغييرات" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد أرشفة العميل</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد أرشفة العميل <strong>{deleteTarget?.full_name}</strong>؟ سيبقى تاريخه المالي
              محفوظاً ولن يظهر ضمن العملاء النشطين.
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
