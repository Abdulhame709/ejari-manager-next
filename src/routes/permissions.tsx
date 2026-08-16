import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LockKeyhole, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { StaffRole } from "@/lib/access-control";

export const Route = createFileRoute("/permissions")({
  head: () => ({
    meta: [
      { title: "صلاحيات المستخدمين — إيجاري" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <RouteGuard allowedRoles={["admin"]}>
      <PermissionsPage />
    </RouteGuard>
  ),
});

type PermissionKey =
  | "configuration.view"
  | "configuration.manage"
  | "inputs.view"
  | "inputs.manage"
  | "screens.dashboard"
  | "screens.properties"
  | "screens.shops"
  | "screens.customers"
  | "screens.contracts"
  | "screens.readings"
  | "screens.invoices"
  | "screens.receipts"
  | "screens.reports"
  | "screens.users"
  | "screens.permissions"
  | "operations.contracts"
  | "operations.payments"
  | "operations.payment_approvals"
  | "reports.view"
  | "reports.export";

type PermissionUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  account_type: "staff" | "tenant" | "visitor" | null;
  is_active: boolean | null;
  user_roles: Array<{ role: StaffRole }> | null;
  user_permissions: Array<{ permission_key: PermissionKey; allowed: boolean }> | null;
};

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "مدير النظام",
  manager: "مدير عقارات",
  accountant: "محاسب",
  data_entry: "إدخال بيانات",
  viewer: "مشاهد",
};
const STAFF_ROLES: StaffRole[] = ["admin", "manager", "accountant", "data_entry", "viewer"];
const PERMISSION_GROUPS = [
  {
    title: "التهيئة والإعدادات",
    items: [
      ["configuration.view", "عرض الإعدادات"],
      ["configuration.manage", "تعديل الإعدادات"],
    ],
  },
  {
    title: "المدخلات والبيانات",
    items: [
      ["inputs.view", "عرض المدخلات"],
      ["inputs.manage", "إدارة المدخلات"],
    ],
  },
  {
    title: "الشاشات",
    items: [
      ["screens.dashboard", "لوحة التحكم"],
      ["screens.properties", "العقارات"],
      ["screens.shops", "الوحدات"],
      ["screens.customers", "المستأجرون"],
      ["screens.contracts", "العقود"],
      ["screens.readings", "قراءات العدادات"],
      ["screens.invoices", "الفواتير"],
      ["screens.receipts", "المدفوعات"],
      ["screens.reports", "التقارير"],
      ["screens.users", "المستخدمون"],
      ["screens.permissions", "الصلاحيات"],
    ],
  },
  {
    title: "العمليات والتقارير",
    items: [
      ["operations.contracts", "عمليات العقود"],
      ["operations.payments", "عمليات المدفوعات"],
      ["operations.payment_approvals", "اعتماد المدفوعات"],
      ["reports.view", "عرض التقارير"],
      ["reports.export", "تصدير التقارير"],
    ],
  },
] as const satisfies ReadonlyArray<{
  title: string;
  items: ReadonlyArray<readonly [PermissionKey, string]>;
}>;

function PermissionsPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data: users = [], isLoading } = useQuery<PermissionUser[]>({
    queryKey: ["permissions-users"],
    queryFn: fetchPermissionUsers,
    refetchOnWindowFocus: true,
  });
  const staffUsers = useMemo(
    () => users.filter((user) => user.account_type === "staff" || user.user_roles?.length),
    [users],
  );
  const selectedUser =
    staffUsers.find((user) => user.id === selectedUserId) ?? staffUsers[0] ?? null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["permissions-users"] });
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  };
  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: StaffRole }) => {
      if (userId === currentUser?.id) throw new Error("لا يمكنك تغيير دور نفسك");
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success("تم تحديث دور المستخدم");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "تعذر تحديث الدور"),
  });
  const setActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase.rpc("admin_set_user_active", {
        p_user_id: userId,
        p_is_active: active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة المستخدم");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "تعذر تحديث الحالة"),
  });
  const removeAccess = useMutation({
    mutationFn: async (userId: string) => {
      if (userId === currentUser?.id) throw new Error("لا يمكنك إزالة وصول حسابك الحالي");
      const { error } = await supabase.rpc("admin_remove_user_access", { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تعطيل الحساب وإزالة صلاحياته");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "تعذر إزالة الوصول"),
  });
  const setPermission = useMutation({
    mutationFn: async ({
      userId,
      key,
      allowed,
    }: {
      userId: string;
      key: PermissionKey;
      allowed: boolean;
    }) => {
      const { error } = await supabase.from("user_permissions").upsert(
        {
          user_id: userId,
          permission_key: key,
          allowed,
          granted_by: currentUser?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,permission_key" },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message || "تعذر حفظ الصلاحية"),
  });

  return (
    <AppLayout>
      <div className="space-y-5" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <ShieldCheck className="h-6 w-6 text-primary" /> صلاحيات المستخدمين
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              إدارة الحسابات والأدوار والصلاحيات التفصيلية من شاشة واحدة.
            </p>
          </div>
          <Link
            to="/users"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> إضافة مستخدم
          </Link>
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b bg-muted/30 px-5 py-4">
            <LockKeyhole className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-bold">الحسابات والأدوار</h2>
              <p className="text-xs text-muted-foreground">
                التعديل متاح لمدير النظام، ولا يمكن تعديل الحساب الحالي.
              </p>
            </div>
          </div>
          {isLoading ? (
            <div className="p-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            </div>
          ) : staffUsers.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">لا توجد حسابات موظفين.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right">المستخدم</th>
                    <th className="px-4 py-3 text-center">الحالة</th>
                    <th className="px-4 py-3 text-center">الدور</th>
                    <th className="px-4 py-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {staffUsers.map((account) => {
                    const role = account.user_roles?.[0]?.role ?? "viewer";
                    const isSelf = account.id === currentUser?.id;
                    const selected = account.id === selectedUser?.id;
                    return (
                      <tr
                        key={account.id}
                        className={selected ? "border-t bg-primary/5" : "border-t"}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="flex items-center gap-3 text-right"
                            onClick={() => setSelectedUserId(account.id)}
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <UserRound className="h-4 w-4" />
                            </span>
                            <span>
                              <span className="block font-medium">
                                {account.full_name || "بدون اسم"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {account.phone || "لا يوجد هاتف"}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {account.is_active === false ? (
                            <Badge variant="destructive">معطل</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-700">نشط</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Select
                            value={role}
                            onValueChange={(value) =>
                              updateRole.mutate({ userId: account.id, role: value as StaffRole })
                            }
                            disabled={isSelf || updateRole.isPending}
                          >
                            <SelectTrigger className="mx-auto w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STAFF_ROLES.map((item) => (
                                <SelectItem key={item} value={item}>
                                  {ROLE_LABELS[item]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isSelf || setActive.isPending}
                              onClick={() =>
                                setActive.mutate({
                                  userId: account.id,
                                  active: account.is_active === false,
                                })
                              }
                            >
                              {account.is_active === false ? "تفعيل" : "تعطيل"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isSelf || removeAccess.isPending}
                              onClick={() => removeAccess.mutate(account.id)}
                            >
                              <Trash2 className="ml-1 h-3.5 w-3.5" /> إزالة
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {selectedUser && (
          <Card className="overflow-hidden">
            <div className="border-b bg-primary/5 px-5 py-4">
              <h2 className="font-bold">
                الصلاحيات التفصيلية: {selectedUser.full_name || "المستخدم المحدد"}
              </h2>
              <p className="text-xs text-muted-foreground">
                حدد ما يمكن للمستخدم عرضه أو إدارته في التهيئة والمدخلات والشاشات والعمليات
                والتقارير.
              </p>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.title} className="rounded-lg border p-4">
                  <h3 className="mb-3 font-semibold">{group.title}</h3>
                  <div className="space-y-2">
                    {group.items.map(([key, label]) => {
                      const allowed =
                        selectedUser.user_permissions?.some(
                          (item) => item.permission_key === key && item.allowed,
                        ) ?? false;
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
                        >
                          <span>{label}</span>
                          <input
                            type="checkbox"
                            checked={allowed}
                            onChange={(event) =>
                              setPermission.mutate({
                                userId: selectedUser.id,
                                key,
                                allowed: event.target.checked,
                              })
                            }
                            disabled={setPermission.isPending}
                            className="h-4 w-4 accent-primary"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        <p className="text-xs text-muted-foreground">
          الإزالة من هذه الشاشة تعني تعطيل الحساب وإزالة أدواره وصلاحياته التشغيلية. الحذف النهائي
          من Supabase Auth يحتاج إجراءً خادمياً مخصصاً ولا يتم تنفيذه من المتصفح مباشرة.
        </p>
      </div>
    </AppLayout>
  );
}

async function fetchPermissionUsers(): Promise<PermissionUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, phone, account_type, is_active, user_roles(role), user_permissions(permission_key, allowed)",
    )
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as unknown as PermissionUser[];
}
