import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatFcfa } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mon-compte/commandes")({
  head: () => ({ meta: [{ title: "Mes commandes — Winstorr" }] }),
  component: MyOrders,
});

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "En attente de paiement",
  paid: "Payée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  completed: "Terminée",
  cancelled: "Annulée",
  payment_failed: "Paiement échoué",
};
const STATUS_TONE: Record<string, string> = {
  paid: "bg-success/10 text-success",
  delivered: "bg-success/10 text-success",
  completed: "bg-success/10 text-success",
  shipped: "bg-secondary/10 text-secondary",
  processing: "bg-secondary/10 text-secondary",
  pending_payment: "bg-muted text-muted-foreground",
  payment_failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
};

function MyOrders() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, total, created_at, has_physical_items")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl text-foreground mb-4">Mes commandes</h1>
      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!isLoading && (!data || data.length === 0) && (
        <div className="rounded-sm border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Vous n'avez pas encore passé de commande.</p>
          <Link to="/catalogue" className="mt-3 inline-block text-secondary underline">Voir le catalogue</Link>
        </div>
      )}
      {data && data.length > 0 && (
        <div className="rounded-sm border border-border bg-card divide-y divide-border">
          {data.map((o) => (
            <Link
              key={o.id}
              to="/mon-compte/commandes/$orderNumber"
              params={{ orderNumber: o.order_number }}
              className="flex items-center justify-between gap-3 p-4 hover:bg-muted no-link-color"
            >
              <div>
                <div className="font-mono text-sm">{o.order_number}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("rounded-sm px-2 py-0.5 text-xs font-medium", STATUS_TONE[o.status] || "bg-muted")}>
                  {STATUS_LABEL[o.status] || o.status}
                </span>
                <span className="font-bold text-accent">{formatFcfa(Number(o.total))}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
