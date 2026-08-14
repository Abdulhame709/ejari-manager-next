import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RouteGuard } from "@/components/route-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, User, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import TenantLayout from "./-tenant-layout";
import { validatePassword } from "@/lib/utils";

export const Route = createFileRoute("/tenant/profile")({
  head: () => ({
    meta: [{ title: "ملفي الشخصي — إيجاري" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <RouteGuard allowedRoles={["tenant"]} redirectTo="/login">
      <TenantProfile />
    </RouteGuard>
  ),
});

function TenantProfile() {
  const { user, refreshProfile } = useAuth();
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["tenant-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (data) {
        setPhone(data.phone ?? "");
        setFullName(data.full_name ?? "");
      }
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updates = { full_name: fullName, phone };
      const { error } = await supabase.from("profiles").update(updates).eq("id", user!.id);
      if (error) throw error;
      if (password) {
        const passwordError = validatePassword(password);
        if (passwordError) throw new Error(passwordError);
        const { error: pe } = await supabase.auth.updateUser({ password });
        if (pe) throw pe;
      }
    },
    onSuccess: () => {
      toast.success("✅ تم حفظ التعديلات");
      setPassword("");
      refreshProfile();
    },
    onError: (e: Error) => toast.error("❌ " + (e.message || "فشل الحفظ")),
  });

  return (
    <TenantLayout>
      <div className="space-y-4">
        <Link to="/tenant" className="text-xs text-primary inline-flex items-center">
          <ChevronLeft className="h-3 w-3 ml-1" />
          العودة للرئيسية
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          ملفي الشخصي
        </h1>
        <Card className="p-5 max-w-xl space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label>الاسم الكامل</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>البريد الإلكتروني</Label>
                <Input value={user?.email ?? ""} disabled />
              </div>
              <div className="space-y-1">
                <Label>رقم الهاتف</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>تغيير كلمة المرور (اختياري)</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="اتركها فارغة للإبقاء"
                />
              </div>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-1" />
                ) : (
                  <Save className="h-4 w-4 ml-1" />
                )}
                حفظ التغييرات
              </Button>
            </>
          )}
        </Card>
      </div>
    </TenantLayout>
  );
}
