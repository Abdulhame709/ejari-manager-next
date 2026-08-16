import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EjariLogo } from "@/components/ejari-logo";
import { useAuth } from "@/lib/auth-context";
import { canonicalUrl } from "@/lib/seo";
import { validatePassword } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — إيجاري EJARI" },
      { name: "description", content: "سجّل دخولك إلى منصة إيجاري لإدارة العقارات والإيجارات." },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/login") }],
  }),
  component: LoginPage,
});

type LoginMode = "staff" | "tenant" | "visitor";
type LoginTab = "login" | "signup";
type Language = "ar" | "en";

const content = {
  ar: {
    subtitle: "مساحتك الرقمية لإدارة الإيجار بثقة ووضوح.",
    login: "تسجيل الدخول",
    signup: "إنشاء حساب جديد",
    loginTab: "دخول",
    signupTab: "تسجيل",
    tenant: "بوابة المستأجر",
    staff: "الإدارة والموظفون",
    visitor: "حساب زائر",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    idNumber: "رقم الهوية (اختياري)",
    address: "العنوان (اختياري)",
    requestSubmitted: "تم إرسال طلبك للمراجعة. ستتمكن من الدخول بعد موافقة الإدارة.",
    forgot: "نسيت كلمة المرور؟",
    enter: "دخول آمن",
    createAccount: "إنشاء الحساب",
    tenantNote: "سجّل أو ادخل بحساب المستأجر للوصول إلى الفواتير وكشف الحساب.",
    staffNote:
      "ادخل بحساب الإدارة أو الموظف؛ ينشئ مدير النظام حسابات الموظفين من لوحة إدارة المستخدمين.",
    visitorNote: "أنشئ حساب زائر لتصفح الوحدات وإرسال طلبات المعاينة دون وصول داخلي.",
    roleNote: "بعد الدخول سيتم توجيهك تلقائيًا حسب نوع الحساب والصلاحية المسجلة.",
    staffSignupNote:
      "التسجيل العام للموظفين مغلق. ينشئ مدير النظام حسابات الموظفين ويمَنح كل حساب الدور المناسب.",
    tenantSignupNote: "سيتم إنشاء سجل مستأجر جديد، أو ربط الحساب بسجلك الموجود عند تطابق البريد.",
    visitorSignupNote: "حساب الزائر لا يملك صلاحية الاطلاع على بيانات الإدارة أو المستأجرين.",
    confirmEmail: "تم إنشاء الحساب. تحقق من بريدك لتأكيده، ثم سجّل الدخول.",
    browse: "تصفح الوحدات كزائر دون حساب",
    trusted: "منصة إيجارية مصممة لاحتياجات السوق اليمني",
    secure: "بياناتك محمية ومشفرة",
    rights: "© 2026 إيجاري EJARI. جميع الحقوق محفوظة.",
    resetRequest: "إرسال رابط الاستعادة",
    backToLogin: "العودة لتسجيل الدخول",
    resetNote: "أدخل بريدك وسنرسل لك رابط إعادة تعيين كلمة المرور.",
    resetSent: "تم إرسال رابط الاستعادة إلى بريدك، تحقق من الوارد والبريد المزعج.",
    noAccessTitle: "الحساب غير مخوّل للدخول",
    signOut: "العودة وتسجيل الدخول بحساب آخر",
  },
  en: {
    subtitle: "Your digital space to manage rent with clarity and confidence.",
    login: "Sign in",
    signup: "Create a new account",
    loginTab: "Sign in",
    signupTab: "Register",
    tenant: "Tenant portal",
    staff: "Management & staff",
    visitor: "Visitor account",
    email: "Email address",
    password: "Password",
    fullName: "Full name",
    phone: "Phone number",
    idNumber: "ID number (optional)",
    address: "Address (optional)",
    requestSubmitted: "Your request was sent for review. You can sign in after approval.",
    forgot: "Forgot password?",
    enter: "Secure sign in",
    createAccount: "Create account",
    tenantNote: "Register or sign in as a tenant to access invoices and your statement.",
    staffNote:
      "Sign in as management or staff. An administrator creates staff accounts and assigns their roles.",
    visitorNote:
      "Create a visitor account to browse units and request viewings without internal access.",
    roleNote:
      "After sign-in, your saved account type and role determine the destination automatically.",
    staffSignupNote:
      "Public staff registration is disabled. An administrator creates staff accounts and assigns the appropriate role.",
    tenantSignupNote:
      "A tenant record is created, or an existing record is linked when the email matches.",
    visitorSignupNote: "Visitor accounts cannot access management or tenant data.",
    confirmEmail: "Account created. Confirm it from your email, then sign in.",
    browse: "Browse available units without an account",
    trusted: "A rental platform made for the Yemeni market",
    secure: "Your data is encrypted and protected",
    rights: "© 2026 EJARI. All rights reserved.",
    resetRequest: "Send reset link",
    backToLogin: "Back to sign in",
    resetNote: "Enter your email and we'll send you a password reset link.",
    resetSent: "A reset link has been sent to your inbox. Please check spam as well.",
    noAccessTitle: "This account is not authorised",
    signOut: "Go back and sign in with another account",
  },
} satisfies Record<Language, Record<string, string>>;

