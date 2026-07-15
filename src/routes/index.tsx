import { createFileRoute, Link } from "@tanstack/react-router";
import { RecentlyViewedShelf } from "@/components/recently-viewed-shelf";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { Store as StoreIcon, ShieldCheck as ShieldCheckIcon } from "lucide-react";


import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRef } from "react";
import Autoplay from "embla-carousel-autoplay";
import {
  ShieldCheck,
  Truck,
  Wallet,
  ArrowRight,
  Sparkles,
  Tag,
  GraduationCap,
  Wrench,
  Cpu,
  Download,
  Smartphone,
  Laptop,
  Headphones,
  Camera,
  Star,
  Shirt,
  Apple,
  Home as HomeIcon,
  Baby,
  Dumbbell,
  Hammer,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { QualityBadge } from "@/components/quality-badge";
import { displayPrice, formatFcfa, type ProductType } from "@/lib/format";
import { imageAtWidth, imageSrcSet } from "@/lib/seo";
import { cn } from "@/lib/utils";

/* -------------------- data -------------------- */

type MiniProduct = {
  id: string;
  slug: string;
  name: string;
  images: string[];
  price: number | null;
  price_type: "fixed" | "starting_at" | "quote_only";
  rating_average: number | null;
  rating_count: number | null;
  quality_verified: boolean | null;
  type: ProductType;
  category_id?: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  product_type: ProductType | null;
  parent_id: string | null;
  display_order: number | null;
};

type RootCategory = CategoryRow & {
  descendantIds: string[];
  products: MiniProduct[];
};

const BASE_SELECT =
  "id, slug, name, images, price, price_type, rating_average, rating_count, quality_verified, type, category_id";

function normalize(rows: unknown[]): MiniProduct[] {
  return (rows as MiniProduct[]).map((p) => ({
    ...p,
    images: Array.isArray(p.images) ? (p.images as string[]) : [],
  }));
}

const homeShelvesQuery = queryOptions({
  queryKey: ["home-shelves-v3"],
  queryFn: async () => {
    const cats = await supabase
      .from("categories")
      .select("id, name, slug, product_type, parent_id, display_order")
      .eq("status", "active")
      .order("display_order");
    if (cats.error) throw cats.error;

    const catRows = (cats.data ?? []) as CategoryRow[];
    const byParent = new Map<string | null, CategoryRow[]>();
    for (const c of catRows) {
      const key = c.parent_id;
      const arr = byParent.get(key) ?? [];
      arr.push(c);
      byParent.set(key, arr);
    }

    const collectDescendants = (rootId: string): string[] => {
      const out: string[] = [rootId];
      const stack = [rootId];
      while (stack.length) {
        const id = stack.pop()!;
        const kids = byParent.get(id) ?? [];
        for (const k of kids) {
          out.push(k.id);
          stack.push(k.id);
        }
      }
      return out;
    };

    // All active products (used for grouping + generic shelves)
    const allProducts = await supabase
      .from("products")
      .select(BASE_SELECT)
      .eq("status", "active")
      .order("rating_count", { ascending: false })
      .order("rating_average", { ascending: false })
      .order("created_at", { ascending: false });
    if (allProducts.error) throw allProducts.error;
    const products = normalize(allProducts.data ?? []);

    const roots = (byParent.get(null) ?? []).slice().sort((a, b) => {
      const da = a.display_order ?? 999;
      const db = b.display_order ?? 999;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name);
    });

    const rootCats: RootCategory[] = roots.map((r) => {
      const descendantIds = collectDescendants(r.id);
      const set = new Set(descendantIds);
      const rootProducts = products.filter((p) => p.category_id && set.has(p.category_id));
      return { ...r, descendantIds, products: rootProducts };
    });

    const rootsWithProducts = rootCats.filter((c) => c.products.length > 0);

    // Generic shelves
    const nouveautes = await supabase
      .from("products")
      .select(BASE_SELECT)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(12);
    if (nouveautes.error) throw nouveautes.error;

    const topRated = products
      .filter((p) => (p.rating_count ?? 0) > 0)
      .sort((a, b) => (b.rating_average ?? 0) - (a.rating_average ?? 0))
      .slice(0, 12);

    const verified = products.filter((p) => p.quality_verified).slice(0, 12);

    const spotlight = verified[0] ?? topRated[0] ?? null;

    const bannersRes = await supabase
      .from("homepage_banners")
      .select("id, type, title, subtitle, image_url, cta_label, link_url, background_color, category_id, display_order, is_active, starts_at, ends_at")
      .eq("is_active", true)
      .order("display_order");
    const now = Date.now();
    const banners = ((bannersRes.data ?? []) as DbBanner[]).filter((b) => {
      if (b.starts_at && new Date(b.starts_at).getTime() > now) return false;
      if (b.ends_at && new Date(b.ends_at).getTime() < now) return false;
      return true;
    });

    return {
      rootsWithProducts,
      nouveautes: normalize(nouveautes.data ?? []),
      topRated,
      verified,
      spotlight,
      banners,
    };
  },
});

