import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Search, Store as StoreIcon, ShieldCheck, Sparkles, Star, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { z } from "zod";

/* -------------------- types & search -------------------- */

type SortKey = "popular" | "rating" | "recent" | "name";

const searchSchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  sort: z.enum(["popular", "rating", "recent", "name"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});
type BoutiquesSearch = z.infer<typeof searchSchema>;



type VendorDirEntry = {
  id: string;
  slug: string;
  name: string;
  type: "internal" | "external";
  logo_url: string | null;
  description: string | null;
  banner_url: string | null;
  boost_score: number;
  pinned_until: string | null;
  created_at: string;
  active_products: number;
  weighted_rating: number;
  rating_count: number;
  followers: number;
  is_new: boolean;
};

const PAGE_SIZE = 24;
const NEW_VENDOR_DAYS = 21;

/* -------------------- data -------------------- */

const directoryQuery = queryOptions({
  queryKey: ["vendor-directory-all-v1"],
  queryFn: async (): Promise<VendorDirEntry[]> => {
    // Pull all active vendors + their storefront banner + their aggregated product stats,
    // then aggregate follower count. We cap at 500 which is well above the 50-store target.
    const [{ data: vendors, error: vErr }, storefrontsRes, productsRes, followsRes] =
      await Promise.all([
        supabase
          .from("vendors")
          .select("id, slug, name, type, logo_url, description, boost_score, pinned_until, created_at, status")
          .eq("status", "active")
          .limit(500),
        supabase.from("vendor_storefronts").select("vendor_id, banner_url"),
        supabase
          .from("products")
          .select("vendor_id, rating_average, rating_count")
          .eq("status", "active"),
        supabase.rpc("get_follower_counts"),
      ]);
    if (vErr) throw vErr;
    if (storefrontsRes.error) throw storefrontsRes.error;
    if (productsRes.error) throw productsRes.error;
    if (followsRes.error) throw followsRes.error;

    const bannerBy = new Map<string, string | null>();
    for (const s of storefrontsRes.data ?? []) bannerBy.set(s.vendor_id, s.banner_url);

    type Agg = { count: number; ratingSum: number; ratingCountSum: number };
    const aggBy = new Map<string, Agg>();
    for (const p of productsRes.data ?? []) {
      if (!p.vendor_id) continue;
      const a = aggBy.get(p.vendor_id) ?? { count: 0, ratingSum: 0, ratingCountSum: 0 };
      a.count += 1;
      const rc = Number(p.rating_count ?? 0);
      const ra = Number(p.rating_average ?? 0);
      a.ratingSum += ra * rc;
      a.ratingCountSum += rc;
      aggBy.set(p.vendor_id, a);
    }

    const followBy = new Map<string, number>();
    for (const f of followsRes.data ?? []) {
      followBy.set(f.vendor_id, (followBy.get(f.vendor_id) ?? 0) + 1);
    }

    const now = Date.now();
    const bayesM = 5; // prior review count
    const bayesC = 3.5; // prior mean

    return (vendors ?? []).map((v): VendorDirEntry => {
      const a = aggBy.get(v.id) ?? { count: 0, ratingSum: 0, ratingCountSum: 0 };
      const weighted =
        a.ratingCountSum > 0
          ? (a.ratingSum + bayesM * bayesC) / (a.ratingCountSum + bayesM)
          : bayesC;
      const ageDays = (now - new Date(v.created_at).getTime()) / 86_400_000;
      return {
        id: v.id,
        slug: v.slug,
        name: v.name,
        type: v.type as "internal" | "external",
        logo_url: v.logo_url,
        description: v.description,
        banner_url: bannerBy.get(v.id) ?? null,
        boost_score: Number(v.boost_score ?? 0),
        pinned_until: v.pinned_until,
        created_at: v.created_at,
        active_products: a.count,
        weighted_rating: weighted,
        rating_count: a.ratingCountSum,
        followers: followBy.get(v.id) ?? 0,
        is_new: ageDays <= NEW_VENDOR_DAYS,
      };
    });
  },
  staleTime: 60_000,
});

/* -------------------- route -------------------- */

export const Route = createFileRoute("/boutiques")({
  validateSearch: (raw: Record<string, unknown>): BoutiquesSearch => searchSchema.parse(raw),
  loader: ({ context }) => context.queryClient.ensureQueryData(directoryQuery),
  head: () => {
    const title = "Nos boutiques — Vendeurs vérifiés du marketplace Winstorr";
    const description =
      "Découvrez toutes les boutiques Winstorr : vendeurs vérifiés par Wintek, filtrables par popularité, note et nouveauté. Livraison au Cameroun, paiement Mobile Money.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: "/boutiques" }],
    };
  },
  component: BoutiquesDirectory,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl p-8">
      <EmptyState
        title="Impossible de charger les boutiques"
        description={error.message}
        icon={StoreIcon}

      />
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl p-8">
      <EmptyState title="Aucune boutique" icon={StoreIcon} />
    </div>
  ),
});

/* -------------------- component -------------------- */

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "popular", label: "Popularité" },
  { value: "rating", label: "Mieux notées" },
  { value: "recent", label: "Nouveautés" },
  { value: "name", label: "Ordre alphabétique" },
];

