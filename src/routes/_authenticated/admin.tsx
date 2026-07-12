import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const TABS = [
  { to: "/admin/produits", label: "Produits" },
  { to: "/admin/commandes", label: "Commandes" },
  { to: "/admin/avis", label: "Avis" },
  { to: "/admin/sessions", label: "Sessions" },
  { to: "/admin/demandes", label: "Demandes" },
];

function AdminLayout() {
  const { isStaff, loading } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !isStaff) void nav({ to: "/" });
  }, [loading, isStaff, nav]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  if (!isStaff) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-foreground">Administration</h1>
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
