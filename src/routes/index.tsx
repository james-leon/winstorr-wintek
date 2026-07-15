import { createFileRoute, Link } from "@tanstack/react-router";
import { RecentlyViewedShelf } from "@/components/recently-viewed-shelf";

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
} from "lucide-react";
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

const BASE_SELECT =
  "id, slug, name, images, price, price_type, rating_average, rating_count, quality_verified, type, category_id";

function normalize(rows: unknown[]): MiniProduct[] {
  return (rows as MiniProduct[]).map((p) => ({
    ...p,
    images: Array.isArray(p.images) ? (p.images as string[]) : [],
  }));
}

const homeShelvesQuery = queryOptions({
  queryKey: ["home-shelves-v2"],
  queryFn: async () => {
    const cats = await supabase
      .from("categories")
      .select("id, name, slug, product_type, parent_id, display_order")
      .eq("status", "active")
      .order("display_order");
    if (cats.error) throw cats.error;

    const catBySlug = new Map<string, { id: string; name: string }>();
    for (const c of cats.data ?? []) catBySlug.set(c.slug, { id: c.id, name: c.name });

    const phonesId = catBySlug.get("telephones")?.id;
    const laptopsId = catBySlug.get("ordinateurs")?.id;

    const results = await Promise.all([
      // Nouveautés
      supabase.from("products").select(BASE_SELECT).eq("status", "active")
        .order("created_at", { ascending: false }).limit(12),
      // Mieux notés
      supabase.from("products").select(BASE_SELECT).eq("status", "active")
        .gt("rating_count", 0)
        .order("rating_average", { ascending: false })
        .order("rating_count", { ascending: false }).limit(12),
      // Qualité vérifiée
      supabase.from("products").select(BASE_SELECT).eq("status", "active")
        .eq("quality_verified", true)
        .order("rating_count", { ascending: false }).limit(12),
      // Téléphones
      phonesId
        ? supabase.from("products").select(BASE_SELECT).eq("status", "active").eq("category_id", phonesId)
            .order("rating_count", { ascending: false }).order("created_at", { ascending: false }).limit(12)
        : Promise.resolve({ data: [], error: null } as never),
      // Ordinateurs
      laptopsId
        ? supabase.from("products").select(BASE_SELECT).eq("status", "active").eq("category_id", laptopsId)
            .order("rating_count", { ascending: false }).order("created_at", { ascending: false }).limit(12)
        : Promise.resolve({ data: [], error: null } as never),
      // Formations à venir — training products, most recent
      supabase.from("products").select(BASE_SELECT).eq("status", "active").eq("type", "training")
        .order("created_at", { ascending: false }).limit(12),
      // Categories full list (for mosaic + circular)
      Promise.resolve({ data: cats.data, error: null }),
    ]);

    for (const r of results) if ("error" in r && r.error) throw r.error;

    const [nouv, topRated, verified, phones, laptops, trainings] = results;

    // Spotlight = first quality_verified with highest rating, else first top-rated
    const verifiedList = normalize(verified.data ?? []);
    const topList = normalize(topRated.data ?? []);
    const spotlight =
      verifiedList.find((p) => (p.rating_count ?? 0) > 0) ??
      verifiedList[0] ??
      topList[0] ??
      null;

    return {
      categories: (cats.data ?? []) as {
        id: string; name: string; slug: string; product_type: ProductType;
        parent_id: string | null; display_order: number;
      }[],
      nouveautes: normalize(nouv.data ?? []),
      topRated: topList,
      verified: verifiedList,
      phones: normalize(phones.data ?? []),
      laptops: normalize(laptops.data ?? []),
      trainings: normalize(trainings.data ?? []),
      spotlight,
    };
  },
});

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

