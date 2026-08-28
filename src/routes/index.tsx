import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RecentlyViewedShelf } from "@/components/recently-viewed-shelf";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { Store as StoreIcon, ShieldCheck as ShieldCheckIcon, Search, Heart, MessageCircle, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCart } from "@/lib/cart-context";
import { useWishlistIds, useToggleWishlist } from "@/lib/wishlist";
import { buildWaLink } from "@/lib/whatsapp";
import { useSupportWhatsApp } from "@/lib/use-support-whatsapp";
import { toast } from "sonner";


import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
import { QualityBadge, SellerVerifiedBadge } from "@/components/quality-badge";
import { displayPrice, formatFcfa, type ProductType } from "@/lib/format";
import { imageAtWidth, imageSrcSet } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { SkeletonHomepage } from "@/components/skeletons";
import { CategorySidebar, CategoryChipRow } from "@/components/category-sidebar";
import { PromoBar } from "@/components/promo-bar";
import { iconForCategory } from "@/lib/category-icons";

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
  vendor_id?: string | null;
  compare_at_price?: number | null;
  has_variants?: boolean | null;
  stock_quantity?: number | null;
  min_order_quantity?: number | null;
  vendor?: { name: string; slug: string | null; city: string | null; verified: boolean | null } | null;
  product_price_tiers?: { unit_price: number }[] | null;
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
  "id, slug, name, images, price, price_type, rating_average, rating_count, quality_verified, type, category_id, vendor_id, compare_at_price, has_variants, stock_quantity, min_order_quantity, vendor:vendors(name, slug, city, verified), product_price_tiers(unit_price)";

function normalize(rows: unknown[]): MiniProduct[] {
  return (rows as MiniProduct[]).map((p) => ({
    ...p,
    images: Array.isArray(p.images) ? (p.images as string[]) : [],
  }));
}

/**
 * Strict round-robin between vendors: best product of vendor A, then B, then C,
 * then 2nd best of A, etc. Incoming order defines "best" within each vendor,
 * and vendor turn order follows the quality of their top product.
 */
function interleaveByVendor(items: MiniProduct[], limit?: number): MiniProduct[] {
  const groups = new Map<string, MiniProduct[]>();
  const order: string[] = [];
  for (const p of items) {
    const key = p.vendor_id ?? `__none__${p.id}`;
    const g = groups.get(key);
    if (g) g.push(p);
    else {
      groups.set(key, [p]);
      order.push(key);
    }
  }
  const queues = order.map((k) => groups.get(k)!);
  const out: MiniProduct[] = [];
  let round = 0;
  while (out.length < items.length) {
    let pushed = false;
    for (const q of queues) {
      if (round < q.length) {
        out.push(q[round]);
        pushed = true;
        if (limit && out.length >= limit) return out;
      }
    }
    if (!pushed) break;
    round += 1;
  }
  return limit ? out.slice(0, limit) : out;
}

const homeShelvesQuery = queryOptions({
  queryKey: ["home-shelves-v4"],
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
      // Quality still decides WHICH product of each vendor shows first,
      // but vendors alternate strictly (round-robin).
      return { ...r, descendantIds, products: interleaveByVendor(rootProducts) };
    });

    const rootsWithProducts = rootCats.filter((c) => c.products.length > 0);

    // Generic shelves
    const nouveautesRes = await supabase
      .from("products")
      .select(BASE_SELECT)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(60);
    if (nouveautesRes.error) throw nouveautesRes.error;
    const nouveautes = interleaveByVendor(normalize(nouveautesRes.data ?? []), 12);

    const topRatedPool = products
      .filter((p) => (p.rating_count ?? 0) > 0)
      .sort((a, b) => (b.rating_average ?? 0) - (a.rating_average ?? 0));
    const topRated = interleaveByVendor(topRatedPool, 12);

    const verifiedPool = products.filter((p) => p.quality_verified);
    const verified = interleaveByVendor(verifiedPool, 12);

    const spotlight = verifiedPool[0] ?? topRatedPool[0] ?? null;

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

    const sidebarCats = roots.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      product_type: r.product_type as string | null,
      children: (byParent.get(r.id) ?? []).map((k) => ({
        id: k.id,
        name: k.name,
        slug: k.slug,
        product_type: k.product_type as string | null,
      })),
    }));

    return {
      sidebarCats,
      rootsWithProducts,
      nouveautes,
      topRated,
      verified,
      spotlight,
      banners,
    };
  },
});

