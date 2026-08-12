import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ---------------- primitives ---------------- */

export function SkeletonText({
  lines = 3,
  className,
  lastWidth = "60%",
}: {
  lines?: number;
  className?: string;
  lastWidth?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3 w-full"
          style={i === lines - 1 ? { width: lastWidth } : undefined}
        />
      ))}
    </div>
  );
}

export function SkeletonImage({ className }: { className?: string }) {
  return <Skeleton className={cn("aspect-square w-full rounded-sm", className)} />;
}

/* ---------------- product card / grids ---------------- */

export function SkeletonProductCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-sm border border-border bg-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-2.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="mt-1 h-4 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonProductGrid({
  count = 10,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonProductCard key={i} />
      ))}
    </div>
  );
}

/** Horizontal shelf of product cards, matching the homepage shelves. */
export function SkeletonProductShelf({ count = 6 }: { count?: number }) {
  return (
    <div className="mx-auto max-w-7xl px-3 py-4">
      <Skeleton className="mb-3 h-5 w-48" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonProductCard key={i} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- tables ---------------- */

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-2">
          <Skeleton className="h-3.5 w-full max-w-[140px]" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTableRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </>
  );
}

/** Non-table list rows (account orders, addresses, etc.). */
export function SkeletonListRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border rounded-sm border border-border bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ---------------- dashboards ---------------- */

export function SkeletonStatCards({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-sm border border-border bg-card p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

/* ---------------- page-level ---------------- */

/** Matches the product detail page: gallery + buy box. */
export function SkeletonProductDetail() {
  return (
    <div className="mx-auto max-w-7xl px-3 py-4">
      <Skeleton className="mb-3 h-3 w-64" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr_300px]">
        <div className="space-y-2">
          <SkeletonImage />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-14 rounded-sm" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-32" />
          <SkeletonText lines={5} />
        </div>
        <div className="space-y-3 rounded-sm border border-border bg-card p-4">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <SkeletonText lines={3} />
        </div>
      </div>
    </div>
  );
}

/** Matches the homepage: hero, category tiles, shelves. */
export function SkeletonHomepage() {
  return (
    <div>
      <div className="mx-auto max-w-7xl px-3 py-4">
        <Skeleton className="h-40 w-full rounded-sm sm:h-64" />
      </div>
      <div className="mx-auto max-w-7xl px-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-sm border border-border bg-card p-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="aspect-[4/3] w-full rounded-sm" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
      <SkeletonProductShelf />
      <SkeletonProductShelf />
    </div>
  );
}

/** Matches the cart page: item rows + summary panel. */
export function SkeletonCart() {
  return (
    <div className="mx-auto max-w-6xl px-3 py-4">
      <Skeleton className="mb-3 h-6 w-40" />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="divide-y divide-border rounded-sm border border-border bg-card">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3">
              <Skeleton className="h-20 w-20 shrink-0 rounded-sm" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-8 w-28" />
              </div>
              <Skeleton className="h-5 w-20 shrink-0" />
            </div>
          ))}
        </div>
        <div className="h-fit space-y-3 rounded-sm border border-border bg-card p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
