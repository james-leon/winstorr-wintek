// Server-only helpers for order notifications (email + SMS).
// - Email: uses Resend if RESEND_API_KEY is configured, otherwise logs to console.
// - SMS: currently a stub — swap the provider call in `sendSms` when credentials arrive.

type OrderEvent =
  | "payment_confirmed"
  | "payment_failed"
  | "shipped"
  | "delivered";

type OrderCore = {
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  total: number | string;
  currency: string;
  has_physical_items: boolean;
};

const APP_URL = () => process.env.APP_PUBLIC_URL || "";

function buildMessage(event: OrderEvent, o: OrderCore) {
  const url = `${APP_URL()}/commande/${o.order_number}/confirmation`;
  switch (event) {
    case "payment_confirmed":
      return {
        subject: `Commande ${o.order_number} confirmée`,
        text: `Merci ${o.customer_name} ! Votre commande ${o.order_number} (${o.total} ${o.currency}) est confirmée. ${
          o.has_physical_items
            ? "Livraison sous 24-72h."
            : "Instructions d'accès envoyées par email."
        } Suivi : ${url}`,
      };
    case "payment_failed":
      return {
        subject: `Paiement échoué pour la commande ${o.order_number}`,
        text: `${o.customer_name}, le paiement de la commande ${o.order_number} n'a pas abouti. Vous pouvez réessayer ici : ${url}`,
      };
    case "shipped":
      return {
        subject: `Votre commande ${o.order_number} est en route`,
        text: `Bonne nouvelle ${o.customer_name} — votre commande ${o.order_number} est expédiée. Suivi : ${url}`,
      };
    case "delivered":
      return {
        subject: `Commande ${o.order_number} livrée`,
        text: `${o.customer_name}, votre commande ${o.order_number} a été livrée. Comment s'est passée l'expérience ? Laissez un avis : ${url}`,
      };
  }
}

async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[notifications:email:mock] to=${to} subject="${subject}"`);
    return { sent: false, mocked: true };
  }
  const from = process.env.RESEND_FROM || "Winstorr <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) {
    console.error("[notifications:email] failed", res.status, await res.text());
    return { sent: false, mocked: false };
  }
  return { sent: true, mocked: false };
}

async function sendSms(to: string, text: string) {
  // TODO: wire real provider (local aggregator or Twilio). Keep the signature stable
  // so swapping providers is a one-file change.
  console.log(`[notifications:sms:mock] to=${to} msg="${text.slice(0, 80)}..."`);
  return { sent: false, mocked: true };
}

export type NotifyResult = { email: unknown; sms: unknown };

export async function notifyOrderEvent(orderId: string, event: OrderEvent): Promise<NotifyResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_number, customer_name, customer_email, customer_phone, total, currency, has_physical_items")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { email: null, sms: null };

  const msg = buildMessage(event, order as OrderCore);
  const [email, sms] = await Promise.all([
    order.customer_email ? sendEmail(order.customer_email, msg.subject, msg.text) : Promise.resolve(null),
    order.customer_phone ? sendSms(order.customer_phone, msg.text) : Promise.resolve(null),
  ]);
  return { email, sms };
}

export async function notifyReturnDecision(returnId: string, decision: "approved" | "rejected" | "refunded") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: r } = await supabaseAdmin
    .from("return_requests")
    .select("id, resolution_notes, refund_amount, order_id")
    .eq("id", returnId)
    .maybeSingle();
  if (!r) return;
  const { data: o } = await supabaseAdmin
    .from("orders")
    .select("order_number, customer_name, customer_email, customer_phone")
    .eq("id", r.order_id)
    .maybeSingle();
  if (!o) return;
  const label = decision === "approved" ? "approuvée" : decision === "rejected" ? "refusée" : "remboursée";
  const subject = `Votre demande de retour (${o.order_number}) est ${label}`;
  const text = `${o.customer_name}, votre demande de retour pour la commande ${o.order_number} a été ${label}.${
    r.refund_amount ? ` Montant remboursé : ${r.refund_amount} XAF.` : ""
  }${r.resolution_notes ? ` Note : ${r.resolution_notes}` : ""}`;
  await Promise.all([
    o.customer_email ? sendEmail(o.customer_email, subject, text) : Promise.resolve(null),
    o.customer_phone ? sendSms(o.customer_phone, text) : Promise.resolve(null),
  ]);
}
