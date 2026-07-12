import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { User as UserIcon, Package, MapPin, Heart, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mon-compte")({
  head: () => ({ meta: [{ title: "Mon compte — Winstorr" }, { name: "robots", content: "noindex" }] }),
  component: AccountLayout,
});

const NAV: { to: string; label: string; icon: typeof UserIcon; exact?: boolean }[] = [
  { to: "/mon-compte", label: "Aperçu", icon: UserIcon, exact: true },
  { to: "/mon-compte/commandes", label: "Mes commandes", icon: Package },
  { to: "/mon-compte/adresses", label: "Mes adresses", icon: MapPin },
  { to: "/mon-compte/liste-de-souhaits", label: "Liste de souhaits", icon: Heart },
  { to: "/mon-compte/profil", label: "Profil", icon: Settings },
];

function AccountLayout() {
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4">
        <h1 className="font-display text-2xl text-foreground">Mon compte</h1>
        {user?.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
      </div>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-4 md:self-start">
          <nav className="rounded-sm border border-border bg-card p-1 flex md:flex-col overflow-x-auto md:overflow-visible">
            {NAV.map((n) => {
              const active = n.exact ? path === n.to : path === n.to || path.startsWith(n.to + "/");
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-3 py-2 text-sm no-link-color whitespace-nowrap",
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
