import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { ShieldCheck, Store as StoreIcon, Star, Users, Package, Heart, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useIsFollowing, useFollowerCount, useToggleFollow } from "@/lib/vendor-follow";
import type { ProductType } from "@/lib/format";
import { cn } from "@/lib/utils";

/* -------------------- data -------------------- */

type StorefrontData = {
  vendor: {
    id: string;
    slug: string;
    name: string;
    type: "internal" | "external";
    logo_url: string | null;
    description: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    created_at: string;
  };
  storefront: {
    banner_url: string | null;
    description: string | null;
    social_links: Record<string, string> | null;
    policies: string | null;
  } | null;
  products: ProductCardData[];
  weighted_rating: number;
  total_reviews: number;
};

const storefrontQuery = (vendorSlug: string) =>
  queryOptions({
    queryKey: ["storefront-v1", vendorSlug],
    queryFn: async (): Promise<StorefrontData> => {
      const vendorRes = await supabase
        .from("vendors")
        .select("id, slug, name, type, logo_url, description, contact_email, contact_phone, created_at, status")
        .eq("slug", vendorSlug)
        .eq("status", "active")
        .maybeSingle();
      if (vendorRes.error) throw vendorRes.error;
      if (!vendorRes.data) throw notFound();
      const vendor = vendorRes.data;

      const [storefrontRes, productsRes] = await Promise.all([
        supabase
          .from("vendor_storefronts")
          .select("banner_url, description, social_links, policies")
          .eq("vendor_id", vendor.id)
          .maybeSingle(),
        supabase
          .from("products")
          .select(
            "id, slug, name, short_description, images, type, price, price_type, stock_quantity, compare_at_price, rating_average, rating_count, quality_verified",
          )
          .eq("vendor_id", vendor.id)
          .eq("status", "active")
          .order("rating_count", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(60),
      ]);
      if (storefrontRes.error) throw storefrontRes.error;
      if (productsRes.error) throw productsRes.error;

      const products = ((productsRes.data ?? []) as ProductCardData[]).map((p) => ({
        ...p,
        images: Array.isArray(p.images) ? p.images : [],
      }));

      // Weighted (Bayesian) rating over this vendor's products.
      const bayesM = 5;
      const bayesC = 3.5;
      let ratingSum = 0;
      let ratingCount = 0;
      for (const p of products) {
        const rc = Number(p.rating_count ?? 0);
        const ra = Number(p.rating_average ?? 0);
        ratingSum += ra * rc;
        ratingCount += rc;
      }
      const weighted = ratingCount > 0 ? (ratingSum + bayesM * bayesC) / (ratingCount + bayesM) : bayesC;

      return {
        vendor: {
          id: vendor.id,
          slug: vendor.slug,
          name: vendor.name,
          type: vendor.type as "internal" | "external",
          logo_url: vendor.logo_url,
          description: vendor.description,
          contact_email: vendor.contact_email,
          contact_phone: vendor.contact_phone,
          created_at: vendor.created_at,
        },
        storefront: (storefrontRes.data as StorefrontData["storefront"]) ?? null,
        products,
        weighted_rating: weighted,
        total_reviews: ratingCount,
      };
    },
    staleTime: 60_000,
  });

/* -------------------- route -------------------- */

export const Route = createFileRoute("/boutiques_/$vendorSlug")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(storefrontQuery(params.vendorSlug)),
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Boutique introuvable — Winstorr" }, { name: "robots", content: "noindex" }] };
    }
    const { vendor, storefront } = loaderData as StorefrontData;
    const title = `${vendor.name} — Boutique Winstorr`;
    const description =
      storefront?.description ??
      vendor.description ??
      `Découvrez la boutique ${vendor.name} sur Winstorr. Vendeur vérifié, livraison au Cameroun.`;
    const image = storefront?.banner_url ?? vendor.logo_url ?? undefined;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description.slice(0, 155) },
      { property: "og:title", content: title },
      { property: "og:description", content: description.slice(0, 155) },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ];

    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }
    return { meta };
  },
  component: Storefront,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl p-8">
      <EmptyState
        title="Impossible de charger la boutique"
        description={error.message}
        icon={StoreIcon}

      />
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl p-8">
      <EmptyState
        title="Boutique introuvable"
        description="Cette boutique n’existe pas ou n’est plus active."
        icon={StoreIcon}
        action={
          <Link
            to="/boutiques"
            className="inline-flex items-center rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground no-link-color"
          >
            Voir toutes les boutiques
          </Link>
        }

      />
    </div>
  ),
});

/* -------------------- component -------------------- */

const TYPE_LABEL: Record<ProductType, string> = {
  physical: "Produits physiques",
  digital: "Numérique",
  service: "Services",
  training: "Formations",
};

