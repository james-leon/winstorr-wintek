import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/mon-compte/liste-de-souhaits")({
  head: () => ({ meta: [{ title: "Liste de souhaits — Winstorr" }, { name: "robots", content: "noindex" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ["wishlist-items", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("created_at, product:products(id, slug, name, short_description, images, type, price, price_type, stock_quantity, compare_at_price, rating_average, rating_count, quality_verified)")
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((r) => r.product)
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p): ProductCardData => ({ ...p, images: Array.isArray(p.images) ? (p.images as string[]) : [] }));
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Liste de souhaits</h2>
      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!isLoading && data.length === 0 && (
        <div className="rounded-sm border border-dashed border-border p-10 text-center">
          <Heart className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Aucun article enregistré pour le moment.</p>
          <Button asChild><Link to="/catalogue">Découvrir le catalogue</Link></Button>
        </div>
      )}
      {data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
