import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { displayPrice, formatFcfa, PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/format";
import { StarRating } from "@/components/star-rating";
import { QualityBadge, SellerVerifiedBadge } from "@/components/quality-badge";
import { imageAtWidth, imageSrcSet } from "@/lib/seo";
import { useWishlistIds, useToggleWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils";


export type CardVendor = {
  name: string;
  slug?: string | null;
  city?: string | null;
  verified?: boolean | null;
};

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  images: string[];
  type: ProductType;
  price: number | null;
  price_type: "fixed" | "starting_at" | "quote_only";
  stock_quantity: number | null;
  compare_at_price?: number | null;
  rating_average?: number | null;
  rating_count?: number | null;
  quality_verified?: boolean | null;
  min_order_quantity?: number | null;
  vendor?: CardVendor | null;
  /** Tier prices (Alibaba-style range). Optional — omit to show the single price. */
  tier_prices?: number[] | null;
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const { t } = useTranslation();
  const img = p.images?.[0];
  const hasDiscount = p.compare_at_price && p.price && p.compare_at_price > p.price;
  const { data: wishlistIds } = useWishlistIds();
  const toggle = useToggleWishlist();
  const wished = wishlistIds?.has(p.id) ?? false;

  const ratingCount = Number(p.rating_count ?? 0);
  const moq = Number(p.min_order_quantity ?? 1);

  // Price range when the product has quantity tiers.
  const tiers = (p.tier_prices ?? []).filter((n) => typeof n === "number" && n > 0);
  const priceValues = p.price != null ? [...tiers, p.price] : tiers;
  const lo = priceValues.length ? Math.min(...priceValues) : null;
  const hi = priceValues.length ? Math.max(...priceValues) : null;
  const showRange = p.price_type === "fixed" && lo != null && hi != null && lo !== hi;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-sm border border-border bg-card transition-colors hover:border-secondary/60">
      <button
        type="button"
        aria-label={wished ? "Retirer de la liste de souhaits" : "Ajouter à la liste de souhaits"}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle.mutate({ productId: p.id, wished }); }}
        className={cn(
          "absolute right-1.5 top-1.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-background/90 backdrop-blur border border-border shadow-sm hover:bg-background transition",
          wished && "text-accent",
        )}
      >
        <Heart className="h-4 w-4" fill={wished ? "currentColor" : "none"} strokeWidth={2} />
      </button>
      <Link
        to="/produits/$slug"
        params={{ slug: p.slug }}
        className="flex flex-1 flex-col no-link-color"
      >
        <div className="relative aspect-square overflow-hidden bg-muted">
          {img ? (
            <img
              src={imageAtWidth(img, 300) || img}
              srcSet={imageSrcSet(img, [200, 300, 400, 600])}
              sizes="(min-width: 1280px) 200px, (min-width: 1024px) 220px, (min-width: 640px) 33vw, 50vw"
              alt={p.name}
              loading="lazy"
              decoding="async"
              width={300}
              height={300}
              className="h-full w-full object-contain bg-white"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <span className="font-display text-3xl opacity-30">{PRODUCT_TYPE_LABELS[p.type][0]}</span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
          <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground min-h-[2.4em]">
            {p.name}
          </h3>

          {/* Trust line — vendor · city, small and muted */}
          {p.vendor?.name && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
              <span className="truncate">
                {p.vendor.name}
                {p.vendor.city ? ` · ${p.vendor.city}` : ""}
              </span>
              {p.vendor.verified && <SellerVerifiedBadge />}
            </div>
          )}

          {ratingCount > 0 && (
            <StarRating rating={Number(p.rating_average ?? 0)} count={ratingCount} size="sm" />
          )}

          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-accent leading-none">
              {showRange
                ? `${formatFcfa(lo!)} – ${formatFcfa(hi!)}`
                : displayPrice({ price: p.price, price_type: p.price_type })}
            </span>
            {hasDiscount && !showRange && (
              <span className="text-xs text-muted-foreground line-through">
                {formatFcfa(p.compare_at_price!)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {moq > 1 && (
              <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {t("trust.moq", { count: moq })}
              </span>
            )}
            {p.quality_verified && <QualityBadge />}
          </div>
        </div>
      </Link>
    </div>
  );
}
