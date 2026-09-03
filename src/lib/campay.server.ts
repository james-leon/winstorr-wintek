// Server-only Campay integration.
//
// SECURITY MODEL
// --------------
// The browser NEVER decides that a payment succeeded. Every "paid" transition
// goes through `applyCampayStatus()`, which is reached only from:
//   1. the webhook route (/api/public/campay-webhook), and
//   2. the server-side reconciliation server function (status-check fallback).
// Both re-query Campay's API with the secret permanent token before acting, and
// both re-compute the expected amount from the order row in the database.
//
// Required server-side secrets:
//   CAMPAY_ENV              -> "demo" (test) | "production"
//   CAMPAY_PERMANENT_TOKEN  -> permanent access token (preferred)
//   CAMPAY_APP_USERNAME     -> fallback: used to mint a short-lived token
//   CAMPAY_APP_PASSWORD     -> fallback
//   CAMPAY_WEBHOOK_KEY      -> webhook signature (JWT) verification key
//   CAMPAY_APP_ID           -> public SDK app id (only semi-public value)

export type CampayStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

export type CampayTransaction = {
  reference: string;
  external_reference: string | null;
  status: CampayStatus;
  amount: number;
  currency: string;
  operator: string | null;
  phone: string | null;
  raw: unknown;
};

export function campayBaseUrl(): string {
  const env = (process.env["CAMPAY_ENV"] || "demo").toLowerCase();
  return env === "production" ? "https://www.campay.net" : "https://demo.campay.net";
}

