import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createIsolatedSupabaseClient, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/app-layout";
import { RouteGuard } from "@/components/route-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  ShieldCheck,
  Plus,
  Trash2,
  UserPlus,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  User as UserIcon,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { validatePassword } from "@/lib/utils";
import { AccountRequestsPanel } from "@/components/account-requests-panel";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [{ title: "المستخدمون — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={["admin", "manager"]}>
      <UsersPage />
    </RouteGuard>
  ),
});

type StaffRole = "admin" | "manager" | "accountant" | "data_entry" | "viewer";
type AppRole = StaffRole | "tenant" | "visitor";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  is_active: boolean | null;
  role: AppRole | null;
  last_sign_in_at: string | null;
  last_login_at: string | null;
  created_at: string | null;
}

const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: "مدير النظام",
  manager: "مدير عقارات",
  accountant: "محاسب",
  data_entry: "إدخال بيانات",
  viewer: "مشاهد",
};

const ROLE_LABELS: Record<AppRole, string> = {
  ...STAFF_ROLE_LABELS,
  tenant: "مستأجر",
  visitor: "زائر",
};

function UsersPage() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["users", search],
    queryFn: fetchUsers,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["users-customer-options"],
    queryFn: async () =>
      (
        await supabase
          .from("customers")
          .select("id, full_name, phone")
          .eq("is_active", true)
          .order("full_name")
      ).data ?? [],
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      full_name: string;
      phone: string;
      password: string;
      role: AppRole;
      customer_id?: string;
    }) => {
      // Never create another user with the main auth client. A normal signUp
      // replaces the browser's current session and used to redirect/hang the
      // administrator who opened this page.
      const isolatedClient = createIsolatedSupabaseClient();
      const { data: authData, error: authError } = await isolatedClient.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: { data: { full_name: data.full_name, phone: data.phone, account_type: "staff" } },
      });
      if (authError) throw authError;

      const uid = authData.user?.id;
      if (!uid) throw new Error("تعذر إنشاء المستخدم");

      const accountType =
        data.role === "tenant" ? "tenant" : data.role === "visitor" ? "visitor" : "staff";
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          phone: data.phone,
          is_active: true,
          account_type: accountType,
        })
        .eq("id", uid);
      if (profileError) throw profileError;

      // The database creates a safe viewer role first. Replace it explicitly
      // with the role selected by the administrator.
      const { error: deleteRoleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", uid);
      if (deleteRoleError) throw deleteRoleError;

      if (data.role === "tenant") {
        if (!data.customer_id) throw new Error("اختر المستأجر المرتبط بالحساب");
        const { error: tenantError } = await supabase.from("tenant_accounts").insert({
          user_id: uid,
          customer_id: data.customer_id,
          is_active: true,
        });
        if (tenantError) throw tenantError;
      } else if (data.role !== "visitor") {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: uid, role: data.role });
        if (roleError) throw roleError;
      }

      return uid;
    },
    onSuccess: () => {
      toast.success("✅ تم إنشاء المستخدم وإسناد الدور");
      qc.invalidateQueries({ queryKey: ["users"] });
      setInviteOpen(false);
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل إنشاء المستخدم")),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: StaffRole }) => {
      if (userId === currentUser?.id) throw new Error("لا يمكنك تغيير دور نفسك");
      // Delete existing roles
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم تحديث الدور");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل تحديث الدور")),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      if (userId === currentUser?.id) throw new Error("لا يمكنك تعطيل حساب نفسك");
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: active })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم تحديث الحالة");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل التحديث")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (userId === currentUser?.id) throw new Error("لا يمكنك حذف حساب نفسك");
      // Delete user via Supabase — requires service role; in client we cannot delete auth users.
      // Workaround: deactivate the profile and remove roles.
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ تم تعطيل المستخدم (يتطلب حذف من لوحة Supabase للحذف النهائي)");
      qc.invalidateQueries({ queryKey: ["users"] });
      setDeleteUser(null);
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل")),
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              المستخدمون والصلاحيات
            </h1>
            <p className="text-sm text-muted-foreground mt-1">إدارة حسابات الموظفين وأدوارهم</p>
          </div>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 ml-1" />
            دعوة مستخدم جديد
          </Button>
        </div>

        <AccountRequestsPanel />

        <Card className="border-sky-500/20 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-sky-500/5 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10 text-sky-700">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold">حسابات الزوار ونشاط الدخول</h2>
                <p className="text-xs text-muted-foreground">
                  متابعة الحسابات العامة دون كشف بيانات حساسة
                </p>
              </div>
            </div>
            <Badge className="bg-sky-500/20 text-sky-700">
              {users.filter((u) => u.role === "visitor").length} زائر
            </Badge>
          </div>
          <div className="overflow-x-auto">
            {users.filter((u) => u.role === "visitor").length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                لا توجد حسابات زوار بعد.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right">الزائر</th>
                    <th className="px-3 py-2 text-center">الحالة</th>
                    <th className="px-3 py-2 text-center">آخر دخول</th>
                    <th className="px-3 py-2 text-center">تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter((u) => u.role === "visitor")
                    .map((visitor) => (
                      <tr key={visitor.id} className="border-t">
                        <td className="px-3 py-3">
                          <div className="font-medium">{visitor.full_name || "زائر بدون اسم"}</div>
                          <div className="text-xs text-muted-foreground">
                            {visitor.phone || "لا يوجد هاتف"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {visitor.is_active === false ? (
                            <Badge variant="destructive">معطل</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/20 text-emerald-700">نشط</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {visitor.last_login_at
                            ? format(new Date(visitor.last_login_at), "yyyy/MM/dd HH:mm")
                            : "لم يدخل بعد"}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {visitor.created_at
                            ? format(new Date(visitor.created_at), "yyyy/MM/dd")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو البريد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا يوجد مستخدمون</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right">المستخدم</th>
                    <th className="px-3 py-2 text-right">الدور</th>
                    <th className="px-3 py-2 text-center">الحالة</th>
                    <th className="px-3 py-2 text-center">آخر دخول</th>
                    <th className="px-3 py-2 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter((u) => {
                      if (!search.trim()) return true;
                      const s = search.toLowerCase();
                      return (
                        (u.email || "").toLowerCase().includes(s) ||
                        (u.full_name || "").toLowerCase().includes(s)
                      );
                    })
                    .map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <UserIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium">{u.full_name || "—"}</div>
                              <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {u.role === "tenant" ? (
                            <Badge className="bg-sky-500/20 text-sky-700">بوابة مستأجر</Badge>
                          ) : u.role === "visitor" ? (
                            <Badge className="bg-slate-500/20 text-slate-700">حساب زائر</Badge>
                          ) : (
                            <Select
                              value={u.role ?? "viewer"}
                              onValueChange={(v) =>
                                changeRoleMutation.mutate({ userId: u.id, newRole: v as StaffRole })
                              }
                              disabled={u.id === currentUser?.id}
                            >
                              <SelectTrigger className="h-8 w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(STAFF_ROLE_LABELS).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>
                                    {v}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {u.is_active === false ? (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 ml-1" />
                              معطل
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/20 text-emerald-600">
                              <CheckCircle2 className="h-3 w-3 ml-1" />
                              نشط
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {u.last_sign_in_at
                            ? format(new Date(u.last_sign_in_at), "yyyy/MM/dd HH:mm")
                            : "لم يدخل بعد"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() =>
                                toggleActiveMutation.mutate({
                                  userId: u.id,
                                  active: u.is_active === false,
                                })
                              }
                              disabled={u.id === currentUser?.id}
                              title={u.is_active === false ? "تفعيل" : "تعطيل"}
                            >
                              {u.is_active === false ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-amber-600" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteUser(u)}
                              disabled={u.id === currentUser?.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Invite dialog */}
      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSubmit={(d) => inviteMutation.mutate(d)}
        saving={inviteMutation.isPending}
        customers={customers}
      />

      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف/تعطيل المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم تعطيل حساب "{deleteUser?.full_name || deleteUser?.email}" وإزالة جميع أدواره. لا
              يمكن حذف حساب المستخدم نهائياً من المتصفح لأسباب أمنية، بل يتطلب ذلك من لوحة تحكم
              Supabase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "تعطيل"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// Fetch users: profiles + user_roles + auth metadata via join (or two queries)
async function fetchUsers(): Promise<UserRow[]> {
  // Since we cannot access auth.users directly from client (RLS), query profiles and join user_roles.
  // For last_sign_in_at we'll join via a function? Fallback to null. We can attempt via getUsers (admin only, will fail).
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      full_name,
      phone,
      is_active,
      account_type,
      created_at,
      last_login_at,
      user_roles(role),
      tenant_accounts(customer_id)
    `,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  // Emails aren't exposed in profiles; query auth users via RPC? Not available. We approximate via a separate edge function later.
  // For now, show phone/name; email is not accessible. As a workaround, we don't show email unless the user queried is self.
  type ProfileJoinRow = {
    id: string;
    full_name: string | null;
    phone: string | null;
    is_active: boolean | null;
    account_type: string | null;
    created_at: string | null;
    last_login_at: string | null;
    user_roles: { role: StaffRole }[] | null;
    tenant_accounts: { customer_id: string | null }[] | { customer_id: string | null } | null;
  };
  return (data ?? []).map((row) => {
    const p = row as unknown as ProfileJoinRow;
    const roles = (p.user_roles ?? []) as { role: StaffRole }[];
    const tenantAccount = Array.isArray(p.tenant_accounts)
      ? p.tenant_accounts[0]
      : p.tenant_accounts;
    const priority: Record<StaffRole, number> = {
      admin: 1,
      manager: 2,
      accountant: 3,
      data_entry: 4,
      viewer: 5,
    };
    const highest = tenantAccount?.customer_id
      ? "tenant"
      : (roles.sort((a, b) => (priority[a.role] || 99) - (priority[b.role] || 99))[0]?.role ??
        (p.account_type === "visitor" ? "visitor" : null));
    return {
      id: p.id,
      email: null, // not accessible client-side without service role
      full_name: p.full_name,
      phone: p.phone,
      is_active: p.is_active,
      role: highest,
      last_sign_in_at: null,
      last_login_at: p.last_login_at,
      created_at: p.created_at,
    };
  });
}

function InviteUserDialog({
  open,
  onClose,
  onSubmit,
  saving,
  customers,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (d: {
    email: string;
    full_name: string;
    phone: string;
    password: string;
    role: AppRole;
    customer_id?: string;
  }) => void;
  saving: boolean;
  customers: { id: string; full_name: string; phone: string | null }[];
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [customerId, setCustomerId] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !fullName || !password) {
      toast.error("أكمل الحقول المطلوبة");
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    if (role === "tenant" && !customerId) {
      toast.error("اختر المستأجر المرتبط بهذا الحساب");
      return;
    }
    onSubmit({
      email,
      full_name: fullName,
      phone,
      password,
      role,
      customer_id: customerId || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة مستخدم جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>الاسم الكامل *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>البريد الإلكتروني *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-1">
            <Label>الهاتف</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label>كلمة المرور *</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 أحرف على الأقل"
            />
          </div>
          <div className="space-y-1">
            <Label>الدور</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === "tenant" && (
            <div className="space-y-1">
              <Label>المستأجر المرتبط بالحساب *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر مستأجراً" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.full_name} {customer.phone ? `— ${customer.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
            ملاحظة: سيتلقى المستخدم رسالة تأكيد على بريده إذا كان تأكيد البريد مفعلاً.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <Plus className="h-4 w-4 ml-1" />
              )}
              إنشاء المستخدم
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
