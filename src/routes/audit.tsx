import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, History, Loader2, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_ROLES } from "@/lib/access-control";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [{ title: "سجل التدقيق — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={PAGE_ROLES.audit}>
      <AuditPage />
    </RouteGuard>
  ),
});

type AuditEntry = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
};

const TABLE_LABELS: Record<string, string> = {
  receipts: "سندات القبض",
  contracts: "العقود",
  customers: "العملاء",
  shops: "الوحدات",
  invoices: "الفواتير",
};

const ACTION_LABELS: Record<string, string> = {
  reverse_receipt: "عكس سند قبض",
  renew_contract: "تجديد عقد",
  archive_contract: "أرشفة عقد",
  archive_customer: "أرشفة عميل",
  archive_shop: "أرشفة وحدة",
};

function AuditPage() {
  const [tableFilter, setTableFilter] = useState("all");
  const [search, setSearch] = useState("");

  const auditQuery = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, table_name, record_id, action, old_values, new_values, user_id, user_name, created_at")
        .order("created_at", { ascending: false })
        .limit(250);
      if (error) throw error;
      return (data ?? []) as unknown as AuditEntry[];
    },
  });

  const tableNames = useMemo(
    () => [...new Set((auditQuery.data ?? []).map((entry) => entry.table_name).filter(Boolean))].sort(),
    [auditQuery.data],
  );

  const entries = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return (auditQuery.data ?? []).filter((entry) => {
      if (tableFilter !== "all" && entry.table_name !== tableFilter) return false;
      if (!normalizedSearch) return true;
      return [
        entry.action,
        entry.table_name,
        entry.record_id,
        entry.user_name,
        summarizeValues(entry.new_values),
        summarizeValues(entry.old_values),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [auditQuery.data, search, tableFilter]);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <History className="h-6 w-6 text-primary" />
              سجل التدقيق
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              متابعة العمليات الحساسة وحفظ مرجعها المحاسبي والتشغيلي.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void auditQuery.refetch()} disabled={auditQuery.isFetching}>
            {auditQuery.isFetching ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Filter className="ml-1 h-4 w-4" />}
            تحديث السجل
          </Button>
        </div>

        <Card className="border-primary/15 bg-primary/5 p-4 text-sm">
          <div className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              يعرض هذا السجل آخر 250 عملية مسموحة لحسابك فقط. لا يعرض كلمات المرور أو المرفقات أو البيانات الحساسة
              الكاملة؛ بل يقتصر على مرجع السجل والحالة والتغيير المسجل.
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pr-9"
                placeholder="ابحث بالعملية أو المرجع أو المستخدم..."
              />
            </div>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger>
                <SelectValue placeholder="كل المجالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المجالات</SelectItem>
                {tableNames.map((tableName) => (
                  <SelectItem key={tableName} value={tableName}>
                    {TABLE_LABELS[tableName] ?? tableName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {auditQuery.isLoading ? (
            <div className="flex justify-center p-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : auditQuery.isError ? (
            <div className="p-10 text-center text-sm text-destructive">تعذر تحميل سجل التدقيق أو لا تملك صلاحية عرضه.</div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">لا توجد عمليات تطابق عوامل التصفية الحالية.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">العملية</th>
                    <th className="p-3 text-right">المجال</th>
                    <th className="p-3 text-right">المرجع</th>
                    <th className="p-3 text-right">بيان التغيير</th>
                    <th className="p-3 text-right">المستخدم</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t align-top hover:bg-muted/20">
                      <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{formatAuditDate(entry.created_at)}</td>
                      <td className="p-3 font-semibold">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                      <td className="p-3">{TABLE_LABELS[entry.table_name] ?? entry.table_name}</td>
                      <td className="max-w-36 truncate p-3 font-mono text-xs">{entry.record_id ?? "—"}</td>
                      <td className="max-w-md p-3 text-muted-foreground">{summarizeValues(entry.new_values) || summarizeValues(entry.old_values) || "—"}</td>
                      <td className="p-3">{entry.user_name ?? entry.user_id ?? "النظام"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        {!auditQuery.isLoading && !auditQuery.isError && (
          <p className="text-xs text-muted-foreground">عدد العمليات المعروضة: {entries.length} من آخر 250 عملية.</p>
        )}
      </div>
    </AppLayout>
  );
}

function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function summarizeValues(values: Record<string, unknown> | null) {
  if (!values) return "";
  const readableKeys: Array<[string, string]> = [
    ["receipt_no", "السند"],
    ["reversal_receipt_no", "سند العكس"],
    ["contract_no", "العقد"],
    ["renewed_contract_no", "العقد الجديد"],
    ["status", "الحالة"],
    ["reason", "السبب"],
    ["end_date", "النهاية"],
  ];
  return readableKeys
    .filter(([key]) => values[key] !== undefined && values[key] !== null && values[key] !== "")
    .map(([key, label]) => `${label}: ${String(values[key])}`)
    .join(" · ");
}
