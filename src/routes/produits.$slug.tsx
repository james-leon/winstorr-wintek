import { PublicRouteError } from "@/components/public-route-error";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { pushRecentlyViewed } from "@/lib/recently-viewed";
import { RecentlyViewedShelf } from "@/components/recently-viewed-shelf";

import { toast } from "sonner";
import { ChevronLeft, MapPin, Calendar, Clock, Package, Download, ShieldCheck, Truck, BadgeCheck, Heart } from "lucide-react";
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

  vendor: { id: string; name: string; slug: string; type: "internal" | "external"; allow_financing: boolean; logo_url: string | null; contact_phone: string | null } | null;
  category: { name: string; slug: string } | null;
};

const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async (): Promise<Product> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, short_description, description, images, type, price, price_type, compare_at_price, stock_quantity, min_order_quantity, has_variants, delivery_type, delivery_instructions, service_area, estimated_duration, delivery_mode, rating_average, rating_count, quality_verified, warranty_duration, source_type, category_id, vendor:vendors(id, name, slug, type, allow_financing, logo_url, contact_phone), category:categories(name, slug)")
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
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (p?.id) pushRecentlyViewed(p.id);
  }, [p?.id]);

  return (
    <div className="mx-auto max-w-6xl px-3 py-4">

      <Link to="/catalogue" className="mb-3 inline-flex items-center gap-1 text-xs text-secondary hover:underline">
        <ChevronLeft className="h-3.5 w-3.5" /> Retour au catalogue
      </Link>

      <div className="grid gap-5 rounded-sm border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_320px]">
        {/* Gallery */}
        <div>
          <div className="aspect-square overflow-hidden rounded-sm border border-border bg-muted">
            {p.images[activeImg] ? (
              <img
                src={imageAtWidth(p.images[activeImg], 800) || p.images[activeImg]}
                srcSet={imageSrcSet(p.images[activeImg], [400, 600, 800, 1200])}
                sizes="(min-width: 1024px) 480px, 100vw"
                alt={p.name}
                fetchPriority="high"
                decoding="async"
                width={800}
                height={800}
                className="h-full w-full object-contain bg-white"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-muted-foreground text-sm">Pas d'image</div>
            )}
          </div>

          {p.images.length > 1 && (
            <div className="mt-2 grid grid-cols-6 gap-1.5">
              {p.images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`aspect-square overflow-hidden rounded-sm border ${i === activeImg ? "border-secondary" : "border-border"}`}
                >
                  <img src={src} alt="" className="h-full w-full object-contain bg-white" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Middle info */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={p.type} />
            {p.quality_verified && <QualityBadge />}
          </div>
          <h1 className="mt-2 text-xl md:text-2xl font-semibold text-foreground leading-tight">{p.name}</h1>
          {p.vendor && <div className="mt-1"><VendorLine name={p.vendor.name} slug={p.vendor.slug} internal={p.vendor.type === "internal"} /></div>}
          <div className="mt-1.5"><StarRating rating={Number(p.rating_average)} count={p.rating_count} size="sm" /></div>
          {p.short_description && <p className="mt-3 text-sm text-foreground/80">{p.short_description}</p>}

          {(p.warranty_duration || p.source_type) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.warranty_duration && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                  <BadgeCheck className="h-3 w-3 text-secondary" /> Garantie {p.warranty_duration}
                </span>
              )}
              {p.source_type && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                  <Truck className="h-3 w-3" /> {SOURCE_LABELS[p.source_type]}
                </span>
              )}
            </div>
          )}

          {p.description && (
            <div className="mt-6 border-t border-border pt-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Description</h2>
              <div className="mt-2 whitespace-pre-wrap text-sm text-foreground/85 leading-relaxed">{p.description}</div>
            </div>
          )}
        </div>

        {/* Buy box */}
        <aside className="lg:sticky lg:top-24 self-start">
          <BuyBox p={p} />
        </aside>
      </div>

      <ReviewsSection productId={p.id} rating={Number(p.rating_average)} count={p.rating_count} />
      <RecentlyViewedShelf excludeId={p.id} />

    </div>
  );
}

