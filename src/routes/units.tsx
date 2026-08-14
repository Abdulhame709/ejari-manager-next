import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  ChevronLeft,
  MapPin,
  Maximize2,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Wifi,
  Loader2,
  CheckCircle2,
  Phone,
  Mail,
  Calendar,
  X,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { EjariLogo } from "@/components/ejari-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { defaultPathForRole } from "@/lib/access-control";
import type { Database } from "@/integrations/supabase/types";
import { canonicalUrl } from "@/lib/seo";
import { sanitizeSearchTerm } from "@/lib/utils";

export const Route = createFileRoute("/units")({
  head: () => ({
    meta: [
      { title: "الوحدات المتاحة للإيجار — إيجاري EJARI" },
      {
        name: "description",
        content:
          "تصفح الوحدات والمحلات التجارية والشقق المتاحة للإيجار واطلب معاينة مباشرة عبر منصة إيجاري.",
      },
      { property: "og:title", content: "الوحدات المتاحة للإيجار — إيجاري EJARI" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/units") }],
  }),
  component: UnitsPage,
});

interface PublicUnit {
  id: string;
  shop_code: string;
  shop_name: string;
  description: string | null;
  monthly_rent: number | null;
  area_sqm: number | null;
  location_details: string | null;
  market_description: string | null;
  suitable_for: string | null;
  features: string[] | Record<string, unknown> | null;
  unit_type: string | null;
}

const UNIT_ICONS: Record<string, typeof Store> = {
  shop: Store,
  apartment: BedDouble,
  office: Building2,
  warehouse: Building2,
  land: MapPin,
  clinic: Building2,
  other: Building2,
};
const UNIT_GRADIENTS: Record<string, string> = {
  shop: "from-blue-800 via-blue-600 to-cyan-400",
  apartment: "from-emerald-800 via-teal-600 to-cyan-300",
  office: "from-violet-800 via-indigo-600 to-fuchsia-400",
  warehouse: "from-slate-800 via-slate-600 to-slate-400",
  land: "from-amber-800 via-amber-600 to-yellow-400",
  clinic: "from-rose-800 via-pink-600 to-fuchsia-400",
  other: "from-indigo-800 via-indigo-600 to-sky-400",
};
const UNIT_TYPE_LABELS: Record<string, string> = {
  shop: "محل تجاري",
  apartment: "شقة سكنية",
  office: "مكتب إداري",
  warehouse: "مستودع",
  land: "أرض",
  clinic: "عيادة",
  other: "وحدة",
};

function UnitsPage() {
  const { user, role, fullName, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewUnit, setViewUnit] = useState<PublicUnit | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const qc = useQueryClient();

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await signOut();
      toast.success("تم تسجيل الخروج بنجاح");
      await navigate({ to: "/login", replace: true });
    } catch (error) {
      console.error("Failed to sign out", error);
      // AuthContext clears the local session before contacting Supabase, so the
      // visitor must still be allowed to return to the login page.
      await navigate({ to: "/login", replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  const { data: units = [], isLoading } = useQuery<PublicUnit[]>({
    queryKey: ["public-units", search, typeFilter],
    queryFn: async () => {
      let q = supabase
        .from("shops")
        .select(
          "id, shop_code, shop_name, description, monthly_rent, area_sqm, location_details, market_description, suitable_for, features, unit_type",
        )
        .eq("is_public", true)
        .eq("is_active", true)
        .eq("status", "available");
      if (search.trim())
        q = q.or(
          `shop_name.ilike.%${sanitizeSearchTerm(search)}%,description.ilike.%${sanitizeSearchTerm(search)}%,location_details.ilike.%${sanitizeSearchTerm(search)}%`,
        );
      if (typeFilter !== "all")
        q = q.eq("unit_type", typeFilter as Database["public"]["Enums"]["unit_type"]);
      q = q.order("shop_code").limit(60);
      const { data } = await q;
      return (data ?? []) as PublicUnit[];
    },
  });

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-900" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
          <EjariLogo />
          <div className="hidden items-center gap-6 text-sm font-bold text-slate-600 md:flex">
            <a href="#units" className="text-blue-600">
              الوحدات المتاحة
            </a>
            <a href="#how" className="hover:text-blue-600">
              كيف يعمل إيجاري؟
            </a>
            <a href="#contact" className="hover:text-blue-600">
              تواصل معنا
            </a>
          </div>
          <div className="flex items-center gap-2">
            {authLoading ? (
              <div className="flex h-10 w-24 items-center justify-center rounded-xl bg-slate-100">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              </div>
            ) : user ? (
              <>
                {role && role !== "visitor" && (
                  <Link
                    to={defaultPathForRole(role)}
                    className="hidden items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100 sm:inline-flex"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {role === "tenant" ? "بوابة المستأجر" : "لوحة التحكم"}
                  </Link>
                )}
                {role === "visitor" && fullName && (
                  <span className="hidden max-w-36 truncate text-xs font-bold text-slate-600 sm:block">
                    {fullName}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {signingOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">تسجيل الخروج</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
              >
                تسجيل الدخول
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#0b2450] px-5 py-16 text-white lg:py-20">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 10%, #0ea5e9 0, transparent 24%), radial-gradient(circle at 12% 100%, #2563eb 0, transparent 30%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-100">
            <Sparkles className="h-3.5 w-3.5" /> فرص إيجارية موثوقة في مكان واحد
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
            اعثر على المساحة المناسبة
            <br />
            <span className="text-cyan-300">لنمط حياتك أو عملك.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-blue-100/80 sm:text-base">
            تصفّح الوحدات المتاحة، تعرف على مميزاتها، وأرسل طلب معاينة مباشرة إلى إدارة العقار.
          </p>
          <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl sm:flex-row">
            <div className="flex flex-1 items-center gap-2 px-3 text-slate-400">
              <Search className="h-5 w-5" />
              <input
                className="h-10 w-full text-sm text-slate-800 outline-none"
                placeholder="ابحث بالمنطقة أو اسم الوحدة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="h-10 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-700">
              بحث
            </button>
          </div>
        </div>
      </section>

      <section id="units" className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-blue-600">وحدات متاحة للإيجار</p>
            <h2 className="mt-1 text-2xl font-extrabold">الوحدات المعروضة</h2>
            <p className="mt-2 text-sm text-slate-500">{units.length} وحدة متاحة حالياً</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <TypeBtn active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
              الكل
            </TypeBtn>
            {Object.entries(UNIT_TYPE_LABELS).map(([k, v]) => (
              <TypeBtn key={k} active={typeFilter === k} onClick={() => setTypeFilter(k)}>
                {v}
              </TypeBtn>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : units.length === 0 ? (
          <Card className="p-16 text-center text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد وحدات متاحة حالياً تطابق بحثك</p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {units.map((unit) => (
              <UnitCard key={unit.id} unit={unit} onView={() => setViewUnit(unit)} />
            ))}
          </div>
        )}
      </section>

      <section id="how" className="border-y border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
            <div>
              <p className="text-sm font-bold text-blue-600">شفافية من البداية</p>
              <h2 className="mt-2 text-3xl font-extrabold leading-tight">
                استأجر بثقة،
                <br />
                ودع إيجاري ينظم التفاصيل.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-500">
                بعد استئجارك، ستحصل على حساب مستأجر خاص يمكّنك من متابعة فواتيرك، كشف حسابك، وإرسال
                إشعارات التحويل والإيداع بأمان.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["01", "تصفح", "شاهد الوحدات ومميزاتها"],
                ["02", "اطلب معاينة", "أرسل طلبك للإدارة بسهولة"],
                ["03", "أدر عقدك", "تابع حسابك ومدفوعاتك"],
              ].map(([n, t, tx]) => (
                <div key={n} className="rounded-2xl bg-slate-50 p-5">
                  <span className="text-2xl font-extrabold text-blue-200">{n}</span>
                  <h3 className="mt-5 font-extrabold">{t}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{tx}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-[#091b38] px-5 py-7 text-blue-100/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 lg:px-3">
          <EjariLogo className="[&>div>div:first-child]:text-white [&>div>div:last-child]:text-cyan-200" />
          <p className="text-xs">© 2026 إيجاري EJARI — منصة إدارة الإيجارات</p>
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-300" /> منصة آمنة ومصممة لاحتياجات اليمن
          </div>
        </div>
      </footer>

      <ViewingDialog
        unit={viewUnit}
        onClose={() => setViewUnit(null)}
        onSubmitted={() => {
          setViewUnit(null);
          qc.invalidateQueries({ queryKey: ["public-units"] });
        }}
      />
    </main>
  );
}

function TypeBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-bold ${active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      {children}
    </button>
  );
}

function UnitCard({ unit, onView }: { unit: PublicUnit; onView: () => void }) {
  const Icon = UNIT_ICONS[unit.unit_type ?? "other"] ?? Building2;
  const gradient = UNIT_GRADIENTS[unit.unit_type ?? "other"] ?? UNIT_GRADIENTS.other;
  const features = Array.isArray(unit.features) ? (unit.features as string[]) : [];
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div
        className={`relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br ${gradient}`}
      >
        <Icon className="h-20 w-20 text-white/85" strokeWidth={1.2} />
        <span className="absolute right-4 top-4 rounded-full bg-emerald-400 px-2.5 py-1 text-[11px] font-extrabold text-emerald-950">
          متاحة الآن
        </span>
        <span className="absolute bottom-3 left-3 rounded-lg bg-slate-950/30 px-2 py-1 text-xs font-bold text-white backdrop-blur">
          {UNIT_TYPE_LABELS[unit.unit_type ?? "other"]}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-blue-600">وحدة {unit.shop_code}</p>
            <h3 className="mt-1 text-lg font-extrabold">{unit.shop_name}</h3>
          </div>
          <div className="text-left">
            <p className="text-sm font-extrabold text-slate-900">
              {unit.monthly_rent ? Math.round(unit.monthly_rent).toLocaleString("ar-EG") : "—"}
            </p>
            <p className="text-[10px] text-slate-500">ريال يمني / شهرياً</p>
          </div>
        </div>
        {(unit.location_details || unit.area_sqm) && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            {unit.location_details && (
              <>
                <MapPin className="h-3.5 w-3.5 text-rose-500" />
                {unit.location_details}
              </>
            )}
            {unit.location_details && unit.area_sqm && (
              <span className="mx-1 text-slate-300">•</span>
            )}
            {unit.area_sqm && (
              <>
                <Maximize2 className="h-3.5 w-3.5 text-blue-500" />
                {unit.area_sqm} م²
              </>
            )}
          </p>
        )}
        {(unit.market_description || unit.description) && (
          <div className="mt-4 rounded-xl bg-blue-50 p-3">
            <p className="text-[11px] font-extrabold text-blue-700">ماذا تقدم هذه الوحدة؟</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {unit.market_description || unit.description}
            </p>
          </div>
        )}
        {unit.suitable_for && (
          <p className="mt-3 text-xs text-slate-500">
            <span className="font-bold text-slate-700">مناسبة لـ: </span>
            {unit.suitable_for}
          </p>
        )}
        {features.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {features.slice(0, 3).map((f, i) => (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"
              >
                {i === 0 ? (
                  <BedDouble className="h-3 w-3" />
                ) : i === 1 ? (
                  <Bath className="h-3 w-3" />
                ) : (
                  <Wifi className="h-3 w-3" />
                )}
                {f}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={onView}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 py-2.5 text-sm font-extrabold text-blue-700 transition hover:bg-blue-600 hover:text-white"
        >
          عرض التفاصيل وطلب معاينة
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function ViewingDialog({
  unit,
  onClose,
  onSubmitted,
}: {
  unit: PublicUnit | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [prefDate, setPrefDate] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name || !phone || !unit) throw new Error("الاسم والهاتف مطلوبان");
      const { error } = await supabase.from("viewing_requests").insert({
        shop_id: unit.id,
        visitor_name: name,
        visitor_phone: phone,
        visitor_email: email || null,
        preferred_date: prefDate || null,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم إرسال طلب المعاينة، سنتواصل معك قريباً");
      setName("");
      setPhone("");
      setEmail("");
      setPrefDate("");
      setNotes("");
      onSubmitted();
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل إرسال الطلب")),
  });

  return (
    <Dialog open={!!unit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        {unit && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
                <span>طلب معاينة — {unit.shop_name}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الوحدة:</span>
                  <strong>
                    {unit.shop_code} — {unit.shop_name}
                  </strong>
                </div>
                {unit.monthly_rent && (
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">الإيجار:</span>
                    <strong className="text-blue-700">
                      {Math.round(unit.monthly_rent).toLocaleString("ar-EG")} ر.ي
                    </strong>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <Label>الاسم الكامل *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسمك"
                  />
                </div>
                <div>
                  <Label>رقم الهاتف *</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    dir="ltr"
                    placeholder="+967 ..."
                  />
                </div>
                <div>
                  <Label>البريد الإلكتروني (اختياري)</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>الوقت المفضل للمعاينة (اختياري)</Label>
                  <Input
                    value={prefDate}
                    onChange={(e) => setPrefDate(e.target.value)}
                    placeholder="مثلاً: مساء الثلاثاء"
                  />
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-1" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 ml-1" />
                )}
                إرسال الطلب
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
