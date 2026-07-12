import type { ProductType } from "@/lib/format";
import { PRODUCT_TYPE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Neutral chip — orange is reserved for price/CTA. Type badges are informational,
 * so they stay tonal (navy/blue/gray) rather than fighting the purchase signal.
 */
const STYLES: Record<ProductType, string> = {
  physical: "bg-primary/8 text-primary border-primary/20",
  digital: "bg-secondary/10 text-secondary border-secondary/20",
  service: "bg-muted text-foreground/80 border-border",
  training: "bg-primary/8 text-primary border-primary/20",
};

export function TypeBadge({ type, className }: { type: ProductType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STYLES[type],
        className,
      )}
    >
      {PRODUCT_TYPE_LABELS[type]}
    </span>
  );
}
