import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Cpu, Download, Wrench, GraduationCap, ArrowRight, ShieldCheck, Truck, Star, Headset } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { QualityBadge } from "@/components/quality-badge";
import type { ProductType } from "@/lib/format";

const featuredQuery = queryOptions({
  queryKey: ["featured-products"],
  queryFn: async (): Promise<ProductCardData[]> => {
    const { data, error } = await supabase
      .from("products")
      .select("id, slug, name, short_description, images, type, price, price_type, stock_quantity, compare_at_price, featured, created_at, rating_average, rating_count, quality_verified")
      .eq("status", "active")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12);
    if (error) throw error;
    return (data ?? []).map((p) => ({
      ...p,
      images: Array.isArray(p.images) ? (p.images as string[]) : [],
    })) as ProductCardData[];
  },
});

const topRatedQuery = queryOptions({
  queryKey: ["top-rated-products"],
  queryFn: async (): Promise<ProductCardData[]> => {
    const { data, error } = await supabase
      .from("products")
      .select("id, slug, name, short_description, images, type, price, price_type, stock_quantity, compare_at_price, rating_average, rating_count, quality_verified")
      .eq("status", "active")
      .gt("rating_count", 0)
      .order("rating_average", { ascending: false })
      .order("rating_count", { ascending: false })
      .limit(6);
    if (error) throw error;
    return (data ?? []).map((p) => ({
      ...p,
      images: Array.isArray(p.images) ? (p.images as string[]) : [],
    })) as ProductCardData[];
  },
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(featuredQuery),
      context.queryClient.ensureQueryData(topRatedQuery),
    ]);
  },
  component: Home,
  errorComponent: ({ error }) => <div className="p-8 text-center text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">Introuvable</div>,
});

const TILES: { type: ProductType; title: string; Icon: typeof Cpu }[] = [
  { type: "physical", title: "Produits physiques", Icon: Cpu },
  { type: "digital", title: "Numérique", Icon: Download },
  { type: "service", title: "Services", Icon: Wrench },
  { type: "training", title: "Formations", Icon: GraduationCap },
];

const TRUST = [
  { Icon: ShieldCheck, title: "Qualité vérifiée", desc: "Chaque produit contrôlé par Wintek avant publication.", signature: true },
  { Icon: Truck, title: "Origine transparente", desc: "Import direct ou grossiste agréé — provenance toujours indiquée." },
  { Icon: Star, title: "Avis authentiques", desc: "Seuls les clients Winstorr peuvent noter les produits commandés." },
  { Icon: Headset, title: "Support local", desc: "Équipe basée au Cameroun, joignable par téléphone ou en atelier." },
];

function Home() {
  const { data: products } = useSuspenseQuery(featuredQuery);
  const { data: topRated } = useSuspenseQuery(topRatedQuery);

  return (
    <div>
      {/* Compact hero band */}
      <section className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-8 md:py-10">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-wider text-primary-foreground/70">
              Par Wintek — Winner Technology
            </div>
            <h1 className="font-display text-2xl leading-tight md:text-4xl mt-1">
              La marketplace tech de confiance au Cameroun.
            </h1>
            <p className="mt-2 text-sm text-primary-foreground/80 max-w-xl">
              Matériel électronique, produits numériques, services techniques et formations — vendeurs vérifiés, avis authentiques.
            </p>
          </div>
        </div>
      </section>

      {/* Category strip */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="grid grid-cols-4 gap-2">
            {TILES.map(({ Icon, title, type }) => (
              <Link
                key={type}
                to="/catalogue"
                search={{ type }}
                className="flex flex-col items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-3 text-center transition-colors hover:border-secondary/60 no-link-color"
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-foreground">{title}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured grid — dense 6-col desktop / 2-col mobile */}
      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-3 flex items-end justify-between gap-4 border-b border-border pb-2">
          <h2 className="text-base font-semibold text-foreground">Nos produits en vedette</h2>
          <Link to="/catalogue" className="text-xs font-medium text-secondary hover:underline inline-flex items-center gap-0.5">
            Tout voir <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {products.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
            Aucun produit publié pour l'instant.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {topRated.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-6">
          <div className="mb-3 flex items-end justify-between gap-4 border-b border-border pb-2">
            <h2 className="text-base font-semibold text-foreground">Les mieux notés</h2>
            <Link to="/catalogue" search={{ sort: "rating" }} className="text-xs font-medium text-secondary hover:underline inline-flex items-center gap-0.5">
              Classement complet <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {topRated.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* Trust — Qualité vérifiée signature */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-border pb-2">
            <h2 className="text-base font-semibold text-foreground">Pourquoi Winstorr ?</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ Icon, title, desc, signature }) => (
              <div key={title} className="rounded-sm border border-border bg-card p-3">
                <div className="flex items-start gap-2.5">
                  <div className={
                    signature
                      ? "grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-success/30 bg-success/10 text-success"
                      : "grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-primary/5 text-primary"
                  }>
                    <Icon className="h-4 w-4" strokeWidth={signature ? 2.5 : 2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{desc}</p>
                    {signature && <QualityBadge className="mt-2" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
