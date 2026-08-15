import { PublicRouteError } from "@/components/public-route-error";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { pushRecentlyViewed } from "@/lib/recently-viewed";
import { RecentlyViewedShelf } from "@/components/recently-viewed-shelf";

import { toast } from "sonner";
import { ChevronLeft, ChevronRight, MapPin, Calendar, Clock, Package, Download, ShieldCheck, Truck, BadgeCheck, Heart, Store, MessageCircleQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { useWishlistIds, useToggleWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { imageAtWidth, imageSrcSet } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TypeBadge } from "@/components/type-badge";
import { StarRating } from "@/components/star-rating";
import { QualityBadge, VendorLine } from "@/components/quality-badge";
import { displayPrice, formatFcfa, type ProductType } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useProductTiers, resolveUnitPrice, type PriceTier } from "@/lib/tiers";
import { useProductVariants, extractAttributeOptions, findVariantByAttrs, isValueAvailable, type Variant } from "@/lib/variants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FinancingOffer } from "@/components/financing-offer";
import { SkeletonListRows, SkeletonProductDetail } from "@/components/skeletons";


type Product = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  images: string[];
  type: ProductType;
  price: number | null;
  price_type: "fixed" | "starting_at" | "quote_only";
  compare_at_price: number | null;
  stock_quantity: number | null;
  min_order_quantity: number;
  has_variants: boolean;
  delivery_type: "file_download" | "license_key" | "access_link" | null;
  delivery_instructions: string | null;
  service_area: "on_site" | "in_shop" | "remote" | "both" | null;
  estimated_duration: string | null;
  delivery_mode: "in_person" | "online" | "hybrid" | null;
  rating_average: number;
  rating_count: number;
  quality_verified: boolean;
  warranty_duration: string | null;
  source_type: "direct_import" | "authorized_wholesaler" | "other" | null;
  category_id: string | null;

  vendor: { id: string; name: string; slug: string; type: "internal" | "external"; allow_financing: boolean; logo_url: string | null; contact_phone: string | null; city: string | null; verified: boolean | null; sales_count: number | null; created_at: string | null } | null;
  category: { name: string; slug: string } | null;
};

const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async (): Promise<Product> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, short_description, description, images, type, price, price_type, compare_at_price, stock_quantity, min_order_quantity, has_variants, delivery_type, delivery_instructions, service_area, estimated_duration, delivery_mode, rating_average, rating_count, quality_verified, warranty_duration, source_type, category_id, vendor:vendors(id, name, slug, type, allow_financing, logo_url, contact_phone, city, verified, sales_count, created_at), category:categories(name, slug)")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return { ...data, images: Array.isArray(data.images) ? (data.images as string[]) : [] } as Product;

    },
  });

export const Route = createFileRoute("/produits/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productQuery(params.slug)),
  pendingComponent: SkeletonProductDetail,
  pendingMs: 200,
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Produit — Winstorr" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData;
    const priceLabel = p.price ? `${formatFcfa(p.price)}` : "sur devis";
    const desc = p.short_description ?? `${p.name} — disponible sur Winstorr, la marketplace tech du Cameroun.`;
    const canonical = `/produits/${params.slug}`;
    const img = p.images[0];

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      description: desc,
      sku: p.id,
      ...(img ? { image: [img] } : {}),
      ...(p.vendor ? { brand: { "@type": "Brand", name: p.vendor.name } } : {}),
    };
    if (p.price != null) {
      jsonLd.offers = {
        "@type": "Offer",
        price: String(p.price),
        priceCurrency: "XAF",
        availability:
          p.stock_quantity != null && p.stock_quantity <= 0
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
        url: canonical,
      };
    }
    if (p.rating_count > 0) {
      jsonLd.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: p.rating_average,
        reviewCount: p.rating_count,
      };
    }

    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "/" },
        { "@type": "ListItem", position: 2, name: "Catalogue", item: "/catalogue" },
        { "@type": "ListItem", position: 3, name: p.name, item: canonical },
      ],
    };

    return {
      meta: [
        { title: `${p.name} — ${priceLabel} | Winstorr` },
        { name: "description", content: desc },
        { property: "og:title", content: p.name },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: canonical },
        ...(img ? [{ property: "og:image" as const, content: img }] : []),
        ...(img ? [{ name: "twitter:image" as const, content: img }] : []),
        { property: "product:price:amount", content: p.price != null ? String(p.price) : "" },
        { property: "product:price:currency", content: "XAF" },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(jsonLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
      ],
    };
  },
  component: ProductDetail,
  errorComponent: ({ error }) => (
    <PublicRouteError error={error} title="Impossible de charger ce produit" />
  ),

  notFoundComponent: () => (
    <div className="p-16 text-center">
      <h1 className="font-display text-3xl">Produit introuvable</h1>
      <p className="mt-2 text-muted-foreground">Ce produit n'existe pas ou n'est plus disponible.</p>
      <Button asChild className="mt-6"><Link to="/catalogue">Retour au catalogue</Link></Button>
    </div>
  ),
});


