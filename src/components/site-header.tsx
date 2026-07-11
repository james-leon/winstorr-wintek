import { Link } from "@tanstack/react-router";
import { ShoppingCart, User as UserIcon, Menu, X, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground font-display text-lg">
        W
      </span>
      <span className="font-display text-xl tracking-wide text-primary">Winstorr</span>
    </Link>
  );
}

const nav = [
  { to: "/", label: "Accueil" },
  { to: "/catalogue", label: "Catalogue" },
  { to: "/catalogue", label: "Services", search: { type: "service" as const } },
  { to: "/catalogue", label: "Formations", search: { type: "training" as const } },
];

export function SiteHeader() {
  const { count } = useCart();
  const { user, isStaff, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n, i) => (
            <Link
              key={i}
              to={n.to}
              search={n.search as never}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          {isStaff && (
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link to="/admin/produits">
                <LayoutDashboard className="h-4 w-4" /> Admin
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="icon" aria-label="Panier">
            <Link to="/catalogue">
              <div className="relative">
                <ShoppingCart className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                    {count}
                  </span>
                )}
              </div>
            </Link>
          </Button>
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <UserIcon className="h-4 w-4" /> Déconnexion
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">
                <UserIcon className="h-4 w-4" /> Connexion
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div className={cn("md:hidden overflow-hidden border-t border-border transition-all", open ? "max-h-96" : "max-h-0")}>
        <nav className="flex flex-col gap-1 p-3">
          {nav.map((n, i) => (
            <Link
              key={i}
              to={n.to}
              search={n.search as never}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              {n.label}
            </Link>
          ))}
          {isStaff && (
            <Link
              to="/admin/produits"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
