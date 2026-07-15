import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SlidersHorizontal, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { ProductCardSkeletonGrid } from "@/components/product-card-skeleton";
import { EmptyState } from "@/components/empty-state";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/format";
import { cn } from "@/lib/utils";


type SortKey = "recent" | "price_asc" | "price_desc" | "rating";
type CatalogueSearch = {
  type?: ProductType;
  q?: string;
  sort?: SortKey;
  minRating?: number;
  verified?: boolean;
  category?: string;
};

export const Route = createFileRoute("/catalogue")({
  validateSearch: (search: Record<string, unknown>): CatalogueSearch => {
    const t = search.type;
    const type = typeof t === "string" && ["physical", "digital", "service", "training"].includes(t)
      ? (t as ProductType) : undefined;
    const q = typeof search.q === "string" && search.q.length > 0 ? search.q : undefined;
    const s = search.sort;
    const sort = typeof s === "string" && ["recent", "price_asc", "price_desc", "rating"].includes(s)
      ? (s as SortKey) : undefined;
    const mr = Number(search.minRating);
    const minRating = mr >= 1 && mr <= 5 ? mr : undefined;
    const verified = search.verified === true || search.verified === "true" ? true : undefined;
    const category = typeof search.category === "string" && search.category.length > 0 ? search.category : undefined;
    return { type, q, sort, minRating, verified, category };
  },
  head: () => {
    const title = "Catalogue — Électronique, Numérique, Services & Formations | Winstorr";
    const description = "Parcourez tout le catalogue Winstorr : électronique, produits numériques, services techniques et formations, avec notes clients et vendeurs vérifiés. Livraison au Cameroun, paiement Mobile Money.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "/catalogue" },
      ],
      links: [{ rel: "canonical", href: "/catalogue" }],
    };
  },
  component: Catalogue,
});



const TYPES: ProductType[] = ["physical", "digital", "service", "training"];

