import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatFcfa } from "@/lib/format";
import { useMyVendors } from "@/lib/vendor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vendeur/commandes")({
  component: VendorOrders,
});

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "En attente", paid: "Payée", processing: "En préparation",
  shipped: "Expédiée", delivered: "Livrée", completed: "Terminée",
  cancelled: "Annulée", payment_failed: "Paiement échoué",
};

function VendorOrders() {
  const { data: memberships } = useMyVendors();
  const vendorId = memberships?.[0]?.vendor_id;
  const [selected, setSelected] = useState<any>(null);

  const { data } = useQuery({
    queryKey: ["vendor-orders", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, product_name, quantity, unit_price, subtotal, product_type, order_id, orders!inner(id, order_number, customer_name, status, payment_status, total, created_at, has_physical_items, shipping_address)")
        .eq("vendor_id", vendorId!)
        .order("created_at", { referencedTable: "orders", ascending: false })
        .limit(300);
      if (error) throw error;
      // Group by order_id
      const map = new Map<string, { order: any; items: any[]; vendorSubtotal: number }>();
      for (const row of (data ?? []) as any[]) {
        const key = row.order_id;
        if (!map.has(key)) map.set(key, { order: row.orders, items: [], vendorSubtotal: 0 });
        const bucket = map.get(key)!;
        bucket.items.push(row);
        bucket.vendorSubtotal += Number(row.subtotal ?? 0);
      }
      return Array.from(map.values());
    },
  });

  return (
    <div>
      <div className="mb-3 text-sm text-muted-foreground">
        Lecture seule · seules les lignes contenant vos produits sont visibles.
      </div>
      <div className="rounded-sm border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">N°</th><th className="p-2">Client</th>
              <th className="p-2">Vos articles</th><th className="p-2">Sous-total</th>
              <th className="p-2">Statut</th><th className="p-2">Date</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.map((g) => (
              <tr key={g.order.id} className="hover:bg-muted/50">
                <td className="p-2 font-mono">{g.order.order_number}</td>
                <td className="p-2">{g.order.customer_name}</td>
                <td className="p-2 text-xs">{g.items.length} ligne(s) · {g.items.reduce((s, i) => s + (i.quantity ?? 0), 0)} unité(s)</td>
                <td className="p-2 font-bold text-accent">{formatFcfa(g.vendorSubtotal)}</td>
                <td className="p-2"><span className={cn("rounded-sm px-2 py-0.5 text-xs", g.order.status === "paid" || g.order.status === "delivered" ? "bg-success/10 text-success" : g.order.status === "payment_failed" || g.order.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-muted")}>{STATUS_LABEL[g.order.status] ?? g.order.status}</span></td>
                <td className="p-2 text-xs text-muted-foreground">{new Date(g.order.created_at).toLocaleDateString("fr-FR")}</td>
                <td className="p-2"><Button size="sm" variant="outline" onClick={() => setSelected(g)}>Détails</Button></td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucune commande.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Commande {selected?.order.order_number}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><strong>Client :</strong> {selected.order.customer_name}</div>
              {selected.order.has_physical_items && selected.order.shipping_address && (
                <div>
                  <strong>Livraison :</strong> {selected.order.shipping_address.quartier}, {selected.order.shipping_address.ville}
                  {selected.order.shipping_address.landmark && <> — {selected.order.shipping_address.landmark}</>}
                </div>
              )}
              <div>
                <strong>Vos articles :</strong>
                <ul className="mt-1 divide-y divide-border rounded-sm border border-border">
                  {selected.items.map((it: any) => (
                    <li key={it.id} className="p-2 flex justify-between">
                      <span>{it.product_name} × {it.quantity}</span>
                      <span className="font-medium">{formatFcfa(Number(it.subtotal))}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <strong>Sous-total (vos articles)</strong>
                <span className="font-bold text-accent">{formatFcfa(selected.vendorSubtotal)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Le suivi (expédition, livraison) reste géré par l'équipe Wintek pour l'instant.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