function Hero() {
  const autoplay = useRef(Autoplay({ delay: 5500, stopOnInteraction: true }));
  return (
    <section className="bg-primary">
      <Carousel
        opts={{ loop: true, align: "start" }}
        plugins={[autoplay.current]}
        className="relative"
      >
        <CarouselContent>
          {SLIDES.map((s, i) => (
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
  Icon: typeof Tag;
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

const SECONDARY_PROMO: PromoTile[] = [
  {
    title: "Nouveau : Installation Starlink",
    sub: "Devis rapide, intervention sous 72 h.",
    Icon: Sparkles,
    tint: "bg-secondary/5",
    ring: "border-secondary/30 hover:border-secondary/60",
    iconTint: "bg-secondary/15 text-secondary",
    to: "/catalogue",
    search: { type: "service" as ProductType, category: "installation-securite" },
  },
  {
    title: "Ordinateurs & bureau",
    sub: "Laptops i5/i7, périphériques certifiés.",
    Icon: Laptop,
    tint: "bg-primary/5",
    ring: "border-primary/25 hover:border-primary/50",
    iconTint: "bg-primary/10 text-primary",
    to: "/catalogue",
    search: { type: "physical" as ProductType, category: "ordinateurs" },
  },
  {
    title: "Logiciels & abonnements",
    sub: "Antivirus, SaaS, licences officielles.",
    Icon: Download,
    tint: "bg-success/5",
    ring: "border-success/30 hover:border-success/60",
    iconTint: "bg-success/15 text-success",
    to: "/catalogue",
    search: { type: "digital" as ProductType },
  },
];

/* Category mosaic — 4 large type tiles + smaller subcategory tiles */

const TYPE_TILES: {
  type: ProductType; label: string; Icon: typeof Cpu; className: string;
}[] = [
  { type: "physical", label: "Produits physiques", Icon: Cpu, className: "col-span-2 row-span-2 bg-gradient-to-br from-primary to-secondary text-primary-foreground" },
  { type: "training", label: "Formations", Icon: GraduationCap, className: "col-span-2 bg-gradient-to-br from-accent/90 to-accent text-accent-foreground" },
  { type: "digital", label: "Numérique", Icon: Download, className: "bg-gradient-to-br from-success/85 to-success text-primary-foreground" },
  { type: "service", label: "Services", Icon: Wrench, className: "bg-gradient-to-br from-secondary to-primary text-primary-foreground" },
];

const SUB_TILES: { slug: string; label: string; Icon: typeof Smartphone; type: ProductType }[] = [
  { slug: "telephones", label: "Téléphones", Icon: Smartphone, type: "physical" },
  { slug: "ordinateurs", label: "Ordinateurs", Icon: Laptop, type: "physical" },
  { slug: "audio", label: "Audio", Icon: Headphones, type: "physical" },
  { slug: "securite", label: "Sécurité", Icon: Camera, type: "physical" },
];

function CategoryMosaic() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <SectionHeader title="Explorez Winstorr" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:auto-rows-[130px]">
        {TYPE_TILES.map((t) => (
          <Link
            key={t.type}
            to="/catalogue"
            search={{ type: t.type }}
            className={cn(
              "group relative flex flex-col justify-between rounded-sm p-4 no-link-color overflow-hidden",
              t.className,
            )}
          >
            <t.Icon className="h-6 w-6 opacity-90" strokeWidth={2} />
            <div>
              <div className="text-base font-bold leading-tight">{t.label}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium opacity-90">
                Explorer <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        ))}
        {SUB_TILES.map((s) => (
          <Link
            key={s.slug}
            to="/catalogue"
            search={{ type: s.type, category: s.slug }}
            className="group flex items-center gap-2.5 rounded-sm border border-border bg-card px-3 py-3 no-link-color hover:border-secondary/60"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-muted text-primary">
              <s.Icon className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground truncate">{s.label}</div>
              <div className="text-[11px] text-muted-foreground">Voir la catégorie</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* Subcategory 2x2 grid block */

function SubcategoryBlock({
  title,
  type,
  entries,
}: {
  title: string;
  type: ProductType;
  entries: { slug: string; label: string; Icon: typeof Smartphone }[];
}) {
  return (
    <div className="rounded-sm border border-border bg-card p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <Link to="/catalogue" search={{ type }} className="text-xs font-medium text-secondary hover:underline inline-flex items-center gap-0.5">
          Voir plus <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {entries.map((e) => (
          <Link
            key={e.slug}
            to="/catalogue"
            search={{ type, category: e.slug }}
            className="group flex flex-col items-start gap-1.5 rounded-sm border border-border bg-background p-2.5 no-link-color hover:border-secondary/60"
          >
            <div className="grid h-10 w-10 place-items-center rounded-sm bg-muted text-primary">
              <e.Icon className="h-5 w-5" />
            </div>
            <div className="text-[12px] font-medium text-foreground leading-snug">{e.label}</div>
          </Link>
        ))}
      </div>
    </div>
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

/* Circular category row */

const CIRCLE_CATS: { slug?: string; type: ProductType; label: string; Icon: typeof Cpu }[] = [
  { type: "physical", label: "Électronique", Icon: Cpu },
  { type: "physical", slug: "telephones", label: "Téléphones", Icon: Smartphone },
  { type: "physical", slug: "ordinateurs", label: "Ordinateurs", Icon: Laptop },
  { type: "physical", slug: "audio", label: "Audio", Icon: Headphones },
  { type: "physical", slug: "securite", label: "Sécurité", Icon: Camera },
  { type: "digital", label: "Numérique", Icon: Download },
  { type: "service", label: "Services", Icon: Wrench },
  { type: "training", label: "Formations", Icon: GraduationCap },
];

function CircleRow() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <div className="rounded-sm border border-border bg-[color-mix(in_oklab,var(--accent)_5%,var(--background))] p-4">
        <SectionHeader title="Vendu et garanti par Wintek" />
        <div className="-mx-1 flex gap-4 overflow-x-auto scrollbar-thin px-1 pb-1">
          {CIRCLE_CATS.map((c) => (
            <Link
              key={`${c.type}-${c.slug ?? "root"}`}
              to="/catalogue"
              search={c.slug ? { type: c.type, category: c.slug } : { type: c.type }}
              className="group flex w-[86px] shrink-0 flex-col items-center gap-1.5 no-link-color"
            >
              <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-background border-2 border-border text-primary transition-colors group-hover:border-secondary">
                <c.Icon className="h-6 w-6" strokeWidth={2} />
              </div>
              <div className="text-[11px] font-medium text-foreground text-center leading-tight">{c.label}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- page -------------------- */

function Home() {
  const { data } = useSuspenseQuery(homeShelvesQuery);

  return (
    <div className="bg-background">
      <Hero />
      <TrustStrip />

      {/* Primary promo mosaic */}
      <section className="mx-auto max-w-7xl px-4 pt-5">
        <PromoTiles tiles={PRIMARY_PROMO} />
      </section>

      {/* Category mosaic */}
      <CategoryMosaic />

      {/* Shelf 1 — Téléphones */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <SectionHeader
          title="Meilleures ventes — Téléphones"
          to="/catalogue"
          search={{ type: "physical", category: "telephones" }}
        />
        <Shelf items={data.phones} />
      </section>

      {/* Shelf 2 — Nouveautés */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <SectionHeader title="Nouveautés" to="/catalogue" search={{ sort: "recent" }} />
        <Shelf items={data.nouveautes} />
      </section>

      {/* Subcategory grid + Spotlight side by side */}
      <section className="mx-auto max-w-7xl px-4 pt-6 grid gap-3 md:grid-cols-2">
        <SubcategoryBlock
          title="Explorez Électronique"
          type="physical"
          entries={[
            { slug: "telephones", label: "Téléphones", Icon: Smartphone },
            { slug: "ordinateurs", label: "Ordinateurs", Icon: Laptop },
            { slug: "audio", label: "Audio", Icon: Headphones },
            { slug: "securite", label: "Sécurité", Icon: Camera },
          ]}
        />
        <Spotlight p={data.spotlight} />
      </section>

      {/* Shelf 3 — Ordinateurs */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <SectionHeader
          title="Meilleures ventes — Ordinateurs"
          to="/catalogue"
          search={{ type: "physical", category: "ordinateurs" }}
        />
        <Shelf items={data.laptops} />
      </section>

      {/* Shelf 4 — Les mieux notés */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <SectionHeader title="Les mieux notés" to="/catalogue" search={{ sort: "rating" }} />
        <Shelf items={data.topRated} />
      </section>

      {/* Circular category row */}
      <CircleRow />

      {/* Shelf 5 — Qualité vérifiée */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <SectionHeader title="Qualité vérifiée par Wintek" to="/catalogue" search={{ verified: true }} />
        <Shelf items={data.verified} />
      </section>

      {/* Shelf 6 — Formations à venir */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <SectionHeader title="Formations à venir" to="/catalogue" search={{ type: "training" }} />
        <Shelf items={data.trainings} />
      </section>

      {/* Secondary promo mosaic */}
      <section className="mx-auto max-w-7xl px-4 pt-8 pb-10">
        <SectionHeader title="À découvrir aussi" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SECONDARY_PROMO.map((t) => (
            <Link
              key={t.title}
              to={t.to}
              search={t.search as never}
              className={cn(
                "group flex min-h-[130px] flex-col justify-between rounded-sm border p-3.5 no-link-color transition-colors",
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
      </section>
      <div className="mx-auto max-w-7xl px-4">
        <RecentlyViewedShelf />
      </div>
    </div>
  );

}

/* Silence unused imports typecheck (kept for potential reuse) */
void formatFcfa;
void useQuery;
void Truck;
