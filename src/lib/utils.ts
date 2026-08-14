import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely extracts a human-readable message from an unknown error value
 * (Error instances, Supabase PostgrestError-like objects, or strings).
 */
export function getErrorMessage(error: unknown, fallback = "حدث خطأ غير متوقع"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message || fallback;
  }
  return fallback;
}

/** Minimum password length enforced across all account flows. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Validates password strength. Returns an Arabic error message or null when valid.
 * Policy: at least 8 characters including one letter and one digit.
 */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`;
  }
  if (!/[A-Za-z\u0600-\u06FF]/.test(password) || !/\d/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على حرف ورقم على الأقل";
  }
  return null;
}

/**
 * Sanitizes user-provided search text before embedding it in a PostgREST
 * `.or()`/`.ilike()` filter string. Commas, parentheses and dots are filter
 * syntax in PostgREST and would otherwise let users break or alter the query.
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,().\\%_]/g, " ").trim();
}