type DbBanner = {
  id: string;
  type: "hero_slide" | "promo_tile" | "category_tile";
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_label: string | null;
  link_url: string | null;
  background_color: string | null;
  category_id: string | null;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

/* -------------------- route -------------------- */

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homeShelvesQuery),
  head: () => {
    const title = "Winstorr — Marketplace tech de confiance au Cameroun";
    const description =
      "Électronique, produits numériques, services techniques et formations, vérifiés par Wintek. Paiement Mobile Money, SAV local.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: "/" }],
    };
  },
  component: Home,
});

/* -------------------- category styling -------------------- */

const CATEGORY_ICON: Record<string, LucideIcon> = {
  telephones: Smartphone,
  ordinateurs: Laptop,
  audio: Headphones,
  securite: ShieldCheck,
  "installation-securite": Wrench,
  reparation: Wrench,
  "formations-pro": GraduationCap,
  "acces-saas": Download,
  "e-books": Download,
  logiciels: Cpu,
  "mode-chaussures": Shirt,
  "beaute-cheveux": Sparkles,
  alimentaire: Apple,
  "maison-entretien": HomeIcon,
  "bebe-enfant": Baby,
  "sport-loisirs": Dumbbell,
  "bricolage-outillage": Hammer,
};

const CATEGORY_TINT: Record<string, { tile: string; icon: string }> = {
  telephones: { tile: "bg-gradient-to-br from-primary to-secondary text-primary-foreground", icon: "bg-primary/10 text-primary" },
  ordinateurs: { tile: "bg-gradient-to-br from-secondary to-primary text-primary-foreground", icon: "bg-secondary/15 text-secondary" },
  audio: { tile: "bg-gradient-to-br from-[#1a3a6e] to-[#0f4f66] text-primary-foreground", icon: "bg-primary/10 text-primary" },
  securite: { tile: "bg-gradient-to-br from-success/85 to-success text-primary-foreground", icon: "bg-success/15 text-success" },
  "installation-securite": { tile: "bg-gradient-to-br from-primary to-[#1A6BB5] text-primary-foreground", icon: "bg-primary/10 text-primary" },
  reparation: { tile: "bg-gradient-to-br from-[#123f7a] to-[#1A6BB5] text-primary-foreground", icon: "bg-secondary/15 text-secondary" },
  "formations-pro": { tile: "bg-gradient-to-br from-accent/90 to-accent text-accent-foreground", icon: "bg-accent/15 text-accent" },
  "acces-saas": { tile: "bg-gradient-to-br from-success/85 to-success text-primary-foreground", icon: "bg-success/15 text-success" },
  "e-books": { tile: "bg-gradient-to-br from-secondary to-[#0f4f66] text-primary-foreground", icon: "bg-secondary/15 text-secondary" },
  logiciels: { tile: "bg-gradient-to-br from-primary to-secondary text-primary-foreground", icon: "bg-primary/10 text-primary" },
  "mode-chaussures": { tile: "bg-gradient-to-br from-accent/80 to-[#F58B1F] text-accent-foreground", icon: "bg-accent/15 text-accent" },
  "beaute-cheveux": { tile: "bg-gradient-to-br from-[#c9497f] to-[#8b3a63] text-primary-foreground", icon: "bg-accent/15 text-accent" },
  alimentaire: { tile: "bg-gradient-to-br from-success/85 to-[#2a8f42] text-primary-foreground", icon: "bg-success/15 text-success" },
  "maison-entretien": { tile: "bg-gradient-to-br from-[#0f4f66] to-secondary text-primary-foreground", icon: "bg-secondary/15 text-secondary" },
  "bebe-enfant": { tile: "bg-gradient-to-br from-[#F2994A] to-accent text-accent-foreground", icon: "bg-accent/15 text-accent" },
  "sport-loisirs": { tile: "bg-gradient-to-br from-secondary to-success/80 text-primary-foreground", icon: "bg-secondary/15 text-secondary" },
  "bricolage-outillage": { tile: "bg-gradient-to-br from-primary to-[#1a3a6e] text-primary-foreground", icon: "bg-primary/10 text-primary" },
};

