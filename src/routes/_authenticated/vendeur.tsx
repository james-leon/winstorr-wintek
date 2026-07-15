import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useMyVendors } from "@/lib/vendor";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/vendeur")({
  component: VendorLayout,
});

const TABS = [
  { to: "/vendeur/tableau-de-bord", label: "Tableau de bord" },
  { to: "/vendeur/produits", label: "Produits" },
  { to: "/vendeur/commandes", label: "Commandes" },
  { to: "/vendeur/boutique", label: "Ma boutique" },
  { to: "/vendeur/revenus", label: "Revenus" },
  { to: "/vendeur/codes-promo", label: "Codes promo" },
  { to: "/vendeur/questions", label: "Questions" },
  { to: "/vendeur/annonces", label: "Annonces" },
];

function VendorLayout() {
  const { loading: authLoading } = useAuth();
  const { data: memberships, isPending, isFetching, isSuccess, isError, error } = useMyVendors();
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Wait explicitly for BOTH auth to be ready AND the membership query to have succeeded.
  if (authLoading || isPending || isFetching) {
    return <div className="p-8 text-center text-muted-foreground">Chargement de votre espace vendeur…</div>;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-display text-2xl text-foreground">Erreur</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Impossible de vérifier votre accès vendeur. {error instanceof Error ? error.message : ""}
        </p>
      </div>
    );
  }

  // Query succeeded but no vendor membership found — do NOT silently redirect;
  // show a clear message so the bug is visible instead of bouncing to /.
  if (isSuccess && (!memberships || memberships.length === 0)) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-display text-2xl text-foreground">Accès vendeur requis</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre compte n'est rattaché à aucun vendeur. Contactez l'administrateur si vous pensez qu'il s'agit d'une erreur.
        </p>
        <Link to="/" className="mt-6 inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Retour à l'accueil
        </Link>
      </div>
    );
  }

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
