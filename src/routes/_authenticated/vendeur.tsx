import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMyVendors } from "@/lib/vendor";

export const Route = createFileRoute("/_authenticated/vendeur")({
  component: VendorLayout,
});

const TABS = [
  { to: "/vendeur/tableau-de-bord", label: "Tableau de bord" },
  { to: "/vendeur/produits", label: "Produits" },
  { to: "/vendeur/commandes", label: "Commandes" },
];

function VendorLayout() {
  const { data: memberships, isLoading } = useMyVendors();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!isLoading && memberships && memberships.length === 0) void nav({ to: "/" });
  }, [isLoading, memberships, nav]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  if (!memberships || memberships.length === 0) return null;

  const current = memberships[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground">Espace vendeur</h1>
          <p className="text-sm text-muted-foreground">{current.vendor.name} · {current.role}</p>
        </div>
      </div>
      <nav className="mb-6 flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => {
          const active = path.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
