import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isStaffRole } from "@/lib/access-control";

export type AppRole =
  | "admin"
  | "manager"
  | "accountant"
  | "data_entry"
  | "viewer"
  | "tenant"
  | "visitor";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير النظام",
  manager: "مدير عقارات",
  accountant: "محاسب",
  data_entry: "إدخال بيانات",
  viewer: "مشاهد",
  tenant: "مستأجر",
  visitor: "زائر",
};

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  userRole: AppRole | null;
  fullName: string | null;
  customerId: string | null;
  isStaff: boolean;
  accessError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  userRole: null,
  fullName: null,
  customerId: null,
  isStaff: false,
  accessError: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

type StaffRole = "admin" | "manager" | "accountant" | "data_entry" | "viewer";

type AccountType = "staff" | "tenant" | "visitor" | null;

const ROLE_PRIORITY: Record<StaffRole, number> = {
  admin: 1,
  manager: 2,
  accountant: 3,
  data_entry: 4,
  viewer: 5,
};

const PROFILE_TIMEOUT_MS = 10_000;

class ProfileTimeoutError extends Error {}
class InactiveAccountError extends Error {}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new ProfileTimeoutError("Timed out while loading account permissions")),
      timeoutMs,
    );

    promise.then(
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

function selectHighestStaffRole(roles: Array<{ role: string }>): StaffRole | null {
  let highest: StaffRole | null = null;

  for (const row of roles) {
    if (!(row.role in ROLE_PRIORITY)) continue;
    const candidate = row.role as StaffRole;
    if (!highest || ROLE_PRIORITY[candidate] < ROLE_PRIORITY[highest]) highest = candidate;
  }

  return highest;
}

function getAccountType(user: User): AccountType {
  const value = user.user_metadata?.account_type;
  return value === "staff" || value === "tenant" || value === "visitor" ? value : null;
}

/**
 * Authentication is intentionally split into two phases:
 * 1. Supabase auth callbacks update the session synchronously and return.
 * 2. Profile/role queries run on a later task, after Supabase releases its auth lock.
 *
 * Starting PostgREST work directly inside onAuthStateChange can deadlock sign-in
 * until a manual page refresh, especially when session persistence is enabled.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const mountedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const profileRequestRef = useRef(0);

  const clearAccess = useCallback(() => {
    setRole(null);
    setFullName(null);
    setCustomerId(null);
    setAccessError(null);
  }, []);

  const loadProfile = useCallback(
    async (userId: string, requestId: number, accountType: AccountType) => {
      try {
        const [profileResult, rolesResult, tenantResult] = await withTimeout(
          Promise.all([
            supabase
              .from("profiles")
              .select("full_name, is_active, account_type")
              .eq("id", userId)
              .maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", userId),
            supabase
              .from("tenant_accounts")
              .select("customer_id")
              .eq("user_id", userId)
              .eq("is_active", true)
              .maybeSingle(),
          ]),
          PROFILE_TIMEOUT_MS,
        );

        if (profileResult.error) throw profileResult.error;
        if (rolesResult.error) throw rolesResult.error;
        if (tenantResult.error) throw tenantResult.error;
        if (!profileResult.data) throw new Error("لم يتم العثور على ملف المستخدم");
        if (profileResult.data.is_active === false) throw new InactiveAccountError();
        if (!mountedRef.current || requestId !== profileRequestRef.current) return;

        const staffRole = selectHighestStaffRole(rolesResult.data ?? []);
        const tenantCustomerId = tenantResult.data?.customer_id ?? null;
        const storedAccountType = profileResult.data.account_type;
        const resolvedAccountType: AccountType =
          storedAccountType === "staff" ||
          storedAccountType === "tenant" ||
          storedAccountType === "visitor"
            ? storedAccountType
            : accountType;
        // Explicit staff roles take priority. Tenant access requires an active
        // customer link. Visitors are virtual accounts that can use public pages
        // but never receive a staff database role.
        const resolvedRole: AppRole | null =
          staffRole ??
          (tenantCustomerId ? "tenant" : null) ??
          (resolvedAccountType === "visitor" ? "visitor" : null);

        setFullName(profileResult.data.full_name ?? null);
        setCustomerId(tenantCustomerId);
        setRole(resolvedRole);
        setAccessError(
          resolvedRole
            ? null
            : resolvedAccountType === "tenant"
              ? "تم إنشاء الحساب، لكن تعذر ربطه بسجل مستأجر. تواصل مع الإدارة لإكمال الربط."
              : "لا توجد صلاحية مفعّلة لهذا الحساب. اطلب من مدير النظام تعيين الدور المناسب.",
        );
      } catch (error: unknown) {
        if (!mountedRef.current || requestId !== profileRequestRef.current) return;

        console.error("Failed to load account permissions", error);
        setRole(null);
        setCustomerId(null);
        setFullName(null);

        if (error instanceof InactiveAccountError) {
          setAccessError("هذا الحساب موقوف. تواصل مع مدير النظام لإعادة تفعيله.");
        } else if (error instanceof ProfileTimeoutError) {
          setAccessError(
            "استغرق تحميل الصلاحيات وقتًا أطول من المتوقع. تحقق من الاتصال ثم أعد المحاولة.",
          );
        } else {
          setAccessError(
            "تعذر التحقق من صلاحيات الحساب. لم يتم منح أي وصول حفاظًا على أمان البيانات.",
          );
        }
      } finally {
        if (mountedRef.current && requestId === profileRequestRef.current) setLoading(false);
      }
    },
    [],
  );

  const scheduleProfileLoad = useCallback(
    (userId: string, requestId: number, accountType: AccountType) => {
      setTimeout(() => {
        if (!mountedRef.current || requestId !== profileRequestRef.current) return;
        void loadProfile(userId, requestId, accountType);
      }, 0);
    },
    [loadProfile],
  );

  const applySession = useCallback(
    (nextSession: Session | null, forceProfileReload = false) => {
      if (!mountedRef.current) return;

      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      setSession(nextSession);
      setUser(nextUser);

      // Token refreshes for the same user must not blank the page or start a
      // second role request. A manual refreshProfile call can force a reload.
      if (!forceProfileReload && nextUserId && nextUserId === currentUserIdRef.current) return;

      currentUserIdRef.current = nextUserId;
      const requestId = ++profileRequestRef.current;
      clearAccess();

      if (!nextUserId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      scheduleProfileLoad(nextUserId, requestId, nextUser ? getAccountType(nextUser) : null);
    },
    [clearAccess, scheduleProfileLoad],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    applySession(session, true);
  }, [applySession, session, user]);

  useEffect(() => {
    mountedRef.current = true;

    // The callback remains synchronous. Never return/await a profile query here.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    void withTimeout(supabase.auth.getSession(), PROFILE_TIMEOUT_MS)
      .then(({ data }) => applySession(data.session))
      .catch((error: unknown) => {
        console.error("Failed to restore session", error);
        applySession(null);
      });

    return () => {
      mountedRef.current = false;
      profileRequestRef.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [applySession]);

  const signOut = useCallback(async () => {
    applySession(null);
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Failed to sign out from Supabase", error);
  }, [applySession]);

  const userRole = role;
  const isStaff = isStaffRole(role);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        userRole,
        fullName,
        customerId,
        isStaff,
        accessError,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
