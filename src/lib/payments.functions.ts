import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const startSchema = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  mode: z.enum(["momo", "card"]),
  phone: z.string().trim().max(30).optional().nullable(),
});

/**
 * Starts a Campay payment for an existing pending order.
 * The amount always comes from the order row — never from the client.
 */
export const startCampayPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => startSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { campayCollect, campayPaymentLink, campayConfigured, normalizeCmPhone } = await import("./campay.server");

    if (!campayConfigured()) throw new Error("Le paiement en ligne n'est pas encore configuré.");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, currency, payment_status, customer_phone")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (error || !order) throw new Error("Commande introuvable.");
    if (order.payment_status === "paid") {
      return { mode: "paid" as const, reference: null, link: null, operator: null, ussdCode: null };
    }

    const amount = Math.round(Number(order.total));
    if (amount <= 0) throw new Error("Montant de commande invalide.");
    const description = `Winstorr — commande ${order.order_number}`;

    if (data.mode === "card") {
      const appUrl = process.env["APP_PUBLIC_URL"] || "";
      const back = `${appUrl}/commande/${order.order_number}/confirmation`;
      const { link } = await campayPaymentLink({
        amount,
        description,
        externalReference: order.order_number,
        redirectUrl: back,
        failureRedirectUrl: back,
      });
      await supabaseAdmin.from("payment_transactions").insert({
        order_id: order.id,
        provider: "campay",
        external_reference: order.order_number,
        status: "PENDING",
        amount,
        currency: order.currency ?? "XAF",
        operator: "payment_link",
      });
      return { mode: "redirect" as const, reference: null, link, operator: null, ussdCode: null };
    }

    const phone = normalizeCmPhone(data.phone || order.customer_phone || "");
    if (!phone) throw new Error("Numéro Mobile Money invalide (ex. 6XX XX XX XX).");

    const collect = await campayCollect({
      amount,
      phone,
      description,
      externalReference: order.order_number,
    });

    await supabaseAdmin.from("payment_transactions").insert({
      order_id: order.id,
      provider: "campay",
      reference: collect.reference,
      external_reference: order.order_number,
      status: "PENDING",
      amount,
      currency: order.currency ?? "XAF",
      operator: collect.operator,
      phone,
    });

    return {
      mode: "prompt" as const,
      reference: collect.reference,
      link: null,
      operator: collect.operator,
      ussdCode: collect.ussdCode,
    };
  });

/**
 * Status-check fallback (webhook is primary). Re-queries Campay server-side for
 * every non-final transaction of the order and applies the result idempotently.
 */
export const reconcileOrderPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ orderNumber: z.string().trim().min(4).max(40) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!order) throw new Error("Commande introuvable.");
    if (order.payment_status === "paid") return { paymentStatus: "paid" as const };

    const { data: txs } = await supabaseAdmin
      .from("payment_transactions")
      .select("reference, status")
      .eq("order_id", order.id)
      .eq("provider", "campay")
      .not("reference", "is", null)
      .neq("status", "SUCCESSFUL")
      .order("created_at", { ascending: false })
      .limit(5);

    const { applyCampayStatus } = await import("./campay.server");
    let result: "paid" | "failed" | "pending" = "pending";
    for (const tx of txs ?? []) {
      if (!tx.reference) continue;
      try {
        const r = await applyCampayStatus(tx.reference);
        if (r.paymentStatus === "paid") return { paymentStatus: "paid" as const };
        if (r.paymentStatus === "failed") result = "failed";
      } catch (e) {
        console.error("[campay:reconcile]", e);
      }
    }
    return { paymentStatus: result };
  });
