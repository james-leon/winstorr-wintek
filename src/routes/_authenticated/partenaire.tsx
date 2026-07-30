import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useMyFinancingPartners } from "@/lib/financing";

export const Route = createFileRoute("/_authenticated/partenaire")({
  component: PartnerLayout,
});

const TABS = [
  { to: "/partenaire/tableau-de-bord", label: "Demandes de financement" },
  { to: "/partenaire/profil", label: "Ma configuration" },
];

function PartnerLayout() {
  const { loading: authLoading } = useAuth();
  const { data: memberships, isPending, isFetching, isError, error } = useMyFinancingPartners();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (authLoading || isPending || isFetching) {
    return <div className="p-8 text-center text-muted-foreground">Chargement de votre espace partenaire…</div>;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-display text-2xl text-foreground">Erreur</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Impossible de vérifier votre accès partenaire. {error instanceof Error ? error.message : ""}
        </p>
      </div>
    );
  }

  if (!memberships || memberships.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-display text-2xl text-foreground">Accès partenaire requis</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre compte n'est rattaché à aucun partenaire financier. Contactez l'administrateur Winstorr.
        </p>
        <Link to="/" className="mt-6 inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const current = memberships[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Espace partenaire financier</h1>
        <p className="text-sm text-muted-foreground">{current.partner.name} · {current.role}</p>
      </div>
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const active = path.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
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
