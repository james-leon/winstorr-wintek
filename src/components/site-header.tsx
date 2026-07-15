import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Menu, Search, MapPin, ChevronDown, Package, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/format";
import { NavigationDrawer } from "@/components/navigation-drawer";
import icon from "@/assets/winstorr-icon.png.asset.json";

type CatSel = "all" | ProductType;

const CAT_OPTIONS: { value: CatSel; label: string }[] = [
  { value: "all", label: "Toutes catégories" },
  { value: "physical", label: "Produits physiques" },
  { value: "digital", label: "Numérique" },
  { value: "service", label: "Services" },
  { value: "training", label: "Formations" },
];

const TYPE_LINKS: { type: ProductType; label: string }[] = [
  { type: "physical", label: "Produits physiques" },
  { type: "digital", label: "Numérique" },
  { type: "service", label: "Services" },
  { type: "training", label: "Formations" },
];

export function SiteHeader() {
  const { count } = useCart();
  const { user, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CatSel>("all");

  const { data: topCategories = [] } = useQuery({
    queryKey: ["header-top-categories-v2"],
    queryFn: async () => {
      // Only truly top-level "department" categories (display_order >= 20)
      // — excludes legacy subcategory-like entries (Téléphones, Logiciels, etc.)
      const { data } = await supabase
        .from("categories")
        .select("id,name,slug,product_type,parent_id,display_order,status")
        .is("parent_id", null)
        .eq("status", "active")
        .gte("display_order", 20)
        .order("display_order", { ascending: true })
        .limit(8);
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });


  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const search: Record<string, string> = {};
    if (q.trim()) search.q = q.trim();
    if (cat !== "all") search.type = cat;
    void navigate({ to: "/catalogue", search });
  };

  const firstName = user?.user_metadata?.name?.split(" ")?.[0] || user?.email?.split("@")?.[0];

  return (
    <>
      <header className="sticky top-0 z-40 text-white" style={{ background: "var(--color-header)" }}>
        {/* Row 1 — main near-black bar */}
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 md:gap-3">
          {/* Mobile: hamburger next to logo */}
          <button
            className="md:hidden grid h-10 w-10 place-items-center rounded-sm hover:bg-white/10"
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link to="/" className="flex items-center gap-2 shrink-0 no-link-color" aria-label="Winstorr — Accueil">
            <img src={icon.url} alt="" className="h-8 md:h-10 w-auto" />
            <span className="hidden sm:flex flex-col leading-none">
              <span className="font-display text-xl md:text-2xl tracking-wide text-white">Winstorr</span>
              <span className="text-[9px] md:text-[10px] font-semibold tracking-[0.2em] mt-0.5" style={{ color: "#FF7A18" }}>ECOMMERCE</span>
            </span>
          </Link>

          {/* Delivery — desktop */}
          <Link
            to="/catalogue"
            className="hidden lg:flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[11px] leading-tight text-white/80 hover:ring-1 hover:ring-white/40 no-link-color"
          >
            <MapPin className="h-5 w-5 shrink-0" />
            <span className="flex flex-col">
              <span className="text-[10px] text-white/60">Votre adresse de livraison</span>
              <span className="text-xs font-semibold text-white">Cameroun</span>
            </span>
          </Link>

          {/* Search — dominant, desktop */}
          <form
            onSubmit={submit}
            className="hidden md:flex flex-1 max-w-3xl items-stretch rounded-md overflow-hidden bg-background text-foreground focus-within:ring-2 focus-within:ring-white/70"
          >
            <div className="relative flex items-center border-r border-border bg-muted">
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value as CatSel)}
                aria-label="Catégorie de recherche"
                className="h-11 appearance-none bg-transparent pl-3 pr-7 text-xs font-medium text-foreground/80 focus:outline-none cursor-pointer"
              >
                {CAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher sur Winstorr"
              className="flex-1 h-11 px-3 text-sm bg-background focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Rechercher"
              className="grid place-items-center h-11 w-14 text-white hover:brightness-110 transition"
              style={{ background: "var(--gradient-winstorr)" }}
            >
              <Search className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </form>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            {user ? (
              <div className="hidden md:flex flex-col leading-tight px-2 py-1 rounded-sm hover:ring-1 hover:ring-white/40 cursor-pointer" onClick={() => void signOut()} title="Déconnexion">
                <span className="text-[10px] text-white/70">Bonjour, {firstName}</span>
                <span className="text-xs font-semibold inline-flex items-center gap-0.5">
                  Compte <ChevronDown className="h-3 w-3" />
                </span>
              </div>
            ) : (
              <Link
                to="/auth"
                className="hidden md:flex flex-col leading-tight px-2 py-1 rounded-sm hover:ring-1 hover:ring-white/40 no-link-color"
              >
                <span className="text-[10px] text-white/70">Bonjour</span>
                <span className="text-xs font-semibold inline-flex items-center gap-0.5">
                  Identifiez-vous <ChevronDown className="h-3 w-3" />
                </span>
              </Link>
            )}

            <Link
              to="/mon-compte/commandes"
              className="hidden lg:flex flex-col leading-tight px-2 py-1 rounded-sm hover:ring-1 hover:ring-white/40 no-link-color"
            >
              <span className="text-[10px] text-white/70">Retours</span>
              <span className="text-xs font-semibold inline-flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> et commandes
              </span>
            </Link>

            {isStaff && (
              <Link
                to="/admin/produits"
                className="hidden md:inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-xs font-semibold hover:ring-1 hover:ring-white/40 no-link-color"
              >
                <LayoutDashboard className="h-4 w-4" /> Admin
              </Link>
            )}

            <Link
              to="/panier"
              className="flex items-end gap-1 rounded-sm px-2 py-1 hover:ring-1 hover:ring-white/40 no-link-color relative"
              aria-label="Panier"
            >
              <div className="relative">
                <ShoppingCart className="h-7 w-7" strokeWidth={2} />
                <span
                  className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white shadow"
                  style={{ background: "var(--gradient-winstorr)" }}
                >
                  {count}
                </span>
              </div>
              <span className="hidden md:inline text-xs font-semibold pb-0.5">Panier</span>
            </Link>
          </div>
        </div>

        {/* Mobile search — full width */}
        <div className="md:hidden px-3 pb-2">
          <form
            onSubmit={submit}
            className="flex items-stretch rounded-md overflow-hidden bg-background text-foreground"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher sur Winstorr"
              className="flex-1 h-10 px-3 text-sm focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Rechercher"
              className="grid place-items-center h-10 w-12 text-white"
              style={{ background: "var(--gradient-winstorr)" }}
            >
              <Search className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </form>
        </div>

        {/* Row 2 — category nav (desktop only) */}
        <div className="hidden md:block" style={{ background: "var(--color-header-alt)" }}>
          <nav className="mx-auto flex max-w-7xl items-center gap-0 px-3 h-10 overflow-x-auto">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 whitespace-nowrap"
            >
              <Menu className="h-4 w-4" /> Toutes
            </button>
            <span className="mx-1 h-4 w-px bg-white/20" />
            {TYPE_LINKS.map((n) => (
              <Link
                key={n.type}
                to="/catalogue"
                search={{ type: n.type } as never}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium text-white/85 hover:text-white hover:bg-white/10 no-link-color whitespace-nowrap",
                )}
              >
                {n.label}
              </Link>
            ))}
            <Link
              to="/boutiques"
              className="px-3 py-1.5 text-xs font-medium text-white/85 hover:text-white hover:bg-white/10 no-link-color whitespace-nowrap"
            >
              Nos boutiques
            </Link>
            <span className="mx-1 h-4 w-px bg-white/20" />

            {topCategories.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                to="/catalogue"
                search={{ type: c.product_type as ProductType } as never}
                className="px-3 py-1.5 text-xs text-white/75 hover:text-white hover:bg-white/10 no-link-color whitespace-nowrap"
              >
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