const SOURCE_LABELS: Record<NonNullable<Product["source_type"]>, string> = {
  direct_import: "Import direct",
  authorized_wholesaler: "Grossiste agréé",
  other: "Autre origine",
};

function ProductDetail() {
  const { slug } = Route.useParams();
  const { data: p } = useSuspenseQuery(productQuery(slug));
  const { t } = useTranslation();

  useEffect(() => {
    if (p?.id) pushRecentlyViewed(p.id);
  }, [p?.id]);

  return (
    <div className="pb-24 lg:pb-10">
      {/* Breadcrumb */}
      <nav className="mx-auto max-w-7xl px-4 pt-4 text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="/" className="hover:underline">{t("pdp.home")}</Link></li>
          <li aria-hidden><ChevronRight className="h-3 w-3" /></li>
          <li>
            {p.category ? (
              <Link to="/catalogue" search={{ category: p.category.slug } as never} className="hover:underline">
                {p.category.name}
              </Link>
            ) : (
              <Link to="/catalogue" className="hover:underline">{t("pdp.catalog")}</Link>
            )}
          </li>
          <li aria-hidden><ChevronRight className="h-3 w-3" /></li>
          <li className="truncate max-w-[55vw] font-medium text-[var(--color-ink)]">{p.name}</li>
        </ol>
      </nav>

      <div className="mx-auto mt-4 max-w-7xl px-4">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,46%)_minmax(0,1fr)]">
          <Gallery p={p} />
          <InfoColumn p={p} />
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-7xl space-y-8 px-4">
        {p.description && (
          <Panel title={t("pdp.description")}>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{p.description}</div>
          </Panel>
        )}

        <QuestionsSection productId={p.id} />

        <ReviewsSection productId={p.id} rating={Number(p.rating_average)} count={p.rating_count} />

        <SimilarProducts categoryId={p.category_id} excludeId={p.id} />
        {p.vendor && <SameShopProducts vendorId={p.vendor.id} vendorName={p.vendor.name} excludeId={p.id} />}
        {p.vendor && <VendorCard vendor={p.vendor} />}

        <RecentlyViewedShelf excludeId={p.id} />
      </div>

      <MobileBuyBar p={p} />
    </div>
  );
}

