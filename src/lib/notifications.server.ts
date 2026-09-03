// Server-only helpers for order notifications.
// Email dispatch uses Resend if RESEND_API_KEY is configured, otherwise logs to console.
//
// SENDER: while your domain (winstorr.com) is being verified in Resend, we send from
// Resend's onboarding sender so tests work out of the box. Once your domain is verified
// in the Resend dashboard, set RESEND_FROM in project secrets to something like:
//   "Winstorr <notifications@winstorr.com>"
// and everything below will pick it up automatically — no code change needed.

import {
  SUPPORT_CITY,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_WHATSAPP_RAW,
} from "./site-contact";

export type Lang = "fr" | "en";

export type OrderItem = {
  product_name: string;
  product_type: string;
  quantity: number;
  subtotal: number | string;
  delivery_instructions?: string | null;
};

type OrderEvent =

  | "payment_confirmed"
  | "payment_failed"
  | "order_placed_cop" // cash-on-pickup order placed
  | "ready_for_pickup"
  | "shipped"
  | "delivered"
  | "cancelled";

type OrderCore = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  total: number | string;
  currency: string;
  has_physical_items: boolean;
  delivery_mode: string | null;
  pickup_point_id: string | null;
  notes: string | null;
};

type PickupPoint = {
  name: string;
  address: string;
  city: string;
  contact_phone: string | null;
  opening_hours: string | null;
};

const APP_URL = () => process.env.APP_PUBLIC_URL || "https://winstorr.com";

// ------- Branded HTML shell -------

const BRAND = {
  navy: "#14161A",
  cream: "#FBFAF6",
  accent: "#F2994A",
  success: "#2EC04E",
  text: "#1F2933",
  muted: "#6B7280",
  border: "#E5E7EB",
};

function htmlShell({
  preheader,
  heading,
  body,
  ctaLabel,
  ctaUrl,
  lang = "fr",
}: {
  preheader: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  lang?: Lang;
}) {
  const cta = ctaLabel && ctaUrl
    ? `<tr><td align="center" style="padding: 8px 24px 24px 24px;">
        <a href="${ctaUrl}" style="display:inline-block; background:${BRAND.accent}; color:#ffffff; text-decoration:none; font-weight:600; padding:12px 22px; border-radius:4px; font-size:15px;">${ctaLabel}</a>
      </td></tr>` : "";
  const footerNote = lang === "en"
    ? "You are receiving this email because you placed an order on Winstorr. Simply reply to this message if you need help."
    : "Vous recevez cet email car vous avez passé une commande sur Winstorr. Pour toute question, répondez simplement à ce message.";
  const tagline = lang === "en" ? "Trusted marketplace" : "Marketplace de confiance";
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Winstorr</title></head>
<body style="margin:0; padding:0; background:${BRAND.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif; color:${BRAND.text};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream}; padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border:1px solid ${BRAND.border}; border-radius:6px; overflow:hidden;">
        <tr><td style="background:${BRAND.navy}; padding:18px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:12px;" valign="middle">
              <img src="${APP_URL()}/icon-192.png" width="40" height="40" alt="Winstorr" style="display:block; border-radius:8px;">
            </td>
            <td valign="middle">
              <div style="font-family: 'Russo One', Impact, sans-serif; color:#ffffff; font-size:22px; letter-spacing:0.5px;">WINSTORR</div>
              <div style="color:#ffffff; opacity:0.7; font-size:11px; text-transform:uppercase; letter-spacing:1px;">${tagline}</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 12px 0; font-size:20px; color:${BRAND.navy};">${heading}</h1>
          <div style="font-size:15px; line-height:1.55; color:${BRAND.text};">${body}</div>
        </td></tr>
        ${cta}
        <tr><td style="padding:16px 24px; background:${BRAND.cream}; border-top:1px solid ${BRAND.border}; font-size:12px; color:${BRAND.muted};">
          ${footerNote}
          <br><br>
          WhatsApp / Tel : <a href="https://wa.me/${SUPPORT_WHATSAPP_RAW}" style="color:${BRAND.muted};">${SUPPORT_PHONE_DISPLAY}</a>
          · <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.muted};">${SUPPORT_EMAIL}</a>
          <br>
          <a href="${APP_URL()}" style="color:${BRAND.muted}; text-decoration:underline;">winstorr.com</a> · ${SUPPORT_CITY}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function money(v: number | string, currency: string) {
  const n = Number(v);
  return `${n.toLocaleString("fr-FR")} ${currency}`;
}

