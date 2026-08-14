import { ShieldAlert, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface AccessDeniedProps {
  message?: string | null;
}

export function AccessDenied({ message }: AccessDeniedProps) {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-elegant">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-foreground">تعذر فتح الحساب</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          {message ??
            "لا توجد صلاحية مفعّلة لهذا الحساب. تواصل مع مدير النظام لتحديد الدور المناسب."}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <LogOut className="h-4 w-4" />
          العودة إلى تسجيل الدخول
        </button>
      </div>
    </div>
  );
}
