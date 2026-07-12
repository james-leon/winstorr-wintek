import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { StarRating } from "@/components/star-rating";
import { Input } from "@/components/ui/input";
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
    return { type, q, sort, minRating, verified };
  },
  head: () => ({
    meta: [
      { title: "Catalogue — Winstorr" },
      { name: "description", content: "Parcourez le catalogue Winstorr : électronique, produits numériques, services techniques et formations, avec notes clients et vendeurs vérifiés." },
      { property: "og:title", content: "Catalogue Winstorr" },
      { property: "og:description", content: "Tout le catalogue tech Winstorr, avec notes clients et qualité vérifiée." },
    ],
  }),
  component: Catalogue,
});

const TYPES: ProductType[] = ["physical", "digital", "service", "training"];

function Catalogue() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sort: SortKey = search.sort ?? "recent";

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["catalogue", search.type, search.q, search.sort, search.minRating, search.verified],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, slug, name, short_description, images, type, price, price_type, stock_quantity, rating_average, rating_count, quality_verified")
        .eq("status", "active");
      if (search.type) query = query.eq("type", search.type);
      if (search.q) query = query.ilike("name", `%${search.q}%`);
      if (search.verified) query = query.eq("quality_verified", true);
      if (search.minRating) query = query.gte("rating_average", search.minRating);

      switch (search.sort) {
        case "price_asc": query = query.order("price", { ascending: true, nullsFirst: false }); break;
        case "price_desc": query = query.order("price", { ascending: false, nullsFirst: false }); break;
        case "rating": query = query.order("rating_average", { ascending: false }).order("rating_count", { ascending: false }); break;
        default: query = query.order("created_at", { ascending: false });
      }

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
  const clear = () => { setQ(""); void navigate({ search: {} }); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch((prev) => ({ ...prev, q: q || undefined }));
  };

  const Sidebar = (
    <aside className="space-y-6">
      <div>
        <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Type</div>
        <div className="space-y-2">
          {TYPES.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
              <Checkbox checked={search.type === t} onCheckedChange={() => toggleType(t)} />
              <span className="text-sm">{PRODUCT_TYPE_LABELS[t]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Qualité</div>
        <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
          <Checkbox
            checked={!!search.verified}
            onCheckedChange={(v) => setSearch((prev) => ({ ...prev, verified: v ? true : undefined }))}
          />
          <span className="inline-flex items-center gap-1 text-sm">
            <ShieldCheck className="h-4 w-4 text-success" /> Qualité vérifiée
          </span>
        </label>
      </div>

      <div>
        <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Note minimum</div>
        <div className="space-y-1">
          {[4, 3, 2, 1].map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
              <Checkbox
                checked={search.minRating === r}
                onCheckedChange={(v) => setSearch((prev) => ({ ...prev, minRating: v ? r : undefined }))}
              />
              <StarRating rating={r} showCount={false} />
              <span className="text-xs text-muted-foreground">& plus</span>
            </label>
          ))}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={clear} className="w-full">Réinitialiser</Button>
    </aside>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-foreground md:text-4xl">Catalogue</h1>
        <p className="mt-2 text-muted-foreground">
          {search.type ? `Catégorie : ${PRODUCT_TYPE_LABELS[search.type as ProductType]}` : "Tous nos produits, services et formations."}
        </p>
      </div>

      <form onSubmit={submit} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit, un service..." className="pl-9" />
        </div>
        <Button type="submit">Rechercher</Button>
        <Button type="button" variant="outline" onClick={() => setFiltersOpen((v) => !v)} className="md:hidden">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </form>

      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <div className={cn("md:block", filtersOpen ? "block" : "hidden")}>{Sidebar}</div>
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {isLoading ? "Chargement..." : `${products.length} résultat${products.length > 1 ? "s" : ""}`}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Trier :</span>
              <Select value={sort} onValueChange={(v) => setSearch((prev) => ({ ...prev, sort: v as SortKey }))}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Nouveautés</SelectItem>
                  <SelectItem value="price_asc">Prix croissant</SelectItem>
                  <SelectItem value="price_desc">Prix décroissant</SelectItem>
                  <SelectItem value="rating">Mieux notés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Chargement...</div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
              <p className="text-muted-foreground">Aucun produit ne correspond à ces filtres.</p>
              <Button variant="link" onClick={clear} asChild>
                <Link to="/catalogue">Voir tous les produits</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