type DbBanner = {
  id: string;
  type: "hero_slide" | "promo_tile" | "category_tile" | "hero_side";
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
  pendingComponent: SkeletonHomepage,
  pendingMs: 200,
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
  return iconForCategory(slug);
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
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="font-heading text-[17px] font-extrabold tracking-tight text-[var(--color-ink)] md:text-[20px]">
        {title}
      </h2>
      {to && (
        <Link
          to={to}
          search={search as never}
          className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-r-pill,999px)] border border-[var(--color-line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-blue-brand)] transition-colors hover:border-[var(--color-blue-brand)]"
        >
          Voir tout <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function Stars({ rating, count }: { rating: number; count: number }) {
  if (!count) return <div className="h-[14px]" />;
  return (
    <div className="flex items-center gap-1 text-[11px] text-[var(--color-muted-ink)]">
      <span className="flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            className="h-3 w-3"
            style={{
              color: "var(--color-gold)",
              fill: i < Math.round(rating) ? "var(--color-gold)" : "transparent",
            }}
            strokeWidth={2}
          />
        ))}
      </span>
      <span>({count})</span>
    </div>
  );
}

function MiniCard({ p }: { p: MiniProduct }) {
  const img = p.images?.[0];
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cart = useCart();
  const { data: wishlistIds } = useWishlistIds();
  const toggle = useToggleWishlist();
  const wished = wishlistIds?.has(p.id) ?? false;

  const hasDiscount = !!(p.compare_at_price && p.price && p.compare_at_price > p.price);
  const discountPct = hasDiscount
    ? Math.round(((p.compare_at_price! - p.price!) / p.compare_at_price!) * 100)
    : 0;

  const tierPrices = (p.product_price_tiers ?? []).map((t) => Number(t.unit_price)).filter((n) => n > 0);
  const priceValues = p.price != null ? [...tierPrices, Number(p.price)] : tierPrices;
  const lo = priceValues.length ? Math.min(...priceValues) : null;
  const hi = priceValues.length ? Math.max(...priceValues) : null;
  const showRange = p.price_type === "fixed" && lo != null && hi != null && lo !== hi;
  const priceLabel = showRange
    ? `${formatFcfa(lo!)} – ${formatFcfa(hi!)}`
    : displayPrice({ price: p.price, price_type: p.price_type });


  const canQuickAdd =
    p.price_type === "fixed" &&
    typeof p.price === "number" &&
    !p.has_variants &&
    (p.stock_quantity ?? 1) > 0;

  const onAdd = () => {
    if (!canQuickAdd) {
      void navigate({ to: "/produits/$slug", params: { slug: p.slug } });
      return;
    }
    cart.add(
      {
        productId: p.id,
        variantId: null,
        variantAttributes: null,
        slug: p.slug,
        name: p.name,
        price: Number(p.price),
        image: img ?? null,
      },
      Math.max(1, p.min_order_quantity ?? 1),
    );
    toast.success(t("home.addToCart"));
  };

  return (
    <div className="group relative flex w-[168px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-r)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-accent-500)] hover:shadow-[var(--shadow-lift)] sm:w-[196px]">
      <button
        type="button"
        aria-label="Liste de souhaits"
        onClick={() => toggle.mutate({ productId: p.id, wished })}
        className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full border border-[var(--color-line)] bg-white/95 text-[var(--color-muted-ink)] shadow-sm transition-colors hover:text-[var(--color-deal)]"
      >
        <Heart className="h-4 w-4" fill={wished ? "currentColor" : "none"} />
      </button>
      {hasDiscount && (
        <span
          className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
          style={{ background: "var(--color-deal)" }}
        >
          -{discountPct}%
        </span>
      )}
      <Link
        to="/produits/$slug"
        params={{ slug: p.slug }}
        className="no-link-color block"
      >
        <div className="aspect-square overflow-hidden bg-[var(--color-surface)]">
          {img ? (
            <img
              src={imageAtWidth(img, 320) || img}
              srcSet={imageSrcSet(img, [200, 320, 420])}
              sizes="200px"
              alt={p.name}
              loading="lazy"
              decoding="async"
              width={320}
              height={320}
              className="h-full w-full object-contain bg-white transition-transform duration-200 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">Sans image</div>
          )}
        </div>
        <div className="flex flex-col gap-1 p-2.5">
          {p.quality_verified && <QualityBadge className="self-start" />}
          <div className="line-clamp-2 min-h-[2.4em] text-[13px] leading-snug text-[var(--color-ink)]">{p.name}</div>
          {p.vendor?.name && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-[12px]">
              <span className="text-[var(--color-muted-ink)]">{t("common.soldBy")}</span>
              <span className="truncate font-medium text-[var(--color-ink)]">
                {p.vendor.name}
                {p.vendor.city ? ` · ${p.vendor.city}` : ""}
              </span>
              {p.vendor.verified && <SellerVerifiedBadge />}
            </div>
          )}
          {(p.rating_count ?? 0) > 0 && (
            <Stars rating={Number(p.rating_average ?? 0)} count={p.rating_count ?? 0} />
          )}
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading text-[15px] font-extrabold text-[var(--color-navy-900)]">
              {priceLabel}
            </span>
            {hasDiscount && !showRange && (
              <span className="text-[11px] text-[var(--color-muted-ink)] line-through">
                {formatFcfa(p.compare_at_price!)}
              </span>
            )}
          </div>
          {(p.min_order_quantity ?? 1) > 1 && (
            <span className="self-start rounded-sm border border-[var(--color-line)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-muted-ink)]">
              {t("trust.moq", { count: p.min_order_quantity })}
            </span>
          )}
        </div>
      </Link>
      <div className="px-2.5 pb-2.5">
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-r-sm)] px-2 py-2 text-[12px] font-bold text-white transition-colors"
          style={{ background: "var(--color-accent-500)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-600)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-accent-500)")}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          {canQuickAdd ? t("home.addToCart") : t("home.viewProduct")}
        </button>
      </div>
    </div>
  );
}

