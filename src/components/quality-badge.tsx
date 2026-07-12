import { ShieldCheck, Store } from "lucide-react";
import { cn } from "@/lib/utils";

export function QualityBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success",
        className,
      )}
    >
      <ShieldCheck className="h-3.5 w-3.5" /> Qualité vérifiée
    </span>
  );
}

export function VendorLine({ name, internal, className }: { name: string; internal?: boolean; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Store className="h-3.5 w-3.5" />
      <span>
        Vendu par <span className="font-medium text-foreground">{name}</span>
        {internal && <span className="ml-1 text-primary">• Officiel</span>}
      </span>
    </div>
  );
}
