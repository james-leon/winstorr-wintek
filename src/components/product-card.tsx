import { Link } from "@tanstack/react-router";
import { displayPrice, PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/format";
import { TypeBadge } from "@/components/type-badge";
import { StarRating } from "@/components/star-rating";
import { QualityBadge } from "@/components/quality-badge";
import { Button } from "@/components/ui/button";

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
  rating_average?: number | null;
  rating_count?: number | null;
  quality_verified?: boolean | null;
};

const CTA: Record<ProductType, string> = {
  physical: "Voir le produit",
  digital: "Voir le produit",
  service: "Demander un devis",
  training: "Voir les sessions",
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const img = p.images?.[0];
  return (
    <Link
      to="/produits/$slug"
      params={{ slug: p.slug }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {img ? (
          <img
            src={img}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <span className="font-display text-3xl opacity-30">{PRODUCT_TYPE_LABELS[p.type][0]}</span>
          </div>
        )}
        <div className="absolute left-3 top-3">
          <TypeBadge type={p.type} />
        </div>
        {p.quality_verified && (
          <div className="absolute right-3 top-3">
            <QualityBadge />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-semibold leading-tight text-foreground">{p.name}</h3>
        <StarRating rating={Number(p.rating_average ?? 0)} count={p.rating_count ?? 0} />
        {p.short_description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{p.short_description}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="font-display text-lg text-primary">
            {displayPrice({ price: p.price, price_type: p.price_type })}
          </div>
          <Button size="sm" variant="secondary" className="shrink-0">
            {CTA[p.type]}
          </Button>
        </div>
      </div>
    </Link>
  );
}
