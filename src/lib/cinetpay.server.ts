// Server-only helpers for CinetPay integration.
// TODO: Replace mock branch with real CinetPay REST calls once API credentials are provided.
//
// Required env vars (set in your hosting / Supabase secrets when going live):
//   - CINETPAY_API_KEY
//   - CINETPAY_SITE_ID
//   - CINETPAY_SECRET_KEY (for HMAC verification of webhook payloads, optional depending on setup)
//   - CINETPAY_BASE_URL (default https://api-checkout.cinetpay.com/v2)
//   - APP_PUBLIC_URL (e.g. https://winstorr.com) — used to build return/notify URLs

export type InitiatePaymentInput = {
  orderNumber: string;
  amount: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  returnUrl: string;
  notifyUrl: string;
  description: string;
};

export type InitiatePaymentResult = {
  paymentUrl: string;
  paymentToken: string;
  mocked: boolean;
};

function credsConfigured() {
  return Boolean(process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID);
}

export async function initiateCinetpayPayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
  const base = process.env.CINETPAY_BASE_URL || "https://api-checkout.cinetpay.com/v2";

  if (!credsConfigured()) {
    // Scaffold mode — allows the full flow to be exercised without live keys.
    // In this mode the "payment page" is our own confirmation URL so we can
    // manually mark the order as paid via admin for testing.
    console.warn("[cinetpay] credentials missing — returning mock payment URL");
    return {
      paymentUrl: input.returnUrl + "?mock=1",
      paymentToken: "MOCK-" + input.orderNumber,
      mocked: true,
    };
  }

  const body = {
    apikey: process.env.CINETPAY_API_KEY,
    site_id: process.env.CINETPAY_SITE_ID,
    transaction_id: input.orderNumber,
    amount: Math.round(input.amount),
    currency: input.currency,
    description: input.description,
    return_url: input.returnUrl,
    notify_url: input.notifyUrl,
    customer_name: input.customerName,
    customer_phone_number: input.customerPhone,
    customer_email: input.customerEmail ?? undefined,
    channels: "ALL", // MTN MoMo, Orange Money, cards
  };

  const res = await fetch(`${base}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    code?: string;
    message?: string;
    data?: { payment_url?: string; payment_token?: string };
  };
  if (json.code !== "201" || !json.data?.payment_url) {
    throw new Error(`CinetPay init failed: ${json.code} ${json.message}`);
  }
  return {
    paymentUrl: json.data.payment_url,
    paymentToken: json.data.payment_token ?? "",
    mocked: false,
  };
}

export type VerifyResult = {
  status: "paid" | "failed" | "pending";
  transactionId: string;
  method: "mtn_momo" | "orange_money" | "card" | null;
  raw: unknown;
};

// Server-to-server re-verification. Always call this before trusting a webhook body.
export async function verifyCinetpayTransaction(orderNumber: string): Promise<VerifyResult> {
  const base = process.env.CINETPAY_BASE_URL || "https://api-checkout.cinetpay.com/v2";
  if (!credsConfigured()) {
    return { status: "pending", transactionId: "MOCK-" + orderNumber, method: null, raw: { mocked: true } };
  }
  const res = await fetch(`${base}/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: process.env.CINETPAY_API_KEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: orderNumber,
    }),
  });
  const json = (await res.json()) as {
    code?: string;
    message?: string;
    data?: { status?: string; payment_method?: string; operator_id?: string; cpm_trans_id?: string };
  };
  const st = json.data?.status;
  const status: VerifyResult["status"] = st === "ACCEPTED" ? "paid" : st === "REFUSED" ? "failed" : "pending";
  const rawMethod = (json.data?.payment_method ?? "").toUpperCase();
  const method: VerifyResult["method"] = rawMethod.includes("MTN")
    ? "mtn_momo"
    : rawMethod.includes("OM") || rawMethod.includes("ORANGE")
    ? "orange_money"
    : rawMethod
    ? "card"
    : null;
  return {
    status,
    transactionId: json.data?.cpm_trans_id ?? orderNumber,
    method,
    raw: json,
  };
}