function iconFor(slug: string): LucideIcon {
  return CATEGORY_ICON[slug] ?? Package;
}

function tintFor(slug: string) {
  return (
    CATEGORY_TINT[slug] ?? {
      tile: "bg-gradient-to-br from-primary to-secondary text-primary-foreground",
      icon: "bg-primary/10 text-primary",
    }
  );
}

function searchFor(cat: RootCategory): Record<string, unknown> {
  return cat.product_type
    ? { type: cat.product_type, category: cat.slug }
    : { category: cat.slug };
}

/* -------------------- primitives -------------------- */

function SectionHeader({
  title,
  to,
  search,
}: {
  title: string;
  to?: string;
  search?: Record<string, unknown>;
}) {
  return (
    <div className="mb-2 flex items-end justify-between gap-4 border-b border-border pb-1.5">
      <h2 className="text-[15px] font-bold text-foreground tracking-tight">{title}</h2>
      {to && (
        <Link
          to={to}
          search={search as never}
          className="text-xs font-medium text-secondary hover:underline inline-flex items-center gap-0.5 shrink-0"
        >
          Voir tout <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function MiniCard({ p }: { p: MiniProduct }) {
  const img = p.images?.[0];
  return (
    <Link
      to="/produits/$slug"
      params={{ slug: p.slug }}
      className="group block w-[140px] shrink-0 sm:w-[160px] no-link-color"
    >
      <div className="aspect-square overflow-hidden rounded-sm bg-muted border border-border">
        {img ? (
          <img
            src={imageAtWidth(img, 240) || img}
            srcSet={imageSrcSet(img, [160, 240, 320])}
            sizes="160px"
            alt={p.name}
            loading="lazy"
            decoding="async"
            width={240}
            height={240}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">Sans image</div>
        )}
      </div>
      <div className="mt-1.5 line-clamp-1 text-[12px] text-foreground leading-snug">{p.name}</div>
      <div className="text-[13px] font-bold text-accent leading-tight">
        {displayPrice({ price: p.price, price_type: p.price_type })}
      </div>
    </Link>
  );
}

function Shelf({ items }: { items: MiniProduct[] }) {
  if (items.length === 0) {
    return <div className="rounded-sm border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">Aucun produit à afficher.</div>;
  }
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto scrollbar-thin px-1 pb-1">
      {items.map((p) => <MiniCard key={p.id} p={p} />)}
    </div>
  );
}

/* -------------------- sections -------------------- */

type Slide = {
  eyebrow: string;
  title: string;
  sub: string;
  cta: string;
  to: string;
  search?: Record<string, unknown>;
  bg: string;
};

const SLIDES: Slide[] = [
  {
    eyebrow: "Code promo",
    title: "-10 % sur votre première commande",
    sub: "Utilisez BIENVENUE2026 au panier — valable sur tout le catalogue vérifié.",
    cta: "Découvrir le catalogue",
    to: "/catalogue",
    bg: "from-[#0D2C54] via-[#123f7a] to-[#1A6BB5]",
  },
  {
    eyebrow: "Signature Wintek",
    title: "Qualité vérifiée sur chaque produit",
    sub: "Chaque référence est contrôlée par nos techniciens avant publication.",
    cta: "Voir les produits vérifiés",
    to: "/catalogue",
    search: { verified: true },
    bg: "from-[#0D2C54] to-[#0f4f66]",
  },
  {
    eyebrow: "Rentrée & carrière",
    title: "Formations pro — places limitées",
    sub: "Marketing digital, développement web, community management. Sessions courtes, formateurs Wintek.",
    cta: "Voir les formations",
    to: "/catalogue",
    search: { type: "training" as ProductType },
    bg: "from-[#0D2C54] via-[#1a3a6e] to-[#F58B1F]",
  },
  {
    eyebrow: "Services techniques",
    title: "Installation, réparation, sécurité",
    sub: "Équipe Wintek à domicile ou en atelier partout au Cameroun.",
    cta: "Demander un service",
    to: "/catalogue",
    search: { type: "service" as ProductType },
    bg: "from-[#0D2C54] to-[#1A6BB5]",
  },
];

function Hero({ dbSlides }: { dbSlides: DbBanner[] }) {
  const autoplay = useRef(Autoplay({ delay: 5500, stopOnInteraction: true }));
  const useDb = dbSlides.length > 0;
  return (
    <section className="bg-primary">
      <Carousel
        opts={{ loop: true, align: "start" }}
        plugins={[autoplay.current]}
        className="relative"
      >
        <CarouselContent>
          {useDb
            ? dbSlides.map((s) => (
                <CarouselItem key={s.id}>
                  <Link
                    to={s.link_url ?? "/catalogue"}
                    className={cn(
                      "relative flex min-h-[220px] md:min-h-[300px] w-full items-center overflow-hidden px-4 md:px-10 no-link-color",
                      !s.image_url && "bg-gradient-to-br from-[#0D2C54] via-[#123f7a] to-[#1A6BB5]",
                    )}
                    style={s.background_color && !s.image_url ? { background: s.background_color } : undefined}
                  >
                    {s.image_url && (
                      <>
                        <img
                          src={s.image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="eager"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                      </>
                    )}
                    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-3 py-8 text-primary-foreground md:py-12">
                      <h2 className="max-w-2xl text-2xl font-bold leading-tight md:text-4xl">{s.title}</h2>
                      {s.subtitle && (
                        <p className="max-w-xl text-sm text-primary-foreground/85 md:text-base">{s.subtitle}</p>
                      )}
                      {s.cta_label && (
                        <span className="mt-2 inline-flex w-max items-center gap-1.5 rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm">
                          {s.cta_label} <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </Link>
                </CarouselItem>
              ))
            : SLIDES.map((s, i) => (
                <CarouselItem key={i}>
                  <Link
                    to={s.to}
                    search={s.search as never}
                    className={cn(
                      "relative flex min-h-[220px] md:min-h-[300px] w-full items-center bg-gradient-to-br px-4 md:px-10 no-link-color",
                      s.bg,
                    )}
                  >
                    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 py-8 text-primary-foreground md:py-12">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-primary-foreground/75">
                        {s.eyebrow}
                      </div>
                      <h2 className="max-w-2xl text-2xl font-bold leading-tight md:text-4xl">
                        {s.title}
                      </h2>
                      <p className="max-w-xl text-sm text-primary-foreground/85 md:text-base">
                        {s.sub}
                      </p>
                      <span className="mt-2 inline-flex w-max items-center gap-1.5 rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm">
                        {s.cta} <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </CarouselItem>
              ))}
        </CarouselContent>
        <CarouselPrevious className="left-2 md:left-4 bg-background/80 hover:bg-background text-foreground border-border" />
        <CarouselNext className="right-2 md:right-4 bg-background/80 hover:bg-background text-foreground border-border" />
      </Carousel>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { Icon: ShieldCheck, title: "Produits garantis authentiques", desc: "Contrôle qualité Wintek avant chaque publication." },
    { Icon: Wrench, title: "SAV assuré par Wintek", desc: "Support, réparation et retour local — pas d’intermédiaire." },
    { Icon: Wallet, title: "Paiement sécurisé", desc: "MTN Mobile Money, Orange Money et carte bancaire." },
  ];
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 sm:grid-cols-3">
        {items.map(({ Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-success/10 text-success border border-success/30">
              <Icon className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground leading-tight">{title}</div>
              <div className="text-xs text-muted-foreground leading-snug mt-0.5">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type PromoTile = {
  title: string;
  sub: string;
  Icon: LucideIcon;
  tint: string;
  ring: string;
  iconTint: string;
  to: string;
  search?: Record<string, unknown>;
};

function PromoTiles({ tiles }: { tiles: PromoTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => (
        <Link
          key={t.title}
          to={t.to}
          search={t.search as never}
          className={cn(
            "group flex min-h-[140px] flex-col justify-between rounded-sm border p-3.5 no-link-color transition-colors",
            t.tint,
            t.ring,
          )}
        >
          <div className={cn("grid h-9 w-9 place-items-center rounded-sm", t.iconTint)}>
            <t.Icon className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground leading-tight">{t.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground leading-snug">{t.sub}</div>
            <div className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-secondary">
              Découvrir <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

const PRIMARY_PROMO: PromoTile[] = [
  {
    title: "À moins de 20 000 FCFA",
    sub: "Petits prix, produits physiques du quotidien.",
    Icon: Tag,
    tint: "bg-secondary/5",
    ring: "border-secondary/30 hover:border-secondary/60",
    iconTint: "bg-secondary/15 text-secondary",
    to: "/catalogue",
    search: { type: "physical" as ProductType, sort: "price_asc" },
  },
  {
    title: "Qualité vérifiée : -10 % ce mois",
    sub: "Code BIENVENUE2026 sur tout le catalogue vérifié.",
    Icon: ShieldCheck,
    tint: "bg-success/5",
    ring: "border-success/30 hover:border-success/60",
    iconTint: "bg-success/15 text-success",
    to: "/catalogue",
    search: { verified: true },
  },
  {
    title: "Formations : places limitées",
    sub: "Sessions Wintek Academy — inscription ouverte.",
    Icon: GraduationCap,
    tint: "bg-accent/5",
    ring: "border-accent/30 hover:border-accent/60",
    iconTint: "bg-accent/15 text-accent",
    to: "/catalogue",
    search: { type: "training" as ProductType },
  },
  {
    title: "Services à domicile, sur devis",
    sub: "Installation, réparation, dépannage local.",
    Icon: Wrench,
    tint: "bg-primary/5",
    ring: "border-primary/25 hover:border-primary/50",
    iconTint: "bg-primary/10 text-primary",
    to: "/catalogue",
    search: { type: "service" as ProductType },
  },
];

/* Category mosaic — dynamic tiles from top-level categories with products */

function CategoryMosaic({ cats }: { cats: RootCategory[] }) {
  if (cats.length === 0) return null;
  // First tile is featured (spans 2x2 on md+), remainder are standard cells.
  const [featured, ...rest] = cats;
  const featuredTint = tintFor(featured.slug);
  const FeaturedIcon = iconFor(featured.slug);
  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <SectionHeader title="Explorez Winstorr" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:auto-rows-[130px]">
        <Link
          to="/catalogue"
          search={searchFor(featured) as never}
          className={cn(
            "group relative col-span-2 row-span-2 flex flex-col justify-between rounded-sm p-4 no-link-color overflow-hidden",
            featuredTint.tile,
          )}
        >
          <FeaturedIcon className="h-6 w-6 opacity-90" strokeWidth={2} />
          <div>
            <div className="text-base font-bold leading-tight">{featured.name}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium opacity-90">
              Explorer <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>
        {rest.map((c) => {
          const Icon = iconFor(c.slug);
          const tint = tintFor(c.slug);
          return (
            <Link
              key={c.id}
              to="/catalogue"
              search={searchFor(c) as never}
              className={cn(
                "group flex flex-col justify-between rounded-sm p-3 no-link-color overflow-hidden",
                tint.tile,
              )}
            >
              <Icon className="h-5 w-5 opacity-90" strokeWidth={2} />
              <div>
                <div className="text-[13px] font-bold leading-tight">{c.name}</div>
                <div className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium opacity-90">
                  Explorer <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* Spotlight */

function Spotlight({ p }: { p: MiniProduct | null }) {
  if (!p) return null;
  const img = p.images?.[0];
  return (
    <div className="rounded-sm border border-border bg-card p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">En vedette</h3>
        <QualityBadge />
      </div>
      <Link to="/produits/$slug" params={{ slug: p.slug }} className="group grid gap-3 no-link-color sm:grid-cols-[minmax(0,180px)_1fr] items-center">
        <div className="aspect-square overflow-hidden rounded-sm bg-muted border border-border">
          {img && (
            <img
              src={imageAtWidth(img, 360) || img}
              alt={p.name}
              loading="lazy"
              width={360}
              height={360}
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] text-muted-foreground">Sélection Wintek</div>
          <div className="mt-1 line-clamp-3 text-base font-semibold text-foreground leading-snug">{p.name}</div>
          <div className="mt-2 text-xl font-bold text-accent">
            {displayPrice({ price: p.price, price_type: p.price_type })}
          </div>
          {(p.rating_count ?? 0) > 0 && (
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              {Number(p.rating_average ?? 0).toFixed(1)} · {p.rating_count} avis
            </div>
          )}
          <span className="mt-3 inline-flex items-center gap-1 rounded-sm bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
            Voir le produit <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </div>
  );
}

/* Circular category row — dynamic from top-level categories with products */

function CircleRow({ cats }: { cats: RootCategory[] }) {
  if (cats.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <div className="rounded-sm border border-border bg-[color-mix(in_oklab,var(--accent)_5%,var(--background))] p-4">
        <SectionHeader title="Nos catégories" />
        <div className="-mx-1 flex gap-4 overflow-x-auto scrollbar-thin px-1 pb-1">
          {cats.map((c) => {
            const Icon = iconFor(c.slug);
            return (
              <Link
                key={c.id}
                to="/catalogue"
                search={searchFor(c) as never}
                className="group flex w-[92px] shrink-0 flex-col items-center gap-1.5 no-link-color"
              >
                <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-background border-2 border-border text-primary transition-colors group-hover:border-secondary">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <div className="text-[11px] font-medium text-foreground text-center leading-tight">{c.name}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -------------------- page -------------------- */

function Home() {
  const { data } = useSuspenseQuery(homeShelvesQuery);
  const cats = data.rootsWithProducts;

  // Order shelves: put larger categories first for immediate density.
  const catShelves = cats
    .slice()
    .sort((a, b) => b.products.length - a.products.length);

  const banners = data.banners ?? [];
  const heroSlides = banners.filter((b) => b.type === "hero_slide");
  const dbPromo = banners.filter((b) => b.type === "promo_tile");
  const dbCategoryTiles = banners.filter((b) => b.type === "category_tile");

  return (
    <div className="bg-background">
      <Hero dbSlides={heroSlides} />
      <TrustStrip />

      {/* Primary promo mosaic */}
      <section className="mx-auto max-w-7xl px-4 pt-5">
        <PromoTiles tiles={PRIMARY_PROMO} dbTiles={dbPromo} />
      </section>

      {/* Category mosaic — dynamic */}
      <CategoryMosaic cats={cats} dbTiles={dbCategoryTiles} />


      {/* Nouveautés */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <SectionHeader title="Nouveautés" to="/catalogue" search={{ sort: "recent" }} />
        <Shelf items={data.nouveautes} />
      </section>

      {/* Per-category best sellers — one shelf per top-level category with products */}
      {catShelves.map((c) => (
        <section key={c.id} className="mx-auto max-w-7xl px-4 pt-6">
          <SectionHeader
            title={`Meilleures ventes — ${c.name}`}
            to="/catalogue"
            search={searchFor(c)}
          />
          <Shelf items={c.products.slice(0, 12)} />
        </section>
      ))}

      {/* Circular category row */}
      <CircleRow cats={cats} />

      {/* Les mieux notés + Spotlight */}
      <section className="mx-auto max-w-7xl px-4 pt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0">
          <SectionHeader title="Les mieux notés" to="/catalogue" search={{ sort: "rating" }} />
          <Shelf items={data.topRated} />
        </div>
        <Spotlight p={data.spotlight} />
      </section>

      {/* Qualité vérifiée */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <SectionHeader title="Qualité vérifiée par Wintek" to="/catalogue" search={{ verified: true }} />
        <Shelf items={data.verified} />
      </section>

      {/* Boutiques populaires — gated ≥6 vendors with products */}
      <PopularStoresShelf />

      <div className="mx-auto max-w-7xl px-4 pt-8">

        <RecentlyViewedShelf />
      </div>
    </div>
  );
}

/* Popular stores shelf — gated to ≥6 vendors with active products.
   Uses a separate lightweight query so it doesn't block the main homepage. */
const popularStoresQuery = queryOptions({
  queryKey: ["home-popular-stores-v1"],
  queryFn: async () => {
    const [vendorsRes, productsRes] = await Promise.all([
      supabaseClient
        .from("vendors")
        .select("id, slug, name, type, logo_url, description, boost_score, pinned_until, created_at")
        .eq("status", "active"),
      supabaseClient.from("products").select("vendor_id, rating_count, rating_average").eq("status", "active"),
    ]);
    if (vendorsRes.error) throw vendorsRes.error;
    if (productsRes.error) throw productsRes.error;
    const stats = new Map<string, { count: number; ratingSum: number; ratingCountSum: number }>();
    for (const p of productsRes.data ?? []) {
      if (!p.vendor_id) continue;
      const s = stats.get(p.vendor_id) ?? { count: 0, ratingSum: 0, ratingCountSum: 0 };
      s.count += 1;
      const rc = Number(p.rating_count ?? 0);
      s.ratingSum += Number(p.rating_average ?? 0) * rc;
      s.ratingCountSum += rc;
      stats.set(p.vendor_id, s);
    }
    const withProducts = (vendorsRes.data ?? []).filter((v) => (stats.get(v.id)?.count ?? 0) > 0);
    return withProducts
      .map((v) => {
        const s = stats.get(v.id)!;
        return {
          id: v.id,
          slug: v.slug,
          name: v.name,
          type: v.type as "internal" | "external",
          logo_url: v.logo_url as string | null,
          description: v.description as string | null,
          boost_score: Number(v.boost_score ?? 0),
          product_count: s.count,
          rating: s.ratingCountSum > 0 ? (s.ratingSum + 5 * 3.5) / (s.ratingCountSum + 5) : 3.5,
        };
      })
      .sort((a, b) => b.boost_score - a.boost_score)
      .slice(0, 10);
  },
  staleTime: 5 * 60_000,
});

function PopularStoresShelf() {
  const { data = [] } = useQuery(popularStoresQuery);
  if (data.length < 6) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <SectionHeader title="Boutiques populaires" to="/boutiques" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data.map((v) => (
          <Link
            key={v.id}
            to="/boutiques/$vendorSlug"
            params={{ vendorSlug: v.slug }}
            className="group flex items-center gap-3 rounded-sm border border-border bg-card p-3 no-link-color hover:border-secondary/60"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-sm border border-border bg-background text-primary">
              {v.logo_url ? (
                <img src={v.logo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <StoreIcon className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <div className="truncate text-sm font-bold text-foreground group-hover:text-secondary">{v.name}</div>
                {v.type === "internal" && <ShieldCheckIcon className="h-3 w-3 shrink-0 text-secondary" />}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                ★ {v.rating.toFixed(1)} · {v.product_count} produit{v.product_count > 1 ? "s" : ""}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}


/* Silence unused imports typecheck (kept for potential reuse) */
void formatFcfa;
void useQuery;
void Truck;
