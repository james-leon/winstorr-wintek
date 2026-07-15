import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { XCircle, Loader2, Package, Download, UserPlus, Wallet, Store, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/format";
import { initiatePayment, mockConfirmPayment } from "@/lib/orders.functions";
import { toast } from "sonner";
import { SuccessCheckmark } from "@/components/success-checkmark";
import { TrustStrip } from "@/components/trust-strip";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";


export const Route = createFileRoute("/commande/$orderNumber/confirmation")({
  head: () => ({ meta: [{ title: "Confirmation de commande — Winstorr" }] }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { orderNumber } = Route.useParams();

  const { data, refetch } = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: async () => {
      const [{ data: order, error: e1 }, { data: items, error: e2 }] = await Promise.all([
        supabase.rpc("get_order_by_number", { _order_number: orderNumber }),
        supabase.rpc("get_order_items_by_number", { _order_number: orderNumber }),
      ]);
      if (e1) throw e1; if (e2) throw e2;
      return { order: order?.[0] ?? null, items: items ?? [] };
    },
    refetchInterval: (q) => {
      const st = q.state.data?.order?.payment_status;
      return st === "pending" ? 3000 : false;
    },
  });

  const retryFn = useServerFn(initiatePayment);
  const mockFn = useServerFn(mockConfirmPayment);
  const retry = useMutation({
    mutationFn: () => retryFn({ data: { orderNumber } }),
    onSuccess: (r) => { window.location.href = r.paymentUrl; },
    onError: (e: Error) => toast.error(e.message),
  });
  const mock = useMutation({
    mutationFn: () => mockFn({ data: { orderNumber } }),
    onSuccess: () => { toast.success("Paiement simulé confirmé."); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">Chargement…</div>;
  }
  if (!data.order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Commande introuvable</h1>
        <Button asChild className="mt-6"><Link to="/">Retour à l'accueil</Link></Button>
      </div>
    );
  }

  const { order, items } = data;
  const isPaid = order.payment_status === "paid";
  const isFailed = order.payment_status === "failed";
  const isPending = order.payment_status === "pending";
  const isCash = (order as any).payment_method === "cash_on_pickup";
  const isPickup = (order as any).delivery_mode === "pickup";

  const { user } = useAuth();
  const [dismissedNudge, setDismissedNudge] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-sm border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          {isPaid && <SuccessCheckmark />}
          {isFailed && <XCircle className="h-14 w-14 text-destructive" />}
          {isPending && <Loader2 className="h-14 w-14 text-secondary animate-spin" />}
          <div>
            <h1 className="font-display text-2xl text-foreground">
              {isPaid && "Merci pour votre commande !"}
              {isFailed && "Paiement échoué"}
              {isPending && "Paiement en cours de vérification…"}
            </h1>
            <p className="text-sm text-muted-foreground">Commande n° <span className="font-mono">{order.order_number}</span></p>
          </div>
        </div>

        {isPaid && !user && !dismissedNudge && (
          <div className="mt-4 flex items-start gap-3 rounded-sm border border-secondary/30 bg-secondary/5 p-3">
            <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">Créez un compte pour suivre votre commande</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Retrouvez cette commande et vos futures livraisons dans votre espace personnel.
              </p>
              <div className="mt-2 flex gap-2">
                <Button asChild size="sm" variant="outline" className="h-8">
                  <Link to="/auth">Créer mon compte</Link>
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setDismissedNudge(true)}>
                  Plus tard
                </Button>
              </div>
            </div>
          </div>
        )}


        {isFailed && (
          <div className="mt-4 flex gap-2">
            <Button onClick={() => retry.mutate()} disabled={retry.isPending} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Réessayer le paiement
            </Button>
            <Button asChild variant="outline"><Link to="/panier">Retour au panier</Link></Button>
          </div>
        )}

        {isPending && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">Nous vérifions votre paiement automatiquement. Cette page se met à jour toute seule.</p>
            {import.meta.env.DEV && (
              <Button variant="outline" size="sm" onClick={() => mock.mutate()} disabled={mock.isPending}>
                (Dev) Simuler paiement réussi
              </Button>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <div className="text-muted-foreground">Total</div>
            <div className="text-lg font-bold text-accent">{formatFcfa(Number(order.total))}</div>
            {Number(order.discount_amount ?? 0) > 0 && (
              <div className="mt-1 text-xs text-success">
                Économie : {formatFcfa(Number(order.discount_amount))}{order.coupon_code ? ` (${order.coupon_code})` : ""}
              </div>
            )}
          </div>

          <div>
            <div className="text-muted-foreground">Contact</div>
            <div>{order.customer_name}</div>
            {order.customer_email && <div className="text-muted-foreground text-xs">{order.customer_email}</div>}
          </div>
          {order.has_physical_items && order.shipping_address && (
            <div className="sm:col-span-2">
              <div className="text-muted-foreground">Livraison</div>
              <div>
                {(order.shipping_address as any).quartier}, {(order.shipping_address as any).ville}
                {(order.shipping_address as any).landmark && <> — {(order.shipping_address as any).landmark}</>}
              </div>
              {isPaid && <div className="text-xs text-success mt-1">Livraison sous 24-72h dans votre ville.</div>}
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <h2 className="font-semibold mb-2">Articles</h2>
          <ul className="divide-y divide-border">
            {items.map((it: any) => (
              <li key={it.id} className="py-2 flex justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium">{it.product_name} <span className="text-muted-foreground">× {it.quantity}</span></div>
                  {isPaid && it.product_type === "digital" && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-secondary">
                      <Download className="h-3.5 w-3.5" /> Instructions d'accès envoyées par email
                    </div>
                  )}
                  {isPaid && it.product_type === "physical" && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Package className="h-3.5 w-3.5" /> À expédier
                    </div>
                  )}
                </div>
                <div className="whitespace-nowrap font-medium">{formatFcfa(Number(it.subtotal))}</div>
              </li>
            ))}
          </ul>
        </div>

        {isPaid && (
          <div className="mt-6 rounded-sm border border-border bg-muted/30 p-3">
            <TrustStrip />
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button asChild variant="outline"><Link to="/catalogue">Continuer mes achats</Link></Button>
          <Button asChild variant="ghost"><Link to="/mon-compte/commandes">Mes commandes</Link></Button>
        </div>
      </div>
    </div>

  );
}
