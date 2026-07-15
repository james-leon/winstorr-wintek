import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Designed empty-state block. Reused across cart, wishlist, orders,
 * search-no-results, and admin lists. Keeps the same rhythm everywhere.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-sm border border-dashed border-border bg-muted/30 text-center",
        compact ? "p-6" : "p-10",
        className,
      )}
    >
      {Icon && (
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-background text-muted-foreground">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