function BuyBox({ p }: { p: Product }) {
  const isPhysical = p.type === "physical";
  const { data: variants = [] } = useProductVariants(isPhysical && p.has_variants ? p.id : undefined);
  const attrOptions = extractAttributeOptions(variants);

  // Default selection: from the `is_default` variant, or the first one.
  const initialSelected: Record<string, string> = {};
  if (variants.length > 0) {
    const def = variants.find((v) => v.is_default) ?? variants[0];
    for (const [k, v] of Object.entries(def.attributes || {})) initialSelected[k] = String(v);
  }
  const [selected, setSelected] = useState<Record<string, string>>(initialSelected);
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

  return (
    <div className="rounded-sm border border-border bg-background p-4">
      {displayImage && (
        <div className="mb-3 overflow-hidden rounded-sm border border-border bg-muted">
          <img src={displayImage} alt="" className="h-32 w-full object-contain bg-white" />
        </div>
      )}
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold text-accent leading-none">
          {p.price_type === "quote_only" || effectiveUnit == null
            ? displayPrice(p)
            : (p.price_type === "starting_at" ? "À partir de " : "") + formatFcfa(effectiveUnit)}
        </div>
        {displayCompare && displayPricePoint && displayCompare > displayPricePoint && (
          <div className="text-sm text-muted-foreground line-through">{formatFcfa(displayCompare)}</div>
        )}
      </div>
      {hasTiers && (
        <div className="mt-1 inline-flex items-center gap-1 rounded-sm bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
          <Truck className="h-3 w-3" /> Tarif dégressif — prix de gros disponible
        </div>
      )}
      {hasTiers && <TierTable tiers={tiers!} basePrice={displayPricePoint} qty={qty} />}

      <FinancingOffer
        productId={p.id}
        productName={p.name}
        variantId={currentVariant?.id ?? null}
        vendorId={p.vendor?.id ?? null}
        vendorAllowsFinancing={!!p.vendor?.allow_financing}
        price={displayPricePoint != null ? Number(displayPricePoint) : null}
      />

      {variants.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-border pt-3">
          {attrOptions.map(({ key, values }) => (
            <div key={key}>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">{key}</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
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
                        "rounded-sm border px-3 py-1.5 text-sm transition",
                        isSelected
                          ? "border-accent bg-accent/10 font-medium text-accent"
                          : available
                            ? "border-border hover:border-foreground/40"
                            : "cursor-not-allowed border-border/40 text-muted-foreground line-through",
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

      <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
        {p.quality_verified && (
          <li className="flex items-center gap-1.5 text-success font-medium">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} /> Qualité vérifiée par Wintek
          </li>
        )}
        <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Achat sécurisé sur Winstorr</li>
        {p.vendor && (
          <li className="flex items-center gap-1.5">
            <BadgeCheck className="h-3.5 w-3.5 text-secondary" />
            Expédié par <span className="font-medium text-foreground">{p.vendor.name}</span>
          </li>
        )}
      </ul>
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
    stock <= 0 ? { text: "Rupture de stock", cls: "text-destructive" }
    : stock <= 3 ? { text: `Stock limité (${stock})`, cls: "text-accent" }
    : { text: "En stock", cls: "text-success" };
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
      <div className={`flex items-center gap-2 text-sm font-medium ${stockLabel.cls}`}>
        <Package className="h-4 w-4" /> {stockLabel.text}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-md border border-input">
          <button type="button" onClick={() => setQty((q) => Math.max(moq, q - 1))} className="px-3 py-2 text-lg" disabled={qty <= moq}>−</button>
          <span className="min-w-8 text-center">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="px-3 py-2 text-lg" disabled={atMax || stock <= 0}>+</button>
        </div>
      </div>
      {moq > 1 && (
        <div className="text-xs text-muted-foreground">Quantité minimum : {moq} unités</div>
      )}
      {stock > 0 && atMax && (
        <div className="text-xs text-accent">Quantité maximum disponible : {stock}.</div>
      )}

      {hasVariants && !fullySelected && (
        <div className="text-xs text-accent">Sélectionnez une combinaison pour continuer.</div>
      )}
      <Button
        size="lg"
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        disabled={disabled}
        onClick={() => { addToCart(); nav({ to: "/commande" }); }}
      >
        Acheter maintenant
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="w-full"
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
    <section className="mt-14 border-t border-border pt-10">
      <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
        <div>
          <h2 className="font-display text-2xl text-foreground">Avis clients</h2>
          <div className="mt-3">
            <div className="font-display text-4xl text-foreground">{rating.toFixed(1)}<span className="text-lg text-muted-foreground">/5</span></div>
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
