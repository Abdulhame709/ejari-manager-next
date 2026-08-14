import type { AppRole } from "@/lib/auth-context";

export type StaffRole = "admin" | "manager" | "accountant" | "data_entry" | "viewer";

export const STAFF_ROLES: readonly StaffRole[] = [
  "admin",
  "manager",
  "accountant",
  "data_entry",
  "viewer",
];

export const PAGE_ROLES = {
  dashboard: ["admin", "manager", "accountant", "data_entry", "viewer"],
  properties: ["admin", "manager"],
  shops: ["admin", "manager", "data_entry"],
  customers: ["admin", "manager", "data_entry"],
  contracts: ["admin", "manager", "data_entry"],
  readings: ["admin", "manager", "accountant", "data_entry"],
  invoices: ["admin", "manager", "accountant"],
  receipts: ["admin", "manager", "accountant"],
  reports: ["admin", "manager", "accountant", "viewer"],
  paymentRequests: ["admin", "manager", "accountant"],
  users: ["admin"],
  settings: ["admin", "manager"],
} as const satisfies Record<string, readonly StaffRole[]>;

export function isStaffRole(role: AppRole | null): role is StaffRole {
  return role !== null && (STAFF_ROLES as readonly AppRole[]).includes(role);
}

export function hasAnyRole(role: AppRole | null, allowedRoles: readonly AppRole[]): boolean {
  return role !== null && allowedRoles.includes(role);
}

/**
 * Front-end navigation policy. Database RLS remains the final authority.
 * Public pages are intentionally limited to the login and unit catalogue.
 */
export function canAccessPath(role: AppRole | null, pathname: string): boolean {
  const normalized = normalizePath(pathname);

  if (normalized === "/login" || normalized === "/units") return true;
  if (!role) return false;

  if (normalized === "/tenant/login") return true;
  if (normalized === "/tenant" || normalized.startsWith("/tenant/")) {
    return role === "tenant";
  }

  if (!isStaffRole(role)) return false;
  if (normalized === "/") return hasAnyRole(role, PAGE_ROLES.dashboard);
  if (normalized.startsWith("/admin/payment-requests")) {
    return hasAnyRole(role, PAGE_ROLES.paymentRequests);
  }
  if (normalized.startsWith("/properties")) return hasAnyRole(role, PAGE_ROLES.properties);
  if (normalized.startsWith("/shops")) return hasAnyRole(role, PAGE_ROLES.shops);
  if (normalized.startsWith("/customers")) return hasAnyRole(role, PAGE_ROLES.customers);
  if (normalized.startsWith("/contracts")) return hasAnyRole(role, PAGE_ROLES.contracts);
  if (normalized.startsWith("/readings")) return hasAnyRole(role, PAGE_ROLES.readings);
  if (normalized.startsWith("/invoices")) return hasAnyRole(role, PAGE_ROLES.invoices);
  if (normalized.startsWith("/receipts")) return hasAnyRole(role, PAGE_ROLES.receipts);
  if (normalized.startsWith("/reports")) return hasAnyRole(role, PAGE_ROLES.reports);
  if (normalized.startsWith("/users")) return hasAnyRole(role, PAGE_ROLES.users);
  if (normalized.startsWith("/settings")) return hasAnyRole(role, PAGE_ROLES.settings);

  return false;
}

export function defaultPathForRole(role: AppRole): "/" | "/tenant" | "/units" {
  if (role === "tenant") return "/tenant";
  if (role === "visitor") return "/units";
  return "/";
}

export function safeRedirectForRole(role: AppRole, requestedPath?: string): string {
  if (requestedPath && requestedPath.startsWith("/") && canAccessPath(role, requestedPath)) {
    return requestedPath;
  }
  return defaultPathForRole(role);
}

export function canDeleteOperationalRecords(role: AppRole | null): boolean {
  return role === "admin" || role === "manager";
}

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || "/";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}
