import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFcfa } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";


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
      {isLoading && (
        <div className="rounded-sm border border-border bg-card divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          icon={Package}
          title="Vous n'avez pas encore passé de commande"
          description="Découvrez notre sélection et commandez en quelques clics."
          action={<Button asChild><Link to="/catalogue">Voir le catalogue</Link></Button>}
        />
      )}

      {data && data.length > 0 && (
        <div className="rounded-sm border border-border bg-card divide-y divide-border">
          {data.map((o) => (
            <Link
              key={o.id}
              to="/mon-compte/commandes/$orderNumber"
              params={{ orderNumber: o.order_number }}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 hover:bg-muted no-link-color"
            >
              <div className="min-w-0">
                <div className="font-mono text-sm truncate">{o.order_number}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0 sm:flex-row sm:items-center sm:gap-3">
                <span className={cn("rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_TONE[o.status] || "bg-muted")}>
                  {STATUS_LABEL[o.status] || o.status}
                </span>
                <span className="font-bold text-accent whitespace-nowrap">{formatFcfa(Number(o.total))}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