function orderUrl(orderNumber: string) {
  return `${APP_URL()}/commande/${orderNumber}/confirmation`;
}

function pickupBlock(pp: PickupPoint | null, lang: Lang = "fr") {
  if (!pp) return "";
  return `<div style="margin-top:16px; padding:12px; background:${BRAND.cream}; border:1px solid ${BRAND.border}; border-radius:4px;">
    <div style="font-weight:600; color:${BRAND.navy};">${pp.name}</div>
    <div style="color:${BRAND.text}; font-size:14px;">${pp.address}, ${pp.city}</div>
    ${pp.opening_hours ? `<div style="color:${BRAND.muted}; font-size:13px; margin-top:4px;">${pp.opening_hours}</div>` : ""}
    ${pp.contact_phone ? `<div style="color:${BRAND.muted}; font-size:13px;">${lang === "en" ? "Phone" : "Tel"} : ${pp.contact_phone}</div>` : ""}
  </div>`;
}

// Recap table of purchased items.
function itemsBlock(items: OrderItem[], currency: string, lang: Lang) {
  if (!items.length) return "";
  const rows = items
    .map(
      (it) => `<tr>
        <td style="padding:8px 0; border-bottom:1px solid ${BRAND.border}; font-size:14px; color:${BRAND.text};">
          ${escapeHtml(it.product_name)}${it.quantity > 1 ? ` <span style="color:${BRAND.muted};">× ${it.quantity}</span>` : ""}
        </td>
        <td align="right" style="padding:8px 0; border-bottom:1px solid ${BRAND.border}; font-size:14px; white-space:nowrap; color:${BRAND.text};">
          ${money(it.subtotal, currency)}
        </td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    <tr><td colspan="2" style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:${BRAND.muted}; padding-bottom:6px;">
      ${lang === "en" ? "Your order" : "Votre commande"}
    </td></tr>
    ${rows}
  </table>`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function digitalBlock(items: OrderItem[], lang: Lang) {
  const digital = items.filter((i) => i.product_type === "digital");
  if (!digital.length) return "";
  const lines = digital
    .map((d) => {
      const instr = d.delivery_instructions?.trim();
      return `<div style="margin-top:8px;"><strong>${escapeHtml(d.product_name)}</strong>${
        instr ? `<br><span style="font-size:14px;">${escapeHtml(instr).replace(/\n/g, "<br>")}</span>` : ""
      }</div>`;
    })
    .join("");
  return `<div style="margin-top:16px; padding:12px; background:${BRAND.cream}; border:1px solid ${BRAND.border}; border-radius:4px;">
    <div style="font-weight:600; color:${BRAND.navy};">${lang === "en" ? "Access to your digital product" : "Accès à votre produit numérique"}</div>
    ${lines}
    <div style="font-size:13px; color:${BRAND.muted}; margin-top:8px;">${
      lang === "en"
        ? "Your access is also available on your order page. If anything is missing, just reply to this email."
        : "Votre accès est également disponible sur la page de votre commande. S'il manque quoi que ce soit, répondez simplement à cet email."
    }</div>
  </div>`;
}


// ------- Message builders -------

function buildCustomerMessage(
  event: OrderEvent,
  o: OrderCore,
  pp: PickupPoint | null,
  items: OrderItem[] = [],
  lang: Lang = "fr",
) {
  const totalStr = money(o.total, o.currency);
  const firstName = o.customer_name.split(" ")[0];
  const nextStep = pp
    ? `Votre commande sera préparée puis mise à disposition au point de retrait <strong>${pp.name}</strong>. Nous vous préviendrons dès qu'elle est prête.`
    : o.has_physical_items
      ? "Votre commande sera préparée et expédiée sous 24-72h. Vous recevrez un email dès l'expédition."
      : "Les instructions d'accès à votre produit ont été envoyées séparément.";

  switch (event) {
    case "payment_confirmed": {
      const recap = itemsBlock(items, o.currency, lang) + digitalBlock(items, lang);
      if (lang === "en") {
        const next = pp
          ? `We are preparing your order. You will be notified as soon as it is ready for pickup at <strong>${pp.name}</strong>.`
          : o.has_physical_items
            ? "We are preparing your order for home delivery (usually 24-72h). You will get an email as soon as it ships."
            : "Your digital access is available right below and on your order page.";
        return {
          subject: `Your Winstorr order is confirmed ✅ — ${o.order_number}`,
          preheader: `Thank you ${firstName} — we received your payment.`,
          heading: "Your order is confirmed ✅",
          body: `Hello <strong>${escapeHtml(o.customer_name)}</strong>,<br><br>
            Thank you for trusting Winstorr. We have received your payment for order <strong>${o.order_number}</strong>.<br>
            Amount paid: <strong>${totalStr}</strong>
            ${recap}
            <strong>What happens next?</strong><br>${next}${pickupBlock(pp, lang)}
            <br><br>Any question? Reply to this email or reach us on WhatsApp at ${SUPPORT_PHONE_DISPLAY}. We are here for you.`,
        };
      }
      return {
        subject: `Votre commande Winstorr est confirmée ✅ — ${o.order_number}`,
        preheader: `Merci ${firstName} — votre paiement est bien reçu.`,
        heading: "Votre commande est confirmée ✅",
        body: `Bonjour <strong>${escapeHtml(o.customer_name)}</strong>,<br><br>
          Merci de votre confiance. Nous avons bien reçu votre paiement pour la commande <strong>${o.order_number}</strong>.<br>
          Montant payé : <strong>${totalStr}</strong>
          ${recap}
          <strong>Prochaines étapes</strong><br>${nextStep}${pickupBlock(pp, lang)}
          <br><br>Une question ? Répondez à cet email ou écrivez-nous sur WhatsApp au ${SUPPORT_PHONE_DISPLAY}. Nous restons à votre écoute.`,
      };
    }

    case "order_placed_cop":
      return {
        subject: `Commande ${o.order_number} enregistrée — paiement à la réception`,
        preheader: "Commande enregistrée. Paiement en espèces à la réception.",
        heading: "Commande enregistrée !",
        body: `Bonjour <strong>${o.customer_name}</strong>,<br><br>
          Votre commande <strong>${o.order_number}</strong> est enregistrée.<br>
          Montant à régler à la réception : <strong>${totalStr}</strong><br><br>
          ${pp
            ? `Réglez en espèces au point de retrait lors du retrait. Nous vous préviendrons dès que la commande est prête.`
            : `Réglez en espèces à notre livreur lors de la livraison.`
          }${pickupBlock(pp)}`,
      };
    case "payment_failed":
      return {
        subject: `Paiement échoué — commande ${o.order_number}`,
        preheader: "Le paiement n'a pas abouti. Vous pouvez réessayer.",
        heading: "Paiement échoué",
        body: `Bonjour <strong>${o.customer_name}</strong>,<br><br>
          Le paiement de la commande <strong>${o.order_number}</strong> n'a pas abouti. Aucun montant n'a été prélevé.<br><br>
          Vous pouvez réessayer sans repasser la commande.`,
      };
    case "ready_for_pickup":
      return {
        subject: `Votre commande ${o.order_number} est prête au retrait`,
        preheader: "Votre commande vous attend.",
        heading: "Commande prête au retrait 📦",
        body: `Bonjour <strong>${o.customer_name}</strong>,<br><br>
          Bonne nouvelle — votre commande <strong>${o.order_number}</strong> est prête. Vous pouvez venir la récupérer.${pickupBlock(pp)}
          <br>Pensez à munir de votre pièce d'identité et du numéro de commande.`,
      };
    case "shipped":
      return {
        subject: `Votre commande ${o.order_number} est en route`,
        preheader: "Livraison en cours.",
        heading: "Votre commande est expédiée 🚚",
        body: `Bonjour <strong>${o.customer_name}</strong>,<br><br>
          Votre commande <strong>${o.order_number}</strong> est en route. Nous vous préviendrons à la livraison.`,
      };
    case "delivered":
      return {
        subject: `Commande ${o.order_number} livrée`,
        preheader: "Livrée — pensez à confirmer la réception.",
        heading: "Commande livrée ✅",
        body: `Bonjour <strong>${o.customer_name}</strong>,<br><br>
          Votre commande <strong>${o.order_number}</strong> a été livrée. Comment s'est passée l'expérience ?<br><br>
          Confirmez la réception dans votre espace pour que le vendeur puisse être payé et laissez un avis.`,
      };
    case "cancelled": {
      const reason = o.notes?.trim();
      return {
        subject: `Commande ${o.order_number} annulée`,
        preheader: "Votre commande a été annulée.",
        heading: "Commande annulée",
        body: `Bonjour <strong>${o.customer_name}</strong>,<br><br>
          Nous sommes désolés — votre commande <strong>${o.order_number}</strong> a été annulée.<br>
          ${reason ? `<em>Motif : ${reason}</em><br><br>` : ""}
          Si un paiement a été effectué, un remboursement est en cours. Nous vous préviendrons dès qu'il est confirmé.`,
      };
    }
  }
}

// ------- Send helpers -------

async function sendEmailHtml(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[notifications:email:mock] RESEND_API_KEY missing — would send to=${to} subject="${subject}"`);
    return { sent: false, mocked: true };
  }
  const from = process.env.RESEND_FROM || "Winstorr <contact@winstorr.com>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[notifications:email] failed", res.status, err);
    return { sent: false, error: err };
  }
  return { sent: true };
}

function stripHtml(html: string) {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\s+\n/g, "\n").trim();
}

// ------- Public API -------

export type NotifyResult = { email: unknown };

async function loadPickupPoint(id: string | null): Promise<PickupPoint | null> {
  if (!id) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("pickup_points")
    .select("name, address, city, contact_phone, opening_hours")
    .eq("id", id)
    .maybeSingle();
  return (data as PickupPoint | null) ?? null;
}

export async function notifyOrderEvent(orderId: string, event: OrderEvent): Promise<NotifyResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, customer_phone, customer_id, total, currency, has_physical_items, delivery_mode, pickup_point_id, notes")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { email: null };

  if (!order.customer_email) {
    console.log(`[notifications] order ${order.order_number} has no email — skipping ${event}`);
    return { email: null };
  }

  // Customer language (profile preference), default French.
  let lang: Lang = "fr";
  if (order.customer_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("preferred_language")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (profile?.preferred_language?.toLowerCase().startsWith("en")) lang = "en";
  }

  // Item recap (used by the confirmation email).
  let items: OrderItem[] = [];
  if (event === "payment_confirmed") {
    const { data: rows } = await supabaseAdmin
      .from("order_items")
      .select("product_name, product_type, quantity, subtotal, product_id")
      .eq("order_id", orderId);
    const list = (rows ?? []) as Array<OrderItem & { product_id: string | null }>;
    const digitalIds = list.filter((i) => i.product_type === "digital" && i.product_id).map((i) => i.product_id!);
    let instructions: Record<string, string | null> = {};
    if (digitalIds.length) {
      const { data: prods } = await supabaseAdmin
        .from("products")
        .select("id, delivery_instructions")
        .in("id", digitalIds);
      instructions = Object.fromEntries((prods ?? []).map((p) => [p.id, p.delivery_instructions]));
    }
    items = list.map((i) => ({
      product_name: i.product_name,
      product_type: i.product_type,
      quantity: i.quantity,
      subtotal: i.subtotal,
      delivery_instructions: i.product_id ? instructions[i.product_id] ?? null : null,
    }));
  }

  const pp = order.delivery_mode === "pickup" ? await loadPickupPoint(order.pickup_point_id) : null;
  const msg = buildCustomerMessage(event, order as OrderCore, pp, items, lang);

  const html = htmlShell({
    preheader: msg.preheader,
    heading: msg.heading,
    body: msg.body,
    ctaLabel: lang === "en" ? "View my order" : "Voir ma commande",
    ctaUrl: orderUrl(order.order_number),
    lang,
  });
  const email = await sendEmailHtml(order.customer_email, msg.subject, html, stripHtml(msg.body));
  return { email };
}


// Notify each vendor with a shipment for this order (called right after payment).
export async function notifyVendorsOfNewShipments(orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: shipments } = await supabaseAdmin
    .from("order_shipments")
    .select("id, shipment_number, vendor_id, subtotal, currency, acceptance_deadline, order_id, orders:order_id(order_number, customer_name)")
    .eq("order_id", orderId)
    .eq("acceptance_status", "pending_acceptance");

  if (!shipments || shipments.length === 0) return;

  for (const s of shipments as Array<{
    id: string;
    shipment_number: string;
    vendor_id: string;
    subtotal: number | string;
    currency: string;
    acceptance_deadline: string | null;
    orders: { order_number: string; customer_name: string } | null;
  }>) {
    const { data: vendor } = await supabaseAdmin
      .from("vendors")
      .select("name, contact_email")
      .eq("id", s.vendor_id)
      .maybeSingle();

    // Fallback: if no contact_email on the store, use the owner's account email.
    let to = vendor?.contact_email ?? null;
    if (!to) {
      const { data: owner } = await supabaseAdmin
        .from("vendor_members")
        .select("user_id")
        .eq("vendor_id", s.vendor_id)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();
      if (owner?.user_id) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(owner.user_id);
        to = authUser?.user?.email ?? null;
      }
    }
    if (!to) {
      console.log(`[notifications:vendor] no email for vendor ${s.vendor_id} — skipping ${s.shipment_number}`);
      continue;
    }


    const deadline = s.acceptance_deadline
      ? new Date(s.acceptance_deadline).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
      : "24 heures";
    const dashboard = `${APP_URL()}/vendeur/commandes`;
    const vendorName = vendor?.name ?? "Vendeur";
    const body = `Bonjour <strong>${vendorName}</strong>,<br><br>
      Vous avez une nouvelle expédition à préparer : <strong>${s.shipment_number}</strong><br>
      Commande : <strong>${s.orders?.order_number ?? ""}</strong> · Client : ${s.orders?.customer_name ?? ""}<br>
      Sous-total : <strong>${money(s.subtotal, s.currency)}</strong><br><br>
      <strong>Vous avez 24h pour accepter ou refuser</strong> (avant le ${deadline}). Sans réponse, la commande sera automatiquement refusée et le client remboursé.`;

    const html = htmlShell({
      preheader: `Nouvelle expédition à préparer — expire dans 24h.`,
      heading: "Nouvelle commande à préparer",
      body,
      ctaLabel: "Voir dans mon tableau de bord",
      ctaUrl: dashboard,
    });
    await sendEmailHtml(
      to,
      `Nouvelle commande ${s.orders?.order_number ?? s.shipment_number} à préparer`,
      html,
      stripHtml(body),
    );
  }
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
    .select("order_number, customer_name, customer_email")
    .eq("id", r.order_id)
    .maybeSingle();
  if (!o || !o.customer_email) return;
  const label = decision === "approved" ? "approuvée" : decision === "rejected" ? "refusée" : "remboursée";
  const subject = `Votre demande de retour (${o.order_number}) est ${label}`;
  const body = `Bonjour <strong>${o.customer_name}</strong>,<br><br>
    Votre demande de retour pour la commande <strong>${o.order_number}</strong> a été <strong>${label}</strong>.
    ${r.refund_amount ? `<br>Montant remboursé : <strong>${Number(r.refund_amount).toLocaleString("fr-FR")} XAF</strong>.` : ""}
    ${r.resolution_notes ? `<br><br><em>Note : ${r.resolution_notes}</em>` : ""}`;
  const html = htmlShell({
    preheader: `Décision sur votre demande de retour.`,
    heading: `Demande de retour ${label}`,
    body,
    ctaLabel: "Voir ma commande",
    ctaUrl: orderUrl(o.order_number),
  });
  await sendEmailHtml(o.customer_email, subject, html, stripHtml(body));
}
