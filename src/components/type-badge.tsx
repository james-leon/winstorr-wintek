import type { ProductType } from "@/lib/format";
import { PRODUCT_TYPE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

const STYLES: Record<ProductType, string> = {
  physical: "bg-secondary text-secondary-foreground",
  digital: "bg-accent text-accent-foreground",
  service: "bg-success text-success-foreground",
  training: "bg-primary text-primary-foreground",
};

export function TypeBadge({ type, className }: { type: ProductType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        STYLES[type],
        className,
      )}
    >
      {PRODUCT_TYPE_LABELS[type]}
    </span>
  );
}
