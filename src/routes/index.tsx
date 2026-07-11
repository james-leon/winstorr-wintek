import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Cpu, Download, Wrench, GraduationCap, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import type { ProductType } from "@/lib/format";

const featuredQuery = queryOptions({
  queryKey: ["featured-products"],
  queryFn: async (): Promise<ProductCardData[]> => {
    const { data, error } = await supabase
      .from("products")
      .select("id, slug, name, short_description, images, type, price, price_type, stock_quantity, featured, created_at")
      .eq("status", "active")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw error;
    return (data ?? []).map((p) => ({
      ...p,
      images: Array.isArray(p.images) ? (p.images as string[]) : [],
    })) as ProductCardData[];
  },
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(featuredQuery),
  component: Home,
  errorComponent: ({ error }) => <div className="p-8 text-center text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">Introuvable</div>,
});

const TILES: { type: ProductType; title: string; desc: string; Icon: typeof Cpu }[] = [
  { type: "physical", title: "Électronique", desc: "Ordinateurs, accessoires, composants et matériel pro.", Icon: Cpu },
  { type: "digital", title: "Produits numériques", desc: "Licences, ebooks, ressources téléchargeables.", Icon: Download },
  { type: "service", title: "Services", desc: "Réparation, installation, dépannage à domicile ou en atelier.", Icon: Wrench },
  { type: "training", title: "Formations", desc: "Cours en présentiel, en ligne ou hybrides.", Icon: GraduationCap },
];

function Home() {
  const { data: products } = useSuspenseQuery(featuredQuery);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs uppercase tracking-wider">
              Par Wintek — Winner Technology
            </div>
            <h1 className="font-display text-4xl leading-tight md:text-6xl">
              La tech dont vous avez besoin, <span className="text-accent">tout au même endroit.</span>
            </h1>
            <p className="mt-4 max-w-lg text-primary-foreground/80">
              Winstorr regroupe notre matériel électronique, nos produits numériques, nos services techniques et nos formations. Une seule boutique, quatre façons de vous équiper.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/catalogue">Découvrir le catalogue <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/catalogue" search={{ type: "service" }}>Demander un devis</Link>
              </Button>
            </div>
          </div>
          <div className="hidden md:grid grid-cols-2 gap-4">
            {TILES.map(({ Icon, title, type }) => (
              <Link
                key={type}
                to="/catalogue"
                search={{ type }}
                className="group rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-6 backdrop-blur transition-colors hover:bg-primary-foreground/10"
              >
                <Icon className="h-8 w-8 text-accent" />
                <div className="mt-3 font-display text-lg">{title}</div>
                <div className="mt-1 text-xs text-primary-foreground/60 group-hover:text-primary-foreground/80">Explorer →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Tiles */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-foreground">Quatre univers, une seule expérience</h2>
            <p className="mt-2 text-muted-foreground">Choisissez la catégorie qui correspond à votre besoin.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TILES.map(({ Icon, title, desc, type }) => (
            <Link
              key={type}
              to="/catalogue"
              search={{ type }}
              className="group flex flex-col rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-primary/5 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg text-foreground">{title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{desc}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Explorer <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-foreground">Nos produits en vedette</h2>
            <p className="mt-2 text-muted-foreground">Une sélection de nos meilleures offres, tous types confondus.</p>
          </div>
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link to="/catalogue">Tout voir <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center text-muted-foreground">
            Aucun produit publié pour l'instant. L'équipe Winstorr ajoute bientôt les premiers articles.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
