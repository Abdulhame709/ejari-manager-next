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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Store,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  Search,
  ChevronRight,
  ChevronLeft,
  Zap,
  Droplets,
  FileText,
  Loader2,
  Globe,
  Eye,
  EyeOff,
  Building2,
  Tag,
  MapPin,
  Hash,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { canDeleteOperationalRecords, PAGE_ROLES } from "@/lib/access-control";
import React from "react";
import { getErrorMessage, sanitizeSearchTerm } from "@/lib/utils";
import { CsvImportDialog } from "@/components/csv-import-dialog";

export const Route = createFileRoute("/shops/")({
  head: () => ({
    meta: [
      { title: "العقارات والوحدات — إيجاري" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <RouteGuard allowedRoles={PAGE_ROLES.shops}>
      <ShopsPage />
    </RouteGuard>
  ),
});

// ============================================================
// Types
// ============================================================
interface MeterType {
  id: number;
  type_name: string;
  category: "electricity" | "water";
  price_per_unit: number;
  is_fixed_fee: boolean;
  fixed_fee_amount: number;
  is_active: boolean;
}
interface Property {
  id: string;
  name: string;
}
type UnitType = "shop" | "apartment" | "office" | "warehouse" | "land" | "clinic" | "other";
type UnitStatus = "available" | "rented" | "reserved" | "maintenance" | "inactive";

interface Shop {
  id: string;
  shop_code: string;
  shop_name: string;
  description: string | null;
  area: number | null;
  area_sqm: number | null;
  elec_meter_type: number;
  elec_meter_no: string | null;
  fixed_elec_amount: number;
  water_meter_type: number;
  water_meter_no: string | null;
  fixed_water_amount: number;
  is_active: boolean;
  created_at: string;
  property_id: string | null;
  unit_type: UnitType | null;
  status: UnitStatus | null;
  floor: number | null;
  location_details: string | null;
  monthly_rent: number | null;
  insurance_amount: number | null;
  is_public: boolean | null;
  market_description: string | null;
  suitable_for: string | null;
  features: string[] | Record<string, unknown> | null;
}

interface UnitFormState {
  shop_code: string;
  shop_name: string;
  description: string;
  area: string;
  elec_meter_type: string;
  elec_meter_no: string;
  fixed_elec_amount: string;
  water_meter_type: string;
  water_meter_no: string;
  fixed_water_amount: string;
  is_active: boolean;
  property_id: string;
  unit_type: UnitType;
  status: UnitStatus;
  floor: string;
  location_details: string;
  monthly_rent: string;
  insurance_amount: string;
  is_public: boolean;
  market_description: string;
  suitable_for: string;
  features: string[];
}

interface ActiveContract {
  contract_no: string;
  monthly_rent: number;
  end_date: string;
  customer_name: string;
}

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  shop: "محل تجاري",
  apartment: "شقة سكنية",
  office: "مكتب إداري",
  warehouse: "مستودع",
  land: "أرض",
  clinic: "عيادة",
  other: "أخرى",
};
const UNIT_STATUS_LABELS: Record<UnitStatus, { label: string; color: string }> = {
  available: { label: "متاحة", color: "bg-emerald-500/20 text-emerald-600" },
  rented: { label: "مؤجرة", color: "bg-blue-500/20 text-blue-600" },
  reserved: { label: "محجوزة", color: "bg-amber-500/20 text-amber-700" },
  maintenance: { label: "صيانة", color: "bg-orange-500/20 text-orange-700" },
  inactive: { label: "معطلة", color: "bg-muted text-muted-foreground" },
};
const COMMON_FEATURES = [
  "عداد مستقل",
  "موقف سيارات",
  "واجهة زجاجية",
  "مكيف",
  "إنترنت",
  "مصعد",
  "حراسة",
  "تخزين إضافي",
  "مدخل خاص",
  "حمام خاص",
];
const PAGE_SIZE = 20;

// ============================================================
// Page
// ============================================================
function ShopsPage() {
  const { role } = useAuth();
  const canDelete = canDeleteOperationalRecords(role);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<{
    contracts: number;
    invoices: number;
    readings: number;
    images: number;
  } | null>(null);

  const qc = useQueryClient();

  const { data: meterTypes = [] } = useQuery<MeterType[]>({
    queryKey: ["meter-types"],
    queryFn: async () =>
      (await supabase.from("meter_types").select("*").eq("is_active", true).order("id")).data ?? [],
  });
  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () =>
      (await supabase.from("properties").select("id,name").eq("is_active", true).order("name"))
        .data ?? [],
  });

  const { data: shopsData, isLoading } = useQuery({
    queryKey: ["shops", search, statusFilter, currentPage],
    queryFn: async () => {
      let query = supabase.from("shops").select("*", { count: "exact" });
      if (search.trim()) {
        query = query.or(
          `shop_code.ilike.%${sanitizeSearchTerm(search)}%,shop_name.ilike.%${sanitizeSearchTerm(search)}%,market_description.ilike.%${sanitizeSearchTerm(search)}%`,
        );
      }
      if (statusFilter === "active") query = query.eq("is_active", true);
      if (statusFilter === "inactive") query = query.eq("is_active", false);
      if (statusFilter === "available")
        query = query.eq("status", "available").eq("is_public", true);
      if (statusFilter === "rented") query = query.eq("status", "rented");
      if (statusFilter === "maintenance") query = query.eq("status", "maintenance");
      query = query
        .order("shop_code")
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
      const { data, count } = await query;
      return { shops: (data ?? []) as Shop[], total: count ?? 0 };
    },
  });
  const shops = shopsData?.shops ?? [];
  const total = shopsData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const { data: activeContract } = useQuery<ActiveContract | null>({
    queryKey: ["shop-contract", selectedShop?.id],
    enabled: !!selectedShop,
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("contract_no, monthly_rent, end_date, customers!inner(full_name)")
        .eq("shop_id", selectedShop!.id)
        .eq("status", "active")
        .maybeSingle();
      if (!data) return null;
      return {
        contract_no: data.contract_no,
        monthly_rent: data.monthly_rent,
        end_date: data.end_date,
        customer_name: (data.customers as unknown as { full_name: string }).full_name,
      };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (shopId: string) => {
      const { error } = await supabase.rpc("archive_shop", { p_shop_id: shopId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم أرشفة الوحدة مع الحفاظ على بياناتها");
      qc.invalidateQueries({ queryKey: ["shops"] });
      setSelectedShop(null);
      setDeleteDialog(false);
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل الحذف")),
  });

  const toggleMutation = useMutation({
    mutationFn: async (shop: Shop) => {
      await supabase.from("shops").update({ is_active: !shop.is_active }).eq("id", shop.id);
    },
    onSuccess: () => {
      toast.success("✅ تم تغيير حالة الوحدة");
      qc.invalidateQueries({ queryKey: ["shops"] });
      if (selectedShop)
        setSelectedShop((prev) => (prev ? { ...prev, is_active: !prev.is_active } : null));
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async (shop: Shop) => {
      await supabase.from("shops").update({ is_public: !shop.is_public }).eq("id", shop.id);
    },
    onSuccess: () => {
      toast.success("✅ تم تحديث حالة النشر");
      qc.invalidateQueries({ queryKey: ["shops"] });
      if (selectedShop)
        setSelectedShop((prev) => (prev ? { ...prev, is_public: !prev.is_public } : null));
    },
  });

  async function handleDeleteClick() {
    if (!selectedShop) return;
    const [c, i, r, img] = await Promise.all([
      supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", selectedShop.id),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", selectedShop.id),
      supabase
        .from("meter_readings")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", selectedShop.id),
      supabase
        .from("unit_images")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", selectedShop.id),
    ]);
    setDeleteInfo({
      contracts: c.count ?? 0,
      invoices: i.count ?? 0,
      readings: r.count ?? 0,
      images: img.count ?? 0,
    });
    setDeleteDialog(true);
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              الوحدات
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">إجمالي: {total} وحدة</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 ml-2" />
              استيراد CSV
            </Button>
            <Button
              onClick={() => {
                setEditingShop(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 ml-2" />
              وحدة جديدة
            </Button>
            {selectedShop && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => togglePublishMutation.mutate(selectedShop)}
                >
                  {selectedShop.is_public ? (
                    <>
                      <EyeOff className="h-4 w-4 ml-1" />
                      إخفاء من البوابة
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 ml-1" />
                      نشر للعامة
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleMutation.mutate(selectedShop)}
                >
                  <ToggleLeft className="h-4 w-4 ml-1" />
                  {selectedShop.is_active ? "تعطيل" : "تفعيل"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingShop(selectedShop);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4 ml-1" />
                  تعديل
                </Button>
                {canDelete && (
                  <Button variant="destructive" size="sm" onClick={handleDeleteClick}>
                    <Trash2 className="h-4 w-4 ml-1" />
                    حذف
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-3">
            <Card className="p-3 space-y-2">
              <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالكود أو الاسم أو الوصف..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(0);
                  }}
                  className="pr-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setCurrentPage(0);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الوحدات</SelectItem>
                  <SelectItem value="available">المتاحة للعامة</SelectItem>
                  <SelectItem value="rented">المؤجرة</SelectItem>
                  <SelectItem value="maintenance">قيد الصيانة</SelectItem>
                  <SelectItem value="active">النشطة</SelectItem>
                  <SelectItem value="inactive">المعطلة</SelectItem>
                </SelectContent>
              </Select>
            </Card>

            <Card className="overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : shops.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {search ? `لا نتائج لـ "${search}"` : "لا توجد وحدات بعد"}
                </div>
              ) : (
                <div className="divide-y">
                  {shops.map((shop) => {
                    const st = shop.status ? UNIT_STATUS_LABELS[shop.status as UnitStatus] : null;
                    return (
                      <button
                        key={shop.id}
                        onClick={() => setSelectedShop(shop)}
                        className={`w-full text-right p-3 hover:bg-accent transition-colors flex items-center justify-between gap-2 ${selectedShop?.id === shop.id ? "bg-primary/10 border-r-2 border-primary" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate flex items-center gap-1">
                            {shop.unit_type && <Tag className="h-3 w-3 text-muted-foreground" />}
                            {shop.shop_name}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Hash className="h-3 w-3" />
                            {shop.shop_code}
                            {shop.is_public && <Globe className="h-3 w-3 text-emerald-500" />}
                          </div>
                        </div>
                        {st ? (
                          <Badge className={`text-[10px] shrink-0 ${st.color}`}>{st.label}</Badge>
                        ) : (
                          <Badge
                            variant={shop.is_active ? "default" : "secondary"}
                            className="text-xs shrink-0"
                          >
                            {shop.is_active ? "نشط" : "معطل"}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-2 border-t text-xs text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span>
                    {currentPage + 1} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            {selectedShop ? (
              <ShopDetails
                shop={selectedShop}
                contract={activeContract ?? null}
                elecMeter={meterTypes.find((m) => m.id === selectedShop.elec_meter_type)}
                waterMeter={meterTypes.find((m) => m.id === selectedShop.water_meter_type)}
                properties={properties}
                getMeterLabel={getMeterLabel}
                isNoMeter={isNoMeter}
              />
            ) : (
              <Card className="p-12 text-center text-muted-foreground border-dashed">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>اختر وحدة من القائمة لعرض تفاصيلها</p>
              </Card>
            )}
          </div>
        </div>
      </div>

      <ShopDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingShop={editingShop}
        meterTypes={meterTypes}
        properties={properties}
        onSaved={(shop) => {
          setSelectedShop(shop);
          setDialogOpen(false);
          qc.invalidateQueries({ queryKey: ["shops"] });
        }}
      />

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="استيراد الوحدات"
        description="استخدم القالب، راجع الصفوف، ثم أكد الإدراج. يجب أن تكون أكواد الوحدات فريدة وأن تكون property_id قيمة صحيحة عند استخدامها."
        headers={[
          "shop_code",
          "shop_name",
          "property_id",
          "unit_type",
          "status",
          "monthly_rent",
          "area_sqm",
          "elec_meter_type",
          "water_meter_type",
          "description",
        ]}
        previewColumns={["shop_code", "shop_name", "unit_type", "monthly_rent"]}
        parseRow={(row, rowNumber) => {
          const code = row.shop_code?.trim();
          const name = row.shop_name?.trim();
          const rent = Number(row.monthly_rent || 0);
          const area = Number(row.area_sqm || 0);
          const elecMeterType = Number(row.elec_meter_type || 3);
          const waterMeterType = Number(row.water_meter_type || 6);
          const unitTypes = ["shop", "apartment", "office", "warehouse", "land", "clinic", "other"];
          const statuses = ["available", "rented", "reserved", "maintenance", "inactive"];
          if (!code || !name) return { error: `السطر ${rowNumber}: كود الوحدة والاسم مطلوبان` };
          if (
            Number.isNaN(rent) ||
            rent < 0 ||
            Number.isNaN(area) ||
            area < 0 ||
            !Number.isInteger(elecMeterType) ||
            !Number.isInteger(waterMeterType)
          )
            return {
              error: `السطر ${rowNumber}: الإيجار والمساحة ومعرّفات العدادات يجب أن تكون قيماً صحيحة`,
            };
          if (row.unit_type && !unitTypes.includes(row.unit_type))
            return { error: `السطر ${rowNumber}: نوع الوحدة غير صحيح` };
          if (row.status && !statuses.includes(row.status))
            return { error: `السطر ${rowNumber}: حالة الوحدة غير صحيحة` };
          return {
            value: {
              shop_code: code,
              shop_name: name,
              property_id: row.property_id?.trim() || null,
              unit_type: (row.unit_type || "shop") as UnitType,
              status: (row.status || "available") as UnitStatus,
              monthly_rent: rent,
              area_sqm: area,
              description: row.description?.trim() || null,
              is_active: true,
              is_public: false,
              insurance_amount: 0,
              elec_meter_type: elecMeterType,
              water_meter_type: waterMeterType,
              fixed_elec_amount: 0,
              fixed_water_amount: 0,
            },
          };
        }}
        onImport={async (rows) => {
          const codes = rows.map((row) => row.shop_code);
          if (new Set(codes).size !== codes.length)
            throw new Error("يوجد كود وحدة مكرر داخل الملف");
          const { error } = await supabase.from("shops").insert(rows);
          if (error) throw error;
          await qc.invalidateQueries({ queryKey: ["shops"] });
        }}
      />

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد أرشفة الوحدة</AlertDialogTitle>
            <AlertDialogDescription className="space-y-1">
              <span className="block">
                هل أنت متأكد من أرشفة الوحدة <strong>"{selectedShop?.shop_name}"</strong>؟ ستبقى
                الفواتير والقراءات والعقود محفوظة.
              </span>
              {deleteInfo &&
                deleteInfo.contracts +
                  deleteInfo.invoices +
                  deleteInfo.readings +
                  deleteInfo.images >
                  0 && (
                  <span className="block text-destructive font-medium mt-2">
                    ℹ️ ستبقى البيانات المرتبطة محفوظة:
                    {deleteInfo.contracts > 0 && (
                      <span className="block">• {deleteInfo.contracts} عقد</span>
                    )}
                    {deleteInfo.invoices > 0 && (
                      <span className="block">• {deleteInfo.invoices} فاتورة</span>
                    )}
                    {deleteInfo.readings > 0 && (
                      <span className="block">• {deleteInfo.readings} قراءة عداد</span>
                    )}
                    {deleteInfo.images > 0 && (
                      <span className="block">• {deleteInfo.images} صور</span>
                    )}
                  </span>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => selectedShop && deleteMutation.mutate(selectedShop.id)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "أرشفة الوحدة"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ============================================================
// Shop Details panel
// ============================================================
function ShopDetails({
  shop,
  contract,
  elecMeter,
  waterMeter,
  properties,
  getMeterLabel,
  isNoMeter,
}: {
  shop: Shop;
  contract: ActiveContract | null;
  elecMeter: MeterType | undefined;
  waterMeter: MeterType | undefined;
  properties: Property[];
  getMeterLabel: (mt: MeterType | undefined, fixed?: number) => string;
  isNoMeter: (mt: MeterType | undefined) => boolean;
}) {
  const property = properties.find((p) => p.id === shop.property_id);
  const st = shop.status ? UNIT_STATUS_LABELS[shop.status as UnitStatus] : null;
  const features: string[] = Array.isArray(shop.features) ? shop.features : [];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-bold">{shop.shop_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">{shop.shop_code}</p>
              {shop.unit_type && (
                <Badge variant="outline">{UNIT_TYPE_LABELS[shop.unit_type as UnitType]}</Badge>
              )}
              {st && <Badge className={st.color}>{st.label}</Badge>}
              {shop.is_public ? (
                <Badge className="bg-emerald-500/20 text-emerald-600">
                  <Globe className="h-3 w-3 ml-1" />
                  منشورة
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-muted-foreground">
                  <EyeOff className="h-3 w-3 ml-1" />
                  مخفية
                </Badge>
              )}
            </div>
          </div>
          <Badge variant={shop.is_active ? "default" : "secondary"}>
            {shop.is_active ? "✅ نشط" : "❌ معطل"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {property && <InfoField label="العقار/المجمع" value={property.name} />}
          {(shop.area_sqm ?? shop.area) && (
            <InfoField label="المساحة" value={`${shop.area_sqm ?? shop.area} م²`} />
          )}
          {shop.floor != null && <InfoField label="الطابق" value={String(shop.floor)} />}
          {shop.monthly_rent != null && (
            <InfoField
              label="الإيجار الشهري"
              value={`${Math.round(shop.monthly_rent).toLocaleString("ar-EG")} ر.ي`}
            />
          )}
          {shop.insurance_amount != null && shop.insurance_amount > 0 && (
            <InfoField
              label="التأمين"
              value={`${Math.round(shop.insurance_amount).toLocaleString("ar-EG")} ر.ي`}
            />
          )}
          {shop.location_details && (
            <div className="col-span-2 md:col-span-3">
              <InfoField label="الموقع" value={shop.location_details} />
            </div>
          )}
          {shop.description && (
            <div className="col-span-2 md:col-span-3">
              <InfoField label="الوصف" value={shop.description} />
            </div>
          )}
        </div>

        {shop.market_description && (
          <div className="mt-4 rounded-xl bg-blue-50 p-3">
            <div className="text-[11px] font-extrabold text-blue-700">الوصف التسويقي</div>
            <p className="mt-1 text-xs leading-5 text-slate-600">{shop.market_description}</p>
            {shop.suitable_for && (
              <p className="mt-2 text-xs text-slate-600">
                <strong className="text-slate-700">مناسبة لـ:</strong> {shop.suitable_for}
              </p>
            )}
            {features.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {features.map((f) => (
                  <span
                    key={f}
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold text-blue-700"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
              <Zap className="h-4 w-4 text-yellow-500" />
            </div>
            <span className="font-semibold text-sm">عداد الكهرباء</span>
          </div>
          <div className="space-y-2 text-sm">
            <InfoField label="النوع" value={getMeterLabel(elecMeter, shop.fixed_elec_amount)} />
            {!isNoMeter(elecMeter) && (
              <InfoField label="رقم العداد" value={shop.elec_meter_no || "—"} />
            )}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Droplets className="h-4 w-4 text-blue-500" />
            </div>
            <span className="font-semibold text-sm">عداد المياه</span>
          </div>
          <div className="space-y-2 text-sm">
            <InfoField label="النوع" value={getMeterLabel(waterMeter, shop.fixed_water_amount)} />
            {!isNoMeter(waterMeter) && (
              <InfoField label="رقم العداد" value={shop.water_meter_no || "—"} />
            )}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">العقد الساري</span>
        </div>
        {contract ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <InfoField label="المستأجر" value={contract.customer_name} />
            <InfoField label="رقم العقد" value={contract.contract_no} />
            <InfoField
              label="الإيجار"
              value={`${Math.round(contract.monthly_rent).toLocaleString("ar-EG")} ر.ي`}
            />
            <InfoField
              label="ينتهي في"
              value={new Date(contract.end_date).toLocaleDateString("ar-SA")}
            />
          </div>
        ) : (
          <p className="text-sm text-amber-600 bg-amber-500/10 rounded-lg p-3">
            ⚠️ لا يوجد عقد ساري لهذه الوحدة
          </p>
        )}
      </Card>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}

// ============================================================
// Shop dialog (create/edit)
// ============================================================
function ShopDialog({
  open,
  onClose,
  editingShop,
  meterTypes,
  properties,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingShop: Shop | null;
  meterTypes: MeterType[];
  properties: Property[];
  onSaved: (shop: Shop) => void;
}) {
  const [form, setForm] = useState<UnitFormState | null>(null);

  // Reset form when opened
  React.useEffect(() => {
    if (!open) return;
    if (editingShop) {
      setForm({
        shop_code: editingShop.shop_code,
        shop_name: editingShop.shop_name,
        description: editingShop.description ?? "",
        area: String(editingShop.area_sqm ?? editingShop.area ?? ""),
        elec_meter_type: editingShop.elec_meter_type.toString(),
        elec_meter_no: editingShop.elec_meter_no ?? "",
        fixed_elec_amount: editingShop.fixed_elec_amount?.toString() ?? "",
        water_meter_type: editingShop.water_meter_type.toString(),
        water_meter_no: editingShop.water_meter_no ?? "",
        fixed_water_amount: editingShop.fixed_water_amount?.toString() ?? "",
        is_active: editingShop.is_active,
        property_id: editingShop.property_id ?? "none",
        unit_type: editingShop.unit_type ?? "shop",
        status: editingShop.status ?? "available",
        floor: editingShop.floor != null ? String(editingShop.floor) : "",
        location_details: editingShop.location_details ?? "",
        monthly_rent: editingShop.monthly_rent != null ? String(editingShop.monthly_rent) : "",
        insurance_amount:
          editingShop.insurance_amount != null ? String(editingShop.insurance_amount) : "",
        is_public: !!editingShop.is_public,
        market_description: editingShop.market_description ?? "",
        suitable_for: editingShop.suitable_for ?? "",
        features: Array.isArray(editingShop.features) ? (editingShop.features as string[]) : [],
      });
    } else {
      setForm({
        shop_code: "",
        shop_name: "",
        description: "",
        area: "",
        elec_meter_type: "0",
        elec_meter_no: "",
        fixed_elec_amount: "",
        water_meter_type: "0",
        water_meter_no: "",
        fixed_water_amount: "",
        is_active: true,
        property_id: "none",
        unit_type: "shop",
        status: "available",
        floor: "",
        location_details: "",
        monthly_rent: "",
        insurance_amount: "",
        is_public: false,
        market_description: "",
        suitable_for: "",
        features: [],
      });
    }
  }, [open, editingShop]);

  const [saving, setSaving] = useState(false);
  if (!form) return null;

  function f<K extends keyof UnitFormState>(key: K, val: UnitFormState[K]) {
    setForm((p) => (p ? { ...p, [key]: val } : p));
  }
  function toggleFeature(feat: string) {
    const arr: string[] = form?.features ?? [];
    f("features", arr.includes(feat) ? arr.filter((x) => x !== feat) : [...arr, feat]);
  }

  const elecInfo = getMeterInfo(meterTypes, form.elec_meter_type);
  const waterInfo = getMeterInfo(meterTypes, form.water_meter_type);
  const elecTypes = meterTypes.filter((m) => m.category === "electricity");
  const waterTypes = meterTypes.filter((m) => m.category === "water");

  async function handleSave() {
    if (!form) return;
    if (!form.shop_name.trim()) {
      toast.error("اسم الوحدة مطلوب");
      return;
    }
    if (form.elec_meter_type === "0") {
      toast.error("اختر نوع عداد الكهرباء");
      return;
    }
    if (form.water_meter_type === "0") {
      toast.error("اختر نوع عداد المياه");
      return;
    }
    if (!editingShop && !form.shop_code.trim()) {
      toast.error("كود الوحدة مطلوب");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        shop_name: form.shop_name.trim(),
        description: form.description.trim() || null,
        area: form.area ? parseFloat(form.area) : null,
        area_sqm: form.area ? parseFloat(form.area) : null,
        elec_meter_type: parseInt(form.elec_meter_type),
        elec_meter_no: elecInfo.isNoMeter ? null : form.elec_meter_no.trim() || null,
        fixed_elec_amount: elecInfo.isNoMeter ? 0 : parseFloat(form.fixed_elec_amount || "0"),
        water_meter_type: parseInt(form.water_meter_type),
        water_meter_no: waterInfo.isNoMeter ? null : form.water_meter_no.trim() || null,
        fixed_water_amount: waterInfo.isNoMeter ? 0 : parseFloat(form.fixed_water_amount || "0"),
        is_active: form.is_active,
        property_id: form.property_id === "none" ? null : form.property_id,
        unit_type: form.unit_type,
        status: form.status,
        floor: form.floor ? parseInt(form.floor) : null,
        location_details: form.location_details.trim() || null,
        monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : null,
        insurance_amount: form.insurance_amount ? parseFloat(form.insurance_amount) : null,
        is_public: form.is_public,
        market_description: form.market_description.trim() || null,
        suitable_for: form.suitable_for.trim() || null,
        features: form.features ?? [],
      };

      let data;
      if (editingShop) {
        const res = await supabase
          .from("shops")
          .update(payload)
          .eq("id", editingShop.id)
          .select()
          .single();
        if (res.error) throw res.error;
        data = res.data;
        toast.success("✅ تم تحديث الوحدة");
      } else {
        const { count } = await supabase
          .from("shops")
          .select("id", { count: "exact", head: true })
          .eq("shop_code", form.shop_code.trim());
        if ((count ?? 0) > 0) {
          toast.error("❌ كود الوحدة موجود مسبقاً");
          setSaving(false);
          return;
        }
        // Auto-generate a code if left empty-ish? No, require it.
        const res = await supabase
          .from("shops")
          .insert({ shop_code: form.shop_code.trim(), ...payload })
          .select()
          .single();
        if (res.error) throw res.error;
        data = res.data;
        toast.success("✅ تم إضافة الوحدة");
      }
      onSaved(data as Shop);
    } catch (err) {
      toast.error("❌ " + getErrorMessage(err, "حدث خطأ"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editingShop ? "✏️ تعديل الوحدة" : "➕ إضافة وحدة جديدة"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>كود الوحدة *</Label>
              <Input
                value={form.shop_code}
                onChange={(e) => f("shop_code", e.target.value)}
                placeholder="A-001"
                disabled={!!editingShop}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>اسم الوحدة *</Label>
              <Input
                value={form.shop_name}
                onChange={(e) => f("shop_name", e.target.value)}
                placeholder="محل النور"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>نوع الوحدة</Label>
              <Select value={form.unit_type} onValueChange={(v) => f("unit_type", v as UnitType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UNIT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => f("status", v as UnitStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UNIT_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>العقار/المجمع</Label>
              <Select value={form.property_id} onValueChange={(v) => f("property_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="بدون" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— بدون —</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>المساحة (م²)</Label>
              <Input type="number" value={form.area} onChange={(e) => f("area", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>الطابق</Label>
              <Input
                type="number"
                value={form.floor}
                onChange={(e) => f("floor", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>الإيجار الشهري (ر.ي)</Label>
              <Input
                type="number"
                value={form.monthly_rent}
                onChange={(e) => f("monthly_rent", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>التأمين (ر.ي)</Label>
              <Input
                type="number"
                value={form.insurance_amount}
                onChange={(e) => f("insurance_amount", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>الموقع/العنوان</Label>
            <Input
              value={form.location_details}
              onChange={(e) => f("location_details", e.target.value)}
              placeholder="شارع حدة، صنعاء"
            />
          </div>
          <div className="space-y-1">
            <Label>الوصف</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => f("description", e.target.value)}
            />
          </div>

          <div className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-600" />
              <span className="font-medium text-sm">النشر في البوابة العامة</span>
              <Switch
                checked={form.is_public}
                onCheckedChange={(v: boolean) => f("is_public", v)}
              />
            </div>
            {form.is_public && (
              <>
                <div className="space-y-1">
                  <Label>الوصف التسويقي</Label>
                  <Textarea
                    rows={2}
                    value={form.market_description}
                    onChange={(e) => f("market_description", e.target.value)}
                    placeholder="موقع حيوي، واجهة زجاجية..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>مناسبة لـ</Label>
                  <Input
                    value={form.suitable_for}
                    onChange={(e) => f("suitable_for", e.target.value)}
                    placeholder="متجر، صيدلية، معرض"
                  />
                </div>
                <div className="space-y-1">
                  <Label>المميزات</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {COMMON_FEATURES.map((feat) => {
                      const on = (form.features ?? []).includes(feat);
                      return (
                        <button
                          key={feat}
                          type="button"
                          onClick={() => toggleFeature(feat)}
                          className={`rounded-full border px-3 py-1 text-xs transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-accent"}`}
                        >
                          {feat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Electric meter */}
          <MeterBlock
            label="عداد الكهرباء"
            icon={<Zap className="h-4 w-4 text-yellow-500" />}
            meterTypes={elecTypes}
            typeKey="elec_meter_type"
            noKey="elec_meter_no"
            fixedKey="fixed_elec_amount"
            form={form}
            setForm={f}
            color="yellow"
          />
          {/* Water meter */}
          <MeterBlock
            label="عداد المياه"
            icon={<Droplets className="h-4 w-4 text-blue-500" />}
            meterTypes={waterTypes}
            typeKey="water_meter_type"
            noKey="water_meter_no"
            fixedKey="fixed_water_amount"
            form={form}
            setForm={f}
            color="blue"
          />

          <div className="flex items-center gap-3">
            <Label>الحالة:</Label>
            <Select
              value={form.is_active ? "1" : "0"}
              onValueChange={(v) => f("is_active", v === "1")}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">✅ نشط</SelectItem>
                <SelectItem value="0">❌ معطل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editingShop ? (
              "💾 تحديث"
            ) : (
              "💾 إضافة"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeterBlock({
  label,
  icon,
  meterTypes,
  typeKey,
  noKey,
  fixedKey,
  form,
  setForm,
  color,
}: {
  label: string;
  icon: React.ReactNode;
  meterTypes: MeterType[];
  typeKey: "elec_meter_type" | "water_meter_type";
  noKey: "elec_meter_no" | "water_meter_no";
  fixedKey: "fixed_elec_amount" | "fixed_water_amount";
  form: UnitFormState;
  setForm: <K extends keyof UnitFormState>(key: K, val: UnitFormState[K]) => void;
  color: string;
}) {
  const info = getMeterInfo(meterTypes, form[typeKey]);
  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <div className="space-y-1">
        <Label>نوع العداد *</Label>
        <Select value={form[typeKey]} onValueChange={(v) => setForm(typeKey, v)}>
          <SelectTrigger>
            <SelectValue placeholder="اختر" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">-- اختر --</SelectItem>
            {meterTypes.map((mt: MeterType) => (
              <SelectItem key={mt.id} value={mt.id.toString()}>
                {mt.type_name}
                {mt.is_fixed_fee && mt.fixed_fee_amount === 0
                  ? " (بدون عداد)"
                  : mt.is_fixed_fee
                    ? ` (${mt.fixed_fee_amount.toLocaleString()} ر.ي/شهر)`
                    : ` (${mt.price_per_unit.toLocaleString()} ر.ي/وحدة)`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!info.isNoMeter && form[typeKey] !== "0" && (
        <div className="space-y-1">
          <Label>رقم العداد</Label>
          <Input value={form[noKey]} onChange={(e) => setForm(noKey, e.target.value)} />
        </div>
      )}
      {info.isFixed && (
        <div className="space-y-1">
          <Label>المبلغ الثابت (ر.ي/شهر)</Label>
          <Input
            type="number"
            value={form[fixedKey]}
            onChange={(e) => setForm(fixedKey, e.target.value)}
          />
        </div>
      )}
      {info.isNoMeter && (
        <p className="text-xs text-muted-foreground bg-muted rounded p-2">هذه الوحدة بدون عداد</p>
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================
function getMeterInfo(meterTypes: MeterType[], id: string) {
  const mt = meterTypes.find((m) => m.id === parseInt(id));
  if (!mt) return { isNoMeter: false, isFixed: false };
  const noMeter = mt.is_fixed_fee && mt.fixed_fee_amount === 0 && mt.price_per_unit === 0;
  return { isNoMeter: noMeter, isFixed: mt.is_fixed_fee && !noMeter };
}
function isNoMeter(mt: MeterType | undefined) {
  if (!mt) return false;
  return mt.is_fixed_fee && mt.fixed_fee_amount === 0 && mt.price_per_unit === 0;
}
function getMeterLabel(mt: MeterType | undefined, fixedOverride?: number) {
  if (!mt) return "غير محدد";
  if (isNoMeter(mt)) return mt.type_name + " (بدون عداد)";
  if (mt.is_fixed_fee) {
    const amt = fixedOverride ?? mt.fixed_fee_amount;
    return `${mt.type_name} (${Number(amt).toLocaleString("ar-EG")} ر.ي/شهر)`;
  }
  return `${mt.type_name} (${mt.price_per_unit.toLocaleString("ar-EG")} ر.ي/وحدة)`;
}
