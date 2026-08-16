import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Loader2, UserRound, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type PermissionUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  account_type: "staff" | "tenant" | "visitor" | null;
  is_active: boolean | null;
  user_roles: Array<{ role: StaffRole }> | null;
};

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "مدير النظام",
  manager: "مدير عقارات",
  accountant: "محاسب",
  data_entry: "إدخال بيانات",
  viewer: "مشاهد",
};

const STAFF_ROLES: StaffRole[] = ["admin", "manager", "accountant", "data_entry", "viewer"];

function PermissionsPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery<PermissionUser[]>({
    queryKey: ["permissions-users"],
    queryFn: fetchPermissionUsers,
  });

  const staffUsers = useMemo(
    () => users.filter((user) => user.account_type === "staff" || user.user_roles?.length),
    [users],
  );

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
      toast.success("تم تحديث صلاحية المستخدم");
      void queryClient.invalidateQueries({ queryKey: ["permissions-users"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => toast.error(error.message || "تعذر تحديث الصلاحية"),
  });

  return (
    <AppLayout>
      <div className="space-y-5" dir="rtl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-6 w-6 text-primary" /> صلاحيات المستخدمين
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            يراجع مدير النظام أدوار الموظفين من هنا. لا يمكن تعديل دور الحساب الحالي أو منح صلاحية
            خارج الأدوار المعتمدة.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STAFF_ROLES.map((role) => (
            <Card key={role} className="p-4">
              <div className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</div>
              <div className="mt-2 text-2xl font-bold">
                {
                  staffUsers.filter((user) => user.user_roles?.some((item) => item.role === role))
                    .length
                }
              </div>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b bg-muted/30 px-5 py-4">
            <LockKeyhole className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-bold">تعيين أدوار الموظفين</h2>
              <p className="text-xs text-muted-foreground">
                تطبق قواعد RLS في قاعدة البيانات التحقق النهائي.
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
                    <th className="px-4 py-3 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {staffUsers.map((account) => {
                    const role = account.user_roles?.[0]?.role ?? "viewer";
                    const isSelf = account.id === currentUser?.id;
                    return (
                      <tr key={account.id} className="border-t">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <UserRound className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium">{account.full_name || "بدون اسم"}</div>
                              <div className="text-xs text-muted-foreground">
                                {account.phone || "لا يوجد هاتف"}
                              </div>
                            </div>
                          </div>
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
                        <td className="px-4 py-3 text-center">
                          {isSelf ? (
                            <span className="text-xs text-muted-foreground">الحساب الحالي</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateRole.mutate({ userId: account.id, role })}
                              disabled={updateRole.isPending}
                            >
                              حفظ
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

async function fetchPermissionUsers(): Promise<PermissionUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, account_type, is_active, user_roles(role)")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as unknown as PermissionUser[];
}
