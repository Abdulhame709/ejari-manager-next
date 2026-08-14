import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function EjariLogo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25">
        <Building2 className="h-5 w-5 text-white" strokeWidth={2.4} />
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-tl-full bg-amber-300/90" />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-lg font-extrabold tracking-tight text-foreground">إيجاري</div>
          <div className="mt-1 text-[10px] font-bold tracking-[0.18em] text-primary" dir="ltr">
            EJARI
          </div>
        </div>
      )}
    </div>
  );
}
