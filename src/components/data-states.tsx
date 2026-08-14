import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading skeleton for data tables — keeps layout stable while fetching.
 */
export function TableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 p-4", className)} role="status" aria-label="جارِ التحميل">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
      <span className="sr-only">جارِ تحميل البيانات…</span>
    </div>
  );
}

/**
 * Unified empty state used across list pages.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}
    >
      {icon && <div className="mb-4 text-muted-foreground/50">{icon}</div>}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