function Shelf({ items }: { items: MiniProduct[] }) {
  if (items.length === 0) {
    return <div className="rounded-[var(--radius-r)] border border-dashed border-[var(--color-line)] bg-white p-4 text-xs text-muted-foreground">Aucun produit à afficher.</div>;
  }
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto scrollbar-thin px-1 pb-2 pt-1">
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

function HeroSearch({
  popular,
  sideImage = null,
  sideAlt = "",
}: {
  popular: { label: string; slug: string }[];
  /** Optional hero side image (managed in Admin → Bannières → "Image Hero"). Recommended 700×800px. */
  sideImage?: string | null;
  sideAlt?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    void navigate({ to: "/catalogue", search: (term ? { q: term } : {}) as never });
  };

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "radial-gradient(1000px 460px at 20% -10%, var(--color-navy-700) 0%, transparent 60%), linear-gradient(160deg, var(--color-navy-900) 0%, var(--color-navy-800) 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,.55) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        className={cn(
          "relative mx-auto max-w-7xl px-4 py-10 md:py-16",
          sideImage && "lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10",
        )}
      >
        <div className="min-w-0">
        <h1 className="font-heading max-w-3xl text-[26px] font-extrabold leading-tight text-white md:text-[42px]">
          {t("home.heroTitle")}{" "}
          <span style={{ color: "var(--color-accent-500)" }}>{t("home.heroAccent")}</span>{" "}
          {t("home.heroTitleEnd")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/75 md:text-base">{t("home.heroSub")}</p>

        <form
          onSubmit={submit}
          className="mt-6 flex max-w-2xl items-center gap-2 rounded-[var(--radius-r-xl)] bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,.25)]"
        >
          <Search className="ml-2 h-4 w-4 shrink-0 text-[var(--color-muted-ink)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("home.searchPlaceholder")}
            aria-label={t("home.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted-ink)]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-[var(--radius-r-lg)] px-4 py-2 text-sm font-bold text-white"
            style={{ background: "var(--color-accent-500)" }}
          >
            <span className="hidden sm:inline">{t("common.search")}</span>
            <Search className="h-4 w-4 sm:hidden" />
          </button>
        </form>

        {popular.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
            <span>{t("home.popular")}</span>
            {popular.map((p) => (
              <Link
                key={p.slug + p.label}
                to="/catalogue"
                search={{ q: p.label } as never}
                className="no-link-color rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/90 transition-colors hover:border-[var(--color-accent-500)]"
              >
                {p.label}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/catalogue"
            className="no-link-color inline-flex items-center gap-1.5 rounded-[var(--radius-r-lg)] px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: "var(--color-accent-500)" }}
          >
            {t("home.ctaBuy")} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/devenir-vendeur"
            className="no-link-color inline-flex items-center gap-1.5 rounded-[var(--radius-r-lg)] border border-white/30 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            {t("home.ctaSell")}
          </Link>
          </div>
        </div>

        {sideImage && (
          <div aria-hidden={!sideAlt} className="hidden lg:block">
            <div className="relative w-[340px] xl:w-[420px]">
              <img
                src={sideImage}
                alt={sideAlt}
                loading="lazy"
                className="aspect-[7/8] w-full rounded-[var(--radius-r-xl)] object-cover shadow-[0_18px_50px_rgba(0,0,0,.35)]"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(to right, transparent 0%, black 22%, black 100%), linear-gradient(to bottom, black 82%, transparent 100%)",
                  maskImage:
                    "linear-gradient(to right, transparent 0%, black 22%, black 100%), linear-gradient(to bottom, black 82%, transparent 100%)",
                  WebkitMaskComposite: "source-in",
                  maskComposite: "intersect",
                }}
                onError={(e) => {
                  (e.currentTarget.parentElement?.parentElement as HTMLElement | null)?.style.setProperty(
                    "display",
                    "none",
                  );
                }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Hero({ dbSlides }: { dbSlides: DbBanner[] }) {
  const autoplay = useRef(Autoplay({ delay: 5500, stopOnInteraction: true }));
  const useDb = dbSlides.length > 0;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <Carousel
        opts={{ loop: true, align: "start" }}
        plugins={[autoplay.current]}
        className="relative overflow-hidden rounded-[var(--radius-r-lg)] shadow-[var(--shadow-soft)]"
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
  const { t } = useTranslation();
  const items = [
    { Icon: ShieldCheck, title: t("home.trustQualityTitle"), desc: t("home.trustQualitySub") },
    { Icon: Wallet, title: t("home.trustPaymentTitle"), desc: t("home.trustPaymentSub") },
    { Icon: Wrench, title: t("home.trustServiceTitle"), desc: t("home.trustServiceSub") },
    { Icon: Truck, title: t("home.trustDeliveryTitle"), desc: t("home.trustDeliverySub") },
  ];
  return (
    <section style={{ background: "var(--color-navy-800)" }}>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-4 md:grid-cols-4">
        {items.map(({ Icon, title, desc }) => (
          <div key={title} className="flex items-center gap-2.5">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-r-sm)]"
              style={{ background: "rgba(255,255,255,.08)", color: "var(--color-green-2)" }}
            >
              <Icon className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold leading-tight text-white">{title}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-white/60">{desc}</div>
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

function PromoTiles({ tiles, dbTiles = [] }: { tiles: PromoTile[]; dbTiles?: DbBanner[] }) {
  const useDb = dbTiles.length > 0;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {useDb
        ? dbTiles.map((t) => (
            <Link
              key={t.id}
              to={t.link_url ?? "/catalogue"}
              className="group relative flex min-h-[140px] flex-col justify-end overflow-hidden rounded-sm border border-border p-3.5 no-link-color"
              style={t.background_color && !t.image_url ? { background: t.background_color } : undefined}
            >
              {t.image_url && (
                <>
                  <img src={t.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                </>
              )}
              <div className="relative text-white">
                <div className="text-sm font-bold leading-tight drop-shadow">{t.title}</div>
                {t.subtitle && <div className="mt-0.5 text-xs leading-snug opacity-90 drop-shadow">{t.subtitle}</div>}
                <div className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-accent">
                  {t.cta_label ?? "Découvrir"} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))
        : tiles.map((t) => (
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

function CategoryMosaic({ cats, dbTiles = [] }: { cats: RootCategory[]; dbTiles?: DbBanner[] }) {
  if (dbTiles.length > 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <SectionHeader title="Explorez Winstorr" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {dbTiles.map((t) => (
            <Link
              key={t.id}
              to={t.link_url ?? "/catalogue"}
              className="group relative flex min-h-[140px] flex-col justify-end overflow-hidden rounded-sm no-link-color"
              style={t.background_color && !t.image_url ? { background: t.background_color } : undefined}
            >
              {t.image_url ? (
                <>
                  <img src={t.image_url} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary" />
              )}
              <div className="relative p-3 text-white">
                <div className="text-[13px] font-bold leading-tight drop-shadow">{t.title}</div>
                <div className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium opacity-90">
                  {t.cta_label ?? "Explorer"} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    );
  }
  return CategoryMosaicFallback({ cats });
}

function CategoryMosaicFallback({ cats }: { cats: RootCategory[] }) {
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
              className="h-full w-full object-contain bg-white transition-transform group-hover:scale-[1.02]"
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

/* Category grid — dynamic from top-level categories with products */

function CategoryGrid({ cats }: { cats: RootCategory[] }) {
  const { t } = useTranslation();
  if (cats.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-8">
      <SectionHeader title={t("home.categoriesTitle")} to="/catalogue" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {cats.map((c) => {
          const Icon = iconFor(c.slug);
          return (
            <Link
              key={c.id}
              to="/catalogue"
              search={searchFor(c) as never}
              className="no-link-color group flex flex-col items-center gap-2 rounded-[var(--radius-r)] border border-[var(--color-line)] bg-white p-3 text-center shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-accent-500)] hover:shadow-[var(--shadow-lift)]"
            >
              <div
                className="grid h-12 w-12 place-items-center rounded-[var(--radius-r)]"
                style={{ background: "var(--color-blue-soft)", color: "var(--color-blue-brand)" }}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="text-[12px] font-semibold leading-tight text-[var(--color-ink)]">{c.name}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* WhatsApp band */

function WhatsAppSection() {
  const { t } = useTranslation();
  const waNumber = useSupportWhatsApp();
  const href = buildWaLink(waNumber, t("home.whatsappMessage"));
  return (
    <section className="mx-auto max-w-7xl px-4 pt-10">
      <div
        className="flex flex-col items-start gap-4 rounded-[var(--radius-r-lg)] p-6 text-white md:flex-row md:items-center md:justify-between md:p-8"
        style={{ background: "linear-gradient(135deg, #128C7E 0%, #25D366 100%)" }}
      >
        <div className="max-w-2xl">
          <h2 className="font-heading text-[20px] font-extrabold leading-tight md:text-[26px]">
            {t("home.whatsappTitle")}
          </h2>
          <p className="mt-2 text-sm text-white/90">{t("home.whatsappSub")}</p>
        </div>
        <a
          href={href ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="no-link-color inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-r-lg)] bg-white px-5 py-2.5 text-sm font-bold"
          style={{ color: "#128C7E" }}
        >
          <MessageCircle className="h-4 w-4" /> {t("home.whatsappCta")}
        </a>
      </div>
    </section>
  );
}

/* Seller CTA band */

function SellerBand() {
  const { t } = useTranslation();
  const steps = [
    t("home.sellerStep1"),
    t("home.sellerStep2"),
    t("home.sellerStep3"),
    t("home.sellerStep4"),
    t("home.sellerStep5"),
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <div
        className="rounded-[var(--radius-r-lg)] p-6 text-white md:p-8"
        style={{ background: "linear-gradient(135deg, var(--color-accent-500) 0%, var(--color-accent-600) 100%)" }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-heading text-[20px] font-extrabold leading-tight md:text-[26px]">
              {t("home.sellerTitle")}
            </h2>
            <p className="mt-2 text-sm text-white/90">{t("home.sellerSub")}</p>
          </div>
          <Link
            to="/devenir-vendeur"
            className="no-link-color inline-flex w-max shrink-0 items-center gap-1.5 rounded-[var(--radius-r-lg)] bg-white px-5 py-2.5 text-sm font-bold"
            style={{ color: "var(--color-accent-600)" }}
          >
            {t("home.sellerCta")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((s, i) => (
            <li
              key={s}
              className="flex items-center gap-2 rounded-[var(--radius-r)] bg-white/15 px-3 py-2 text-[12px] font-semibold"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[11px] font-extrabold" style={{ color: "var(--color-accent-600)" }}>
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
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
  const heroSide = banners.find((b) => b.type === "hero_side" && b.image_url) ?? null;
  const dbPromo = banners.filter((b) => b.type === "promo_tile");
  const dbCategoryTiles = banners.filter((b) => b.type === "category_tile");

  const popular = (data.topRated.length ? data.topRated : data.nouveautes)
    .slice(0, 4)
    .map((p) => ({ label: p.name.length > 28 ? p.name.slice(0, 28).trim() + "…" : p.name, slug: p.slug }));

  return (
    <div className="bg-background">
      <HeroSearch popular={popular} sideImage={heroSide?.image_url ?? null} sideAlt={heroSide?.title ?? ""} />
      <TrustStrip />

      {/* Departments column + hero carousel */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <CategoryChipRow categories={data.sidebarCats} />
        <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-4">
          <CategorySidebar categories={data.sidebarCats} />
          <div className="min-w-0 [&>section]:mx-0 [&>section]:max-w-none [&>section]:px-0 [&>section]:pt-0">
            <Hero dbSlides={heroSlides} />
          </div>
        </div>
      </section>

      <PromoBar />

      {/* Category grid — real categories */}
      <CategoryGrid cats={cats} />

      {/* Primary promo mosaic */}
      <section className="mx-auto max-w-7xl px-4 pt-8">
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

      <WhatsAppSection />
      <SellerBand />

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-8">

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
  const { t } = useTranslation();
  const { data = [] } = useQuery(popularStoresQuery);
  if (data.length < 6) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-10">
      <SectionHeader title={t("home.storesTitle")} to="/boutiques" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data.map((v) => (
          <Link
            key={v.id}
            to="/boutiques/$vendorSlug"
            params={{ vendorSlug: v.slug }}
            className="no-link-color group flex flex-col overflow-hidden rounded-[var(--radius-r)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-accent-500)] hover:shadow-[var(--shadow-lift)]"
          >
            <div
              className="h-12 w-full"
              style={{ background: "linear-gradient(120deg, var(--color-navy-900), var(--color-blue-brand))" }}
            />
            <div className="-mt-6 flex flex-col items-center px-3 pb-3 text-center">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border-2 border-white bg-[var(--color-surface)] text-[var(--color-navy-900)] shadow-sm">
                {v.logo_url ? (
                  <img src={v.logo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <StoreIcon className="h-5 w-5" />
                )}
              </div>
              <div className="mt-2 flex items-center gap-1">
                <div className="truncate text-sm font-bold text-[var(--color-ink)]">{v.name}</div>
                {v.type === "internal" && (
                  <ShieldCheckIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-green-brand)" }} />
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--color-muted-ink)]">
                <span style={{ color: "var(--color-gold)" }}>★</span> {v.rating.toFixed(1)} ·{" "}
                {t("home.productsCount", { count: v.product_count })}
              </div>
              <span
                className="mt-2.5 inline-flex w-full items-center justify-center rounded-[var(--radius-r-sm)] border px-3 py-1.5 text-[12px] font-bold transition-colors"
                style={{ borderColor: "var(--color-line)", color: "var(--color-blue-brand)" }}
              >
                {t("home.viewStore")}
              </span>
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
