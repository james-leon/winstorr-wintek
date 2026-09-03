import { createFileRoute } from "@tanstack/react-router";

// Campay server-to-server notification.
//
// The body is NEVER trusted: we only extract the transaction reference, verify
// the payload signature when present, then re-read the authoritative transaction
// from Campay's API with the secret token before touching the order.
export const Route = createFileRoute("/api/public/campay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") || "";
          let payload: Record<string, string> = {};
          if (contentType.includes("application/json")) {
            const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
            payload = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v ?? "")]));
          } else {
            const form = await request.formData().catch(() => null);
            if (form) payload = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
          }
          // Campay may also append params to the notification URL.
          const url = new URL(request.url);
          for (const [k, v] of url.searchParams.entries()) payload[k] = payload[k] ?? v;

          const reference = payload["reference"] || payload["transaction_reference"] || "";
          if (!reference) return new Response("missing reference", { status: 400 });

          const { verifyCampayWebhookSignature, applyCampayStatus } = await import("@/lib/campay.server");

          const signature = payload["signature"] || "";
          if (process.env["CAMPAY_WEBHOOK_KEY"]) {
            const ok = await verifyCampayWebhookSignature(signature);
            if (!ok) {
              console.error("[campay-webhook] invalid signature", { reference });
              return new Response("invalid signature", { status: 401 });
            }
          }

          const result = await applyCampayStatus(reference);
          return new Response(result.paymentStatus, { status: 200 });
        } catch (e) {
          console.error("[campay-webhook]", e);
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => new Response("campay-webhook up", { status: 200 }),
    },
  },
});
