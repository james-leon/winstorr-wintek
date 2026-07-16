import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyVendors } from "@/lib/vendor";
import { formatFcfa } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vendeur/tableau-de-bord")({
  component: VendorDashboard,
});

function VendorDashboard() {
  const { data: memberships } = useMyVendors();
  const vendorId = memberships?.[0]?.vendor_id;

  const { data: stats } = useQuery({
    queryKey: ["vendor-dashboard", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const iso = startOfMonth.toISOString();

      const [prod, items] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true })
          .eq("vendor_id", vendorId!).eq("status", "active"),
        supabase.from("order_items")
          .select("id, quantity, subtotal, order_id, orders!inner(created_at, status, payment_status)")
          .eq("vendor_id", vendorId!)
          .gte("orders.created_at", iso)
          .neq("orders.status", "cancelled"),
      ]);
      if (prod.error) throw prod.error;
      if (items.error) throw items.error;
      const rows = items.data ?? [];
      const orderIds = new Set(rows.map((r: any) => r.order_id));
      const units = rows.reduce((s: number, r: any) => s + (r.quantity ?? 0), 0);
      const gross = rows.reduce((s: number, r: any) => s + Number(r.subtotal ?? 0), 0);
      return {
        activeProducts: prod.count ?? 0,
        ordersThisMonth: orderIds.size,
        unitsSold: units,
        gross,
      };
    },
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["vendor-recent-orders", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("order_id, orders!inner(id, order_number, customer_name, total, status, created_at)")
        .eq("vendor_id", vendorId!)
        .order("created_at", { referencedTable: "orders", ascending: false })
        .limit(20);
      if (error) throw error;
      const seen = new Set<string>();
      const out: any[] = [];
      for (const r of data ?? []) {
        if (seen.has(r.order_id)) continue;
        seen.add(r.order_id);
        out.push(r.orders);
        if (out.length >= 10) break;
      }
      return out;
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Produits actifs" value={stats?.activeProducts ?? "—"} />
        <StatCard label="Commandes ce mois" value={stats?.ordersThisMonth ?? "—"} />
        <StatCard label="Unités vendues" value={stats?.unitsSold ?? "—"} />
        <StatCard
          label="CA brut ce mois"
          value={stats ? formatFcfa(stats.gross) : "—"}
          hint="Avant commission"
        />
      </div>

      <div className="rounded-sm border border-border bg-card">
        <div className="border-b border-border p-3 text-sm font-medium">Commandes récentes</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">N°</th><th className="p-2">Client</th>
                <th className="p-2">Total</th><th className="p-2">Statut</th><th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recentOrders ?? []).map((o: any) => (
                <tr key={o.id}>
                  <td className="p-2 font-mono">{o.order_number}</td>
                  <td className="p-2">{o.customer_name}</td>
                  <td className="p-2 font-bold text-accent">{formatFcfa(Number(o.total))}</td>
                  <td className="p-2 text-xs">{o.status}</td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
              {(!recentOrders || recentOrders.length === 0) && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucune commande récente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-border text-right">
          <Link to="/vendeur/commandes" className="text-sm text-primary hover:underline">Voir toutes les commandes →</Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
