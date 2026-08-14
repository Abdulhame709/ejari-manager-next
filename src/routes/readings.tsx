import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { PAGE_ROLES } from "@/lib/access-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Gauge,
  Search,
  Save,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowUpDown,
  Zap,
  Droplets,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { sanitizeSearchTerm } from "@/lib/utils";

export const Route = createFileRoute("/readings")({
  head: () => ({
    meta: [{ title: "قراءات العدادات — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={PAGE_ROLES.readings}>
      <ReadingsPage />
    </RouteGuard>
  ),
});

interface Shop {
  id: string;
  shop_code: string;
  shop_name: string;
  elec_meter_type: number;
  elec_meter_no: string | null;
  fixed_elec_amount: number;
  water_meter_type: number;
  water_meter_no: string | null;
  fixed_water_amount: number;
  is_active: boolean;
}

interface MeterType {
  id: number;
  type_name: string;
  category: "electricity" | "water";
  price_per_unit: number;
  is_fixed_fee: boolean;
  fixed_fee_amount: number;
}

interface Reading {
  id?: string;
  shop_id: string;
  reading_month: number;
  reading_year: number;
  reading_date?: string;
  elec_current_reading: number;
  elec_previous_reading: number;
  water_current_reading: number;
  water_previous_reading: number;
  notes?: string | null;
}

const ARABIC_MONTHS = [
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

const PAGE_SIZE = 50;

function ReadingsPage() {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | "done" | "pending" | "late">("all");
  // local edits: key = shopId, value = partial reading
  const [edits, setEdits] = useState<Record<string, Partial<Reading>>>({});

  const qc = useQueryClient();

  const { data: meterTypes = [] } = useQuery<MeterType[]>({
    queryKey: ["meter-types"],
    queryFn: async () =>
      (await supabase.from("meter_types").select("*").eq("is_active", true)).data ?? [],
  });

  // Active shops that have active contracts
  const { data: shopsData, isLoading } = useQuery({
    queryKey: ["shops-active-readings", search, statusFilter, page],
    queryFn: async () => {
      let q = supabase.from("shops").select("*", { count: "exact" }).eq("is_active", true);
      const term = sanitizeSearchTerm(search);
      if (term) q = q.or(`shop_code.ilike.%${term}%,shop_name.ilike.%${term}%`);
      q = q.order("shop_code").range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count } = await q;
      return { shops: (data ?? []) as Shop[], total: count ?? 0 };
    },
  });

  // Active contract per shop (for the current month) — we just need existence for "late" detection
  const { data: activeContracts = [] } = useQuery<{ shop_id: string; contract_no: string }[]>({
    queryKey: ["active-contracts-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("shop_id, contract_no")
        .eq("status", "active");
      return (data ?? []).map((c) => ({ shop_id: c.shop_id, contract_no: c.contract_no }));
    },
  });

  // Readings for the selected month/year — only for shops on current page (for performance)
  const shopIds = shopsData?.shops.map((s) => s.id) ?? [];
  const { data: readingsMap = {}, isLoading: readingsLoading } = useQuery<Record<string, Reading>>({
    queryKey: ["readings-map", month, year, shopIds.join(",")],
    enabled: shopIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("meter_readings")
        .select("*")
        .eq("reading_month", month)
        .eq("reading_year", year)
        .in("shop_id", shopIds);
      const map: Record<string, Reading> = {};
      (data ?? []).forEach((r) => {
        map[r.shop_id] = r as unknown as Reading;
      });
      return map;
    },
  });

  // Previous month readings (for carry-over / defaults)
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { data: prevReadingsMap = {} } = useQuery<Record<string, Reading>>({
    queryKey: ["readings-map", prevMonth, prevYear, shopIds.join(",")],
    enabled: shopIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("meter_readings")
        .select("*")
        .eq("reading_month", prevMonth)
        .eq("reading_year", prevYear)
        .in("shop_id", shopIds);
      const map: Record<string, Reading> = {};
      (data ?? []).forEach((r) => {
        map[r.shop_id] = r as unknown as Reading;
      });
      return map;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(edits);
      if (entries.length === 0) throw new Error("لا توجد تعديلات للحفظ");
      const rows: Database["public"]["Tables"]["meter_readings"]["Insert"][] = [];
      for (const [shopId, ed] of entries) {
        const existing = readingsMap[shopId];
        const prev = prevReadingsMap[shopId];
        const ePrev = existing?.elec_previous_reading ?? prev?.elec_current_reading ?? 0;
        const wPrev = existing?.water_previous_reading ?? prev?.water_current_reading ?? 0;
        const ec = ed.elec_current_reading ?? existing?.elec_current_reading ?? ePrev;
        const wc = ed.water_current_reading ?? existing?.water_current_reading ?? wPrev;
        // Validation
        if (ec < ePrev) {
          const shop = shopsData?.shops.find((s) => s.id === shopId);
          throw new Error(`قراءة الكهرباء في ${shop?.shop_name} أقل من السابقة (${ePrev})`);
        }
        if (wc < wPrev) {
          const shop = shopsData?.shops.find((s) => s.id === shopId);
          throw new Error(`قراءة المياه في ${shop?.shop_name} أقل من السابقة (${wPrev})`);
        }
        rows.push({
          shop_id: shopId,
          reading_month: month,
          reading_year: year,
          reading_date: format(new Date(), "yyyy-MM-dd"),
          elec_current_reading: ec,
          elec_previous_reading: ePrev,
          water_current_reading: wc,
          water_previous_reading: wPrev,
          notes: ed.notes ?? existing?.notes ?? null,
        });
      }
      const { error } = await supabase.from("meter_readings").upsert(rows, {
        onConflict: "shop_id,reading_month,reading_year",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم حفظ القراءات بنجاح");
      setEdits({});
      qc.invalidateQueries({ queryKey: ["readings-map"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err: Error) => toast.error("❌ " + (err.message || "فشل الحفظ")),
  });

  const carryOverMutation = useMutation({
    mutationFn: async () => {
      // For each active shop, create/update current month reading carrying previous as start
      if (!shopsData?.shops.length) throw new Error("لا توجد محلات لترحيلها");
      const rows: Database["public"]["Tables"]["meter_readings"]["Insert"][] = [];
      for (const shop of shopsData.shops) {
        const prev = prevReadingsMap[shop.id];
        if (!prev && !readingsMap[shop.id]) {
          // No previous, insert zeros
          rows.push({
            shop_id: shop.id,
            reading_month: month,
            reading_year: year,
            reading_date: format(new Date(), "yyyy-MM-dd"),
            elec_current_reading: 0,
            elec_previous_reading: 0,
            water_current_reading: 0,
            water_previous_reading: 0,
          });
        } else if (prev && !readingsMap[shop.id]) {
          rows.push({
            shop_id: shop.id,
            reading_month: month,
            reading_year: year,
            reading_date: format(new Date(), "yyyy-MM-dd"),
            elec_current_reading: prev.elec_current_reading,
            elec_previous_reading: prev.elec_current_reading,
            water_current_reading: prev.water_current_reading,
            water_previous_reading: prev.water_current_reading,
          });
        }
      }
      if (rows.length === 0) {
        toast.info("لا توجد قراءات جديدة لترحيلها");
        return;
      }
      const { error } = await supabase.from("meter_readings").upsert(rows, {
        onConflict: "shop_id,reading_month,reading_year",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم ترحيل القراءات من الشهر السابق");
      qc.invalidateQueries({ queryKey: ["readings-map"] });
    },
    onError: (err: Error) => toast.error("❌ " + (err.message || "فشل الترحيل")),
  });

  function getMeterType(id: number) {
    return meterTypes.find((m) => m.id === id);
  }
  function isNoMeter(mt: MeterType | undefined) {
    return !!mt && mt.is_fixed_fee && mt.fixed_fee_amount === 0 && mt.price_per_unit === 0;
  }

  const currentShops = useMemo(() => shopsData?.shops ?? [], [shopsData]);
  const total = shopsData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Stats
  const stats = useMemo(() => {
    let done = 0,
      pending = 0;
    for (const s of currentShops) {
      if (readingsMap[s.id]) done++;
      else pending++;
    }
    return { done, pending, total: currentShops.length };
  }, [currentShops, readingsMap]);

  const canManage = true; // Already guarded by RouteGuard

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Gauge className="h-6 w-6 text-primary" />
              قراءات العدادات الشهرية
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {ARABIC_MONTHS[month - 1]} {year} — {total} وحدة
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => carryOverMutation.mutate()}
              disabled={carryOverMutation.isPending}
            >
              {carryOverMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <RefreshCw className="h-4 w-4 ml-1" />
              )}
              ترحيل من الشهر السابق
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || Object.keys(edits).length === 0}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <Save className="h-4 w-4 ml-1" />
              )}
              حفظ {Object.keys(edits).length > 0 && `(${Object.keys(edits).length})`}
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">إجمالي الوحدات</div>
            <div className="text-xl font-bold mt-1">{stats.total}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">مكتملة</div>
            <div className="text-xl font-bold mt-1 text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              {stats.done}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">معلقة</div>
            <div className="text-xl font-bold mt-1 text-amber-500 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {stats.pending}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">نسبة الإنجاز</div>
            <div className="text-xl font-bold mt-1">
              {stats.total ? Math.round((stats.done / stats.total) * 100) : 0}%
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="relative md:col-span-2">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالكود أو الاسم..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pr-9"
              />
            </div>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {ARABIC_MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || now.getFullYear())}
              className="h-9"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">جميع الحالات</option>
              <option value="done">مكتملة</option>
              <option value="pending">معلقة</option>
            </select>
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          {isLoading || readingsLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : currentShops.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد وحدات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right">الوحدة</th>
                    <th className="px-3 py-2 text-center" colSpan={3}>
                      <span className="inline-flex items-center gap-1">
                        <Zap className="h-3 w-3 text-yellow-500" /> كهرباء
                      </span>
                    </th>
                    <th className="px-3 py-2 text-center" colSpan={3}>
                      <span className="inline-flex items-center gap-1">
                        <Droplets className="h-3 w-3 text-blue-500" /> مياه
                      </span>
                    </th>
                    <th className="px-3 py-2 text-center">الحالة</th>
                  </tr>
                  <tr className="border-t">
                    <th className="px-3 py-2 text-right">كود / اسم</th>
                    <th className="px-2 py-2 text-center">السابقة</th>
                    <th className="px-2 py-2 text-center">الحالية</th>
                    <th className="px-2 py-2 text-center">استهلاك</th>
                    <th className="px-2 py-2 text-center">السابقة</th>
                    <th className="px-2 py-2 text-center">الحالية</th>
                    <th className="px-2 py-2 text-center">استهلاك</th>
                    <th className="px-3 py-2 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {currentShops.map((shop) => {
                    const existing = readingsMap[shop.id];
                    const prev = prevReadingsMap[shop.id];
                    const edit = edits[shop.id] ?? {};
                    const ePrev =
                      existing?.elec_previous_reading ?? prev?.elec_current_reading ?? 0;
                    const wPrev =
                      existing?.water_previous_reading ?? prev?.water_current_reading ?? 0;
                    const eCurr = (edit.elec_current_reading ??
                      existing?.elec_current_reading ??
                      null) as number | null;
                    const wCurr = (edit.water_current_reading ??
                      existing?.water_current_reading ??
                      null) as number | null;
                    const eCons = eCurr != null ? +(eCurr - ePrev).toFixed(2) : null;
                    const wCons = wCurr != null ? +(wCurr - wPrev).toFixed(2) : null;
                    const hasContract = activeContracts.some((c) => c.shop_id === shop.id);
                    const isDone = !!existing || eCurr != null || wCurr != null;
                    const elecMt = getMeterType(shop.elec_meter_type);
                    const waterMt = getMeterType(shop.water_meter_type);
                    const elecDisabled = isNoMeter(elecMt);
                    const waterDisabled = isNoMeter(waterMt);
                    const eWarn = eCons != null && eCons < 0;
                    const wWarn = wCons != null && wCons < 0;

                    return (
                      <tr key={shop.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <div className="font-medium">{shop.shop_name}</div>
                          <div className="text-xs text-muted-foreground">{shop.shop_code}</div>
                        </td>
                        {/* Elec prev */}
                        <td className="px-2 py-2 text-center text-muted-foreground tabular-nums">
                          {elecDisabled ? "—" : ePrev.toLocaleString()}
                        </td>
                        {/* Elec current */}
                        <td className="px-2 py-2 text-center">
                          {elecDisabled ? (
                            <Badge variant="outline" className="text-xs">
                              بدون
                            </Badge>
                          ) : (
                            <input
                              type="number"
                              value={eCurr ?? ""}
                              onChange={(ev) => {
                                const v =
                                  ev.target.value === "" ? null : parseFloat(ev.target.value);
                                setEdits((p) => ({
                                  ...p,
                                  [shop.id]: {
                                    ...p[shop.id],
                                    elec_current_reading: v ?? undefined,
                                  },
                                }));
                              }}
                              className="h-8 w-24 rounded-md border bg-background px-2 text-center text-sm tabular-nums focus:border-primary focus:outline-none"
                              placeholder="—"
                            />
                          )}
                        </td>
                        <td
                          className={`px-2 py-2 text-center tabular-nums font-semibold ${eWarn ? "text-destructive" : ""}`}
                        >
                          {elecDisabled ? (
                            "—"
                          ) : eCons != null ? (
                            <span className="inline-flex items-center gap-1">
                              {eCons.toLocaleString()}
                              {eWarn && <AlertCircle className="h-3 w-3" />}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        {/* Water prev */}
                        <td className="px-2 py-2 text-center text-muted-foreground tabular-nums">
                          {waterDisabled ? "—" : wPrev.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {waterDisabled ? (
                            <Badge variant="outline" className="text-xs">
                              بدون
                            </Badge>
                          ) : (
                            <input
                              type="number"
                              value={wCurr ?? ""}
                              onChange={(ev) => {
                                const v =
                                  ev.target.value === "" ? null : parseFloat(ev.target.value);
                                setEdits((p) => ({
                                  ...p,
                                  [shop.id]: {
                                    ...p[shop.id],
                                    water_current_reading: v ?? undefined,
                                  },
                                }));
                              }}
                              className="h-8 w-24 rounded-md border bg-background px-2 text-center text-sm tabular-nums focus:border-primary focus:outline-none"
                              placeholder="—"
                            />
                          )}
                        </td>
                        <td
                          className={`px-2 py-2 text-center tabular-nums font-semibold ${wWarn ? "text-destructive" : ""}`}
                        >
                          {waterDisabled ? (
                            "—"
                          ) : wCons != null ? (
                            <span className="inline-flex items-center gap-1">
                              {wCons.toLocaleString()}
                              {wWarn && <AlertCircle className="h-3 w-3" />}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {!hasContract ? (
                            <Badge variant="secondary" className="text-xs">
                              لا يوجد عقد
                            </Badge>
                          ) : isDone ? (
                            <Badge className="bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3 ml-1" />
                              مكتمل
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-amber-600 bg-amber-500/10">
                              <Clock className="h-3 w-3 ml-1" />
                              معلق
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span>
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
