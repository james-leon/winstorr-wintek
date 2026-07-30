import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ShoppingCart, TrendingUp, PackageX, MessageSquareWarning, UserPlus, Wallet,
  Plus, Wrench, Tag, ArrowRight, AlarmClock, CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFcfa } from "@/lib/format";
import { cn } from "@/lib/utils";
import { confirmCashPayment } from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "En attente", paid: "Payée", processing: "En préparation",
  shipped: "Expédiée", delivered: "Livrée", completed: "Terminée",
  cancelled: "Annulée", payment_failed: "Paiement échoué",
};

function AdminDashboard() {
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const warningThreshold = new Date(Date.now() + 4 * 3600000).toISOString();

      const [todayOrders, weekOrders, lowStock, pendingReviews, pendingInvites, staleCash, pendingShipments, newApplications, newFinancing] = await Promise.all([
        supabase.from("orders").select("id, total", { count: "exact" }).gte("created_at", startOfDay.toISOString()),
        supabase.from("orders").select("total").gte("created_at", weekAgo.toISOString()).neq("status", "cancelled"),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("type", "physical").eq("status", "active").lte("stock_quantity", 5),
        supabase.from("product_reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("vendor_invitations").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_method", "cash_on_pickup").eq("payment_status", "pending").lt("created_at", sevenDaysAgo),
        supabase.from("order_shipments").select("id", { count: "exact", head: true }).eq("acceptance_status", "pending_acceptance").lte("acceptance_deadline", warningThreshold),
        supabase.from("vendor_applications").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("financing_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);

      const todayCount = todayOrders.count ?? 0;
      const todayRevenue = (todayOrders.data ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
      const weekRevenue = (weekOrders.data ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
      return {
        todayCount,
        todayRevenue,
        weekRevenue,
        lowStock: lowStock.count ?? 0,
        pendingReviews: pendingReviews.count ?? 0,
        pendingInvites: pendingInvites.count ?? 0,
        staleCash: staleCash.count ?? 0,
        pendingShipments: pendingShipments.count ?? 0,
        newApplications: newApplications.count ?? 0,
        newFinancing: newFinancing.count ?? 0,
      };
    },
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["admin-dashboard-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, payment_method, total, customer_name, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const confirmCashFn = useServerFn(confirmCashPayment);
  const cashMut = useMutation({
    mutationFn: (orderId: string) => confirmCashFn({ data: { orderId, notes: null } }),
    onSuccess: () => {
      toast.success("Paiement confirmé.");
      qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-recent"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = [
    { label: "Commandes aujourd'hui", value: String(stats?.todayCount ?? "—"), icon: ShoppingCart, tint: "text-primary" },
    { label: "CA aujourd'hui", value: stats ? formatFcfa(stats.todayRevenue) : "—", icon: TrendingUp, tint: "text-accent" },
    { label: "CA 7 derniers jours", value: stats ? formatFcfa(stats.weekRevenue) : "—", icon: TrendingUp, tint: "text-success" },
    { label: "Stock faible", value: String(stats?.lowStock ?? "—"), icon: PackageX, tint: "text-destructive", to: "/admin/produits" },
    { label: "Avis à modérer", value: String(stats?.pendingReviews ?? "—"), icon: MessageSquareWarning, tint: "text-secondary", to: "/admin/avis" },
    { label: "Candidatures vendeur", value: String(stats?.newApplications ?? "—"), icon: UserPlus, tint: "text-primary", to: "/admin/candidatures-vendeurs" },
    { label: "Invitations vendeur", value: String(stats?.pendingInvites ?? "—"), icon: UserPlus, tint: "text-primary", to: "/admin/vendeurs" },
    { label: "Espèces en attente 7j+", value: String(stats?.staleCash ?? "—"), icon: Wallet, tint: "text-accent", to: "/admin/commandes" },
    { label: "Demandes financement", value: String(stats?.newFinancing ?? "—"), icon: CreditCard, tint: "text-accent", to: "/admin/financement" },
    { label: "Expéditions à confirmer <4h", value: String(stats?.pendingShipments ?? "—"), icon: AlarmClock, tint: "text-destructive" },
  ];

  const shortcuts = [
    { to: "/admin/produits", label: "Ajouter un produit", icon: Plus },
    { to: "/admin/demandes", label: "Demandes en attente", icon: Wrench },
    { to: "/admin/codes-promo", label: "Créer un code promo", icon: Tag },
    { to: "/admin/commandes", label: "Confirmer paiements espèces", icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble de votre marketplace.</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        {cards.map((c) => {
          const Icon = c.icon;
          const inner = (
            <div className="rounded-lg border border-border bg-card p-3 h-full transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">{c.label}</div>
                <Icon className={cn("h-4 w-4 shrink-0", c.tint)} />
              </div>
              <div className="mt-2 text-lg font-bold text-foreground truncate">{c.value}</div>
            </div>
          );
          return c.to ? (
            <Link key={c.label} to={c.to} className="no-link-color">{inner}</Link>
          ) : (
            <div key={c.label}>{inner}</div>
          );
        })}
      </div>

      {/* Shortcuts */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.to + s.label}
              to={s.to}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-sm font-medium no-link-color hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <Icon className="h-4 w-4 text-primary" />
              <span className="flex-1">{s.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          );
        })}
      </div>

      {/* Recent orders */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h2 className="text-sm font-semibold text-foreground">Commandes récentes</h2>
          <Link to="/admin/commandes" className="text-xs text-primary hover:underline">Voir toutes →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">N°</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Paiement</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recentOrders ?? []).map((o) => (
                <tr key={o.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{o.order_number}</td>
                  <td className="px-3 py-2">{o.customer_name}</td>
                  <td className="px-3 py-2 font-semibold text-accent">{formatFcfa(Number(o.total))}</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded-sm px-2 py-0.5 text-xs",
                      o.status === "paid" || o.status === "delivered" || o.status === "completed" ? "bg-success/10 text-success" :
                      o.status === "cancelled" || o.status === "payment_failed" ? "bg-destructive/10 text-destructive" : "bg-muted")}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {o.payment_method === "cash_on_pickup" ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-accent/10 text-accent px-1.5 py-0.5">
                        <Wallet className="h-3 w-3" /> Espèces
                      </span>
                    ) : (
                      <span className="text-muted-foreground">CinetPay</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {o.payment_method === "cash_on_pickup" && o.payment_status !== "paid" ? (
                      <button
                        onClick={() => cashMut.mutate(o.id)}
                        disabled={cashMut.isPending}
                        className="text-xs font-medium text-success hover:underline"
                      >
                        Marquer payée
                      </button>
                    ) : (
                      <Link to="/admin/commandes" className="text-xs text-primary hover:underline">Voir</Link>
                    )}
                  </td>
                </tr>
              ))}
              {(!recentOrders || recentOrders.length === 0) && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucune commande.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