/* -------------------- primitives -------------------- */

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-r-lg)] border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-heading text-[17px] font-extrabold tracking-tight text-[var(--color-ink)] md:text-[20px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* -------------------- gallery -------------------- */

function Gallery({ p }: { p: Product }) {
  const [activeImg, setActiveImg] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const src = p.images[activeImg];

  return (
    <div className="lg:sticky lg:top-24 self-start">
      <div
        className="relative aspect-square overflow-hidden rounded-[var(--radius-r-lg)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        {src ? (
          <img
            src={imageAtWidth(src, 800) || src}
            srcSet={imageSrcSet(src, [400, 600, 800, 1200])}
            sizes="(min-width: 1024px) 560px, 100vw"
            alt={p.name}
            fetchPriority="high"
            decoding="async"
            width={800}
            height={800}
            className="h-full w-full bg-white object-contain transition-transform duration-200"
            style={zoom ? { transform: "scale(1.8)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-muted-foreground">Pas d'image</div>
        )}

        {p.quality_verified && (
          <div className="absolute left-3 top-3">
            <QualityBadge size="md" />
          </div>
        )}
      </div>

      {p.images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          {p.images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveImg(i)}
              aria-label={`Image ${i + 1}`}
              className={cn(
                "h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-r-sm)] border-2 bg-white transition",
                i === activeImg
                  ? "border-[var(--color-accent-500)] shadow-[var(--shadow-soft)]"
                  : "border-[var(--color-line)] hover:border-[var(--color-blue-brand)]",
              )}
            >
              <img src={imageAtWidth(img, 200) || img} alt="" loading="lazy" className="h-full w-full bg-white object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- right column -------------------- */

function InfoColumn({ p }: { p: Product }) {
  const { t } = useTranslation();
  const waMessage = `Bonjour, je suis intéressé(e) par « ${p.name} » sur Winstorr (https://winstorr.com/produits/${p.slug}).`;

  return (
    <div className="min-w-0" id="buy">
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeBadge type={p.type} />
        {p.warranty_duration && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-white px-2 py-0.5 text-[11px] font-medium text-foreground/80">
            <BadgeCheck className="h-3 w-3 text-[var(--color-blue-brand)]" /> Garantie {p.warranty_duration}
          </span>
        )}
        {p.source_type && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-white px-2 py-0.5 text-[11px] font-medium text-foreground/80">
            <Truck className="h-3 w-3" /> {SOURCE_LABELS[p.source_type]}
          </span>
        )}
      </div>

      <h1 className="mt-2.5 font-heading text-[22px] font-extrabold leading-tight tracking-tight text-[var(--color-navy-900)] md:text-[28px]">
        {p.name}
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {p.rating_count > 0 ? (
          <StarRating rating={Number(p.rating_average)} count={p.rating_count} size="md" />
        ) : (
          <span className="rounded-full bg-[var(--color-blue-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-blue-brand)]">
            {t("pdp.newProduct")}
          </span>
        )}
        {p.vendor && (
          <Link
            to="/boutiques/$vendorSlug"
            params={{ vendorSlug: p.vendor.slug }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-blue-brand)] no-link-color hover:underline"
          >
            <Store className="h-3.5 w-3.5" />
            {t("pdp.soldBy")} {p.vendor.name}
            <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-green-brand)]" />
          </Link>
        )}
      </div>

      {p.short_description && <p className="mt-3 text-sm leading-relaxed text-foreground/80">{p.short_description}</p>}

      <div className="mt-5 rounded-[var(--radius-r-lg)] border border-[var(--color-line)] bg-white p-4 shadow-[var(--shadow-soft)] md:p-5">
        <BuyBox p={p} />
      </div>

      {/* Delivery / pickup */}
      <div className="mt-4 rounded-[var(--radius-r-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-blue-brand)]" />
          <div className="text-xs leading-relaxed">
            <div className="text-sm font-semibold text-[var(--color-ink)]">{t("pdp.pickupTitle")}</div>
            <p className="mt-0.5 text-muted-foreground">{t("pdp.pickupText")}</p>
            <Link to="/points-retrait" className="mt-1 inline-block font-medium text-[var(--color-blue-brand)] hover:underline">
              {t("pdp.seePickupPoints")}
            </Link>
          </div>
        </div>
      </div>

      {p.vendor?.contact_phone && (
        <WhatsAppButton
          phone={p.vendor.contact_phone}
          message={waMessage}
          size="lg"
          label={t("pdp.contactVendor")}
          className="mt-3 w-full justify-center"
        />
      )}
    </div>
  );
}

