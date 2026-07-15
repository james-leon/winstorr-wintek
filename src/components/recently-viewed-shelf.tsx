import { History } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { useRecentlyViewedProducts } from "@/lib/recently-viewed";

/**
 * Renders nothing until the user has actually viewed a product,
 * so the homepage stays clean for first-time visitors.
 */
export function RecentlyViewedShelf({ excludeId, title = "Vus récemment" }: { excludeId?: string; title?: string }) {
  const { data = [], isPending } = useRecentlyViewedProducts(excludeId);
  if (isPending || data.length === 0) return null;
  return (
    <section aria-labelledby="recently-viewed-title" className="mt-8">
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 id="recently-viewed-title" className="text-base font-semibold text-foreground">
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {data.slice(0, 6).map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