function LoginPage() {
  const { user, role, loading, accessError, signOut } = useAuth();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>("ar");
  const [mode, setMode] = useState<LoginMode>("staff");
  const [tab, setTab] = useState<LoginTab>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [address, setAddress] = useState("");

  const isArabic = language === "ar";
  const t = content[language];
  const direction = isArabic ? "rtl" : "ltr";

  useEffect(() => {
    if (loading || !user || !role) return;
    if (role === "tenant") {
      void navigate({ to: "/tenant", replace: true });
    } else if (role === "visitor") {
      void navigate({ to: "/units", replace: true });
    } else {
      void navigate({ to: "/", replace: true });
    }
  }, [loading, navigate, role, user]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      toast.error(isArabic ? "يرجى إدخال البريد وكلمة المرور" : "Email and password are required");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await withAuthTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
      );
      if (error) throw error;
      toast.success(isArabic ? "تم التحقق من بيانات الدخول" : "Credentials verified");
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(isArabic ? arabicAuthError(message) : englishAuthError(message));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "staff") {
      toast.error(
        isArabic
          ? "التسجيل العام للموظفين مغلق. اطلب من مدير النظام إنشاء الحساب."
          : "Public staff registration is disabled. Ask an administrator to create the account.",
      );
      setTab("login");
      return;
    }
    if (submitting) return;
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      toast.error(
        isArabic ? "يرجى إكمال جميع الحقول المطلوبة" : "Please complete all required fields",
      );
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(
        isArabic
          ? passwordError
          : "Password must be at least 8 characters and contain a letter and a number",
      );
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await withAuthTimeout(
        supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              account_type: mode,
            },
          },
        }),
      );
      if (error) throw error;

      if (mode === "tenant") {
        const { error: requestError } = await supabase.rpc("submit_tenant_account_request", {
          p_email: email.trim(),
          p_full_name: fullName.trim(),
          p_phone: phone.trim(),
          p_id_number: idNumber.trim() || null,
          p_address: address.trim() || null,
          p_notes: null,
        });
        if (requestError) throw requestError;
        toast.success(t.requestSubmitted);
        setTab("login");
        setPassword("");
        return;
      }

      if (data.session) {
        toast.success(isArabic ? "تم إنشاء الحساب وتسجيل الدخول" : "Account created and signed in");
        return;
      }

      toast.success(t.confirmEmail);
      setTab("login");
      setPassword("");
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(isArabic ? arabicAuthError(message) : englishAuthError(message));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      toast.error(isArabic ? "أدخل البريد أولاً" : "Please enter your email");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await withAuthTimeout(supabase.auth.resetPasswordForEmail(email.trim()));
      if (error) throw error;
      setResetSent(true);
      toast.success(t.resetSent);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(isArabic ? arabicAuthError(message) : englishAuthError(message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f8fc] text-slate-900" dir={direction}>
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
        <BrandPanel trusted={t.trusted} />

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between lg:justify-end">
              <EjariLogo className="lg:hidden" />
              <button
                type="button"
                onClick={() => setLanguage(isArabic ? "en" : "ar")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
              >
                <Globe2 className="h-4 w-4" /> {isArabic ? "English" : "العربية"}
              </button>
            </div>

            {user && !loading && !role ? (
              <div className="rounded-2xl border border-rose-200 bg-white p-7 text-center shadow-[0_12px_38px_rgba(15,43,83,.08)]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
                  <ShieldAlert className="h-7 w-7 text-rose-600" />
                </div>
                <h1 className="mt-5 text-xl font-extrabold text-slate-900">{t.noAccessTitle}</h1>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {accessError ??
                    (isArabic
                      ? "لا توجد صلاحية مفعّلة لهذا الحساب. تواصل مع مدير النظام."
                      : "No active role is assigned to this account. Contact your administrator.")}
                </p>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  <LogOut className="h-4 w-4" /> {t.signOut}
                </button>
              </div>
            ) : loading && user ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-[0_12px_38px_rgba(15,43,83,.08)]">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                <p className="mt-4 text-sm font-semibold text-slate-600">
                  {isArabic ? "جارٍ التحقق من الصلاحيات..." : "Checking permissions..."}
                </p>
              </div>
            ) : forgotMode ? (
              <ResetForm
                email={email}
                setEmail={setEmail}
                submitting={submitting}
                resetSent={resetSent}
                onSubmit={handleReset}
                onBack={() => {
                  setForgotMode(false);
                  setResetSent(false);
                }}
                language={language}
              />
            ) : (
              <>
                <div className="mb-7">
                  <p className="text-sm font-bold text-blue-600">
                    {mode === "tenant" ? t.tenant : mode === "visitor" ? t.visitor : t.staff}
                  </p>
                  <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
                    {tab === "login" ? t.login : t.signup}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {mode === "tenant"
                      ? t.tenantNote
                      : mode === "visitor"
                        ? t.visitorNote
                        : t.staffNote}
                  </p>
                </div>

                <div className="mb-4 grid grid-cols-3 rounded-xl bg-slate-100 p-1" role="tablist">
                  {(["staff", "tenant", "visitor"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      role="tab"
                      aria-selected={mode === item}
                      onClick={() => {
                        setMode(item);
                        if (item === "staff") setTab("login");
                      }}
                      className={`rounded-lg px-2 py-2.5 text-xs font-bold transition ${mode === item ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      {item === "tenant" ? t.tenant : item === "visitor" ? t.visitor : t.staff}
                    </button>
                  ))}
                </div>

                {mode === "staff" ? (
                  <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    {t.staffSignupNote}
                  </div>
                ) : (
                  <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setTab("login")}
                      className={`rounded-md py-2 transition ${tab === "login" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                    >
                      {t.loginTab}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("signup")}
                      className={`rounded-md py-2 transition ${tab === "signup" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                    >
                      {t.signupTab}
                    </button>
                  </div>
                )}

                <form
                  onSubmit={tab === "signup" ? handleSignup : handleSubmit}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_38px_rgba(15,43,83,.08)] sm:p-7"
                >
                  <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                    {tab === "signup"
                      ? mode === "tenant"
                        ? t.tenantSignupNote
                        : mode === "visitor"
                          ? t.visitorSignupNote
                          : t.staffSignupNote
                      : t.roleNote}
                  </p>

                  {tab === "signup" && (
                    <>
                      {mode === "tenant" && (
                        <>
                          <label className="block">
                            <span className="mb-2 block text-sm font-bold text-slate-700">
                              {t.idNumber}
                            </span>
                            <input
                              value={idNumber}
                              onChange={(event) => setIdNumber(event.target.value)}
                              dir="ltr"
                              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm font-bold text-slate-700">
                              {t.address}
                            </span>
                            <input
                              value={address}
                              onChange={(event) => setAddress(event.target.value)}
                              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            />
                          </label>
                        </>
                      )}
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">
                          {t.fullName}
                        </span>
                        <div className="relative">
                          <UserRound className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            autoComplete="name"
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-10 pl-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            required
                          />
                        </div>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">
                          {t.phone}
                        </span>
                        <div className="relative">
                          <Phone className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            autoComplete="tel"
                            dir="ltr"
                            placeholder="+967 ..."
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-10 pl-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            required
                          />
                        </div>
                      </label>
                    </>
                  )}

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">{t.email}</span>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        dir="ltr"
                        autoComplete="username"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-10 pl-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        placeholder="example@email.com"
                        required
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      {t.password}
                    </span>
                    <div className="relative">
                      <LockKeyhole className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete={tab === "signup" ? "new-password" : "current-password"}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-10 pl-10 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        placeholder="••••••••"
                        minLength={8}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute left-3 top-3 text-slate-400 hover:text-slate-600"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </label>
                  {tab === "login" && (
                    <button
                      type="button"
                      onClick={() => setForgotMode(true)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      {t.forgot}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : tab === "signup" ? (
                      t.createAccount
                    ) : (
                      t.enter
                    )}
                  </button>
                </form>
              </>
            )}

            <Link
              to="/units"
              className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-blue-600 transition hover:text-blue-800"
            >
              {t.browse}
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {t.secure}
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-400">{t.rights}</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandPanel({ trusted }: { trusted: string }) {
  return (
    <section
      className="relative hidden overflow-hidden bg-[#0a1e3d] px-12 py-10 text-white lg:flex lg:flex-col"
      dir="rtl"
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 25%, #38bdf8 0, transparent 30%), radial-gradient(circle at 80% 85%, #2563eb 0, transparent 34%)",
        }}
      />
      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20">
          <Building2 className="h-5 w-5 text-cyan-200" />
        </div>
        <div>
          <p className="text-xl font-extrabold">إيجاري</p>
          <p className="text-[10px] font-bold tracking-[.22em] text-cyan-200">EJARI</p>
        </div>
      </div>
      <div className="relative my-auto max-w-lg pb-8">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-100">
          <ShieldCheck className="h-3.5 w-3.5" /> موثوق وآمن وسهل الاستخدام
        </span>
        <h2 className="text-5xl font-extrabold leading-[1.35] tracking-tight">
          كل ما تحتاجه
          <br />
          <span className="text-cyan-300">لإدارة إيجارك.</span>
        </h2>
        <p className="mt-6 max-w-md text-base leading-8 text-blue-100/80">
          من العقود والفواتير إلى التحصيلات وقراءات العدادات، يجمع إيجاري أعمالك اليومية في مكان
          واحد واضح وآمن.
        </p>
      </div>
      <div className="relative flex items-center gap-2 border-t border-white/10 pt-6 text-xs text-blue-100/70">
        <CheckCircle2 className="h-4 w-4 text-emerald-300" /> {trusted}
      </div>
    </section>
  );
}

interface ResetFormProps {
  email: string;
  setEmail: (email: string) => void;
  submitting: boolean;
  resetSent: boolean;
  onSubmit: (event: React.FormEvent) => Promise<void>;
  onBack: () => void;
  language: Language;
}

function ResetForm({
  email,
  setEmail,
  submitting,
  resetSent,
  onSubmit,
  onBack,
  language,
}: ResetFormProps) {
  const t = content[language];
  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-slate-900">{t.forgot}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{t.resetNote}</p>
      </div>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_38px_rgba(15,43,83,.08)] sm:p-7"
      >
        {resetSent && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            ✅ {t.resetSent}
          </div>
        )}
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">{t.email}</span>
          <div className="relative">
            <Mail className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              dir="ltr"
              autoComplete="username"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-10 pl-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="example@email.com"
              required
            />
          </div>
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t.resetRequest}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" /> {t.backToLogin}
        </button>
      </form>
    </>
  );
}

function withAuthTimeout<T>(promise: PromiseLike<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("انتهت مهلة الاتصال. تحقق من الإنترنت وحاول مرة أخرى.")),
      15_000,
    );
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected authentication error occurred";
}

function englishAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) {
    return "This account is not registered or the credentials are incorrect. Register first, then sign in.";
  }
  if (normalized.includes("already registered") || normalized.includes("user already registered")) {
    return "This account is already registered. Sign in or reset its password.";
  }
  return message;
}

function arabicAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) {
    return "الحساب غير مسجل أو بيانات الدخول غير صحيحة. أنشئ حسابًا أولًا ثم سجّل الدخول.";
  }
  if (normalized.includes("already registered") || normalized.includes("user already registered")) {
    return "هذا الحساب مسجل مسبقًا. انتقل إلى تسجيل الدخول أو استخدم استعادة كلمة المرور.";
  }
  if (normalized.includes("email not confirmed")) return "يرجى تأكيد بريدك الإلكتروني أولاً";
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "عدد محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة";
  }
  return "تعذر تسجيل الدخول: " + message;
}