function BuyBox({ p }: { p: Product }) {
  const isPhysical = p.type === "physical";
  const { data: variants = [] } = useProductVariants(isPhysical && p.has_variants ? p.id : undefined);
  const attrOptions = extractAttributeOptions(variants);
  const { t } = useTranslation();

  // Default selection: from the `is_default` variant, or the first one.
  const initialSelected: Record<string, string> = {};
  if (variants.length > 0) {
    const def = variants.find((v) => v.is_default) ?? variants[0];
    for (const [k, v] of Object.entries(def.attributes || {})) initialSelected[k] = String(v);
  }
  const [selected, setSelected] = useState<Record<string, string>>(initialSelected);
  // Variants arrive after the first render — apply the default selection once loaded.
  useEffect(() => {
    if (variants.length === 0) return;
    setSelected((cur) => {
      if (Object.keys(cur).length > 0) return cur;
      const def = variants.find((v) => v.is_default) ?? variants[0];
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(def.attributes || {})) next[k] = String(v);
      return next;
    });
  }, [variants]);

  const currentVariant: Variant | null = variants.length > 0 ? findVariantByAttrs(variants, selected) : null;
  const fullySelected = attrOptions.every((o) => selected[o.key]);

  const displayPricePoint = currentVariant?.price ?? p.price;
  const displayCompare = currentVariant?.compare_at_price ?? p.compare_at_price;
  const displayStock = currentVariant?.stock_quantity ?? p.stock_quantity;
  const displayImage = currentVariant?.image_url ?? null;

  const { data: tiers } = useProductTiers(
    isPhysical ? p.id : undefined,
    currentVariant?.id ?? null,
  );
  const [qty, setQty] = useState(() => {
    const moq = currentVariant?.min_order_quantity ?? p.min_order_quantity ?? 1;
    return Math.max(1, moq);
  });
  // Reset qty when variant changes so MOQ is respected.
  useEffect(() => {
    const moq = currentVariant?.min_order_quantity ?? p.min_order_quantity ?? 1;
    setQty((q) => Math.max(moq, q));
  }, [currentVariant?.id, currentVariant?.min_order_quantity, p.min_order_quantity]);

  const hasTiers = (tiers?.length ?? 0) > 0;
  const effectiveUnit = hasTiers && displayPricePoint != null
    ? resolveUnitPrice(tiers, qty, displayPricePoint)
    : displayPricePoint;

  const discountPct =
    displayCompare && displayPricePoint && displayCompare > displayPricePoint
      ? Math.round((1 - Number(displayPricePoint) / Number(displayCompare)) * 100)
      : null;

  return (
    <div>
      {displayImage && (
        <div className="mb-3 overflow-hidden rounded-[var(--radius-r-sm)] border border-[var(--color-line)] bg-white">
          <img src={displayImage} alt="" className="h-28 w-full bg-white object-contain" />
        </div>
      )}

      <div className="flex flex-wrap items-baseline gap-2.5">
        <div className="font-heading text-[28px] font-extrabold leading-none text-[var(--color-accent-500)] md:text-[32px]">
          {p.price_type === "quote_only" || effectiveUnit == null
            ? displayPrice(p)
            : (p.price_type === "starting_at" ? "À partir de " : "") + formatFcfa(effectiveUnit)}
        </div>
        {discountPct != null && (
          <>
            <span className="text-sm text-muted-foreground line-through">{formatFcfa(displayCompare!)}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
              style={{ background: "var(--color-deal)" }}
            >
              −{discountPct}%
            </span>
          </>
        )}
      </div>

      {hasTiers && (
        <div className="mt-2.5">
          <div className="inline-flex items-center gap-1 rounded-full bg-[var(--color-green-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-green-brand)]">
            <Truck className="h-3 w-3" /> {t("pdp.tiersBadge")}
          </div>
          <TierTable tiers={tiers!} basePrice={displayPricePoint} qty={qty} />
        </div>
      )}

      <FinancingOffer
        productId={p.id}
        productName={p.name}
        variantId={currentVariant?.id ?? null}
        vendorId={p.vendor?.id ?? null}
        vendorAllowsFinancing={!!p.vendor?.allow_financing}
        price={displayPricePoint != null ? Number(displayPricePoint) : null}
      />

      {variants.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-[var(--color-line)] pt-4">
          {attrOptions.map(({ key, values }) => (
            <div key={key}>
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{key}</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {values.map((value) => {
                  const isSelected = selected[key] === value;
                  const otherKeys: Record<string, string> = { ...selected };
                  delete otherKeys[key];
                  const available = isValueAvailable(variants, key, value, otherKeys);
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!available}
                      onClick={() => setSelected({ ...selected, [key]: value })}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm transition",
                        isSelected
                          ? "border-[var(--color-accent-500)] bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent-600)]"
                          : available
                            ? "border-[var(--color-line)] bg-white hover:border-[var(--color-blue-brand)]"
                            : "cursor-not-allowed border-[var(--color-line)]/60 text-muted-foreground line-through",
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        {p.type === "physical" && (
          <PhysicalActions
            p={p}
            variant={currentVariant}
            fullySelected={fullySelected}
            hasVariants={variants.length > 0}
            displayStock={displayStock}
            displayPrice={displayPricePoint}
            tiers={tiers ?? []}
            qty={qty}
            setQty={setQty}
          />
        )}
        {p.type === "digital" && <DigitalActions p={p} />}
        {p.type === "service" && <ServiceActions p={p} />}
        {p.type === "training" && <TrainingActions p={p} />}
      </div>

      <WishlistToggle productId={p.id} />

      <ul className="mt-4 space-y-1.5 border-t border-[var(--color-line)] pt-3 text-[11px] text-muted-foreground">
        {p.quality_verified && (
          <li className="flex items-center gap-1.5 font-semibold text-[var(--color-green-brand)]">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} /> Qualité vérifiée par Wintek
          </li>
        )}
        <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Achat sécurisé sur Winstorr</li>
        {p.vendor && (
          <li className="flex items-center gap-1.5">
            <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-blue-brand)]" />
            Expédié par <span className="font-medium text-foreground">{p.vendor.name}</span>
          </li>
        )}
      </ul>
    </div>
  );
}

function MobileBuyBar({ p }: { p: Product }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-white/95 px-3 py-2.5 backdrop-blur shadow-[0_-4px_14px_rgba(13,44,84,0.08)] lg:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] text-muted-foreground">{p.name}</div>
          <div className="font-heading text-base font-extrabold text-[var(--color-accent-500)]">{displayPrice(p)}</div>
        </div>
        <a
          href="#buy"
          className="shrink-0 rounded-full px-5 py-2.5 text-sm font-bold text-white"
          style={{ background: "var(--color-accent-500)" }}
        >
          {t("pdp.buyNow")}
        </a>
      </div>
    </div>
  );
}


