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
        <aside className="min-w-0 md:sticky md:top-4 md:self-start">
          <div className="relative md:contents">
            <nav
              className={cn(
                "flex gap-1 rounded-sm border border-border bg-card p-1",
                "overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                "md:flex-col md:overflow-visible",
              )}
            >
              {NAV.map((n) => {
                const active = n.exact ? path === n.to : path === n.to || path.startsWith(n.to + "/");
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-sm px-3 py-2 text-sm no-link-color whitespace-nowrap",
                      active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{n.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent md:hidden"
            />
          </div>
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
