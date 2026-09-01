import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, HandCoins, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SkeletonTableRows } from "@/components/skeletons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatFcfa } from "@/lib/format";
import { useHomeDeliverySettings } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/reversements")({
  component: CourierReconciliation,
});

type Row = {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  shipping_fee: number;
  subtotal: number;
  status: string;
  payment_status: string;
  created_at: string;
  courier_collected_amount: number | null;
  courier_collected_at: string | null;
  courier_remitted_at: string | null;
};

type Filter = "all" | "to_deliver" | "pending_remittance" | "remitted";

const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("fr-FR") : "—");

function CourierReconciliation() {
  const qc = useQueryClient();
  const { data: settings } = useHomeDeliverySettings();
  const [filter, setFilter] = useState<Filter>("pending_remittance");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["courier-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, total, shipping_fee, subtotal, status, payment_status, created_at, courier_collected_amount, courier_collected_at, courier_remitted_at")
        .eq("delivery_mode", "home_delivery")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const confirmDelivery = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc("confirm_courier_delivery", { _order_id: orderId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Livraison confirmée — paiement encaissé par le coursier.");
      qc.invalidateQueries({ queryKey: ["courier-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markRemitted = useMutation({
    mutationFn: async ({ id, remitted }: { id: string; remitted: boolean }) => {
      const { error } = await supabase.rpc("mark_courier_remitted", { _order_id: id, _remitted: remitted });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reversement mis à jour.");
      qc.invalidateQueries({ queryKey: ["courier-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "to_deliver") return !r.courier_collected_at && r.status !== "cancelled";
      if (filter === "pending_remittance") return !!r.courier_collected_at && !r.courier_remitted_at;
      if (filter === "remitted") return !!r.courier_remitted_at;
      return true;
    });
  }, [rows, filter]);

  const outstanding = rows
    .filter((r) => r.courier_collected_at && !r.courier_remitted_at)
    .reduce((n, r) => n + Number(r.courier_collected_amount ?? r.total), 0);
  const remitted = rows
    .filter((r) => r.courier_remitted_at)
    .reduce((n, r) => n + Number(r.courier_collected_amount ?? r.total), 0);

  const courier = settings?.courier_name ?? "Intello Express";

  const tabs: { k: Filter; label: string }[] = [
    { k: "to_deliver", label: "À livrer / en cours" },
    { k: "pending_remittance", label: "En attente de reversement" },
    { k: "remitted", label: "Reversé" },
    { k: "all", label: "Toutes" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-sm border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HandCoins className="h-4 w-4 text-accent" /> À recevoir de {courier}
          </div>
          <div className="mt-1 text-2xl font-bold text-accent">{formatFcfa(outstanding)}</div>
          <p className="mt-1 text-xs text-muted-foreground">Argent encaissé par le coursier, pas encore reversé à Winstorr.</p>
        </div>
        <div className="rounded-sm border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BadgeCheck className="h-4 w-4 text-success" /> Déjà reversé
          </div>
          <div className="mt-1 text-2xl font-bold">{formatFcfa(remitted)}</div>
          <p className="mt-1 text-xs text-muted-foreground">Total des montants reçus du coursier.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setFilter(t.k)}
            className={cn(
              "rounded-sm border px-3 py-1.5 text-xs font-medium",
              filter === t.k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-sm border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Commande</th>
              <th className="p-2">Client</th>
              <th className="p-2">Produits</th>
              <th className="p-2">Livraison</th>
              <th className="p-2">Encaissé</th>
              <th className="p-2">Reversement</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <SkeletonTableRows rows={6} cols={7} />}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucune commande dans cette vue.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-muted/50">
                <td className="p-2 font-medium whitespace-nowrap">
                  <Link to="/admin/commandes" className="hover:underline">{r.order_number}</Link>
                  <div className="text-xs text-muted-foreground">{d(r.created_at)}</div>
                </td>
                <td className="p-2">{r.customer_name}</td>
                <td className="p-2 whitespace-nowrap">{formatFcfa(Number(r.subtotal))}</td>
                <td className="p-2 whitespace-nowrap">{formatFcfa(Number(r.shipping_fee))}</td>
                <td className="p-2 whitespace-nowrap">
                  {r.courier_collected_at ? (
                    <>
                      <div className="font-semibold">{formatFcfa(Number(r.courier_collected_amount ?? r.total))}</div>
                      <div className="text-xs text-muted-foreground">{d(r.courier_collected_at)}</div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pas encore livré</span>
                  )}
                </td>
                <td className="p-2 whitespace-nowrap">
                  {r.courier_remitted_at ? (
                    <span className="text-success text-xs font-medium">Reversé le {d(r.courier_remitted_at)}</span>
                  ) : r.courier_collected_at ? (
                    <span className="text-accent text-xs font-medium">En attente</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {!r.courier_collected_at && (
                      <ConfirmDialog
                        destructive={false}
                        title="Confirmer la livraison et l'encaissement ?"
                        description={`Le coursier a livré la commande ${r.order_number} et encaissé ${formatFcfa(Number(r.total))}. La réception sera confirmée et les fonds vendeur libérés.`}
                        confirmLabel="Confirmer"
                        onConfirm={() => confirmDelivery.mutateAsync(r.id)}
                        trigger={
                          <Button size="sm" variant="outline">
                            <Truck className="mr-1 h-3.5 w-3.5" /> Livrée & encaissée
                          </Button>
                        }
                      />
                    )}
                    {r.courier_collected_at && !r.courier_remitted_at && (
                      <Button size="sm" onClick={() => markRemitted.mutate({ id: r.id, remitted: true })}>
                        Marquer comme reversé
                      </Button>
                    )}
                    {r.courier_remitted_at && (
                      <Button size="sm" variant="outline" onClick={() => markRemitted.mutate({ id: r.id, remitted: false })}>
                        Annuler
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Les frais de livraison ne font pas partie du revenu vendeur et ne sont pas commissionnables : la commission
        est calculée uniquement sur le montant des produits.
      </p>
    </div>
  );
}
