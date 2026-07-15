import { ShieldCheck, Lock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact trust reinforcement one-liner used at every hesitation point:
 * buy box (below CTA), cart summary, checkout summary.
 * Not decorative — appears at the exact moment users need reassurance.
 */
export function TrustStrip({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <ul
      className={cn(
        "flex flex-col gap-1 text-xs text-muted-foreground",
        compact && "gap-0.5",
        className,
      )}
      aria-label="Garanties Winstorr"
    >
      <li className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.25} />
        <span>Qualité vérifiée par Wintek</span>
      </li>
      <li className="flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.25} />
        <span>Paiement sécurisé — MoMo, Orange Money, Carte</span>
      </li>
      <li className="flex items-center gap-1.5">
        <RotateCcw className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.25} />
        <span>Retour sous 7 jours</span>
      </li>
    </ul>
  );
}
