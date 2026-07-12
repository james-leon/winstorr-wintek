import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, User as UserIcon, Menu, X, LayoutDashboard, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 no-link-color">
      <span className="grid h-8 w-8 place-items-center rounded-sm bg-primary text-primary-foreground font-display text-base">
        W
      </span>
      <span className="font-display text-lg tracking-wide text-primary hidden sm:inline">Winstorr</span>
    </Link>
  );
}

const nav = [
  { to: "/catalogue" as const, label: "Tous les produits" },
  { to: "/catalogue" as const, label: "Électronique", search: { type: "physical" as const } },
  { to: "/catalogue" as const, label: "Numérique", search: { type: "digital" as const } },
  { to: "/catalogue" as const, label: "Services", search: { type: "service" as const } },
  { to: "/catalogue" as const, label: "Formations", search: { type: "training" as const } },
];

export function SiteHeader() {
  const { count } = useCart();
  const { user, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void navigate({ to: "/catalogue", search: { q: q || undefined } });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      {/* Top row — logo, search, account */}
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-3">
        <Logo />

        <form onSubmit={submit} className="relative flex-1 max-w-3xl mx-2">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un produit, un service, une formation…"
            className="h-9 pl-8 pr-3 text-sm rounded-sm"
          />
        </form>

        <div className="flex items-center gap-0.5">
          {isStaff && (
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex h-8 px-2 text-xs">
              <Link to="/admin/produits">
                <LayoutDashboard className="h-4 w-4" /> Admin
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="icon" aria-label="Panier" className="h-8 w-8">
            <Link to="/catalogue">
              <div className="relative">
                <ShoppingCart className="h-4 w-4" />
                {count > 0 && (
                  <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                    {count}
                  </span>
                )}
              </div>
            </Link>
          </Button>
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => void signOut()} className="h-8 px-2 text-xs hidden sm:inline-flex">
              <UserIcon className="h-4 w-4" /> Sortir
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs hidden sm:inline-flex">
              <Link to="/auth">
                <UserIcon className="h-4 w-4" /> Connexion
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Bottom nav — dense category strip */}
      <div className="hidden md:block border-t border-border bg-muted/40">
        <nav className="mx-auto flex max-w-7xl items-center gap-0 px-3 h-9 overflow-x-auto">
          {nav.map((n, i) => (
            <Link
              key={i}
              to={n.to}
              search={n.search as never}
              className="px-3 py-1.5 text-xs font-medium text-foreground/80 hover:text-primary hover:bg-background transition-colors whitespace-nowrap"
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className={cn("md:hidden overflow-hidden border-t border-border transition-all", open ? "max-h-96" : "max-h-0")}>
        <nav className="flex flex-col gap-0.5 p-2">
          {nav.map((n, i) => (
            <Link
              key={i}
              to={n.to}
              search={n.search as never}
              onClick={() => setOpen(false)}
              className="rounded-sm px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              {n.label}
            </Link>
          ))}
          {!user && (
            <Link to="/auth" onClick={() => setOpen(false)} className="rounded-sm px-3 py-2 text-sm font-medium hover:bg-muted">
              Connexion
            </Link>
          )}
          {user && (
            <button onClick={() => { setOpen(false); void signOut(); }} className="rounded-sm px-3 py-2 text-left text-sm font-medium hover:bg-muted">
              Déconnexion
            </button>
          )}
          {isStaff && (
            <Link to="/admin/produits" onClick={() => setOpen(false)} className="rounded-sm px-3 py-2 text-sm font-medium hover:bg-muted">
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