function sortVendors(vs: VendorDirEntry[], sort: SortKey): VendorDirEntry[] {
  const nowMs = Date.now();
  const pinnedActive = (v: VendorDirEntry) =>
    v.pinned_until && new Date(v.pinned_until).getTime() > nowMs;

  const sorted = vs.slice();
  switch (sort) {
    case "rating":
      sorted.sort((a, b) => b.weighted_rating - a.weighted_rating || b.rating_count - a.rating_count);
      break;
    case "recent":
      sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name, "fr"));
      break;
    case "popular":
    default:
      sorted.sort((a, b) => b.boost_score - a.boost_score);
      break;
  }
  // Pinned vendors always appear first (regardless of sort) — editorial control.
  const pinned = sorted.filter(pinnedActive).sort((a, b) => {
    return (b.pinned_until ? +new Date(b.pinned_until) : 0) - (a.pinned_until ? +new Date(a.pinned_until) : 0);
  });
  const rest = sorted.filter((v) => !pinnedActive(v));
  return [...pinned, ...rest];
}

function BoutiquesDirectory() {
  const { data: allVendors } = useSuspenseQuery(directoryQuery);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const sort: SortKey = search.sort ?? "popular";
  const page = search.page ?? 1;
  const q = (search.q ?? "").toLowerCase();

  const filtered = q
    ? allVendors.filter(
        (v) => v.name.toLowerCase().includes(q) || (v.description ?? "").toLowerCase().includes(q),
      )
    : allVendors;

  const ordered = sortVendors(filtered, sort);
  const totalPages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  const pageItems = ordered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const setSearch = (patch: Partial<{ q: string | undefined; sort: SortKey | undefined; page: number | undefined }>) => {
    void navigate({
      to: "/boutiques",
      search: (prev: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...prev, ...patch };
        // Reset page whenever filter/sort changes
        if ("q" in patch || "sort" in patch) delete next.page;
        // Strip defaults so URLs stay clean
        Object.keys(next).forEach((k) => {
          if (next[k] === undefined || next[k] === "" || next[k] === "popular" || next[k] === 1) {
            delete next[k];
          }
        });
        return next;
      },
    });
  };

  return (
    <div className="bg-background">
      {/* Header band */}
      <section className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-8 md:py-10">
          <div className="text-[11px] uppercase tracking-[0.16em] text-primary-foreground/70">
            Marketplace Winstorr
          </div>
          <h1 className="mt-1 font-display text-3xl md:text-4xl">Nos boutiques</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-primary-foreground/85 md:text-base">
            {allVendors.length} vendeur{allVendors.length > 1 ? "s" : ""} vérifié
            {allVendors.length > 1 ? "s" : ""} par Wintek. Chaque boutique respecte notre engagement qualité.
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search.q ?? ""}
              onChange={(e) => setSearch({ q: e.target.value || undefined })}
              placeholder="Rechercher une boutique…"
              className="h-10 w-full rounded-sm border border-border bg-background pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50"
              aria-label="Rechercher une boutique"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Trier par :</span>
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setSearch({ sort: o.value })}
                className={cn(
                  "rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors",
                  sort === o.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-secondary/60",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-7xl px-4 py-6">
        {pageItems.length === 0 ? (
          <EmptyState
            title="Aucune boutique ne correspond"
            description="Essayez d’autres mots-clés ou changez de tri."
            icon={StoreIcon}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((v) => (
              <VendorCard key={v.id} v={v} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={clampedPage <= 1}
              onClick={() => setSearch({ page: clampedPage - 1 })}
            >
              Précédent
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {clampedPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={clampedPage >= totalPages}
              onClick={() => setSearch({ page: clampedPage + 1 })}
            >
              Suivant
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function VendorCard({ v }: { v: VendorDirEntry }) {
  const pinned = v.pinned_until && new Date(v.pinned_until).getTime() > Date.now();
  return (
    <Link
      to="/boutiques/$vendorSlug"
      params={{ vendorSlug: v.slug }}
      className="group flex flex-col overflow-hidden rounded-sm border border-border bg-card transition-colors hover:border-secondary/60 no-link-color"
    >
      {/* Banner */}
      <div className="relative aspect-[16/6] w-full overflow-hidden bg-gradient-to-br from-primary to-secondary">
        {v.banner_url ? (
          <img
            src={v.banner_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute right-2 top-2 flex flex-wrap items-center gap-1">
          {pinned && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
              <Sparkles className="h-2.5 w-2.5" /> Mise en avant
            </span>
          )}
          {v.is_new && !pinned && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-success px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              Nouveau
            </span>
          )}
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-1 items-start gap-3 p-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-sm border border-border bg-background text-primary">
          {v.logo_url ? (
            <img src={v.logo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <StoreIcon className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-bold text-foreground group-hover:text-secondary">
              {v.name}
            </h3>
            {v.type === "internal" && (
              <span className="inline-flex items-center gap-0.5 rounded-sm bg-secondary/10 px-1 py-px text-[10px] font-semibold text-secondary">
                <ShieldCheck className="h-2.5 w-2.5" /> Officiel
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground min-h-[2.4em]">
            {v.description ?? "Boutique du marketplace Winstorr."}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5 text-foreground">
              <Star className="h-3 w-3 fill-accent text-accent" />
              <span className="font-semibold">{v.weighted_rating.toFixed(1)}</span>
              {v.rating_count > 0 && <span className="text-muted-foreground">· {v.rating_count} avis</span>}
            </span>
            <span>·</span>
            <span>{v.active_products} produit{v.active_products > 1 ? "s" : ""}</span>
            {v.followers > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Users className="h-3 w-3" /> {v.followers}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
