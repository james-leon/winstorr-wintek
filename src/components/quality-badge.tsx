import { ShieldCheck, Store } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Winstorr's signature trust badge. Consistent green shield + label,
 * reused identically on product cards, buy box, and the "Pourquoi Winstorr" section.
 */
export function QualityBadge({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-success/30 bg-success/10 font-semibold text-success",
        sm ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        className,
      )}
      aria-label="Qualité vérifiée par Wintek"
    >
      <ShieldCheck className={cn(sm ? "h-3 w-3" : "h-3.5 w-3.5", "shrink-0")} strokeWidth={2.5} />
      Qualité vérifiée
    </span>
  );
}

export function VendorLine({
  name,
  internal,
  className,
}: {
  name: string;
  internal?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Store className="h-3.5 w-3.5" />
      <span>
        Vendu par <span className="font-medium text-foreground">{name}</span>
        {internal && <span className="ml-1 text-secondary">· Officiel</span>}
      </span>
    </div>
  );
}