export function campayConfigured(): boolean {
  return Boolean(
    process.env["CAMPAY_PERMANENT_TOKEN"] ||
      (process.env["CAMPAY_APP_USERNAME"] && process.env["CAMPAY_APP_PASSWORD"]),
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function campayToken(): Promise<string> {
  const permanent = process.env["CAMPAY_PERMANENT_TOKEN"];
  if (permanent) return permanent;

  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const username = process.env["CAMPAY_APP_USERNAME"];
  const password = process.env["CAMPAY_APP_PASSWORD"];
  if (!username || !password) throw new Error("Campay non configuré.");

  const res = await fetch(`${campayBaseUrl()}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const json = (await res.json().catch(() => ({}))) as { token?: string; expires_in?: number };
  if (!res.ok || !json.token) throw new Error("Campay: authentification impossible.");
  cachedToken = { value: json.token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000 };
  return json.token;
}

async function campayFetch(path: string, init?: RequestInit) {
  const token = await campayToken();
  return fetch(`${campayBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

/** Normalise a Cameroon MSISDN to the 237XXXXXXXXX form Campay expects. */
export function normalizeCmPhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  const local = digits.startsWith("237") ? digits.slice(3) : digits.replace(/^0+/, "");
  if (!/^6\d{8}$/.test(local)) return null;
  return `237${local}`;
}

function toStatus(raw: unknown): CampayStatus {
  const s = String(raw ?? "").toUpperCase();
  if (s === "SUCCESSFUL" || s === "SUCCESS") return "SUCCESSFUL";
  if (s === "FAILED" || s === "CANCELLED" || s === "CANCELED" || s === "EXPIRED") return "FAILED";
  return "PENDING";
}

/** Server-initiated mobile money collect. Returns the Campay transaction reference. */
export async function campayCollect(input: {
  amount: number;
  phone: string;
  description: string;
  externalReference: string;
}): Promise<{ reference: string; operator: string | null; ussdCode: string | null }> {
  const res = await campayFetch("/api/collect/", {
    method: "POST",
    body: JSON.stringify({
      amount: String(Math.round(input.amount)),
      currency: "XAF",
      from: input.phone,
      description: input.description,
      external_reference: input.externalReference,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    reference?: string;
    operator?: string;
    ussd_code?: string;
    message?: string;
    detail?: string;
  };
  if (!res.ok || !json.reference) {
    throw new Error(json.message || json.detail || "Campay: initiation du paiement impossible.");
  }
  return { reference: json.reference, operator: json.operator ?? null, ussdCode: json.ussd_code ?? null };
}

/** Hosted payment page (supports MoMo + bank card). */
export async function campayPaymentLink(input: {
  amount: number;
  description: string;
  externalReference: string;
  redirectUrl: string;
  failureRedirectUrl: string;
}): Promise<{ link: string }> {
  const res = await campayFetch("/api/get_payment_link/", {
    method: "POST",
    body: JSON.stringify({
      amount: String(Math.round(input.amount)),
      currency: "XAF",
      description: input.description,
      external_reference: input.externalReference,
      redirect_url: input.redirectUrl,
      failure_redirect_url: input.failureRedirectUrl,
      payment_options: "MOMO,CARD",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { link?: string; message?: string; detail?: string };
  if (!res.ok || !json.link) throw new Error(json.message || json.detail || "Campay: lien de paiement indisponible.");
  return { link: json.link };
}

/** Authoritative status read straight from Campay with the secret token. */
export async function campayGetTransaction(reference: string): Promise<CampayTransaction> {
  const res = await campayFetch(`/api/transaction/${encodeURIComponent(reference)}/`, { method: "GET" });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error("Campay: transaction introuvable.");
  return {
    reference: String(json["reference"] ?? reference),
    external_reference: (json["external_reference"] as string) ?? null,
    status: toStatus(json["status"]),
    amount: Number(json["amount"] ?? 0),
    currency: String(json["currency"] ?? "XAF"),
    operator: (json["operator"] as string) ?? null,
    phone: (json["phone_number"] as string) ?? null,
    raw: json,
  };
}

/**
 * Verify the JWT-style signature Campay puts in its webhook payload.
 * Defence in depth only — the caller still re-reads the transaction from the API.
 */
export async function verifyCampayWebhookSignature(signature: string): Promise<boolean> {
  const key = process.env["CAMPAY_WEBHOOK_KEY"];
  if (!key || !signature) return false;
  const parts = signature.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, sig] = parts;
  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${header}.${payload}`));
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

function mapOperator(operator: string | null): "mtn_momo" | "orange_money" | "card" {
  const o = (operator ?? "").toUpperCase();
  if (o.includes("MTN")) return "mtn_momo";
  if (o.includes("ORANGE") || o.includes("OM")) return "orange_money";
  return "card";
}

export type ApplyResult = { orderId: string; paymentStatus: "paid" | "failed" | "pending"; changed: boolean };

/**
 * THE single place where an order becomes paid.
 * - Re-reads the transaction from Campay (never trusts the caller's payload).
 * - Re-computes the expected total from the orders table.
 * - Idempotent: a second notification for the same transaction is a no-op.
 */
export async function applyCampayStatus(reference: string): Promise<ApplyResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tx = await campayGetTransaction(reference);

  const { data: txRow } = await supabaseAdmin
    .from("payment_transactions")
    .select("id, order_id, status, external_reference")
    .eq("provider", "campay")
    .eq("reference", tx.reference)
    .maybeSingle();

  const externalRef = tx.external_reference || txRow?.external_reference || "";

  let orderId = txRow?.order_id ?? null;
  if (!orderId && externalRef) {
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("order_number", externalRef)
      .maybeSingle();
    orderId = o?.id ?? null;
  }
  if (!orderId) throw new Error("Commande introuvable pour cette transaction.");

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("Commande introuvable.");

  const patch = {
    order_id: orderId,
    provider: "campay",
    reference: tx.reference,
    external_reference: externalRef || order.order_number,
    status: tx.status,
    amount: tx.amount,
    currency: tx.currency,
    operator: tx.operator,
    phone: tx.phone,
    raw: tx.raw as never,
  };
  if (txRow) {
    await supabaseAdmin.from("payment_transactions").update(patch).eq("id", txRow.id);
  } else {
    await supabaseAdmin.from("payment_transactions").insert(patch);
  }

  // Idempotency: never re-run the post-payment flow.
  if (order.payment_status === "paid") return { orderId, paymentStatus: "paid", changed: false };

  if (tx.status === "SUCCESSFUL") {
    // Amount verification against the server-side order total.
    const expected = Math.round(Number(order.total));
    if (Math.round(tx.amount) < expected) {
      console.error("[campay] amount mismatch", { reference: tx.reference, got: tx.amount, expected });
      return { orderId, paymentStatus: "pending", changed: false };
    }

    const { error } = await supabaseAdmin.rpc("confirm_order_payment", {
      _order_id: orderId,
      _txn_id: tx.reference,
      _method: mapOperator(tx.operator),
    });
    if (error) throw new Error(error.message);

    const { notifyOrderEvent, notifyVendorsOfNewShipments } = await import("./notifications.server");
    await notifyOrderEvent(orderId, "payment_confirmed").catch((e) => console.error("[notify]", e));
    notifyVendorsOfNewShipments(orderId).catch((e) => console.error("[notify:vendors]", e));
    const { redeemOrderCouponIfAny } = await import("./coupons.server");
    await redeemOrderCouponIfAny(orderId).catch((e) => console.error("[redeem]", e));
    // Digital goods are delivered by the same post-payment notification flow,
    // which only ever runs from here — i.e. after server-side confirmation.
    return { orderId, paymentStatus: "paid", changed: true };
  }

  if (tx.status === "FAILED") {
    await supabaseAdmin
      .from("orders")
      .update({ payment_status: "failed", status: "payment_failed", cinetpay_transaction_id: tx.reference })
      .eq("id", orderId);
    const { notifyOrderEvent } = await import("./notifications.server");
    await notifyOrderEvent(orderId, "payment_failed").catch((e) => console.error("[notify]", e));
    return { orderId, paymentStatus: "failed", changed: true };
  }

  return { orderId, paymentStatus: "pending", changed: false };
}
