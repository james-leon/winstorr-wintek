import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, User as UserIcon, Menu, X, LayoutDashboard, Search, MapPin, ChevronDown, Package } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/format";

type CatSel = "all" | ProductType;

const CAT_OPTIONS: { value: CatSel; label: string }[] = [
  { value: "all", label: "Tout" },
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

function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center no-link-color shrink-0", className)}>
      <span className="font-display text-xl md:text-2xl tracking-wide text-background">
        Winstorr
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { count } = useCart();
  const { user, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CatSel>("all");

  const { data: topCategories = [] } = useQuery({
    queryKey: ["header-top-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id,name,slug,product_type,parent_id,display_order")
        .is("parent_id", null)
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
    <header className="sticky top-0 z-40">
      {/* Row 1 — main navy bar */}
      <div className="bg-primary text-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 md:gap-4">
          <Logo />

          {/* Delivery — desktop only, subtle */}
          <Link
            to="/catalogue"
            className="hidden lg:flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] leading-tight text-background/80 hover:ring-1 hover:ring-background/40 no-link-color"
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="flex flex-col">
              <span className="text-[10px] text-background/60">Livraison à</span>
              <span className="text-xs font-semibold text-background">Douala</span>
            </span>
          </Link>

          {/* Search — dominant */}
          <form
            onSubmit={submit}
            className="hidden md:flex flex-1 max-w-3xl items-stretch rounded-sm overflow-hidden bg-background text-foreground focus-within:ring-2 focus-within:ring-accent"
          >
            <div className="relative flex items-center border-r border-border bg-muted">
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value as CatSel)}
                aria-label="Catégorie de recherche"
                className="h-10 appearance-none bg-transparent pl-2.5 pr-7 text-xs font-medium text-foreground/80 focus:outline-none cursor-pointer"
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
              placeholder="Rechercher un produit, une marque..."
              className="flex-1 h-10 px-3 text-sm bg-background focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Rechercher"
              className="grid place-items-center h-10 w-12 bg-accent text-accent-foreground hover:brightness-95 transition"
            >
              <Search className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </form>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            {user ? (
              <div className="hidden md:flex flex-col leading-tight px-2 py-1 rounded-sm hover:ring-1 hover:ring-background/40 cursor-pointer" onClick={() => void signOut()} title="Déconnexion">
                <span className="text-[10px] text-background/70">Bonjour, {firstName}</span>
                <span className="text-xs font-semibold inline-flex items-center gap-0.5">
                  Compte <ChevronDown className="h-3 w-3" />
                </span>
              </div>
            ) : (
              <Link
                to="/auth"
                className="hidden md:flex flex-col leading-tight px-2 py-1 rounded-sm hover:ring-1 hover:ring-background/40 no-link-color"
              >
                <span className="text-[10px] text-background/70">Bonjour</span>
                <span className="text-xs font-semibold inline-flex items-center gap-0.5">
                  Se connecter <ChevronDown className="h-3 w-3" />
                </span>
              </Link>
            )}

            <Link
              to="/mon-compte"
              className="hidden lg:flex flex-col leading-tight px-2 py-1 rounded-sm hover:ring-1 hover:ring-background/40 no-link-color"
            >
              <span className="text-[10px] text-background/70">Compte</span>
              <span className="text-xs font-semibold inline-flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> Mon espace
              </span>
            </Link>

            {isStaff && (
              <Link
                to="/admin/produits"
                className="hidden md:inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-xs font-semibold hover:ring-1 hover:ring-background/40 no-link-color"
              >
                <LayoutDashboard className="h-4 w-4" /> Admin
              </Link>
            )}

            <Link
              to="/panier"
              className="flex items-end gap-1 rounded-sm px-2 py-1 hover:ring-1 hover:ring-background/40 no-link-color"
              aria-label="Panier"
            >
              <div className="relative">
                <ShoppingCart className="h-6 w-6" strokeWidth={2} />
                <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  {count}
                </span>
              </div>
              <span className="hidden md:inline text-xs font-semibold pb-0.5">Panier</span>
            </Link>

            {/* Mobile menu button */}
            <button
              className="md:hidden grid h-9 w-9 place-items-center rounded-sm hover:ring-1 hover:ring-background/40"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile search — full width row */}
        <div className="md:hidden px-3 pb-2">
          <form
            onSubmit={submit}
            className="flex items-stretch rounded-sm overflow-hidden bg-background text-foreground"
          >
            <div className="relative flex items-center border-r border-border bg-muted">
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value as CatSel)}
                aria-label="Catégorie"
                className="h-10 appearance-none bg-transparent pl-2 pr-6 text-[11px] font-medium focus:outline-none"
              >
                {CAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-muted-foreground" />
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher..."
              className="flex-1 h-10 px-3 text-sm focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Rechercher"
              className="grid place-items-center h-10 w-11 bg-accent text-accent-foreground"
            >
              <Search className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </form>
        </div>
      </div>

      {/* Row 2 — category bar (lighter navy) */}
      <div className="hidden md:block" style={{ background: "#16406E" }}>
        <nav className="mx-auto flex max-w-7xl items-center gap-0 px-3 h-9 overflow-x-auto">
          <Link
            to="/catalogue"
            className="px-3 py-1.5 text-xs font-semibold text-background/90 hover:text-background hover:bg-background/10 no-link-color whitespace-nowrap"
          >
            Tous les produits
          </Link>
          {TYPE_LINKS.map((n) => (
            <Link
              key={n.type}
              to="/catalogue"
              search={{ type: n.type }}
              className="px-3 py-1.5 text-xs font-medium text-background/85 hover:text-background hover:bg-background/10 no-link-color whitespace-nowrap"
            >
              {n.label}
            </Link>
          ))}
          <span className="mx-1 h-4 w-px bg-background/20" />
          {topCategories.slice(0, 6).map((c) => (
            <Link
              key={c.id}
              to="/catalogue"
              search={{ type: c.product_type as ProductType }}
              className="px-3 py-1.5 text-xs text-background/75 hover:text-background hover:bg-background/10 no-link-color whitespace-nowrap"
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "md:hidden overflow-hidden bg-primary text-background transition-all border-t border-background/10",
          mobileOpen ? "max-h-[500px]" : "max-h-0",
        )}
      >
        <nav className="flex flex-col gap-0.5 p-2">
          <Link to="/catalogue" onClick={() => setMobileOpen(false)} className="rounded-sm px-3 py-2 text-sm font-semibold hover:bg-background/10 no-link-color">
            Tous les produits
          </Link>
          {TYPE_LINKS.map((n) => (
            <Link
              key={n.type}
              to="/catalogue"
              search={{ type: n.type }}
              onClick={() => setMobileOpen(false)}
              className="rounded-sm px-3 py-2 text-sm hover:bg-background/10 no-link-color"
            >
              {n.label}
            </Link>
          ))}
          {topCategories.length > 0 && (
            <>
              <div className="mt-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-background/60">Catégories</div>
              {topCategories.map((c) => (
                <Link
                  key={c.id}
                  to="/catalogue"
                  search={{ type: c.product_type as ProductType }}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-sm px-3 py-2 text-sm text-background/85 hover:bg-background/10 no-link-color"
                >
                  {c.name}
                </Link>
              ))}
            </>
          )}
          <div className="my-2 h-px bg-background/15" />
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-background/60">Compte</div>
          {!user && (
            <Link to="/auth" onClick={() => setMobileOpen(false)} className="rounded-sm px-3 py-2 text-sm font-semibold hover:bg-background/10 no-link-color">
              <UserIcon className="inline h-4 w-4 mr-1" /> Se connecter
            </Link>
          )}
          {user && (
            <>
              <div className="px-3 py-1 text-xs text-background/80">Bonjour, <span className="font-semibold text-background">{firstName}</span></div>
              <Link to="/mon-compte" onClick={() => setMobileOpen(false)} className="rounded-sm px-3 py-2 text-sm hover:bg-background/10 no-link-color">
                <UserIcon className="inline h-4 w-4 mr-1" /> Mon compte
              </Link>
              <Link to="/mon-compte/commandes" onClick={() => setMobileOpen(false)} className="rounded-sm px-3 py-2 text-sm hover:bg-background/10 no-link-color">
                <Package className="inline h-4 w-4 mr-1" /> Mes commandes
              </Link>
              <button
                onClick={() => { setMobileOpen(false); void signOut(); }}
                className="rounded-sm px-3 py-2 text-left text-sm font-semibold hover:bg-background/10"
              >
                Déconnexion
              </button>
            </>
          )}
          {isStaff && (
            <Link to="/admin/produits" onClick={() => setMobileOpen(false)} className="rounded-sm px-3 py-2 text-sm font-semibold hover:bg-background/10 no-link-color">
              <LayoutDashboard className="inline h-4 w-4 mr-1" /> Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
