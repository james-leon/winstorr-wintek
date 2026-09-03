import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  XCircle, Loader2, Package, Download, UserPlus, Wallet, Store, MapPin,
  Smartphone, CreditCard, Clock, Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFcfa } from "@/lib/format";
import { reconcileOrderPayment } from "@/lib/payments.functions";
import { startCampayPayment } from "@/lib/payments.functions";
import { toast } from "sonner";
import { SuccessCheckmark } from "@/components/success-checkmark";
import { TrustStrip } from "@/components/trust-strip";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { waTemplates } from "@/lib/whatsapp";
import { useSupportWhatsApp } from "@/lib/use-support-whatsapp";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** How long we keep the customer on the reassuring waiting screen. */
const WAIT_TIMEOUT_MS = 3 * 60 * 1000;

export const Route = createFileRoute("/commande/$orderNumber/confirmation")({
  head: () => ({
    meta: [
      { title: "Confirmation de commande — Winstorr" },
      { name: "description", content: "Suivez la confirmation de votre paiement et de votre commande Winstorr." },
      { property: "og:title", content: "Confirmation de commande — Winstorr" },
      { property: "og:description", content: "Suivez la confirmation de votre paiement et de votre commande Winstorr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { orderNumber } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const supportPhone = useSupportWhatsApp();
  const [dismissedNudge, setDismissedNudge] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [retryPhone, setRetryPhone] = useState("");
  const startedAt = useRef<number>(Date.now());

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
    refetchInterval: (q) => (q.state.data?.order?.payment_status === "pending" ? 3000 : false),
  });

  // Server-side reconciliation (webhook fallback): the browser never decides payment status.
  const reconcileFn = useServerFn(reconcileOrderPayment);
  const reconcile = useMutation({
    mutationFn: () => reconcileFn({ data: { orderNumber } }),
    onSuccess: () => { void refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const startPayFn = useServerFn(startCampayPayment);
  const retry = useMutation({
    mutationFn: (mode: "momo" | "card") =>
      startPayFn({ data: { orderNumber, mode, phone: mode === "momo" ? retryPhone || null : null } }),
    onSuccess: (r) => {
      if (r.mode === "redirect" && r.link) { window.location.href = r.link; return; }
      startedAt.current = Date.now();
      setTimedOut(false);
      toast.success(t("payment.processingHint"));
      void refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const order = data?.order;
  const items = data?.items ?? [];
  const isCash = (order as any)?.payment_method === "cash_on_pickup";
  const isPaid = order?.payment_status === "paid";
  const isFailed = order?.payment_status === "failed";
  const isPending = order?.payment_status === "pending";
  const isProcessing = Boolean(isPending && !isCash);

  // Poll the server while the payment is being confirmed, then stop at the timeout.
  useEffect(() => {
    if (!isProcessing || timedOut) return;
    reconcile.mutate();
    const id = setInterval(() => {
      if (Date.now() - startedAt.current > WAIT_TIMEOUT_MS) { setTimedOut(true); return; }
      reconcile.mutate();
    }, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, timedOut, orderNumber]);

  if (!data) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">Chargement…</div>;
  }
  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Commande introuvable</h1>
        <Button asChild className="mt-6"><Link to="/">Retour à l'accueil</Link></Button>
      </div>
    );
  }

  const isPickup = (order as any).delivery_mode === "pickup";
  const hasDigital = items.some((it: any) => it.product_type === "digital");

  /* ---------------- Processing / waiting screen ---------------- */
  if (isProcessing && !timedOut) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-10 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary/20" />
          <span className="absolute inline-flex h-16 w-16 rounded-full bg-secondary/10" />
          <Loader2 className="relative h-12 w-12 animate-spin text-secondary" />
        </div>
        <h1 className="mt-6 font-display text-2xl text-foreground">{t("payment.processingTitle")}</h1>
        <p className="mt-2 text-sm text-foreground">{t("payment.processingHint")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t("payment.doNotClose")}</p>

        <div className="mt-5 w-full rounded-sm border border-border bg-card p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{t("payment.orderRef")}</span>
            <span className="font-mono">{order.order_number}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold text-accent">{formatFcfa(Number(order.total))}</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={() => reconcile.mutate()}
          disabled={reconcile.isPending}
        >
          {reconcile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("payment.checkNow")}
        </Button>
        <div className="mt-3">
          <TrustStrip className="items-center" compact />
        </div>
      </div>
    );
  }

  /* ---------------- Timeout (still pending) ---------------- */
  if (isProcessing && timedOut) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <Clock className="mx-auto h-14 w-14 text-secondary" />
        <h1 className="mt-4 font-display text-2xl text-foreground">{t("payment.timeoutTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("payment.timeoutBody")}</p>
        <p className="mt-3 text-sm">
          {t("payment.orderRef")} <span className="font-mono">{order.order_number}</span>
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => { startedAt.current = Date.now(); setTimedOut(false); }}>
            {t("payment.checkNow")}
          </Button>
          <Button asChild variant="outline"><Link to="/mon-compte/commandes">{t("payment.viewOrder")}</Link></Button>
          {supportPhone && (
            <WhatsAppButton
              phone={supportPhone}
              message={waTemplates.customerToSupport({ order_number: order.order_number })}
              label="Nous contacter sur WhatsApp"
            />
          )}
        </div>
      </div>
    );
  }

  /* ---------------- Failure ---------------- */
  if (isFailed) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="text-center">
          <XCircle className="mx-auto h-14 w-14 text-destructive" />
          <h1 className="mt-4 font-display text-2xl text-foreground">{t("payment.failTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("payment.failBody")}</p>
          <p className="mt-3 text-sm">
            {t("payment.orderRef")} <span className="font-mono">{order.order_number}</span> —{" "}
            <span className="font-bold text-accent">{formatFcfa(Number(order.total))}</span>
          </p>
        </div>

        <div className="mt-6 space-y-3 rounded-sm border border-border bg-card p-4">
          <label className="block text-sm font-medium" htmlFor="retry-phone">{t("checkout.momoPhone")}</label>
          <Input
            id="retry-phone"
            inputMode="tel"
            placeholder="6XX XX XX XX"
            value={retryPhone}
            onChange={(e) => setRetryPhone(e.target.value)}
          />
          <Button
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => retry.mutate("momo")}
            disabled={retry.isPending}
          >
            {retry.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
            {t("payment.retryMomo")}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => retry.mutate("card")} disabled={retry.isPending}>
            <CreditCard className="mr-2 h-4 w-4" /> {t("payment.retryCard")}
          </Button>
          {!hasDigital && (
            <p className="text-xs text-muted-foreground">
              {t("checkout.payOnDelivery")} : contactez-nous pour basculer cette commande en paiement à la réception.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button asChild variant="ghost"><Link to="/panier">Retour au panier</Link></Button>
          {supportPhone && (
            <WhatsAppButton
              phone={supportPhone}
              message={waTemplates.customerToSupport({ order_number: order.order_number })}
              label="Nous contacter sur WhatsApp"
            />
          )}
        </div>
      </div>
    );
  }

  /* ---------------- Success (paid) or cash order recorded ---------------- */
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-sm border border-border bg-card p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <SuccessCheckmark />
          <div>
            <h1 className="font-display text-xl sm:text-2xl text-foreground">
              {isPaid ? t("payment.successTitle") : "Commande enregistrée !"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("payment.orderRef")} <span className="font-mono">{order.order_number}</span>
            </p>
          </div>
        </div>

        {isCash && isPending && (
          <div className="mt-4 flex items-start gap-3 rounded-sm border border-accent/40 bg-accent/5 p-3">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div className="text-sm">
              <div className="font-medium text-foreground">{t("payment.methodCash")}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isPickup
                  ? "Réglez le montant en espèces au point de retrait lors du retrait de votre commande."
                  : "Réglez le montant en espèces à notre livreur à la livraison."}
              </p>
            </div>
          </div>
        )}

        {isPickup && (order as any).pickup_point_name && (
          <div className="mt-4 flex items-start gap-3 rounded-sm border border-secondary/30 bg-secondary/5 p-3">
            <Store className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
            <div className="text-sm">
              <div className="font-medium text-foreground">{t("payment.nextPickup")} — {(order as any).pickup_point_name}</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {(order as any).pickup_point_address}, {(order as any).pickup_point_city}
              </div>
              {(order as any).pickup_point_hours && (
                <div className="mt-0.5 text-xs text-muted-foreground">{(order as any).pickup_point_hours}</div>
              )}
              {(order as any).pickup_point_phone && (
                <div className="mt-0.5 text-xs text-muted-foreground">Tel : {(order as any).pickup_point_phone}</div>
              )}
            </div>
          </div>
        )}

        {!isPickup && order.has_physical_items && (
          <div className="mt-4 flex items-start gap-3 rounded-sm border border-secondary/30 bg-secondary/5 p-3 text-sm">
            <Truck className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
            <div className="font-medium text-foreground">{t("payment.nextDelivery")}</div>
          </div>
        )}

        {isPaid && hasDigital && (
          <div className="mt-4 flex items-start gap-3 rounded-sm border border-success/40 bg-success/5 p-3 text-sm">
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div className="font-medium text-foreground">{t("payment.digitalDelivery")}</div>
          </div>
        )}

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

        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Total</div>
            <div className="text-lg font-bold text-accent">{formatFcfa(Number(order.total))}</div>
            {Number(order.discount_amount ?? 0) > 0 && (
              <div className="mt-1 text-xs text-success">
                Économie : {formatFcfa(Number(order.discount_amount))}{order.coupon_code ? ` (${order.coupon_code})` : ""}
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              {t("payment.paidWith")} : {isCash ? t("payment.methodCash") : t("payment.methodCampay")}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground">Contact</div>
            <div>{order.customer_name}</div>
            {order.customer_email && <div className="text-xs text-muted-foreground">{order.customer_email}</div>}
          </div>
          {order.has_physical_items && order.shipping_address && (
            <div className="sm:col-span-2">
              <div className="text-muted-foreground">Livraison</div>
              <div>
                {(order.shipping_address as any).quartier}, {(order.shipping_address as any).ville}
                {(order.shipping_address as any).landmark && <> — {(order.shipping_address as any).landmark}</>}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <h2 className="mb-2 font-semibold">Articles</h2>
          <ul className="divide-y divide-border">
            {items.map((it: any) => (
              <li key={it.id} className="flex justify-between gap-3 py-2 text-sm">
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

        <div className="mt-6 rounded-sm border border-border bg-muted/30 p-3">
          <TrustStrip />
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/mon-compte/commandes">{t("payment.viewOrder")}</Link>
          </Button>
          <Button asChild variant="outline"><Link to="/catalogue">{t("payment.continueShopping")}</Link></Button>
          {supportPhone && (
            <WhatsAppButton
              phone={supportPhone}
              message={waTemplates.customerToSupport({ order_number: order.order_number })}
              label="Nous contacter sur WhatsApp"
            />
          )}
        </div>
      </div>
    </div>
  );
}
