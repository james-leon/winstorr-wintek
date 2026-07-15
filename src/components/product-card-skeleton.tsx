import { Skeleton } from "@/components/ui/skeleton";

/** Matches ProductCard footprint so grids don't reflow when data lands. */
export function ProductCardSkeleton() {
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

export function ProductCardSkeletonGrid({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