function Storefront() {
  const { data } = useSuspenseQuery(storefrontQuery(Route.useParams().vendorSlug));
  const { vendor, storefront, products, weighted_rating, total_reviews } = data;
  const { user } = useAuth();

  const { data: followers = 0 } = useFollowerCount(vendor.id);
  const { data: following = false } = useIsFollowing(vendor.id);
  const toggle = useToggleFollow();

  const productsByType = products.reduce<Record<ProductType, ProductCardData[]>>(
    (acc, p) => {
      (acc[p.type] ??= []).push(p);
      return acc;
    },
    { physical: [], digital: [], service: [], training: [] },
  );

  const socialEntries = storefront?.social_links ? Object.entries(storefront.social_links).filter(([, v]) => !!v) : [];

  return (
    <div className="bg-background">
      {/* Banner — fixed height, tasteful default when empty */}
      <section className="border-b border-border">
        <div
          className="relative h-[130px] w-full overflow-hidden md:h-[220px]"
          style={{
            background: storefront?.banner_url ? undefined : "var(--gradient-winstorr, linear-gradient(135deg, #F2994A, #EB5757))",
          }}
        >
          {storefront?.banner_url ? (
            <img
              src={storefront.banner_url}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
              fetchPriority="high"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-white/15 text-white ring-4 ring-white/20 backdrop-blur-sm md:h-20 md:w-20">
                {vendor.logo_url ? (
                  <img src={vendor.logo_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <span className="font-display text-2xl md:text-3xl">{vendor.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Store header row — sits cleanly below the banner */}
        <div className="mx-auto max-w-7xl px-4 py-4 md:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-background text-primary md:h-20 md:w-20">
              {vendor.logo_url ? (
                <img src={vendor.logo_url} alt={vendor.name} className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-xl text-primary md:text-2xl">{vendor.name.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl text-foreground md:text-3xl">{vendor.name}</h1>
                {vendor.type === "internal" && (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-secondary/10 px-1.5 py-0.5 text-[11px] font-semibold text-secondary">
                    <ShieldCheck className="h-3 w-3" /> Officiel Wintek
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 text-foreground">
                  <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                  <span className="font-semibold">{weighted_rating.toFixed(1)}</span>
                  {total_reviews > 0 && <span className="text-muted-foreground">· {total_reviews} avis</span>}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" /> {products.length} produit{products.length > 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {followers} abonné{followers > 1 ? "s" : ""}
                </span>
              </div>
              {(storefront?.description || vendor.description) && (
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  {storefront?.description ?? vendor.description}
                </p>
              )}
            </div>

            <div className="shrink-0 md:pt-1">
              {user ? (
                <Button
                  variant={following ? "outline" : "default"}
                  size="sm"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ vendorId: vendor.id, following })}
                  className={cn("w-full md:w-auto", !following && "bg-accent text-accent-foreground hover:bg-accent/90")}
                >
                  <Heart className={cn("mr-1.5 h-4 w-4", following && "fill-current")} />
                  {following ? "Suivi(e)" : "Suivre cette boutique"}
                </Button>
              ) : (
                <Link
                  to="/auth"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground no-link-color hover:brightness-95 md:w-auto"
                >
                  <Heart className="h-4 w-4" /> Suivre — Se connecter
                </Link>
              )}
            </div>
          </div>

          {/* Social & policies row */}
          {(socialEntries.length > 0 || storefront?.policies) && (
            <div className="mt-4 grid gap-3 border-t border-border pt-3 md:grid-cols-2">
              {socialEntries.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Réseaux
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {socialEntries.map(([k, v]) => (
                      <a
                        key={k}
                        href={v}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-xs text-foreground hover:border-secondary/60"
                      >
                        <ExternalLink className="h-3 w-3" /> {k}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {storefront?.policies && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Politiques
                  </div>
                  <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                    {storefront.policies}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>


      {/* Products */}
      <section className="mx-auto max-w-7xl px-4 py-6">
        {products.length === 0 ? (
          <EmptyState
            title="Aucun produit actif pour l’instant"
            description="Cette boutique n’a pas encore publié de produit. Revenez bientôt."
            icon={Package}
          />
        ) : (
          <div className="space-y-8">
            {(Object.keys(productsByType) as ProductType[])
              .filter((t) => productsByType[t].length > 0)
              .map((t) => (
                <div key={t}>
                  <div className="mb-2 flex items-end justify-between gap-4 border-b border-border pb-1.5">
                    <h2 className="text-sm font-bold text-foreground tracking-tight">
                      {TYPE_LABEL[t]} ({productsByType[t].length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {productsByType[t].map((p) => (
                      <ProductCard key={p.id} p={p} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* Keep unused imports valid */
void useQuery;
