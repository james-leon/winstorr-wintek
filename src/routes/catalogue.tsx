import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/format";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  type: z.enum(["physical", "digital", "service", "training"]).optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/catalogue")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Catalogue — Winstorr" },
      { name: "description", content: "Parcourez notre catalogue : électronique, produits numériques, services techniques et formations." },
      { property: "og:title", content: "Catalogue Winstorr" },
      { property: "og:description", content: "Tout notre catalogue tech en un seul endroit." },
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

  const selectedTypes = search.type ? [search.type] : [];

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["catalogue", search.type, search.q],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, slug, name, short_description, images, type, price, price_type, stock_quantity, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (search.type) query = query.eq("type", search.type);
      if (search.q) query = query.ilike("name", `%${search.q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        images: Array.isArray(p.images) ? (p.images as string[]) : [],
      })) as ProductCardData[];
    },
  });

  const toggleType = (t: ProductType) => {
    void navigate({
      search: (prev) => ({ ...prev, type: prev.type === t ? undefined : t }),
    });
  };

  const clear = () => {
    setQ("");
    void navigate({ search: {} });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void navigate({ search: (prev) => ({ ...prev, q: q || undefined }) });
  };

  const Sidebar = (
    <aside className="space-y-6">
      <div>
        <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Type</div>
        <div className="space-y-2">
          {TYPES.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
              <Checkbox checked={selectedTypes.includes(t)} onCheckedChange={() => toggleType(t)} />
              <span className="text-sm">{PRODUCT_TYPE_LABELS[t]}</span>
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
          {search.type ? `Catégorie : ${PRODUCT_TYPE_LABELS[search.type]}` : "Tous nos produits, services et formations."}
        </p>
      </div>

      <form onSubmit={submit} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un produit..."
            className="pl-9"
          />
        </div>
        <Button type="submit">Rechercher</Button>
        <Button type="button" variant="outline" onClick={() => setFiltersOpen((v) => !v)} className="md:hidden">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </form>

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <div className={cn("md:block", filtersOpen ? "block" : "hidden")}>{Sidebar}</div>
        <div>
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
