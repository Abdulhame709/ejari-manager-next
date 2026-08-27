import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Building2, Plus, Trash2, Pencil, Search, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/data-states";
import { CsvImportDialog } from "@/components/csv-import-dialog";

export const Route = createFileRoute("/properties")({
  head: () => ({
    meta: [
      { title: "العقارات والمجمعات — إيجاري" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <RouteGuard allowedRoles={["admin", "manager"]}>
      <PropertiesPage />
    </RouteGuard>
  ),
});

interface Property {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

function PropertiesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Partial<Property> | null>(null);
  const [deleteProp, setDeleteProp] = useState<Property | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ["properties", search],
    queryFn: async () => {
      let q = supabase.from("properties").select("*");
      if (search.trim()) q = q.ilike("name", `%${search}%`);
      q = q.order("name");
      return (await q).data ?? [];
    },
  });

  const { data: unitCounts } = useQuery<Record<string, number>>({
    queryKey: ["property-unit-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shops")
        .select("property_id")
        .not("property_id", "is", null);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: { property_id: string | null }) => {
        if (!r.property_id) return;
        map[r.property_id] = (map[r.property_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!dialog?.name?.trim()) throw new Error("اسم العقار مطلوب");
      if (dialog.id) {
        const { error } = await supabase
          .from("properties")
          .update({
            name: dialog.name.trim(),
            description: dialog.description ?? null,
            address: dialog.address ?? null,
            city: dialog.city ?? null,
            phone: dialog.phone ?? null,
          })
          .eq("id", dialog.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("properties").insert({
          name: dialog.name.trim(),
          description: dialog.description ?? null,
          address: dialog.address ?? null,
          city: dialog.city ?? null,
          phone: dialog.phone ?? null,
          is_active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("✅ تم الحفظ");
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["property-unit-counts"] });
      setDialog(null);
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل")),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      // Check for units
      const { count } = await supabase
        .from("shops")
        .select("id", { count: "exact", head: true })
        .eq("property_id", id);
      if ((count ?? 0) > 0)
        throw new Error(`لا يمكن حذف العقار — يحتوي على ${count} وحدة. انقل الوحدات أولاً.`);
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم حذف العقار");
      qc.invalidateQueries({ queryKey: ["properties"] });
      setDeleteProp(null);
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل الحذف")),
  });

  const toggle = useMutation({
    mutationFn: async (p: Property) => {
      const { error } = await supabase
        .from("properties")
        .update({ is_active: !p.is_active })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      toast.success("✅ تم التحديث");
    },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              العقارات والمجمعات
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              إدارة المباني والمجمعات والمراكز التجارية التي تحتوي على وحدات
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 ml-1" />
              استيراد CSV / Excel
            </Button>
            <Button size="sm" onClick={() => setDialog({ is_active: true })}>
              <Plus className="h-4 w-4 ml-1" />
              إضافة عقار
            </Button>
          </div>
        </div>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث باسم العقار..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <TableSkeleton />
          ) : properties.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد عقارات بعد. ابدأ بإضافة أول عقار.</p>
            </div>
          ) : (
            <div className="divide-y">
              {properties.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{p.name}</h3>
                      {p.is_active ? (
                        <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-600 px-2 py-0.5">
                          نشط
                        </span>
                      ) : (
                        <span className="text-[10px] rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                          معطل
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                      {p.city && <span>📍 {p.city}</span>}
                      {p.address && <span>{p.address}</span>}
                      {p.phone && <span>📞 {p.phone}</span>}
                      <span>{unitCounts?.[p.id] ?? 0} وحدة</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => toggle.mutate(p)}
                      title={p.is_active ? "تعطيل" : "تفعيل"}
                    >
                      {p.is_active ? "🔕" : "🔔"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setDialog(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteProp(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="استيراد العقارات"
        description="استخدم القالب، راجع المعاينة، ثم أكد الإدراج. يمنع الاستيراد تكرار اسم العقار داخل الملف أو في قاعدة البيانات."
        headers={["name", "city", "address", "phone", "description"]}
        headerAliases={{
          "اسم العقار": "name",
          "اسم المجمع": "name",
          المدينة: "city",
          العنوان: "address",
          الهاتف: "phone",
          الجوال: "phone",
          الوصف: "description",
        }}
        previewColumns={["name", "city", "phone", "address"]}
        parseRow={(row, rowNumber) => {
          const name = row.name?.trim();
          if (!name) return { error: `السطر ${rowNumber}: اسم العقار مطلوب` };
          return {
            value: {
              name,
              city: row.city?.trim() || null,
              address: row.address?.trim() || null,
              phone: row.phone?.trim() || null,
              description: row.description?.trim() || null,
              is_active: true,
            },
          };
        }}
        onImport={async (rows) => {
          const names = rows.map((row) => row.name.trim());
          const duplicate = names.find((name, index) => names.indexOf(name) !== index);
          if (duplicate) throw new Error(`اسم عقار مكرر داخل الملف: ${duplicate}`);
          const { data: existing, error: lookupError } = await supabase
            .from("properties")
            .select("name")
            .in("name", names);
          if (lookupError) throw lookupError;
          if ((existing?.length ?? 0) > 0)
            throw new Error(`اسم عقار مستخدم مسبقاً: ${existing?.[0]?.name}`);
          const { error } = await supabase.from("properties").insert(rows);
          if (error) throw error;
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["properties"] }),
            qc.invalidateQueries({ queryKey: ["property-unit-counts"] }),
          ]);
        }}
      />

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle>{dialog.id ? "تعديل عقار" : "إضافة عقار جديد"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label>اسم العقار/المجمع *</Label>
                  <Input
                    value={dialog.name ?? ""}
                    onChange={(e) => setDialog((p) => ({ ...p!, name: e.target.value }))}
                    placeholder="مجمع النور التجاري"
                  />
                </div>
                <div className="space-y-1">
                  <Label>المدينة</Label>
                  <Input
                    value={dialog.city ?? ""}
                    onChange={(e) => setDialog((p) => ({ ...p!, city: e.target.value }))}
                    placeholder="صنعاء"
                  />
                </div>
                <div className="space-y-1">
                  <Label>العنوان</Label>
                  <Input
                    value={dialog.address ?? ""}
                    onChange={(e) => setDialog((p) => ({ ...p!, address: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>الهاتف</Label>
                  <Input
                    value={dialog.phone ?? ""}
                    onChange={(e) => setDialog((p) => ({ ...p!, phone: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <Label>وصف</Label>
                  <textarea
                    rows={2}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={dialog.description ?? ""}
                    onChange={(e) => setDialog((p) => ({ ...p!, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  إلغاء
                </Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : "💾 حفظ"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProp} onOpenChange={(o) => !o && setDeleteProp(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف العقار</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف "{deleteProp?.name}" نهائياً.
              <br />
              لا يمكن حذف عقار يحتوي على وحدات.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteProp && del.mutate(deleteProp.id)}
            >
              {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