function Catalogue() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sort: SortKey = search.sort ?? "recent";

  const { data: categories = [] } = useQuery({
    queryKey: ["catalogue-categories", search.type],
    queryFn: async () => {
      let q = supabase.from("categories").select("id, name, slug, product_type, parent_id, display_order").eq("status", "active");
      if (search.type) q = q.eq("product_type", search.type);
      const { data, error } = await q.order("display_order").order("name");
      if (error) throw error;
      return data as { id: string; name: string; slug: string; product_type: ProductType; parent_id: string | null; display_order: number }[];
    },
  });

  const selectedCategory = categories.find((c) => c.slug === search.category);
  const categoryIds = selectedCategory
    ? [selectedCategory.id, ...categories.filter((c) => c.parent_id === selectedCategory.id).map((c) => c.id)]
    : null;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["catalogue", search.type, search.q, search.sort, search.minRating, search.verified, search.category, categoryIds?.join(",")],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, slug, name, short_description, images, type, price, price_type, stock_quantity, compare_at_price, rating_average, rating_count, quality_verified")
        .eq("status", "active");
      if (search.type) query = query.eq("type", search.type);
      if (search.q) query = query.ilike("name", `%${search.q}%`);
      if (search.verified) query = query.eq("quality_verified", true);
      if (search.minRating) query = query.gte("rating_average", search.minRating);
      if (categoryIds && categoryIds.length > 0) query = query.in("category_id", categoryIds);

      switch (search.sort) {
        case "price_asc": query = query.order("price", { ascending: true, nullsFirst: false }); break;
        case "price_desc": query = query.order("price", { ascending: false, nullsFirst: false }); break;
        case "rating": query = query.order("rating_average", { ascending: false }).order("rating_count", { ascending: false }); break;
        default: query = query.order("created_at", { ascending: false });
      }
      query = query.limit(48);


      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        images: Array.isArray(p.images) ? (p.images as string[]) : [],
      })) as ProductCardData[];
    },
  });

  const setSearch = (updater: (prev: CatalogueSearch) => CatalogueSearch) => {
    void navigate({ search: updater });
  };
  const toggleType = (t: ProductType) => setSearch((prev) => ({ ...prev, type: prev.type === t ? undefined : t }));
  const clear = () => { void navigate({ search: {} }); };

  const Sidebar = (
    <aside className="space-y-5 text-sm">
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</div>
        <div className="space-y-0.5">
          {TYPES.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-muted">
              <Checkbox checked={search.type === t} onCheckedChange={() => toggleType(t)} />
              <span className="text-xs">{PRODUCT_TYPE_LABELS[t]}</span>
            </label>
          ))}
        </div>
      </div>

      {categories.length > 0 && (
        <div className="border-t border-border pt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Catégorie</div>
          <div className="space-y-0.5">
            {categories.filter((c) => !c.parent_id).map((parent) => {
              const children = categories.filter((c) => c.parent_id === parent.id);
              const active = search.category === parent.slug;
              return (
                <div key={parent.id}>
                  <button
                    type="button"
                    onClick={() => setSearch((prev) => ({ ...prev, category: active ? undefined : parent.slug }))}
                    className={cn(
                      "w-full text-left rounded-sm px-1.5 py-1 text-xs hover:bg-muted",
                      active && "bg-muted font-semibold text-foreground",
                    )}
                  >
                    {parent.name}
                  </button>
                  {children.map((child) => {
                    const cActive = search.category === child.slug;
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => setSearch((prev) => ({ ...prev, category: cActive ? undefined : child.slug }))}
                        className={cn(
                          "w-full text-left rounded-sm pl-4 pr-1.5 py-1 text-xs text-muted-foreground hover:bg-muted",
                          cActive && "bg-muted font-semibold text-foreground",
                        )}
                      >
                        └ {child.name}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}


      <div className="border-t border-border pt-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Qualité</div>
        <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-muted">
          <Checkbox
            checked={!!search.verified}
            onCheckedChange={(v) => setSearch((prev) => ({ ...prev, verified: v ? true : undefined }))}
          />
          <span className="inline-flex items-center gap-1 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-success" strokeWidth={2.5} /> Qualité vérifiée
          </span>
        </label>
      </div>

      <div className="border-t border-border pt-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Note minimum</div>
        <div className="space-y-0.5">
          {[4, 3, 2, 1].map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-muted">
              <Checkbox
                checked={search.minRating === r}
                onCheckedChange={(v) => setSearch((prev) => ({ ...prev, minRating: v ? r : undefined }))}
              />
              <StarRating rating={r} showCount={false} />
              <span className="text-[11px] text-muted-foreground">& plus</span>
            </label>
          ))}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={clear} className="w-full h-8 text-xs">Réinitialiser</Button>
    </aside>
  );

  return (
    <div className="mx-auto max-w-7xl px-3 py-4">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2">
        <div>
          <h1 className="text-base font-semibold text-foreground">
            {search.type ? PRODUCT_TYPE_LABELS[search.type as ProductType] : "Catalogue"}
            {search.q && <span className="ml-2 text-muted-foreground font-normal">« {search.q} »</span>}
          </h1>
          <div className="text-xs text-muted-foreground">
            {isLoading ? "Chargement…" : `${products.length} résultat${products.length > 1 ? "s" : ""}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setFiltersOpen((v) => !v)} className="md:hidden h-8 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtres
          </Button>
          <Select value={sort} onValueChange={(v) => setSearch((prev) => ({ ...prev, sort: v as SortKey }))}>
            <SelectTrigger className="h-8 w-[160px] text-xs rounded-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Nouveautés</SelectItem>
              <SelectItem value="price_asc">Prix croissant</SelectItem>
              <SelectItem value="price_desc">Prix décroissant</SelectItem>
              <SelectItem value="rating">Mieux notés</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[200px_1fr]">
        <div className={cn("md:block", filtersOpen ? "block" : "hidden")}>{Sidebar}</div>
        <div>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : products.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-muted/30 p-10 text-center">
              <p className="text-sm text-muted-foreground">Aucun produit ne correspond à ces filtres.</p>
              <Button variant="link" onClick={clear} asChild>
                <Link to="/catalogue">Voir tous les produits</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
