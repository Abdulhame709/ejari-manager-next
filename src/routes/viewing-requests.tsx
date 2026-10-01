import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2, MapPin, Phone, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { PAGE_ROLES } from "@/lib/access-control";

export const Route = createFileRoute("/viewing-requests")({
  head: () => ({
    meta: [
      { title: "طلبات المعاينة — إيجاري" },
      { name: "description", content: "متابعة طلبات معاينة الوحدات الواردة من الزوار." },
    ],
  }),
  component: ViewingRequestsPage,
});

type RequestStatus = "new" | "contacted" | "viewed" | "cancelled";

type ViewingRequest = {
  id: string;
  created_at: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  preferred_date: string | null;
  notes: string | null;
  status: RequestStatus;
  shops: { shop_code: string; shop_name: string } | null;
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  viewed: "تمت المعاينة",
  cancelled: "ملغى",
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  new: "border-blue-200 bg-blue-50 text-blue-700",
  contacted: "border-amber-200 bg-amber-50 text-amber-700",
  viewed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-slate-200 bg-slate-100 text-slate-600",
};

function ViewingRequestsPage() {
  return (
    <RouteGuard allowedRoles={PAGE_ROLES.viewingRequests}>
      <AppLayout>
        <ViewingRequestsContent />
      </AppLayout>
    </RouteGuard>
  );
}

function ViewingRequestsContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus>("all");

  const {
    data: requests = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["viewing-requests", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("viewing_requests")
        .select(
          "id, created_at, visitor_name, visitor_phone, visitor_email, preferred_date, notes, status, shops(shop_code, shop_name)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ViewingRequest[];
    },
  });

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((request) =>
      [
        request.visitor_name,
        request.visitor_phone,
        request.visitor_email ?? "",
        request.shops?.shop_name ?? "",
        request.shops?.shop_code ?? "",
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [requests, search]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RequestStatus }) => {
      const { error } = await supabase.from("viewing_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة الطلب");
      void queryClient.invalidateQueries({ queryKey: ["viewing-requests"] });
    },
    onError: () => toast.error("تعذر تحديث حالة الطلب"),
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-primary">تشغيل الزوار</p>
          <h1 className="mt-1 text-3xl font-bold">طلبات المعاينة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            تابع طلبات الزوار وحوّلها إلى مواعيد ومعاينات مكتملة.
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">المعروض: </span>
          <strong>{filteredRequests.length}</strong>
        </div>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالاسم أو الهاتف أو الوحدة..."
            className="pr-9"
            aria-label="البحث في طلبات المعاينة"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
          aria-label="تصفية حالة الطلب"
        >
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Card>

      {isLoading ? (
        <Card className="flex items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </Card>
      ) : isError ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-destructive">تعذر تحميل طلبات المعاينة.</p>
          <button className="mt-4 text-sm font-bold text-primary" onClick={() => void refetch()}>
            إعادة المحاولة
          </button>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card className="p-16 text-center text-muted-foreground">
          <CalendarCheck className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>لا توجد طلبات تطابق البحث الحالي.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              pending={updateStatus.isPending}
              onStatusChange={(status) => updateStatus.mutate({ id: request.id, status })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  pending,
  onStatusChange,
}: {
  request: ViewingRequest;
  pending: boolean;
  onStatusChange: (status: RequestStatus) => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{request.visitor_name}</h2>
            <Badge className={STATUS_STYLES[request.status]}>{STATUS_LABELS[request.status]}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(request.created_at).toLocaleString("ar-YE")}
          </p>
        </div>
        <select
          value={request.status}
          disabled={pending}
          onChange={(event) => onStatusChange(event.target.value as RequestStatus)}
          className="h-9 rounded-md border bg-background px-2 text-xs font-bold"
          aria-label={`تغيير حالة طلب ${request.visitor_name}`}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info icon={Phone} label="الهاتف" value={request.visitor_phone} />
        <Info icon={UserRound} label="البريد" value={request.visitor_email ?? "غير مضاف"} />
        <Info
          icon={MapPin}
          label="الوحدة"
          value={
            request.shops ? `${request.shops.shop_code} — ${request.shops.shop_name}` : "غير متاحة"
          }
        />
        <Info
          icon={CalendarCheck}
          label="الموعد المفضل"
          value={request.preferred_date ?? "غير محدد"}
        />
      </div>
      {request.notes && (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm leading-6 text-muted-foreground">
          <strong className="text-foreground">ملاحظات الزائر: </strong>
          {request.notes}
        </p>
      )}
    </Card>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p
        className="mt-1 truncate text-sm font-semibold"
        dir={label === "الهاتف" ? "ltr" : undefined}
      >
        {value}
      </p>
    </div>
  );
}