function TierTable({ tiers, basePrice, qty }: { tiers: PriceTier[]; basePrice: number | null; qty: number }) {
  const sorted = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  const rows: { label: string; price: number; active: boolean }[] = [];
  if (basePrice != null && sorted[0] && sorted[0].min_quantity > 1) {
    const active = qty >= 1 && qty < sorted[0].min_quantity;
    rows.push({ label: `1-${sorted[0].min_quantity - 1} unités`, price: basePrice, active });
  }
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const next = sorted[i + 1];
    const label = next ? `${t.min_quantity}-${next.min_quantity - 1} unités` : `${t.min_quantity}+ unités`;
    const active = qty >= t.min_quantity && (!next || qty < next.min_quantity);
    rows.push({ label, price: t.unit_price, active });
  }
  return (
    <div className="mt-3 divide-y divide-border rounded-sm border border-border text-xs">
      {rows.map((r, i) => (
        <div key={i} className={cn("flex items-center justify-between px-2 py-1.5", r.active && "bg-accent/10 font-medium")}>
          <span className="text-muted-foreground">{r.label}</span>
          <span className={cn("text-foreground", r.active && "text-accent font-semibold")}>{formatFcfa(r.price)}/unité</span>
        </div>
      ))}
    </div>
  );
}


function WishlistToggle({ productId }: { productId: string }) {
  const { data: ids } = useWishlistIds();
  const toggle = useToggleWishlist();
  const wished = ids?.has(productId) ?? false;
  return (
    <button
      type="button"
      onClick={() => toggle.mutate({ productId, wished })}
      className={cn(
        "mt-3 flex w-full items-center justify-center gap-2 rounded-sm border border-border py-2 text-sm font-medium transition hover:bg-muted",
        wished && "text-accent border-accent/40",
      )}
    >
      <Heart className="h-4 w-4" fill={wished ? "currentColor" : "none"} />
      {wished ? "Dans votre liste de souhaits" : "Ajouter à la liste de souhaits"}
    </button>
  );
}


