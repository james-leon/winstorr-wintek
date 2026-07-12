import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, MapPin, Heart, Settings, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/mon-compte/")({
  head: () => ({ meta: [{ title: "Mon compte — Winstorr" }, { name: "robots", content: "noindex" }] }),
  component: AccountHome,
});

function AccountHome() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data: stats } = useQuery({
    queryKey: ["account-stats", uid],
    enabled: !!uid,
    queryFn: async () => {
      const [orders, addrs, wl, profile] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("customer_addresses").select("id", { count: "exact", head: true }).eq("customer_id", uid!),
        supabase.from("wishlist_items").select("id", { count: "exact", head: true }).eq("customer_id", uid!),
        supabase.from("profiles").select("full_name, phone").eq("id", uid!).maybeSingle(),
      ]);
      return {
        orders: orders.count ?? 0,
        addresses: addrs.count ?? 0,
        wishlist: wl.count ?? 0,
        profile: profile.data ?? null,
      };
    },
  });

  const cards = [
    { to: "/mon-compte/commandes", icon: Package, title: "Mes commandes", value: stats?.orders ?? 0, hint: "commandes" },
    { to: "/mon-compte/adresses", icon: MapPin, title: "Adresses enregistrées", value: stats?.addresses ?? 0, hint: "adresses" },
    { to: "/mon-compte/liste-de-souhaits", icon: Heart, title: "Liste de souhaits", value: stats?.wishlist ?? 0, hint: "articles" },
    { to: "/mon-compte/profil", icon: Settings, title: "Profil", value: stats?.profile?.full_name ?? "—", hint: "" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Bienvenue</p>
        <p className="font-display text-xl text-foreground">
          {stats?.profile?.full_name || user?.email}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group flex items-center gap-3 rounded-sm border border-border bg-card p-4 hover:border-secondary/60 no-link-color"
          >
            <div className="grid h-10 w-10 place-items-center rounded-sm bg-primary/10 text-primary">
              <c.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{c.title}</p>
              <p className="text-base font-semibold text-foreground truncate">
                {c.value} <span className="text-xs font-normal text-muted-foreground">{c.hint}</span>
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-secondary" />
          </Link>
        ))}
      </div>
    </div>
  );
}