/* ----- physical ----- */
function PhysicalActions({
  p, variant, fullySelected, hasVariants, displayStock, displayPrice: pricePoint, tiers, qty, setQty,
}: {
  p: Product;
  variant: Variant | null;
  fullySelected: boolean;
  hasVariants: boolean;
  displayStock: number | null;
  displayPrice: number | null;
  tiers: PriceTier[];
  qty: number;
  setQty: (updater: (q: number) => number) => void;
}) {
  const { add } = useCart();
  const nav = useNavigate();
  const stock = displayStock ?? 0;
  const stockLabel =
    stock <= 0 ? { text: "Rupture de stock", cls: "text-destructive", dot: "var(--color-deal)" }
    : stock <= 3 ? { text: `Stock limité (${stock})`, cls: "text-[var(--color-accent-600)]", dot: "var(--color-accent-500)" }
    : { text: "En stock", cls: "text-[var(--color-green-brand)]", dot: "var(--color-green-brand)" };

  const unit = resolveUnitPrice(tiers, qty, pricePoint);
  const moq = Math.max(1, variant?.min_order_quantity ?? p.min_order_quantity ?? 1);
  const maxQty = stock > 0 ? stock : moq;
  const atMax = qty >= maxQty;
  const disabled = stock <= 0 || unit == null || (hasVariants && (!variant || !fullySelected));

  // Clamp qty if it ever exceeds available stock (e.g. variant switch).
  useEffect(() => {
    if (stock > 0 && qty > stock) setQty(() => stock);
  }, [stock, qty, setQty]);

  const addToCart = () => {
    if (pricePoint == null) return;
    add(
      {
        productId: p.id,
        variantId: variant?.id ?? null,
        variantAttributes: variant?.attributes ?? null,
        slug: p.slug,
        name: p.name,
        price: Number(pricePoint),
        image: variant?.image_url ?? p.images[0] ?? null,
      },
      qty,
    );
  };

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 text-sm font-semibold ${stockLabel.cls}`}>
        <span className="h-2 w-2 rounded-full" style={{ background: stockLabel.dot }} />
        {stockLabel.text}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center overflow-hidden rounded-full border border-[var(--color-line)] bg-white">
          <button type="button" onClick={() => setQty((q) => Math.max(moq, q - 1))} className="px-3.5 py-2 text-lg leading-none disabled:opacity-40" disabled={qty <= moq}>−</button>
          <span className="min-w-8 text-center text-sm font-semibold">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="px-3.5 py-2 text-lg leading-none disabled:opacity-40" disabled={atMax || stock <= 0}>+</button>
        </div>
      </div>
      {moq > 1 && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-blue-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-blue-brand)]">
          <Package className="h-3 w-3" /> Commande minimum : {moq} unités
        </div>
      )}
      {stock > 0 && atMax && (
        <div className="text-xs text-[var(--color-accent-600)]">Quantité maximum disponible : {stock}.</div>
      )}

      {hasVariants && !fullySelected && (
        <div className="text-xs text-[var(--color-accent-600)]">Sélectionnez une combinaison pour continuer.</div>
      )}
      <Button
        size="lg"
        className="w-full rounded-full font-bold text-white hover:opacity-90"
        style={{ background: "var(--color-accent-500)" }}
        disabled={disabled}
        onClick={() => { addToCart(); nav({ to: "/commande" }); }}
      >
        Acheter maintenant
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="w-full rounded-full border-[var(--color-navy-900)]/25 font-semibold text-[var(--color-navy-900)]"
        disabled={disabled}
        onClick={() => { addToCart(); toast.success(`${p.name} ajouté au panier`); }}
      >
        Ajouter au panier
      </Button>
    </div>
  );

}



/* ----- digital ----- */
function DigitalActions({ p }: { p: Product }) {
  const labels: Record<NonNullable<Product["delivery_type"]>, string> = {
    file_download: "Livraison immédiate par téléchargement",
    license_key: "Clé de licence envoyée par email",
    access_link: "Lien d'accès envoyé par email",
  };
  return (
    <div className="space-y-4">
      {p.delivery_type && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3">
          <Download className="mt-0.5 h-4 w-4 text-primary" />
          <div className="text-sm">
            <div className="font-medium text-foreground">{labels[p.delivery_type]}</div>
            {p.delivery_instructions && <div className="mt-1 text-muted-foreground">{p.delivery_instructions}</div>}
          </div>
        </div>
      )}
      <Button
        size="lg"
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        onClick={() => toast.info("Le paiement en ligne sera disponible prochainement.")}
      >
        Acheter maintenant
      </Button>
    </div>
  );
}

/* ----- service ----- */
function ServiceActions({ p }: { p: Product }) {
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", customer_email: "", description: "", preferred_date: "" });
  const [done, setDone] = useState(false);
  const areas: Record<NonNullable<Product["service_area"]>, string> = {
    on_site: "À domicile", in_shop: "En atelier", remote: "À distance", both: "À domicile ou en atelier",
  };
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_requests").insert({
        product_id: p.id,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_email: form.customer_email.trim() || null,
        description: form.description.trim(),
        preferred_date: form.preferred_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => setDone(true),
    onError: (e: Error) => toast.error(e.message),
  });

  if (done) {
    return (
      <div className="rounded-lg border border-success/40 bg-success/10 p-4">
        <h3 className="font-display text-base text-success">Demande envoyée ✓</h3>
        <p className="mt-1 text-xs text-foreground/80">Nous vous recontactons sous 24h.</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {p.service_area && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {areas[p.service_area]}</span>}
        {p.estimated_duration && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.estimated_duration}</span>}
      </div>
      <div><Label>Nom complet *</Label><Input required minLength={2} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
      <div><Label>Téléphone *</Label><Input required minLength={6} value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
      <div><Label>Email</Label><Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} /></div>
      <div><Label>Description du besoin *</Label><Textarea required minLength={5} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div><Label>Date souhaitée</Label><Input type="date" value={form.preferred_date} onChange={(e) => setForm({ ...form, preferred_date: e.target.value })} /></div>
      <Button type="submit" size="lg" disabled={mut.isPending} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
        {mut.isPending ? "Envoi..." : "Demander un devis"}
      </Button>
    </form>
  );
}

/* ----- training ----- */
type Session = { id: string; start_date: string; end_date: string; location: string | null; capacity: number; seats_taken: number; price_override: number | null; status: string };

function TrainingActions({ p }: { p: Product }) {
  const { data: sessions = [], refetch } = useQuery({
    queryKey: ["sessions", p.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, start_date, end_date, location, capacity, seats_taken, price_override, status")
        .eq("product_id", p.id)
        .in("status", ["scheduled", "full"])
        .gte("start_date", new Date().toISOString())
        .order("start_date");
      if (error) throw error;
      return data as Session[];
    },
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const active = sessions.find((s) => s.id === openId) ?? null;

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-foreground">Prochaines sessions</div>
      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          Aucune session programmée pour l'instant.
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const seats = s.capacity - s.seats_taken;
            const full = s.status === "full" || seats <= 0;
            const price = s.price_override ?? p.price;
            return (
              <li key={s.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-primary" />
                  {new Date(s.start_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {s.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.location}</span>}
                  <span>{full ? "Complet" : `${seats} place${seats > 1 ? "s" : ""}`}</span>
                  {price != null && <span className="font-medium text-foreground">{formatFcfa(price)}</span>}
                </div>
                <Button size="sm" disabled={full} onClick={() => setOpenId(s.id)} className="mt-2 w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  {full ? "Complet" : "S'inscrire"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <EnrollDialog session={active} onClose={() => setOpenId(null)} onDone={() => { setOpenId(null); refetch(); }} />
    </div>
  );
}

function EnrollDialog({ session, onClose, onDone }: { session: Session | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const mut = useMutation({
    mutationFn: async () => {
      if (!session) return;
      const { error } = await supabase.from("training_enrollments").insert({
        session_id: session.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscription enregistrée. Nous vous confirmerons par téléphone.");
      setForm({ name: "", phone: "", email: "" });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!session} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Inscription à la session</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
          <div><Label>Nom complet *</Label><Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Téléphone *</Label><Input required minLength={6} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "..." : "Confirmer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ----- reviews ----- */
type Review = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
  verified_purchase: boolean;
  customer: { full_name: string | null } | null;
};

function ReviewsSection({ productId, rating, count }: { productId: string; rating: number; count: number }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("id, rating, title, comment, created_at, verified_purchase, customer:profiles(full_name)")
        .eq("product_id", productId)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Review[];
    },
  });

  const myReview = reviews.find((r) => false); // published-only fetch — form always shows for logged-in users
  const [form, setForm] = useState({ rating: 5, title: "", comment: "" });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Connectez-vous pour laisser un avis");
      const { error } = await supabase.from("product_reviews").insert({
        product_id: productId,
        customer_id: user.id,
        rating: form.rating,
        title: form.title.trim() || null,
        comment: form.comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Merci ! Votre avis sera publié après modération.");
      setForm({ rating: 5, title: "", comment: "" });
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
      qc.invalidateQueries({ queryKey: ["product"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-[var(--radius-r-lg)] border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <div>
          <h2 className="font-heading text-[17px] font-extrabold tracking-tight text-[var(--color-ink)] md:text-[20px]">Avis clients</h2>
          <div className="mt-3">
            <div className="font-heading text-4xl font-extrabold text-[var(--color-navy-900)]">{rating.toFixed(1)}<span className="text-lg font-normal text-muted-foreground">/5</span></div>
            <StarRating rating={rating} showCount={false} size="lg" className="mt-1" />
            <div className="mt-1 text-sm text-muted-foreground">{count} avis publié{count > 1 ? "s" : ""}</div>
          </div>


          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            {user ? (
              <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-3">
                <div className="font-medium text-sm text-foreground">Laisser un avis</div>
                <div>
                  <Label>Note</Label>
                  <div className="mt-1 overflow-hidden rounded-sm">
                    <StarRating
                      rating={form.rating}
                      onRate={(r) => setForm({ ...form, rating: r })}
                      interactive
                      size="xl"
                      showCount={false}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{form.rating}/5</div>
                </div>
                <div><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} /></div>
                <div><Label>Commentaire</Label><Textarea rows={3} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} maxLength={1000} /></div>
                <Button type="submit" disabled={submit.isPending} className="w-full">{submit.isPending ? "..." : "Publier"}</Button>
              </form>
            ) : (
              <div className="text-sm">
                <div className="font-medium text-foreground">Envie de donner votre avis ?</div>
                <p className="mt-1 text-xs text-muted-foreground">Connectez-vous pour partager votre expérience.</p>
                <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                  <Link to="/auth">Se connecter</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        <div>
          {isLoading ? (
            <SkeletonListRows rows={3} />
          ) : reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-muted-foreground">
              Aucun avis pour le moment. Soyez le premier à partager votre expérience !
            </div>
          ) : (
            <ul className="space-y-5">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                        {(r.customer?.full_name ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{r.customer?.full_name ?? "Client Winstorr"}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                          {r.verified_purchase && <span className="ml-2 inline-flex items-center gap-1 text-success"><BadgeCheck className="h-3 w-3" /> Achat vérifié</span>}
                        </div>
                      </div>
                    </div>
                    <StarRating rating={r.rating} showCount={false} />
                  </div>
                  {r.title && <div className="mt-3 font-medium text-foreground">{r.title}</div>}
                  {r.comment && <div className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{r.comment}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {myReview && null}
    </section>
  );
}

/* -------------------- questions & answers -------------------- */
type PublicQuestion = { id: string; question: string; answer: string | null; created_at: string; answered_at: string | null };

function QuestionsSection({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["product-questions", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_questions")
        .select("id, question, answer, created_at, answered_at")
        .eq("product_id", productId)
        .eq("status", "answered")
        .order("answered_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as PublicQuestion[];
    },
  });

  const ask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_questions").insert({
        product_id: productId,
        question: text.trim(),
        customer_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("pdp.questionSent"));
      setText("");
      qc.invalidateQueries({ queryKey: ["product-questions", productId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel title={t("pdp.questions")}>
      {isLoading ? (
        <SkeletonListRows rows={2} />
      ) : questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("pdp.noQuestions")}</p>
      ) : (
        <ul className="space-y-4">
          {questions.map((q) => (
            <li key={q.id} className="rounded-[var(--radius-r)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <div className="flex items-start gap-2 text-sm font-semibold text-[var(--color-ink)]">
                <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-blue-brand)]" />
                {q.question}
              </div>
              {q.answer && (
                <div className="mt-2 border-l-2 border-[var(--color-green-brand)] pl-3 text-sm text-foreground/80">
                  {q.answer}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 5) ask.mutate(); }}
        className="mt-5 border-t border-[var(--color-line)] pt-4"
      >
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("pdp.askQuestion")}</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder={t("pdp.questionPlaceholder")}
          />
          <Button type="submit" disabled={ask.isPending || text.trim().length < 5}>
            {ask.isPending ? "..." : t("pdp.send")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* -------------------- related shelves -------------------- */
const SHELF_SELECT = "id, slug, name, short_description, images, type, price, price_type, stock_quantity, compare_at_price, rating_average, rating_count, quality_verified";

function Shelf({ items }: { items: ProductCardData[] }) {
  return (
    <div className="-mx-1 grid grid-flow-col auto-cols-[minmax(150px,180px)] gap-3 overflow-x-auto scrollbar-thin px-1 pb-2">
      {items.map((p) => <ProductCard key={p.id} p={p} />)}
    </div>
  );
}

function SimilarProducts({ categoryId, excludeId }: { categoryId: string | null; excludeId: string }) {
  const { t } = useTranslation();
  const { data: items = [] } = useQuery({
    queryKey: ["similar-products", categoryId, excludeId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(SHELF_SELECT)
        .eq("status", "active")
        .eq("category_id", categoryId!)
        .neq("id", excludeId)
        .order("rating_count", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as ProductCardData[];
    },
  });
  if (!categoryId || items.length === 0) return null;
  return <Panel title={t("pdp.similar")}><Shelf items={items} /></Panel>;
}

function SameShopProducts({ vendorId, vendorName, excludeId }: { vendorId: string; vendorName: string; excludeId: string }) {
  const { t } = useTranslation();
  const { data: items = [] } = useQuery({
    queryKey: ["same-shop-products", vendorId, excludeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(SHELF_SELECT)
        .eq("status", "active")
        .eq("vendor_id", vendorId)
        .neq("id", excludeId)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as ProductCardData[];
    },
  });
  if (items.length === 0) return null;
  return <Panel title={`${t("pdp.sameShop")} — ${vendorName}`}><Shelf items={items} /></Panel>;
}

function VendorCard({ vendor }: { vendor: NonNullable<Product["vendor"]> }) {
  const { t } = useTranslation();
  return (
    <Panel title={t("pdp.vendorInfo")}>
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-r)] border border-[var(--color-line)] bg-white">
          {vendor.logo_url ? (
            <img src={vendor.logo_url} alt={vendor.name} className="h-full w-full object-contain" />
          ) : (
            <Store className="h-6 w-6 text-[var(--color-blue-brand)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-heading text-base font-extrabold text-[var(--color-navy-900)]">{vendor.name}</span>
            {vendor.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-green-brand)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-green-brand)]">
                <BadgeCheck className="h-3.5 w-3.5" /> {t("trust.verified")}
              </span>
            )}
          </div>
          {vendor.type === "internal" && (
            <div className="text-xs text-[var(--color-blue-brand)]">Vendeur officiel Winstorr</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted,#5B6B7F)]">
            {vendor.created_at && <span>{t("trust.sellerSince", { year: new Date(vendor.created_at).getFullYear() })}</span>}
            {vendor.city && <span>{vendor.city}</span>}
            <span>
              {Number(vendor.sales_count ?? 0) > 0
                ? t("trust.sales", { count: Number(vendor.sales_count) })
                : t("trust.noSalesYet")}
            </span>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link to="/boutiques/$vendorSlug" params={{ vendorSlug: vendor.slug }}>{t("pdp.visitShop")}</Link>
        </Button>
      </div>
    </Panel>
  );
}
